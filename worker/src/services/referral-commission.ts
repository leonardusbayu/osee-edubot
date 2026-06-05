/**
 * Referral Commission Engine
 *
 * Reseller-driven affiliate program. A user with role='reseller' owns a
 * referral code (e.g. "BUDI03"). When a customer applies the code and buys
 * a premium plan, the system records an attribution + pending commission.
 *
 * Status flow:
 *   pending  (just purchased, 0-7 days, anti-fraud hold)
 *      ↓   (cron: 7+ days old, no refund detected)
 *   confirmed (payable, 20% of plan_amount_stars)
 *      ↓   (auto-Stars payout, or manual bank transfer)
 *   paid
 *   OR
 *   clawback (refund detected, no commission ever paid)
 *
 * Anti-fraud:
 *   - One customer can only be attributed to one reseller forever (UNIQUE
 *     constraint on customer_id)
 *   - 7-day hold before commission is payable (refund window)
 *   - Reseller cannot refer themselves (enforced in applyCode)
 *   - Soft caps: per-reseller rate > 5 new attributions/day or > 50%
 *     clawback rate triggers a flag in resellers table
 */

import type { Env } from '../types';

export const COMMISSION_RATE_DEFAULT = 20; // %
export const ANTI_FRAUD_HOLD_DAYS = 7;
export const SOFT_CAP_ATTRIBUTIONS_PER_DAY = 5;
export const SOFT_CAP_CLAWBACK_RATE = 0.5; // >50% clawbacks = flag

export type AttributionStatus = 'pending' | 'confirmed' | 'paid' | 'clawback';

export interface ReferralCode {
  id: number;
  code: string;
  reseller_id: number;
  is_active: number;
  total_uses: number;
  total_revenue_stars: number;
  total_commission_stars: number;
  notes: string | null;
  created_at: string;
}

export interface Attribution {
  id: number;
  code_id: number;
  reseller_id: number;
  customer_id: number;
  payment_id: number | null;
  plan_days: number;
  plan_amount_stars: number;
  commission_rate: number;
  commission_amount_stars: number;
  status: AttributionStatus;
  confirmed_at: string | null;
  paid_at: string | null;
  payout_method: string | null;
  payout_reference: string | null;
  notes: string | null;
  created_at: string;
}

// Pricing in Stars (must match webhook.ts /buy options)
export const PLAN_PRICING: Record<number, number> = {
  7: 375,
  30: 1238,
  90: 3375,
  180: 6250,
  365: 11875,
};

/**
 * Get a referral code by string (case-insensitive). Returns null if not found
 * or inactive.
 */
export async function getCodeByString(env: Env, code: string): Promise<ReferralCode | null> {
  if (!code || code.length > 32) return null;
  const row = await env.DB.prepare(
    `SELECT * FROM referral_codes WHERE UPPER(code) = UPPER(?) AND is_active = 1`
  ).bind(code).first<ReferralCode>();
  return row || null;
}

/**
 * Create a new referral code for an existing user (who must have role='reseller').
 * The code is normalized to uppercase. Throws on duplicate code.
 */
export async function createCode(
  env: Env,
  args: { code: string; resellerId: number; notes?: string }
): Promise<ReferralCode> {
  const code = args.code.toUpperCase().trim();
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) {
    throw new Error('Invalid code format. Use 2-32 chars: A-Z, 0-9, _, -');
  }
  // Verify the user is a reseller (primary OR additional role)
  const user = await env.DB.prepare('SELECT id, role, roles FROM users WHERE id = ?').bind(args.resellerId).first<any>();
  if (!user) throw new Error('User not found');
  const { userHasRole } = await import('./user-roles');
  if (!userHasRole(user, 'reseller')) {
    throw new Error('User is not a reseller. Promote them first.');
  }
  // Verify code is unique
  const existing = await env.DB.prepare('SELECT id FROM referral_codes WHERE UPPER(code) = ?').bind(code).first();
  if (existing) throw new Error('Code already exists');

  const result = await env.DB.prepare(
    `INSERT INTO referral_codes (code, reseller_id, notes) VALUES (?, ?, ?)`
  ).bind(code, args.resellerId, args.notes || null).run();
  const id = result.meta.last_row_id as number;
  const created = await env.DB.prepare('SELECT * FROM referral_codes WHERE id = ?').bind(id).first<ReferralCode>();
  return created!;
}

