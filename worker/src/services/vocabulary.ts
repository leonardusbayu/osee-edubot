/**
 * Vocabulary Trainer — FSRS-powered vocabulary learning
 *
 * Features:
 * - Per-test (TOEFL iBT, IELTS, TOEIC, TOEFL ITP) vocabulary
 * - Per-CEF R level (A1-C2)
 * - Indonesian memory hooks for cultural context
 * - FSRS adaptive scheduling per word
 * - Daily vocab push + interactive drills
 */

import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs';
import type { Env } from '../types';

// FSRS params (same as fsrs-engine.ts)
const params = generatorParameters({
  maximum_interval: 180,
  request_retention: 0.85,
  enable_fuzz: true,
});
const f = fsrs(params);

export interface VocabCard {
  id: number;
  word: string;
  phonetic: string | null;
  cefr_level: string;
  test_type: string | null;
  topic: string | null;
  difficulty: number;
  definition: string;
  example_sentence: string | null;
  synonyms: string[];
  antonyms: string[];
  word_family: string[];
  idiom_or_phrasal: string | null;
  indonesian_analogy: string | null;
  audio_url: string | null;
  tags: string[];
}

export interface UserVocabState {
  id: number;
  user_id: number;
  vocab_id: number;
  fsrs_state: FSRSCardState | null;
  next_review: string | null;
  last_review: string | null;
  total_reviews: number;
  correct_count: number;
  last_quality: number | null;
  streak: number;
  is_learned: number;
}

interface FSRSCardState {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
}

function cardToState(card: Card): FSRSCardState {
  return {
    due: card.due instanceof Date ? card.due.toISOString() : String(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review
      ? (card.last_review instanceof Date ? card.last_review.toISOString() : String(card.last_review))
      : null,
  };
}

function stateToCard(state: FSRSCardState | null): Card {
  if (!state) return createEmptyCard();
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.last_review ? new Date(state.last_review) : null,
  } as Card;
}

// ─── Vocab Card Queries ───────────────────────────────────────────────────────

function rowToVocab(row: any): VocabCard {
  return {
    id: row.id,
    word: row.word,
    phonetic: row.phonetic,
    cefr_level: row.cefr_level,
    test_type: row.test_type,
    topic: row.topic,
    difficulty: row.difficulty,
    definition: row.definition,
    example_sentence: row.example_sentence,
    synonyms: parseJsonArray(row.synonyms),
    antonyms: parseJsonArray(row.antonyms),
    word_family: parseJsonArray(row.word_family),
    idiom_or_phrasal: row.idiom_or_phrasal,
    indonesian_analogy: row.indonesian_analogy,
    audio_url: row.audio_url,
    tags: parseJsonArray(row.tags),
  };
}

function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; }
  catch { return []; }
}

/** Get a random vocab card matching filters */
export async function getRandomVocab(
  env: Env,
  userId: number,
  cefrLevel?: string,
  testType?: string,
  topic?: string,
): Promise<VocabCard | null> {
  let query = 'SELECT * FROM vocabulary_cards WHERE status = \'active\'';
  const params: any[] = [];

  if (cefrLevel) { query += ' AND cefr_level = ?'; params.push(cefrLevel); }
  if (testType) { query += ' AND (test_type = ? OR test_type IS NULL)'; params.push(testType); }
  if (topic) { query += ' AND topic = ?'; params.push(topic); }

  // Exclude already-learned words (with some randomness for re-review)
  query += ` AND id NOT IN (
    SELECT vocab_id FROM vocabulary_learning
    WHERE user_id = ? AND is_learned = 1 AND streak >= 3
  )`;

  params.push(userId);
  query += ' ORDER BY RANDOM() LIMIT 1';

  const row = await env.DB.prepare(query).bind(...params).first();
  return row ? rowToVocab(row) : null;
}

/** Get a vocab card by ID */
export async function getVocabById(env: Env, vocabId: number): Promise<VocabCard | null> {
  const row = await env.DB.prepare(
    'SELECT * FROM vocabulary_cards WHERE id = ? AND status = \'active\''
  ).bind(vocabId).first();
  return row ? rowToVocab(row) : null;
}

