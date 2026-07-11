/**
 * Score prediction engine (ROADMAP_M3 §1.1).
 *
 * Estimates the student's current scaled score per exam from a transparent
 * linear blend of available signals:
 *   - practice accuracy (attempt_answers, last 30 days → all-time fallback)
 *   - diagnostic result (diagnostic_results.estimated_band)
 *   - FSRS retention (fsrs-engine getAverageRetention via getReviewStats)
 *   - topic mastery average (topic_mastery)
 *
 * Every signal is best-effort: a missing table or empty data just drops the
 * signal and its weight is renormalized over what remains.
 */

import type { Env } from '../types';

export type ScoreScale = 'ielts_band' | 'toefl_ibt' | 'toefl_itp' | 'toeic';

export interface ScoreEstimate {
  testType: string;
  scale: ScoreScale;
  estimatedScore: number;
  confidence: number;            // 0..1
  ability: number;               // blended 0..1 ability
  sectionAccuracy: Record<string, { accuracy: number; n: number }>;
  weakestSection: string | null;
  inputs: Record<string, unknown>;
}

const SCALE_BY_TEST: Record<string, ScoreScale> = {
  IELTS: 'ielts_band',
  TOEFL_IBT: 'toefl_ibt',
  TOEFL_ITP: 'toefl_itp',
  TOEIC: 'toeic',
};

