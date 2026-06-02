// E2E integration test for the new /syllabus feature
// Tests the full webhook flow: /syllabus → test picker → section → topic → render
// Plus all the new content callbacks: grammar, vocab, strategies

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleWebhook } from './webhook';

const user = {
  id: 1,
  telegram_id: '123',
  name: 'Bayu Santoso',
  role: 'student',
  target_test: 'TOEFL_IBT',
  proficiency_level: 'B1',
  onboarding_complete: 1,
  is_premium: 1,
};

// Mock lesson topics to return (subset of 080 seed data)
const mockLessonTopics = [
  {
    id: 1, topic_key: 'toefl_ibt_reading_factual', test_type: 'TOEFL_IBT',
    section: 'reading', subcategory: 'question_type', name: 'Factual Information Questions',
    description: 'Locate specific facts stated in the passage', theory: 'Tests ability to identify explicitly-stated information.',
    key_strategies: '1. Read the question first\n2. Scan for keywords\n3. Read the sentence carefully',
    common_mistakes: 'Choosing an answer from a different paragraph.',
    example_prompt: 'According to the paragraph, what is true about X?',
    cefr_level: 'B1', frequency: 'high', order_index: 10,
  },
  {
    id: 2, topic_key: 'toefl_ibt_reading_inference', test_type: 'TOEFL_IBT',
    section: 'reading', subcategory: 'question_type', name: 'Inference Questions',
    description: 'Draw a conclusion that is implied but not directly stated',
    theory: 'The answer is NOT stated directly — it must be LOGICALLY CONCLUDED.',
    key_strategies: '1. Eliminate contradicting choices\n2. Skip direct statements\n3. Test logically',
    common_mistakes: 'Going too far beyond what the passage supports.',
    example_prompt: 'Which can be inferred?',
    cefr_level: 'B2', frequency: 'high', order_index: 12,
  },
];

const mockGrammarTopics = [
  {
    id: 1, topic_key: 'present_simple', category: 'tense', subcategory: 'simple',
    name: 'Present Simple', description: 'Habits and general truths',
    cefr_level: 'A1', rule: 'Subject + base verb (+s for he/she/it).',
    examples: 'I work at a tech company.\nShe studies English every day.',
    common_mistakes: 'Forgetting third-person -s.',
    tested_in: '["TOEFL_IBT","IELTS","TOEIC"]', frequency: 'high',
  },
];

const mockVocabulary = [
  {
    id: 1, word: 'curriculum', ipa: '/kəˈrɪkjələm/', pos: 'noun',
    definition: 'The subjects studied in a course', indonesian: 'kurikulum',
    example: 'The school updated its curriculum.',
    topic: 'education', cefr_level: 'B1', tested_in: '["TOEFL_IBT","IELTS"]',
    frequency: 'high', word_family: 'curricula', collocations: 'core curriculum',
  },
];

const mockStrategies = [
  {
    id: 1, strategy_key: 'toefl_ibt_pacing', test_type: 'TOEFL_IBT', category: 'pacing',
    name: 'TOEFL iBT Pacing Strategy', description: 'Time allocation per question',
    framework: 'Reading: 54-72 min / 30 questions',
    key_actions: '1. Practice with stopwatch\n2. Skip hard passages',
    examples: 'Passage 1: 20 min, Passage 2: 20 min',
    cefr_level: 'B1',
  },
];

const mockSyllabusSummary = {
  testLabel: 'TOEFL iBT',
  sections: [
    { section: 'reading', count: 10, topics: mockLessonTopics },
    { section: 'listening', count: 5, topics: [] },
  ],
  grammarCategories: [{ category: 'tense', count: 12 }],
  vocabTopics: [{ topic: 'education', count: 5 }],
  strategies: [{ category: 'pacing', count: 2 }],
};

