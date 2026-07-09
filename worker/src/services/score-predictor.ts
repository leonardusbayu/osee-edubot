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
  confidence_interval: [number, number];
  projected_band: number;
  verdict: 'on_track' | 'behind_pace' | 'ready_now' | 'no_data';
  weeks_to_exam: number | null;
  target_score: number | null;
  exam_deadline: string | null;
}

// Per-test confidence intervals (± around current_band). These are
// empirical — IELTS band descriptors are 0.5 wide so ±0.3 captures
// the uncertainty; iBT is 0-30 per section so ±2 captures section
// noise; ITP 310-677 so ±30; TOEIC 10-990 so ±50.
const CONFIDENCE_BY_TEST: Record<string, number> = {
  IELTS: 0.3,
  TOEFL_IBT: 2.0,
  TOEFL_ITP: 30,
  TOEIC: 50,
};

/**
 * Build a score prediction from a just-finished attempt's section
 * scores + the student's study plan. Best-effort: if there's no
 * study plan or exam date, still return current_band + confidence
 * interval but with verdict='no_data'.
 */
export async function buildScorePrediction(
  env: Env,
  userId: number,
  testType: string,
  sectionScores: Record<string, number | null>,
  totalScore: number,
): Promise<ScorePrediction> {
  const scale = SCALE_BY_TEST[testType] || SCALE_BY_TEST.TOEFL_IBT;
  const currentBand = totalScore;
  const ci = CONFIDENCE_BY_TEST[testType] ?? 2.0;

  // Fetch study plan for target_score + target_date
  let targetScore: number | null = null;
  let examDeadline: string | null = null;
  try {
    const plan = await env.DB.prepare(
      `SELECT target_score, target_date FROM study_plans
       WHERE user_id = ? AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`
    ).bind(userId).first<{ target_score: number | null; target_date: string | null }>();
    if (plan) {
      targetScore = plan.target_score ? Number(plan.target_score) : null;
      examDeadline = plan.target_date || null;
    }
  } catch { /* study_plans missing or empty — fine */ }

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
  try {
    const history = await env.DB.prepare(
      `SELECT estimated_score, created_at FROM mock_test_history
       WHERE user_id = ? AND test_type = ?
       ORDER BY created_at ASC LIMIT 10`
    ).bind(userId, testType).all<{ estimated_score: number; created_at: string }>();
    const rows = history.results || [];
    if (rows.length >= 2) {
      const first = rows[0];
      const last = rows[rows.length - 1];
      const firstScore = Number(first.estimated_score);
      const lastScore = Number(last.estimated_score);
      const firstMs = new Date(first.created_at).getTime();
      const lastMs = new Date(last.created_at).getTime();
      const weeksBetween = Math.max(0.5, (lastMs - firstMs) / (1000 * 60 * 60 * 24 * 7));
      learningRate = (lastScore - firstScore) / weeksBetween;
    }
  } catch { /* mock_test_history missing — fine */ }

  // Project: current + learning_rate × weeks_to_exam
  const projectedBand = weeksToExam !== null && Number.isFinite(learningRate)
    ? currentBand + learningRate * weeksToExam
    : currentBand;

  // Verdict
  let verdict: ScorePrediction['verdict'];
  if (targetScore === null || weeksToExam === null) {
    verdict = 'no_data';
  } else if (projectedBand >= targetScore) {
    verdict = 'ready_now';
  } else if (projectedBand >= targetScore - ci) {
    verdict = 'on_track';
  } else {
    verdict = 'behind_pace';
  }

  return {
    current_band: currentBand,
    confidence_interval: [currentBand - ci, currentBand + ci],
    projected_band: Math.round(projectedBand * 10) / 10,
    verdict,
    weeks_to_exam: weeksToExam,
    target_score: targetScore,
    exam_deadline: examDeadline,
  };
}
