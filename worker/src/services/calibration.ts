// Band-score calibration against real test outcomes.
//
// After students take the real IELTS/TOEFL, they can self-report the score.
// We snapshot the bot's last predicted band at submission time and use the
// pair to answer: "does a 6.5 from the bot actually mean 6.5 on the real
// test?" Weekly job computes MAE/RMSE/correlation per test_type.
//
// Three moving parts:
//   1. submitRealScore()   — called by bot /realscore + API endpoint
//   2. getLatestPrediction() — pulls the most recent bot-predicted band
//   3. computeCalibration()  — runs weekly, writes calibration_snapshots

import type { Env } from '../types';

export interface CalibrationSnapshot {
  test_type: string;
  sample_size: number;
  mean_bot_score: number;
  mean_real_score: number;
  mean_delta: number;
  mae: number;
  rmse: number;
  within_half_band_pct: number;
  within_one_band_pct: number;
  pearson_r: number;
}

/**
 * Pull the bot's most recent predicted band for this user + test_type.
 * Looks at test_attempts.band_score for finished attempts.
 */
export async function getLatestPrediction(env: Env, userId: number, testType: string): Promise<{
  overall: number | null;
  reading: number | null;
  listening: number | null;
  speaking: number | null;
  writing: number | null;
}> {
  const row = await env.DB.prepare(
    `SELECT band_score, section_scores, total_score, test_type, finished_at
       FROM test_attempts
      WHERE user_id = ? AND UPPER(test_type) = UPPER(?)
        AND finished_at IS NOT NULL
      ORDER BY finished_at DESC LIMIT 1`,
  ).bind(userId, testType).first<any>();

  if (!row) return { overall: null, reading: null, listening: null, speaking: null, writing: null };

  let sections: any = {};
  try { sections = JSON.parse(row.section_scores || '{}'); } catch {}

  return {
    overall: row.band_score !== null ? Number(row.band_score) : (row.total_score !== null ? Number(row.total_score) : null),
    reading: sections.reading !== undefined ? Number(sections.reading) : null,
    listening: sections.listening !== undefined ? Number(sections.listening) : null,
    speaking: sections.speaking !== undefined ? Number(sections.speaking) : null,
    writing: sections.writing !== undefined ? Number(sections.writing) : null,
  };
}

export async function submitRealScore(env: Env, params: {
  userId: number;
  testType: string;
  realOverall: number;
  realReading?: number;
  realListening?: number;
  realSpeaking?: number;
  realWriting?: number;
  testTakenAt?: string;
}): Promise<{ id: number; predicted: any }> {
  const predicted = await getLatestPrediction(env, params.userId, params.testType);

  const r = await env.DB.prepare(
    `INSERT INTO real_test_scores
       (user_id, test_type, real_overall_score, real_reading, real_listening,
        real_speaking, real_writing,
        bot_predicted_overall, bot_predicted_reading, bot_predicted_listening,
        bot_predicted_speaking, bot_predicted_writing,
        test_taken_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    params.userId, params.testType, params.realOverall,
    params.realReading ?? null, params.realListening ?? null,
    params.realSpeaking ?? null, params.realWriting ?? null,
    predicted.overall, predicted.reading, predicted.listening,
    predicted.speaking, predicted.writing,
    params.testTakenAt ?? null,
  ).run();

  return { id: Number(r.meta?.last_row_id || 0), predicted };
}

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

export async function computeCalibration(env: Env, testType?: string): Promise<CalibrationSnapshot[]> {
  const types: string[] = testType
    ? [testType]
    : (await env.DB.prepare(`SELECT DISTINCT test_type FROM real_test_scores`).all<any>())
        .results?.map((r: any) => r.test_type) || [];

  const snapshots: CalibrationSnapshot[] = [];

  for (const t of types) {
    const { results } = await env.DB.prepare(
      `SELECT real_overall_score, bot_predicted_overall
         FROM real_test_scores
        WHERE test_type = ?
          AND bot_predicted_overall IS NOT NULL
          AND real_overall_score IS NOT NULL
          AND verification_status != 'flagged'`,
    ).bind(t).all<any>();

    const xs: number[] = [];
    const ys: number[] = [];
    for (const r of results || []) {
      xs.push(Number(r.bot_predicted_overall));
      ys.push(Number(r.real_overall_score));
    }
    if (xs.length === 0) continue;

    const n = xs.length;
    const mBot = xs.reduce((a, b) => a + b, 0) / n;
    const mReal = ys.reduce((a, b) => a + b, 0) / n;
    const deltas = xs.map((x, i) => ys[i] - x);
    const mDelta = deltas.reduce((a, b) => a + b, 0) / n;
    const absErr = deltas.map(Math.abs);
    const mae = absErr.reduce((a, b) => a + b, 0) / n;
    const sqErr = deltas.map((d) => d * d);
    const rmse = Math.sqrt(sqErr.reduce((a, b) => a + b, 0) / n);
    const withinHalf = absErr.filter((e) => e <= 0.5).length / n;
    const withinOne = absErr.filter((e) => e <= 1.0).length / n;
    const r = pearsonR(xs, ys);

    const snap: CalibrationSnapshot = {
      test_type: t,
      sample_size: n,
      mean_bot_score: mBot,
      mean_real_score: mReal,
      mean_delta: mDelta,
      mae, rmse,
      within_half_band_pct: withinHalf,
      within_one_band_pct: withinOne,
      pearson_r: r,
    };
    snapshots.push(snap);

    await env.DB.prepare(
      `INSERT INTO calibration_snapshots
         (test_type, sample_size, mean_bot_score, mean_real_score, mean_delta,
          mae, rmse, within_half_band_pct, within_one_band_pct, pearson_r)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(t, n, mBot, mReal, mDelta, mae, rmse, withinHalf, withinOne, r).run();
  }

  return snapshots;
}
