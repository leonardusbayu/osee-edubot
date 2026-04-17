/**
 * FSRS Engine — Adaptive Spaced Repetition powered by ts-fsrs
 *
 * Replaces hardcoded intervals (1h → 1d → 3d → 7d) with the FSRS algorithm
 * that adapts per-student based on actual recall patterns.
 *
 * FSRS (Free Spaced Repetition Scheduler) is the algorithm behind Anki v23+,
 * backed by research showing 30-50% better retention vs SM-2.
 */

import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs';
import type { Env } from '../types';

// Create FSRS instance with optimized parameters for language learning
const params = generatorParameters({
  maximum_interval: 180,       // Cap at 6 months (exam prep, not lifetime learning)
  request_retention: 0.85,     // Target 85% retention (balanced for exam prep)
  enable_fuzz: true,           // Add slight randomness to prevent clustering
});

const f = fsrs(params);

// ═══════════════════════════════════════════════════════
// CARD STATE — Stored in D1 as JSON
// ═══════════════════════════════════════════════════════
interface FSRSCardState {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number; // 0=New, 1=Learning, 2=Review, 3=Relearning
  last_review: string | null;
}

function cardToState(card: Card): FSRSCardState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? (card.last_review instanceof Date ? card.last_review.toISOString() : String(card.last_review)) : null,
  };
}

function stateToCard(state: FSRSCardState): Card {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.last_review ? new Date(state.last_review) : null,
  } as Card;
}

// ═══════════════════════════════════════════════════════
// PUBLIC API — Drop-in replacement for spaced-repetition.ts
// ═══════════════════════════════════════════════════════

/**
 * Add a new item to spaced repetition with FSRS scheduling.
 * Creates a fresh FSRS card and schedules the first review based on initial grade.
 * - wasCorrect=false → Rating.Again (relearning soon)
 * - wasCorrect=true  → Rating.Good  (longer interval; we still review so it
 *   doesn't decay into a gap, matching FSRS best practice)
 *
 * Dedups on (user_id, content_id) when contentId is provided — subsequent
 * attempts on the same question go through markReviewed() instead, so we
 * don't clone cards and lose their learning history.
 */
export async function addToReview(
  env: Env,
  userId: number,
  section: string,
  questionType: string,
  questionData: string,
  correctAnswer: string,
  studentAnswer: string,
  contentId?: number,
  wasCorrect: boolean = false,
) {
  if (contentId) {
    const existing = await env.DB.prepare(
      'SELECT id FROM spaced_repetition WHERE user_id = ? AND content_id = ? LIMIT 1'
    ).bind(userId, contentId).first();
    if (existing) return;
  }

  const card = createEmptyCard();
  const scheduling = f.repeat(card, new Date());
  const result = scheduling[wasCorrect ? Rating.Good : Rating.Again];

  const cardState = cardToState(result.card);
  const nextReview = cardState.due;

  await env.DB.prepare(
    `INSERT INTO spaced_repetition (user_id, content_id, section, question_type, question_data, correct_answer, student_answer, next_review_at, fsrs_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    userId, contentId || null, section, questionType || '',
    questionData, correctAnswer, studentAnswer,
    nextReview, JSON.stringify(cardState),
  ).run();
}

/**
 * Get items due for review, sorted by priority (overdue first).
 */
export async function getDueReviews(env: Env, userId: number, limit: number = 5) {
  const now = new Date().toISOString();
  const results = await env.DB.prepare(
    `SELECT * FROM spaced_repetition WHERE user_id = ? AND next_review_at <= ? ORDER BY next_review_at ASC LIMIT ?`
  ).bind(userId, now, limit).all();
  return results.results;
}

/**
 * Process a review using FSRS grading.
 * Maps correct/incorrect + response quality to FSRS ratings:
 *   - Wrong answer → Again (complete failure)
 *   - Correct but slow/hesitant → Hard
 *   - Correct with normal speed → Good
 *   - Correct and fast/confident → Easy
 */
export async function markReviewed(
  env: Env,
  reviewId: number,
  correct: boolean,
  quality?: 'again' | 'hard' | 'good' | 'easy',
) {
  const item = await env.DB.prepare('SELECT * FROM spaced_repetition WHERE id = ?').bind(reviewId).first() as any;
  if (!item) return;

  // Reconstruct FSRS card from stored state, or create new one for legacy items
  let card: Card;
  if (item.fsrs_state) {
    const state = typeof item.fsrs_state === 'string' ? JSON.parse(item.fsrs_state) : item.fsrs_state;
    card = stateToCard(state);
  } else {
    // Legacy item without FSRS state — create card from review_level
    card = createEmptyCard();
    // Simulate past reviews based on review_level
    const now = new Date();
    for (let i = 0; i < (item.review_level || 0); i++) {
      const scheduling = f.repeat(card, now);
      card = scheduling[Rating.Good].card;
    }
  }

  // Determine FSRS rating
  let rating: Grade;
  if (quality) {
    const ratingMap: Record<string, Grade> = {
      'again': Rating.Again,
      'hard': Rating.Hard,
      'good': Rating.Good,
      'easy': Rating.Easy,
    };
    rating = ratingMap[quality];
  } else {
    // Infer from correct/incorrect
    rating = correct ? Rating.Good : Rating.Again;
  }

  // Schedule next review
  const scheduling = f.repeat(card, new Date());
  const result = scheduling[rating];
  const newCard = result.card;
  const cardState = cardToState(newCard);

  const updateField = correct ? 'times_correct = times_correct + 1' : 'times_wrong = times_wrong + 1';
  const newLevel = correct
    ? Math.min((item.review_level || 0) + 1, 10)
    : Math.max((item.review_level || 0) - 1, 0);

  await env.DB.prepare(
    `UPDATE spaced_repetition SET
       review_level = ?,
       next_review_at = ?,
       last_reviewed_at = ?,
       fsrs_state = ?,
       ${updateField}
     WHERE id = ?`
  ).bind(
    newLevel,
    cardState.due,
    new Date().toISOString(),
    JSON.stringify(cardState),
    reviewId,
  ).run();
}

/**
 * Get review statistics with FSRS-aware metrics.
 */
export async function getReviewStats(env: Env, userId: number) {
  const total = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM spaced_repetition WHERE user_id = ?'
  ).bind(userId).first() as any;

  const due = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM spaced_repetition WHERE user_id = ? AND next_review_at <= ?'
  ).bind(userId, new Date().toISOString()).first() as any;

  const mastered = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM spaced_repetition WHERE user_id = ? AND review_level >= 4'
  ).bind(userId).first() as any;

  // FSRS-specific: items with high stability (well-memorized)
  const highStability = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM spaced_repetition
     WHERE user_id = ? AND fsrs_state IS NOT NULL
     AND json_extract(fsrs_state, '$.stability') > 30`
  ).bind(userId).first() as any;

  // Average retrievability (predicted recall probability)
  const avgRetention = await getAverageRetention(env, userId);

  return {
    total: total?.count || 0,
    due: due?.count || 0,
    mastered: mastered?.count || 0,
    highStability: highStability?.count || 0,
    avgRetention: Math.round(avgRetention * 100),
  };
}

