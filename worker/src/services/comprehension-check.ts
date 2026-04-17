// comprehension-check.ts — "teach-then-check" flow.
//
// The private tutor, when in lesson mode, emits a structured [CHECK]...[/CHECK]
// block after each teaching chunk. This service parses that block, stores the
// active CQ per user, branches on correct/wrong/pause, and generates a reteach
// using a different pedagogical strategy when the student misses.
//
// Flow overview:
//   1. Tutor replies with TEACH TEXT + [CHECK] block.
//   2. webhook.ts calls parseCheckBlock() to split them.
//   3. Teach text is sent as a normal message.
//   4. CQ is saved via saveActiveCq() and sent with inline keyboard:
//        [A] [B] [C] [D]
//        [⏸ Tunggu dulu]
//   5. Student taps a letter → webhook calls handleCqAnswer().
//        correct → updateMentalModel('solid'), clearActiveCq, advance lesson
//        wrong  → updateMentalModel('partial'|'misconception'),
//                 generateReteach() with next strategy, store new CQ, send.
//   6. Student taps "Tunggu dulu" → setLessonPaused(true). Chat routes to Q&A
//      until student types resume or taps the resume button.

import type { Env, User } from '../types';
import { recordEvidence, recordMisconception } from './mental-model';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface ComprehensionCheck {
  question: string;
  options: string[];              // length 2-4; letter A corresponds to options[0], etc.
  correct_letter: string;         // 'A' | 'B' | 'C' | 'D'
  strategy_if_wrong?: ReteachStrategy;
  concept?: string;
}

export type ReteachStrategy = 'analogy' | 'simpler' | 'example' | 'visual';

export interface ParsedTutorMessage {
  teach_text: string;             // everything before/after the [CHECK] block
  cq: ComprehensionCheck | null;
}

export interface ActiveCqRow {
  user_id: number;
  plan_id: number | null;
  step_index: number | null;
  concept: string | null;
  question: string;
  options: string[];
  correct_letter: string;
  strategy_used: ReteachStrategy | null;
  attempts: number;
}

// ─────────────────────────────────────────────────────────────
// PARSING — pulls a [CHECK]...[/CHECK] block out of tutor output
// ─────────────────────────────────────────────────────────────

const CHECK_BLOCK_RE = /\[CHECK\]([\s\S]*?)\[\/CHECK\]/i;

/**
 * Parse a tutor response into (teach_text, cq). If no [CHECK] block is found,
 * or the block is malformed, cq will be null and teach_text is the full message.
 * We always try to return usable teach text — never throw on a malformed block.
 */
export function parseCheckBlock(text: string): ParsedTutorMessage {
  if (!text || typeof text !== 'string') return { teach_text: text || '', cq: null };

  const match = text.match(CHECK_BLOCK_RE);
  if (!match) return { teach_text: text.trim(), cq: null };

  const teach_text = text.replace(CHECK_BLOCK_RE, '').trim();
  const body = match[1];

  const cq = parseCheckBody(body);
  return { teach_text, cq };
}

/**
 * Parse the inside of a CHECK block. Tolerant: accepts minor formatting variance.
 * Expected shape:
 *   Q: <question text>
 *   A) option A
 *   B) option B
 *   C) option C
 *   CORRECT: B
 *   STRATEGY_IF_WRONG: analogy
 */
