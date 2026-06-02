// Syllabus Service — comprehensive lesson content for all 4 tests
// Pulls from: lesson_topics (080), grammar_topics (078), vocabulary_banks (079, 082),
//             test_strategies (081)

import type { Env } from '../types';

export interface LessonTopic {
  id: number;
  topic_key: string;
  test_type: string;
  section: string;
  subcategory: string | null;
  name: string;
  description: string | null;
  theory: string | null;
  key_strategies: string | null;
  common_mistakes: string | null;
  example_prompt: string | null;
  cefr_level: string;
  frequency: string;
  order_index: number;
}

export interface GrammarTopic {
  id: number;
  topic_key: string;
  category: string;
  subcategory: string | null;
  name: string;
  description: string | null;
  cefr_level: string;
  rule: string | null;
  examples: string | null;
  common_mistakes: string | null;
  tested_in: string;
  frequency: string;
}

export interface VocabWord {
  id: number;
  word: string;
  ipa: string | null;
  pos: string | null;
  definition: string | null;
  indonesian: string | null;
  example: string | null;
  topic: string;
  cefr_level: string;
  tested_in: string;
  frequency: string;
  word_family: string | null;
  collocations: string | null;
}

export interface TestStrategy {
  id: number;
  strategy_key: string;
  test_type: string;
  category: string;
  name: string;
  description: string | null;
  framework: string | null;
  key_actions: string | null;
  examples: string | null;
  cefr_level: string;
}

const TEST_LABELS: Record<string, { label: string; emoji: string }> = {
  TOEFL_IBT: { label: 'TOEFL iBT', emoji: '🇺🇸' },
  TOEFL_ITP: { label: 'TOEFL ITP', emoji: '📚' },
  TOEIC: { label: 'TOEIC', emoji: '🏢' },
  IELTS: { label: 'IELTS', emoji: '🇬🇧' },
  ALL: { label: 'Semua Tes', emoji: '🌐' },
};

const SECTION_LABELS: Record<string, string> = {
  reading: '📖 Reading',
  listening: '🎧 Listening',
  speaking: '🗣 Speaking',
  writing: '✍️ Writing',
  grammar: '📝 Grammar',
  vocabulary: '📚 Vocabulary',
  integrated: '🔗 Integrated',
};

export function getTestLabel(testType: string): string {
  return TEST_LABELS[testType]?.label || testType;
}

export function getTestEmoji(testType: string): string {
  return TEST_LABELS[testType]?.emoji || '📝';
}

export function getSectionLabel(section: string): string {
  return SECTION_LABELS[section] || section;
}

// ============================================================================
// LESSON TOPICS (080)
// ============================================================================

