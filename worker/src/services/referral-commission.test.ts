import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createCode,
  getCodeByString,
  applyCodeToCustomer,
  attributeOnPurchase,
  processPendingAttributions,
  clawbackOnRefund,
  getResellerStats,
  createBankPayoutRequest,
  completeBankPayout,
  listPendingPayouts,
  promoteToReseller,
  COMMISSION_RATE_DEFAULT,
  PLAN_PRICING,
  type ReferralCode,
  type Attribution,
} from './referral-commission';

// In-memory mock D1 — supports the SQL our service runs.
function makeMockDb() {
  const users: any[] = [
    { id: 1, name: 'Customer One', role: 'student', referral_code_applied: null },
    { id: 2, name: 'Customer Two', role: 'student', referral_code_applied: null },
    { id: 3, name: 'Reseller Budi', role: 'reseller', referral_code_applied: null },
    { id: 4, name: 'Reseller Andi', role: 'reseller', referral_code_applied: null },
  ];
  const codes: ReferralCode[] = [];
  const attributions: any[] = [];
  const paymentRequests: any[] = [];
  const payouts: any[] = [];

  const db: any = {
    prepare(sql: string) {
      return {
        bind(...params: any[]) {
          const bound = { sql, params };
          return {
            async first<T = any>(): Promise<T | null> {
              return runFirst(bound, { users, codes, attributions, paymentRequests, payouts }) as T | null;
            },
            async all<T = any>(): Promise<{ results: T[] }> {
              return runAll(bound, { users, codes, attributions, paymentRequests, payouts }) as { results: T[] };
            },
            async run(): Promise<any> {
              return runExec(bound, { users, codes, attributions, paymentRequests, payouts });
            },
          };
        },
      };
    },
  };
  // The service uses env.DB.prepare() — wrap the db so env.DB exists
  return { db: { DB: db, ...db }, users, codes, attributions, paymentRequests, payouts };
}

function runFirst(bound: { sql: string; params: any[] }, state: any): any {
  const { sql, params } = bound;
  // User lookup (any column list containing role)
  if (/SELECT\s+.*role.*FROM\s+users\s+WHERE\s+id\s*=\s*\?/i.test(sql)) {
    return state.users.find((u: any) => u.id === params[0]) || null;
  }
  if (sql.includes('SELECT id FROM users WHERE id = ?')) {
    return state.users.find((u: any) => u.id === params[0]) || null;
  }
  if (sql.includes('SELECT * FROM referral_codes WHERE UPPER(code) = UPPER')) {
    return state.codes.find((c: any) => c.code.toUpperCase() === params[0].toUpperCase() && c.is_active === 1) || null;
  }
  if (sql.includes('SELECT id FROM referral_codes WHERE UPPER(code) = ?')) {
    return state.codes.find((c: any) => c.code.toUpperCase() === params[0].toUpperCase()) || null;
  }
  if (sql.includes('SELECT * FROM referral_codes WHERE id = ?')) {
    return state.codes.find((c: any) => c.id === params[0]) || null;
  }
  if (sql.includes('SELECT referral_code_applied FROM users WHERE id = ?')) {
    return state.users.find((u: any) => u.id === params[0]) || null;
  }
  if (sql.includes('SELECT * FROM referral_attributions WHERE customer_id = ?')) {
    return state.attributions.find((a: any) => a.customer_id === params[0]) || null;
  }
  if (sql.includes('SELECT * FROM referral_attributions WHERE payment_id = ?')) {
    return state.attributions.find((a: any) => a.payment_id === params[0]) || null;
  }
  if (sql.includes('SELECT status FROM payment_requests WHERE id = ?')) {
    return state.paymentRequests.find((p: any) => p.id === params[0]) || null;
  }
  if (sql.includes('SELECT * FROM referral_attributions WHERE id = ?')) {
    return state.attributions.find((a: any) => a.id === params[0]) || null;
  }
  if (sql.includes("SELECT total_revenue_stars FROM referral_codes WHERE reseller_id = ?")) {
    const c = state.codes.find((c: any) => c.reseller_id === params[0]);
    return c ? { total_revenue_stars: c.total_revenue_stars } : null;
  }
  if (sql.includes('SELECT * FROM reseller_payouts WHERE id = ?')) {
    return state.payouts.find((p: any) => p.id === params[0]) || null;
  }
  return null;
}

