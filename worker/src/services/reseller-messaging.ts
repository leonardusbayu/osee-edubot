/**
 * Reseller messaging — per-customer 7-day rate limit + per-reseller
 * 3-broadcasts-per-day cap. Each "send" is a broadcast that may go to
 * one or many customers; we record one row per recipient for history
 * and rate-limiting.
 *
 * Anti-spam strategy:
 *   - Reseller can send at most 3 broadcasts per day
 *   - Each customer receives at most 1 broadcast from a given reseller
 *     per 7 days
 *   - Both limits are enforced via row-count queries (cheap)
 *
 * Future improvement: spam-word detection, max-message-length, etc.
 */

import type { Env } from '../types';

const MAX_BROADCASTS_PER_DAY = 3;
const PER_CUSTOMER_COOLDOWN_DAYS = 7;

export interface MessageTarget {
  customer_id: number;
  customer_telegram_id: string;
  customer_name: string;
  // optional pre-filter: skip customers who have had a message in the
  // last PER_CUSTOMER_COOLDOWN_DAYS
  last_messaged_at?: string | null;
}

export interface SendResult {
  broadcast_id: string;
  attempted: number;        // total customers we tried to send to
  sent: number;            // actually sent (after rate-limit filter)
  rate_limited: number;     // skipped due to per-customer cooldown
  telegram_errors: number;  // Telegram API returned non-OK
  blocked_by_daily_cap: boolean;  // true if reseller hit the 3/day limit
}

/**
 * Send a broadcast message to a list of customers. Enforces both rate
 * limits (per-customer 7-day + per-reseller 3/day). Returns counts so
 * the dashboard can show "Sent to N, skipped M".
 */
export async function sendResellerBroadcast(
  env: Env,
  args: {
    resellerId: number;
    message: string;
    targets: MessageTarget[];
    botToken: string;
  }
): Promise<SendResult> {
  const broadcastId = `bcast_${args.resellerId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Validate message
  const trimmed = args.message.trim();
  if (!trimmed) {
    return { broadcast_id: broadcastId, attempted: 0, sent: 0, rate_limited: 0, telegram_errors: 0, blocked_by_daily_cap: false };
  }
  if (trimmed.length > 1000) {
    throw new Error('Pesan terlalu panjang. Maks 1000 karakter.');
  }

  // 1) Check reseller's daily broadcast cap
  const todayStart = new Date(new Date().toISOString().split('T')[0]).toISOString();
  const todayCount = await env.DB.prepare(
    `SELECT COUNT(DISTINCT broadcast_id) as cnt
     FROM reseller_messages
     WHERE reseller_id = ? AND sent_at >= ?`
  ).bind(args.resellerId, todayStart).first<{ cnt: number }>();
  const alreadySentToday = todayCount?.cnt || 0;

  if (alreadySentToday >= MAX_BROADCASTS_PER_DAY) {
    return {
      broadcast_id: broadcastId,
      attempted: args.targets.length,
      sent: 0,
      rate_limited: 0,
      telegram_errors: 0,
      blocked_by_daily_cap: true,
    };
  }

  // 2) Filter targets by per-customer cooldown
  const cooldownCutoff = new Date(Date.now() - PER_CUSTOMER_COOLDOWN_DAYS * 24 * 3600 * 1000).toISOString();
  const eligible: MessageTarget[] = [];
  let rateLimited = 0;
  for (const t of args.targets) {
    if (t.last_messaged_at && t.last_messaged_at > cooldownCutoff) {
      rateLimited++;
      continue;
    }
    // Double-check from DB to avoid race conditions
    const recent = await env.DB.prepare(
      `SELECT id FROM reseller_messages
       WHERE reseller_id = ? AND customer_id = ? AND sent_at >= ?`
    ).bind(args.resellerId, t.customer_id, cooldownCutoff).first();
    if (recent) {
      rateLimited++;
      continue;
    }
    eligible.push(t);
  }

  // 3) Send via Telegram
  const sentMessages: { customer_id: number; telegram_id: string }[] = [];
  let telegramErrors = 0;
  for (const t of eligible) {
    const tgId = String(t.customer_telegram_id).replace('.0', '');
    if (!tgId) {
      telegramErrors++;
      continue;
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${args.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgId,
          text: trimmed,
          parse_mode: 'Markdown',
        }),
      });
      if (res.ok) {
        sentMessages.push({ customer_id: t.customer_id, telegram_id: tgId });
      } else {
        telegramErrors++;
      }
    } catch {
      telegramErrors++;
    }
  }

  // 4) Log to DB
  for (const m of sentMessages) {
    await env.DB.prepare(
      `INSERT INTO reseller_messages (reseller_id, customer_id, message_text, broadcast_id)
       VALUES (?, ?, ?, ?)`
    ).bind(args.resellerId, m.customer_id, trimmed, broadcastId).run();
  }

  return {
    broadcast_id: broadcastId,
    attempted: args.targets.length,
    sent: sentMessages.length,
    rate_limited: rateLimited,
    telegram_errors: telegramErrors,
    blocked_by_daily_cap: false,
  };
}

/**
 * Get the last message sent from a reseller to a specific customer.
 * Returns null if no message has ever been sent.
 */
export async function getLastMessageSent(
  env: Env,
  args: { resellerId: number; customerId: number }
): Promise<{ sent_at: string; message_text: string } | null> {
  const row = await env.DB.prepare(
    `SELECT sent_at, message_text FROM reseller_messages
     WHERE reseller_id = ? AND customer_id = ?
     ORDER BY sent_at DESC LIMIT 1`
  ).bind(args.resellerId, args.customerId).first<{ sent_at: string; message_text: string }>();
  return row || null;
}

/**
 * Get the most recent N messages a reseller has sent (across all
 * customers). Used by the dashboard's "history" view.
 */
export async function getResellerMessageHistory(
  env: Env,
  resellerId: number,
  limit: number = 50
): Promise<any[]> {
  const rows = await env.DB.prepare(
    `SELECT m.sent_at, m.broadcast_id, m.message_text,
            u.id as customer_id, u.name as customer_name, u.telegram_id as customer_telegram_id
     FROM reseller_messages m
     JOIN users u ON u.id = m.customer_id
     WHERE m.reseller_id = ?
     ORDER BY m.sent_at DESC
     LIMIT ?`
  ).bind(resellerId, limit).all<any>();
  return rows.results || [];
}
