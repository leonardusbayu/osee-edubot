// ability-matching.ts — ROADMAP_M3 §2.1: activate the IRT engine for selection.
//
// Two jobs:
//   • updateAbilityAfterSession: cheap incremental theta update per section,
//     persisted to `student_ability` (migration 095). No matrix math — a
//     Robbins-Monro style step θ += K * (correct − P(correct|θ,b)) with a
//     learning rate that decays as the student accumulates responses.
//   • selectAbilityMatchedQuestions: pick published questions whose effective
//     difficulty sits in the student's challenge zone (±0.5 of θ), blended
//     70% ability-matched / 20% exposure-aware review / 10% stretch.
//
// Everything is defensive: if the table is missing, theta is unknown, or the
// candidate pool is too thin (< 2× requested count), we return null and the
// caller falls back to the existing selectUnderExposedQuestions path.

import type { Env } from '../types';
import { prob2PL } from './irt-engine';
import { selectUnderExposedQuestions, reorderByExposure } from './question-exposure';

/** Map the legacy 1-5 difficulty column onto the theta/logit scale. */
function difficultyColToTheta(d: number | null | undefined): number {
  const v = Number(d);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return (v - 3) / 1.5;
}

/** Effective item difficulty: calibrated IRT b if trustworthy, else mapped column. */
function effectiveDifficulty(row: {
  irt_b?: number | null;
  irt_responses?: number | null;
  difficulty?: number | null;
}): number {
  if (
    row.irt_b !== null && row.irt_b !== undefined &&
    Number(row.irt_responses) >= 5
  ) {
    return Number(row.irt_b);
  }
  return difficultyColToTheta(row.difficulty);
}

/**
 * Incremental theta update after a finished session.
 * Processes attempt_answers submitted since the last student_ability update
 * for this (user, section). Best-effort: never throws.
 */
export async function updateAbilityAfterSession(
  env: Env,
  userId: number,
  section: string,
): Promise<void> {
  if (!userId || !section) return;
  try {
    const current = await env.DB.prepare(
      'SELECT theta, se, response_count, updated_at FROM student_ability WHERE user_id = ? AND section = ?'
    ).bind(userId, section).first<{
      theta: number; se: number; response_count: number; updated_at: string;
    }>();

    const sinceClause = current?.updated_at ? 'AND aa.submitted_at > ?' : '';
    const binds: (number | string)[] = [userId, section];
    if (current?.updated_at) binds.push(current.updated_at);

    const { results } = await env.DB.prepare(
      `SELECT aa.is_correct, ip.difficulty AS irt_b, ip.total_responses AS irt_responses,
              tc.difficulty AS difficulty
         FROM attempt_answers aa
         JOIN test_attempts ta ON ta.id = aa.attempt_id
         LEFT JOIN irt_item_params ip ON ip.content_id = aa.content_id
         LEFT JOIN test_contents tc ON tc.id = aa.content_id
        WHERE ta.user_id = ?
          AND aa.section = ?
          AND aa.is_correct IS NOT NULL
          ${sinceClause}
        ORDER BY aa.submitted_at ASC
        LIMIT 200`
    ).bind(...binds).all<any>();

    const responses = results || [];
    if (responses.length === 0) return;

    let theta = Number(current?.theta) || 0;
    let n = Number(current?.response_count) || 0;

    for (const r of responses) {
      const b = effectiveDifficulty(r);
      const p = prob2PL(theta, 1.0, b);
      const K = Math.max(0.05, 0.3 / Math.sqrt(1 + n / 20));
      theta += K * ((r.is_correct ? 1 : 0) - p);
      theta = Math.max(-4, Math.min(4, theta));
      n++;
    }

    // SE shrinks with evidence: rough 1/sqrt(n) heuristic, floored at 0.2.
    const se = Math.max(0.2, 1 / Math.sqrt(Math.max(1, n / 4)));

    await env.DB.prepare(
      `INSERT INTO student_ability (user_id, section, theta, se, response_count, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, section) DO UPDATE SET
         theta = ?, se = ?, response_count = ?, updated_at = datetime('now')`
    ).bind(
      userId, section,
      Math.round(theta * 1000) / 1000, Math.round(se * 1000) / 1000, n,
      Math.round(theta * 1000) / 1000, Math.round(se * 1000) / 1000, n,
    ).run();
  } catch (e) {
    // Covers missing table (migration 095 not applied yet) and any D1 hiccup.
    console.error('updateAbilityAfterSession failed (non-fatal):', e);
  }
}

