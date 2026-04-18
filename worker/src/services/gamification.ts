// Gamification engine — XP, streaks, badge unlocks, daily quests.
//
// Call awardXp() whenever a student does something valuable. It handles:
//   1. XP grant (with multiplier for first-of-day)
//   2. Streak update
//   3. Badge check (fires new badge if threshold crossed)
//   4. Daily quest progress increment
//   5. Level calculation (sqrt curve: level = floor(sqrt(total_xp / 25)) + 1)

import type { Env } from '../types';
import { earnCoins } from './coins';
import { addLeagueXp } from './leagues';

// ─── XP values per activity ────────────────────────────────────
const XP_TABLE: Record<string, number> = {
  question_correct: 10,
  question_wrong: 3,
  speaking_complete: 25,
  writing_complete: 25,
  speed_drill: 15,        // base — actual varies with score
  gap_fill: 15,
  wordle_win: 20,
  review_card: 5,
  quest_complete: 50,
  challenge_win: 30,
  challenge_lose: 10,
};

function computeLevel(totalXp: number): number {
  return Math.floor(Math.sqrt(totalXp / 25)) + 1;
}

function todayWIB(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  return wib.toISOString().slice(0, 10);
}

export interface XpResult {
  xp_earned: number;
  multiplier: number;
  total_xp: number;
  level: number;
  level_up: boolean;
  streak: number;
  coins_earned: number;
  bonus_drop: number;
  total_coins: number;
  new_badges: Array<{ id: string; name: string; icon: string; xp_reward: number }>;
}

/**
 * Award XP for an activity. Returns total state + any new badges.
 */
