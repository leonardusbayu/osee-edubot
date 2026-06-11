// Weekly Target — personal weekly score promise (docs/FEATURE_GOALS.md).
//
// Every Monday (WIB) each active student gets 3 concrete numbers:
//   1. lift their weakest topic +10pp
//   2. clear N review cards
//   3. take the monthly mock (when due)
// Hitting all applicable goals = +100 XP bonus, awarded once per week.
// All functions are best-effort: any failure degrades to "no target shown".

import type { Env } from '../types';

export interface WeeklyTarget {
  id: number;
  user_id: number;
  week_start: string;
  topic: string | null;
  topic_start_pct: number | null;
  topic_goal_pct: number | null;
  reviews_goal: number;
  mock_due: number;
  status: string;
}

export interface TargetProgress {
  target: WeeklyTarget;
  topic_now_pct: number | null;
  topic_hit: boolean;
  reviews_done: number;
  reviews_hit: boolean;
  mock_done: boolean;
  mock_hit: boolean;
  all_hit: boolean;
  bonus_awarded: boolean;
}

/** Monday of the current week in WIB (UTC+7), as YYYY-MM-DD. */
export function currentWeekStartWIB(now: Date = new Date()): string {
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  const day = wib.getUTCDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1;
  wib.setUTCDate(wib.getUTCDate() - diff);
  return wib.toISOString().split('T')[0];
}

async function topicAccuracyPct(env: Env, userId: number, topic: string): Promise<number | null> {
  try {
    const m = await env.DB.prepare(
      `SELECT mastery_level, accuracy_percent, exercises_attempted
         FROM topic_mastery WHERE user_id = ? AND topic = ?`
    ).bind(userId, topic).first() as any;
    if (!m) return null;
    if (Number(m.exercises_attempted || 0) > 0 && m.accuracy_percent != null) {
      return Math.round(Number(m.accuracy_percent));
    }
    if (m.mastery_level != null) return Math.round(Number(m.mastery_level));
    return null;
  } catch { return null; }
}

/**
 * Get this week's target, creating it on first touch of the week.
 * Returns null when there isn't enough data to set a meaningful goal
 * (brand-new student) or the table is missing.
 */
export async function getOrCreateWeeklyTarget(env: Env, userId: number): Promise<WeeklyTarget | null> {
  try {
    const weekStart = currentWeekStartWIB();
    const existing = await env.DB.prepare(
      `SELECT * FROM weekly_targets WHERE user_id = ? AND week_start = ?`
    ).bind(userId, weekStart).first<WeeklyTarget>();
    if (existing) return existing;

    // Goal 1: weakest topic from the gap router
    let topic: string | null = null;
    let startPct: number | null = null;
    try {
      const user = await env.DB.prepare('SELECT target_test FROM users WHERE id = ?').bind(userId).first() as any;
      const { computeTopGaps } = await import('./gap-router');
      const gaps = await computeTopGaps(env, userId, user?.target_test || 'TOEFL_IBT', 1);
      if (gaps.length > 0) {
        topic = gaps[0].topic;
        startPct = await topicAccuracyPct(env, userId, topic);
      }
    } catch { /* no gap data yet */ }

    // Goal 2: review cards — current due count + headroom, capped
    let reviewsGoal = 10;
    try {
      const due = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM spaced_repetition
          WHERE user_id = ? AND next_review_at <= datetime('now', '+7 days')`
      ).bind(userId).first() as any;
      reviewsGoal = Math.max(5, Math.min(25, Number(due?.n || 0)));
    } catch { /* default */ }

    // Goal 3: mock due this week?
    let mockDue = 0;
    try {
      const lastMock = await env.DB.prepare(
        `SELECT taken_at FROM mock_test_history WHERE user_id = ? ORDER BY taken_at DESC LIMIT 1`
      ).bind(userId).first() as any;
      if (!lastMock?.taken_at ||
          Date.now() - new Date(lastMock.taken_at).getTime() > 28 * 86400000) {
        mockDue = 1;
      }
    } catch { /* default 0 */ }

    const topicGoal = startPct != null ? Math.min(95, startPct + 10) : null;
    const ins = await env.DB.prepare(
      `INSERT INTO weekly_targets
         (user_id, week_start, topic, topic_start_pct, topic_goal_pct, reviews_goal, mock_due)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, weekStart, topic, startPct, topicGoal, reviewsGoal, mockDue).run();
    return await env.DB.prepare('SELECT * FROM weekly_targets WHERE id = ?')
      .bind(ins.meta.last_row_id as number).first<WeeklyTarget>();
  } catch {
    return null;
  }
}