function parseCheckBody(body: string): ComprehensionCheck | null {
  if (!body) return null;

  // Question
  const qMatch = body.match(/Q\s*:\s*(.+?)(?=\n\s*[A-D]\s*[)\].]|\n\s*CORRECT|\n\s*STRATEGY|$)/is);
  const question = qMatch ? qMatch[1].trim().replace(/\s+/g, ' ') : '';
  if (!question) return null;

  // Options — look for lines starting with A) / A. / A]
  const options: string[] = [];
  const optRe = /^\s*([A-D])\s*[)\].]\s*(.+?)\s*$/gmi;
  let m: RegExpExecArray | null;
  while ((m = optRe.exec(body)) !== null) {
    const letter = m[1].toUpperCase();
    const text = m[2].trim();
    if (!text) continue;
    const idx = letter.charCodeAt(0) - 'A'.charCodeAt(0);
    options[idx] = text;
  }
  // Compact options array (drop gaps)
  const compacted = options.filter((o) => typeof o === 'string' && o.length > 0);
  if (compacted.length < 2) return null;

  // Correct letter
  const cMatch = body.match(/CORRECT\s*:\s*([A-D])/i);
  if (!cMatch) return null;
  const correct_letter = cMatch[1].toUpperCase();
  // Correct letter must be in range
  const idx = correct_letter.charCodeAt(0) - 'A'.charCodeAt(0);
  if (idx < 0 || idx >= compacted.length) return null;

  // Strategy for reteach (optional)
  const sMatch = body.match(/STRATEGY(?:_IF_WRONG)?\s*:\s*(analogy|simpler|example|visual)/i);
  const strategy_if_wrong = sMatch ? (sMatch[1].toLowerCase() as ReteachStrategy) : undefined;

  return {
    question,
    options: compacted,
    correct_letter,
    strategy_if_wrong,
  };
}

// ─────────────────────────────────────────────────────────────
// STATE — save / load / clear the pending CQ for a user
// ─────────────────────────────────────────────────────────────

export async function saveActiveCq(
  env: Env,
  userId: number,
  cq: ComprehensionCheck,
  opts: { plan_id?: number | null; step_index?: number | null; concept?: string | null; strategy_used?: ReteachStrategy | null } = {},
): Promise<void> {
  try {
    // Upsert — one active CQ per user, overwrite any prior pending one.
    await env.DB.prepare(
      `INSERT INTO lesson_cq_active
         (user_id, plan_id, step_index, concept, question, options, correct_letter, strategy_used, attempts, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         plan_id = excluded.plan_id,
         step_index = excluded.step_index,
         concept = excluded.concept,
         question = excluded.question,
         options = excluded.options,
         correct_letter = excluded.correct_letter,
         strategy_used = excluded.strategy_used,
         attempts = excluded.attempts,
         created_at = excluded.created_at`,
    ).bind(
      userId,
      opts.plan_id ?? null,
      opts.step_index ?? null,
      opts.concept ?? null,
      cq.question.slice(0, 500),
      JSON.stringify(cq.options),
      cq.correct_letter,
      opts.strategy_used ?? null,
    ).run();
  } catch (e) {
    console.error('saveActiveCq failed:', e);
  }
}

export async function loadActiveCq(env: Env, userId: number): Promise<ActiveCqRow | null> {
  try {
    const row = await env.DB.prepare(
      `SELECT user_id, plan_id, step_index, concept, question, options, correct_letter, strategy_used, attempts
         FROM lesson_cq_active WHERE user_id = ?`,
    ).bind(userId).first<any>();
    if (!row) return null;
    let options: string[] = [];
    try { options = JSON.parse(row.options || '[]'); } catch {}
    return {
      user_id: Number(row.user_id),
      plan_id: row.plan_id != null ? Number(row.plan_id) : null,
      step_index: row.step_index != null ? Number(row.step_index) : null,
      concept: row.concept || null,
      question: String(row.question || ''),
      options,
      correct_letter: String(row.correct_letter || 'A').toUpperCase(),
      strategy_used: (row.strategy_used || null) as ReteachStrategy | null,
      attempts: Number(row.attempts) || 0,
    };
  } catch (e) {
    console.error('loadActiveCq failed:', e);
    return null;
  }
}

export async function clearActiveCq(env: Env, userId: number): Promise<void> {
  try {
    await env.DB.prepare(`DELETE FROM lesson_cq_active WHERE user_id = ?`).bind(userId).run();
  } catch (e) {
    console.error('clearActiveCq failed:', e);
  }
}