export async function awardXp(
  env: Env,
  userId: number,
  source: string,
  opts: { amount?: number; detail?: string } = {},
): Promise<XpResult> {
  const today = todayWIB();
  const baseAmount = opts.amount ?? XP_TABLE[source] ?? 10;

  // Ensure user_xp row exists
  await env.DB.prepare(
    `INSERT OR IGNORE INTO user_xp (user_id, total_xp, level, current_streak, longest_streak, last_activity_date)
     VALUES (?, 0, 1, 0, 0, NULL)`,
  ).bind(userId).run();

  const row = await env.DB.prepare(
    `SELECT * FROM user_xp WHERE user_id = ?`,
  ).bind(userId).first<any>();

  const oldXp = Number(row?.total_xp || 0);
  const oldLevel = Number(row?.level || 1);
  const lastDate = row?.last_activity_date || '';
  let streak = Number(row?.current_streak || 0);
  const longestStreak = Number(row?.longest_streak || 0);

  // Check if first activity today → 2x multiplier
  const isFirstToday = lastDate !== today;
  const multiplier = isFirstToday ? 2.0 : 1.0;
  const xpEarned = Math.round(baseAmount * multiplier);

  // Update streak
  if (isFirstToday) {
    const yesterday = new Date(new Date().getTime() + 7 * 3600 * 1000 - 86400 * 1000).toISOString().slice(0, 10);
    if (lastDate === yesterday) {
      streak += 1;
    } else if (lastDate !== today) {
      // Missed a day — check freeze
      const freezes = Number(row?.streak_freezes || 0);
      if (freezes > 0 && lastDate) {
        // Use a freeze
        streak += 1;
        await env.DB.prepare(
          `UPDATE user_xp SET streak_freezes = streak_freezes - 1 WHERE user_id = ?`,
        ).bind(userId).run();
      } else {
        streak = 1; // reset
      }
    }
  }

  const newXp = oldXp + xpEarned;
  const newLevel = computeLevel(newXp);
  const newLongest = Math.max(longestStreak, streak);

  await env.DB.prepare(
    `UPDATE user_xp
        SET total_xp = ?, level = ?, current_streak = ?, longest_streak = ?,
            last_activity_date = ?, streak_updated_at = datetime('now')
      WHERE user_id = ?`,
  ).bind(newXp, newLevel, streak, newLongest, today, userId).run();

  // Log XP
  await env.DB.prepare(
    `INSERT INTO xp_log (user_id, amount, source, multiplier, detail)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(userId, xpEarned, source, multiplier, opts.detail || null).run();

  // Check badges
  const newBadges = await checkBadges(env, userId, {
    total_xp: newXp,
    streak,
    source,
  });

  // Increment quest progress
  await incrementQuests(env, userId, source);

  // Earn coins (with random bonus drops)
  let coinResult = { coins_earned: 0, bonus_drop: 0, total_coins: 0 };
  try {
    coinResult = await earnCoins(env, userId, source, { detail: opts.detail });
  } catch (e) {
    console.error('Coin earn error:', e);
  }

  // Track league XP
  try {
    await addLeagueXp(env, userId, xpEarned);
  } catch (e) {
    console.error('League XP error:', e);
  }

  // Advance friend quest progress for the user. Quest types map to
  // awardXp sources (see friend-quests.ts SOURCE_TO_EVENTS). Best-effort
  // — failures don't disturb the core XP / level / badge flow.
  try {
    const { recordQuestEvent } = await import('./friend-quests');
    await recordQuestEvent(env, userId, source, xpEarned);
  } catch (e) {
    console.error('Friend quest progress error:', e);
  }

  return {
    xp_earned: xpEarned,
    multiplier,
    total_xp: newXp,
    level: newLevel,
    level_up: newLevel > oldLevel,
    streak,
    coins_earned: coinResult.coins_earned,
    bonus_drop: coinResult.bonus_drop,
    total_coins: coinResult.total_coins,
    new_badges: newBadges,
  };
}

// ─── Badge checking ─────────────────────────────────────────────

interface BadgeCheckContext {
  total_xp: number;
  streak: number;
  source: string;
}

async function checkBadges(
  env: Env,
  userId: number,
  ctx: BadgeCheckContext,
): Promise<Array<{ id: string; name: string; icon: string; xp_reward: number }>> {
  // Get badges user doesn't have yet
  const { results: unearned } = await env.DB.prepare(
    `SELECT b.*
       FROM badges b
       LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = ?
      WHERE ub.id IS NULL`,
  ).bind(userId).all<any>();

  if (!unearned?.length) return [];

  // Gather stats
  const correct = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM attempt_answers aa
       JOIN test_attempts ta ON ta.id = aa.attempt_id
      WHERE ta.user_id = ? AND aa.is_correct = 1`,
  ).bind(userId).first<{ n: number }>();
  const correctCount = Number(correct?.n || 0);

  const drillBest = await env.DB.prepare(
    `SELECT MAX(score) AS best FROM game_scores WHERE user_id = ? AND game_type = 'speed_drill'`,
  ).bind(userId).first<{ best: number | null }>();
  const bestDrill = Number(drillBest?.best || 0);

  const referrals = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM users WHERE referred_by = ?`,
  ).bind(userId).first<{ n: number }>();
  const referralCount = Number(referrals?.n || 0);

  const newBadges: Array<{ id: string; name: string; icon: string; xp_reward: number }> = [];

  for (const badge of unearned) {
    let earned = false;
    switch (badge.requirement_type) {
      case 'streak_days':
        earned = ctx.streak >= badge.requirement_value;
        break;
      case 'total_xp':
        earned = ctx.total_xp >= badge.requirement_value;
        break;
      case 'correct_count':
        earned = correctCount >= badge.requirement_value;
        break;
      case 'drill_score':
        earned = bestDrill >= badge.requirement_value;
        break;
      case 'referral_count':
        earned = referralCount >= badge.requirement_value;
        break;
      case 'perfect_score':
        // Checked elsewhere when a test is finished
        break;
    }

    if (earned) {
      // Use INSERT OR IGNORE and check if it actually inserted (0 rows = already awarded)
      const insertResult = await env.DB.prepare(
        `INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)`,
      ).bind(userId, badge.id).run();

      // Only grant badge XP bonus if this is a NEW badge award (INSERT affected rows)
      if (insertResult.meta.changes > 0 && badge.xp_reward > 0) {
        await env.DB.prepare(
          `UPDATE user_xp SET total_xp = total_xp + ? WHERE user_id = ?`,
        ).bind(badge.xp_reward, userId).run();
      }

      // Only add to new badges if this is a NEW award
      if (insertResult.meta.changes > 0) {
        newBadges.push({
          id: badge.id,
          name: badge.name,
          icon: badge.icon,
          xp_reward: badge.xp_reward || 0,
        });
      }
    }
  }

  return newBadges;
}

// ─── Daily quests ───────────────────────────────────────────────

const QUEST_POOL: Array<{ type: string; target: number; label: string }> = [
  { type: 'answer_questions', target: 5, label: 'Jawab 5 soal' },
  { type: 'answer_questions', target: 10, label: 'Jawab 10 soal' },
  { type: 'speaking_drill', target: 1, label: 'Selesaikan 1 speaking drill' },
  { type: 'review_cards', target: 10, label: 'Review 10 flashcard' },
  { type: 'speed_drill', target: 1, label: 'Main Speed Drill 1x' },
  { type: 'writing_task', target: 1, label: 'Tulis 1 essay' },
];

// Source → quest_type mapping
const SOURCE_TO_QUEST: Record<string, string> = {
  question_correct: 'answer_questions',
  question_wrong: 'answer_questions',
  speaking_complete: 'speaking_drill',
  writing_complete: 'writing_task',
  speed_drill: 'speed_drill',
  review_card: 'review_cards',
  gap_fill: 'answer_questions',
};

/**
 * Generate 3 daily quests for a user if none exist for today.
 */
export async function ensureDailyQuests(env: Env, userId: number): Promise<void> {
  const today = todayWIB();
  const existing = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM daily_quests WHERE user_id = ? AND quest_date = ?`,
  ).bind(userId, today).first<{ n: number }>();

  if ((existing?.n || 0) >= 3) return;

  // Pick 3 distinct quest types
  const shuffled = [...QUEST_POOL].sort(() => Math.random() - 0.5);
  const picked = new Set<string>();
  const quests: typeof QUEST_POOL = [];
  for (const q of shuffled) {
    if (!picked.has(q.type) && quests.length < 3) {
      picked.add(q.type);
      quests.push(q);
    }
  }

  for (const q of quests) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO daily_quests (user_id, quest_date, quest_type, target_count, xp_reward)
       VALUES (?, ?, ?, ?, 50)`,
    ).bind(userId, today, q.type, q.target).run();
  }
}

async function incrementQuests(env: Env, userId: number, source: string): Promise<void> {
  const questType = SOURCE_TO_QUEST[source];
  if (!questType) return;

  const today = todayWIB();
  await env.DB.prepare(
    `UPDATE daily_quests
        SET current_count = MIN(current_count + 1, target_count)
      WHERE user_id = ? AND quest_date = ? AND quest_type = ? AND completed = 0`,
  ).bind(userId, today, questType).run();

  // Check if any quest just completed
  const { results: justCompleted } = await env.DB.prepare(
    `SELECT id, xp_reward FROM daily_quests
      WHERE user_id = ? AND quest_date = ? AND completed = 0 AND current_count >= target_count`,
  ).bind(userId, today).all<any>();

  for (const q of justCompleted || []) {
    await env.DB.prepare(
      `UPDATE daily_quests SET completed = 1 WHERE id = ?`,
    ).bind(q.id).run();
    // Quest completion XP is already awarded via awardXp('quest_complete')
    // but we don't recurse here to avoid infinite loop — the caller handles it
  }
}

// ─── Profile / leaderboard helpers ──────────────────────────────

export async function getGamificationProfile(env: Env, userId: number) {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO user_xp (user_id, total_xp, level, current_streak, longest_streak)
     VALUES (?, 0, 1, 0, 0)`,
  ).bind(userId).run();

  const xp = await env.DB.prepare(
    `SELECT * FROM user_xp WHERE user_id = ?`,
  ).bind(userId).first<any>();

  const { results: badges } = await env.DB.prepare(
    `SELECT b.*, ub.earned_at
       FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
      WHERE ub.user_id = ?
      ORDER BY ub.earned_at DESC`,
  ).bind(userId).all<any>();

  const today = todayWIB();
  const { results: quests } = await env.DB.prepare(
    `SELECT * FROM daily_quests WHERE user_id = ? AND quest_date = ?`,
  ).bind(userId, today).all<any>();

  // Next level XP requirement
  const currentLevel = Number(xp?.level || 1);
  const nextLevelXp = Math.pow(currentLevel, 2) * 25;

  return {
    total_xp: Number(xp?.total_xp || 0),
    level: currentLevel,
    next_level_xp: nextLevelXp,
    current_streak: Number(xp?.current_streak || 0),
    longest_streak: Number(xp?.longest_streak || 0),
    streak_freezes: Number(xp?.streak_freezes || 0),
    badges: badges || [],
    badge_count: (badges || []).length,
    daily_quests: quests || [],
    quests_completed: (quests || []).filter((q: any) => q.completed).length,
  };
}
