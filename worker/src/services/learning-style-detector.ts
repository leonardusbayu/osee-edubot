// ═══════════════════════════════════════════════════════
// LEARNING STYLE DETECTOR
// 
// Analyzes student behavior to detect learning style:
// - Visual: responds well to diagrams, side-by-side examples
// - Verbal: responds well to narrative explanations
// - Active: prefers jumping into exercises first
// - Reflective: prefers reading explanations before trying
// ═══════════════════════════════════════════════════════

import type { Env } from '../types';

export type LearningStyle = 'visual' | 'verbal' | 'active' | 'reflective' | 'balanced';

export interface StyleScores {
  visual: number;
  verbal: number;
  active: number;
  reflective: number;
  totalInteractions: number;
}

/**
 * Analyze student message for learning style signals.
 */
function detectStyleFromMessage(message: string): Partial<StyleScores> {
  const lower = message.toLowerCase();
  const scores: Partial<StyleScores> = {};

  // Visual signals
  if (/gambar|diagram|tabel|visual|lihat|contoh.*samping/i.test(lower)) {
    scores.visual = (scores.visual || 0) + 1;
  }

  // Verbal signals
  if (/ceritain|jelasin|cerita|penjelasan|narasi|panjang/i.test(lower)) {
    scores.verbal = (scores.verbal || 0) + 1;
  }

  // Active signals
  /langsung soal|kasih soal|praktek|latihan|coba|gas|ayo/i.test(lower);
  if (/langsung soal|kasih soal|praktek|latihan|coba|gas|ayo/i.test(lower)) {
    scores.active = (scores.active || 0) + 1;
  }

  // Reflective signals
  if (/baca|pikir|tunggu|jelasin dulu|sab/i.test(lower)) {
    scores.reflective = (scores.reflective || 0) + 1;
  }

  return scores;
}

/**
 * Load style scores from student profile.
 */
export async function loadStyleScores(env: Env, userId: number): Promise<StyleScores> {
  try {
    const row = await env.DB.prepare(
      'SELECT style_scores FROM student_profiles WHERE user_id = ?'
    ).bind(userId).first() as any;

    if (row?.style_scores) {
      return JSON.parse(row.style_scores);
    }
  } catch {}

  return { visual: 0, verbal: 0, active: 0, reflective: 0, totalInteractions: 0 };
}

/**
 * Save style scores.
 */
export async function saveStyleScores(env: Env, userId: number, scores: StyleScores): Promise<void> {
  try {
    await env.DB.prepare(
      'UPDATE student_profiles SET style_scores = ? WHERE user_id = ?'
    ).bind(JSON.stringify(scores), userId).run();
  } catch {}
}

/**
 * Update style scores based on a message.
 */
export async function updateStyleScores(env: Env, userId: number, message: string): Promise<LearningStyle> {
  const scores = await loadStyleScores(env, userId);
  const messageScores = detectStyleFromMessage(message);

  scores.totalInteractions += 1;
  if (messageScores.visual) scores.visual += messageScores.visual;
  if (messageScores.verbal) scores.verbal += messageScores.verbal;
  if (messageScores.active) scores.active += messageScores.active;
  if (messageScores.reflective) scores.reflective += messageScores.reflective;

  await saveStyleScores(env, userId, scores);

  return computeLearningStyle(scores);
}

/**
 * Compute the dominant learning style from scores.
 */
function computeLearningStyle(scores: StyleScores): LearningStyle {
  if (scores.totalInteractions < 5) return 'balanced';

  const maxScore = Math.max(scores.visual, scores.verbal, scores.active, scores.reflective);
  const total = scores.visual + scores.verbal + scores.active + scores.reflective;

  // If no clear dominant (all within 20% of each other), return balanced
  if (total === 0) return 'balanced';

  const dominant = maxScore / total;
  if (dominant < 0.4) return 'balanced';

  if (scores.visual === maxScore) return 'visual';
  if (scores.verbal === maxScore) return 'verbal';
  if (scores.active === maxScore) return 'active';
  return 'reflective';
}

/**
 * Build learning style context for system prompt.
 */
export function buildLearningStyleContext(style: LearningStyle): string {
  if (style === 'balanced') return '';

  const contexts: Record<LearningStyle, string> = {
    visual: `
GAYA BELAJAR: VISUAL
- Siswa ini lebih suka contoh visual: diagram, tabel, side-by-side comparison.
- Gunakan format "Salah vs Benar" atau "Before vs After".
- Highlight pattern dengan contoh yang bisa "dilihat".`,

    verbal: `
GAYA BELAJAR: VERBAL
- Siswa ini lebih suka penjelasan naratif dan cerita.
- Jelaskan lewat kalimat mengalir, bukan bullet points.
- Gunakan analogi dan cerita real-life.`,

    active: `
GAYA BELAJAR: ACTIVE
- Siswa ini lebih suka langsung praktek.
- Kasih soal DULU, baru jelaskan setelah mereka coba.
- Learning by doing — jangan terlalu banyak teori.`,

    reflective: `
GAYA BELAJAR: REFLECTIVE
- Siswa ini lebih suka mikir dulu sebelum jawab.
- Beri penjelasan lengkap sebelum kasih soal.
- Tanya "kenapa menurut kamu?" sebelum kasih jawaban.`,

    balanced: '',
  };

  return contexts[style];
}

/**
 * Get style recommendation for a student.
 */
export async function getStyleRecommendation(env: Env, userId: number): Promise<{
  style: LearningStyle;
  confidence: number;
  recommendation: string;
}> {
  const scores = await loadStyleScores(env, userId);
  const style = computeLearningStyle(scores);
  const total = scores.visual + scores.verbal + scores.active + scores.reflective;
  const confidence = scores.totalInteractions >= 10 ? Math.min(1, total / scores.totalInteractions) : 0;

  const recommendations: Record<LearningStyle, string> = {
    visual: 'Kamu lebih suka belajar lewat contoh visual. Aku akan kasih lebih banyak diagram dan perbandingan.',
    verbal: 'Kamu lebih suka penjelasan yang mengalir seperti cerita. Aku akan pakai lebih banyak analogi.',
    active: 'Kamu lebih suka langsung praktek. Aku akan kasih soal dulu, baru jelaskan.',
    reflective: 'Kamu lebih suka mikir dulu sebelum jawab. Aku akan kasih penjelasan lengkap sebelum soal.',
    balanced: 'Kamu fleksibel — aku akan variasikan pendekatan belajar.',
  };

  return { style, confidence, recommendation: recommendations[style] };
}
