/**
 * IRT Engine — 2-Parameter Logistic Item Response Theory
 *
 * Implements psychometrically valid scoring for EduBot.
 * Instead of raw accuracy %, IRT estimates:
 *   - Item difficulty (b): how hard is each question
 *   - Item discrimination (a): how well does it separate strong/weak students
 *   - Student ability (θ): calibrated ability on a common scale
 *
 * The 2PL model: P(correct | θ, a, b) = 1 / (1 + e^(-a(θ - b)))
 *
 * This is the same mathematical framework behind the real TOEFL iBT.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface IRTItemParams {
  content_id: number;
  difficulty: number;    // b: logit scale, typically -3 to +3
  discrimination: number; // a: typically 0.2 to 3.0
  guessing: number;      // c: for 3PL, default 0.25
  total_responses: number;
  total_correct: number;
}

export interface IRTAbility {
  user_id: number;
  skill: string;
  theta: number;         // ability estimate
  standard_error: number;
  responses_count: number;
}

export interface IRTResponse {
  content_id: number;
  is_correct: boolean;
  section: string;
}

// ─── Core IRT Math ──────────────────────────────────────────────────

/** 2PL probability of correct response */
export function prob2PL(theta: number, a: number, b: number): number {
  const z = a * (theta - b);
  // Clamp to avoid overflow
  if (z > 30) return 1.0;
  if (z < -30) return 0.0;
  return 1.0 / (1.0 + Math.exp(-z));
}

/** 3PL probability (with guessing parameter) */
export function prob3PL(theta: number, a: number, b: number, c: number): number {
  return c + (1 - c) * prob2PL(theta, a, b);
}

/** Log-likelihood of a response pattern given theta */
export function logLikelihood(
  theta: number,
  responses: Array<{ a: number; b: number; correct: boolean }>
): number {
  let ll = 0;
  for (const r of responses) {
    const p = prob2PL(theta, r.a, r.b);
    if (r.correct) {
      ll += Math.log(Math.max(p, 1e-10));
    } else {
      ll += Math.log(Math.max(1 - p, 1e-10));
    }
  }
  return ll;
}

/** Fisher information for a single item at given theta */
export function fisherInfo(theta: number, a: number, b: number): number {
  const p = prob2PL(theta, a, b);
  return a * a * p * (1 - p);
}

// ─── Theta Estimation (MLE with Newton-Raphson) ─────────────────────

/**
 * Estimate student ability (theta) using Maximum Likelihood Estimation.
 * Uses Newton-Raphson optimization with prior regularization.
 *
 * @param responses - array of { a, b, correct } for each answered item
 * @param priorTheta - prior estimate (default 0)
 * @param maxIter - maximum iterations
 * @returns { theta, standardError }
 */
export function estimateTheta(
  responses: Array<{ a: number; b: number; correct: boolean }>,
  priorTheta: number = 0,
  maxIter: number = 30
): { theta: number; standardError: number } {
  if (responses.length === 0) {
    return { theta: priorTheta, standardError: 3.0 };
  }

  // All correct or all wrong → use Bayesian EAP instead of MLE
  const allCorrect = responses.every(r => r.correct);
  const allWrong = responses.every(r => !r.correct);
  if (allCorrect || allWrong) {
    return estimateThetaEAP(responses);
  }

  let theta = priorTheta;
  const priorVariance = 1.0; // N(0,1) prior for regularization

  for (let iter = 0; iter < maxIter; iter++) {
    let firstDerivative = 0;
    let secondDerivative = 0;

    for (const r of responses) {
      const p = prob2PL(theta, r.a, r.b);
      const residual = (r.correct ? 1 : 0) - p;
      firstDerivative += r.a * residual;
      secondDerivative -= r.a * r.a * p * (1 - p);
    }

    // Add prior regularization (MAP estimate)
    firstDerivative -= theta / priorVariance;
    secondDerivative -= 1 / priorVariance;

    if (Math.abs(secondDerivative) < 1e-10) break;

    const delta = firstDerivative / secondDerivative;
    theta -= delta;

    // Clamp theta to reasonable range
    theta = Math.max(-4, Math.min(4, theta));

    if (Math.abs(delta) < 1e-6) break;
  }

  // Standard error from Fisher information
  let totalInfo = 0;
  for (const r of responses) {
    totalInfo += fisherInfo(theta, r.a, r.b);
  }
  totalInfo += 1 / priorVariance; // Prior contribution
  const se = totalInfo > 0 ? 1 / Math.sqrt(totalInfo) : 3.0;

  return { theta: Math.round(theta * 1000) / 1000, standardError: Math.round(se * 1000) / 1000 };
}

/**
 * Expected A Posteriori (EAP) estimation.
 * Used when MLE fails (all correct / all wrong responses).
 * Integrates over a standard normal prior using quadrature.
 */
