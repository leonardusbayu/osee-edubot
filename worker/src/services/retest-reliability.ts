// Test-retest reliability tracker.
//
// Finds pairs of attempts from the same user on the same test_type taken
// within a short window (default 7 days — too short for real skill gains
// to dominate noise). Records per-pair deltas and rolls up cohort stats.
//
// A healthy assessment has test-retest correlation > 0.85 and median
// absolute delta < 0.5 bands. Weaker than that = scoring noise is drowning
// out actual ability signal.

import type { Env } from '../types';

export interface RetestResult {
  windowed_pairs_scanned: number;
  pairs_written: number;
  snapshots_written: number;
  duration_ms: number;
}

const DEFAULT_WINDOW_HOURS = 7 * 24;
const UNRELIABLE_DELTA = 0.5;
const UNRELIABLE_WINDOW_HOURS = 48;

function pearsonR(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/**
 * Find every (attempt_a, attempt_b) pair from the same user + test_type
 * where a was taken first and b within the window. Only finished attempts
 * with a non-null band_score count.
 */
export async function findPairs(env: Env, windowHours: number = DEFAULT_WINDOW_HOURS): Promise<Array<{
  user_id: number;
  test_type: string;
  a_id: number; b_id: number;
  a_score: number; b_score: number;
  hours_between: number;
}>> {
  const { results } = await env.DB.prepare(
    `SELECT a.user_id AS user_id, a.test_type AS test_type,
            a.id AS a_id, b.id AS b_id,
            COALESCE(a.band_score, a.total_score) AS a_score,
            COALESCE(b.band_score, b.total_score) AS b_score,
            (julianday(b.finished_at) - julianday(a.finished_at)) * 24.0 AS hours_between
       FROM test_attempts a
       JOIN test_attempts b ON b.user_id = a.user_id
                           AND b.test_type = a.test_type
                           AND b.id > a.id
                           AND b.finished_at IS NOT NULL
      WHERE a.finished_at IS NOT NULL
        AND a.band_score IS NOT NULL
        AND b.band_score IS NOT NULL
        AND (julianday(b.finished_at) - julianday(a.finished_at)) * 24.0 BETWEEN 0.5 AND ?
        AND a.finished_at > datetime('now', '-180 days')`,
  ).bind(windowHours).all<any>();

  return (results || []).map((r: any) => ({
    user_id: Number(r.user_id),
    test_type: String(r.test_type),
    a_id: Number(r.a_id),
    b_id: Number(r.b_id),
    a_score: Number(r.a_score),
    b_score: Number(r.b_score),
    hours_between: Number(r.hours_between),
  }));
}

export async function runRetestReliability(env: Env, windowHours: number = DEFAULT_WINDOW_HOURS): Promise<RetestResult> {
  const startedAt = Date.now();
  const pairs = await findPairs(env, windowHours);

  let written = 0;
  for (const p of pairs) {
    const delta = p.b_score - p.a_score;
    const absDelta = Math.abs(delta);
    const flag = absDelta > UNRELIABLE_DELTA && p.hours_between < UNRELIABLE_WINDOW_HOURS
      ? 'unreliable' : null;

    try {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO test_retest_pairs
           (user_id, test_type, attempt_a_id, attempt_b_id,
            score_a, score_b, delta, abs_delta, hours_between, flag)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(p.user_id, p.test_type, p.a_id, p.b_id,
              p.a_score, p.b_score, delta, absDelta, p.hours_between, flag).run();
      written++;
    } catch {}
  }

  // Compute per-test_type snapshots using ALL pairs (not just new ones)
  const { results: types } = await env.DB.prepare(
    `SELECT DISTINCT test_type FROM test_retest_pairs`,
  ).all<any>();

  let snapshotCount = 0;
  for (const t of (types || [])) {
    const testType = String((t as any).test_type);
    const { results: allPairs } = await env.DB.prepare(
      `SELECT score_a, score_b, abs_delta, flag
         FROM test_retest_pairs
        WHERE test_type = ?`,
    ).bind(testType).all<any>();

    const xs: number[] = [];
    const ys: number[] = [];
    const absDs: number[] = [];
    let unreliable = 0;
    for (const p of allPairs || []) {
      xs.push(Number((p as any).score_a));
      ys.push(Number((p as any).score_b));
      absDs.push(Number((p as any).abs_delta));
      if ((p as any).flag === 'unreliable') unreliable++;
    }
    if (xs.length < 3) continue;

    const n = xs.length;
    const meanAbs = absDs.reduce((a, b) => a + b, 0) / n;
    const medAbs = median(absDs);
    const within05 = absDs.filter((d) => d <= 0.5).length / n;
    const within10 = absDs.filter((d) => d <= 1.0).length / n;
    const r = pearsonR(xs, ys);

    await env.DB.prepare(
      `INSERT INTO test_retest_snapshots
         (test_type, window_hours, pair_count,
          mean_abs_delta, median_abs_delta,
          within_half_band_pct, within_one_band_pct,
          retest_correlation, unreliable_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(testType, windowHours, n, meanAbs, medAbs, within05, within10, r, unreliable).run();
    snapshotCount++;
  }

  return {
    windowed_pairs_scanned: pairs.length,
    pairs_written: written,
    snapshots_written: snapshotCount,
    duration_ms: Date.now() - startedAt,
  };
}
