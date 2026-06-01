// Writing Templates — high-band essay/email templates for IELTS, TOEFL, TOEIC

import type { Env } from '../types';

export interface WritingTemplate {
  id: number;
  test_type: string;
  task_type: string;
  title: string;
  description: string | null;
  cefr_level: string;
  structure: string;
  example: string | null;
  key_phrases: string;     // JSON array
  common_mistakes: string | null;
  estimated_words: number;
}

export function parsePhrases(json: string): string[] {
  try { return JSON.parse(json) as string[]; } catch { return []; }
}

export async function listTemplates(
  env: Env,
  opts: { test_type?: string; task_type?: string; userLevel?: string } = {},
): Promise<WritingTemplate[]> {
  const conditions: string[] = [];
  const binds: any[] = [];
  if (opts.test_type) { conditions.push('test_type = ?'); binds.push(opts.test_type); }
  if (opts.task_type) { conditions.push('task_type = ?'); binds.push(opts.task_type); }
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
    `SELECT * FROM writing_templates ${where} ORDER BY test_type, task_type, id`
  ).bind(...binds).all<WritingTemplate>();
  return r.results || [];
}

export async function getTemplate(env: Env, id: number): Promise<WritingTemplate | null> {
  return await env.DB.prepare('SELECT * FROM writing_templates WHERE id = ?').bind(id).first<WritingTemplate>();
}

export async function recordTemplateUse(env: Env, userId: number, templateId: number): Promise<void> {
  await env.DB.prepare(
    'INSERT INTO writing_template_uses (user_id, template_id) VALUES (?, ?)'
  ).bind(userId, templateId).run();
}

export function formatTemplate(t: WritingTemplate, fullExample: boolean = false): string {
  const lines: string[] = [];
  lines.push(`📝 *${t.title}*\n`);
  if (t.description) lines.push(`_${t.description}_\n`);
  lines.push(`🎯 ${t.test_type} • ${t.task_type} • ${t.cefr_level}`);
  lines.push(`📊 Target: ~${t.estimated_words} kata\n`);

  if (fullExample && t.example) {
    lines.push(`📖 *Example Essay:*\n${t.example}\n`);
  } else {
    lines.push(`🏗️ *Structure:*\n${t.structure}\n`);
  }

  const phrases = parsePhrases(t.key_phrases);
  if (phrases.length > 0) {
    lines.push(`\n🔑 *Key Phrases:*`);
    for (const p of phrases.slice(0, 8)) lines.push(`• \`${p}\``);
  }
  if (t.common_mistakes) {
    lines.push(`\n⚠️ *Avoid:* ${t.common_mistakes}`);
  }
  return lines.join('\n');
}

export function templatesMenuKeyboard(): { inline_keyboard: { text: string; callback_data: string }[][] } {
  return {
    inline_keyboard: [
      [
        { text: '📘 TOEFL Independent', callback_data: 'wt_toefl_independent' },
        { text: '📘 TOEFL Integrated', callback_data: 'wt_toefl_integrated' },
      ],
      [
        { text: '📗 IELTS Task 1', callback_data: 'wt_ielts_task1' },
        { text: '📗 IELTS Task 2', callback_data: 'wt_ielts_task2' },
      ],
      [
        { text: '📙 TOEIC Email', callback_data: 'wt_toeic_email' },
        { text: '📙 TOEIC Review', callback_data: 'wt_toeic_review' },
      ],
      [{ text: '🎲 Random Template', callback_data: 'wt_random' }],
    ],
  };
}

export async function listByTestTypeAndTask(env: Env, testType: string, taskType: string, userLevel: string): Promise<WritingTemplate[]> {
  return await listTemplates(env, { test_type: testType, task_type: taskType, userLevel });
}