function runAll(bound: { sql: string; params: any[] }, state: any): { results: any[] } {
  const { sql, params } = bound;
  if (sql.includes('SELECT * FROM referral_attributions') && sql.includes('status = \'pending\'')) {
    const cutoff = params[0];
    return { results: state.attributions.filter((a: any) => a.status === 'pending' && a.created_at <= cutoff) };
  }
  if (sql.includes('SELECT id, commission_amount_stars FROM referral_attributions') && sql.includes('status = \'confirmed\'')) {
    return { results: state.attributions.filter((a: any) => a.reseller_id === params[0] && a.status === 'confirmed') };
  }
  if (sql.includes('SELECT status, COUNT(*) as count, COALESCE(SUM')) {
    const counts: any = {};
    for (const a of state.attributions.filter((a: any) => a.reseller_id === params[0])) {
      counts[a.status] = counts[a.status] || { status: a.status, count: 0, total: 0 };
      counts[a.status].count++;
      counts[a.status].total += a.commission_amount_stars;
    }
    return { results: Object.values(counts) };
  }
  if (sql.includes('SELECT DISTINCT reseller_id FROM referral_attributions')) {
    const set = new Set<number>();
    for (const a of state.attributions.filter((a: any) => a.status === 'confirmed' && a.payout_method == null)) {
      set.add(a.reseller_id);
    }
    return { results: Array.from(set).map((reseller_id) => ({ reseller_id })) };
  }
  if (sql.includes('SELECT p.*, u.name as reseller_name')) {
    return { results: state.payouts.filter((p: any) => p.status === 'pending') };
  }
  if (sql.includes('SELECT c.*, u.name as reseller_name FROM referral_codes c')) {
    return { results: [...state.codes].sort((a: any, b: any) => b.total_uses - a.total_uses) };
  }
  return { results: [] };
}