export async function listLessonTopics(
  env: Env,
  opts: { test_type?: string; section?: string; userLevel?: string } = {}
): Promise<LessonTopic[]> {
  const conditions: string[] = [];
  const binds: any[] = [];

  if (opts.test_type && opts.test_type !== 'ALL') {
    conditions.push('(test_type = ? OR test_type = ?)');
    binds.push(opts.test_type, 'ALL');
  }
  if (opts.section) {
    conditions.push('section = ?');
    binds.push(opts.section);
  }
  if (opts.userLevel) {
    const order: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
    const userIdx = order[opts.userLevel] ?? 2;
    const allowedLevels = Object.keys(order).filter(k => {
      const idx = order[k];
      return idx >= userIdx - 1 && idx <= userIdx + 1;
    });
    const placeholders = allowedLevels.map(() => '?').join(',');
    conditions.push(`cefr_level IN (${placeholders})`);
    binds.push(...allowedLevels);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = `SELECT * FROM lesson_topics ${where} ORDER BY test_type, section, order_index, name`;
  const result = await env.DB.prepare(stmt).bind(...binds).all<LessonTopic>();
  return result.results || [];
}

export async function getLessonTopic(env: Env, topicKey: string): Promise<LessonTopic | null> {
  const row = await env.DB.prepare('SELECT * FROM lesson_topics WHERE topic_key = ?')
    .bind(topicKey).first<LessonTopic>();
  return row || null;
}

export async function countLessonTopics(env: Env): Promise<{ test_type: string; section: string; count: number }[]> {
  const result = await env.DB.prepare(
    `SELECT test_type, section, COUNT(*) as count FROM lesson_topics
     WHERE test_type != 'ALL'
     GROUP BY test_type, section
     ORDER BY test_type, section`
  ).all<{ test_type: string; section: string; count: number }>();
  return result.results || [];
}

export function renderLessonTopic(topic: LessonTopic): string {
  const lines: string[] = [];
  const testLabel = getTestLabel(topic.test_type);
  const sectionLabel = getSectionLabel(topic.section);
  const freqEmoji = topic.frequency === 'high' ? '🔥' : topic.frequency === 'medium' ? '⭐' : '💡';

  lines.push(`${freqEmoji} *${escapeMd(topic.name)}*`);
  lines.push(`*Test:* ${testLabel}  |  *Section:* ${sectionLabel}  |  *Level:* ${topic.cefr_level}`);
  lines.push('');

  if (topic.description) {
    lines.push(`📋 *Apa ini:*\n${escapeMd(topic.description)}\n`);
  }
  if (topic.theory) {
    lines.push(`🎓 *Teori:*\n${escapeMd(topic.theory)}\n`);
  }
  if (topic.key_strategies) {
    const strategies = topic.key_strategies.split('\n').filter(s => s.trim());
    if (strategies.length) {
      lines.push(`🎯 *Strategi:*`);
      strategies.slice(0, 5).forEach((s, i) => {
        lines.push(`${i + 1}. ${escapeMd(s)}`);
      });
      lines.push('');
    }
  }
  if (topic.common_mistakes) {
    lines.push(`⚠️ *Kesalahan umum:*\n${escapeMd(topic.common_mistakes)}\n`);
  }
  if (topic.example_prompt) {
    lines.push(`📝 *Contoh:*\n_${escapeMd(topic.example_prompt)}_`);
  }
  return lines.join('\n');
}

// ============================================================================
// GRAMMAR TOPICS (078)
// ============================================================================

export async function listGrammarTopics(
  env: Env,
  opts: { category?: string; userLevel?: string; testType?: string } = {}
): Promise<GrammarTopic[]> {
  const conditions: string[] = [];
  const binds: any[] = [];

  if (opts.category) {
    conditions.push('category = ?');
    binds.push(opts.category);
  }
  if (opts.userLevel) {
    const order: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
    const userIdx = order[opts.userLevel] ?? 2;
    const allowedLevels = Object.keys(order).filter(k => {
      const idx = order[k];
      return idx >= userIdx - 1 && idx <= userIdx + 1;
    });
    const placeholders = allowedLevels.map(() => '?').join(',');
    conditions.push(`cefr_level IN (${placeholders})`);
    binds.push(...allowedLevels);
  }
  if (opts.testType) {
    conditions.push(`tested_in LIKE ?`);
    binds.push(`%${opts.testType}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = `SELECT * FROM grammar_topics ${where} ORDER BY category, order_index, name`;
  const result = await env.DB.prepare(stmt).bind(...binds).all<GrammarTopic>();
  return result.results || [];
}

export async function getGrammarTopic(env: Env, topicKey: string): Promise<GrammarTopic | null> {
  const row = await env.DB.prepare('SELECT * FROM grammar_topics WHERE topic_key = ?')
    .bind(topicKey).first<GrammarTopic>();
  return row || null;
}

export async function listGrammarCategories(env: Env): Promise<{ category: string; count: number }[]> {
  const result = await env.DB.prepare(
    `SELECT category, COUNT(*) as count FROM grammar_topics
     GROUP BY category
     ORDER BY count DESC`
  ).all<{ category: string; count: number }>();
  return result.results || [];
}

export function renderGrammarTopic(topic: GrammarTopic): string {
  const lines: string[] = [];
  const freqEmoji = topic.frequency === 'high' ? '🔥' : topic.frequency === 'medium' ? '⭐' : '💡';

  let testedIn: string[] = [];
  try { testedIn = JSON.parse(topic.tested_in); } catch { testedIn = []; }

  lines.push(`${freqEmoji} *${escapeMd(topic.name)}*`);
  lines.push(`*Kategori:* ${topic.category}${topic.subcategory ? ' / ' + topic.subcategory : ''}  |  *Level:* ${topic.cefr_level}`);
  if (testedIn.length) {
    lines.push(`*Tes:* ${testedIn.join(', ')}`);
  }
  lines.push('');

  if (topic.description) {
    lines.push(`📋 *Apa ini:*\n${escapeMd(topic.description)}\n`);
  }
  if (topic.rule) {
    lines.push(`📐 *Aturan:*\n${escapeMd(topic.rule)}\n`);
  }
  if (topic.examples) {
    const examples = topic.examples.split('\n').filter(e => e.trim());
    if (examples.length) {
      lines.push(`💡 *Contoh:*`);
      examples.slice(0, 4).forEach(e => lines.push(`• ${escapeMd(e)}`));
      lines.push('');
    }
  }
  if (topic.common_mistakes) {
    lines.push(`⚠️ *Kesalahan umum:*\n${escapeMd(topic.common_mistakes)}`);
  }
  return lines.join('\n');
}

// ============================================================================
// VOCABULARY BANKS (079, 082)
// ============================================================================

export async function listVocabulary(
  env: Env,
  opts: { topic?: string; userLevel?: string; testType?: string; frequency?: string; limit?: number } = {}
): Promise<VocabWord[]> {
  const conditions: string[] = [];
  const binds: any[] = [];

  if (opts.topic) {
    conditions.push('topic = ?');
    binds.push(opts.topic);
  }
  if (opts.userLevel) {
    const order: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
    const userIdx = order[opts.userLevel] ?? 2;
    const allowedLevels = Object.keys(order).filter(k => {
      const idx = order[k];
      return idx >= userIdx - 1 && idx <= userIdx + 1;
    });
    const placeholders = allowedLevels.map(() => '?').join(',');
    conditions.push(`cefr_level IN (${placeholders})`);
    binds.push(...allowedLevels);
  }
  if (opts.testType) {
    conditions.push('tested_in LIKE ?');
    binds.push(`%${opts.testType}%`);
  }
  if (opts.frequency) {
    conditions.push('frequency = ?');
    binds.push(opts.frequency);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts.limit || 20;
  const stmt = `SELECT * FROM vocabulary_banks ${where} ORDER BY RANDOM() LIMIT ${limit}`;
  const result = await env.DB.prepare(stmt).bind(...binds).all<VocabWord>();
  return result.results || [];
}

export async function listVocabTopics(env: Env): Promise<{ topic: string; count: number }[]> {
  const result = await env.DB.prepare(
    `SELECT topic, COUNT(*) as count FROM vocabulary_banks
     GROUP BY topic
     ORDER BY topic`
  ).all<{ topic: string; count: number }>();
  return result.results || [];
}

export async function listVocabularyTopicsForTest(
  env: Env,
  testType: string,
  userLevel: string = 'B1'
): Promise<{ topic: string; count: number }[]> {
  const order: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
  const userIdx = order[userLevel] ?? 2;
  const allowedLevels = Object.keys(order).filter(k => {
    const idx = order[k];
    return idx >= userIdx - 1 && idx <= userIdx + 1;
  });
  const placeholders = allowedLevels.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `SELECT topic, COUNT(*) as count FROM vocabulary_banks
     WHERE tested_in LIKE ?
       AND cefr_level IN (${placeholders})
     GROUP BY topic
     ORDER BY topic`
  ).bind(`%${testType}%`, ...allowedLevels).all<{ topic: string; count: number }>();
  return result.results || [];
}

export function renderVocabWord(word: VocabWord, idx?: number): string {
  const lines: string[] = [];
  const prefix = idx ? `${idx}. ` : '';
  const freqEmoji = word.frequency === 'high' ? '🔥' : word.frequency === 'medium' ? '⭐' : '💡';

  let testedIn: string[] = [];
  try { testedIn = JSON.parse(word.tested_in); } catch { testedIn = []; }

  lines.push(`${prefix}${freqEmoji} *${escapeMd(word.word)}* ${word.ipa ? '_' + word.ipa + '_' : ''}`);
  const meta: string[] = [];
  if (word.pos) meta.push(word.pos);
  if (word.cefr_level) meta.push(word.cefr_level);
  if (testedIn.length) meta.push(testedIn.join('/'));
  if (meta.length) lines.push(`*${meta.join(' | ')}*`);

  if (word.definition) lines.push(`🇬🇧 ${escapeMd(word.definition)}`);
  if (word.indonesian) lines.push(`🇮🇩 ${escapeMd(word.indonesian)}`);
  if (word.example) lines.push(`📝 _${escapeMd(word.example)}_`);
  if (word.word_family) lines.push(`👨‍👩‍👧 *Family:* ${escapeMd(word.word_family)}`);
  if (word.collocations) lines.push(`🔗 *Collocations:* ${escapeMd(word.collocations)}`);
  return lines.join('\n');
}

// ============================================================================
// TEST STRATEGIES (081)
// ============================================================================

export async function listTestStrategies(
  env: Env,
  opts: { test_type?: string; category?: string; userLevel?: string } = {}
): Promise<TestStrategy[]> {
  const conditions: string[] = [];
  const binds: any[] = [];

  if (opts.test_type && opts.test_type !== 'ALL') {
    conditions.push('(test_type = ? OR test_type = ?)');
    binds.push(opts.test_type, 'ALL');
  }
  if (opts.category) {
    conditions.push('category = ?');
    binds.push(opts.category);
  }
  if (opts.userLevel) {
    const order: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
    const userIdx = order[opts.userLevel] ?? 2;
    const allowedLevels = Object.keys(order).filter(k => {
      const idx = order[k];
      return idx >= userIdx - 1 && idx <= userIdx + 1;
    });
    const placeholders = allowedLevels.map(() => '?').join(',');
    conditions.push(`cefr_level IN (${placeholders})`);
    binds.push(...allowedLevels);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = `SELECT * FROM test_strategies ${where} ORDER BY test_type, category, order_index, name`;
  const result = await env.DB.prepare(stmt).bind(...binds).all<TestStrategy>();
  return result.results || [];
}

export async function getTestStrategy(env: Env, strategyKey: string): Promise<TestStrategy | null> {
  const row = await env.DB.prepare('SELECT * FROM test_strategies WHERE strategy_key = ?')
    .bind(strategyKey).first<TestStrategy>();
  return row || null;
}

export function renderTestStrategy(s: TestStrategy): string {
  const lines: string[] = [];
  const testLabel = getTestLabel(s.test_type);
  const catEmoji: Record<string, string> = {
    pacing: '⏱', scoring: '📊', framework: '🧩', approach: '🎯', rubric: '📋',
  };
  const emoji = catEmoji[s.category] || '📚';

  lines.push(`${emoji} *${escapeMd(s.name)}*`);
  lines.push(`*Test:* ${testLabel}  |  *Kategori:* ${s.category}  |  *Level:* ${s.cefr_level}`);
  lines.push('');

  if (s.description) {
    lines.push(`📋 *Deskripsi:*\n${escapeMd(s.description)}\n`);
  }
  if (s.framework) {
    lines.push(`🧩 *Framework:*\n${escapeMd(s.framework)}\n`);
  }
  if (s.key_actions) {
    const actions = s.key_actions.split('\n').filter(a => a.trim());
    if (actions.length) {
      lines.push(`🎯 *Langkah-langkah:*`);
      actions.slice(0, 6).forEach((a, i) => {
        lines.push(`${i + 1}. ${escapeMd(a)}`);
      });
      lines.push('');
    }
  }
  if (s.examples) {
    lines.push(`📝 *Contoh:*\n${escapeMd(s.examples)}`);
  }
  return lines.join('\n');
}

// ============================================================================
// SYLLABUS SUMMARY
// ============================================================================

export async function getSyllabusSummary(
  env: Env,
  testType: string,
  userLevel: string = 'B1'
): Promise<{
  testLabel: string;
  sections: { section: string; count: number; topics: LessonTopic[] }[];
  grammarCategories: { category: string; count: number }[];
  vocabTopics: { topic: string; count: number }[];
  strategies: { category: string; count: number }[];
}> {
  const testLabel = getTestLabel(testType);

  // Sections & topics
  const lessons = await listLessonTopics(env, { test_type: testType, userLevel: userLevel });
  const sectionMap: Record<string, LessonTopic[]> = {};
  lessons.forEach(t => {
    if (t.test_type === 'ALL') return; // Skip cross-cutting
    if (!sectionMap[t.section]) sectionMap[t.section] = [];
    sectionMap[t.section].push(t);
  });
  const sections = Object.keys(sectionMap).map(section => ({
    section,
    count: sectionMap[section].length,
    topics: sectionMap[section],
  }));

  // Grammar categories (count of all for the test type)
  const allGrammar = await listGrammarTopics(env, { testType, userLevel });
  const catCount: Record<string, number> = {};
  allGrammar.forEach(g => {
    catCount[g.category] = (catCount[g.category] || 0) + 1;
  });
  const grammarCategories = Object.keys(catCount).map(c => ({ category: c, count: catCount[c] }));

  // Vocab topics (all for the test type)
  const allVocab = await listVocabulary(env, { testType, userLevel, limit: 1000 });
  const topicCount: Record<string, number> = {};
  allVocab.forEach(v => {
    topicCount[v.topic] = (topicCount[v.topic] || 0) + 1;
  });
  const vocabTopics = Object.keys(topicCount).map(t => ({ topic: t, count: topicCount[t] }));

  // Strategies
  const strategies = await listTestStrategies(env, { test_type: testType, userLevel });
  const stratCount: Record<string, number> = {};
  strategies.forEach(s => {
    stratCount[s.category] = (stratCount[s.category] || 0) + 1;
  });
  const stratArr = Object.keys(stratCount).map(c => ({ category: c, count: stratCount[c] }));

  return { testLabel, sections, grammarCategories, vocabTopics, strategies: stratArr };
}

// ============================================================================
// KEYBOARDS
// ============================================================================

export function syllabusTestKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🇺🇸 TOEFL iBT', callback_data: 'syl_test_TOEFL_IBT' },
        { text: '🇬🇧 IELTS', callback_data: 'syl_test_IELTS' },
      ],
      [
        { text: '📚 TOEFL ITP', callback_data: 'syl_test_TOEFL_ITP' },
        { text: '🏢 TOEIC', callback_data: 'syl_test_TOEIC' },
      ],
      [
        { text: '🌐 Semua Tes (Cross-cutting)', callback_data: 'syl_test_ALL' },
      ],
      [{ text: '🔙 Kembali ke /study', callback_data: 'study_menu' }],
    ],
  };
}

export function syllabusSectionKeyboard(testType: string) {
  return {
    inline_keyboard: [
      [
        { text: '📖 Reading', callback_data: `syl_sec_${testType}_reading` },
        { text: '🎧 Listening', callback_data: `syl_sec_${testType}_listening` },
      ],
      [
        { text: '🗣 Speaking', callback_data: `syl_sec_${testType}_speaking` },
        { text: '✍️ Writing', callback_data: `syl_sec_${testType}_writing` },
      ],
      [
        { text: '📝 Grammar', callback_data: `syl_grammar_${testType}` },
        { text: '📚 Vocabulary', callback_data: `syl_vocab_${testType}` },
      ],
      [
        { text: '🎯 Strategies & Rubric', callback_data: `syl_strat_${testType}` },
      ],
      [
        { text: '🔙 Ganti Tes', callback_data: 'syllabus' },
      ],
    ],
  };
}

export function syllabusTopicListKeyboard(
  testType: string,
  section: string,
  topics: { topic_key: string; name: string }[],
  page: number = 0
) {
  const pageSize = 6;
  const start = page * pageSize;
  const end = start + pageSize;
  const pageTopics = topics.slice(start, end);
  const totalPages = Math.ceil(topics.length / pageSize);

  const rows: any[][] = [];
  pageTopics.forEach(t => {
    const short = t.name.length > 38 ? t.name.substring(0, 35) + '...' : t.name;
    rows.push([{ text: `📌 ${short}`, callback_data: `syl_topic_${t.topic_key}` }]);
  });

  // Pagination
  if (totalPages > 1) {
    const navRow: any[] = [];
    if (page > 0) navRow.push({ text: '◀️ Prev', callback_data: `syl_page_${testType}_${section}_${page - 1}` });
    if (page < totalPages - 1) navRow.push({ text: 'Next ▶️', callback_data: `syl_page_${testType}_${section}_${page + 1}` });
    if (navRow.length) rows.push(navRow);
  }

  rows.push([{ text: '🔙 Kembali', callback_data: `syl_test_${testType}` }]);
  return { inline_keyboard: rows };
}

export function syllabusGrammarCategoryKeyboard(testType: string) {
  return {
    inline_keyboard: [
      [
        { text: '⏱ Tenses', callback_data: `syl_gcat_${testType}_tense` },
        { text: '🔤 Noun & Articles', callback_data: `syl_gcat_${testType}_noun` },
      ],
      [
        { text: '🔧 Verb Forms', callback_data: `syl_gcat_${testType}_verb_form` },
        { text: '❓ Modals', callback_data: `syl_gcat_${testType}_modality` },
      ],
      [
        { text: '🔀 Conditionals', callback_data: `syl_gcat_${testType}_clause` },
        { text: '🗣 Voice', callback_data: `syl_gcat_${testType}_voice` },
      ],
      [
        { text: '📐 Word Classes', callback_data: `syl_gcat_${testType}_word_class` },
        { text: '🔣 Punctuation', callback_data: `syl_gcat_${testType}_punctuation` },
      ],
      [
        { text: '🔙 Kembali', callback_data: `syl_test_${testType}` },
      ],
    ],
  };
}

export function syllabusVocabTopicKeyboard(testType: string, topics: { topic: string; count: number }[]) {
  const rows: any[][] = [];
  // Two columns of topics
  for (let i = 0; i < topics.length; i += 2) {
    const row: any[] = [];
    const t1 = topics[i];
    row.push({ text: `📚 ${t1.topic} (${t1.count})`, callback_data: `syl_vtopic_${testType}_${t1.topic}` });
    if (topics[i + 1]) {
      const t2 = topics[i + 1];
      row.push({ text: `📚 ${t2.topic} (${t2.count})`, callback_data: `syl_vtopic_${testType}_${t2.topic}` });
    }
    rows.push(row);
  }
  rows.push([{ text: '🔙 Kembali', callback_data: `syl_test_${testType}` }]);
  return { inline_keyboard: rows };
}

export function syllabusStrategyCategoryKeyboard(testType: string, strategies: { category: string; count: number }[]) {
  const rows: any[][] = [];
  strategies.forEach(s => {
    const emoji: Record<string, string> = {
      pacing: '⏱', scoring: '📊', framework: '🧩', approach: '🎯', rubric: '📋',
    };
    const e = emoji[s.category] || '📚';
    rows.push([{ text: `${e} ${s.category} (${s.count})`, callback_data: `syl_scat_${testType}_${s.category}` }]);
  });
  rows.push([{ text: '🔙 Kembali', callback_data: `syl_test_${testType}` }]);
  return { inline_keyboard: rows };
}

// ============================================================================
// HELPERS
// ============================================================================

function escapeMd(text: string): string {
  if (!text) return '';
  // Escape characters that break Telegram MarkdownV2: _ * [ ] ( ) ~ ` > # + - = | { } . !
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