export async function bumpAttempts(env: Env, userId: number): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE lesson_cq_active SET attempts = attempts + 1 WHERE user_id = ?`,
    ).bind(userId).run();
  } catch (e) {
    console.error('bumpAttempts failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// LOGGING — append to lesson_cq_attempts history table
// ─────────────────────────────────────────────────────────────

export async function logCqAttempt(
  env: Env,
  userId: number,
  active: ActiveCqRow,
  studentLetter: string,
  wasCorrect: boolean,
  attemptNum: number,
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO lesson_cq_attempts
         (user_id, plan_id, step_index, concept, question, correct_letter, student_letter, was_correct, strategy_used, attempt_num, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).bind(
      userId,
      active.plan_id,
      active.step_index,
      active.concept,
      active.question.slice(0, 500),
      active.correct_letter,
      studentLetter,
      wasCorrect ? 1 : 0,
      active.strategy_used,
      attemptNum,
    ).run();
  } catch (e) {
    console.error('logCqAttempt failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// MENTAL MODEL UPDATES from CQ outcomes
// ─────────────────────────────────────────────────────────────

/**
 * Translate a CQ outcome into a mental-model evidence update.
 *
 * First-try correct      → 'correct_answer' evidence, strong weight
 * Correct after reteach  → 'correct_answer' evidence, moderate weight
 * Wrong first try        → 'wrong_answer' evidence, partial understanding
 * Wrong after reteach    → 'wrong_answer' evidence + flag misconception
 */
export async function updateMentalModelFromCq(
  env: Env,
  userId: number,
  active: ActiveCqRow,
  wasCorrect: boolean,
  attemptNum: number,
): Promise<void> {
  if (!active.concept) return;
  try {
    if (wasCorrect) {
      const weight = attemptNum === 1 ? 0.8 : 0.5;
      await recordEvidence(env, userId, active.concept, 'correct_answer',
        `CQ correct on attempt ${attemptNum}${active.strategy_used ? ` (after ${active.strategy_used} reteach)` : ''}`,
        weight,
      );
    } else {
      await recordEvidence(env, userId, active.concept, 'wrong_answer',
        `CQ wrong (picked ${active.correct_letter === 'A' ? 'not A' : 'a distractor'}) on attempt ${attemptNum}`,
        0.5,
      );
      if (attemptNum >= 2) {
        // Two misses on the same concept → mark as misconception so future
        // lesson plans start by surfacing and correcting it.
        await recordMisconception(env, userId, active.concept,
          `Repeated CQ misses on "${active.question.slice(0, 80)}"`,
        );
      }
    }
  } catch (e) {
    console.error('updateMentalModelFromCq failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// RETEACH — pick the next strategy and generate a new teach+check
// ─────────────────────────────────────────────────────────────

/**
 * Pick the next reteach strategy, rotating through options so we don't
 * repeat the one that just failed.
 */
export function nextReteachStrategy(current: ReteachStrategy | null): ReteachStrategy {
  const rotation: ReteachStrategy[] = ['analogy', 'simpler', 'example', 'visual'];
  if (!current) return 'analogy';
  const idx = rotation.indexOf(current);
  return rotation[(idx + 1) % rotation.length];
}

const STRATEGY_DESCRIPTIONS: Record<ReteachStrategy, string> = {
  analogy: 'Use an EVERYDAY INDONESIAN ANALOGY the student will recognize (cooking, traffic, sports, pop culture). Map the grammar/reading rule to something familiar.',
  simpler: 'Break the concept into a SMALLER STEP. Assume less prior knowledge. Use shorter sentences. One rule at a time.',
  example: 'Ditch the rule entirely. Show FIVE short examples back-to-back and let the pattern speak. No explanation.',
  visual: 'Use TEXT-VISUAL layout: side-by-side SALAH vs BENAR, arrows showing transformation, tables, bolded pattern.',
};

/**
 * Build a prompt that re-teaches `concept` with the given strategy and emits
 * a fresh [CHECK] block. Returns the prompt string — caller is responsible for
 * running it through the OpenAI chat endpoint.
 */
export function buildReteachPrompt(
  concept: string,
  strategy: ReteachStrategy,
  studentFirstName: string,
  previousCq: ComprehensionCheck,
  studentLetter: string,
): string {
  return `The student "${studentFirstName}" just missed a comprehension check on the concept "${concept}".