/** Get vocabulary cards by IDs (for a drill session) */
export async function getVocabByIds(env: Env, vocabIds: number[]): Promise<VocabCard[]> {
  if (vocabIds.length === 0) return [];
  const placeholders = vocabIds.map(() => '?').join(',');
  const rows = await env.DB.prepare(
    `SELECT * FROM vocabulary_cards WHERE id IN (${placeholders}) AND status = 'active'`
  ).bind(...vocabIds).all();
  return (rows.results || []).map(rowToVocab);
}

/** Search vocabulary by word or definition */
export async function searchVocab(
  env: Env,
  userId: number,
  query: string,
  limit: number = 10,
): Promise<VocabCard[]> {
  const q = `%${query}%`;
  const rows = await env.DB.prepare(
    `SELECT * FROM vocabulary_cards
     WHERE status = 'active'
       AND (word LIKE ? OR definition LIKE ? OR tags LIKE ?)
     ORDER BY word ASC
     LIMIT ?`
  ).bind(q, q, q, limit).all();
  return (rows.results || []).map(rowToVocab);
}

// ─── Learning State ──────────────────────────────────────────────────────────

/** Get or create a user's learning state for a vocab card */
async function getOrCreateState(
  env: Env,
  userId: number,
  vocabId: number,
): Promise<UserVocabState> {
  const existing = await env.DB.prepare(
    'SELECT * FROM vocabulary_learning WHERE user_id = ? AND vocab_id = ?'
  ).bind(userId, vocabId).first() as any;

  if (existing) {
    return {
      id: existing.id,
      user_id: existing.user_id,
      vocab_id: existing.vocab_id,
      fsrs_state: existing.fsrs_state ? JSON.parse(existing.fsrs_state) : null,
      next_review: existing.next_review,
      last_review: existing.last_review,
      total_reviews: existing.total_reviews,
      correct_count: existing.correct_count,
      last_quality: existing.last_quality,
      streak: existing.streak,
      is_learned: existing.is_learned,
    };
  }

  // Create new state
  const card = createEmptyCard();
  const state = cardToState(card);

  await env.DB.prepare(
    `INSERT INTO vocabulary_learning (user_id, vocab_id, fsrs_state, next_review, total_reviews, correct_count, streak, is_learned)
     VALUES (?, ?, ?, ?, 0, 0, 0, 0)`
  ).bind(userId, vocabId, JSON.stringify(state), state.due).run();

  return {
    id: 0, // Will be filled on next read
    user_id: userId,
    vocab_id: vocabId,
    fsrs_state: state,
    next_review: state.due,
    last_review: null,
    total_reviews: 0,
    correct_count: 0,
    last_quality: null,
    streak: 0,
    is_learned: 0,
  };
}

/** Record a review rating and update FSRS state */
export async function recordVocabReview(
  env: Env,
  userId: number,
  vocabId: number,
  rating: 1 | 2 | 3 | 4, // again, hard, good, easy
): Promise<{ nextReview: string; isLearned: boolean }> {
  const state = await getOrCreateState(env, userId, vocabId);
  const card = stateToCard(state.fsrs_state);

  const now = new Date();
  const ratingEnum = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy][rating - 1] as Grade;
  const scheduling = f.repeat(card, now);
  const result = scheduling[ratingEnum];

  const newState = cardToState(result.card);
  const isCorrect = rating >= 3;

  // Update learning state
  await env.DB.prepare(
    `UPDATE vocabulary_learning SET
       fsrs_state = ?,
       next_review = ?,
       last_review = ?,
       total_reviews = total_reviews + 1,
       correct_count = correct_count + ?,
       last_quality = ?,
       streak = CASE WHEN ? THEN streak + 1 ELSE 0 END,
       is_learned = CASE WHEN ? THEN 1 ELSE is_learned END
     WHERE user_id = ? AND vocab_id = ?`
  ).bind(
    JSON.stringify(newState),
    newState.due,
    now.toISOString(),
    isCorrect ? 1 : 0,
    rating,
    isCorrect,
    newState.state === 2 && newState.reps >= 2 ? 1 : 0,
    userId,
    vocabId,
  ).run();

  return {
    nextReview: newState.due,
    isLearned: newState.state === 2 && newState.reps >= 2,
  };
}

