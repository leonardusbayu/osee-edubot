// Companion feature-discovery nudges.
//
// Surfaces 1 unused feature per day via companion voice, targeted by what
// the student has actually done. Driven by seed data in companion_tips
// (migration 055). Hard-capped at 1/day, with per-tip cooldowns and
// priority ordering to avoid noise.
//
// Touchpoints (called from webhook.ts):
//   - maybeAppendNudge() — returns a short string to append to an existing
//     outgoing message (after /today, /review, test finish). Null if no tip.
//   - daily cron (index.ts) — same call, piggybacks on the morning reminder.
//
// Design rule: tips are ONLY appended to messages the user expects, never
// standalone pings. One tip/day max. Opt-out via /quiet (tips_enabled=0).

import type { Env } from '../types';

interface TipRow {
  id: string;
  feature: string;
  priority: number;
  required_events: string | null;
  blocker_events: string | null;
  min_days_since_signup: number;
  message: string;
  cta_command: string | null;
  cooldown_days: number;
  active: number;
}

export interface Nudge {
  tip_id: string;
  message: string;
  cta_command: string | null;
}

// ─── Event detection ────────────────────────────────────────────────────

/**
 * Computes which event flags are true for a user right now. Each query is
 * wrapped in try/catch — if a table is missing (old env, fresh D1), we
 * treat the event as false rather than blow up the whole dispatch.
 */
async function computeEvents(env: Env, userId: number): Promise<Set<string>> {
  const events = new Set<string>();

  const asBool = async (label: string, sql: string, ...binds: any[]): Promise<void> => {
    try {
      const row = await env.DB.prepare(sql).bind(...binds).first() as any;
      if (row && Number(row.n || row.c || 0) > 0) events.add(label);
    } catch { /* table missing → event stays false */ }
  };

  // Test / study engagement
  await asBool('studied_once',
    `SELECT COUNT(*) AS n FROM test_attempts WHERE user_id = ? LIMIT 1`, userId);
  await asBool('used_diagnostic',
    `SELECT COUNT(*) AS n FROM diagnostic_sessions WHERE user_id = ? AND status = 'completed' LIMIT 1`, userId);
  await asBool('used_today',
    `SELECT COUNT(*) AS n FROM lesson_step_results WHERE user_id = ? LIMIT 1`, userId);

  // Spaced repetition
  await asBool('reviewed_once',
    `SELECT COUNT(*) AS n FROM spaced_repetition WHERE user_id = ? AND review_count > 0 LIMIT 1`, userId);

  // Speaking / pronunciation
  await asBool('used_speak',
    `SELECT COUNT(*) AS n FROM speaking_sessions WHERE user_id = ? LIMIT 1`, userId);

  // Lesson plans
  await asBool('has_lesson_plan',
    `SELECT COUNT(*) AS n FROM lesson_plans WHERE user_id = ? AND status != 'archived' LIMIT 1`, userId);
  await asBool('opened_today_today',
    `SELECT COUNT(*) AS n FROM lesson_step_results WHERE user_id = ? AND date(created_at) = date('now')`, userId);

  // User state
  try {
    const u = await env.DB.prepare(
      `SELECT created_at, current_streak, is_premium, premium_until, referral_count
         FROM users WHERE id = ?`
    ).bind(userId).first() as any;
    if (u) {
      const ageDays = Math.floor(
        (Date.now() - new Date(u.created_at).getTime()) / 86400000
      );
      if (ageDays >= 7) events.add('week_old');
      if (ageDays >= 30) events.add('month_old');

      const streak = Number(u.current_streak || 0);
      if (streak >= 3) events.add('streak_3');
      if (streak >= 7) events.add('streak_7');

      const isPremium = Number(u.is_premium || 0) === 1
        && u.premium_until && new Date(u.premium_until).getTime() > Date.now();
      if (!isPremium) events.add('free_user');

      if (Number(u.referral_count || 0) > 0) events.add('referred_someone');
    }
  } catch { /* fall through */ }

  // Daily quota (only meaningful for free users)
  try {
    const q = await env.DB.prepare(
      `SELECT questions_used FROM daily_question_logs
        WHERE user_id = ? AND log_date = date('now')`
    ).bind(userId).first() as any;
    if (q && Number(q.questions_used || 0) >= 8) events.add('quota_used_high');
  } catch { /* fall through */ }

  return events;
}