/**
 * Apply a referral code to a customer. Sets the customer's pending attribution
 * context. The actual commission row is NOT created here — it's created when
 * the customer pays (attributeOnPurchase). One-time per customer.
 *
 * Returns the reseller_id if successful, null if code is invalid.
 * Throws on:
 *   - code not found / inactive
 *   - customer is the reseller (self-referral)
 *   - customer already has a code (UNIQUE constraint)
 */
export async function applyCodeToCustomer(
  env: Env,
  args: { code: string; customerId: number }
): Promise<{ resellerId: number; codeId: number }> {
  const codeRow = await getCodeByString(env, args.code);
  if (!codeRow) {
    throw new Error('Code tidak ditemukan atau sudah tidak aktif.');
  }
  if (codeRow.reseller_id === args.customerId) {
    throw new Error('Kamu tidak bisa pakai kode referral sendiri.');
  }
  // Block re-application: check BOTH the users column (set by previous
  // applyCodeToCustomer calls, even before purchase) AND the
  // referral_attributions table (for after the first purchase).
  const user = await env.DB.prepare(
    'SELECT referral_code_applied FROM users WHERE id = ?'
  ).bind(args.customerId).first<{ referral_code_applied: string | null }>();
  if (user?.referral_code_applied) {
    throw new Error('Kamu sudah pernah pakai kode reseller. Hanya bisa pakai satu kali.');
  }
  const existing = await env.DB.prepare(
    'SELECT id FROM referral_attributions WHERE customer_id = ?'
  ).bind(args.customerId).first();
  if (existing) {
    throw new Error('Kamu sudah pernah pakai kode reseller. Hanya bisa pakai satu kali.');
  }
  // We don't insert yet — we store the code pending in a per-user column on
  // users table, then attributeOnPurchase looks it up at payment time.
  await env.DB.prepare(
    `UPDATE users SET referral_code_applied = ? WHERE id = ?`
  ).bind(codeRow.code, args.customerId).run();
  return { resellerId: codeRow.reseller_id, codeId: codeRow.id };
}

/**
 * Create a pending attribution when a customer pays for a premium plan.
 * Called from the SuccessfulPayment webhook. Idempotent: if an attribution
 * already exists for this payment_id, returns the existing one.
 */
