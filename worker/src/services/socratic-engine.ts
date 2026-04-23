// ═══════════════════════════════════════════════════════
// SOCRATIC QUESTIONING ENGINE
// 
// Post-processes AI tutor responses to ensure Socratic
// behavior: asks guiding questions instead of giving
// direct answers. Tracks chain depth and auto-reveals
// after 3 failed attempts.
// ═══════════════════════════════════════════════════════

import type { Env } from '../types';

export interface SocraticState {
  chainDepth: number;        // How many guiding questions in a row
  lastConcept: string;       // What concept we're exploring
  revealed: boolean;         // Whether the answer has been revealed
  attemptCount: number;      // How many times student tried
}

const MAX_SOCRATIC_DEPTH = 3;

// Patterns that indicate the AI gave a direct answer instead of asking
const DIRECT_ANSWER_PATTERNS = [
  /jawabannya? (adalah|:)?\s*[A-D]/i,
  /jawaban (yang )?benar (adalah|:)?\s*[A-D]/i,
  /correct answer (is|:)?\s*[A-D]/i,
  /the answer is\s+[A-D]/i,
  /ini (adalah )?present perfect/i,
  /ini (adalah )?simple past/i,
  /ini (adalah )?simple present/i,
  /ini (adalah )?past continuous/i,
  /ini (adalah )?present continuous/i,
  /ini (adalah )?past perfect/i,
  /ini (adalah )?future tense/i,
  /ini (adalah )?conditional/i,
  /karena (itu|disini|di sini)/i,
  /sebab (itu|disini|di sini)/i,
];

// Patterns that indicate the AI is already being Socratic
const SOCRATIC_PATTERNS = [
  /menurut (kamu|mu|anda)/i,
  /apa (yang )?kamu (pikir|rasa|kira)/i,
  /coba (pikir|tebak|jawab)/i,
  /menurutmu/i,
  /kayaknya/i,
  /gimana (kalau|menurut)/i,
  /bagaimana (kalau|menurut)/i,
  /apa (yang )?terjadi/i,
  /kenapa (kamu )?pilih/i,
  /dari (mana|contoh)/i,
  /perhatikan/i,
  /lihat/i,
  /coba/i,
  /\?$/m,
];

// Guiding question templates per grammar concept
const GUIDING_QUESTIONS: Record<string, string[]> = {
  'articles': [
    'Kata bendanya spesifik atau umum? Kalau spesifik, pakai "the". Kalau umum, pakai "a/an". Coba pikir lagi?',
    'Apakah ini pertama kali disebut atau sudah disebut sebelumnya? Pertama kali = "a/an", sudah disebut = "the".',
    'Kata ini bisa dihitung (countable) atau tidak (uncountable)? Uncountable biasanya tanpa article.',
  ],
  'tenses': [
    'Kapan kejadiannya? Masa lalu, sekarang, atau masa depan? Itu menentukan tense-nya.',
    'Apakah kejadiannya sudah selesai atau masih berlangsung? Sudah selesai = simple/perfect, masih berlangsung = continuous.',
    'Ada kata kunci waktu nggak? "Yesterday" = past, "now" = present, "tomorrow" = future.',
  ],
  'prepositions': [
    'Ini tentang waktu atau tempat? Waktu: at (jam), on (hari), in (bulan/tahun). Tempat: at (titik), on (permukaan), in (ruangan).',
    'Coba bayangkan posisinya. Di atas permukaan = "on", di dalam = "in", di titik tertentu = "at".',
  ],
  'conditionals': [
    'Ini situasi nyata atau imajiner? Nyata = if + present. Imajiner = if + past. Tidak mungkin = if + had + V3.',
    'Kalau kalimatnya "if I were you", itu tipe berapa? Tipe 2 — situasi imajiner.',
  ],
  'passive_voice': [
    'Siapa yang melakukan aksi? Kalau yang penting adalah aksinya (bukan pelakunya), pakai passive.',
    'Subject-nya menerima aksi atau melakukan aksi? Menerima = passive (be + V3).',
  ],
  'sv_agreement': [
    'Subject-nya singular atau plural? Singular = verb + s/es. Plural = verb tanpa s/es.',
    'Hati-hati dengan "each", "every", "nobody" — semuanya singular!',
  ],
  'relative_clauses': [
    'Orang atau benda? Orang = who/whom. Benda = which/that. Keduanya = that.',
    'Informasinya penting (defining) atau tambahan (non-defining)? Penting = tanpa koma, tambahan = pakai koma + which.',
  ],
};

// Default guiding questions for unknown concepts
const DEFAULT_GUIDING_QUESTIONS = [
  'Coba pikir lagi — dari contoh yang aku kasih, kamu notice polanya?',
  'Dari pilihan yang ada, mana yang paling masuk akal menurut kamu?',
  'Kamu bisa jelaskan kenapa kamu pilih jawaban itu? Aku mau tau proses mikirmu.',
];

/**
 * Detect if an AI response gives a direct answer instead of being Socratic.
 */
export function isDirectAnswer(text: string): boolean {
  return DIRECT_ANSWER_PATTERNS.some(p => p.test(text));
}

/**
 * Detect if an AI response is already Socratic (asks questions).
 */
export function isSocratic(text: string): boolean {
  return SOCRATIC_PATTERNS.some(p => p.test(text));
}

/**
 * Get a guiding question for a concept.
 */
function getGuidingQuestion(concept: string, depth: number): string {
  const questions = GUIDING_QUESTIONS[concept] || DEFAULT_GUIDING_QUESTIONS;
  return questions[Math.min(depth, questions.length - 1)];
}

/**
 * Detect the concept being discussed from the AI response.
 */
