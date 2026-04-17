/**
 * Learning Curve & Forgetting Curve Engine
 *
 * 1. Learning Curve (Power Law of Practice):
 *    accuracy(n) = a_max - (a_max - a_init) * n^(-rate)
 *    Models how accuracy improves with practice sessions.
 *
 * 2. Forgetting Curve (Ebbinghaus):
 *    R(t) = e^(-t/S)
 *    Models memory retention decay over time.
 *    S = memory strength (increases with review count & recall success)
 *
 * 3. Psychological Profile:
 *    Computes behavioral statistics from answer patterns:
 *    - Consistency (study regularity)
 *    - Persistence (completion rate, retry behavior)
 *    - Processing speed, accuracy under pressure
 *    - Learning style indicators
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface LearningCurveModel {
  user_id: number;
  skill: string;
  a_max: number;     // asymptotic ceiling
  a_init: number;    // starting accuracy
  rate: number;      // learning rate
  r_squared: number; // fit quality
  data_points: number;
  predicted_accuracy_2w: number;
  predicted_ibt_section: number | null;
}

export interface ForgettingCurveState {
  user_id: number;
  skill: string;
  memory_strength: number; // S
  last_review_at: string;
  estimated_retention: number; // R
  review_count: number;
  avg_recall_rate: number;
}

export interface PsychProfile {
  user_id: number;
  consistency_score: number;
  persistence_score: number;
  risk_tolerance: number;
  processing_speed: number;
  accuracy_under_pressure: number;
  error_recovery_rate: number;
  reading_preference: number;
  detail_orientation: number;
  stamina_index: number;
}

// ─── Learning Curve Math ────────────────────────────────────────────

/**
 * Power Law of Practice:
 *   accuracy(n) = a_max - (a_max - a_init) * n^(-rate)
 *
 * As n → ∞, accuracy → a_max
 * At n = 1, accuracy = a_init
 */
export function powerLawAccuracy(n: number, aMax: number, aInit: number, rate: number): number {
  if (n <= 0) return aInit;
  return aMax - (aMax - aInit) * Math.pow(n, -rate);
}

/**
 * Fit a power law learning curve to data points.
 * Uses least-squares regression on log-transformed data.
 *
 * @param points - array of { n: practice_index, accuracy: 0-1 }
 * @returns fitted parameters { a_max, a_init, rate, r_squared }
 */
