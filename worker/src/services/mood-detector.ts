// ═══════════════════════════════════════════════════════
// MOOD-AWARE TUTORING ENGINE
// 
// Detects student frustration/confusion from message patterns
// and adjusts tutor tone accordingly.
// ═══════════════════════════════════════════════════════

import type { Env } from '../types';

export type MoodState = 'frustrated' | 'confused' | 'bored' | 'confident' | 'neutral';

export interface MoodAnalysis {
  mood: MoodState;
  confidence: number;  // 0-1
  signals: string[];
}

// Frustration signals
const FRUSTRATION_PATTERNS = [
  /susah banget/i,
  /ngerti-ngerti/i,
  /bingung/i,
  /pusing/i,
  /capek/i,
  /malas/i,
  /nggak ngerti/i,
  /tidak mengerti/i,
  /don't understand/i,
  /so hard/i,
  /too difficult/i,
  /stupid/i,
  /bodoh/i,
  /goblok/i,
  /!{3,}/,              // Multiple exclamation marks: !!!
  /(\w+)\s+\1{2,}/i,   // Repeated words: "kenapa kenapa kenapa"
];

// Confusion signals
const CONFUSION_PATTERNS = [
  /bedanya apa/i,
  /apa beda/i,
  /beda.*dengan/i,
  /beda.*sama/i,
  /what's the difference/i,
  /kenapa (bisa|gitu|demikian)/i,
  /kok bisa/i,
  /gimana (cara|kalau)/i,
  /gimana (kalau|car)/i,
  /how (do|does|can)/i,
  /explain/i,
  /jelasin/i,
  /tolong jelas/i,
  /can you explain/i,
  /apa maksud/i,
  /what does.*mean/i,
];

// Boredom signals
const BOREDOM_PATTERNS = [
  /udah tau/i,
  /udah bisa/i,
  /udah paham/i,
  /udah ngerti/i,
  /udah bisa/i,
  /bosen/i,
  /bosan/i,
  /boring/i,
  /too easy/i,
  /terlalu mudah/i,
  /gampang banget/i,
  /udah sering/i,
  /lagi lagi/i,
  /itu lagi/i,
  /that again/i,
  /next next/i,
  /skip/i,
  /cepat/i,
  /faster/i,
];

// Confidence signals
const CONFIDENCE_PATTERNS = [
  /udah bisa/i,
  /udah ngerti/i,
  /udah paham/i,
  /mantap/i,
  /keren/i,
  /easy/i,
  /gampang/i,
  /mudah/i,
  /siap/i,
  /let's go/i,
  /gas/i,
  /ayo/i,
  /yuk/i,
];

/**
 * Analyze student message for mood signals.
 */
export function analyzeMood(message: string): MoodAnalysis {
  const signals: string[] = [];
  let mood: MoodState = 'neutral';
  let maxScore = 0;

  const scores: Record<MoodState, number> = {
    frustrated: 0,
    confused: 0,
    bored: 0,
    confident: 0,
    neutral: 0,
  };

  for (const pattern of FRUSTRATION_PATTERNS) {
    if (pattern.test(message)) {
      scores.frustrated += 1;
      signals.push('frustration');
    }
  }

  for (const pattern of CONFUSION_PATTERNS) {
    if (pattern.test(message)) {
      scores.confused += 1;
      signals.push('confusion');
    }
  }

  for (const pattern of BOREDOM_PATTERNS) {
    if (pattern.test(message)) {
      scores.bored += 1;
      signals.push('boredom');
    }
  }

  for (const pattern of CONFIDENCE_PATTERNS) {
    if (pattern.test(message)) {
      scores.confident += 1;
      signals.push('confidence');
    }
  }

  // Determine dominant mood
  for (const [m, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      mood = m as MoodState;
    }
  }

  const confidence = maxScore > 0 ? Math.min(1, maxScore * 0.4) : 0;

  return { mood, confidence, signals: [...new Set(signals)] };
}

/**
 * Build mood context to inject into the AI system prompt.
 */
export function buildMoodContext(mood: MoodState, confidence: number): string {
  if (confidence < 0.3 || mood === 'neutral') return '';

  const contexts: Record<MoodState, string> = {
    frustrated: `
MURID TERDETEKSI FRUSTASI:
- Tone: lebih sabar, lebih supportive. Jangan terdengar menggurui.
- Kasih jeda: "Nggak apa-apa, ini memang tricky. Yuk pelan-pelan."
- Kurangi jumlah soal — fokus ke 1 konsep dulu.
- Pakai analogi yang relate sama kehidupan mereka.
- Jangan kasih soal baru sampai mereka bilang "udah siap".`,

    confused: `
MURID TERDETEKSI BINGUNG:
- Jelaskan lebih perlahan, step by step.
- Pakai contoh yang lebih konkret dan familiar.
- Jangan langsung kasih soal — jelaskan dulu dengan analogi.
- Tanya "udah jelas atau masih bingung?" di akhir.`,

    bored: `
MURID TERDETEKSI BOSEN:
- Naikkan difficulty — kasih soal yang lebih challenging.
- Kurangi penjelasan, langsung ke soal.
- Pakai format yang berbeda: challenge, race, puzzle.
- Tone: lebih energik, lebih cepat.`,

    confident: `
MURID TERDETEKSI PERCAYA DIRI:
- Kasih soal yang lebih sulit.
- Apresiasi: "Keren, kamu udah nangkep polanya!"
- Tantang dengan edge cases dan exceptions.
- Bisa kasih soal tipe "trick question".`,

    neutral: '',
  };

  return contexts[mood] || '';
}

/**
 * Track mood history for a user (last 5 interactions).
 * If frustration persists for 3+ interactions, trigger intervention.
 */
export async function trackMoodHistory(
  env: Env,
  userId: number,
  mood: MoodState,
): Promise<{ needsIntervention: boolean; message: string | null }> {
  try {
    const row = await env.DB.prepare(
      'SELECT mood_history FROM student_profiles WHERE user_id = ?'
    ).bind(userId).first() as any;

    let history: string[] = [];
    if (row?.mood_history) {
      history = JSON.parse(row.mood_history);
    }

    history.push(mood);
    if (history.length > 5) history = history.slice(-5);

    await env.DB.prepare(
      'UPDATE student_profiles SET mood_history = ? WHERE user_id = ?'
    ).bind(JSON.stringify(history), userId).run();

    // Check for persistent frustration (3+ in last 5)
    const frustrationCount = history.filter(m => m === 'frustrated').length;
    if (frustrationCount >= 3) {
      return {
        needsIntervention: true,
        message: 'Hei, kayaknya kamu lagi struggle nih. Nggak apa-apa kok — kita istirahat dulu atau ganti topik yang lebih ringan? Aku di sini buat bantu, bukan buat nge-test. 😊',
      };
    }

    return { needsIntervention: false, message: null };
  } catch {
    return { needsIntervention: false, message: null };
  }
}
