import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleWebhook } from './webhook';

vi.mock('../services/scene-image', () => ({
  getOrGenerateSceneImage: vi.fn(async () => null),
}));

const user = {
  id: 1,
  telegram_id: '123',
  name: 'Bayu Santoso',
  role: 'student',
  target_test: 'TOEIC',
  proficiency_level: 'intermediate',
  onboarding_complete: 1,
  is_premium: 0,
};

function makeEnv() {
  return {
    TELEGRAM_BOT_TOKEN: 'test-token',
    OPENAI_API_KEY: 'test-openai-key',
    WEBAPP_URL: 'https://example.com',
    DB: {
      prepare(sql: string) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes('SELECT * FROM users WHERE telegram_id')) return user;
                if (sql.includes('SELECT * FROM users WHERE id')) return user;
                return null;
              },
              async all() {
                return { results: [] };
              },
              async run() {
                return { success: true };
              },
            };
          },
        };
      },
    },
  } as any;
}

describe('daily lesson webhook QA', () => {
  const sent: Array<{ method: string; text?: string; reply_markup?: unknown }> = [];

  beforeEach(() => {
    sent.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.body && typeof init.body === 'string') {
        const body = JSON.parse(init.body);
        sent.push({ method: url.split('/').at(-1) || '', text: body.text, reply_markup: body.reply_markup });
      }
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 42 } }) };
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('opens a target-aware enriched study menu', async () => {
    await handleWebhook({ message: { chat: { id: 123 }, from: { id: 123, first_name: 'Bayu' }, text: '/study' } }, makeEnv());

    expect(sent.at(-1)?.text).toContain('Menu Belajar');
    expect(sent.at(-1)?.text).toContain('TOEIC');
    expect(JSON.stringify(sent.at(-1)?.reply_markup)).toContain('Lesson Hari Ini');
  });

  it('sends the daily lesson from the study_lesson callback', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb1',
        from: { id: 123, first_name: 'Bayu' },
        message: { chat: { id: 123 }, message_id: 77 },
        data: 'study_lesson',
      },
    }, makeEnv());

    const lessonMessage = sent.find((m) => m.text?.includes('Lesson hari ini buat TOEIC'));
    expect(lessonMessage?.text).toContain('Micro-lesson');
    expect(lessonMessage?.text).toContain('Coba sekarang');
    expect(JSON.stringify(lessonMessage?.reply_markup)).toContain('Latih fokus ini');
  });
});
