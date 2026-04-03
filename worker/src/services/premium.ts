import type { Env, User } from '../types';

const DAILY_QUESTION_LIMIT = 10;
const REFERRAL_BONUS_PER_INVITE = 5;

export interface PremiumInfo {
  is_premium: boolean;
  is_founding_student: boolean;
  trial_ends: string | null;
  days_remaining: number | null;
}

// Check if user has premium access
export async function checkPremium(env: Env, userId: number): Promise<PremiumInfo> {
  const user = await env.DB.prepare(
    'SELECT is_premium, premium_until, is_founding_student FROM users WHERE id = ?'
  ).bind(userId).first() as any;

  if (!user) {
    return { is_premium: false, is_founding_student: false, trial_ends: null, days_remaining: null };
  }

  // Founding students always have premium
  if (user.is_founding_student) {
    return { is_premium: true, is_founding_student: true, trial_ends: null, days_remaining: null };
  }

  // Check if premium is active
  if (user.is_premium && user.premium_until) {
    const now = new Date();
    const until = new Date(user.premium_until);
    if (until > now) {
      const daysRemaining = Math.ceil((until.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        is_premium: true,
        is_founding_student: false,
        trial_ends: user.premium_until,
        days_remaining: daysRemaining,
      };
    }
  }

  return {
    is_premium: false,
    is_founding_student: false,
    trial_ends: user.premium_until || null,
    days_remaining: 0,
  };
}

// Mark a user as premium (extends existing premium if not expired)
export async function grantPremium(env: Env, userId: number, days: number): Promise<void> {
  // Get current premium_until to extend instead of overwrite
  const current = await env.DB.prepare(
    'SELECT premium_until FROM users WHERE id = ?'
  ).bind(userId).first() as any;

  let expiresAt = new Date();
  if (current?.premium_until) {
    const existing = new Date(current.premium_until);
    if (existing > expiresAt) {
      expiresAt = existing;
    }
  }
  expiresAt.setDate(expiresAt.getDate() + days);

  await env.DB.prepare(
    'UPDATE users SET is_premium = 1, premium_until = ? WHERE id = ?'
  ).bind(expiresAt.toISOString(), userId).run();
}

// Mark existing users (who have chatted) as founding students (free forever)
export async function markFoundingStudents(env: Env): Promise<number> {
  // Get users who have conversation messages (chatted with bot)
  const result = await env.DB.prepare(
    `UPDATE users SET is_premium = 1, premium_until = '2099-12-31', is_founding_student = 1
     WHERE id IN (
       SELECT DISTINCT user_id FROM conversation_messages
       WHERE user_id IS NOT NULL
     ) AND is_founding_student = 0`
  ).run();

  return result.meta?.changes || 0;
}

// Generate unique referral code
export function generateReferralCode(userId: number): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `ref_${userId}_${timestamp}_${random}`;
}

// Grant referral reward to referrer when referee becomes paid
export async function grantReferralReward(env: Env, refereeId: number, refereeDays: number, botToken?: string): Promise<void> {
  const referee = await env.DB.prepare(
    'SELECT referred_by FROM users WHERE id = ?'
  ).bind(refereeId).first() as any;

  if (!referee?.referred_by) return;

  const referrer = await env.DB.prepare(
    'SELECT id, referral_count, is_premium FROM users WHERE id = ?'
  ).bind(referee.referred_by).first() as any;

  if (!referrer) return;

  // Calculate reward days based on current referral count BEFORE this payment
  // Reward is based on cumulative paid referrals
  const rewardDays = getReferralRewardDays(referrer.referral_count);

  if (rewardDays > 0) {
    await grantPremium(env, referrer.id, rewardDays);

    // Update reward status in referral_rewards
    await env.DB.prepare(
      `UPDATE referral_rewards SET status = 'earned', reward_days = ?, applied_at = datetime('now')
       WHERE referrer_id = ? AND referee_id = ? AND status = 'pending'`
    ).bind(rewardDays, referrer.id, refereeId).run();

    // Notify referrer if botToken provided
    if (botToken) {
      const referrerTg = await env.DB.prepare('SELECT telegram_id, name FROM users WHERE id = ?').bind(referrer.id).first() as any;
      if (referrerTg?.telegram_id) {
        const tgId = parseInt(String(referrerTg.telegram_id).replace('.0', ''));
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgId,
            text: `🎁 *Referral Reward!*\n\n` +
              `Teman kamu sudah bayar!\n` +
              `Kamu dapat ${rewardDays} hari premium gratis!\n\n` +
              `Total referral berbayar: ${referrer.referral_count}\n` +
              `Ketik /referral untuk lihat detail.`
          }),
        });
      }
    }
  }
}

// Get referral reward amount (in days)
export function getReferralRewardDays(refereeCount: number): number {
  if (refereeCount >= 5) return 30; // 1 month
  if (refereeCount >= 3) return 7; // 1 week
  if (refereeCount >= 1) return 3; // 3 days
  return 1; // 1 day
}

// Calculate teacher subscription price based on student count
export function calculateTeacherPrice(env: Env, studentCount: number): number {
  // Get pricing tiers
  const tiers = [
    { min: 51, max: 9999, price: 500000 }, // Flat rate for 51+ students
    { min: 31, max: 50, price: 30000 },
    { min: 11, max: 30, price: 40000 },
    { min: 1, max: 10, price: 50000 },
  ];

  for (const tier of tiers) {
    if (studentCount >= tier.min && studentCount <= tier.max) {
      return tier.price;
    }
  }

  return 500000; // Default to max tier
}