vi.mock('../services/syllabus', () => ({
  // Surface
  syllabusTestKeyboard: () => ({ inline_keyboard: [[{ text: '🇺🇸 TOEFL iBT', callback_data: 'syl_test_TOEFL_IBT' }]] }),
  syllabusSectionKeyboard: () => ({ inline_keyboard: [[{ text: '📖 Reading', callback_data: 'syl_sec_TOEFL_IBT_reading' }]] }),
  syllabusTopicListKeyboard: () => ({ inline_keyboard: [[{ text: '📌 Topic', callback_data: 'syl_topic_X' }]] }),
  syllabusGrammarCategoryKeyboard: () => ({ inline_keyboard: [[{ text: '⏱ Tenses', callback_data: 'syl_gcat_TOEFL_IBT_tense' }]] }),
  syllabusVocabTopicKeyboard: () => ({ inline_keyboard: [[{ text: '📚 Education', callback_data: 'syl_vtopic_TOEFL_IBT_education' }]] }),
  syllabusStrategyCategoryKeyboard: () => ({ inline_keyboard: [[{ text: '⏱ Pacing', callback_data: 'syl_scat_TOEFL_IBT_pacing' }]] }),

  // Data functions
  listLessonTopics: vi.fn(async () => mockLessonTopics),
  getLessonTopic: vi.fn(async (_env: any, key: string) =>
    mockLessonTopics.find(t => t.topic_key === key) || null
  ),
  listGrammarTopics: vi.fn(async () => mockGrammarTopics),
  getGrammarTopic: vi.fn(async (_env: any, key: string) =>
    mockGrammarTopics.find(g => g.topic_key === key) || null
  ),
  listVocabulary: vi.fn(async () => mockVocabulary),
  listVocabularyTopicsForTest: vi.fn(async () => [{ topic: 'education', count: 5 }]),
  listTestStrategies: vi.fn(async () => mockStrategies),
  getTestStrategy: vi.fn(async (_env: any, key: string) =>
    mockStrategies.find(s => s.strategy_key === key) || null
  ),
  getSyllabusSummary: vi.fn(async () => mockSyllabusSummary),
  listVocabTopics: vi.fn(async () => [{ topic: 'education', count: 5 }]),

  // Render
  renderLessonTopic: vi.fn((t: any) => `*${t.name}*\n${t.description || ''}\n\nStrategi:\n${t.key_strategies || ''}`),
  renderGrammarTopic: vi.fn((t: any) => `*${t.name}*\n${t.description || ''}\n\nRule: ${t.rule || ''}`),
  renderVocabWord: vi.fn((w: any, i?: number) => `${i ? i + '. ' : ''}*${w.word}* ${w.ipa || ''} - ${w.indonesian || ''}`),
  renderTestStrategy: vi.fn((s: any) => `*${s.name}*\n${s.description || ''}\n\nFramework:\n${s.framework || ''}`),
  getTestLabel: vi.fn((t: string) => t),
  getTestEmoji: vi.fn(() => '🇺🇸'),
  getSectionLabel: vi.fn((s: string) => s),
}));

vi.mock('../services/scene-image', () => ({
  getOrGenerateSceneImage: vi.fn(async () => null),
}));