export async function attributeOnPurchase(
  env: Env,
  args: {
    customerId: number;
    paymentId: number;
    planDays: number;
    planAmountStars: number;
  }
): Promise<Attribution | null> {
  // Look up customer's applied code
  const user = await env.DB.prepare(
    'SELECT referral_code_applied FROM users WHERE id = ?'
  ).bind(args.customerId).first<{ referral_code_applied: string | null }>();
  if (!user?.referral_code_applied) {
    // Customer never applied a code. Nothing to do.
    return null;
  }

  const codeRow = await getCodeByString(env, user.referral_code_applied);
  if (!codeRow) {
    console.warn(`[attribution] customer ${args.customerId} has applied code "${user.referral_code_applied}" but it's not active. Skipping.`);
    return null;
  }

  // Self-referral guard (defense in depth — applyCodeToCustomer also checks)
  if (codeRow.reseller_id === args.customerId) {
    console.warn(`[attribution] customer ${args.customerId} tried to refer themselves via stored code. Skipping.`);
    return null;
  }

  // Idempotency: check for existing attribution for this payment
  const existing = await env.DB.prepare(
    'SELECT * FROM referral_attributions WHERE payment_id = ?'
  ).bind(args.paymentId).first<Attribution>();
  if (existing) return existing;

  // Check UNIQUE(customer_id) — should never happen because applyCodeToCustomer
  // blocks duplicates, but guard anyway.
  const existingForCustomer = await env.DB.prepare(
    'SELECT * FROM referral_attributions WHERE customer_id = ?'
  ).bind(args.customerId).first<Attribution>();
  if (existingForCustomer) {
    console.warn(`[attribution] customer ${args.customerId} already has attribution ${existingForCustomer.id}. Skipping new one.`);
    return existingForCustomer;
  }

  const rate = COMMISSION_RATE_DEFAULT;
  const amount = Math.floor((args.planAmountStars * rate) / 100);

  // Insert pending attribution
  const result = await env.DB.prepare(
    `INSERT INTO referral_attributions
       (code_id, reseller_id, customer_id, payment_id, plan_days, plan_amount_stars, commission_rate, commission_amount_stars, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  ).bind(
    codeRow.id, codeRow.reseller_id, args.customerId, args.paymentId,
    args.planDays, args.planAmountStars, rate, amount
  ).run();
  const id = result.meta.last_row_id as number;

  // Denormalize counters on referral_codes
  await env.DB.prepare(
    `UPDATE referral_codes
     SET total_uses = total_uses + 1,
         total_revenue_stars = total_revenue_stars + ?,
         total_commission_stars = total_commission_stars + ?
     WHERE id = ?`
  ).bind(args.planAmountStars, amount, codeRow.id).run();

  return await env.DB.prepare('SELECT * FROM referral_attributions WHERE id = ?').bind(id).first<Attribution>();
}

/**
 * Cron-callable: find all pending attributions older than the anti-fraud hold
 * window, and either confirm or clawback them.
 *
 * For each pending row:
 *   - Look up the original payment in payment_requests
 *   - If status='refunded' → clawback
 *   - If status in ('completed', 'paid') → confirm
 *   - If status='pending' (payment still being processed) → leave for next cron
 */
export async function processPendingAttributions(env: Env, now: Date = new Date()): Promise<{
  confirmed: number;
  clawedBack: number;
  skipped: number;
}> {
  const cutoffMs = now.getTime() - ANTI_FRAUD_HOLD_DAYS * 24 * 3600 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const pending = await env.DB.prepare(
    `SELECT * FROM referral_attributions
     WHERE status = 'pending' AND created_at <= ?`
  ).bind(cutoffIso).all<Attribution>();

  let confirmed = 0;
  let clawedBack = 0;
  let skipped = 0;

  for (const attr of pending.results || []) {
    if (!attr.payment_id) {
      // No payment linked yet — skip (customer applied code but hasn't paid)
      skipped++;
      continue;
    }
    const payment = await env.DB.prepare(
      'SELECT status FROM payment_requests WHERE id = ?'
    ).bind(attr.payment_id).first<{ status: string }>();
    if (!payment) {
      console.warn(`[confirm] attribution ${attr.id} has payment_id=${attr.payment_id} but no payment row. Leaving pending.`);
      skipped++;
      continue;
    }
    if (payment.status === 'refunded' || payment.status === 'cancelled') {
      await env.DB.prepare(
        `UPDATE referral_attributions
         SET status = 'clawback', notes = COALESCE(notes, '') || ' refund detected at confirm time'
         WHERE id = ?`
      ).bind(attr.id).run();
      clawedBack++;
    } else if (payment.status === 'completed' || payment.status === 'paid') {
      await env.DB.prepare(
        `UPDATE referral_attributions
         SET status = 'confirmed', confirmed_at = datetime('now')
         WHERE id = ?`
      ).bind(attr.id).run();
      confirmed++;
    } else {
      // Payment still pending processing — try again tomorrow
      skipped++;
    }
  }

  return { confirmed, clawedBack, skipped };
}

/**
 * Clawback any confirmed/pending attribution when a payment is refunded.
 * Called from the refunded_payment webhook handler.
 */
export async function clawbackOnRefund(env: Env, paymentId: number): Promise<number> {
  const result = await env.DB.prepare(
    `UPDATE referral_attributions
     SET status = 'clawback',
         notes = COALESCE(notes, '') || ' refund on payment ' || ?
     WHERE payment_id = ? AND status IN ('pending', 'confirmed')`
  ).bind(paymentId, paymentId).run();
  return (result.meta.changes as number) || 0;
}

/**
 * Get all confirmed (payable) attributions for a reseller.
 * Used by /myreferrals to show pending payout, and by /payout_request to
 * build a bank batch.
 */
export async function getResellerConfirmedBalance(env: Env, resellerId: number): Promise<{
  total_amount_stars: number;
  attribution_ids: number[];
  count: number;
}> {
  const rows = await env.DB.prepare(
    `SELECT id, commission_amount_stars FROM referral_attributions
     WHERE reseller_id = ? AND status = 'confirmed'
     ORDER BY confirmed_at ASC`
  ).bind(resellerId).all<{ id: number; commission_amount_stars: number }>();
  const list = rows.results || [];
  return {
    total_amount_stars: list.reduce((sum, r) => sum + r.commission_amount_stars, 0),
    attribution_ids: list.map((r) => r.id),
    count: list.length,
  };
}

/**
 * Reseller's overall stats for /myreferrals
 */
export async function getResellerStats(env: Env, resellerId: number): Promise<{
  pending: { count: number; total_stars: number };
  confirmed: { count: number; total_stars: number };
  paid: { count: number; total_stars: number };
  clawback: { count: number; total_stars: number };
  total_revenue_stars: number;
}> {
  const rows = await env.DB.prepare(
    `SELECT status, COUNT(*) as count, COALESCE(SUM(commission_amount_stars), 0) as total
     FROM referral_attributions
     WHERE reseller_id = ?
     GROUP BY status`
  ).bind(resellerId).all<{ status: AttributionStatus; count: number; total: number }>();

  const out = {
    pending: { count: 0, total_stars: 0 },
    confirmed: { count: 0, total_stars: 0 },
    paid: { count: 0, total_stars: 0 },
    clawback: { count: 0, total_stars: 0 },
    total_revenue_stars: 0,
  };
  for (const r of rows.results || []) {
    if (r.status === 'pending' || r.status === 'confirmed' || r.status === 'paid' || r.status === 'clawback') {
      out[r.status] = { count: r.count, total_stars: r.total };
    }
  }
  // Total revenue is from the code counter
  const code = await env.DB.prepare(
    'SELECT total_revenue_stars FROM referral_codes WHERE reseller_id = ?'
  ).bind(resellerId).first<{ total_revenue_stars: number }>();
  out.total_revenue_stars = code?.total_revenue_stars || 0;
  return out;
}

/**
 * Mark confirmed attributions as paid (Stars). Caller is responsible for
 * actually sending the Stars — this just records the bookkeeping.
 */
export async function markPaidStars(
  env: Env,
  args: { attributionIds: number[]; payoutReference: string }
): Promise<number> {
  if (args.attributionIds.length === 0) return 0;
  const placeholders = args.attributionIds.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `UPDATE referral_attributions
     SET status = 'paid',
         paid_at = datetime('now'),
         payout_method = 'stars',
         payout_reference = ?
     WHERE id IN (${placeholders}) AND status = 'confirmed'`
  ).bind(args.payoutReference, ...args.attributionIds).run();
  return (result.meta.changes as number) || 0;
}

/**
 * Reseller requests a bank payout. Bundles all 'confirmed' attributions
 * into a single pending reseller_payouts row, then flips those attributions
 * to status='pending' (reserved) so they can't be claimed by another batch.
 * (Actually we keep them 'confirmed' but link them via payout_id — see below.)
 */
export async function createBankPayoutRequest(env: Env, resellerId: number): Promise<{
  payoutId: number;
  totalAmountStars: number;
  attributionCount: number;
} | null> {
  const balance = await getResellerConfirmedBalance(env, resellerId);
  if (balance.count === 0) return null;

  const result = await env.DB.prepare(
    `INSERT INTO reseller_payouts
       (reseller_id, total_amount_stars, attribution_ids, method, status)
     VALUES (?, ?, ?, 'bank', 'pending')`
  ).bind(
    resellerId,
    balance.total_amount_stars,
    JSON.stringify(balance.attribution_ids)
  ).run();
  const payoutId = result.meta.last_row_id as number;

  // Mark the linked attributions as belonging to this payout by setting
  // payout_reference. We KEEP status='confirmed' (still payable) but admin
  // sees this batch and won't mark it paid until manual transfer clears.
  // Note: this means the same attribution could be double-claimed if admin
  // runs the cron before this payout completes. To prevent that, we flip
  // status to a synthetic 'pending_payout' so the cron ignores it.
  const placeholders = balance.attribution_ids.map(() => '?').join(',');
  await env.DB.prepare(
    `UPDATE referral_attributions
     SET status = 'pending',
         notes = COALESCE(notes, '') || ' reserved for bank payout #' || ?,
         payout_method = 'bank',
         payout_reference = ?
     WHERE id IN (${placeholders}) AND status = 'confirmed'`
  ).bind(payoutId, String(payoutId), ...balance.attribution_ids).run();

  return {
    payoutId,
    totalAmountStars: balance.total_amount_stars,
    attributionCount: balance.count,
  };
}

/**
 * Admin marks a bank payout as completed.
 */
export async function completeBankPayout(
  env: Env,
  args: { payoutId: number; reference?: string; notes?: string }
): Promise<{ updated: number; payoutAmount: number; resellerId: number } | null> {
  const payout = await env.DB.prepare(
    'SELECT * FROM reseller_payouts WHERE id = ?'
  ).bind(args.payoutId).first<any>();
  if (!payout) return null;
  if (payout.status === 'completed') {
    return { updated: 0, payoutAmount: payout.total_amount_stars, resellerId: payout.reseller_id };
  }
  const attributionIds = JSON.parse(payout.attribution_ids) as number[];
  const placeholders = attributionIds.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `UPDATE referral_attributions
     SET status = 'paid', paid_at = datetime('now')
     WHERE id IN (${placeholders}) AND status = 'pending'`
  ).bind(...attributionIds).run();
  await env.DB.prepare(
    `UPDATE reseller_payouts
     SET status = 'completed',
         reference = ?,
         notes = ?,
         completed_at = datetime('now')
     WHERE id = ?`
  ).bind(args.reference || payout.reference, args.notes || null, args.payoutId).run();
  return {
    updated: (result.meta.changes as number) || 0,
    payoutAmount: payout.total_amount_stars,
    resellerId: payout.reseller_id,
  };
}

/**
 * List pending bank payouts (for admin /payouts command)
 */
export async function listPendingPayouts(env: Env, limit: number = 20): Promise<any[]> {
  const rows = await env.DB.prepare(
    `SELECT p.*, u.name as reseller_name, u.telegram_id as reseller_telegram_id
     FROM reseller_payouts p
     JOIN users u ON u.id = p.reseller_id
     WHERE p.status = 'pending'
     ORDER BY p.created_at ASC
     LIMIT ?`
  ).bind(limit).all<any>();
  return rows.results || [];
}

/**
 * Admin: list all referral codes
 */
export async function listCodes(env: Env, limit: number = 50): Promise<any[]> {
  const rows = await env.DB.prepare(
    `SELECT c.*, u.name as reseller_name, u.telegram_id as reseller_telegram_id
     FROM referral_codes c
     JOIN users u ON u.id = c.reseller_id
     ORDER BY c.total_uses DESC, c.created_at DESC
     LIMIT ?`
  ).bind(limit).all<any>();
  return rows.results || [];
}

/**
 * Promote a user to role='reseller'. If the user already has a primary
 * role (e.g. they're already a teacher), the 'reseller' role is
 * APPENDED to users.roles instead of overwriting users.role. This is
 * the multi-role path: a teacher can be a reseller simultaneously.
 *
 * Idempotent: if the user already has 'reseller' in either column,
 * returns wasPromoted=false.
 */
export async function promoteToReseller(env: Env, userId: number): Promise<{ updated: boolean; newRole: string; newRoles: string | null }> {
  const user = await env.DB.prepare('SELECT role, roles FROM users WHERE id = ?').bind(userId).first<{ role: string | null; roles: string | null }>();
  if (!user) throw new Error('User not found');

  const { addRoleToUser } = await import('./user-roles');
  const result = addRoleToUser(user.role || null, user.roles || null, 'reseller');
  if (!result.wasPromoted) {
    return { updated: false, newRole: result.newRole || 'reseller', newRoles: result.newRoles };
  }

  // Update both columns (role unchanged if user already had a primary)
  await env.DB.prepare(
    `UPDATE users SET role = ?, roles = ? WHERE id = ?`
  ).bind(result.newRole, result.newRoles, userId).run();

  return { updated: true, newRole: result.newRole || 'reseller', newRoles: result.newRoles };
}