function estimateThetaEAP(
  responses: Array<{ a: number; b: number; correct: boolean }>
): { theta: number; standardError: number } {
  // 21-point Gauss-Hermite-like quadrature over [-4, 4]
  const points = 41;
  const low = -4, high = 4;
  const step = (high - low) / (points - 1);

  // Compute log-weights first to prevent overflow/underflow
  const logWeights: number[] = [];
  const thetas: number[] = [];

  for (let i = 0; i < points; i++) {
    const t = low + i * step;
    thetas.push(t);

    // Log-prior: standard normal → -0.5 * t²
    const logPrior = -0.5 * t * t;

    let logL = 0;
    for (const r of responses) {
      const p = prob2PL(t, r.a, r.b);
      logL += r.correct ? Math.log(Math.max(p, 1e-10)) : Math.log(Math.max(1 - p, 1e-10));
    }

    logWeights.push(logL + logPrior);
  }

  // Subtract max for numerical stability (log-sum-exp trick)
  const maxLogW = Math.max(...logWeights);
  let numerator = 0;
  let numerator2 = 0;
  let denominator = 0;

  for (let i = 0; i < points; i++) {
    const weight = Math.exp(logWeights[i] - maxLogW) * step;
    numerator += thetas[i] * weight;
    numerator2 += thetas[i] * thetas[i] * weight;
    denominator += weight;
  }

  if (denominator < 1e-20) {
    return { theta: 0, standardError: 3.0 };
  }

  const theta = numerator / denominator;
  const variance = numerator2 / denominator - theta * theta;
  const se = Math.sqrt(Math.max(variance, 0.01));

  return {
    theta: Math.round(theta * 1000) / 1000,
    standardError: Math.round(se * 1000) / 1000,
  };
}

// ─── Item Calibration (from response data) ──────────────────────────

/**
 * Calibrate item difficulty from response statistics.
 * Simple but effective approach:
 *   b = -logit(p_correct) where logit(p) = ln(p / (1-p))
 *   a estimated from point-biserial correlation proxy
 *
 * For production: use Joint MLE or EM algorithm. This simplified
 * approach works well for initial calibration with 20+ responses.
 */
export function calibrateItem(
  totalResponses: number,
  totalCorrect: number,
  avgThetaCorrect?: number,
  avgThetaWrong?: number
): { difficulty: number; discrimination: number } {
  if (totalResponses < 5) {
    return { difficulty: 0, discrimination: 1.0 };
  }

  const pCorrect = totalCorrect / totalResponses;
  // Clamp to avoid log(0) or log(infinity)
  const pClamped = Math.max(0.02, Math.min(0.98, pCorrect));

  // Difficulty: negative logit of proportion correct
  const difficulty = -Math.log(pClamped / (1 - pClamped));

  // Discrimination: if we have theta data, use difference
  let discrimination = 1.0;
  if (avgThetaCorrect !== undefined && avgThetaWrong !== undefined) {
    const thetaDiff = avgThetaCorrect - avgThetaWrong;
    // a ≈ 1.7 * point-biserial / sd_theta (simplified)
    discrimination = Math.max(0.3, Math.min(2.5, 1.0 + thetaDiff * 0.8));
  } else {
    // Heuristic: very easy or very hard items discriminate less
    const distFromMiddle = Math.abs(pCorrect - 0.5);
    discrimination = Math.max(0.5, 1.5 - distFromMiddle * 2);
  }

  return {
    difficulty: Math.round(difficulty * 1000) / 1000,
    discrimination: Math.round(discrimination * 1000) / 1000,
  };
}

// ─── Theta to Score Mapping ─────────────────────────────────────────

/** Map theta (-4 to +4) to TOEFL iBT section score (0-30) */
export function thetaToIBTSection(theta: number): number {
  // Linear mapping: θ=-3 → 0, θ=0 → 15, θ=+3 → 30
  const score = Math.round(15 + theta * 5);
  return Math.max(0, Math.min(30, score));
}

/** Map theta to TOEFL iBT total (0-120) from per-section thetas */
export function thetasToIBTTotal(thetas: { reading: number; listening: number; speaking: number; writing: number }): number {
  return thetaToIBTSection(thetas.reading)
    + thetaToIBTSection(thetas.listening)
    + thetaToIBTSection(thetas.speaking)
    + thetaToIBTSection(thetas.writing);
}

/** Map theta to IELTS band (0-9) */
export function thetaToIELTSBand(theta: number): number {
  // θ=-3 → 1, θ=0 → 5, θ=+3 → 9
  const band = Math.round((5 + theta * 1.33) * 2) / 2;
  return Math.max(0, Math.min(9, band));
}

