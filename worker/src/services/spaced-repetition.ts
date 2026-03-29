import type { Env } from '../types';

// Review intervals in hours: 1h → 1d → 3d → 7d → 14d → 30d
const INTERVALS = [1, 24, 72, 168, 336, 720];

export async function addToReview(
  env: Env, userId: number, section: string, questionType: string,
  questionData: string, correctAnswer: string, studentAnswer: string,
  contentId?: number,
) {
  const nextReview = new Date(Date.now() + INTERVALS[0] * 3600000).toISOString();

  await env.DB.prepare(
    `INSERT INTO spaced_repetition (user_id, content_id, section, question_type, question_data, correct_answer, student_answer, next_review_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(userId, contentId || null, section, questionType || '', questionData, correctAnswer, studentAnswer, nextReview).run();
}

export async function getDueReviews(env: Env, userId: number, limit: number = 5) {
  const now = new Date().toISOString();
  const results = await env.DB.prepare(
    `SELECT * FROM spaced_repetition WHERE user_id = ? AND next_review_at <= ? ORDER BY next_review_at ASC LIMIT ?`
  ).bind(userId, now, limit).all();
  return results.results;
}

export async function markReviewed(env: Env, reviewId: number, correct: boolean) {
  const item = await env.DB.prepare('SELECT * FROM spaced_repetition WHERE id = ?').bind(reviewId).first() as any;
  if (!item) return;

  if (correct) {
    const newLevel = Math.min(item.review_level + 1, INTERVALS.length - 1);
    const nextReview = new Date(Date.now() + INTERVALS[newLevel] * 3600000).toISOString();
    await env.DB.prepare(
      `UPDATE spaced_repetition SET review_level = ?, next_review_at = ?, last_reviewed_at = ?, times_correct = times_correct + 1 WHERE id = ?`
    ).bind(newLevel, nextReview, new Date().toISOString(), reviewId).run();
  } else {
    // Reset to level 0
    const nextReview = new Date(Date.now() + INTERVALS[0] * 3600000).toISOString();
    await env.DB.prepare(
      `UPDATE spaced_repetition SET review_level = 0, next_review_at = ?, last_reviewed_at = ?, times_wrong = times_wrong + 1 WHERE id = ?`
    ).bind(nextReview, new Date().toISOString(), reviewId).run();
  }
}

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

  return {
    total: total?.count || 0,
    due: due?.count || 0,
    mastered: mastered?.count || 0,
  };
}
