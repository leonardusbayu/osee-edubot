// Coins currency engine.
// Earn coins from activity (with random bonus drops), spend in shop.

import type { Env } from '../types';

// Base coin earnings per activity
const COIN_TABLE: Record<string, number> = {
  question_correct: 5,
  question_wrong: 1,
  speaking_complete: 12,
  writing_complete: 12,
  speed_drill: 8,
  gap_fill: 8,
  wordle_win: 10,
  review_card: 2,
  quest_complete: 25,
  challenge_win: 20,
  streak_milestone: 50,    // every 7-day streak checkpoint
};

// 1 in BONUS_DROP_CHANCE activities gives a random bonus
const BONUS_DROP_CHANCE = 5;
const BONUS_DROP_MIN = 30;
const BONUS_DROP_MAX = 150;

export async function earnCoins(
  env: Env,
  userId: number,
  source: string,
  opts: { amount?: number; detail?: string } = {},
): Promise<{ coins_earned: number; bonus_drop: number; total_coins: number }> {
  const base = opts.amount ?? COIN_TABLE[source] ?? 3;

  // Random bonus drop
  const roll = Math.floor(Math.random() * BONUS_DROP_CHANCE);
  const bonusDrop = roll === 0
    ? Math.floor(Math.random() * (BONUS_DROP_MAX - BONUS_DROP_MIN + 1)) + BONUS_DROP_MIN
    : 0;

  const total = base + bonusDrop;

  await env.DB.prepare(
    `UPDATE user_xp SET coins = COALESCE(coins, 0) + ? WHERE user_id = ?`,
  ).bind(total, userId).run();

  await env.DB.prepare(
    `INSERT INTO coin_log (user_id, amount, source, detail) VALUES (?, ?, ?, ?)`,
  ).bind(userId, base, source, opts.detail || null).run();

  if (bonusDrop > 0) {
    await env.DB.prepare(
      `INSERT INTO coin_log (user_id, amount, source, detail) VALUES (?, ?, 'bonus_drop', ?)`,
    ).bind(userId, bonusDrop, `lucky drop from ${source}`).run();
  }

  const row = await env.DB.prepare(
    `SELECT coins FROM user_xp WHERE user_id = ?`,
  ).bind(userId).first<{ coins: number }>();

  return { coins_earned: base, bonus_drop: bonusDrop, total_coins: Number(row?.coins || 0) };
}

/**
 * Fetch the user's current coin balance. Returns 0 if the user has no
 * user_xp row yet (a brand-new account that hasn't earned anything).
 */
export async function getUserBalance(env: Env, userId: number): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT coins FROM user_xp WHERE user_id = ?`,
  ).bind(userId).first<{ coins: number }>();
  return Number(row?.coins || 0);
}

export async function spendCoins(
  env: Env,
  userId: number,
  amount: number,
  source: string,
  detail?: string,
): Promise<{ success: boolean; total_coins: number }> {
  // Use atomic UPDATE with WHERE clause to prevent race condition
  const result = await env.DB.prepare(
    `UPDATE user_xp SET coins = coins - ? WHERE user_id = ? AND coins >= ?`,
  ).bind(amount, userId, amount).run();

  // Check if any rows were affected (0 rows = insufficient balance)
  if (!result.success || result.meta.changes === 0) {
    const row = await env.DB.prepare(
      `SELECT coins FROM user_xp WHERE user_id = ?`,
    ).bind(userId).first<{ coins: number }>();
    const current = Number(row?.coins || 0);
    return { success: false, total_coins: current };
  }

  // Query updated balance for response
  const row = await env.DB.prepare(
    `SELECT coins FROM user_xp WHERE user_id = ?`,
  ).bind(userId).first<{ coins: number }>();
  const newBalance = Number(row?.coins || 0);

  await env.DB.prepare(
    `INSERT INTO coin_log (user_id, amount, source, detail) VALUES (?, ?, ?, ?)`,
  ).bind(userId, -amount, source, detail || null).run();

  return { success: true, total_coins: newBalance };
}
