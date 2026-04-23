// ═══════════════════════════════════════════════════════
// PROGRESS VISUALIZATION — Weekly Progress Card
// 
// Generates a text-based weekly progress card showing
// XP gained, streak, accuracy trend, and topics mastered.
// Sent every Monday via cron or on-demand via /weekly.
// ═══════════════════════════════════════════════════════

import type { Env } from '../types';

export interface WeeklyProgress {
  userId: number;
  weekStart: string;
  weekEnd: string;
  xpThisWeek: number;
  xpLastWeek: number;
  xpChange: number;
  questionsThisWeek: number;
  accuracyThisWeek: number;
  accuracyLastWeek: number;
  streakCurrent: number;
  streakBest: number;
  topicsMastered: number;
  newTopicsMastered: number;
  level: number;
  league: string | null;
}

/**
 * Take a progress snapshot for today.
 * Called from cron or after significant activity.
 */
export async function takeProgressSnapshot(env: Env, userId: number): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Check if snapshot already exists for today
    const existing = await env.DB.prepare(
      'SELECT id FROM progress_snapshots WHERE user_id = ? AND snapshot_date = ?'
    ).bind(userId, today).first();

    if (existing) return;

    // Gather stats
    const xpRow = await env.DB.prepare(
      'SELECT total_xp, level, current_streak, longest_streak FROM user_xp WHERE user_id = ?'
    ).bind(userId).first() as any;

    const questionsRow = await env.DB.prepare(
      `SELECT COUNT(*) as total,
        SUM(CASE WHEN is_correct = 1 OR (is_correct IS NULL AND section IN ('speaking','writing') AND json_extract(answer_data, '$.score') >= 5) THEN 1 ELSE 0 END) as correct
       FROM attempt_answers aa
       JOIN test_attempts ta ON aa.attempt_id = ta.id
       WHERE ta.user_id = ?`
    ).bind(userId).first() as any;

    const accuracy = questionsRow?.total > 0
      ? Math.round((questionsRow.correct / questionsRow.total) * 100)
      : 0;

    const masteredRow = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM topic_mastery
       WHERE user_id = ? AND status = 'mastered'`
    ).bind(userId).first() as any;

    const coinsRow = await env.DB.prepare(
      'SELECT total_coins FROM user_coins WHERE user_id = ?'
    ).bind(userId).first() as any;

    const leagueRow = await env.DB.prepare(
      'SELECT league FROM league_memberships WHERE user_id = ? ORDER BY id DESC LIMIT 1'
    ).bind(userId).first() as any;

    await env.DB.prepare(
      `INSERT INTO progress_snapshots
       (user_id, snapshot_date, total_xp, level, current_streak, questions_answered,
        accuracy_percent, topics_mastered, coins, league)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      userId,
      today,
      xpRow?.total_xp || 0,
      xpRow?.level || 1,
      xpRow?.current_streak || 0,
      questionsRow?.total || 0,
      accuracy,
      masteredRow?.cnt || 0,
      coinsRow?.total_coins || 0,
      leagueRow?.league || null,
    ).run();
  } catch (e) {
    console.error('[progress-snapshot] Error:', e);
  }
}

/**
 * Get weekly progress for a user.
 */
