import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';
import { checkPremium, grantPremium, starsToIdr, idrToStars, verifyPaymentWebhook } from '../services/premium';

export const premiumRoutes = new Hono<{ Bindings: Env }>();

// Get premium status for current user
premiumRoutes.get('/status', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const info = await checkPremium(c.env, user.id);
  return c.json({
    is_premium: info.is_premium,
    is_founding_student: info.is_founding_student,
    trial_ends: info.trial_ends,
    days_remaining: info.days_remaining,
  });
});

// Get purchase options (in Stars)
premiumRoutes.get('/options', async (c) => {
  const options = [
    { days: 7, stars: 375, label: '1 Week' },
    { days: 30, stars: 1238, label: '1 Month' },
    { days: 90, stars: 3375, label: '3 Months' },
    { days: 180, stars: 6250, label: '6 Months' },
    { days: 365, stars: 11875, label: '1 Year' },
  ];
  return c.json({ options });
});

// External payment provider webhook callback
// For Telegram Stars payments, the actual confirmation comes via webhook update (successful_payment)
// This endpoint is for external payment aggregator webhooks
premiumRoutes.post('/stars/callback', async (c) => {
  try {
    // Verify Telegram secret header (if configured) OR require signed hash
    const telegramSecret = c.req.header('x-telegram-bot-api-secret-token');
    const expectedSecret = c.env.TELEGRAM_BOT_SECRET;
    const hasValidSecretHeader = !!(expectedSecret && telegramSecret === expectedSecret);

    const payload = await c.req.json();
    const botToken = c.env.TELEGRAM_BOT_TOKEN;

    // Require either a valid Telegram secret header OR a valid HMAC hash
    if (!hasValidSecretHeader) {
      if (!payload.hash) {
        console.error('Payment webhook rejected: missing both secret header and hash');
        return c.json({ error: 'Unauthorized' }, 401);
      }
      const isValid = await verifyPaymentWebhook(botToken, payload);
      if (!isValid) {
        console.error('Invalid payment webhook signature');
        return c.json({ error: 'Invalid signature' }, 403);
      }
    }

    // Extract user_id and days from invoice_payload
    // Format in sendInvoice payload: "premium_{userId}_{days}_{timestamp}"
    const invoicePayload = payload.invoice_payload || payload.payload || '';
    const parts = invoicePayload.split('_');
    
    let userId = 0;
    let days = 0;

    // Try to parse from payload format: premium_{userId}_{days}_{timestamp}
    if (parts.length >= 3) {
      userId = parseInt(parts[1] || '0');
      days = parseInt(parts[2] || '0');
    }

    // Fallback: try to parse from receipt_message if present
    if (!userId || !days) {
      const receiptText = payload.receipt_message?.text || payload.receipt?.text || '';
      const daysMatch = receiptText.match(/(\d+)\s*days?/i);
      if (daysMatch) {
        days = parseInt(daysMatch[1]);
      }
      const userIdMatch = invoicePayload.match(/user_(\d+)/);
      if (userIdMatch) {
        userId = parseInt(userIdMatch[1]);
      }
    }

    if (!userId || !days) {
      console.error('Failed to parse payment payload:', JSON.stringify(payload));
      return c.json({ error: 'Invalid payload format' }, 400);
    }

    // Idempotency: use telegram_payment_charge_id or provider_payment_charge_id, fall back to payload string
    const paymentId = payload.telegram_payment_charge_id
      || payload.provider_payment_charge_id
      || payload.payment_id
      || invoicePayload;

    if (paymentId) {
      const existing = await c.env.DB.prepare(
        'SELECT id FROM star_transactions WHERE payment_id = ? LIMIT 1'
      ).bind(paymentId).first();
      if (existing) {
        console.log('Duplicate payment webhook, already processed:', paymentId);
        return c.json({ success: true, duplicate: true });
      }
    }

    // Grant premium (extends existing if active)
    await grantPremium(c.env, userId, days);

    // Log transaction with payment_id for idempotency
    await c.env.DB.prepare(
      'INSERT INTO star_transactions (user_id, amount, type, description, payment_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, days * 100, 'purchase', `Premium ${days} days via webhook`, paymentId || null).run();

    return c.json({ success: true });
  } catch (e: any) {
    console.error('Stars callback error:', e);
    return c.json({ error: 'Premium service error' }, 500);
  }
});

// Check if user can use a premium feature
premiumRoutes.post('/check', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const info = await checkPremium(c.env, user.id);
  
  if (!info.is_premium) {
    return c.json({
      allowed: false,
      message: `Trial expired. Upgrade to continue!\n\nPrices:\n7 days = 90 ⭐\n30 days = 350 ⭐\n\nKetik /premium untuk beli.`,
      trial_ends: info.trial_ends,
    });
  }

  return c.json({ allowed: true });
});