/** Map theta to CEFR level */
export function thetaToCEFR(theta: number): string {
  if (theta < -2.5) return 'Pre-A1';
  if (theta < -1.5) return 'A1';
  if (theta < -0.5) return 'A2';
  if (theta < 0.5) return 'B1';
  if (theta < 1.5) return 'B2';
  if (theta < 2.5) return 'C1';
  return 'C2';
}

// ─── Database Operations ────────────────────────────────────────────

/**
 * Get or initialize IRT params for a content item.
 */
export async function getItemParams(db: D1Database, contentId: number): Promise<IRTItemParams> {
  const row = await db.prepare(
    'SELECT * FROM irt_item_params WHERE content_id = ?'
  ).bind(contentId).first();

  if (row) {
    return {
      content_id: row.content_id as number,
      difficulty: row.difficulty as number,
      discrimination: row.discrimination as number,
      guessing: row.guessing as number,
      total_responses: row.total_responses as number,
      total_correct: row.total_correct as number,
    };
  }

  // Return defaults for uncalibrated items
  return {
    content_id: contentId,
    difficulty: 0,
    discrimination: 1.0,
    guessing: 0.25,
    total_responses: 0,
    total_correct: 0,
  };
}

/**
 * Get item params for multiple content IDs (batch).
 */
export async function getItemParamsBatch(db: D1Database, contentIds: number[]): Promise<Map<number, IRTItemParams>> {
  const map = new Map<number, IRTItemParams>();
  if (contentIds.length === 0) return map;

  const placeholders = contentIds.map(() => '?').join(',');
  const rows = await db.prepare(
    `SELECT * FROM irt_item_params WHERE content_id IN (${placeholders})`
  ).bind(...contentIds).all();

  for (const row of rows.results || []) {
    map.set(row.content_id as number, {
      content_id: row.content_id as number,
      difficulty: row.difficulty as number,
      discrimination: row.discrimination as number,
      guessing: row.guessing as number,
      total_responses: row.total_responses as number,
      total_correct: row.total_correct as number,
    });
  }

  // Fill defaults for missing items
  for (const id of contentIds) {
    if (!map.has(id)) {
      map.set(id, { content_id: id, difficulty: 0, discrimination: 1.0, guessing: 0.25, total_responses: 0, total_correct: 0 });
    }
  }

  return map;
}

/**
 * Update student ability after answering questions.
 * This is the main entry point called after each answer or test completion.
 */
export async function updateStudentAbility(
  db: D1Database,
  userId: number,
  responses: IRTResponse[]
): Promise<Record<string, IRTAbility>> {
  if (responses.length === 0) return {};

  // Group responses by skill (section)
  const bySkill = new Map<string, IRTResponse[]>();
  for (const r of responses) {
    const skill = r.section;
    if (!bySkill.has(skill)) bySkill.set(skill, []);
    bySkill.get(skill)!.push(r);
  }

  // Get item params for all content IDs
  const allContentIds = responses.map(r => r.content_id).filter(id => id > 0);
  const itemParams = await getItemParamsBatch(db, allContentIds);

  const results: Record<string, IRTAbility> = {};

  for (const [skill, skillResponses] of bySkill.entries()) {
    // Get current theta for this skill
    const current = await db.prepare(
      'SELECT * FROM irt_student_ability WHERE user_id = ? AND skill = ?'
    ).bind(userId, skill).first();

    const priorTheta = current ? (current.theta as number) : 0;
    const priorCount = current ? (current.responses_count as number) : 0;

    // Build response array with item params
    const irtResponses = skillResponses
      .filter(r => r.content_id > 0)
      .map(r => {
        const params = itemParams.get(r.content_id)!;
        return { a: params.discrimination, b: params.difficulty, correct: r.is_correct };
      });

    if (irtResponses.length === 0) continue;

    // Estimate new theta
    const { theta, standardError } = estimateTheta(irtResponses, priorTheta);
    const newCount = priorCount + irtResponses.length;

    // Weighted blend: new evidence with prior (more weight to new as data grows)
    const weight = Math.min(irtResponses.length / (newCount + 5), 0.7);
    const blendedTheta = Math.round(((1 - weight) * priorTheta + weight * theta) * 1000) / 1000;

    // Upsert ability
    await db.prepare(
      `INSERT INTO irt_student_ability (user_id, skill, theta, standard_error, responses_count, last_updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, skill) DO UPDATE SET
         theta = ?, standard_error = ?, responses_count = ?, last_updated_at = datetime('now')`
    ).bind(userId, skill, blendedTheta, standardError, newCount, blendedTheta, standardError, newCount).run();

    results[skill] = {
      user_id: userId,
      skill,
      theta: blendedTheta,
      standard_error: standardError,
      responses_count: newCount,
    };

    // Update item statistics
    for (const r of skillResponses) {
      if (r.content_id > 0) {
        await db.prepare(
          `INSERT INTO irt_item_params (content_id, difficulty, discrimination, guessing, total_responses, total_correct, updated_at)
           VALUES (?, 0, 1.0, 0.25, 1, ?, datetime('now'))
           ON CONFLICT(content_id) DO UPDATE SET
             total_responses = total_responses + 1,
             total_correct = total_correct + ?,
             updated_at = datetime('now')`
        ).bind(r.content_id, r.is_correct ? 1 : 0, r.is_correct ? 1 : 0).run();
      }
    }
  }

  // Update overall ability (weighted average of skills)
  const skills = Object.values(results);
  if (skills.length > 0) {
    const totalWeight = skills.reduce((s, a) => s + a.responses_count, 0);
    const overallTheta = totalWeight > 0
      ? skills.reduce((s, a) => s + a.theta * a.responses_count, 0) / totalWeight
      : 0;
    const overallSE = Math.sqrt(skills.reduce((s, a) => s + a.standard_error ** 2, 0) / skills.length);

    await db.prepare(
      `INSERT INTO irt_student_ability (user_id, skill, theta, standard_error, responses_count, last_updated_at)
       VALUES (?, 'overall', ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, skill) DO UPDATE SET
         theta = ?, standard_error = ?, responses_count = ?, last_updated_at = datetime('now')`
    ).bind(
      userId, Math.round(overallTheta * 1000) / 1000, Math.round(overallSE * 1000) / 1000, totalWeight,
      Math.round(overallTheta * 1000) / 1000, Math.round(overallSE * 1000) / 1000, totalWeight
    ).run();
  }

  return results;
}