export function fitLearningCurve(
  points: Array<{ n: number; accuracy: number }>
): { a_max: number; a_init: number; rate: number; r_squared: number } {
  if (points.length < 3) {
    // Not enough data — return defaults based on what we have
    const avgAcc = points.length > 0
      ? points.reduce((s, p) => s + p.accuracy, 0) / points.length
      : 0.25;
    return {
      a_max: Math.min(0.9, avgAcc + 0.3),
      a_init: Math.max(0.05, avgAcc - 0.1),
      rate: 0.3,
      r_squared: 0,
    };
  }

  // Estimate a_max as slightly above the best observed accuracy
  const maxObserved = Math.max(...points.map(p => p.accuracy));
  const a_max = Math.min(0.98, maxObserved + 0.1);

  // Transform: y = a_max - accuracy, so y = (a_max - a_init) * n^(-rate)
  // log(y) = log(a_max - a_init) - rate * log(n)
  const logData: Array<{ logN: number; logY: number }> = [];
  for (const p of points) {
    const y = a_max - p.accuracy;
    if (y > 0.01 && p.n > 0) {
      logData.push({ logN: Math.log(p.n), logY: Math.log(y) });
    }
  }

  if (logData.length < 2) {
    return { a_max, a_init: points[0]?.accuracy ?? 0.25, rate: 0.3, r_squared: 0 };
  }

  // Linear regression on log-transformed data
  const n = logData.length;
  const sumX = logData.reduce((s, d) => s + d.logN, 0);
  const sumY = logData.reduce((s, d) => s + d.logY, 0);
  const sumXY = logData.reduce((s, d) => s + d.logN * d.logY, 0);
  const sumX2 = logData.reduce((s, d) => s + d.logN * d.logN, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) {
    return { a_max, a_init: points[0]?.accuracy ?? 0.25, rate: 0.3, r_squared: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // rate = -slope (should be positive for learning)
  const rate = Math.max(0.05, Math.min(2.0, -slope));
  // a_init = a_max - exp(intercept)
  const a_init = Math.max(0.01, Math.min(a_max - 0.05, a_max - Math.exp(intercept)));

  // R-squared
  const meanY = sumY / n;
  const ssRes = logData.reduce((s, d) => {
    const predicted = intercept + slope * d.logN;
    return s + (d.logY - predicted) ** 2;
  }, 0);
  const ssTot = logData.reduce((s, d) => s + (d.logY - meanY) ** 2, 0);
  const r_squared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return {
    a_max: Math.round(a_max * 1000) / 1000,
    a_init: Math.round(a_init * 1000) / 1000,
    rate: Math.round(rate * 1000) / 1000,
    r_squared: Math.round(r_squared * 1000) / 1000,
  };
}

/**
 * Project future accuracy given current model and practice rate.
 *
 * @param model - fitted curve parameters
 * @param currentN - current practice session count
 * @param daysAhead - number of days to project
 * @param sessionsPerDay - expected sessions per day
 */
export function projectAccuracy(
  model: { a_max: number; a_init: number; rate: number },
  currentN: number,
  daysAhead: number,
  sessionsPerDay: number = 1
): number {
  const futureN = currentN + daysAhead * sessionsPerDay;
  return powerLawAccuracy(futureN, model.a_max, model.a_init, model.rate);
}

// ─── Forgetting Curve Math ──────────────────────────────────────────

/**
 * Ebbinghaus forgetting curve: R(t) = e^(-t/S)
 *
 * @param hoursElapsed - time since last review in hours
 * @param memoryStrength - S parameter (higher = slower decay)
 * @returns retention probability (0-1)
 */
export function retention(hoursElapsed: number, memoryStrength: number): number {
  if (hoursElapsed <= 0) return 1.0;
  if (memoryStrength <= 0) return 0;
  return Math.exp(-hoursElapsed / memoryStrength);
}

/**
 * Update memory strength after a review.
 * If the student recalled correctly, S increases (memory strengthens).
 * If they forgot, S decreases slightly.
 *
 * Based on the SuperMemo SM-2 inspired update:
 *   S_new = S_old * (1 + recall * k)
 * where k depends on review count.
 */
export function updateMemoryStrength(
  currentS: number,
  recalled: boolean,
  reviewCount: number
): number {
  // k increases with review count (each successful review has diminishing returns)
  const k = recalled
    ? Math.max(0.5, 2.5 - reviewCount * 0.15) // Success: growth rate slows over time
    : -0.3; // Failure: slight decrease

  let newS = currentS * (1 + k);
  // Clamp to reasonable range: S in [2, 8760] hours (2 hours to 1 year)
  newS = Math.max(2, Math.min(8760, newS));
  return Math.round(newS * 100) / 100;
}

/**
 * Predict when retention drops below threshold.
 * Useful for scheduling optimal review time.
 *
 * @returns hours until retention drops below threshold
 */
export function timeToForget(memoryStrength: number, threshold: number = 0.5): number {
  // R = e^(-t/S) → t = -S * ln(R)
  return -memoryStrength * Math.log(threshold);
}

// ─── Psychological Profile Computation ──────────────────────────────

/**
 * Compute psychological/behavioral profile from answer data.
 */
export function computePsychProfile(data: {
  // Study pattern data
  activeDates: string[];      // dates when student was active
  totalDaysEnrolled: number;
  // Completion data
  attemptsStarted: number;
  attemptsCompleted: number;
  questionsAnswered: number;
  // Performance data
  answers: Array<{
    section: string;
    is_correct: boolean;
    time_spent: number;       // seconds
    question_index: number;   // position in session
    session_total: number;    // total questions in session
  }>;
}): PsychProfile {
  const { activeDates, totalDaysEnrolled, attemptsStarted, attemptsCompleted, answers } = data;

  // 1. Consistency Score (0-100)
  // How regularly does the student study?
  const daysActive = activeDates.length;
  const consistencyRaw = totalDaysEnrolled > 0 ? daysActive / totalDaysEnrolled : 0;
  // Also check for gaps — consecutive days get bonus
  let maxStreak = 0, currentStreak = 0;
  const sortedDates = [...activeDates].sort();
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) { currentStreak = 1; }
    else {
      const prev = new Date(sortedDates[i - 1]).getTime();
      const curr = new Date(sortedDates[i]).getTime();
      const diffDays = (curr - prev) / (86400 * 1000);
      currentStreak = diffDays <= 1.5 ? currentStreak + 1 : 1;
    }
    maxStreak = Math.max(maxStreak, currentStreak);
  }
  const streakBonus = Math.min(maxStreak * 5, 30);
  const consistency_score = Math.min(100, Math.round(consistencyRaw * 70 + streakBonus));

  // 2. Persistence Score (0-100)
  // Completion rate + retry behavior
  const completionRate = attemptsStarted > 0 ? attemptsCompleted / attemptsStarted : 0;
  const volumeBonus = Math.min(answers.length / 5, 30); // More answers = more persistent
  const persistence_score = Math.min(100, Math.round(completionRate * 70 + volumeBonus));

  // 3. Risk Tolerance (0-1)
  // Fast guessing vs. deliberate answering
  const answersWithTime = answers.filter(a => a.time_spent > 0);
  let risk_tolerance = 0.5;
  if (answersWithTime.length >= 5) {
    const fastAnswers = answersWithTime.filter(a => a.time_spent < 10).length;
    risk_tolerance = Math.round((fastAnswers / answersWithTime.length) * 100) / 100;
  }

  // 4. Processing Speed
  const correctWithTime = answersWithTime.filter(a => a.is_correct);
  const processing_speed = correctWithTime.length > 0
    ? Math.round(correctWithTime.reduce((s, a) => s + a.time_spent, 0) / correctWithTime.length * 10) / 10
    : 0;

  // 5. Accuracy Under Pressure (compare first half vs second half answer times)
  let accuracy_under_pressure = 0.5;
  if (answersWithTime.length >= 10) {
    const sorted = [...answersWithTime].sort((a, b) => a.time_spent - b.time_spent);
    const fastHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const slowHalf = sorted.slice(Math.floor(sorted.length / 2));
    const fastAcc = fastHalf.filter(a => a.is_correct).length / fastHalf.length;
    const slowAcc = slowHalf.filter(a => a.is_correct).length / slowHalf.length;
    accuracy_under_pressure = Math.round(fastAcc / Math.max(slowAcc, 0.01) * 100) / 100;
    accuracy_under_pressure = Math.min(2, accuracy_under_pressure); // Cap at 2x
  }

  // 6. Error Recovery Rate
  // Not directly available without per-question retry data, estimate from retake patterns
  const error_recovery_rate = completionRate > 0 ? Math.min(1, completionRate * 1.2) : 0;

  // 7. Reading vs Listening Preference
  const readingAnswers = answers.filter(a => a.section === 'reading');
  const listeningAnswers = answers.filter(a => a.section === 'listening');
  const totalRL = readingAnswers.length + listeningAnswers.length;
  const reading_preference = totalRL > 0
    ? Math.round(readingAnswers.length / totalRL * 100) / 100
    : 0.5;

  // 8. Detail Orientation (performance on earlier vs later questions in passages)
  let detail_orientation = 0.5;
  if (answers.length >= 10) {
    const earlyQ = answers.filter(a => a.question_index < a.session_total / 2);
    const lateQ = answers.filter(a => a.question_index >= a.session_total / 2);
    const earlyAcc = earlyQ.length > 0 ? earlyQ.filter(a => a.is_correct).length / earlyQ.length : 0.5;
    const lateAcc = lateQ.length > 0 ? lateQ.filter(a => a.is_correct).length / lateQ.length : 0.5;
    detail_orientation = Math.round((earlyAcc / Math.max(earlyAcc + lateAcc, 0.01)) * 100) / 100;
  }

  // 9. Stamina Index (first half vs second half of entire session)
  let stamina_index = 0.5;
  if (answers.length >= 10) {
    const half = Math.floor(answers.length / 2);
    const firstHalfCorrect = answers.slice(0, half).filter(a => a.is_correct).length / half;
    const secondHalfCorrect = answers.slice(half).filter(a => a.is_correct).length / (answers.length - half);
    stamina_index = firstHalfCorrect > 0
      ? Math.round(Math.min(2, secondHalfCorrect / firstHalfCorrect) * 100) / 100
      : 0.5;
  }

  return {
    user_id: 0, // Set by caller
    consistency_score,
    persistence_score,
    risk_tolerance,
    processing_speed,
    accuracy_under_pressure,
    error_recovery_rate,
    reading_preference,
    detail_orientation,
    stamina_index,
  };
}