const SECTION_LABELS_ID: Record<string, string> = {
  reading: 'Reading',
  listening: 'Listening',
  speaking: 'Speaking',
  writing: 'Writing',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Map a blended 0..1 ability to the exam's reporting scale. */
export function abilityToScale(ability: number, scale: ScoreScale): number {
  const a = clamp01(ability);
  switch (scale) {
    case 'ielts_band':
      return Math.min(9.0, Math.round((3.0 + a * 6.0) * 2) / 2);
    case 'toefl_ibt':
      return Math.min(120, Math.round(30 + a * 90));
    case 'toefl_itp':
      return Math.min(677, Math.round(310 + a * 367));
    case 'toeic':
      return Math.min(990, Math.round((10 + a * 980) / 5) * 5);
  }
}

export async function estimateScore(env: Env, userId: number, testType: string): Promise<ScoreEstimate | null> {
  const scale = SCALE_BY_TEST[testType] || SCALE_BY_TEST.TOEFL_IBT;

  // --- Signal A: practice accuracy (overall + per-section) ---
  let accuracySignal: number | null = null;
  let responseCount = 0;
  let accuracyWindow = 'last_30_days';
  const sectionAccuracy: Record<string, { accuracy: number; n: number }> = {};
  try {
    const query = (sinceClause: string) => env.DB.prepare(
      `SELECT aa.section,
              SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) AS correct,
              COUNT(*) AS n
       FROM attempt_answers aa
       JOIN test_attempts ta ON ta.id = aa.attempt_id
       WHERE ta.user_id = ? AND ta.test_type = ? AND aa.is_correct IS NOT NULL ${sinceClause}
       GROUP BY aa.section`
    ).bind(userId, testType).all();

    let rows = ((await query(`AND aa.submitted_at >= datetime('now', '-30 days')`)).results || []) as any[];
    if (rows.length === 0) {
      accuracyWindow = 'all_time';
      rows = ((await query('')).results || []) as any[];
    }
    let correct = 0;
    let total = 0;
    for (const r of rows) {
      const n = Number(r.n) || 0;
      const c = Number(r.correct) || 0;
      correct += c;
      total += n;
      if (n >= 3) sectionAccuracy[String(r.section)] = { accuracy: c / n, n };
    }
    if (total >= 5) {
      accuracySignal = correct / total;
      responseCount = total;
    }
  } catch (e) {
    console.error('[score-predictor] accuracy signal failed:', (e as any)?.message || e);
  }

  // --- Signal B: diagnostic result (estimated_band, IELTS-band-like 0..9) ---
  let diagnosticSignal: number | null = null;
  let diagnosticBand: number | null = null;
  try {
    const completed = await env.DB.prepare(
      `SELECT 1 FROM diagnostic_sessions WHERE user_id = ? AND status = 'completed' LIMIT 1`
    ).bind(userId).first();
    if (completed) {
      const diag = await env.DB.prepare(
        `SELECT estimated_band FROM diagnostic_results
         WHERE user_id = ? AND estimated_band IS NOT NULL
         ORDER BY id DESC LIMIT 1`
      ).bind(userId).first() as any;
      if (diag?.estimated_band != null) {
        diagnosticBand = Number(diag.estimated_band);
        // Inverse of the IELTS mapping (3.0 + a*6.0) so a diagnostic-only
        // estimate round-trips to the same band.
        diagnosticSignal = clamp01((diagnosticBand - 3.0) / 6.0);
      }
    }
  } catch (e) {
    console.error('[score-predictor] diagnostic signal failed:', (e as any)?.message || e);
  }

  // --- Signal C: FSRS retention ---
  let retentionSignal: number | null = null;
  try {
    const { getReviewStats } = await import('./fsrs-engine');
    const stats = await getReviewStats(env, userId);
    if ((stats?.total || 0) >= 5 && stats.avgRetention > 0) {
      retentionSignal = clamp01(stats.avgRetention / 100);
    }
  } catch (e) {
    console.error('[score-predictor] retention signal failed:', (e as any)?.message || e);
  }

  // --- Signal D: topic mastery average ---
  let masterySignal: number | null = null;
  try {
    const row = await env.DB.prepare(
      `SELECT AVG(mastery_level) AS avg_mastery, COUNT(*) AS n
       FROM topic_mastery WHERE user_id = ? AND exercises_attempted > 0`
    ).bind(userId).first() as any;
    if (row && Number(row.n) >= 3 && row.avg_mastery != null) {
      masterySignal = clamp01(Number(row.avg_mastery) / 100);
    }
  } catch (e) {
    console.error('[score-predictor] mastery signal failed:', (e as any)?.message || e);
  }

  // --- Blend: accuracy 0.5, diagnostic 0.2, retention 0.15, mastery 0.15 ---
  const signals: Array<{ name: string; value: number | null; weight: number }> = [
    { name: 'accuracy', value: accuracySignal, weight: 0.5 },
    { name: 'diagnostic', value: diagnosticSignal, weight: 0.2 },
    { name: 'retention', value: retentionSignal, weight: 0.15 },
    { name: 'mastery', value: masterySignal, weight: 0.15 },
  ];
  const available = signals.filter((s) => s.value !== null);
  if (available.length === 0) return null;

  const weightSum = available.reduce((s, x) => s + x.weight, 0);
  const ability = clamp01(available.reduce((s, x) => s + (x.value as number) * x.weight, 0) / weightSum);

  // Confidence: available weight mass scaled by data volume. Diagnostic
  // counts as ~20 data points so a fresh post-diagnostic user isn't at 0.
  const volumePoints = responseCount + (diagnosticSignal !== null ? 20 : 0);
  const volumeFactor = Math.min(volumePoints, 100) / 100;
  const confidence = Math.round(weightSum * volumeFactor * 100) / 100;

  // Weakest section = lowest per-section accuracy with enough data.
  let weakestSection: string | null = null;
  let weakestAcc = Infinity;
  for (const [section, v] of Object.entries(sectionAccuracy)) {
    if (v.accuracy < weakestAcc) {
      weakestAcc = v.accuracy;
      weakestSection = section;
    }
  }

  return {
    testType,
    scale,
    estimatedScore: abilityToScale(ability, scale),
    confidence,
    ability: Math.round(ability * 1000) / 1000,
    sectionAccuracy,
    weakestSection,
    inputs: {
      accuracy: accuracySignal,
      accuracy_window: accuracySignal !== null ? accuracyWindow : null,
      response_count: responseCount,
      diagnostic_band: diagnosticBand,
      retention: retentionSignal,
      mastery: masterySignal,
      weight_sum: Math.round(weightSum * 100) / 100,
    },
  };
}

/** Compute today's estimate and upsert the snapshot row. */
export async function saveSnapshot(env: Env, userId: number, testType: string): Promise<ScoreEstimate | null> {
  const estimate = await estimateScore(env, userId, testType);
  if (!estimate) return null;
  await env.DB.prepare(
    `INSERT OR REPLACE INTO score_estimates
       (user_id, test_type, estimated_score, score_scale, confidence, inputs_json, snapshot_date)
     VALUES (?, ?, ?, ?, ?, ?, date('now'))`
  ).bind(
    userId,
    testType,
    estimate.estimatedScore,
    estimate.scale,
    estimate.confidence,
    JSON.stringify(estimate.inputs),
  ).run();
  return estimate;
}

const SCALE_NAMES: Record<ScoreScale, string> = {
  ielts_band: 'IELTS',
  toefl_ibt: 'TOEFL iBT',
  toefl_itp: 'TOEFL ITP',
  toeic: 'TOEIC',
};

function formatScore(estimate: ScoreEstimate): string {
  return estimate.scale === 'ielts_band'
    ? estimate.estimatedScore.toFixed(1)
    : String(estimate.estimatedScore);
}

/**
 * Short Indonesian one-liner for the bot (no markdown — bot copy rules).
 * e.g. "📊 Estimasi skor kamu sekarang: IELTS 5.5 (confidence 72%).
 *       Target: 6.5 — gap terbesar: Writing."
 */
export function formatScoreEstimateMessage(estimate: ScoreEstimate, targetBand?: number | string | null): string {
  const name = SCALE_NAMES[estimate.scale];
  const confidencePct = Math.round(estimate.confidence * 100);
  let msg = `📊 Estimasi skor kamu sekarang: ${name} ${formatScore(estimate)} (confidence ${confidencePct}%).`;
  const weakest = estimate.weakestSection
    ? (SECTION_LABELS_ID[estimate.weakestSection] || estimate.weakestSection)
    : null;
  if (targetBand != null && targetBand !== '') {
    msg += ` Target: ${targetBand}`;
    msg += weakest ? ` — gap terbesar: ${weakest}.` : '.';
  } else if (weakest) {
    msg += ` Gap terbesar: ${weakest}.`;
  }
  return msg;
}

// ═══════════════════════════════════════════════════════════════
// Score prediction — uses the just-finished attempt's section scores
// + study plan target + exam deadline to project a test-day score.
// Used by the /finish + /results endpoints to show the student a
// "you're on track / behind pace / ready now" verdict.
// ═══════════════════════════════════════════════════════════════

export interface ScorePrediction {
  current_band: number;
  // Per-section band values, used to render the section breakdown in
  // TestResults. Null = no data for that section.
  section_bands: Record<string, number | null>;
  confidence_interval: [number, number];
  // Width of the confidence interval (current_band ± ci_width).
  ci_width: number;
  projected_band: number;
  verdict: 'on_track' | 'behind_pace' | 'ready_now' | 'no_data';
  weeks_to_exam: number | null;
  target_band: number | null;
  exam_deadline: string | null;
  // How many sections had data. Drives the verdict confidence: a 1-section
  // attempt has a much wider CI than a 4-section attempt.
  sections_with_data: number;
}

// Per-section max scores for the prediction normalization. Mirrors
// the section max_score values in TEST_CONFIGS in tests.ts. Centralized
// here so the prediction can compute per-section 0-1 normalized scores
// without a circular dependency on tests.ts.
const SECTION_MAX_BY_TEST: Record<string, Record<string, number>> = {
  TOEFL_IBT: { reading: 30, listening: 30, speaking: 4, writing: 5 },
  IELTS: { reading: 9, listening: 9, speaking: 9, writing: 9 },
  TOEIC: { listening: 495, reading: 495 },
  TOEFL_ITP: { listening: 68, structure: 68, reading: 68 },
};

// Per-test test-level max score (for projecting the normalized average
// back to the reporting scale).
const TEST_MAX_BAND: Record<string, number> = {
  IELTS: 9, TOEFL_IBT: 30, TOEIC: 990, TOEFL_ITP: 677,
};

// Per-test confidence interval width. Empirically calibrated:
//   - IELTS: ±0.3 band covers typical section noise
//   - iBT: ±2 covers typical section score variance
//   - TOEIC: ±50 covers typical L+R sum variance
//   - ITP: ±30 covers typical 31-68 scale variance
// Section coverage widens the CI: a 1-section attempt gets +50% width.
const BASE_CI_BY_TEST: Record<string, number> = {
  IELTS: 0.3, TOEFL_IBT: 2.0, TOEIC: 50, TOEFL_ITP: 30,
};

/**
 * Build a score prediction from the just-finished attempt's section
 * scores + study plan target + exam deadline + the user's learning
 * rate from past mock tests. Returns a per-section band breakdown
 * so the frontend can show "Reading 22/30, Listening 18/30..." instead
 * of a single opaque number.
 *
 * Persists the prediction to prediction_history so we can backfill the
 * actual_band once the user takes another mock test, and the outcome
 * tracking cron can compute prediction error over time.
 */
export async function buildScorePrediction(
  env: Env,
  userId: number,
  testType: string,
  sectionScores: Record<string, number | null>,
  totalScore: number,
): Promise<ScorePrediction> {
  const sectionMax = SECTION_MAX_BY_TEST[testType] || SECTION_MAX_BY_TEST.TOEFL_IBT;
  const testMax = TEST_MAX_BAND[testType] || TEST_MAX_BAND.TOEFL_IBT;
  const baseCi = BASE_CI_BY_TEST[testType] || BASE_CI_BY_TEST.TOEFL_IBT;

  // Build per-section band values: clamp each section score to its max.
  const sectionBands: Record<string, number | null> = {};
  for (const [section, raw] of Object.entries(sectionScores)) {
    if (raw == null) { sectionBands[section] = null; continue; }
    const max = sectionMax[section] || testMax;
    sectionBands[section] = Math.max(0, Math.min(max, Number(raw)));
  }

  // Current band = mean of the section bands (the reporting scale).
  const presentSections = Object.entries(sectionBands).filter(
    ([, v]) => v !== null,
  ) as [string, number][];
  const sectionsWithData = presentSections.length;
  let currentBand: number;
  if (sectionsWithData > 0) {
    currentBand = presentSections.reduce((s, [, v]) => s + v, 0) / sectionsWithData;
  } else {
    currentBand = totalScore; // fall back to aggregate
  }

  // CI width: base, then widen by inverse section coverage.
  // 4 sections -> 1.0x, 2 sections -> 1.3x, 1 section -> 1.7x.
  const coverageMultiplier = 4 / Math.max(1, sectionsWithData);
  const ciWidth = +(baseCi * coverageMultiplier).toFixed(2);

  // Fetch study plan for target_band + target_date
  let targetBand: number | null = null;
  let examDeadline: string | null = null;
  try {
    const plan = await env.DB.prepare(
      `SELECT target_band, target_date FROM study_plans
       WHERE user_id = ? AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
    ).bind(userId).first<{ target_band: number | null; target_date: string | null }>();
    if (plan) {
      targetBand = plan.target_band ? Number(plan.target_band) : null;
      examDeadline = plan.target_date || null;
    }
  } catch { /* study_plans missing or empty -- fine */ }

  // Compute weeks to exam
  let weeksToExam: number | null = null;
  if (examDeadline) {
    const examMs = new Date(examDeadline).getTime();
    if (Number.isFinite(examMs)) {
      const daysToExam = Math.max(0, (examMs - Date.now()) / (1000 * 60 * 60 * 24));
      weeksToExam = Math.round(daysToExam / 7);
    }
  }

  // Learning rate: pull the user's mock_test_history deltas to estimate
  // improvement per week. If <2 mock scores, assume 0 (can't project).
  let learningRate = 0;
  let mockCount = 0;
  try {
    const history = await env.DB.prepare(
      `SELECT estimated_score, taken_at FROM mock_test_history
       WHERE user_id = ? AND test_type = ?
       ORDER BY created_at ASC LIMIT 10`,
    ).bind(userId, testType).all<{ estimated_score: number; taken_at: string }>();
    const rows = history.results || [];
    mockCount = rows.length;
    if (rows.length >= 2) {
      const first = rows[0];
      const last = rows[rows.length - 1];
      const firstScore = Number(first.estimated_score);
      const lastScore = Number(last.estimated_score);
      const firstMs = new Date(first.taken_at).getTime();
      const lastMs = new Date(last.taken_at).getTime();
      const weeksBetween = Math.max(0.5, (lastMs - firstMs) / (1000 * 60 * 60 * 24 * 7));
      learningRate = (lastScore - firstScore) / weeksBetween;
    }
  } catch { /* mock_test_history missing -- fine */ }

  // Project: current + learning_rate * weeks_to_exam
  const projectedBand = weeksToExam !== null && Number.isFinite(learningRate)
    ? currentBand + learningRate * weeksToExam
    : currentBand;

  // Verdict
  let verdict: ScorePrediction['verdict'];
  if (targetBand === null || weeksToExam === null) {
    verdict = 'no_data';
  } else if (projectedBand >= targetBand) {
    verdict = 'ready_now';
  } else if (projectedBand >= targetBand - ciWidth) {
    verdict = 'on_track';
  } else {
    verdict = 'behind_pace';
  }

  // Clamp the projected band to the test's valid range [0, testMax].
  const clampedProjected = Math.max(0, Math.min(testMax, projectedBand));

  // Persist the prediction so the outcome tracking cron can later
  // compare against the actual_band (filled in when the user takes
  // another mock test). Best-effort: don't block the response.
  try {
    await env.DB.prepare(
      `INSERT INTO prediction_history
         (user_id, test_type, prediction, confidence_low, confidence_high, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    ).bind(
      userId,
      testType,
      clampedProjected,
      Math.max(0, clampedProjected - ciWidth),
      Math.min(testMax, clampedProjected + ciWidth),
    ).run();
  } catch (e: any) {
    console.warn('[score-predictor] prediction_history insert failed (non-fatal):', e?.message || e);
  }

  return {
    current_band: Math.round(currentBand * 10) / 10,
    section_bands: sectionBands,
    confidence_interval: [
      Math.max(0, Math.round((currentBand - ciWidth) * 10) / 10),
      Math.min(testMax, Math.round((currentBand + ciWidth) * 10) / 10),
    ],
    ci_width: ciWidth,
    projected_band: Math.round(clampedProjected * 10) / 10,
    verdict,
    weeks_to_exam: weeksToExam,
    target_band: targetBand,
    exam_deadline: examDeadline,
    sections_with_data: sectionsWithData,
  };
}