/**
 * Get predicted review workload for the next N days.
 */
export async function getReviewForecast(env: Env, userId: number, days: number = 7) {
  const forecast: { date: string; count: number }[] = [];

  for (let d = 0; d < days; d++) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() + d);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const count = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM spaced_repetition
       WHERE user_id = ? AND next_review_at >= ? AND next_review_at < ?`
    ).bind(userId, dayStart.toISOString(), dayEnd.toISOString()).first() as any;

    forecast.push({
      date: dayStart.toISOString().split('T')[0],
      count: count?.c || 0,
    });
  }

  return forecast;
}

/**
 * Calculate average retention across all active items.
 */
async function getAverageRetention(env: Env, userId: number): Promise<number> {
  const items = await env.DB.prepare(
    `SELECT fsrs_state FROM spaced_repetition WHERE user_id = ? AND fsrs_state IS NOT NULL`
  ).bind(userId).all();

  if (!items.results || items.results.length === 0) return 0;

  const now = Date.now();
  let totalRetention = 0;
  let count = 0;

  for (const item of items.results) {
    try {
      const state = typeof (item as any).fsrs_state === 'string'
        ? JSON.parse((item as any).fsrs_state)
        : (item as any).fsrs_state;

      if (state.stability > 0 && state.last_review) {
        const elapsedDays = (now - new Date(state.last_review).getTime()) / (1000 * 60 * 60 * 24);
        // FSRS retention formula: R = (1 + elapsed_days / (9 * stability))^(-1)
        const retention = Math.pow(1 + elapsedDays / (9 * state.stability), -1);
        totalRetention += retention;
        count++;
      }
    } catch {}
  }

  return count > 0 ? totalRetention / count : 0;
}

/**
 * Migrate a legacy spaced_repetition item to FSRS.
 * Called lazily when an item without fsrs_state is reviewed.
 */
export async function migrateLegacyItem(env: Env, itemId: number): Promise<void> {
  const item = await env.DB.prepare('SELECT * FROM spaced_repetition WHERE id = ?').bind(itemId).first() as any;
  if (!item || item.fsrs_state) return;

  let card = createEmptyCard();
  const now = new Date();

  // Simulate past reviews
  for (let i = 0; i < (item.review_level || 0); i++) {
    const scheduling = f.repeat(card, now);
    card = scheduling[Rating.Good].card;
  }

  const cardState = cardToState(card);

  await env.DB.prepare(
    'UPDATE spaced_repetition SET fsrs_state = ? WHERE id = ?'
  ).bind(JSON.stringify(cardState), itemId).run();
}
