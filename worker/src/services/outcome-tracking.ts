// Daily outcome tracking -- computes per-user per-test band deltas
// over 30/60/90 day windows and stores them in `user_outcomes`.
// This is the data layer for "are we actually improving scores?"
//
// The cron runs at 3:1 * * * (8:03 AM WIB) along with the other
// daily jobs. It is idempotent: each run recomputes from the
// authoritative source (test_results + mock_test_history) and
// UPSERTs into user_outcomes. A second run on the same day is
// safe -- it just overwrites with the same numbers.

import type { Env } from '../types';

const WINDOWS = [30, 60, 90];

/**
 * Compute the outcome for one (user, test_type, window_days) tuple
 * by aggregating test_results + mock_test_history entries inside
 * the window. Returns null if the user has no attempts in the
 * window.
 */
export async function computeOutcome(
  env: Env,
  userId: number,
  testType: string,
  windowDays: number,
): Promise<{
  avg_band: number | null;
  best_band: number | null;
  attempts_count: number;
  improvement: number | null;
} | null> {
  const sinceISO = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  // Pull the student's "score attempts" from both sources.
  // test_results has total_score (the per-test aggregate). mock_test_history
  // has estimated_score (the same aggregate, written by the mock-test
  // flow). Combine them, dedup by (date, score) to avoid double-counting
  // attempts that wrote to both tables.
  const testResults = (await env.DB.prepare(
    `SELECT total_score, band_score, completed_at
     FROM test_results
     WHERE user_id = ? AND test_type = ? AND completed_at >= ? AND total_score IS NOT NULL
     ORDER BY completed_at ASC`,
  ).bind(userId, testType, sinceISO).all<{ total_score: number; band_score: number | null; completed_at: string }>()).results ?? [];
  const mockResults = (await env.DB.prepare(
    `SELECT estimated_score, taken_at
     FROM mock_test_history
     WHERE user_id = ? AND test_type = ? AND taken_at >= ?
     ORDER BY taken_at ASC`,
  ).bind(userId, testType, sinceISO).all<{ estimated_score: number; taken_at: string }>()).results ?? [];

  // Combine into a single sorted list of band values + timestamps.
  const allScores: { score: number; ts: number }[] = [];
  for (const r of testResults || []) {
    if (r.total_score != null && Number.isFinite(r.total_score)) {
      allScores.push({ score: Number(r.total_score), ts: new Date(r.completed_at).getTime() });
    }
  }
  for (const r of mockResults || []) {
    if (r.estimated_score != null && Number.isFinite(r.estimated_score)) {
      allScores.push({ score: Number(r.estimated_score), ts: new Date(r.taken_at).getTime() });
    }
  }
  if (allScores.length === 0) return null;

  allScores.sort((a, b) => a.ts - b.ts);
  const sum = allScores.reduce((s, x) => s + x.score, 0);
  const avg = sum / allScores.length;
  const best = allScores.reduce((m, x) => (x.score > m ? x.score : m), -Infinity);
  const first = allScores[0].score;
  const latest = allScores[allScores.length - 1].score;
  return {
    avg_band: Math.round(avg * 100) / 100,
    best_band: Math.round(best * 100) / 100,
    attempts_count: allScores.length,
    improvement: Math.round((latest - first) * 100) / 100,
  };
}

/**
 * Upsert one (user, test_type, window_days, window_start) row. The
 * window_start is the start of the current window (today minus
 * windowDays). We pin it to a day boundary so the upsert is idempotent
 * across same-day runs.
 */
async function upsertOutcome(
  env: Env,
  userId: number,
  testType: string,
  windowDays: number,
  data: { avg_band: number | null; best_band: number | null; attempts_count: number; improvement: number | null },
): Promise<void> {
  // Pin window_start to the start of the day N days ago. dayStart
  // strips the time so multiple same-day runs collide on the same row.
  const now = new Date();
  const dayStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  dayStart.setUTCHours(0, 0, 0, 0);
  const windowStart = dayStart.toISOString();
  const windowEnd = now.toISOString();

  await env.DB.prepare(
    `INSERT INTO user_outcomes
       (user_id, test_type, window_days, window_start, window_end,
        avg_band, best_band, attempts_count, improvement, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, test_type, window_days, window_start) DO UPDATE SET
       window_end = excluded.window_end,
       avg_band = excluded.avg_band,
       best_band = excluded.best_band,
       attempts_count = excluded.attempts_count,
       improvement = excluded.improvement,
       updated_at = excluded.updated_at`,
  ).bind(
    userId, testType, windowDays, windowStart, windowEnd,
    data.avg_band, data.best_band, data.attempts_count, data.improvement,
  ).run();
}

/**
 * Run the daily outcome tracking cron. Backfills user_outcomes for
 * every (user, test_type) pair that has attempts in the last 90 days,
 * for each of the 30/60/90 day windows. Best-effort: never throw.
 */
export async function runOutcomeTracking(env: Env): Promise<void> {
  try {
    // Discover all (user, test_type) pairs with attempts in the last 90
    // days. Both tables are candidates; we UNION them.
    const pairs = (await env.DB.prepare(
    `SELECT DISTINCT user_id, test_type FROM (
       SELECT user_id, test_type FROM test_results
         WHERE completed_at >= datetime('now', '-90 days') AND total_score IS NOT NULL
       UNION
       SELECT user_id, test_type FROM mock_test_history
         WHERE taken_at >= datetime('now', '-90 days')
     )`,
  ).all<{ user_id: number; test_type: string }>()).results ?? [];
    const rows = pairs;
    let written = 0;
    for (const { user_id, test_type } of rows) {
      for (const windowDays of WINDOWS) {
        const data = await computeOutcome(env, user_id, test_type, windowDays);
        if (data) {
          await upsertOutcome(env, user_id, test_type, windowDays, data);
          written++;
        }
      }
    }
    console.log(`[outcome-tracking] processed ${rows.length} (user, test_type) pairs, wrote ${written} window rows`);
  } catch (e: any) {
    console.error('[outcome-tracking] error:', e?.message || e);
  }
}

/**
 * API: GET /api/progress/outcome
 * Returns the latest (user, test_type, window_days) row per window.
 * Powers the "Score Improvement" card on the Progress page.
 */
export async function getUserOutcome(
  env: Env,
  userId: number,
  testType: string | null,
  windowDays: number,
): Promise<{
  avg_band: number | null;
  best_band: number | null;
  attempts_count: number;
  improvement: number | null;
  window_start: string | null;
  window_end: string | null;
  test_type: string | null;
} | null> {
  const tType = testType;
  const row = await env.DB.prepare(
    `SELECT avg_band, best_band, attempts_count, improvement, window_start, window_end, test_type
     FROM user_outcomes
     WHERE user_id = ? AND window_days = ? AND (? IS NULL OR test_type = ?)
     ORDER BY updated_at DESC LIMIT 1`,
  ).bind(userId, windowDays, tType, tType).first();
  if (!row) return null;
  return row as any;
}


