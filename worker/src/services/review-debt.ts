// Review-debt pressure (ROADMAP_M3 §1.5).
// FSRS only works if reviews actually happen. This small service measures
// "review debt" (overdue spaced_repetition cards) and turns it into
// escalating Indonesian nudges. Heavy/critical debt also unlocks a bonus-XP
// path when the student clears their queue (wired in bot/webhook.ts).

import type { Env } from '../types';

export type DebtLevel = 'none' | 'light' | 'heavy' | 'critical';

export interface ReviewDebt {
  count: number;
  level: DebtLevel;
}

/**
 * Count overdue spaced-repetition items (next_review_at <= now) and bucket
 * them into a debt level. Best-effort: missing table → zero debt.
 */
export async function getReviewDebt(env: Env, userId: number): Promise<ReviewDebt> {
  let count = 0;
  try {
    const row = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM spaced_repetition WHERE user_id = ? AND next_review_at <= ?'
    ).bind(userId, new Date().toISOString()).first() as any;
    count = Number(row?.cnt || 0);
  } catch {
    // spaced_repetition table may not exist in older environments
  }

  let level: DebtLevel;
  if (count === 0) level = 'none';
  else if (count <= 5) level = 'light';
  else if (count <= 15) level = 'heavy';
  else level = 'critical';

  return { count, level };
}

/**
 * One-line Indonesian nudge per debt level. Empty string when no debt.
 */
export function formatDebtNudge(debt: ReviewDebt): string {
  switch (debt.level) {
    case 'light':
      return `🔄 ${debt.count} kartu review nunggu — 3 menit aja. Ketik /review.`;
    case 'heavy':
      return `⚠️ ${debt.count} kartu review numpuk. Materi yang gak di-review bakal lupa — /review dulu sebelum lanjut.`;
    case 'critical':
      return `🚨 ${debt.count} kartu! Clear dulu sebagian — ingatan itu use-it-or-lose-it. Ketik /review sekarang.`;
    default:
      return '';
  }
}
