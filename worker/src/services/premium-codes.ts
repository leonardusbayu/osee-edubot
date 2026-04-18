// Premium redemption codes — teacher-as-reseller channel.
//
// Teachers buy bulk premium access from the admin, admin generates a batch
// of single-use codes, teacher distributes to their students. Each code
// grants `days` of premium when redeemed via /redeem CODE.
//
// Design:
//   - Codes are cryptographically random (10 alphanum chars, uppercase,
//     no confusable chars like 0/O/1/I/l) formatted OSEE-XXXXX-XXXXX
//   - Single-use: redeemed_at flips from NULL to a timestamp
//   - Batched: batch_id lets admin track "Teacher Budi's 50 codes" as one
//     unit for redemption rates
//   - Atomic redeem: UPDATE with WHERE redeemed_at IS NULL guarantees
//     no double-redeem even under concurrent /redeem calls

import type { Env } from '../types';
import { grantPremium } from './premium';

// ─── Code generation ────────────────────────────────────────────────────

// 32 chars, no 0/1/O/I/L to avoid hand-transcription errors when a teacher
// posts codes on a whiteboard or in a WhatsApp message.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomChunk(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function generateCode(): string {
  return `OSEE-${randomChunk(5)}-${randomChunk(5)}`;
}

// ─── Public API ─────────────────────────────────────────────────────────

export interface GeneratedCode {
  code: string;
  days: number;
}

/**
 * Generate a batch of single-use premium codes and insert them.
 * Returns the plaintext codes — only time the admin sees them. The DB
 * stores them too (not hashed) so admin can look them up later if a
 * teacher loses the list.
 */
export async function generateCodes(
  env: Env,
  createdBy: number,
  count: number,
  days: number,
  batchId: string | null = null,
  notes: string | null = null,
  expiresInDays: number | null = null,
): Promise<GeneratedCode[]> {
  if (count <= 0 || count > 500) {
    throw new Error('count must be between 1 and 500');
  }
  if (days <= 0 || days > 730) {
    throw new Error('days must be between 1 and 730');
  }

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
    : null;

  const out: GeneratedCode[] = [];
  const maxAttempts = count * 3; // retry budget for UNIQUE collisions
  let attempts = 0;

  while (out.length < count && attempts < maxAttempts) {
    attempts++;
    const code = generateCode();
    try {
      await env.DB.prepare(
        `INSERT INTO premium_codes (code, days, batch_id, notes, created_by, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(code, days, batchId, notes, createdBy, expiresAt).run();
      out.push({ code, days });
    } catch (e: any) {
      // UNIQUE constraint collision — astronomically rare (32^10) but retry
      if (String(e?.message || '').toLowerCase().includes('unique')) continue;
      throw e;
    }
  }

  if (out.length < count) {
    throw new Error(`Generated only ${out.length} of ${count} codes after ${attempts} attempts`);
  }

  return out;
}

export interface RedeemResult {
  success: boolean;
  error?: 'not_found' | 'already_redeemed' | 'expired' | 'invalid_format';
  days_granted?: number;
  new_expiry?: string;
  code_info?: { batch_id: string | null; notes: string | null };
}

/**
 * Redeem a code for a user. Atomic via conditional UPDATE — if two
 * students somehow race for the same code, only one wins and the other
 * gets already_redeemed back.
 */
export async function redeemCode(
  env: Env,
  userId: number,
  rawCode: string,
): Promise<RedeemResult> {
  // Normalize: strip whitespace, uppercase, dehydrate hyphens then re-hydrate.
  // Students often paste with extra spaces or missing dashes.
  const clean = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean.startsWith('OSEE') || clean.length !== 14) {
    return { success: false, error: 'invalid_format' };
  }
  const code = `OSEE-${clean.slice(4, 9)}-${clean.slice(9)}`;

  const row = await env.DB.prepare(
    `SELECT id, days, batch_id, notes, redeemed_at, expires_at
       FROM premium_codes WHERE code = ? LIMIT 1`
  ).bind(code).first() as any;

  if (!row) return { success: false, error: 'not_found' };
  if (row.redeemed_at) return { success: false, error: 'already_redeemed' };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { success: false, error: 'expired' };
  }

  // Atomic claim: only flip redeemed_at if still NULL. Prevents double-redeem.
  const result = await env.DB.prepare(
    `UPDATE premium_codes SET redeemed_at = datetime('now'), redeemed_by = ?
     WHERE id = ? AND redeemed_at IS NULL`
  ).bind(userId, row.id).run();

  if (!result.success || result.meta?.changes === 0) {
    // Somebody else just claimed it
    return { success: false, error: 'already_redeemed' };
  }

  // Grant premium (extends existing if active)
  await grantPremium(env, userId, Number(row.days));

  const newExpiryRow = await env.DB.prepare(
    `SELECT premium_until FROM users WHERE id = ?`
  ).bind(userId).first() as any;

  return {
    success: true,
    days_granted: Number(row.days),
    new_expiry: newExpiryRow?.premium_until || null,
    code_info: { batch_id: row.batch_id, notes: row.notes },
  };
}

export interface BatchStats {
  total: number;
  redeemed: number;
  unused: number;
  expired: number;
  days_per_code: number | null;
  sample_codes: string[]; // first 5 unused codes for reprinting
}

export async function getBatchStats(env: Env, batchId: string): Promise<BatchStats> {
  const total = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM premium_codes WHERE batch_id = ?`
  ).bind(batchId).first() as any;

  const redeemed = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM premium_codes WHERE batch_id = ? AND redeemed_at IS NOT NULL`
  ).bind(batchId).first() as any;

  const expired = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM premium_codes
      WHERE batch_id = ? AND redeemed_at IS NULL
        AND expires_at IS NOT NULL AND expires_at < datetime('now')`
  ).bind(batchId).first() as any;

  const daysRow = await env.DB.prepare(
    `SELECT days FROM premium_codes WHERE batch_id = ? LIMIT 1`
  ).bind(batchId).first() as any;

  const unused = Number(total?.n || 0) - Number(redeemed?.n || 0);

  const samplesRow = await env.DB.prepare(
    `SELECT code FROM premium_codes
      WHERE batch_id = ? AND redeemed_at IS NULL
      ORDER BY created_at ASC LIMIT 5`
  ).bind(batchId).all() as any;

  return {
    total: Number(total?.n || 0),
    redeemed: Number(redeemed?.n || 0),
    unused,
    expired: Number(expired?.n || 0),
    days_per_code: daysRow?.days ?? null,
    sample_codes: (samplesRow.results || []).map((r: any) => String(r.code)),
  };
}

/**
 * List recent batches with their redemption rates.
 */
export async function listRecentBatches(env: Env, limit: number = 20) {
  const rows = await env.DB.prepare(
    `SELECT batch_id,
            COUNT(*) AS total,
            SUM(CASE WHEN redeemed_at IS NOT NULL THEN 1 ELSE 0 END) AS redeemed,
            MIN(days) AS days,
            MIN(created_at) AS created_at
       FROM premium_codes
      WHERE batch_id IS NOT NULL
      GROUP BY batch_id
      ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();
  return (rows.results || []) as any[];
}