// ─── Database Operations ────────────────────────────────────────────

/**
 * Record a learning curve data point after a practice session.
 */
export async function recordLearningPoint(
  db: D1Database,
  userId: number,
  skill: string,
  accuracy: number,
  sessionSize: number
): Promise<void> {
  // Get current practice index
  const last = await db.prepare(
    `SELECT MAX(practice_index) as max_idx,
            SUM(session_size * accuracy) / SUM(session_size) as cumulative_acc,
            SUM(session_size) as total_q
     FROM learning_curve_points WHERE user_id = ? AND skill = ?`
  ).bind(userId, skill).first();

  const nextIdx = ((last?.max_idx as number) || 0) + 1;
  const prevTotalQ = (last?.total_q as number) || 0;
  const prevCumAcc = (last?.cumulative_acc as number) || 0;

  // Weighted cumulative accuracy
  const cumAcc = prevTotalQ > 0
    ? (prevCumAcc * prevTotalQ + accuracy * sessionSize) / (prevTotalQ + sessionSize)
    : accuracy;

  await db.prepare(
    `INSERT INTO learning_curve_points (user_id, skill, practice_index, accuracy, cumulative_accuracy, session_size, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(userId, skill, nextIdx, Math.round(accuracy * 1000) / 1000, Math.round(cumAcc * 1000) / 1000, sessionSize).run();
}

/**
 * Fit and save learning curve model for a student's skill.
 */
export async function fitAndSaveLearningCurve(
  db: D1Database,
  userId: number,
  skill: string
): Promise<LearningCurveModel | null> {
  const points = await db.prepare(
    `SELECT practice_index, accuracy FROM learning_curve_points
     WHERE user_id = ? AND skill = ? ORDER BY practice_index`
  ).bind(userId, skill).all();

  const data = (points.results || []).map((r: any) => ({
    n: r.practice_index as number,
    accuracy: r.accuracy as number,
  }));

  if (data.length < 2) return null;

  const fit = fitLearningCurve(data);
  const currentN = data.length;

  // Predict 2 weeks ahead (assuming 1 session/day)
  const predicted2w = projectAccuracy(fit, currentN, 14, 1);

  // Map to iBT section score
  const ibtSection = Math.round(predicted2w * 30);

  await db.prepare(
    `INSERT INTO learning_curve_models (user_id, skill, a_max, a_init, rate, r_squared, data_points, predicted_accuracy_2w, predicted_ibt_section, last_fitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, skill) DO UPDATE SET
       a_max = ?, a_init = ?, rate = ?, r_squared = ?, data_points = ?,
       predicted_accuracy_2w = ?, predicted_ibt_section = ?, last_fitted_at = datetime('now')`
  ).bind(
    userId, skill, fit.a_max, fit.a_init, fit.rate, fit.r_squared, data.length, Math.round(predicted2w * 1000) / 1000, ibtSection,
    fit.a_max, fit.a_init, fit.rate, fit.r_squared, data.length, Math.round(predicted2w * 1000) / 1000, ibtSection
  ).run();

  return {
    user_id: userId,
    skill,
    ...fit,
    data_points: data.length,
    predicted_accuracy_2w: Math.round(predicted2w * 1000) / 1000,
    predicted_ibt_section: ibtSection,
  };
}

/**
 * Update forgetting curve after a review/practice session.
 */
export async function updateForgettingCurve(
  db: D1Database,
  userId: number,
  skill: string,
  recalled: boolean // did they get questions right?
): Promise<ForgettingCurveState> {
  const existing = await db.prepare(
    'SELECT * FROM forgetting_curve WHERE user_id = ? AND skill = ?'
  ).bind(userId, skill).first();

  const now = new Date().toISOString();

  if (!existing) {
    // First time — initialize
    const initialS = recalled ? 24 : 8; // 24h or 8h memory strength
    await db.prepare(
      `INSERT INTO forgetting_curve (user_id, skill, memory_strength, last_review_at, estimated_retention, review_count, avg_recall_rate, updated_at)
       VALUES (?, ?, ?, ?, 1.0, 1, ?, datetime('now'))`
    ).bind(userId, skill, initialS, now, recalled ? 1.0 : 0.0).run();

    return {
      user_id: userId, skill, memory_strength: initialS,
      last_review_at: now, estimated_retention: 1.0,
      review_count: 1, avg_recall_rate: recalled ? 1.0 : 0.0,
    };
  }

  const currentS = existing.memory_strength as number;
  const reviewCount = existing.review_count as number;
  const prevAvgRecall = existing.avg_recall_rate as number;

  // Calculate time elapsed since last review
  const lastReview = new Date(existing.last_review_at as string).getTime();
  const hoursElapsed = (Date.now() - lastReview) / (3600 * 1000);

  // Update memory strength
  const newS = updateMemoryStrength(currentS, recalled, reviewCount);
  const newReviewCount = reviewCount + 1;
  const newAvgRecall = (prevAvgRecall * reviewCount + (recalled ? 1 : 0)) / newReviewCount;

  await db.prepare(
    `UPDATE forgetting_curve SET
       memory_strength = ?, last_review_at = ?, estimated_retention = 1.0,
       review_count = ?, avg_recall_rate = ?, updated_at = datetime('now')
     WHERE user_id = ? AND skill = ?`
  ).bind(newS, now, newReviewCount, Math.round(newAvgRecall * 1000) / 1000, userId, skill).run();

  return {
    user_id: userId, skill, memory_strength: newS,
    last_review_at: now, estimated_retention: 1.0,
    review_count: newReviewCount, avg_recall_rate: Math.round(newAvgRecall * 1000) / 1000,
  };
}

/**
 * Get full learning analytics for a student.
 */
export async function getStudentLearningAnalytics(db: D1Database, userId: number): Promise<{
  learningCurves: LearningCurveModel[];
  forgettingCurves: ForgettingCurveState[];
  psychProfile: PsychProfile | null;
  retentionAlerts: Array<{ skill: string; retention: number; hoursSinceReview: number }>;
}> {
  // Learning curves
  const lcRows = await db.prepare(
    'SELECT * FROM learning_curve_models WHERE user_id = ?'
  ).bind(userId).all();

  const learningCurves = (lcRows.results || []).map((r: any) => ({
    user_id: r.user_id, skill: r.skill,
    a_max: r.a_max, a_init: r.a_init, rate: r.rate,
    r_squared: r.r_squared, data_points: r.data_points,
    predicted_accuracy_2w: r.predicted_accuracy_2w,
    predicted_ibt_section: r.predicted_ibt_section,
  }));

  // Forgetting curves with current retention calculation
  const fcRows = await db.prepare(
    'SELECT * FROM forgetting_curve WHERE user_id = ?'
  ).bind(userId).all();

  const forgettingCurves: ForgettingCurveState[] = [];
  const retentionAlerts: Array<{ skill: string; retention: number; hoursSinceReview: number }> = [];

  for (const r of fcRows.results || []) {
    const lastReview = new Date(r.last_review_at as string).getTime();
    const hoursElapsed = (Date.now() - lastReview) / (3600 * 1000);
    const currentRetention = retention(hoursElapsed, r.memory_strength as number);

    forgettingCurves.push({
      user_id: r.user_id as number, skill: r.skill as string,
      memory_strength: r.memory_strength as number,
      last_review_at: r.last_review_at as string,
      estimated_retention: Math.round(currentRetention * 1000) / 1000,
      review_count: r.review_count as number,
      avg_recall_rate: r.avg_recall_rate as number,
    });

    // Alert if retention drops below 50%
    if (currentRetention < 0.5) {
      retentionAlerts.push({
        skill: r.skill as string,
        retention: Math.round(currentRetention * 100),
        hoursSinceReview: Math.round(hoursElapsed),
      });
    }
  }

  // Psych profile
  const psychRow = await db.prepare(
    'SELECT * FROM psych_profile WHERE user_id = ?'
  ).bind(userId).first();

  const psychProfile = psychRow ? {
    user_id: psychRow.user_id as number,
    consistency_score: psychRow.consistency_score as number,
    persistence_score: psychRow.persistence_score as number,
    risk_tolerance: psychRow.risk_tolerance as number,
    processing_speed: psychRow.processing_speed as number,
    accuracy_under_pressure: psychRow.accuracy_under_pressure as number,
    error_recovery_rate: psychRow.error_recovery_rate as number,
    reading_preference: psychRow.reading_preference as number,
    detail_orientation: psychRow.detail_orientation as number,
    stamina_index: psychRow.stamina_index as number,
  } : null;

  return { learningCurves, forgettingCurves, psychProfile, retentionAlerts };
}

/**
 * Recompute and save psych profile from raw answer data.
 */
export async function recomputePsychProfile(db: D1Database, userId: number): Promise<PsychProfile | null> {
  // Get active dates
  const datesResult = await db.prepare(
    `SELECT DISTINCT date(aa.submitted_at) as d
     FROM attempt_answers aa
     JOIN test_attempts ta ON aa.attempt_id = ta.id
     WHERE ta.user_id = ? AND aa.submitted_at IS NOT NULL
     ORDER BY d`
  ).bind(userId).all();

  const activeDates = (datesResult.results || []).map((r: any) => r.d as string);
  if (activeDates.length === 0) return null;

  // Get enrollment duration
  const userRow = await db.prepare('SELECT created_at FROM users WHERE id = ?').bind(userId).first();
  const enrolledAt = userRow ? new Date(userRow.created_at as string) : new Date();
  const totalDaysEnrolled = Math.max(1, Math.ceil((Date.now() - enrolledAt.getTime()) / (86400 * 1000)));

  // Get attempt stats
  const attemptStats = await db.prepare(
    `SELECT COUNT(*) as started,
            SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed
     FROM test_attempts WHERE user_id = ?`
  ).bind(userId).first();

  // Get answer data
  const answersResult = await db.prepare(
    `SELECT aa.section, aa.is_correct, aa.time_spent_seconds, aa.question_index,
            (SELECT COUNT(*) FROM attempt_answers WHERE attempt_id = aa.attempt_id) as session_total
     FROM attempt_answers aa
     JOIN test_attempts ta ON aa.attempt_id = ta.id
     WHERE ta.user_id = ?
     ORDER BY aa.submitted_at`
  ).bind(userId).all();

  const answers = (answersResult.results || []).map((r: any) => ({
    section: r.section as string,
    is_correct: !!(r.is_correct),
    time_spent: (r.time_spent_seconds as number) || 0,
    question_index: (r.question_index as number) || 0,
    session_total: (r.session_total as number) || 1,
  }));

  if (answers.length < 5) return null;

  const profile = computePsychProfile({
    activeDates,
    totalDaysEnrolled,
    attemptsStarted: (attemptStats?.started as number) || 0,
    attemptsCompleted: (attemptStats?.completed as number) || 0,
    questionsAnswered: answers.length,
    answers,
  });

  profile.user_id = userId;

  // Save
  await db.prepare(
    `INSERT INTO psych_profile (user_id, consistency_score, persistence_score, risk_tolerance,
       processing_speed, accuracy_under_pressure, error_recovery_rate,
       reading_preference, detail_orientation, stamina_index, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       consistency_score = ?, persistence_score = ?, risk_tolerance = ?,
       processing_speed = ?, accuracy_under_pressure = ?, error_recovery_rate = ?,
       reading_preference = ?, detail_orientation = ?, stamina_index = ?, updated_at = datetime('now')`
  ).bind(
    userId, profile.consistency_score, profile.persistence_score, profile.risk_tolerance,
    profile.processing_speed, profile.accuracy_under_pressure, profile.error_recovery_rate,
    profile.reading_preference, profile.detail_orientation, profile.stamina_index,
    profile.consistency_score, profile.persistence_score, profile.risk_tolerance,
    profile.processing_speed, profile.accuracy_under_pressure, profile.error_recovery_rate,
    profile.reading_preference, profile.detail_orientation, profile.stamina_index,
  ).run();

  return profile;
}
