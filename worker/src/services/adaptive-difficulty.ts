// ═══════════════════════════════════════════════════════
// ADAPTIVE DIFFICULTY ENGINE
// 
// Real-time difficulty adjustment within exercise sessions.
// Tracks student performance in real-time and adjusts:
// - After 3 correct in a row → increase difficulty
// - After 2 wrong in a row → decrease difficulty + hint
// - Maintains "flow state" (60-80% accuracy zone)
// ═══════════════════════════════════════════════════════

import type { Env } from '../types';

export interface DifficultyState {
  currentDifficulty: number;    // 1-5
  consecutiveCorrect: number;
  consecutiveWrong: number;
  sessionAccuracy: number;
  totalInSession: number;
  correctInSession: number;
  lastAdjustment: string;       // 'up' | 'down' | 'none'
}

const DIFFICULTY_NAMES = ['', 'Mudah', 'Sedang', 'Menengah', 'Sulit', 'Expert'];

const DIFFICULTY_PROMPTS: Record<number, string> = {
  1: 'Level paling mudah. Soal basic, pilihan jelas, vocabulary sederhana.',
  2: 'Level mudah. Soal straightforward tapi ada sedikit jebakan.',
  3: 'Level menengah. Soal standar TOEFL/IELTS, vocabulary academic.',
  4: 'Level sulit. Soal complex, banyak distractor, vocabulary advanced.',
  5: 'Level expert. Soal tricky, nuance halus, untuk scoring tinggi.',
};

/**
 * Load difficulty state for a user's current session.
 */
export async function loadDifficultyState(env: Env, userId: number): Promise<DifficultyState> {
  try {
    const row = await env.DB.prepare(
      'SELECT difficulty_state FROM student_profiles WHERE user_id = ?'
    ).bind(userId).first() as any;

    if (row?.difficulty_state) {
      return JSON.parse(row.difficulty_state);
    }
  } catch {}

  return {
    currentDifficulty: 2,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    sessionAccuracy: 0,
    totalInSession: 0,
    correctInSession: 0,
    lastAdjustment: 'none',
  };
}

/**
 * Save difficulty state.
 */
export async function saveDifficultyState(env: Env, userId: number, state: DifficultyState): Promise<void> {
  try {
    await env.DB.prepare(
      'UPDATE student_profiles SET difficulty_state = ? WHERE user_id = ?'
    ).bind(JSON.stringify(state), userId).run();
  } catch (e) {
    console.error('[difficulty] Failed to save state:', e);
  }
}

/**
 * Adjust difficulty based a question result.
 * Returns the new difficulty level and optionally a message to show.
 */
export async function adjustDifficulty(
  env: Env,
  userId: number,
  wasCorrect: boolean,
): Promise<{ newDifficulty: number; message: string | null; state: DifficultyState }> {
  const state = await loadDifficultyState(env, userId);

  state.totalInSession += 1;
  if (wasCorrect) {
    state.correctInSession += 1;
    state.consecutiveCorrect += 1;
    state.consecutiveWrong = 0;
  } else {
    state.consecutiveWrong += 1;
    state.consecutiveCorrect = 0;
  }

  state.sessionAccuracy = state.totalInSession > 0
    ? Math.round((state.correctInSession / state.totalInSession) * 100)
    : 0;

  let message: string | null = null;
  let newDifficulty = state.currentDifficulty;

  // Increase difficulty after 3 consecutive correct
  if (state.consecutiveCorrect >= 3 && state.currentDifficulty < 5) {
    newDifficulty = Math.min(5, state.currentDifficulty + 1);
    state.lastAdjustment = 'up';
    message = `🔥 ${state.consecutiveCorrect} benar berturut! Naik ke level ${DIFFICULTY_NAMES[newDifficulty]}.`;
    state.consecutiveCorrect = 0;
  }

  // Decrease difficulty after 2 consecutive wrong
  if (state.consecutiveWrong >= 2 && state.currentDifficulty > 1) {
    newDifficulty = Math.max(1, state.currentDifficulty - 1);
    state.lastAdjustment = 'down';
    message = `💡 Kayaknya perlu pelan-pelan dulu. Turun ke level ${DIFFICULTY_NAMES[newDifficulty]}.`;
    state.consecutiveWrong = 0;
  }

  // If accuracy is too high (>90%) after 10+ questions, bump up
  if (state.totalInSession >= 10 && state.sessionAccuracy > 90 && state.currentDifficulty < 5) {
    newDifficulty = Math.min(5, state.currentDifficulty + 1);
    state.lastAdjustment = 'up';
    message = `📈 Akurasi kamu ${state.sessionAccuracy}% — terlalu mudah! Naik ke level ${DIFFICULTY_NAMES[newDifficulty]}.`;
  }

  // If accuracy is too low (<40%) after 10+ questions, bump down
  if (state.totalInSession >= 10 && state.sessionAccuracy < 40 && state.currentDifficulty > 1) {
    newDifficulty = Math.max(1, state.currentDifficulty - 1);
    state.lastAdjustment = 'down';
    message = `📊 Akurasi ${state.sessionAccuracy}% — turun ke level ${DIFFICULTY_NAMES[newDifficulty]} biar lebih nyaman.`;
  }

  state.currentDifficulty = newDifficulty;
  await saveDifficultyState(env, userId, state);

  return { newDifficulty, message, state };
}

/**
 * Build a difficulty instruction to inject into the AI prompt.
 */
export function buildDifficultyPrompt(difficulty: number): string {
  return `\nDIFFICULTY LEVEL: ${difficulty}/5 — ${DIFFICULTY_NAMES[difficulty]}. ${DIFFICULTY_PROMPTS[difficulty]}`;
}

/**
 * Reset difficulty state (new session or topic change).
 */
export async function resetDifficultyState(env: Env, userId: number, baseDifficulty?: number): Promise<void> {
  await saveDifficultyState(env, userId, {
    currentDifficulty: baseDifficulty || 2,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    sessionAccuracy: 0,
    totalInSession: 0,
    correctInSession: 0,
    lastAdjustment: 'none',
  });
}