// ─── Dispatch ───────────────────────────────────────────────────────────

/**
 * Pick at most one eligible tip for the user. Returns null if:
 *   - tips disabled (users.tips_enabled = 0), OR
 *   - a tip was already shown to this user today, OR
 *   - no tip's required_events match with blocker_events absent.
 */
export async function pickNudge(env: Env, userId: number): Promise<Nudge | null> {
  // 1. Opt-out check
  try {
    const user = await env.DB.prepare(
      `SELECT tips_enabled FROM users WHERE id = ?`
    ).bind(userId).first() as any;
    if (user && Number(user.tips_enabled ?? 1) === 0) return null;
  } catch { return null; }

  // 2. Daily cap — one tip per UTC day is plenty
  try {
    const recent = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM companion_tips_shown
        WHERE user_id = ? AND date(shown_at) = date('now')`
    ).bind(userId).first() as any;
    if (recent && Number(recent.n || 0) > 0) return null;
  } catch { /* table may not exist yet on first deploy */ }

  // 3. Load active tips (small table, ~15 rows)
  let tips: TipRow[] = [];
  try {
    const res = await env.DB.prepare(
      `SELECT * FROM companion_tips WHERE active = 1 ORDER BY priority ASC`
    ).all();
    tips = (res.results || []) as any;
  } catch { return null; }

  if (tips.length === 0) return null;

  // 4. Compute event flags + user age
  const events = await computeEvents(env, userId);
  let ageDays = 0;
  try {
    const u = await env.DB.prepare(
      `SELECT created_at FROM users WHERE id = ?`
    ).bind(userId).first() as any;
    if (u?.created_at) {
      ageDays = Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400000);
    }
  } catch { /* age stays 0 */ }

  // 5. Load cooldown state — tip → most recent shown_at
  const cooldownMap = new Map<string, number>(); // tip_id → days since last shown
  try {
    const res = await env.DB.prepare(
      `SELECT tip_id, MAX(shown_at) AS last_shown
         FROM companion_tips_shown WHERE user_id = ? GROUP BY tip_id`
    ).bind(userId).all();
    for (const row of (res.results || []) as any[]) {
      if (row.last_shown) {
        const days = Math.floor(
          (Date.now() - new Date(row.last_shown).getTime()) / 86400000
        );
        cooldownMap.set(row.tip_id, days);
      }
    }
  } catch { /* ignore */ }

  // 6. Filter — pick the first (highest-priority) eligible tip
  for (const tip of tips) {
    if (ageDays < tip.min_days_since_signup) continue;

    const sinceShown = cooldownMap.get(tip.id);
    if (sinceShown !== undefined && sinceShown < tip.cooldown_days) continue;

    const required: string[] = tip.required_events ? safeParse(tip.required_events) : [];
    const blockers: string[] = tip.blocker_events ? safeParse(tip.blocker_events) : [];

    // All required must be present
    if (!required.every(e => events.has(e))) continue;
    // Any blocker present → skip
    if (blockers.some(e => events.has(e))) continue;

    // Winner. Log + return.
    try {
      await env.DB.prepare(
        `INSERT INTO companion_tips_shown (user_id, tip_id) VALUES (?, ?)`
      ).bind(userId, tip.id).run();
    } catch { /* ignore insert failure — don't block the message */ }

    return { tip_id: tip.id, message: tip.message, cta_command: tip.cta_command };
  }

  return null;
}

function safeParse(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

/**
 * Convenience wrapper for message-time injection. Returns a short block
 * ready to append (with leading blank line) or '' if no tip.
 */
export async function maybeAppendNudge(env: Env, userId: number): Promise<string> {
  const tip = await pickNudge(env, userId);
  if (!tip) return '';
  return `\n\n💡 _Dari Arin:_ ${tip.message}`;
}

/**
 * Opt-out toggle for /quiet command. Returns new state ('on' | 'off').
 */
export async function toggleTips(env: Env, userId: number): Promise<'on' | 'off'> {
  const u = await env.DB.prepare(
    `SELECT tips_enabled FROM users WHERE id = ?`
  ).bind(userId).first() as any;
  const next = Number(u?.tips_enabled ?? 1) === 0 ? 1 : 0;
  await env.DB.prepare(
    `UPDATE users SET tips_enabled = ? WHERE id = ?`
  ).bind(next, userId).run();
  return next === 1 ? 'on' : 'off';
}
