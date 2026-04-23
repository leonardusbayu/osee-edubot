// ═══════════════════════════════════════════════════════
// SMART NOTIFICATIONS — Contextual Nudges
// 
// Sends contextual, non-spammy notifications based on
// student behavior patterns. Respects quiet hours and
// notification preferences.
// ═══════════════════════════════════════════════════════

import type { Env } from '../types';

export interface NotificationPrefs {
  daily_reminder: boolean;
  review_reminder: boolean;
  event_announcement: boolean;
  buddy_activity: boolean;
  motivational_nudge: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

/**
 * Check if it's currently within quiet hours for a user.
 */
function isQuietHours(prefs: NotificationPrefs): boolean {
  const now = new Date();
  const jakartaTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  const [hours, minutes] = jakartaTime.split(':').map(Number);
  const currentMinutes = hours * 60 + minutes;

  const [startH, startM] = prefs.quiet_hours_start.split(':').map(Number);
  const [endH, endM] = prefs.quiet_hours_end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes < endMinutes) {
    // Normal range (e.g., 22:00 - 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    // Crosses midnight (e.g., 22:00 - 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

/**
 * Load notification preferences for a user.
 */
export async function getNotificationPrefs(env: Env, userId: number): Promise<NotificationPrefs> {
  try {
    const row = await env.DB.prepare(
      'SELECT * FROM notification_preferences WHERE user_id = ?'
    ).bind(userId).first() as any;

    if (row) {
      return {
        daily_reminder: !!row.daily_reminder,
        review_reminder: !!row.review_reminder,
        event_announcement: !!row.event_announcement,
        buddy_activity: !!row.buddy_activity,
        motivational_nudge: !!row.motivational_nudge,
        quiet_hours_start: row.quiet_hours_start || '22:00',
        quiet_hours_end: row.quiet_hours_end || '07:00',
      };
    }
  } catch {}

  return {
    daily_reminder: true,
    review_reminder: true,
    event_announcement: true,
    buddy_activity: true,
    motivational_nudge: true,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
  };
}

/**
 * Check if a notification should be sent to a user.
 * Returns null if notification should be skipped, otherwise returns the message.
 */
export async function shouldSendNotification(
  env: Env,
  userId: number,
  type: 'daily' | 'review' | 'event' | 'buddy' | 'motivational',
  message: string,
): Promise<string | null> {
  const prefs = await getNotificationPrefs(env, userId);

  // Check quiet hours
  if (isQuietHours(prefs)) return null;

  // Check preference for this type
  const prefMap: Record<string, keyof NotificationPrefs> = {
    daily: 'daily_reminder',
    review: 'review_reminder',
    event: 'event_announcement',
    buddy: 'buddy_activity',
    motivational: 'motivational_nudge',
  };

  if (!prefs[prefMap[type]]) return null;

  return message;
}

/**
 * Generate contextual nudges based on student state.
 */
export async function generateSmartNudge(env: Env, userId: number): Promise<string | null> {
  try {
    // Check if user has been inactive
    const profile = await env.DB.prepare(
      'SELECT last_interaction_at FROM student_profiles WHERE user_id = ?'
    ).bind(userId).first() as any;

    if (profile?.last_interaction_at) {
      const lastInteraction = new Date(profile.last_interaction_at);
      const daysSince = Math.floor((Date.now() - lastInteraction.getTime()) / 86400000);

      if (daysSince >= 3 && daysSince < 7) {
        return `Hei, udah ${daysSince} hari nggak belajar nih. Kangen sama kamu! 😊\n\nCuma 5 menit aja, yuk review 1 topik. /review`;
      } else if (daysSince >= 7) {
        return `Wah, udah seminggu lebih nggak ketemu! 😢\n\nStreak kamu mungkin udah reset, tapi nggak apa-apa — yang penting mulai lagi. /today`;
      }
    }

    // Check if there are due reviews
    const { getReviewStats } = await import('./fsrs-engine');
    const stats = await getReviewStats(env, userId);
    if (stats.due >= 5) {
      return `📚 Kamu punya ${stats.due} soal yang perlu di-review. Yuk selesaikan sebelum lupa! /review`;
    }

    // Check if close to next level
    const xpRow = await env.DB.prepare(
      'SELECT total_xp, level FROM user_xp WHERE user_id = ?'
    ).bind(userId).first() as any;

    if (xpRow) {
      const currentLevel = xpRow.level;
      const xpForNext = Math.pow(currentLevel, 2) * 25;
      const xpNeeded = xpForNext - xpRow.total_xp;

      if (xpNeeded <= 50 && xpNeeded > 0) {
        return `🎯 Tinggal ${xpNeeded} XP lagi untuk level ${currentLevel + 1}! Yuk jawab beberapa soal!`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Update notification preferences for a user.
 */
export async function updateNotificationPrefs(
  env: Env,
  userId: number,
  updates: Partial<NotificationPrefs>,
): Promise<void> {
  const existing = await getNotificationPrefs(env, userId);
  const merged = { ...existing, ...updates };

  await env.DB.prepare(
    `INSERT INTO notification_preferences
     (user_id, daily_reminder, review_reminder, event_announcement, buddy_activity,
      motivational_nudge, quiet_hours_start, quiet_hours_end)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       daily_reminder = ?, review_reminder = ?, event_announcement = ?,
       buddy_activity = ?, motivational_nudge = ?, quiet_hours_start = ?,
       quiet_hours_end = ?, updated_at = datetime('now')`
  ).bind(
    userId,
    merged.daily_reminder ? 1 : 0,
    merged.review_reminder ? 1 : 0,
    merged.event_announcement ? 1 : 0,
    merged.buddy_activity ? 1 : 0,
    merged.motivational_nudge ? 1 : 0,
    merged.quiet_hours_start,
    merged.quiet_hours_end,
    merged.daily_reminder ? 1 : 0,
    merged.review_reminder ? 1 : 0,
    merged.event_announcement ? 1 : 0,
    merged.buddy_activity ? 1 : 0,
    merged.motivational_nudge ? 1 : 0,
    merged.quiet_hours_start,
    merged.quiet_hours_end,
  ).run();
}