vi.mock('../services/companion-nudge', () => ({
  maybeAppendNudge: vi.fn(async () => ''),
  toggleTips: vi.fn(async () => ''),
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

describe('syllabus webhook surface', () => {
  const sentTexts: string[] = [];
  const sentMarkups: any[] = [];

  beforeEach(() => {
    sentTexts.length = 0;
    sentMarkups.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.body && typeof init.body === 'string') {
        const body = JSON.parse(init.body);
        if (body.text) sentTexts.push(body.text);
        if (body.reply_markup) sentMarkups.push(body.reply_markup);
      }
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 99 } }) };
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ----------------------------------------------------------------
  // /syllabus command
  // ----------------------------------------------------------------
  it('responds to /syllabus with a test picker', async () => {
    await handleWebhook({
      message: { chat: { id: 123 }, from: { id: 123, first_name: 'Bayu' }, text: '/syllabus' },
    }, env);

    const text = sentTexts.at(-1) || '';
    expect(text).toContain('Syllabus Lengkap');
    expect(text).toContain('Pilih tes');
    expect(sentMarkups.at(-1)?.inline_keyboard).toBeDefined();
  });

  // ----------------------------------------------------------------
  // syllabus callback (bare)
  // ----------------------------------------------------------------
  it('responds to bare syllabus callback', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'syllabus',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    expect(sentTexts.at(-1)).toContain('Syllabus Lengkap');
  });

  // ----------------------------------------------------------------
  // syl_test_TOEFL_IBT — show section menu with summary
  // ----------------------------------------------------------------
  it('shows section picker for selected test', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'syl_test_TOEFL_IBT',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const text = sentTexts.at(-1) || '';
    expect(text).toContain('Syllabus');
    expect(text).toContain('TOEFL_IBT');
    expect(text).toContain('lesson topics');
    expect(sentMarkups.at(-1)?.inline_keyboard).toBeDefined();
  });

  // ----------------------------------------------------------------
  // syl_sec_TOEFL_IBT_reading — show topic list
  // ----------------------------------------------------------------
  it('shows topic list for test+section', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'syl_sec_TOEFL_IBT_reading',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const text = sentTexts.at(-1) || '';
    expect(text).toContain('reading');
    expect(text).toContain('topik tersedia');
    expect(sentMarkups.at(-1)?.inline_keyboard).toBeDefined();
  });

  // ----------------------------------------------------------------
  // syl_topic_<KEY> — show topic detail
  // ----------------------------------------------------------------
  it('shows lesson topic detail', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'syl_topic_toefl_ibt_reading_factual',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const text = sentTexts.at(-1) || '';
    expect(text).toContain('Factual Information Questions');
    expect(text).toContain('Strategi');
    // Back button to section
    const lastKb = sentMarkups.at(-1)?.inline_keyboard;
    expect(JSON.stringify(lastKb)).toContain('syl_sec');
  });

  // ----------------------------------------------------------------
  // syl_grammar_TOEFL_IBT — grammar category picker
  // ----------------------------------------------------------------
  it('shows grammar category picker', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'syl_grammar_TOEFL_IBT',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    expect(sentTexts.at(-1)).toContain('Grammar');
    expect(sentMarkups.at(-1)?.inline_keyboard).toBeDefined();
  });

  // ----------------------------------------------------------------
  // syl_gcat_TOEFL_IBT_tense — grammar topic list
  // ----------------------------------------------------------------
  it('shows grammar topics in category', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'syl_gcat_TOEFL_IBT_tense',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const text = sentTexts.at(-1) || '';
    expect(text).toContain('tense');
    expect(text).toContain('Present Simple');
  });

  // ----------------------------------------------------------------
  // syl_gtopic_<KEY> — grammar topic detail
  // ----------------------------------------------------------------
  it('shows grammar topic detail', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'syl_gtopic_present_simple',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const text = sentTexts.at(-1) || '';
    expect(text).toContain('Present Simple');
    expect(text).toContain('Rule');
  });

  // ----------------------------------------------------------------
  // syl_vocab_TOEFL_IBT — vocab topic picker
  // ----------------------------------------------------------------
  it('shows vocab topic picker', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'syl_vocab_TOEFL_IBT',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const text = sentTexts.at(-1) || '';
    expect(text).toContain('Vocabulary');
    expect(text).toContain('kata dalam');
    expect(text).toContain('topik');
  });

  // ----------------------------------------------------------------
  // syl_vtopic_TOEFL_IBT_education — vocab words
  // ----------------------------------------------------------------
  it('shows vocab words for topic', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'syl_vtopic_TOEFL_IBT_education',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const text = sentTexts.at(-1) || '';
    expect(text).toContain('education');
    expect(text).toContain('curriculum');
    expect(text).toContain('kurikulum');
  });

  // ----------------------------------------------------------------
  // syl_strat_TOEFL_IBT — strategy category picker
  // ----------------------------------------------------------------
  it('shows strategy category picker', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'syl_strat_TOEFL_IBT',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const text = sentTexts.at(-1) || '';
    expect(text).toContain('Strategies');
    // 'pacing' should appear in the keyboard (callback_data)
    expect(JSON.stringify(sentMarkups.at(-1)?.inline_keyboard)).toContain('pacing');
  });

  // ----------------------------------------------------------------
  // syl_scat_TOEFL_IBT_pacing — strategy list
  // ----------------------------------------------------------------
  it('shows strategies in category', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'syl_scat_TOEFL_IBT_pacing',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const text = sentTexts.at(-1) || '';
    expect(text).toContain('pacing');
    expect(text).toContain('TOEFL iBT Pacing Strategy');
  });

  // ----------------------------------------------------------------
  // syl_s_<KEY> — strategy detail
  // ----------------------------------------------------------------
  it('shows strategy detail', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'syl_s_toefl_ibt_pacing',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const text = sentTexts.at(-1) || '';
    expect(text).toContain('TOEFL iBT Pacing Strategy');
    expect(text).toContain('Framework');
  });

  // ----------------------------------------------------------------
  // /study menu now includes syllabus button
  // ----------------------------------------------------------------
  it('includes syllabus button in /study menu', async () => {
    await handleWebhook({
      message: { chat: { id: 123 }, from: { id: 123, first_name: 'Bayu' }, text: '/study' },
    }, env);

    const lastKb = sentMarkups.at(-1);
    expect(JSON.stringify(lastKb)).toContain('Syllabus');
    expect(JSON.stringify(lastKb)).toContain('syllabus');
  });

  // ----------------------------------------------------------------
  // Empty section shows graceful message
  // ----------------------------------------------------------------
  it('handles missing section gracefully', async () => {
    // Override mock to return empty
    const { listLessonTopics } = await import('../services/syllabus');
    (listLessonTopics as any).mockResolvedValueOnce([]);

    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'syl_sec_TOEFL_IBT_reading',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    // Should have sent a "no topics" message
    const hasEmptyMsg = sentTexts.some(t => t.includes('Belum ada topik'));
    expect(hasEmptyMsg).toBe(true);
  });

  // ----------------------------------------------------------------
  // study_topics_<section> — inline lesson topics (wired into /study)
  // ----------------------------------------------------------------
  it('study_topics_reading uses user.target_test', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'study_topics_reading',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const text = sentTexts.at(-1) || '';
    // user.target_test is TOEFL_IBT in the mock
    expect(text).toContain('TOEFL_IBT');
    expect(text).toContain('reading');
    expect(text).toContain('lesson topics');
  });

  it('study_topics_listening shows listening topics', async () => {
    // Override mock for listening
    const { listLessonTopics } = await import('../services/syllabus');
    (listLessonTopics as any).mockResolvedValueOnce([
      { id: 100, topic_key: 'toefl_ibt_listening_main_idea', test_type: 'TOEFL_IBT',
        section: 'listening', name: 'Gist-Content (Main Idea)', frequency: 'high', cefr_level: 'B1',
        order_index: 20 },
    ]);

    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'study_topics_listening',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    expect(sentTexts.at(-1)).toContain('listening');
    expect(sentTexts.at(-1)).toContain('1 lesson topic');
  });

  // ----------------------------------------------------------------
  // Section keyboards in /study now include Lesson Topics button
  // ----------------------------------------------------------------
  it('cat_reading keyboard includes Lesson Topics button', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'cat_reading',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const lastKb = sentMarkups.at(-1);
    const kbStr = JSON.stringify(lastKb);
    expect(kbStr).toContain('Lesson Topics');
    expect(kbStr).toContain('study_topics_reading');
  });

  it('cat_listening keyboard includes Lesson Topics button', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'cat_listening',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const kbStr = JSON.stringify(sentMarkups.at(-1));
    expect(kbStr).toContain('study_topics_listening');
  });

  it('cat_speaking keyboard includes Lesson Topics button', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'cat_speaking',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const kbStr = JSON.stringify(sentMarkups.at(-1));
    expect(kbStr).toContain('study_topics_speaking');
  });

  it('cat_writing keyboard includes Lesson Topics button', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'cat_writing',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const kbStr = JSON.stringify(sentMarkups.at(-1));
    expect(kbStr).toContain('study_topics_writing');
  });

  it('cat_grammar keyboard includes Grammar Syllabus button', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'cat_grammar',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const kbStr = JSON.stringify(sentMarkups.at(-1));
    expect(kbStr).toContain('syl_grammar_TOEFL_IBT');
  });

  it('cat_vocab keyboard includes Vocabulary Bank button', async () => {
    await handleWebhook({
      callback_query: {
        id: 'cb', data: 'cat_vocab',
        from: { id: 123, first_name: 'Bayu' },
        message: { message_id: 1, chat: { id: 123 } },
      },
    }, env);

    const kbStr = JSON.stringify(sentMarkups.at(-1));
    expect(kbStr).toContain('syl_vocab_TOEFL_IBT');
  });
});