/** Get vocab cards due for review */
export async function getDueVocabReviews(
  env: Env,
  userId: number,
  limit: number = 10,
): Promise<(VocabCard & { state: UserVocabState })[]> {
  const now = new Date().toISOString();
  const rows = await env.DB.prepare(
    `SELECT vl.*, vc.*
     FROM vocabulary_learning vl
     JOIN vocabulary_cards vc ON vc.id = vl.vocab_id
     WHERE vl.user_id = ? AND vl.next_review <= ? AND vc.status = 'active'
     ORDER BY vl.next_review ASC
     LIMIT ?`
  ).bind(userId, now, limit).all();

  return (rows.results || []).map((row: any) => ({
    ...rowToVocab(row),
    state: {
      id: row.id,
      user_id: row.user_id,
      vocab_id: row.vocab_id,
      fsrs_state: row.fsrs_state ? JSON.parse(row.fsrs_state) : null,
      next_review: row.next_review,
      last_review: row.last_review,
      total_reviews: row.total_reviews,
      correct_count: row.correct_count,
      last_quality: row.last_quality,
      streak: row.streak,
      is_learned: row.is_learned,
    },
  }));
}

/** Get user's vocab stats */
export async function getVocabStats(env: Env, userId: number): Promise<{
  total: number;
  learned: number;
  dueToday: number;
  accuracy: number;
  streak: number;
}> {
  const total = await env.DB.prepare(
    'SELECT COUNT(*) as c FROM vocabulary_learning WHERE user_id = ?'
  ).bind(userId).first() as any;

  const learned = await env.DB.prepare(
    'SELECT COUNT(*) as c FROM vocabulary_learning WHERE user_id = ? AND is_learned = 1'
  ).bind(userId).first() as any;

  const now = new Date().toISOString();
  const dueToday = await env.DB.prepare(
    'SELECT COUNT(*) as c FROM vocabulary_learning WHERE user_id = ? AND next_review <= ?'
  ).bind(userId, now).first() as any;

  const accuracy = await env.DB.prepare(
    `SELECT
       SUM(correct_count) as correct,
       SUM(total_reviews) as total
     FROM vocabulary_learning WHERE user_id = ?`
  ).bind(userId).first() as any;

  const streak = await env.DB.prepare(
    'SELECT MAX(streak) as s FROM vocabulary_learning WHERE user_id = ?'
  ).bind(userId).first() as any;

  return {
    total: total?.c || 0,
    learned: learned?.c || 0,
    dueToday: dueToday?.c || 0,
    accuracy: accuracy?.total > 0
      ? Math.round((accuracy.correct / accuracy.total) * 100)
      : 0,
    streak: streak?.s || 0,
  };
}

// ─── Display Formatting ────────────────────────────────────────────────────

/** Format a vocab card for display in Telegram */
export function formatVocabCard(vocab: VocabCard, showAnswer: boolean = false): string {
  let msg = `📖 *${vocab.word}*`;
  if (vocab.phonetic) msg += ` ${vocab.phonetic}`;
  msg += `\n_${vocab.cefr_level}_`;
  if (vocab.topic) msg += ` · ${vocab.topic.replace(/_/g, ' ')}`;

  msg += `\n\n*Arti:* ${vocab.definition}`;

  if (vocab.example_sentence) {
    msg += `\n\n_📝 ${vocab.example_sentence}_`;
  }

  if (vocab.synonyms.length > 0) {
    msg += `\n\n*Sinonim:* ${vocab.synonyms.slice(0, 5).join(', ')}`;
  }

  if (vocab.word_family.length > 0) {
    msg += `\n*Word family:* ${vocab.word_family.slice(0, 4).join(' · ')}`;
  }

  if (vocab.indonesian_analogy) {
    msg += `\n\n💡 _${vocab.indonesian_analogy}_`;
  }

  return msg;
}

