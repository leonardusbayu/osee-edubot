import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendResellerBroadcast, getLastMessageSent, getResellerMessageHistory, type MessageTarget } from './reseller-messaging';

function makeMockDb() {
  const messages: any[] = [];
  const todayStart = new Date(new Date().toISOString().split('T')[0]).toISOString();
  const db: any = {
    prepare(sql: string) {
      return {
        bind(...params: any[]) {
          const bound = { sql, params };
          return {
            async first<T = any>(): Promise<T | null> {
              return runFirst(bound, { messages, todayStart }) as T | null;
            },
            async all<T = any>(): Promise<{ results: T[] }> {
              return runAll(bound, { messages, todayStart }) as { results: T[] };
            },
            async run(): Promise<any> {
              return runExec(bound, { messages });
            },
          };
        },
      };
    },
  };
  return { db: { DB: db, ...db }, messages, todayStart };
}

function runFirst(bound: { sql: string; params: any[] }, state: any): any {
  const { sql, params } = bound;
  if (sql.includes('SELECT COUNT(DISTINCT broadcast_id) as cnt')) {
    const cutoff = state.todayStart;
    const distinctBroadcasts = new Set(
      state.messages.filter((m: any) => m.reseller_id === params[0] && m.sent_at >= cutoff).map((m: any) => m.broadcast_id)
    );
    return { cnt: distinctBroadcasts.size };
  }
  if (sql.includes('SELECT id FROM reseller_messages') && sql.includes('sent_at >=')) {
    const cutoff = params[2];
    const found = state.messages.find((m: any) =>
      m.reseller_id === params[0] && m.customer_id === params[1] && m.sent_at >= cutoff
    );
    return found || null;
  }
  if (sql.includes('SELECT sent_at, message_text FROM reseller_messages') && sql.includes('ORDER BY sent_at DESC LIMIT 1')) {
    const list = state.messages
      .filter((m: any) => m.reseller_id === params[0] && m.customer_id === params[1])
      .sort((a: any, b: any) => b.sent_at.localeCompare(a.sent_at));
    return list[0] || null;
  }
  return null;
}

function runAll(bound: { sql: string; params: any[] }, state: any): { results: any[] } {
  const { sql, params } = bound;
  if (sql.includes('SELECT m.sent_at, m.broadcast_id, m.message_text')) {
    return {
      results: state.messages
        .filter((m: any) => m.reseller_id === params[0])
        .sort((a: any, b: any) => b.sent_at.localeCompare(a.sent_at))
        .slice(0, params[1] || 50)
        .map((m: any) => ({ ...m, _customer: { id: m.customer_id, name: 'X', telegram_id: '999' } })),
    };
  }
  return { results: [] };
}

function runExec(bound: { sql: string; params: any[] }, state: any): any {
  const { sql, params } = bound;
  if (sql.startsWith('INSERT INTO reseller_messages')) {
    const id = state.messages.length + 1;
    state.messages.push({
      id,
      reseller_id: params[0],
      customer_id: params[1],
      message_text: params[2],
      broadcast_id: params[3],
      sent_at: new Date().toISOString(),
    });
    return { success: true, meta: { last_row_id: id, changes: 1 } };
  }
  return { success: true, meta: { changes: 0, last_row_id: 0 } };
}