Previous question:
${previousCq.question}

Options:
${previousCq.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')}
Correct: ${previousCq.correct_letter}
Student picked: ${studentLetter}

Do NOT just repeat the explanation. Re-teach using this specific strategy:

STRATEGY = ${strategy.toUpperCase()}
${STRATEGY_DESCRIPTIONS[strategy]}

Then emit a NEW comprehension check that tests the same concept but with DIFFERENT wording + different options. The new check must:
- Not be identical to the previous one
- Still target the same concept
- Be answerable in ≤ 15 seconds

Response format (strict — follow exactly):

<your reteach text in Indonesian, ~3-5 short lines, matching the strategy>

[CHECK]
Q: <new 1-sentence question>
A) <option text>
B) <option text>
C) <option text>
CORRECT: <letter>
STRATEGY_IF_WRONG: ${nextReteachStrategy(strategy)}
[/CHECK]

Do not output anything after [/CHECK].`;
}

// ─────────────────────────────────────────────────────────────
// PAUSE STATE — "tunggu dulu" flow
// ─────────────────────────────────────────────────────────────

export async function setLessonPaused(env: Env, userId: number, paused: boolean): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE student_profiles
          SET lesson_paused = ?, lesson_paused_at = ${paused ? "datetime('now')" : 'NULL'}
        WHERE user_id = ?`,
    ).bind(paused ? 1 : 0, userId).run();
  } catch (e) {
    console.error('setLessonPaused failed:', e);
  }
}

export async function isLessonPaused(env: Env, userId: number): Promise<boolean> {
  try {
    const row = await env.DB.prepare(
      `SELECT lesson_paused FROM student_profiles WHERE user_id = ?`,
    ).bind(userId).first<any>();
    return Number(row?.lesson_paused) === 1;
  } catch (e) {
    console.error('isLessonPaused failed:', e);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// TELEGRAM KEYBOARDS
// ─────────────────────────────────────────────────────────────

/**
 * Build inline keyboard for a comprehension check.
 * Callback data conventions (kept short — Telegram caps at 64 bytes):
 *   cq:a:<letter>        — answer (letter is always 1 char)
 *   cq:p                 — pause ("tunggu dulu")
 */
export function buildCqKeyboard(options: string[]): { inline_keyboard: any[][] } {
  const letters = ['A', 'B', 'C', 'D'];
  const answerRow = options.slice(0, 4).map((_, i) => ({
    text: letters[i],
    callback_data: `cq:a:${letters[i]}`,
  }));
  return {
    inline_keyboard: [
      answerRow,
      [{ text: '⏸ Tunggu dulu, jelasin lagi', callback_data: 'cq:p' }],
    ],
  };
}

/**
 * Keyboard shown while a lesson is paused — lets the student resume.
 */
export function buildResumeKeyboard(): { inline_keyboard: any[][] } {
  return {
    inline_keyboard: [
      [{ text: '▶️ Lanjut lesson', callback_data: 'cq:r' }],
    ],
  };
}

/**
 * Render the CQ as a readable Telegram message body (question + lettered options).
 */
export function formatCqMessage(cq: ComprehensionCheck): string {
  const letters = ['A', 'B', 'C', 'D'];
  const opts = cq.options.slice(0, 4)
    .map((o, i) => `${letters[i]}) ${o}`)
    .join('\n');
  return `🧠 *Cek pemahaman:*\n${cq.question}\n\n${opts}`;
}
