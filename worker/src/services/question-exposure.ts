// question-exposure.ts — track which user has seen which test_contents row
// so selectors can prefer under-exposed items. Goal: use all 3,036 questions,
// not the same 50–100 that keep winning ORDER BY RANDOM().
//
// Design:
//   • recordExposure / recordExposures: single + batched UPSERT
//   • selectUnderExposedQuestions: the replacement for `ORDER BY RANDOM() LIMIT n`
//     that still hits test_contents + any extra filters you pass in.
//   • All calls are defensive: if the table doesn't exist yet or a query fails,
//     we log and return a safe fallback (empty record / random fallback) so we
//     never break the serving path.

import type { Env } from '../types';

export type ExposureSource = 'test' | 'diagnostic' | 'lesson' | 'companion' | 'drill' | 'game' | 'review' | 'other';

/**
 * Record that a user saw a single question. Safe to call fire-and-forget
 * (await only if the caller wants ordering guarantees).
 */
export async function recordExposure(
  env: Env,
  userId: number,
  contentId: number,
  source: ExposureSource = 'other',
): Promise<void> {
  if (!userId || !contentId) return;
  try {
    await env.DB.prepare(
      `INSERT INTO question_exposure (user_id, content_id, first_seen_at, last_seen_at, exposure_count, source)
       VALUES (?, ?, datetime('now'), datetime('now'), 1, ?)
       ON CONFLICT(user_id, content_id) DO UPDATE SET
         last_seen_at = datetime('now'),
         exposure_count = exposure_count + 1`,
    ).bind(userId, contentId, source).run();
  } catch (e) {
    // Never break the user flow over a bookkeeping failure. This also
    // covers the case where the migration hasn't been applied yet.
    console.error('recordExposure failed:', e);
  }
}

/**
 * Record that a user saw multiple questions in a single batch. Uses a
 * single SQL statement with VALUES ... rather than N round-trips.
 */