export interface AbilityMatchedRow {
  id: number;
  question_type: string;
  title: string | null;
  content: string;
  media_url: string | null;
  difficulty: number | null;
}

/**
 * Ability-matched question selection (70% matched / 20% review / 10% stretch).
 * Returns null when preconditions fail so the caller can fall back to
 * selectUnderExposedQuestions unchanged.
 */
export async function selectAbilityMatchedQuestions(
  env: Env,
  userId: number,
  testType: string,
  section: string,
  count: number,
): Promise<AbilityMatchedRow[] | null> {
  if (!userId || count <= 0) return null;
  try {
    // 1. Student theta — no row means no signal yet; let the caller fall back.
    const ability = await env.DB.prepare(
      'SELECT theta, response_count FROM student_ability WHERE user_id = ? AND section = ?'
    ).bind(userId, section).first<{ theta: number; response_count: number }>();
    if (!ability || !Number.isFinite(Number(ability.theta))) return null;
    const theta = Number(ability.theta);

    // 2. Candidate pool with IRT params joined in. Cap for D1 friendliness.
    const { results } = await env.DB.prepare(
      `SELECT tc.id, tc.question_type, tc.title, tc.content, tc.media_url, tc.difficulty,
              ip.difficulty AS irt_b, ip.total_responses AS irt_responses
         FROM test_contents tc
         LEFT JOIN irt_item_params ip ON ip.content_id = tc.id
        WHERE tc.test_type = ? AND tc.section = ? AND tc.status = 'published'
        ORDER BY RANDOM() LIMIT 500`
    ).bind(testType, section).all<any>();

    const pool = results || [];
    // Need ≥ 2× count candidates for the blend to mean anything.
    if (pool.length < count * 2) return null;

    // 3. Bucket by distance from theta.
    const matched: any[] = []; // within ±0.5 of theta
    const stretch: any[] = []; // +0.5 .. +1.0 above theta
    const rest: any[] = [];
    for (const row of pool) {
      const b = effectiveDifficulty(row);
      const delta = b - theta;
      if (Math.abs(delta) <= 0.5) matched.push(row);
      else if (delta > 0.5 && delta <= 1.0) stretch.push(row);
      else rest.push(row);
    }

    const nMatched = Math.max(1, Math.round(count * 0.7));
    const nStretch = Math.max(0, Math.round(count * 0.1));
    const nReview = Math.max(0, count - nMatched - nStretch);

    // Prefer unseen items within each bucket (exposure-aware ordering).
    const matchedOrdered = await reorderByExposure(env, userId, matched);
    const stretchOrdered = await reorderByExposure(env, userId, stretch);

    const picked: any[] = [];
    const pickedIds = new Set<number>();
    const take = (bucket: any[], n: number) => {
      for (const row of bucket) {
        if (picked.length >= count) break;
        if (n <= 0) break;
        if (pickedIds.has(Number(row.id))) continue;
        picked.push(row);
        pickedIds.add(Number(row.id));
        n--;
      }
    };

    take(matchedOrdered, nMatched);
    take(stretchOrdered, nStretch);

    // 20% review slice: reuse the exposure-aware selector (it surfaces
    // seen-but-old items naturally when unseen are exhausted).
    if (nReview > 0) {
      const reviewRows = await selectUnderExposedQuestions<any>(env, {
        userId,
        limit: nReview + picked.length, // headroom to skip duplicates
        extraWhere: `test_type = ? AND section = ? AND status = 'published'`,
        extraParams: [testType, section],
        columns: 'id, question_type, title, content, media_url, difficulty',
        recentDays: 14,
      });
      take(reviewRows, nReview);
    }

    // Backfill any shortfall from the remaining buckets, nearest-to-theta first.
    if (picked.length < count) {
      const leftovers = [...matchedOrdered, ...stretchOrdered, ...rest]
        .filter((r) => !pickedIds.has(Number(r.id)))
        .sort((a, b) =>
          Math.abs(effectiveDifficulty(a) - theta) - Math.abs(effectiveDifficulty(b) - theta));
      take(leftovers, count - picked.length);
    }

    if (picked.length < count) return null; // pool too thin after dedupe — fall back

    return picked.map((r) => ({
      id: r.id,
      question_type: r.question_type,
      title: r.title,
      content: r.content,
      media_url: r.media_url,
      difficulty: r.difficulty,
    }));
  } catch (e) {
    // Missing table / migration not run / any query error → silent fallback.
    console.error('selectAbilityMatchedQuestions failed (non-fatal):', e);
    return null;
  }
}