/** Live progress vs this week's target. Awards the +100 XP bonus once. */
export async function checkTargetProgress(env: Env, userId: number): Promise<TargetProgress | null> {
  const target = await getOrCreateWeeklyTarget(env, userId);
  if (!target) return null;
  try {
    // Topic progress
    let topicNow: number | null = null;
    let topicHit = false;
    if (target.topic && target.topic_goal_pct != null) {
      topicNow = await topicAccuracyPct(env, userId, target.topic);
      topicHit = topicNow != null && topicNow >= target.topic_goal_pct;
    } else {
      topicHit = true; // no topic goal → vacuously hit
    }

    // Reviews done since week start
    let reviewsDone = 0;
    try {
      const r = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM spaced_repetition
          WHERE user_id = ? AND last_reviewed_at >= ?`
      ).bind(userId, target.week_start).first() as any;
      reviewsDone = Number(r?.n || 0);
    } catch { /* 0 */ }
    const reviewsHit = reviewsDone >= target.reviews_goal;

    // Mock this week
    let mockDone = false;
    try {
      const m = await env.DB.prepare(
        `SELECT id FROM mock_test_history WHERE user_id = ? AND taken_at >= ? LIMIT 1`
      ).bind(userId, target.week_start).first();
      mockDone = !!m;
    } catch { /* false */ }
    const mockHit = target.mock_due === 0 || mockDone;

    const allHit = topicHit && reviewsHit && mockHit;
    let bonusAwarded = false;

    if (allHit && target.status === 'active') {
      await env.DB.prepare(
        `UPDATE weekly_targets SET status = 'achieved', achieved_at = datetime('now')
          WHERE id = ? AND status = 'active'`
      ).bind(target.id).run();
      try {
        const { addXP } = await import('./commercial');
        await addXP(env, userId, 100, 'weekly_target_achieved');
        bonusAwarded = true;
      } catch { /* XP best-effort */ }
    }

    return {
      target, topic_now_pct: topicNow, topic_hit: topicHit,
      reviews_done: reviewsDone, reviews_hit: reviewsHit,
      mock_done: mockDone, mock_hit: mockHit,
      all_hit: allHit, bonus_awarded: bonusAwarded,
    };
  } catch {
    return null;
  }
}

/** Compact one/two-liner for /today. Empty string when no target. */
export async function formatTargetHeader(env: Env, userId: number): Promise<string> {
  const p = await checkTargetProgress(env, userId);
  if (!p) return '';
  if (p.target.status === 'achieved') {
    return `🏆 *Target minggu ini TERCAPAI!*${p.bonus_awarded ? ' +100 XP bonus 🎉' : ''}\n`;
  }
  const parts: string[] = [];
  if (p.target.topic && p.target.topic_goal_pct != null) {
    const now = p.topic_now_pct != null ? `${p.topic_now_pct}%` : '?';
    parts.push(`${p.target.topic.replace(/_/g, ' ')} ${now}→${p.target.topic_goal_pct}%${p.topic_hit ? ' ✅' : ''}`);
  }
  parts.push(`review ${p.reviews_done}/${p.target.reviews_goal}${p.reviews_hit ? ' ✅' : ''}`);
  if (p.target.mock_due === 1) parts.push(`mock test${p.mock_done ? ' ✅' : ' ⬜'}`);
  return `🎯 Target minggu ini: ${parts.join(' · ')}\n`;
}

/** Detailed block for /progress. Empty string when no target. */
export async function formatTargetDetail(env: Env, userId: number): Promise<string> {
  const p = await checkTargetProgress(env, userId);
  if (!p) return '';
  let msg = `\n🎯 *Target Minggu Ini* (mulai ${p.target.week_start}):\n`;
  if (p.target.topic && p.target.topic_goal_pct != null) {
    const now = p.topic_now_pct != null ? `${p.topic_now_pct}%` : 'belum ada data';
    msg += `${p.topic_hit ? '✅' : '⬜'} Naikkan *${p.target.topic.replace(/_/g, ' ')}*: ${now} → target ${p.target.topic_goal_pct}%\n`;
  }
  msg += `${p.reviews_hit ? '✅' : '⬜'} Review: ${p.reviews_done}/${p.target.reviews_goal} kartu\n`;
  if (p.target.mock_due === 1) {
    msg += `${p.mock_done ? '✅' : '⬜'} Mock test bulanan (Quick Test di /test)\n`;
  }
  msg += p.all_hit
    ? `🏆 Semua tercapai!${p.bonus_awarded ? ' +100 XP bonus 🎉' : ''}`
    : `Capai semuanya = *+100 XP bonus*. Gas! 💪`;
  return msg + '\n';
}