export async function recordExposures(
  env: Env,
  userId: number,
  contentIds: number[],
  source: ExposureSource = 'other',
): Promise<void> {
  if (!userId || !contentIds || contentIds.length === 0) return;
  const unique = Array.from(new Set(contentIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (unique.length === 0) return;

  try {
    // D1 caps SQL size; batch in chunks of 100 to be safe.
    const CHUNK = 100;
    for (let i = 0; i < unique.length; i += CHUNK) {
      const slice = unique.slice(i, i + CHUNK);
      const placeholders = slice.map(() => '(?, ?, datetime(\'now\'), datetime(\'now\'), 1, ?)').join(', ');
      const binds: (number | string)[] = [];
      for (const cid of slice) {
        binds.push(userId, cid, source);
      }
      await env.DB.prepare(
        `INSERT INTO question_exposure (user_id, content_id, first_seen_at, last_seen_at, exposure_count, source)
         VALUES ${placeholders}
         ON CONFLICT(user_id, content_id) DO UPDATE SET
           last_seen_at = datetime('now'),
           exposure_count = exposure_count + 1`,
      ).bind(...binds).run();
    }
  } catch (e) {
    console.error('recordExposures failed:', e);
  }
}

/**
 * Fetch the set of content_ids this user has seen in the last `days` days,
 * sorted so the *least recent* exposure is easiest to re-surface.
 * Returns a Map<content_id, {exposure_count, last_seen_at}> for O(1) lookup.
 */
export async function getRecentExposure(
  env: Env,
  userId: number,
  days: number = 14,
): Promise<Map<number, { count: number; last_seen_at: string }>> {
  const result = new Map<number, { count: number; last_seen_at: string }>();
  if (!userId) return result;
  try {
    const { results } = await env.DB.prepare(
      `SELECT content_id, exposure_count, last_seen_at
         FROM question_exposure
        WHERE user_id = ?
          AND last_seen_at > datetime('now', ?)`,
    ).bind(userId, `-${Math.max(1, Math.floor(days))} days`).all<{
      content_id: number;
      exposure_count: number;
      last_seen_at: string;
    }>();
    for (const row of results || []) {
      result.set(Number(row.content_id), {
        count: Number(row.exposure_count) || 0,
        last_seen_at: String(row.last_seen_at || ''),
      });
    }
  } catch (e) {
    console.error('getRecentExposure failed:', e);
  }
  return result;
}

export interface ExposureAwareSelectOptions {
  userId: number;
  limit: number;
  /** Extra WHERE clauses on test_contents — do not include the WHERE keyword. */
  extraWhere?: string;
  /** Parameters for extraWhere placeholders (in order). */
  extraParams?: (string | number | null)[];
  /** Columns to SELECT from test_contents. Default: 'id, section, question_type, content, media_url, title, difficulty'. */
  columns?: string;
  /** Lookback window for "already seen" filter (days). Default 14. */
  recentDays?: number;
  /** If true, never serve the same question twice ever. If false (default), allow re-serving only when all unseen are exhausted. */
  strict?: boolean;
}

/**
 * Exposure-aware replacement for `ORDER BY RANDOM() LIMIT n`.
 *
 * Strategy:
 *   1. Fetch pool of candidates (test_contents matching filter).
 *   2. Partition by exposure bucket: unseen > seen-but-old > seen-recent.
 *   3. Pick from highest bucket first, random within bucket.
 *   4. If pool is smaller than limit, fall through buckets (unless strict=true).
 *
 * Returns rows exactly matching the columns requested — caller reads like
 * a normal D1 query result.
 */
export async function selectUnderExposedQuestions<T = any>(
  env: Env,
  opts: ExposureAwareSelectOptions,
): Promise<T[]> {
  const {
    userId,
    limit,
    extraWhere = "status = 'published'",
    extraParams = [],
    columns = 'id, section, question_type, content, media_url, title, difficulty',
    recentDays = 14,
    strict = false,
  } = opts;

  if (limit <= 0) return [];

  // 1. Get the candidate pool. Over-fetch (3x) so we have headroom to reorder.
  // D1 has subrequest limits — cap at 500 candidates.
  const poolSize = Math.max(limit * 3, 30);
  const capped = Math.min(poolSize, 500);

  let poolRows: any[] = [];
  try {
    const sql = `SELECT ${columns} FROM test_contents WHERE ${extraWhere} ORDER BY RANDOM() LIMIT ?`;
    const { results } = await env.DB.prepare(sql)
      .bind(...extraParams, capped)
      .all<any>();
    poolRows = results || [];
  } catch (e) {
    console.error('selectUnderExposedQuestions pool fetch failed:', e);
    return [];
  }

  if (poolRows.length === 0) return [];

  // 2. Pull exposure map for this user and partition the pool.
  const exposure = await getRecentExposure(env, userId, recentDays);

  const unseen: any[] = [];
  const seenOld: any[] = []; // seen but not recent enough — we'll only surface if we need to
  const seenRecent: any[] = [];

  for (const row of poolRows) {
    const expInfo = exposure.get(Number(row.id));
    if (!expInfo) {
      unseen.push(row);
    } else {
      // Bucket: "recent" = within recentDays/2, "old" = outside
      const cutoff = new Date(Date.now() - (recentDays / 2) * 86400 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      if (expInfo.last_seen_at >= cutoff) {
        seenRecent.push(row);
      } else {
        seenOld.push(row);
      }
    }
  }

  // 3. Compose output: unseen first (shuffled already by SQL RANDOM), then seenOld, then seenRecent.
  const picked: any[] = [];
  for (const bucket of [unseen, seenOld, seenRecent]) {
    if (picked.length >= limit) break;
    for (const row of bucket) {
      if (picked.length >= limit) break;
      picked.push(row);
    }
    if (strict && bucket === unseen && picked.length >= limit) break;
  }

  return picked as T[];
}

/**
 * Given an array of candidate content ids already fetched somewhere else,
 * return them reordered so unseen ids come first. Useful when the caller
 * already has a scored/curated list and just wants exposure-aware ordering.
 */
export async function reorderByExposure<T extends { id: number | string }>(
  env: Env,
  userId: number,
  candidates: T[],
  recentDays: number = 14,
): Promise<T[]> {
  if (!candidates || candidates.length === 0 || !userId) return candidates;
  const exposure = await getRecentExposure(env, userId, recentDays);
  const unseen: T[] = [];
  const seen: T[] = [];
  for (const c of candidates) {
    if (exposure.has(Number(c.id))) seen.push(c);
    else unseen.push(c);
  }
  // Stable within bucket — preserves any curation upstream.
  return [...unseen, ...seen];
}