/**
 * Batch re-calibrate item parameters from historical data.
 * Call periodically (e.g., weekly cron) for best results.
 */
export async function recalibrateItems(db: D1Database): Promise<{ calibrated: number }> {
  // Get items with enough responses
  const items = await db.prepare(
    `SELECT content_id, total_responses, total_correct
     FROM irt_item_params WHERE total_responses >= 10`
  ).all();

  let calibrated = 0;
  for (const item of items.results || []) {
    const { difficulty, discrimination } = calibrateItem(
      item.total_responses as number,
      item.total_correct as number
    );

    await db.prepare(
      `UPDATE irt_item_params SET difficulty = ?, discrimination = ?, last_calibrated_at = datetime('now')
       WHERE content_id = ?`
    ).bind(difficulty, discrimination, item.content_id).run();
    calibrated++;
  }

  return { calibrated };
}

/**
 * Get full IRT profile for a student.
 */
export async function getStudentIRTProfile(db: D1Database, userId: number): Promise<{
  abilities: IRTAbility[];
  ibt_estimate: number | null;
  ielts_estimate: number | null;
  cefr: string;
  confidence: string;
}> {
  const rows = await db.prepare(
    'SELECT * FROM irt_student_ability WHERE user_id = ? ORDER BY skill'
  ).bind(userId).all();

  const abilities: IRTAbility[] = (rows.results || []).map((r: any) => ({
    user_id: r.user_id,
    skill: r.skill,
    theta: r.theta,
    standard_error: r.standard_error,
    responses_count: r.responses_count,
  }));

  const bySkill: Record<string, IRTAbility> = {};
  for (const a of abilities) bySkill[a.skill] = a;

  const overallTheta = bySkill['overall']?.theta ?? 0;
  const overallSE = bySkill['overall']?.standard_error ?? 3.0;
  const totalResponses = abilities.reduce((s, a) => s + (a.skill !== 'overall' ? a.responses_count : 0), 0);

  // iBT estimate (need all 4 sections)
  let ibtEstimate: number | null = null;
  if (bySkill['reading'] || bySkill['listening']) {
    ibtEstimate = thetasToIBTTotal({
      reading: bySkill['reading']?.theta ?? overallTheta,
      listening: bySkill['listening']?.theta ?? overallTheta,
      speaking: bySkill['speaking']?.theta ?? overallTheta * 0.8,
      writing: bySkill['writing']?.theta ?? overallTheta * 0.8,
    });
  }

  // Confidence level based on SE and sample size
  let confidence: string;
  if (totalResponses < 10) confidence = 'very_low';
  else if (totalResponses < 30 || overallSE > 0.8) confidence = 'low';
  else if (totalResponses < 60 || overallSE > 0.5) confidence = 'moderate';
  else if (totalResponses < 120 || overallSE > 0.3) confidence = 'high';
  else confidence = 'very_high';

  return {
    abilities,
    ibt_estimate: ibtEstimate,
    ielts_estimate: overallTheta !== 0 ? thetaToIELTSBand(overallTheta) : null,
    cefr: thetaToCEFR(overallTheta),
    confidence,
  };
}