// Get teacher's referral info
premiumRoutes.get('/referral', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const userData = await c.env.DB.prepare(
    'SELECT referral_code, referral_count FROM users WHERE id = ?'
  ).bind(user.id).first() as any;

  if (!userData?.referral_code) {
    // Generate if missing
    const code = `ref_${user.id}_${Date.now().toString(36)}`;
    await c.env.DB.prepare(
      'UPDATE users SET referral_code = ? WHERE id = ?'
    ).bind(code, user.id).run();
    userData.referral_code = code;
  }

  // Get referral link
  const botUsername = 'YourBotUsername'; // Configure this
  const referralLink = `https://t.me/${botUsername}?start=${userData.referral_code}`;

  return c.json({
    code: userData.referral_code,
    link: referralLink,
    count: userData.referral_count || 0,
    rewards: [
      { referrals: 1, reward: '3 days free' },
      { referrals: 3, reward: '1 week free' },
      { referrals: 5, reward: '1 month free' },
    ],
  });
});

// Apply referral code (when new user signs up via link)
premiumRoutes.post('/referral/apply', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { code } = await c.req.json();
  if (!code) return c.json({ error: 'Code required' }, 400);

  // Check if user already applied a referral
  if (user.referred_by) {
    return c.json({ error: 'Already used a referral code' }, 400);
  }

  // Find referrer by code
  const referrer = await c.env.DB.prepare(
    'SELECT id FROM users WHERE referral_code = ?'
  ).bind(code).first() as any;

  if (!referrer) {
    return c.json({ error: 'Invalid referral code' }, 404);
  }

  // Can't refer yourself
  if (referrer.id === user.id) {
    return c.json({ error: 'Cannot use your own referral code' }, 400);
  }

  // Update referrer's count
  await c.env.DB.prepare(
    'UPDATE users SET referral_count = referral_count + 1 WHERE id = ?'
  ).bind(referrer.id).run();

  // Update referee
  await c.env.DB.prepare(
    'UPDATE users SET referred_by = ? WHERE id = ?'
  ).bind(referrer.id, user.id).run();

  // Create pending reward record
  await c.env.DB.prepare(
    'INSERT INTO referral_rewards (referrer_id, referee_id, reward_type, reward_days, status) VALUES (?, ?, ?, ?, ?)'
  ).bind(referrer.id, user.id, 'pending', 0, 'pending').run();

  return c.json({ success: true, message: 'Referral code applied! Referrer will get rewards when you become a paid user.' });
});

// Get teacher subscription status and pricing
premiumRoutes.get('/teacher/status', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  if (user.role !== 'teacher' && user.role !== 'admin') {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  const sub = await c.env.DB.prepare(
    'SELECT * FROM teacher_subscriptions WHERE teacher_id = ?'
  ).bind(user.id).first() as any;

  if (!sub) {
    // Create new trial subscription
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 7);
    
    await c.env.DB.prepare(
      'INSERT INTO teacher_subscriptions (teacher_id, status, trial_ends) VALUES (?, ?, ?)'
    ).bind(user.id, 'trial', trialEnds.toISOString()).run();

    return c.json({
      status: 'trial',
      trial_ends: trialEnds.toISOString(),
      student_count: 0,
      days_remaining: 7,
    });
  }

  const now = new Date();
  let daysRemaining = 0;
  
  if (sub.status === 'trial' && sub.trial_ends) {
    const trialEnd = new Date(sub.trial_ends);
    daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  return c.json({
    status: sub.status,
    trial_ends: sub.trial_ends,
    subscribed_at: sub.subscribed_at,
    expires_at: sub.expires_at,
    student_count: sub.student_count || 0,
    monthly_rate: sub.monthly_rate || 0,
    days_remaining: daysRemaining > 0 ? daysRemaining : 0,
  });
});

// Teacher purchase subscription (Stars)
premiumRoutes.post('/teacher/subscribe', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { months, stars } = await c.req.json();
  if (!months || !stars) return c.json({ error: 'Invalid request' }, 400);

  // Verify teacher role
  if (user.role !== 'teacher' && user.role !== 'admin') {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  // Update subscription
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + months);

  await c.env.DB.prepare(
    `UPDATE teacher_subscriptions 
     SET status = 'active', subscribed_at = datetime('now'), expires_at = ?, monthly_rate = ?
     WHERE teacher_id = ?`
  ).bind(expiresAt.toISOString(), stars, user.id).run();

  // Log transaction
  await c.env.DB.prepare(
    'INSERT INTO star_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)'
  ).bind(user.id, stars, 'payment', `Teacher subscription ${months} months`).run();

  return c.json({ success: true, expires_at: expiresAt.toISOString() });
});
