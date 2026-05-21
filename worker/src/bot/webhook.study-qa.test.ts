import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleWebhook } from './webhook';

const user = {
  id: 1,
  telegram_id: '123',
  name: 'Bayu Santoso',
  target_test: 'TOEIC',
  onboarding_complete: 1,
  is_premium: 0,
};

vi.mock('../services/premium', () => ({
  checkTestAccess: vi.fn(async () => ({ allowed: true, used_today: 0, daily_limit: 10 })),
  trackQuestionAnswer: vi.fn(async () => ({ upgradeNudge: false })),
}));

vi.mock('../services/scene-image', () => ({
  getOrGenerateSceneImage: vi.fn(async () => ({ bytes: new ArrayBuffer(4), mime_type: 'image/png' })),
}));

function makeDb() {
  return {
    prepare(_sql: string) {
      return {
        bind() {
          return {
            async first() {
              return user;
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
  };
}

const env = {
  DB: makeDb(),
  TELEGRAM_BOT_TOKEN: 'test-token',
  OPENAI_API_KEY: 'test-openai-key',
  WEBAPP_URL: 'https://example.com',
} as any;

describe('study webhook surface', () => {
  const sentTexts: string[] = [];
  const photoCalls: string[] = [];

  beforeEach(() => {
    sentTexts.length = 0;
    photoCalls.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/sendPhoto')) photoCalls.push(String(url));
      if (init?.body && typeof init.body === 'string') {
        const body = JSON.parse(init.body);
        if (body.text) sentTexts.push(body.text);
      }
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 99 } }) };
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a target-aware rich study menu', async () => {
    await handleWebhook({ message: { chat: { id: 123 }, from: { id: 123, first_name: 'Bayu' }, text: '/study' } }, env);

    expect(sentTexts.at(-1)).toContain('Menu Belajar');
    expect(sentTexts.at(-1)).toContain('TOEIC');
    expect(sentTexts.at(-1)).toContain('Lesson Hari Ini');
  });

  it('opens the daily lesson with an image attempt and practice CTA', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb-1',
        data: 'study_lesson',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 10, chat: { id: 123 } },
      },
    }, env);

    expect(photoCalls).toHaveLength(1);
    expect(sentTexts.join('\n')).toContain('Lesson hari ini buat TOEIC');
    expect(sentTexts.join('\n')).toContain('Micro-lesson');
    expect(sentTexts.join('\n')).toContain('/study');
  });
});