function runExec(bound: { sql: string; params: any[] }, state: any): any {
  const { sql, params } = bound;
  if (sql.startsWith("UPDATE users SET role = 'reseller'")) {
    const u = state.users.find((u: any) => u.id === params[0]);
    if (u) u.role = 'reseller';
    return { success: true, meta: { changes: 1, last_row_id: 0 } };
  }
  if (sql.includes("UPDATE users SET referral_code_applied = ?")) {
    const u = state.users.find((u: any) => u.id === params[1]);
    if (u) u.referral_code_applied = params[0];
    return { success: true, meta: { changes: 1, last_row_id: 0 } };
  }
  if (sql.startsWith("INSERT INTO referral_codes")) {
    const id = state.codes.length + 1;
    const code: ReferralCode = {
      id, code: params[0], reseller_id: params[1], is_active: 1,
      total_uses: 0, total_revenue_stars: 0, total_commission_stars: 0,
      notes: params[2], created_at: new Date().toISOString(),
    };
    state.codes.push(code);
    return { success: true, meta: { last_row_id: id, changes: 1 } };
  }
  if (sql.includes("UPDATE referral_codes") && sql.includes("SET total_uses")) {
    const c = state.codes.find((c: any) => c.id === params[2]);
    if (c) {
      c.total_uses++;
      c.total_revenue_stars += params[0];
      c.total_commission_stars += params[1];
    }
    return { success: true, meta: { changes: 1, last_row_id: 0 } };
  }
  if (sql.startsWith("INSERT INTO referral_attributions")) {
    const id = state.attributions.length + 1;
    const attr = {
      id, code_id: params[0], reseller_id: params[1], customer_id: params[2],
      payment_id: params[3], plan_days: params[4], plan_amount_stars: params[5],
      commission_rate: params[6], commission_amount_stars: params[7],
      status: 'pending', confirmed_at: null, paid_at: null, payout_method: null,
      payout_reference: null, notes: null,
      created_at: new Date().toISOString(),
    };
    state.attributions.push(attr);
    return { success: true, meta: { last_row_id: id, changes: 1 } };
  }
  // Two different clawback queries:
  //   1. processPendingAttributions: UPDATE WHERE id = ? (params[0] = id)
  //   2. clawbackOnRefund:          UPDATE WHERE payment_id = ? AND status IN (...) (params[0]=note, params[1]=paymentId)
  if (sql.includes("UPDATE referral_attributions") && sql.includes("SET status = 'clawback'")) {
    let changes = 0;
    if (sql.includes('WHERE id = ?') && params.length === 1) {
      // processPendingAttributions path
      for (const a of state.attributions) {
        if (a.id === params[0] && a.status !== 'clawback') {
          a.status = 'clawback';
          a.notes = (a.notes || '') + ' refund detected at confirm time';
          changes++;
        }
      }
    } else {
      // clawbackOnRefund path
      for (const a of state.attributions) {
        if (a.payment_id === params[1] && (a.status === 'pending' || a.status === 'confirmed')) {
          a.status = 'clawback';
          a.notes = (a.notes || '') + ' refund on payment ' + params[0];
          changes++;
        }
      }
    }
    return { success: true, meta: { changes, last_row_id: 0 } };
  }  if (sql.includes("UPDATE referral_attributions") && sql.includes("SET status = 'confirmed'")) {
    const a = state.attributions.find((a: any) => a.id === params[0]);
    if (a) { a.status = 'confirmed'; a.confirmed_at = new Date().toISOString(); }
    return { success: true, meta: { changes: 1, last_row_id: 0 } };
  }
  if (sql.includes("UPDATE referral_attributions") && sql.includes("SET status = 'paid'") && sql.includes('payout_method = \'stars\'')) {
    const ref = params[0];
    const ids = params.slice(1);
    let changes = 0;
    for (const a of state.attributions) {
      if (ids.includes(a.id) && a.status === 'confirmed') {
        a.status = 'paid';
        a.paid_at = new Date().toISOString();
        a.payout_method = 'stars';
        a.payout_reference = ref;
        changes++;
      }
    }
    return { success: true, meta: { changes, last_row_id: 0 } };
  }
  if (sql.includes("UPDATE referral_attributions") && sql.includes("SET status = 'pending'") && sql.includes('payout_method = \'bank\'')) {
    // Bank payout from createBankPayoutRequest — sets status to 'pending' (reserved)
    const payoutId = params[0];
    const payoutRef = params[1];
    const ids = params.slice(2);
    let changes = 0;
    for (const a of state.attributions) {
      if (ids.includes(a.id) && a.status === 'confirmed') {
        a.status = 'pending';
        a.notes = (a.notes || '') + ' reserved for bank payout #' + payoutId;
        a.payout_method = 'bank';
        a.payout_reference = payoutRef;
        changes++;
      }
    }
    return { success: true, meta: { changes, last_row_id: 0 } };
  }
  if (sql.startsWith("INSERT INTO reseller_payouts")) {
    const id = state.payouts.length + 1;
    state.payouts.push({
      id, reseller_id: params[0], total_amount_stars: params[1],
      attribution_ids: params[2], method: params[3], status: params[4],
      reference: null, notes: null, created_at: new Date().toISOString(),
      completed_at: null,
    });
    return { success: true, meta: { last_row_id: id, changes: 1 } };
  }
  if (sql.includes("UPDATE referral_attributions") && sql.includes("SET status = 'paid', paid_at")) {
    // completeBankPayout: status = paid where in ids and status was 'pending' (reserved)
    const ids = params;
    let changes = 0;
    for (const a of state.attributions) {
      if (ids.includes(a.id) && a.status === 'pending' && a.payout_method === 'bank') {
        a.status = 'paid';
        a.paid_at = new Date().toISOString();
        changes++;
      }
    }
    return { success: true, meta: { changes, last_row_id: 0 } };
  }
  if (sql.includes("UPDATE reseller_payouts")) {
    const p = state.payouts.find((p: any) => p.id === params[2]);
    if (p) { p.status = 'completed'; p.reference = params[0]; p.notes = params[1]; p.completed_at = new Date().toISOString(); }
    return { success: true, meta: { changes: 1, last_row_id: 0 } };
  }
  return { success: true, meta: { changes: 0, last_row_id: 0 } };
}