function detectConcept(text: string): string {
  const conceptMap: Record<string, string[]> = {
    'articles': ['article', 'a ', 'an ', 'the ', 'definite', 'indefinite'],
    'tenses': ['tense', 'present', 'past', 'future', 'perfect', 'continuous'],
    'prepositions': ['preposition', 'at ', 'on ', 'in ', 'by ', 'for '],
    'conditionals': ['conditional', 'if ', 'would ', 'could '],
    'passive_voice': ['passive', 'be + v3', 'was ', 'were ', 'is being'],
    'sv_agreement': ['subject-verb', 'agreement', 'singular', 'plural', 's/es'],
    'relative_clauses': ['relative', 'who ', 'which ', 'that ', 'whom'],
  };

  const lower = text.toLowerCase();
  for (const [concept, keywords] of Object.entries(conceptMap)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return concept;
    }
  }
  return 'unknown';
}

/**
 * Rewrite a direct answer into a Socratic question.
 * Preserves the teaching content but replaces the answer reveal with a guiding question.
 */
function rewriteAsSocratic(text: string, concept: string, depth: number): string {
  // Remove direct answer statements
  let cleaned = text
    .replace(/jawabannya? (adalah|:)?\s*[A-D][\s\S]*/gi, '')
    .replace(/jawaban (yang )?benar (adalah|:)?\s*[A-D][\s\S]*/gi, '')
    .replace(/correct answer (is|:)?\s*[A-D][\s\S]*/gi, '')
    .replace(/the answer is\s+[A-D][\s\S]*/gi, '')
    .trim();

  // If cleaning removed everything, keep the original but add a question
  if (cleaned.length < 10) {
    cleaned = text.replace(/[.!?]+$/, '');
  }

  const question = getGuidingQuestion(concept, depth);
  return `${cleaned}\n\n${question}`;
}

/**
 * Load socratic state for a user from the database.
 */
export async function loadSocraticState(env: Env, userId: number): Promise<SocraticState> {
  try {
    const row = await env.DB.prepare(
      'SELECT socratic_state FROM student_profiles WHERE user_id = ?'
    ).bind(userId).first() as any;

    if (row?.socratic_state) {
      return JSON.parse(row.socratic_state);
    }
  } catch {}

  return { chainDepth: 0, lastConcept: '', revealed: false, attemptCount: 0 };
}

/**
 * Save socratic state for a user.
 */
export async function saveSocraticState(env: Env, userId: number, state: SocraticState): Promise<void> {
  try {
    await env.DB.prepare(
      'UPDATE student_profiles SET socratic_state = ? WHERE user_id = ?'
    ).bind(JSON.stringify(state), userId).run();
  } catch (e) {
    console.error('[socratic] Failed to save state:', e);
  }
}

/**
 * Apply Socratic filter to an AI tutor response.
 * 
 * If the AI gave a direct answer and we haven't reached max depth,
 * rewrite it as a guiding question. If max depth reached, reveal the answer.
 * 
 * Returns the (possibly modified) response text.
 */
export async function applySocraticFilter(
  env: Env,
  userId: number,
  aiResponse: string,
  studentAnswer?: string,
): Promise<{ text: string; state: SocraticState }> {
  const state = await loadSocraticState(env, userId);
  const concept = detectConcept(aiResponse);

  // If student gave an answer, check if it's correct
  if (studentAnswer) {
    // Extract the correct answer from the AI response
    const answerMatch = aiResponse.match(/jawabannya? (adalah|:)?\s*([A-D])/i) ||
                        aiResponse.match(/correct answer (is|:)?\s*([A-D])/i);

    if (answerMatch) {
      const correctAnswer = answerMatch[2].toUpperCase();
      const studentAnswerUpper = studentAnswer.trim().toUpperCase();

      if (studentAnswerUpper === correctAnswer) {
        // Student got it right — reset socratic chain
        state.chainDepth = 0;
        state.attemptCount = 0;
        state.revealed = false;
        state.lastConcept = concept;
        await saveSocraticState(env, userId, state);
        return { text: aiResponse, state };
      } else {
        // Student got it wrong — increment attempt count
        state.attemptCount += 1;
        state.lastConcept = concept;
      }
    }
  }

  // If AI gave a direct answer
  if (isDirectAnswer(aiResponse)) {
    // If we've reached max depth or max attempts, reveal the answer
    if (state.chainDepth >= MAX_SOCRATIC_DEPTH || state.attemptCount >= MAX_SOCRATIC_DEPTH) {
      state.chainDepth = 0;
      state.attemptCount = 0;
      state.revealed = true;
      state.lastConcept = concept;

      const revealMsg = `Oke, aku kasih tau ya — ${aiResponse}\n\nJangan khawatir, konsep ini memang butuh latihan. Yuk coba soal lagi!`;
      await saveSocraticState(env, userId, state);
      return { text: revealMsg, state };
    }

    // Rewrite as Socratic question
    state.chainDepth += 1;
    state.lastConcept = concept;
    state.revealed = false;

    const socraticText = rewriteAsSocratic(aiResponse, concept, state.chainDepth);
    await saveSocraticState(env, userId, state);
    return { text: socraticText, state };
  }

  // AI is already being Socratic — just track the concept
  if (isSocratic(aiResponse)) {
    state.lastConcept = concept;
    await saveSocraticState(env, userId, state);
  }

  return { text: aiResponse, state };
}

/**
 * Reset socratic state (called when starting a new topic or after /start).
 */
export async function resetSocraticState(env: Env, userId: number): Promise<void> {
  await saveSocraticState(env, userId, {
    chainDepth: 0,
    lastConcept: '',
    revealed: false,
    attemptCount: 0,
  });
}
