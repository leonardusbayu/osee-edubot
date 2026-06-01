// Listening Library — curated passages with TTS + comprehension questions

import type { Env } from '../types';

export interface ListeningPassage {
  id: number;
  title: string;
  passage: string;
  category: string;
  test_type: string;
  difficulty: string;
  cefr_level: string;
  duration_seconds: number;
  voice: string;
  source: string | null;
  comprehension_questions: string; // JSON string
}

export interface ComprehensionQuestion {
  q: string;
  options: string[];
  answer_idx: number;
  explanation: string;
}

export function parseQuestions(json: string): ComprehensionQuestion[] {
  try { return JSON.parse(json) as ComprehensionQuestion[]; } catch { return []; }
}

/**
 * Pick a random listening passage. Respects user's CEFR level (current ±1).
 */
export async function pickListeningPassage(
  env: Env,
  opts: { category?: string; test_type?: string; userLevel?: string } = {}
): Promise<ListeningPassage | null> {
  const conditions: string[] = [];
  const binds: any[] = [];
  if (opts.category) { conditions.push('category = ?'); binds.push(opts.category); }
  if (opts.test_type) { conditions.push('test_type IN (?, "ALL")'); binds.push(opts.test_type); }
  if (opts.userLevel) {
    const order: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
    const userIdx = order[opts.userLevel] ?? 2;
    const allowedLevels = Object.keys(order).filter(k => {
      const idx = order[k];
      return idx >= userIdx - 1 && idx <= userIdx + 1;
    });
    const placeholders = allowedLevels.map(() => '?').join(',');
    conditions.push(`cefr_level IN (${placeholders})`);
    binds.push(...allowedLevels);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = `SELECT * FROM listening_passages ${where} ORDER BY RANDOM() LIMIT 1`;
  const row = await env.DB.prepare(stmt).bind(...binds).first<ListeningPassage>();
  return row || null;
}

export async function getListeningPassage(env: Env, id: number): Promise<ListeningPassage | null> {
  const row = await env.DB.prepare('SELECT * FROM listening_passages WHERE id = ?').bind(id).first<ListeningPassage>();
  return row || null;
}

export async function listListeningCategories(env: Env): Promise<{ category: string; count: number }[]> {
  const result = await env.DB.prepare(
    `SELECT category, COUNT(*) as count FROM listening_passages GROUP BY category ORDER BY count DESC`
  ).all<{ category: string; count: number }>();
  return result.results || [];
}

export function getCategoryLabel(c: string): string {
  const labels: Record<string, string> = {
    business_meeting: '💼 Business Meeting',
    campus_conversation: '🎓 Campus Conversation',
    academic_lecture: '📚 Academic Lecture',
    travel_announcement: '✈️ Travel Announcement',
    news_report: '📰 News Report',
  };
  return labels[c] || c;
}

export function getDifficultyEmoji(d: string): string {
  const m: Record<string, string> = { beginner: '🟢', intermediate: '🟡', advanced: '🔴' };
  return m[d] || '🟡';
}

export function listeningMenuKeyboard(): { inline_keyboard: { text: string; callback_data: string }[][] } {
  return {
    inline_keyboard: [
      [
        { text: '🎲 Random', callback_data: 'listen_random' },
        { text: '🎓 Campus', callback_data: 'listen_cat_campus_conversation' },
      ],
      [
        { text: '📚 Academic Lecture', callback_data: 'listen_cat_academic_lecture' },
        { text: '💼 Business Meeting', callback_data: 'listen_cat_business_meeting' },
      ],
      [
        { text: '✈️ Travel', callback_data: 'listen_cat_travel_announcement' },
        { text: '📰 News Report', callback_data: 'listen_cat_news_report' },
      ],
    ],
  };
}

/**
 * Save a listening attempt with answers.
 */
export async function saveListeningAttempt(
  env: Env,
  userId: number,
  passageId: number,
  answers: { q_idx: number; selected: number; correct: boolean }[],
): Promise<{ correct: number; total: number; pct: number; attemptId: number }> {
  const correct = answers.filter(a => a.correct).length;
  const total = answers.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const r = await env.DB.prepare(
    `INSERT INTO listening_attempts (user_id, passage_id, answers, correct_count, total_count, score_pct)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(userId, passageId, JSON.stringify(answers), correct, total, pct).first<{ id: number }>();
  return { correct, total, pct, attemptId: r?.id ?? 0 };
}

/**
 * Get listening stats for a user.
 */
export async function getListeningStats(env: Env, userId: number): Promise<{
  total: number;
  averageScore: number;
  bestScore: number;
  attemptsToday: number;
}> {
  const row = await env.DB.prepare(
    `SELECT
       COUNT(*) as total,
       COALESCE(AVG(score_pct), 0) as averageScore,
       COALESCE(MAX(score_pct), 0) as bestScore,
       SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) as attemptsToday
     FROM listening_attempts WHERE user_id = ?`
  ).bind(userId).first<{ total: number; averageScore: number; bestScore: number; attemptsToday: number }>();
  return {
    total: row?.total ?? 0,
    averageScore: Math.round(row?.averageScore ?? 0),
    bestScore: row?.bestScore ?? 0,
    attemptsToday: row?.attemptsToday ?? 0,
  };
}
