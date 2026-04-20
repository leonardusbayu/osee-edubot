/**
 * Payment Routes — Tripay Integration
 *
 * Endpoints:
 * - POST /api/payment/create        — Create a new Tripay transaction
 * - POST /api/payment/tripay/callback — Receive payment notifications from Tripay
 * - GET  /api/payment/status/:ref   — Check transaction status
 * - GET  /api/payment/channels      — List active payment channels
 * - GET  /api/payment/history       — User's payment history
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';
import {
  createTransaction,
  verifyCallbackSignature,
  parseMerchantRef,
  getPaymentChannels,
  getTransactionDetail,
  TRIPAY_PLANS,
} from '../services/tripay';
import { grantPremium, grantReferralReward } from '../services/premium';

export const paymentRoutes = new Hono<{ Bindings: Env }>();

// ── Create Transaction ──────────────────────────────────────────────
paymentRoutes.post('/create', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json().catch(() => ({}));
  const planKey = body.plan as string; // 'plan_7', 'plan_30', etc.
  const method = body.method as string; // 'QRIS', 'BRIVA', etc.

  if (!planKey || !TRIPAY_PLANS[planKey]) {
    return c.json({ error: 'Invalid plan. Choose: ' + Object.keys(TRIPAY_PLANS).join(', ') }, 400);
  }
  if (!method) {
    return c.json({ error: 'Payment method required (e.g. QRIS, BRIVA, BCAVA)' }, 400);
  }

  // Create Tripay transaction
  const result = await createTransaction(c.env, {
    userId: user.id,
    userName: user.name || `User ${user.id}`,
    planKey,
    method,
  });

  if (!result.success || !result.data) {
    return c.json({ error: result.error || 'Failed to create transaction' }, 500);
  }

  const tx = result.data;
  const plan = TRIPAY_PLANS[planKey];

  // Save to database
  try {
    await c.env.DB.prepare(
      `INSERT INTO payment_transactions
       (user_id, merchant_ref, tripay_reference, payment_method, payment_name,
        amount, fee_merchant, fee_customer, status, plan_days,
        pay_code, checkout_url, expired_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user.id,
      tx.merchant_ref,
      tx.reference,
      tx.payment_method,
      tx.payment_name,
      tx.amount,
      tx.fee_merchant,
      tx.fee_customer,
      tx.status, // 'UNPAID'
      plan.days,
      tx.pay_code || null,
      tx.checkout_url,
      tx.expired_time ? new Date(tx.expired_time * 1000).toISOString() : null,
    ).run();
  } catch (e: any) {
    console.error('[payment] DB insert error:', e.message);
    // Transaction was created on Tripay side, so still return it
  }

  return c.json({
    success: true,
    data: {
      reference: tx.reference,
      merchant_ref: tx.merchant_ref,
      payment_method: tx.payment_method,
      payment_name: tx.payment_name,
      amount: tx.amount,
      pay_code: tx.pay_code,
      checkout_url: tx.checkout_url,
      qr_url: tx.qr_url,
      qr_string: tx.qr_string,
      status: tx.status,
      expired_time: tx.expired_time,
      instructions: tx.instructions,
    },
  });
});

// ── Tripay Callback ─────────────────────────────────────────────────
// Called by Tripay server when payment status changes.
// NO authentication — verified via HMAC signature.
paymentRoutes.post('/tripay/callback', async (c) => {
  const privateKey = c.env.TRIPAY_PRIVATE_KEY;
  if (!privateKey) {
    console.error('[tripay-callback] Private key not configured');
    return c.json({ success: false, message: 'Server misconfigured' }, 500);
  }

  // Get raw body for signature verification
  const rawBody = await c.req.text();
  const callbackSignature = c.req.header('X-Callback-Signature') || '';

  // Verify signature
  const isValid = await verifyCallbackSignature(privateKey, rawBody, callbackSignature);
  if (!isValid) {
    console.error('[tripay-callback] Invalid signature');
    return c.json({ success: false, message: 'Invalid signature' }, 403);
  }

  // Check callback event type
  const callbackEvent = c.req.header('X-Callback-Event') || '';
  if (callbackEvent !== 'payment_status') {
    console.log('[tripay-callback] Ignoring event:', callbackEvent);
    return c.json({ success: true });
  }

  // Parse callback data
  let data: any;
  try {
    data = JSON.parse(rawBody);
  } catch {
    return c.json({ success: false, message: 'Invalid JSON' }, 400);
  }

  const merchantRef = data.merchant_ref as string;
  const tripayReference = data.reference as string;
  const status = (data.status as string || '').toUpperCase();

  if (!merchantRef) {
    return c.json({ success: false, message: 'Missing merchant_ref' }, 400);
  }

  // Parse user info from merchant_ref: EDU-{userId}-{days}-{timestamp}
  const parsed = parseMerchantRef(merchantRef);
  if (!parsed) {
    console.error('[tripay-callback] Cannot parse merchant_ref:', merchantRef);
    return c.json({ success: false, message: 'Invalid merchant_ref format' }, 400);
  }

  const { userId, days } = parsed;

  // Idempotency check
  const existing = await c.env.DB.prepare(
    'SELECT id, status FROM payment_transactions WHERE merchant_ref = ? LIMIT 1'
  ).bind(merchantRef).first() as any;

  if (existing && existing.status === 'PAID') {
    console.log('[tripay-callback] Already processed:', merchantRef);
    return c.json({ success: true });
  }

  // Handle status
  switch (status) {
    case 'PAID': {
      // Grant premium
      await grantPremium(c.env, userId, days);

      // Update payment_transactions
      if (existing) {
        await c.env.DB.prepare(
          `UPDATE payment_transactions SET status = 'PAID', paid_at = datetime('now'),
           tripay_reference = COALESCE(?, tripay_reference) WHERE merchant_ref = ?`
        ).bind(tripayReference, merchantRef).run();
      }

      // Log to star_transactions for unified payment history
      await c.env.DB.prepare(
        'INSERT INTO star_transactions (user_id, amount, type, description, payment_id) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, days * 100, 'purchase', `Premium ${days} days via Tripay`, merchantRef).run();

      // Grant referral reward if applicable
      try {
        await grantReferralReward(c.env, userId, days, c.env.TELEGRAM_BOT_TOKEN);
      } catch (e) {
        console.error('[tripay-callback] Referral reward error:', e);
      }

      // Notify user via Telegram
      try {
        const user = await c.env.DB.prepare(
          'SELECT telegram_id, premium_until FROM users WHERE id = ?'
        ).bind(userId).first() as any;

        if (user?.telegram_id) {
          const tgId = parseInt(String(user.telegram_id).replace('.0', ''));
          const expiresDate = user.premium_until
            ? new Date(user.premium_until).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric',
              })
            : 'Unknown';

          await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: tgId,
              text: `🎉 *Pembayaran Berhasil!*\n\n` +
                `✅ Premium ${days} hari sudah aktif!\n` +
                `📅 Berlaku sampai: ${expiresDate}\n\n` +
                `Selamat belajar! Ketik /premium untuk cek status.`,
              parse_mode: 'Markdown',
            }),
          });
        }
      } catch (e) {
        console.error('[tripay-callback] Telegram notification error:', e);
      }

      break;
    }

    case 'EXPIRED': {
      if (existing) {
        await c.env.DB.prepare(
          `UPDATE payment_transactions SET status = 'EXPIRED' WHERE merchant_ref = ?`
        ).bind(merchantRef).run();
      }
      break;
    }

    case 'FAILED': {
      if (existing) {
        await c.env.DB.prepare(
          `UPDATE payment_transactions SET status = 'FAILED' WHERE merchant_ref = ?`
        ).bind(merchantRef).run();
      }
      break;
    }

    default:
      console.warn('[tripay-callback] Unknown status:', status);
  }

  return c.json({ success: true });
});

// ── Check Transaction Status ────────────────────────────────────────
paymentRoutes.get('/status/:reference', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const reference = c.req.param('reference');

  // Check local DB first
  const local = await c.env.DB.prepare(
    'SELECT * FROM payment_transactions WHERE tripay_reference = ? AND user_id = ? LIMIT 1'
  ).bind(reference, user.id).first() as any;

  if (!local) {
    return c.json({ error: 'Transaction not found' }, 404);
  }

  // If still unpaid, check Tripay for latest status
  if (local.status === 'UNPAID') {
    const detail = await getTransactionDetail(c.env, reference);
    if (detail.success && detail.data) {
      const newStatus = (detail.data.status || '').toUpperCase();
      if (newStatus !== local.status) {
        await c.env.DB.prepare(
          'UPDATE payment_transactions SET status = ? WHERE id = ?'
        ).bind(newStatus, local.id).run();
        local.status = newStatus;
      }
    }
  }

  return c.json({
    reference: local.tripay_reference,
    merchant_ref: local.merchant_ref,
    payment_method: local.payment_method,
    payment_name: local.payment_name,
    amount: local.amount,
    status: local.status,
    plan_days: local.plan_days,
    pay_code: local.pay_code,
    checkout_url: local.checkout_url,
    expired_at: local.expired_at,
    paid_at: local.paid_at,
    created_at: local.created_at,
  });
});

// ── List Payment Channels ───────────────────────────────────────────
paymentRoutes.get('/channels', async (c) => {
  const result = await getPaymentChannels(c.env);
  if (!result.success) {
    return c.json({ error: result.error }, 500);
  }

  // Filter to only active channels and return simplified data
  const channels = (result.data || [])
    .filter((ch) => ch.active)
    .map((ch) => ({
      code: ch.code,
      name: ch.name,
      group: ch.group,
      type: ch.type,
      icon_url: ch.icon_url,
      fee: ch.total_fee,
      min_amount: ch.minimum_amount,
      max_amount: ch.maximum_amount,
    }));

  return c.json({ channels });
});

// ── Payment History ─────────────────────────────────────────────────
paymentRoutes.get('/history', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const transactions = await c.env.DB.prepare(
    `SELECT merchant_ref, tripay_reference, payment_method, payment_name,
            amount, status, plan_days, paid_at, created_at
     FROM payment_transactions
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 20`
  ).bind(user.id).all();

  return c.json({ transactions: transactions.results || [] });
});

// ── Available Plans ─────────────────────────────────────────────────
paymentRoutes.get('/plans', async (c) => {
  const plans = Object.entries(TRIPAY_PLANS).map(([key, plan]) => ({
    key,
    days: plan.days,
    amount: plan.amount,
    label: plan.label,
    formatted: `Rp ${plan.amount.toLocaleString('id-ID')}`,
  }));
  return c.json({ plans });
});