describe('referral-commission', () => {
  let env: any;
  let state: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    state = makeMockDb();
    env = state.db;
  });

  describe('createCode + getCodeByString', () => {
    it('creates a code and looks it up case-insensitively', async () => {
      const code = await createCode(env, { code: 'BUDI03', resellerId: 3 });
      expect(code.code).toBe('BUDI03');
      expect(code.reseller_id).toBe(3);
      const found = await getCodeByString(env, 'budi03');
      expect(found?.id).toBe(code.id);
    });

    it('rejects invalid code format', async () => {
      await expect(createCode(env, { code: 'a', resellerId: 3 })).rejects.toThrow(/format/i);
    });

    it('rejects non-reseller user', async () => {
      await expect(createCode(env, { code: 'TEST01', resellerId: 1 })).rejects.toThrow(/reseller/i);
    });

    it('rejects duplicate code', async () => {
      await createCode(env, { code: 'DUPEX1', resellerId: 3 });
      await expect(createCode(env, { code: 'dupex1', resellerId: 4 })).rejects.toThrow(/already exists/i);
    });
  });

  describe('applyCodeToCustomer', () => {
    beforeEach(async () => {
      await createCode(env, { code: 'BUDI03', resellerId: 3 });
    });

    it('applies a code and stores it on the customer', async () => {
      const result = await applyCodeToCustomer(env, { code: 'BUDI03', customerId: 1 });
      expect(result.resellerId).toBe(3);
      const user = state.users.find((u) => u.id === 1);
      expect(user.referral_code_applied).toBe('BUDI03');
    });

    it('blocks self-referral', async () => {
      await expect(applyCodeToCustomer(env, { code: 'BUDI03', customerId: 3 })).rejects.toThrow(/sendiri/i);
    });

    it('blocks second application', async () => {
      await applyCodeToCustomer(env, { code: 'BUDI03', customerId: 1 });
      // Bypass the second-call guard by simulating that customer 1 already has
      // a stored code (in real flow this would be UNIQUE-constrained in D1)
      state.users[0].referral_code_applied = 'OTHER1';
      await expect(applyCodeToCustomer(env, { code: 'BUDI03', customerId: 1 })).rejects.toThrow(/sudah pernah/i);
    });

    it('rejects unknown code', async () => {
      await expect(applyCodeToCustomer(env, { code: 'NOPE99', customerId: 1 })).rejects.toThrow(/tidak ditemukan/i);
    });
  });

  describe('attributeOnPurchase', () => {
    it('creates a pending attribution when customer has applied a code', async () => {
      await createCode(env, { code: 'BUDI03', resellerId: 3 });
      await applyCodeToCustomer(env, { code: 'BUDI03', customerId: 1 });
      const attr = await attributeOnPurchase(env, {
        customerId: 1, paymentId: 100, planDays: 30, planAmountStars: PLAN_PRICING[30],
      });
      expect(attr).not.toBeNull();
      expect(attr?.status).toBe('pending');
      expect(attr?.commission_rate).toBe(COMMISSION_RATE_DEFAULT);
      expect(attr?.commission_amount_stars).toBe(Math.floor(PLAN_PRICING[30] * 0.2));
      expect(attr?.reseller_id).toBe(3);
      // Code counters updated
      const code = state.codes[0];
      expect(code.total_uses).toBe(1);
      expect(code.total_revenue_stars).toBe(PLAN_PRICING[30]);
      expect(code.total_commission_stars).toBe(Math.floor(PLAN_PRICING[30] * 0.2));
    });

    it('returns null when customer has no applied code', async () => {
      const attr = await attributeOnPurchase(env, {
        customerId: 1, paymentId: 100, planDays: 30, planAmountStars: 1238,
      });
      expect(attr).toBeNull();
    });

    it('is idempotent — second call returns the first attribution', async () => {
      await createCode(env, { code: 'BUDI03', resellerId: 3 });
      await applyCodeToCustomer(env, { code: 'BUDI03', customerId: 1 });
      const first = await attributeOnPurchase(env, { customerId: 1, paymentId: 100, planDays: 30, planAmountStars: 1238 });
      const second = await attributeOnPurchase(env, { customerId: 1, paymentId: 100, planDays: 30, planAmountStars: 1238 });
      expect(second?.id).toBe(first?.id);
      // Counter should only increment once
      expect(state.codes[0].total_uses).toBe(1);
    });

    it('blocks self-referral even if code was stored', async () => {
      // Manually set up the broken state (in real D1, UNIQUE would prevent this)
      state.users[0].referral_code_applied = 'BUDI03';
      state.codes.push({ id: 1, code: 'BUDI03', reseller_id: 1, is_active: 1, total_uses: 0, total_revenue_stars: 0, total_commission_stars: 0, notes: null, created_at: new Date().toISOString() });
      const attr = await attributeOnPurchase(env, { customerId: 1, paymentId: 100, planDays: 30, planAmountStars: 1238 });
      expect(attr).toBeNull();
    });
  });

  describe('processPendingAttributions', () => {
    it('confirms pending attributions after 7 days if payment completed', async () => {
      await createCode(env, { code: 'BUDI03', resellerId: 3 });
      await applyCodeToCustomer(env, { code: 'BUDI03', customerId: 1 });
      // Insert attribution manually with old created_at
      state.attributions.push({
        id: 1, code_id: 1, reseller_id: 3, customer_id: 1, payment_id: 100,
        plan_days: 30, plan_amount_stars: 1238, commission_rate: 20,
        commission_amount_stars: 247, status: 'pending', confirmed_at: null,
        paid_at: null, payout_method: null, payout_reference: null, notes: null,
        created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
      });
      state.paymentRequests.push({ id: 100, status: 'completed' });

      const result = await processPendingAttributions(env, new Date());
      expect(result.confirmed).toBe(1);
      expect(result.clawedBack).toBe(0);
      const attr = state.attributions[0];
      expect(attr.status).toBe('confirmed');
      expect(attr.confirmed_at).not.toBeNull();
    });

    it('claws back if payment was refunded', async () => {
      await createCode(env, { code: 'BUDI03', resellerId: 3 });
      state.attributions.push({
        id: 1, code_id: 1, reseller_id: 3, customer_id: 1, payment_id: 200,
        plan_days: 30, plan_amount_stars: 1238, commission_rate: 20,
        commission_amount_stars: 247, status: 'pending', confirmed_at: null,
        paid_at: null, payout_method: null, payout_reference: null, notes: null,
        created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
      });
      state.paymentRequests.push({ id: 200, status: 'refunded' });

      const result = await processPendingAttributions(env, new Date());
      expect(result.clawedBack).toBe(1);
      expect(state.attributions[0].status).toBe('clawback');
    });

    it('skips if payment is still pending', async () => {
      await createCode(env, { code: 'BUDI03', resellerId: 3 });
      state.attributions.push({
        id: 1, code_id: 1, reseller_id: 3, customer_id: 1, payment_id: 300,
        plan_days: 30, plan_amount_stars: 1238, commission_rate: 20,
        commission_amount_stars: 247, status: 'pending', confirmed_at: null,
        paid_at: null, payout_method: null, payout_reference: null, notes: null,
        created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
      });
      state.paymentRequests.push({ id: 300, status: 'pending' });

      const result = await processPendingAttributions(env, new Date());
      expect(result.skipped).toBe(1);
      expect(state.attributions[0].status).toBe('pending'); // unchanged
    });
  });

  describe('clawbackOnRefund', () => {
    it('flips pending and confirmed attributions to clawback', async () => {
      state.attributions.push(
        { id: 1, code_id: 1, reseller_id: 3, customer_id: 1, payment_id: 100, status: 'pending', commission_amount_stars: 100, created_at: '' } as any,
        { id: 2, code_id: 1, reseller_id: 3, customer_id: 2, payment_id: 100, status: 'confirmed', commission_amount_stars: 200, created_at: '' } as any,
        { id: 3, code_id: 1, reseller_id: 3, customer_id: 3, payment_id: 999, status: 'paid', commission_amount_stars: 300, created_at: '' } as any,
      );
      const changes = await clawbackOnRefund(env, 100);
      expect(changes).toBe(2); // only pending + confirmed, not paid
      expect(state.attributions[0].status).toBe('clawback');
      expect(state.attributions[1].status).toBe('clawback');
      expect(state.attributions[2].status).toBe('paid'); // unchanged
    });
  });

  describe('getResellerStats', () => {
    it('returns counts per status', async () => {
      state.attributions.push(
        { id: 1, reseller_id: 3, customer_id: 1, status: 'pending', commission_amount_stars: 100, created_at: '' } as any,
        { id: 2, reseller_id: 3, customer_id: 2, status: 'pending', commission_amount_stars: 100, created_at: '' } as any,
        { id: 3, reseller_id: 3, customer_id: 3, status: 'confirmed', commission_amount_stars: 200, created_at: '' } as any,
        { id: 4, reseller_id: 3, customer_id: 4, status: 'paid', commission_amount_stars: 300, created_at: '' } as any,
      );
      state.codes.push({ id: 1, code: 'BUDI03', reseller_id: 3, is_active: 1, total_uses: 4, total_revenue_stars: 5000, total_commission_stars: 700, notes: null, created_at: '' });
      const stats = await getResellerStats(env, 3);
      expect(stats.pending.count).toBe(2);
      expect(stats.confirmed.count).toBe(1);
      expect(stats.paid.count).toBe(1);
      expect(stats.total_revenue_stars).toBe(5000);
    });
  });

  describe('bank payout flow', () => {
    it('creates a payout request and reserves the attributions', async () => {
      // Seed: 2 confirmed attributions
      state.attributions.push(
        { id: 1, code_id: 1, reseller_id: 3, customer_id: 1, status: 'confirmed', commission_amount_stars: 100, created_at: '', payment_id: 100, plan_days: 30, plan_amount_stars: 1238, commission_rate: 20, confirmed_at: '', paid_at: null, payout_method: null, payout_reference: null, notes: null } as any,
        { id: 2, code_id: 1, reseller_id: 3, customer_id: 2, status: 'confirmed', commission_amount_stars: 200, created_at: '', payment_id: 101, plan_days: 90, plan_amount_stars: 3375, commission_rate: 20, confirmed_at: '', paid_at: null, payout_method: null, payout_reference: null, notes: null } as any,
      );
      const result = await createBankPayoutRequest(env, 3);
      expect(result?.totalAmountStars).toBe(300);
      expect(result?.attributionCount).toBe(2);
      expect(state.payouts.length).toBe(1);
      // Attributions should be reserved (status='pending', payout_method='bank')
      expect(state.attributions[0].status).toBe('pending');
      expect(state.attributions[0].payout_method).toBe('bank');
      expect(state.attributions[1].status).toBe('pending');
    });

    it('returns null when no confirmed balance', async () => {
      const result = await createBankPayoutRequest(env, 3);
      expect(result).toBeNull();
    });

    it('completeBankPayout marks the batch + attributions as paid', async () => {
      // Seed: 1 confirmed attribution
      state.attributions.push(
        { id: 5, code_id: 1, reseller_id: 3, customer_id: 1, status: 'pending', commission_amount_stars: 150, created_at: '', payment_id: 100, plan_days: 30, plan_amount_stars: 1238, commission_rate: 20, confirmed_at: '', paid_at: null, payout_method: 'bank', payout_reference: '99', notes: 'reserved' } as any,
      );
      state.payouts.push({ id: 99, reseller_id: 3, total_amount_stars: 150, attribution_ids: '[5]', method: 'bank', status: 'pending', reference: null, notes: null, created_at: '', completed_at: null });
      const result = await completeBankPayout(env, { payoutId: 99, reference: 'BCA-2026-06-02' });
      expect(result?.updated).toBe(1);
      expect(state.attributions[0].status).toBe('paid');
      expect(state.attributions[0].paid_at).not.toBeNull();
      expect(state.payouts[0].status).toBe('completed');
      expect(state.payouts[0].reference).toBe('BCA-2026-06-02');
    });
  });

  describe('promoteToReseller', () => {
    it('promotes a student to reseller', async () => {
      const result = await promoteToReseller(env, 1);
      expect(result.updated).toBe(true);
      expect(state.users[0].role).toBe('reseller');
    });

    it('is idempotent if already reseller', async () => {
      const result = await promoteToReseller(env, 3);
      expect(result.updated).toBe(false);
      expect(state.users[2].role).toBe('reseller');
    });
  });

  describe('listPendingPayouts', () => {
    it('returns pending bank payouts with reseller info', async () => {
      state.payouts.push({ id: 1, reseller_id: 3, total_amount_stars: 200, attribution_ids: '[]', method: 'bank', status: 'pending', reference: null, notes: null, created_at: '', completed_at: null });
      const list = await listPendingPayouts(env);
      expect(list.length).toBe(1);
    });
  });

  describe('PLAN_PRICING matches /buy options', () => {
    it('has 5 tiers', () => {
      const keys = Object.keys(PLAN_PRICING).map(k => Number(k)).sort((a, b) => a - b);
      expect(keys).toEqual([7, 30, 90, 180, 365]);
    });

    it('commission for a 365-day plan is 20%', () => {
      const commission = Math.floor((PLAN_PRICING[365] * COMMISSION_RATE_DEFAULT) / 100);
      // 11875 * 0.2 = 2375
      expect(commission).toBe(2375);
    });
  });
});
