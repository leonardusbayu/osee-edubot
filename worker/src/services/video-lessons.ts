// Video Comprehension — curated YouTube library with vocab + comprehension

import type { Env } from '../types';

export interface VideoLesson {
  id: number;
  title: string;
  youtube_id: string;
  description: string | null;
  category: string;
  topic: string | null;
  test_type: string;
  difficulty: string;
  cefr_level: string;
  duration_seconds: number;
  channel: string | null;
  key_vocabulary: string;       // JSON
  comprehension_questions: string; // JSON
}

export interface VideoQuestion {
  q: string;
  options: string[];
  answer_idx: number;
  explanation: string;
  timestamp?: string;
}

export interface VideoVocab {
  word: string;
  definition: string;
}

export function parseVideoQuestions(json: string): VideoQuestion[] {
  try { return JSON.parse(json) as VideoQuestion[]; } catch { return []; }
}

export function parseVideoVocab(json: string): VideoVocab[] {
  try { return JSON.parse(json) as VideoVocab[]; } catch { return []; }
}

export async function pickVideo(
  env: Env,
  opts: { category?: string; test_type?: string; userLevel?: string } = {}
): Promise<VideoLesson | null> {
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
  const r = await env.DB.prepare(
    `SELECT * FROM video_lessons ${where} ORDER BY RANDOM() LIMIT 1`
  ).bind(...binds).first<VideoLesson>();
  return r || null;
}

export async function getVideo(env: Env, id: number): Promise<VideoLesson | null> {
  return await env.DB.prepare('SELECT * FROM video_lessons WHERE id = ?').bind(id).first<VideoLesson>();
}

export async function listVideoCategories(env: Env): Promise<{ category: string; count: number }[]> {
  const r = await env.DB.prepare(
    `SELECT category, COUNT(*) as count FROM video_lessons GROUP BY category ORDER BY count DESC`
  ).all<{ category: string; count: number }>();
  return r.results || [];
}

export function getVideoCategoryLabel(c: string): string {
  const labels: Record<string, string> = {
    ted_talk: '🎤 TED Talk',
    interview: '🎙️ Interview',
    lecture: '📚 Lecture',
    documentary: '🎬 Documentary',
    news_clip: '📰 News Clip',
  };
  return labels[c] || c;
}

export function getDifficultyEmoji(d: string): string {
  const m: Record<string, string> = { beginner: '🟢', intermediate: '🟡', advanced: '🔴' };
  return m[d] || '🟡';
}

export function videoMenuKeyboard(): { inline_keyboard: { text: string; callback_data: string }[][] } {
  return {
    inline_keyboard: [
      [
        { text: '🎲 Random Video', callback_data: 'video_random' },
        { text: '🎤 TED Talk', callback_data: 'video_cat_ted_talk' },
      ],
      [
        { text: '🎙️ Interview', callback_data: 'video_cat_interview' },
        { text: '📚 Lecture', callback_data: 'video_cat_lecture' },
      ],
      [
        { text: '🎬 Documentary', callback_data: 'video_cat_documentary' },
        { text: '📰 News', callback_data: 'video_cat_news_clip' },
      ],
    ],
  };
}

export async function saveVideoAttempt(
  env: Env,
  userId: number,
  videoId: number,
  answers: { q_idx: number; selected: number; correct: boolean }[],
): Promise<{ correct: number; total: number; pct: number }> {
  const correct = answers.filter(a => a.correct).length;
  const total = answers.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  await env.DB.prepare(
    `INSERT INTO video_views (user_id, video_id, answers, correct_count, total_count, score_pct)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(userId, videoId, JSON.stringify(answers), correct, total, pct).run();
  return { correct, total, pct };
}

export async function getVideoStats(env: Env, userId: number): Promise<{
  total: number;
  averageScore: number;
  bestScore: number;
}> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as total, COALESCE(AVG(score_pct), 0) as averageScore, COALESCE(MAX(score_pct), 0) as bestScore
     FROM video_views WHERE user_id = ?`
  ).bind(userId).first<{ total: number; averageScore: number; bestScore: number }>();
  return {
    total: row?.total ?? 0,
    averageScore: Math.round(row?.averageScore ?? 0),
    bestScore: row?.bestScore ?? 0,
  };
}
