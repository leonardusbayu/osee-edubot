// ═══════════════════════════════════════════════════════
// STUDY BUDDIES — Asynchronous Social
// 
// Students can add each other as study buddies and see
// each other's activity (XP earned, streaks, badges)
// without real-time chat. Low-pressure social motivation.
// ═══════════════════════════════════════════════════════

import type { Env } from '../types';

export interface StudyBuddy {
  id: number;
  user_id: number;
  buddy_id: number;
  buddy_name: string;
  buddy_level: number;
  buddy_streak: number;
  buddy_xp: number;
  status: 'pending' | 'accepted' | 'declined';
  sent_at: string;
}

/**
 * Send a study buddy request.
 */
export async function sendBuddyRequest(env: Env, userId: number, buddyTelegramId: number): Promise<{ success: boolean; message: string }> {
  // Find the buddy user
  const buddy = await env.DB.prepare(
    'SELECT id, name FROM users WHERE telegram_id = ?'
  ).bind(buddyTelegramId).first() as any;

  if (!buddy) {
    return { success: false, message: 'User tidak ditemukan. Pastikan mereka sudah pakai EduBot.' };
  }

  if (buddy.id === userId) {
    return { success: false, message: 'Nggak bisa add diri sendiri 😄' };
  }

  // Check if already buddies
  const existing = await env.DB.prepare(
    'SELECT * FROM study_buddies WHERE user_id = ? AND buddy_id = ?'
  ).bind(userId, buddy.id).first();

  if (existing) {
    return { success: false, message: 'Kamu sudah kirim request ke orang ini.' };
  }

  // Check if they already sent you a request (auto-accept)
  const reverseRequest = await env.DB.prepare(
    'SELECT * FROM study_buddies WHERE user_id = ? AND buddy_id = ?'
  ).bind(buddy.id, userId).first() as any;

  if (reverseRequest && reverseRequest.status === 'pending') {
    // Auto-accept!
    await env.DB.prepare(
      `UPDATE study_buddies SET status = 'accepted', responded_at = datetime('now')
       WHERE user_id = ? AND buddy_id = ?`
    ).bind(buddy.id, userId).run();

    return {
      success: true,
      message: `🎉 Kalian sudah jadi study buddies! ${buddy.name} juga udah add kamu sebelumnya.`,
    };
  }

  // Send request
  await env.DB.prepare(
    'INSERT INTO study_buddies (user_id, buddy_id, status) VALUES (?, ?, "pending")'
  ).bind(userId, buddy.id).run();

  return {
    success: true,
    message: `✅ Request dikirim ke ${buddy.name}! Mereka akan dapat notifikasi.`,
  };
}

/**
 * Accept a buddy request.
 */
export async function acceptBuddyRequest(env: Env, userId: number, requesterId: number): Promise<{ success: boolean; message: string }> {
  await env.DB.prepare(
    `UPDATE study_buddies SET status = 'accepted', responded_at = datetime('now')
     WHERE user_id = ? AND buddy_id = ?`
  ).bind(requesterId, userId).run();

  // Log activity for the requester
  await logBuddyActivity(env, requesterId, userId, 'buddy_accepted', {});

  return { success: true, message: '✅ Kamu sekarang study buddies!' };
}

/**
 * Get pending buddy requests for a user.
 */
export async function getPendingRequests(env: Env, userId: number): Promise<StudyBuddy[]> {
  const rows = await env.DB.prepare(
    `SELECT sb.*, u.name as buddy_name
     FROM study_buddies sb
     JOIN users u ON u.id = sb.user_id
     WHERE sb.buddy_id = ? AND sb.status = 'pending'
     ORDER BY sb.sent_at DESC`
  ).bind(userId).all() as any;

  return (rows.results || []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    buddy_id: r.buddy_id,
    buddy_name: r.buddy_name,
    buddy_level: 0,
    buddy_streak: 0,
    buddy_xp: 0,
    status: r.status,
    sent_at: r.sent_at,
  }));
}

/**
 * Get accepted buddies with their stats.
 */
export async function getAcceptedBuddies(env: Env, userId: number): Promise<StudyBuddy[]> {
  const rows = await env.DB.prepare(
    `SELECT sb.*, u.name as buddy_name,
            COALESCE(ux.level, 1) as buddy_level,
            COALESCE(ux.current_streak, 0) as buddy_streak,
            COALESCE(ux.total_xp, 0) as buddy_xp
     FROM study_buddies sb
     JOIN users u ON u.id = CASE WHEN sb.user_id = ? THEN sb.buddy_id ELSE sb.user_id END
     LEFT JOIN user_xp ux ON ux.user_id = CASE WHEN sb.user_id = ? THEN sb.buddy_id ELSE sb.user_id END
     WHERE (sb.user_id = ? OR sb.buddy_id = ?) AND sb.status = 'accepted'
     ORDER BY ux.total_xp DESC`
  ).bind(userId, userId, userId, userId).all() as any;

  return (rows.results || []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    buddy_id: r.buddy_id,
    buddy_name: r.buddy_name,
    buddy_level: r.buddy_level || 1,
    buddy_streak: r.buddy_streak || 0,
    buddy_xp: r.buddy_xp || 0,
    status: 'accepted',
    sent_at: r.sent_at,
  }));
}

/**
 * Log a buddy activity event.
 */
export async function logBuddyActivity(
  env: Env,
  userId: number,
  buddyId: number,
  activityType: string,
  data: Record<string, any>,
): Promise<void> {
  try {
    await env.DB.prepare(
      'INSERT INTO buddy_activity (user_id, buddy_id, activity_type, activity_data) VALUES (?, ?, ?, ?)'
    ).bind(userId, buddyId, activityType, JSON.stringify(data)).run();
  } catch {}
}

/**
 * Get recent buddy activity for a user.
 */
export async function getBuddyActivity(env: Env, userId: number, limit: number = 5): Promise<any[]> {
  const rows = await env.DB.prepare(
    `SELECT ba.*, u.name as buddy_name
     FROM buddy_activity ba
     JOIN users u ON u.id = ba.user_id
     WHERE ba.buddy_id = ?
     ORDER BY ba.created_at DESC
     LIMIT ?`
  ).bind(userId, limit).all() as any;

  return rows.results || [];
}

/**
 * Format buddy activity into a friendly message.
 */
export function formatBuddyActivity(activities: any[]): string {
  if (activities.length === 0) return '';

  const lines = activities.map((a: any) => {
    const name = a.buddy_name || 'Buddy';
    switch (a.activity_type) {
      case 'xp_earned':
        return `📊 ${name} baru aja dapet XP!`;
      case 'streak_milestone':
        return `🔥 ${name} streak ${a.activity_data.streak || '?'} hari!`;
      case 'badge_unlocked':
        return `🏅 ${name} unlock badge baru!`;
      case 'boss_battle_won':
        return `⚔️ ${name} menang Boss Battle!`;
      case 'buddy_accepted':
        return `🤝 Kalian sekarang study buddies!`;
      default:
        return `📊 ${name} baru aja aktif belajar.`;
    }
  });

  return `*Activity Buddies:*\n${lines.join('\n')}`;
}