// Format price in IDR
export function formatPrice(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

// Telegram Stars conversion (approximate)
// 100 Stars ≈ $0.50 USD ≈ Rp 8,000
export function starsToIdr(stars: number): number {
  return Math.round(stars * 80); // Rp 80 per Star
}

export function idrToStars(idr: number): number {
  return Math.ceil(idr / 80);
}

// Verify Telegram payment webhook signature
// For external payment provider callbacks (not Telegram direct payments)
export async function verifyPaymentWebhook(
  botToken: string,
  payload: Record<string, string>
): Promise<boolean> {
  const { hash, ...fields } = payload;
  if (!hash) return false;

  // Sort fields alphabetically
  const sortedKeys = Object.keys(fields).sort();
  // Build data-check-string: key=value\n for each pair
  const dataCheckString = sortedKeys
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');

  // Create HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(botToken),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(dataCheckString));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signatureHex === hash;
}

export interface TestAccessInfo {
  allowed: boolean;
  is_premium: boolean;
  daily_limit: number;
  used_today: number;
  bonus_quota: number;
  remaining: number;
  reset_at: string; // ISO datetime when daily count resets
}

// Check if user can take a test question today
export async function checkTestAccess(env: Env, userId: number): Promise<TestAccessInfo> {
  const premium = await checkPremium(env, userId);

  if (premium.is_premium) {
    return {
      allowed: true,
      is_premium: true,
      daily_limit: -1, // unlimited
      used_today: 0,
      bonus_quota: 0,
      remaining: -1,
      reset_at: '',
    };
  }

  // Get today's date string (WIB = UTC+7)
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibNow = new Date(now.getTime() + wibOffset);
  const todayStr = wibNow.toISOString().split('T')[0]; // YYYY-MM-DD

  // Calculate reset time (midnight WIB = 17:00 UTC)
  const resetAt = new Date(wibNow);
  resetAt.setUTCHours(17, 0, 0, 0);
  if (resetAt <= now) {
    resetAt.setDate(resetAt.getDate() + 1);
  }

  // Get or create today's log
  const todayLog = await env.DB.prepare(
    'SELECT * FROM daily_question_logs WHERE user_id = ? AND question_date = ?'
  ).bind(userId, todayStr).first() as any;

  const usedToday = todayLog?.questions_answered || 0;
  const bonusUsed = todayLog?.bonus_used || 0;

  // Get referral bonus quota
  const bonusRow = await env.DB.prepare(
    'SELECT bonus_questions FROM referral_bonus_quota WHERE user_id = ?'
  ).bind(userId).first() as any;
  const bonusQuota = Math.max(0, (bonusRow?.bonus_questions || 0) - bonusUsed);

  const effectiveRemaining = DAILY_QUESTION_LIMIT - usedToday + bonusQuota;

  return {
    allowed: effectiveRemaining > 0,
    is_premium: false,
    daily_limit: DAILY_QUESTION_LIMIT,
    used_today: usedToday,
    bonus_quota: bonusQuota,
    remaining: Math.max(0, effectiveRemaining),
    reset_at: resetAt.toISOString(),
  };
}

// Track a question answered by user
export async function trackQuestionAnswer(env: Env, userId: number): Promise<{ success: boolean; remaining: number; error?: string }> {
  const access = await checkTestAccess(env, userId);

  if (!access.allowed) {
    return {
      success: false,
      remaining: 0,
      error: 'Daily limit reached. Upgrade to premium for unlimited access.',
    };
  }

  if (access.is_premium) {
    return { success: true, remaining: -1 };
  }

  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibNow = new Date(now.getTime() + wibOffset);
  const todayStr = wibNow.toISOString().split('T')[0];

  // Check if using bonus quota or daily limit
  const usedDaily = access.used_today;
  const usingBonus = usedDaily >= DAILY_QUESTION_LIMIT;

  if (usingBonus) {
    // Decrement bonus quota
    await env.DB.prepare(
      `UPDATE referral_bonus_quota 
       SET bonus_questions = MAX(0, bonus_questions - 1), updated_at = datetime('now')
       WHERE user_id = ?`
    ).bind(userId).run();

    // Increment bonus_used in daily log
    await env.DB.prepare(
      `INSERT INTO daily_question_logs (user_id, question_date, questions_answered, bonus_used)
       VALUES (?, ?, 1, 1)
       ON CONFLICT(user_id, question_date) DO UPDATE SET
         questions_answered = questions_answered + 1,
         bonus_used = bonus_used + 1`
    ).bind(userId, todayStr).run();
  } else {
    // Regular daily usage
    await env.DB.prepare(
      `INSERT INTO daily_question_logs (user_id, question_date, questions_answered)
       VALUES (?, ?, 1)
       ON CONFLICT(user_id, question_date) DO UPDATE SET
         questions_answered = questions_answered + 1`
    ).bind(userId, todayStr).run();
  }

  // Recalculate remaining
  const newAccess = await checkTestAccess(env, userId);
  return { success: true, remaining: newAccess.remaining };
}

// Grant bonus questions to a user from referral signups
export async function grantReferralBonusQuota(env: Env, userId: number, bonusQuestions: number): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO referral_bonus_quota (user_id, bonus_questions, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       bonus_questions = bonus_questions + ?,
       updated_at = datetime('now')`
  ).bind(userId, bonusQuestions, bonusQuestions).run();
}