describe('reseller-messaging', () => {
  let env: any;
  let state: ReturnType<typeof makeMockDb>;
  const BOT_TOKEN = 'test-bot-token';

  beforeEach(() => {
    state = makeMockDb();
    env = state.db;
    // Reset fetch mock
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      // simulate Telegram API success
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 1 } }) };
    }));
  });

  describe('sendResellerBroadcast', () => {
    const targets: MessageTarget[] = [
      { customer_id: 100, customer_telegram_id: '111', customer_name: 'Andi' },
      { customer_id: 101, customer_telegram_id: '222', customer_name: 'Budi' },
    ];

    it('sends message to all targets and logs them', async () => {
      const result = await sendResellerBroadcast(env, {
        resellerId: 1, message: 'Hello!', targets, botToken: BOT_TOKEN,
      });
      expect(result.sent).toBe(2);
      expect(result.rate_limited).toBe(0);
      expect(result.telegram_errors).toBe(0);
      expect(result.blocked_by_daily_cap).toBe(false);
      expect(state.messages.length).toBe(2);
      expect(state.messages.every((m: any) => m.broadcast_id === result.broadcast_id)).toBe(true);
    });

    it('returns empty result for empty message', async () => {
      const result = await sendResellerBroadcast(env, {
        resellerId: 1, message: '   ', targets, botToken: BOT_TOKEN,
      });
      expect(result.attempted).toBe(0);
      expect(result.sent).toBe(0);
      expect(state.messages.length).toBe(0);
    });

    it('rejects too-long messages', async () => {
      await expect(sendResellerBroadcast(env, {
        resellerId: 1, message: 'x'.repeat(1001), targets, botToken: BOT_TOKEN,
      })).rejects.toThrow(/terlalu panjang/i);
    });

    it('blocks when reseller has hit daily cap (3 broadcasts)', async () => {
      // Seed 3 broadcasts today
      for (let i = 0; i < 3; i++) {
        state.messages.push({
          id: i + 1, reseller_id: 1, customer_id: 50 + i,
          message_text: 'old', broadcast_id: `bcast_old_${i}`,
          sent_at: new Date().toISOString(),
        });
      }
      const result = await sendResellerBroadcast(env, {
        resellerId: 1, message: 'new', targets, botToken: BOT_TOKEN,
      });
      expect(result.blocked_by_daily_cap).toBe(true);
      expect(result.sent).toBe(0);
    });

    it('skips customers in 7-day cooldown', async () => {
      // Seed a recent message to customer 100 (within 7 days)
      const recent = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
      state.messages.push({
        id: 1, reseller_id: 1, customer_id: 100,
        message_text: 'recent', broadcast_id: 'bcast_recent',
        sent_at: recent,
      });
      const result = await sendResellerBroadcast(env, {
        resellerId: 1, message: 'new', targets, botToken: BOT_TOKEN,
      });
      expect(result.sent).toBe(1);   // only customer 101
      expect(result.rate_limited).toBe(1);  // customer 100 skipped
    });

    it('counts telegram API failures as errors', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ ok: false }) })));
      const result = await sendResellerBroadcast(env, {
        resellerId: 1, message: 'hello', targets, botToken: BOT_TOKEN,
      });
      expect(result.telegram_errors).toBe(2);
      expect(result.sent).toBe(0);
    });
  });

  describe('getLastMessageSent', () => {
    it('returns the most recent message', async () => {
      const now = new Date().toISOString();
      state.messages.push(
        { id: 1, reseller_id: 1, customer_id: 100, message_text: 'old', broadcast_id: 'b1', sent_at: '2026-01-01' },
        { id: 2, reseller_id: 1, customer_id: 100, message_text: 'newer', broadcast_id: 'b2', sent_at: '2026-02-01' },
      );
      const last = await getLastMessageSent(env, { resellerId: 1, customerId: 100 });
      expect(last?.message_text).toBe('newer');
    });

    it('returns null when no message has been sent', async () => {
      const last = await getLastMessageSent(env, { resellerId: 1, customerId: 999 });
      expect(last).toBeNull();
    });
  });

  describe('getResellerMessageHistory', () => {
    it('returns messages in reverse chronological order', async () => {
      state.messages.push(
        { id: 1, reseller_id: 1, customer_id: 100, message_text: 'A', broadcast_id: 'b1', sent_at: '2026-01-01' },
        { id: 2, reseller_id: 1, customer_id: 100, message_text: 'B', broadcast_id: 'b2', sent_at: '2026-02-01' },
        { id: 3, reseller_id: 2, customer_id: 200, message_text: 'C', broadcast_id: 'b3', sent_at: '2026-03-01' },
      );
      const history = await getResellerMessageHistory(env, 1, 10);
      expect(history.length).toBe(2);  // only reseller 1
      expect(history[0].message_text).toBe('B');
      expect(history[1].message_text).toBe('A');
    });
  });
});