export async function getWeeklyProgress(env: Env, userId: number): Promise<WeeklyProgress | null> {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sunday
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(weekStart.getDate() - 7);
  const lastWeekEnd = new Date(weekStart);
  lastWeekEnd.setDate(weekStart.getDate() - 1);

  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];
  const lastWeekEndStr = lastWeekEnd.toISOString().split('T')[0];

  // This week's snapshots
  const thisWeekRow = await env.DB.prepare(
    `SELECT
       MAX(total_xp) - MIN(total_xp) as xp_gained,
       MAX(total_xp) as current_xp,
       MAX(level) as level,
       MAX(current_streak) as streak,
       MAX(topics_mastered) as topics_mastered,
       MAX(league) as league
     FROM progress_snapshots
     WHERE user_id = ? AND snapshot_date >= ? AND snapshot_date <= ?`
  ).bind(userId, weekStartStr, weekEndStr).first() as any;

  // Last week's snapshots
  const lastWeekRow = await env.DB.prepare(
    `SELECT
       MAX(total_xp) - MIN(total_xp) as xp_gained,
       MAX(total_xp) as current_xp
     FROM progress_snapshots
     WHERE user_id = ? AND snapshot_date >= ? AND snapshot_date <= ?`
  ).bind(userId, lastWeekStartStr, lastWeekEndStr).first() as any;

  // Questions answered this week
  const questionsRow = await env.DB.prepare(
    `SELECT COUNT(*) as total,
       SUM(CASE WHEN is_correct = 1 OR (is_correct IS NULL AND section IN ('speaking','writing') AND json_extract(answer_data, '$.score') >= 5) THEN 1 ELSE 0 END) as correct
     FROM attempt_answers aa
     JOIN test_attempts ta ON aa.attempt_id = ta.id
     WHERE ta.user_id = ? AND ta.started_at >= ? AND ta.started_at <= ?`
  ).bind(userId, weekStart.toISOString(), weekEnd.toISOString()).first() as any;

  if (!thisWeekRow || thisWeekRow.xp_gained === null) {
    return null;
  }

  const xpThisWeek = thisWeekRow.xp_gained || 0;
  const xpLastWeek = lastWeekRow?.xp_gained || 0;

  return {
    userId,
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    xpThisWeek,
    xpLastWeek,
    xpChange: xpThisWeek - xpLastWeek,
    questionsThisWeek: questionsRow?.total || 0,
    accuracyThisWeek: questionsRow?.total > 0
      ? Math.round(((questionsRow.correct || 0) / questionsRow.total) * 100)
      : 0,
    accuracyLastWeek: 0, // Would need separate query
    streakCurrent: thisWeekRow.streak || 0,
    streakBest: thisWeekRow.streak || 0,
    topicsMastered: thisWeekRow.topics_mastered || 0,
    newTopicsMastered: 0,
    level: thisWeekRow.level || 1,
    league: thisWeekRow.league || null,
  };
}

/**
 * Format weekly progress card as a Telegram message.
 */
export function formatWeeklyCard(progress: WeeklyProgress): string {
  const xpEmoji = progress.xpChange > 0 ? '📈' : progress.xpChange < 0 ? '📉' : '➡️';
  const xpChangeStr = progress.xpChange > 0 ? `+${progress.xpChange}` : `${progress.xpChange}`;

  const accuracyBar = (accuracy: number) => {
    const filled = Math.round(accuracy / 10);
    return '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
  };

  return `📊 *Progress Mingguan*
📅 ${progress.weekStart} — ${progress.weekEnd}

⭐ XP Minggu Ini: *${progress.xpThisWeek}* ${xpEmoji} (${xpChangeStr} vs minggu lalu)
📝 Soal Dijawab: *${progress.questionsThisWeek}*
🎯 Akurasi: *${progress.accuracyThisWeek}%*
${accuracyBar(progress.accuracyThisWeek)}

🔥 Streak: *${progress.streakCurrent} hari*
📚 Topik Dikuasai: *${progress.topicsMastered}*
🏆 Level: *${progress.level}*
${progress.league ? `🏅 League: *${progress.league}*` : ''}

${progress.xpThisWeek >= progress.xpLastWeek && progress.xpLastWeek > 0
  ? '🔥 Progress naik dari minggu lalu! Pertahankan!'
  : progress.xpThisWeek === 0
    ? '💪 Minggu ini belum ada activity. Yuk mulai!'
    : '📊 Coba tingkatkan lagi minggu depan!'}

Ketik /progress untuk detail lengkap.`;
}

/**
 * Take snapshots for all active users (cron job).
 */
export async function takeAllSnapshots(env: Env): Promise<number> {
  const users = await env.DB.prepare(
    'SELECT id FROM users WHERE role = "student" AND last_interaction_at >= date("now", "-30 days")'
  ).all() as any;

  let count = 0;
  for (const user of users.results || []) {
    await takeProgressSnapshot(env, user.id);
    count++;
  }

  return count;
}