/** Format the review rating keyboard */
export function formatVocabReviewKeyboard(vocabId: number): any {
  return {
    inline_keyboard: [
      [
        { text: '😬 Again (1)', callback_data: `vc:1:${vocabId}` },
        { text: '😐 Hard (2)', callback_data: `vc:2:${vocabId}` },
      ],
      [
        { text: '🙂 Good (3)', callback_data: `vc:3:${vocabId}` },
        { text: '😎 Easy (4)', callback_data: `vc:4:${vocabId}` },
      ],
      [
        { text: '📖 Lihat Detail', callback_data: `vc:show:${vocabId}` },
        { text: '🔄 Skip', callback_data: `vc:skip:${vocabId}` },
      ],
    ],
  };
}

/** Rating label text */
export function ratingLabel(rating: number): string {
  const labels = { 1: '😬 Lagi', 2: '😐 Susah', 3: '🙂 Good', 4: '😎 Gampang' };
  return labels[rating as 1 | 2 | 3 | 4] || String(rating);
}

/** CEFR emoji */
export function cefrEmoji(cefr: string): string {
  const map: Record<string, string> = {
    A1: '🅰️', A2: '🅰️', B1: '🅱️', B2: '🅱️', C1: '🇨', C2: '🇨',
  };
  return map[cefr] || '📖';
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

export interface VocabSeed {
  word: string;
  phonetic: string;
  cefr_level: string;
  test_type: string;
  topic: string;
  difficulty: number;
  definition: string;
  example_sentence: string;
  synonyms: string[];
  antonyms: string[];
  word_family: string[];
  idiom_or_phrasal?: string;
  indonesian_analogy: string;
  tags: string[];
}

const SEED_VOCAB: VocabSeed[] = [
  // ─── A1-A2 Level (Beginner) ───────────────────────────────────────────────
  {
    word: 'abundant',
    phonetic: '/əˈbʌndənt/',
    cefr_level: 'B1',
    test_type: 'IELTS',
    topic: 'academic',
    difficulty: 3,
    definition: 'vorhanden in großer Menge; sangat berlimpah',
    example_sentence: 'Indonesia has abundant natural resources.',
    synonyms: ['plentiful', 'ample', 'rich'],
    antonyms: ['scarce', 'sparse'],
    word_family: ['abundance (n)', 'abundantly (adv)'],
    indonesian_analogy: ' kayak air zam-zam di Masjidil Haram — banyak banget dan nggak pernah habis.',
    tags: ['adjective', 'nature', 'environment'],
  },
  {
    word: 'accumulate',
    phonetic: '/əˈkjuːmjəleɪt/',
    cefr_level: 'B2',
    test_type: 'TOEFL_IBT',
    topic: 'academic',
    difficulty: 4,
    definition: 'to gradually gather or build up over time; mengumpulkan secara bertahap',
    example_sentence: 'Students must accumulate credits to graduate.',
    synonyms: ['collect', 'gather', 'amass', 'pile up'],
    antonyms: ['dissipate', 'scatter'],
    word_family: ['accumulation (n)', 'cumulative (adj)', 'accumulated (adj)'],
    indonesian_analogy: ' kayak koleksi stiker — satu-satu lama-lama jadi banyak.',
    tags: ['verb', 'education', 'process'],
  },
  {
    word: 'advocate',
    phonetic: '/ˈædvəkeɪt/',
    cefr_level: 'C1',
    test_type: 'TOEFL_IBT',
    topic: 'academic',
    difficulty: 5,
    definition: 'to publicly recommend or support; memperjuangkan, mengadvokasi',
    example_sentence: 'She advocates for environmental protection.',
    synonyms: ['support', 'promote', 'champion', 'defend'],
    antonyms: ['oppose', 'criticize'],
    word_family: ['advocacy (n)', 'advocate (n)', 'advocacy (n)'],
    idiom_or_phrasal: 'advocate for something — to support publicly',
    indonesian_analogy: ' kayak orang yang demonstrasi di jalan — mereka "maju ke depan" untuk memperjuangkan hak.',
    tags: ['verb', 'social', 'politics'],
  },
  {
    word: 'albeit',
    phonetic: '/ɔːlˈbiːɪt/',
    cefr_level: 'C1',
    test_type: 'TOEFL_IBT',
    topic: 'academic',
    difficulty: 5,
    definition: 'although; meskipun, walau',
    example_sentence: 'The plan worked, albeit not perfectly.',
    synonyms: ['although', 'though', 'even though', 'while'],
    antonyms: [],
    word_family: ['albeit (conj)'],
    indonesian_analogy: ' "meskipun" versi bahasa Inggris yang bikin essay看起来 lebih smart.',
    tags: ['conjunction', 'writing', 'academic'],
  },
  {
    word: 'ambiguous',
    phonetic: '/æmˈbɪɡjuəs/',
    cefr_level: 'B2',
    test_type: 'TOEFL_IBT',
    topic: 'academic',
    difficulty: 4,
    definition: 'open to more than one interpretation; ambigu, tidak jelas',
    example_sentence: 'The phrase "bank" can be ambiguous.',
    synonyms: ['unclear', 'vague', 'equivocal', 'uncertain'],
    antonyms: ['clear', 'unambiguous', 'explicit'],
    word_family: ['ambiguity (n)', 'ambiguously (adv)'],
    idiom_or_phrasal: 'intentionally ambiguous — deliberately unclear',
    indonesian_analogy: ' kayak chat yang "oha" — bisa artinya "oh ya?" atau "oh gitu" — tergantung konteks.',
    tags: ['adjective', 'language', 'critical_thinking'],
  },
  {
    word: 'amphibian',
    phonetic: '/æmˈfɪbiən/',
    cefr_level: 'A2',
    test_type: 'IELTS',
    topic: 'general',
    difficulty: 2,
    definition: 'an animal that lives both in water and on land; amfibi',
    example_sentence: 'Frogs are amphibians.',
    synonyms: [],
    antonyms: [],
    word_family: ['amphibian (n)', 'amphibious (adj)'],
    indonesian_analogy: ' katak bisa di air dan di darat — kayak orang yang punya 2 pekerjaan.',
    tags: ['noun', 'biology', 'nature'],
  },
  {
    word: 'analyze',
    phonetic: '/ˈænəlaɪz/',
    cefr_level: 'B2',
    test_type: 'TOEFL_IBT',
    topic: 'academic',
    difficulty: 4,
    definition: 'to examine in detail; menganalisis',
    example_sentence: 'We need to analyze the data carefully.',
    synonyms: ['examine', 'investigate', 'study', 'assess'],
    antonyms: ['ignore', 'neglect'],
    word_family: ['analysis (n)', 'analyst (n)', 'analytical (adj)', 'analyzed (v)'],
    indonesian_analogy: ' kayak detektif yang bedah bukti satu per satu sampai ketemu petunjuk.',
    tags: ['verb', 'academic', 'process'],
  },
  {
    word: 'annual',
    phonetic: '/ˈænjuəl/',
    cefr_level: 'B1',
    test_type: 'IELTS',
    topic: 'general',
    difficulty: 3,
    definition: 'happening once every year; tahunan',
    example_sentence: 'The company holds an annual meeting.',
    synonyms: ['yearly', 'per year'],
    antonyms: ['monthly', 'weekly'],
    word_family: ['annually (adv)', 'annual (adj)'],
    indonesian_analogy: ' kayak THR — datangnya setahun sekali.',
    tags: ['adjective', 'time', 'business'],
  },
  {
    word: 'apparent',
    phonetic: '/əˈpærənt/',
    cefr_level: 'B2',
    test_type: 'TOEFL_IBT',
    topic: 'academic',
    difficulty: 4,
    definition: 'clearly visible or understood; jelas, tampak',
    example_sentence: 'It became apparent that she was talented.',
    synonyms: ['obvious', 'evident', 'clear', 'visible'],
    antonyms: ['hidden', 'unclear'],
    word_family: ['apparently (adv)', 'apparentness (n)'],
    indonesian_analogy: ' kayak buktinya udah "nongol" — susah ditutup-tutupin.',
    tags: ['adjective', 'academic', 'critical_thinking'],
  },
  {
    word: 'approximate',
    phonetic: '/əˈprɒksɪmət/',
    cefr_level: 'B2',
    test_type: 'TOEFL_IBT',
    topic: 'academic',
    difficulty: 4,
    definition: 'close to the actual but not completely accurate; perkiraan',
    example_sentence: 'The approximate cost is $500.',
    synonyms: ['estimated', 'rough', 'near', 'close'],
    antonyms: ['exact', 'precise'],
    word_family: ['approximately (adv)', 'approximation (n)'],
    indonesian_analogy: ' kayak bilang "kirakira 500-an" — nggak exact tapi udah cukup deket.',
    tags: ['adjective', 'math', 'academic'],
  },
  // ─── TOEFL ITP / Grammar-focused ───────────────────────────────────────────
  {
    word: 'seldom',
    phonetic: '/ˈseldəm/',
    cefr_level: 'B1',
    test_type: 'TOEFL_ITP',
    topic: 'general',
    difficulty: 3,
    definition: 'not often; jarang',
    example_sentence: 'She seldom eats meat.',
    synonyms: ['rarely', 'occasionally', 'infrequently'],
    antonyms: ['often', 'frequently', 'always'],
    word_family: ['seldom (adv)'],
    indonesian_analogy: ' "Jarang" versi formal — cocok di essay.',
    tags: ['adverb', 'frequency', 'grammar'],
  },
  {
    word: 'whereas',
    phonetic: '/weərˈæz/',
    cefr_level: 'C1',
    test_type: 'TOEFL_IBT',
    topic: 'academic',
    difficulty: 5,
    definition: 'while on the contrary; whereas, padahal',
    example_sentence: 'Some countries are rich, whereas others are poor.',
    synonyms: ['while', 'although', 'but'],
    antonyms: [],
    word_family: ['whereas (conj)'],
    indonesian_analogy: ' "sedangkan" versi bahasa Inggris formal — sering muncul di IELTS Task 2.',
    tags: ['conjunction', 'writing', 'academic'],
  },
  // ─── TOEIC / Business English ───────────────────────────────────────────────
  {
    word: 'revenue',
    phonetic: '/ˈrevənjuː/',
    cefr_level: 'B2',
    test_type: 'TOEIC',
    topic: 'business',
    difficulty: 3,
    definition: 'income from business activities; pendapatan',
    example_sentence: 'The company saw a 10% increase in revenue.',
    synonyms: ['income', 'earnings', 'profit', 'sales'],
    antonyms: ['expense', 'cost'],
    word_family: ['revenue (n)'],
    indonesian_analogy: ' kayak gaji bulanan — uang yang masuk ke perusahaan.',
    tags: ['noun', 'business', 'finance'],
  },
  {
    word: 'leverage',
    phonetic: '/ˈliːvərɪdʒ/',
    cefr_level: 'C1',
    test_type: 'TOEIC',
    topic: 'business',
    difficulty: 5,
    definition: 'to use something to maximum advantage; memanfaatkan',
    example_sentence: 'We can leverage our network for new clients.',
    synonyms: ['utilize', 'exploit', 'capitalize on'],
    antonyms: ['waste', 'neglect'],
    word_family: ['leverage (n/v)', 'leveraged (adj)'],
    indonesian_analogy: ' kayak pakai tuas — tenaga kecil bisa angkat beban besar kalau tahu cara pakainya.',
    tags: ['verb', 'business', 'strategy'],
  },
  {
    word: 'pending',
    phonetic: '/ˈpendɪŋ/',
    cefr_level: 'B2',
    test_type: 'TOEIC',
    topic: 'business',
    difficulty: 3,
    definition: 'waiting to be dealt with; menunggu, tertunda',
    example_sentence: 'The decision is still pending.',
    synonyms: ['awaiting', 'pending', 'outstanding'],
    antonyms: ['settled', 'resolved'],
    word_family: ['pending (adj/prep)'],
    indonesian_analogy: ' kayak "on process" di chat — belum selesai tapi lagi berlangsung.',
    tags: ['adjective', 'business', 'status'],
  },
  // ─── IELTS-specific ─────────────────────────────────────────────────────────
  {
    word: 'mitigate',
    phonetic: '/ˈmɪtɪɡeɪt/',
    cefr_level: 'C1',
    test_type: 'IELTS',
    topic: 'academic',
    difficulty: 5,
    definition: 'to make less severe or serious; meredakan, mengurangi',
    example_sentence: 'Governments must mitigate the effects of climate change.',
    synonyms: ['reduce', 'alleviate', 'lessen', 'ease'],
    antonyms: ['aggravate', 'worsen'],
    word_family: ['mitigation (n)', 'mitigating (adj)'],
    indonesian_analogy: ' kayak pakai payung pas hujan — nggak berhenti hujan tapi dampaknya dikurangi.',
    tags: ['verb', 'environment', 'academic'],
  },
  {
    word: 'substantiate',
    phonetic: '/səbˈstænʃieɪt/',
    cefr_level: 'C1',
    test_type: 'IELTS',
    topic: 'academic',
    difficulty: 5,
    definition: 'to provide evidence to support a claim; membenarkan, membuktikan',
    example_sentence: 'You must substantiate your arguments with data.',
    synonyms: ['verify', 'confirm', 'prove', 'validate'],
    antonyms: ['disprove', 'refute'],
    word_family: ['substantial (adj)', 'substantially (adv)', 'substance (n)'],
    indonesian_analogy: ' kayak nge-charge HP — bukti harus di-"cas" biar lengkap.',
    tags: ['verb', 'academic', 'writing'],
  },
  // ─── Idioms & Phrasal Verbs ────────────────────────────────────────────────
  {
    word: 'run into',
    phonetic: '/rʌn ˈɪntuː/',
    cefr_level: 'B1',
    test_type: 'TOEFL_IBT',
    topic: 'idioms',
    difficulty: 3,
    definition: 'to meet someone by chance; bertemu seseorang secara kebetulan',
    example_sentence: 'I ran into my teacher at the mall.',
    synonyms: ['bump into', 'encounter', 'come across'],
    antonyms: [],
    word_family: [],
    idiom_or_phrasal: 'run into a problem — to encounter a difficulty',
    indonesian_analogy: ' kayak "ketemu orang di jalan" — tidak direncanakan.',
    tags: ['phrasal_verb', 'social', 'idiom'],
  },
  {
    word: 'put off',
    phonetic: '/pʊt ˈɒf/',
    cefr_level: 'B1',
    test_type: 'TOEFL_ITP',
    topic: 'idioms',
    difficulty: 3,
    definition: 'to delay or postpone; menunda',
    example_sentence: 'Don\'t put off your homework.',
    synonyms: ['postpone', 'delay', 'defer'],
    antonyms: ['bring forward', 'hasten'],
    word_family: ['put-off (n)'],
    idiom_or_phrasal: 'put someone off — to discourage someone',
    indonesian_analogy: ' kayak " nanti aja" — selalu di-"off"-kan ke besok.',
    tags: ['phrasal_verb', 'time', 'idiom'],
  },
];

/** Seed vocabulary cards into the database. Idempotent — uses INSERT OR IGNORE. */
export async function seedVocabulary(env: Env): Promise<{ inserted: number }> {
  let inserted = 0;
  for (const v of SEED_VOCAB) {
    // Check if word already exists
    const existing = await env.DB.prepare(
      'SELECT id FROM vocabulary_cards WHERE word = ? AND cefr_level = ?'
    ).bind(v.word.toLowerCase(), v.cefr_level).first();
    if (existing) continue;

    await env.DB.prepare(
      `INSERT OR IGNORE INTO vocabulary_cards
       (word, phonetic, cefr_level, test_type, topic, difficulty, definition,
        example_sentence, synonyms, antonyms, word_family, idiom_or_phrasal,
        indonesian_analogy, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      v.word.toLowerCase(),
      v.phonetic,
      v.cefr_level,
      v.test_type || null,
      v.topic,
      v.difficulty,
      v.definition,
      v.example_sentence,
      JSON.stringify(v.synonyms),
      JSON.stringify(v.antonyms),
      JSON.stringify(v.word_family),
      v.idiom_or_phrasal || null,
      v.indonesian_analogy,
      JSON.stringify(v.tags),
    ).run();
    inserted++;
  }
  return { inserted };
}
