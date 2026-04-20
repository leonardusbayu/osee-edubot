/**
 * Tripay Payment Gateway Service
 *
 * Handles all communication with the Tripay API including:
 * - HMAC-SHA256 signature generation (Web Crypto API for Cloudflare Workers)
 * - Closed payment transaction creation
 * - Callback signature verification
 * - Payment channel listing
 * - Transaction status checking
 *
 * Uses existing merchant (e.g. T48837) — credentials are stored as
 * Cloudflare Worker secrets (TRIPAY_API_KEY, TRIPAY_PRIVATE_KEY, TRIPAY_MERCHANT_CODE).
 */

import type { Env } from '../types';

const TRIPAY_API_URL = 'https://tripay.co.id/api';
// For sandbox testing, swap to: 'https://tripay.co.id/api-sandbox'

// ── Pricing plans (IDR) ─────────────────────────────────────────────
export const TRIPAY_PLANS: Record<string, { days: number; amount: number; label: string }> = {
  plan_7: { days: 7, amount: 30000, label: '7 Hari' },
  plan_30: { days: 30, amount: 99000, label: '30 Hari' },
  plan_90: { days: 90, amount: 270000, label: '90 Hari' },
  plan_180: { days: 180, amount: 500000, label: '180 Hari' },
  plan_365: { days: 365, amount: 950000, label: '365 Hari' },
};

// ── HMAC-SHA256 via Web Crypto API ──────────────────────────────────
// Cloudflare Workers don't have Node's `crypto.createHmac`, so we use
// the Web Crypto API (crypto.subtle) instead.
async function hmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Transaction Signature ───────────────────────────────────────────
// signature = HMAC-SHA256(merchantCode + merchantRef + amount, privateKey)
export async function generateTransactionSignature(
  privateKey: string,
  merchantCode: string,
  merchantRef: string,
  amount: number,
): Promise<string> {
  return hmacSha256(privateKey, merchantCode + merchantRef + amount);
}

// ── Callback Signature Verification ─────────────────────────────────
// Tripay sends X-Callback-Signature header = HMAC-SHA256(rawBody, privateKey)
export async function verifyCallbackSignature(
  privateKey: string,
  rawBody: string,
  receivedSignature: string,
): Promise<boolean> {
  const computed = await hmacSha256(privateKey, rawBody);
  return computed === receivedSignature;
}

// ── Create Closed Payment Transaction ───────────────────────────────
export interface CreateTransactionParams {
  userId: number;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  planKey: string; // 'plan_7', 'plan_30', etc.
  method: string; // 'QRIS', 'BRIVA', 'BCAVA', etc.
}

export interface TripayTransaction {
  reference: string;
  merchant_ref: string;
  payment_method: string;
  payment_name: string;
  amount: number;
  fee_merchant: number;
  fee_customer: number;
  total_fee: number;
  amount_received: number;
  pay_code: string | null;
  pay_url: string | null;
  checkout_url: string;
  status: string;
  expired_time: number;
  qr_string: string | null;
  qr_url: string | null;
  instructions: Array<{ title: string; steps: string[] }>;
}

export async function createTransaction(
  env: Env,
  params: CreateTransactionParams,
): Promise<{ success: boolean; data?: TripayTransaction; error?: string }> {
  const apiKey = env.TRIPAY_API_KEY;
  const privateKey = env.TRIPAY_PRIVATE_KEY;
  const merchantCode = env.TRIPAY_MERCHANT_CODE;

  if (!apiKey || !privateKey || !merchantCode) {
    return { success: false, error: 'Tripay credentials not configured' };
  }

  const plan = TRIPAY_PLANS[params.planKey];
  if (!plan) {
    return { success: false, error: `Invalid plan: ${params.planKey}` };
  }

  const merchantRef = `EDU-${params.userId}-${plan.days}-${Date.now()}`;
  const amount = plan.amount;
  // Expiry time per metode (dalam detik dari sekarang):
  // - QRIS: maks 30 menit (batas Tripay untuk QRIS)
  // - E-Wallet (OVO/DANA/ShopeePay): 1 jam
  // - Virtual Account: 24 jam
  const expirySeconds = (() => {
    if (params.method === 'QRIS2') return 30 * 60;           // 30 menit
    if (['OVO', 'DANA', 'SHOPEEPAY'].includes(params.method)) return 60 * 60; // 1 jam
    return 24 * 60 * 60;                                       // 24 jam (VA)
  })();
  const expiry = Math.floor(Date.now() / 1000) + expirySeconds;

  const signature = await generateTransactionSignature(privateKey, merchantCode, merchantRef, amount);

  const payload = {
    method: params.method,
    merchant_ref: merchantRef,
    amount,
    customer_name: params.userName || `User ${params.userId}`,
    customer_email: params.userEmail || `user${params.userId}@edubot.app`,
    customer_phone: params.userPhone || '',
    order_items: [
      {
        sku: `PREMIUM-${plan.days}D`,
        name: `EduBot Premium ${plan.label}`,
        price: amount,
        quantity: 1,
      },
    ],
    expired_time: expiry,
    signature,
  };

  try {
    const resp = await fetch(`${TRIPAY_API_URL}/transaction/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result: any = await resp.json();

    if (!result.success) {
      console.error('[tripay] Create transaction failed:', result.message);
      return { success: false, error: result.message || 'Transaction creation failed' };
    }

    return { success: true, data: result.data as TripayTransaction };
  } catch (e: any) {
    console.error('[tripay] Create transaction error:', e.message || e);
    return { success: false, error: 'Network error contacting Tripay' };
  }
}

// ── Get Payment Channels ────────────────────────────────────────────
export interface PaymentChannel {
  group: string;
  code: string;
  name: string;
  type: string; // 'direct' | 'redirect'
  fee_merchant: { flat: number; percent: number };
  fee_customer: { flat: number; percent: number };
  total_fee: { flat: number; percent: string };
  minimum_fee: number;
  maximum_fee: number;
  minimum_amount: number;
  maximum_amount: number;
  icon_url: string;
  active: boolean;
}

export async function getPaymentChannels(
  env: Env,
): Promise<{ success: boolean; data?: PaymentChannel[]; error?: string }> {
  const apiKey = env.TRIPAY_API_KEY;
  if (!apiKey) return { success: false, error: 'Tripay API key not configured' };

  try {
    const resp = await fetch(`${TRIPAY_API_URL}/merchant/payment-channel`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const result: any = await resp.json();

    if (!result.success) {
      return { success: false, error: result.message };
    }

    return { success: true, data: result.data as PaymentChannel[] };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to fetch channels' };
  }
}

// ── Get Transaction Detail ──────────────────────────────────────────
export async function getTransactionDetail(
  env: Env,
  reference: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  const apiKey = env.TRIPAY_API_KEY;
  if (!apiKey) return { success: false, error: 'Tripay API key not configured' };

  try {
    const resp = await fetch(`${TRIPAY_API_URL}/transaction/detail?reference=${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const result: any = await resp.json();

    if (!result.success) {
      return { success: false, error: result.message };
    }

    return { success: true, data: result.data };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to fetch transaction detail' };
  }
}

// ── Parse Merchant Ref ──────────────────────────────────────────────
// Format: EDU-{userId}-{days}-{timestamp}
export function parseMerchantRef(merchantRef: string): { userId: number; days: number } | null {
  const parts = merchantRef.split('-');
  if (parts.length < 4 || parts[0] !== 'EDU') return null;
  const userId = parseInt(parts[1]);
  const days = parseInt(parts[2]);
  if (isNaN(userId) || isNaN(days) || userId <= 0 || days <= 0) return null;
  return { userId, days };
}
