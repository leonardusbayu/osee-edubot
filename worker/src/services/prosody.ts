// Prosody analysis from Whisper word-level timestamps.
//
// Extracts: pause patterns, speaking rate, fluency markers, rhythm.
// Fed into the speaking scorer as objective evidence alongside GPT scoring.

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface WhisperVerboseResult {
  text: string;
  words?: WhisperWord[];
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    no_speech_prob?: number;
  }>;
  duration?: number;
}

export interface ProsodyMetrics {
  // Speaking rate
  words_per_minute: number;
  syllable_rate: number; // estimated syllables/second

  // Pauses
  total_pause_time: number;     // seconds of silence
  pause_ratio: number;          // pause_time / total_duration
  long_pauses: number;          // pauses > 1.5s (hesitation markers)
  medium_pauses: number;        // pauses 0.5-1.5s (natural breath pauses)
  avg_pause_duration: number;

  // Fluency
  filler_count: number;         // um, uh, er, etc.
  repetition_count: number;     // immediate word repetitions
  self_correction_count: number; // detected false starts

  // Rhythm & variability
  rate_variability: number;     // std dev of local speaking rates (higher = less monotone)
  segment_count: number;

  // Summary
  fluency_score: number;        // 0-100 composite
  rhythm_score: number;         // 0-100 composite
  overall_delivery: number;     // 0-100 composite

  // Raw data for storage
  raw_json: string;
}

const FILLERS = new Set(['um', 'uh', 'er', 'eh', 'ah', 'erm', 'hmm', 'uhm', 'like', 'you know', 'i mean', 'so', 'well']);
// Only count standalone "like", "so", "well" — not part of normal phrases
const CONTEXT_FILLERS = new Set(['like', 'so', 'well']);

function estimateSyllables(word: string): number {
  // Simple English syllable estimation
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  let count = 0;
  const vowels = 'aeiouy';
  let prevVowel = false;
  for (const ch of w) {
    const isVowel = vowels.includes(ch);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  // Silent e
  if (w.endsWith('e') && count > 1) count--;
  return Math.max(1, count);
}

export function analyzeProsody(verbose: WhisperVerboseResult): ProsodyMetrics {
  const words = verbose.words || [];
  const text = verbose.text || '';

  if (words.length < 3) {
    return emptyMetrics(text);
  }

  const totalDuration = verbose.duration || words[words.length - 1].end;
  const speechStart = words[0].start;
  const speechEnd = words[words.length - 1].end;
  const speechSpan = speechEnd - speechStart;

  // ─── Pause analysis ───
  const pauses: number[] = [];
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap > 0.15) { // ignore micro-gaps < 150ms
      pauses.push(gap);
    }
  }

  const totalPauseTime = pauses.reduce((s, p) => s + p, 0);
  const longPauses = pauses.filter(p => p > 1.5).length;
  const mediumPauses = pauses.filter(p => p >= 0.5 && p <= 1.5).length;
  const avgPause = pauses.length > 0 ? totalPauseTime / pauses.length : 0;

  // ─── Speaking rate ───
  const wpm = speechSpan > 0 ? (words.length / speechSpan) * 60 : 0;
  const totalSyllables = words.reduce((s, w) => s + estimateSyllables(w.word), 0);
  const syllableRate = speechSpan > 0 ? totalSyllables / speechSpan : 0;

  // ─── Fillers & repetitions ───
  let fillerCount = 0;
  let repetitionCount = 0;
  let selfCorrectionCount = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i].word.toLowerCase().replace(/[^a-z]/g, '');

    // Fillers
    if (FILLERS.has(w)) {
      if (CONTEXT_FILLERS.has(w)) {
        // Only count if followed by a pause > 0.3s (filler-like usage)
        if (i < words.length - 1) {
          const gap = words[i + 1].start - words[i].end;
          if (gap > 0.3) fillerCount++;
        }
      } else {
        fillerCount++;
      }
    }

    // Immediate repetitions (e.g., "I I think", "the the")
    if (i > 0) {
      const prev = words[i - 1].word.toLowerCase().replace(/[^a-z]/g, '');
      if (w === prev && w.length > 1) repetitionCount++;
    }

    // Self-corrections: word abandoned mid-way (very short word followed by pause then different word)
    if (i > 0 && i < words.length - 1) {
      const prevDuration = words[i - 1].end - words[i - 1].start;
      const prevWord = words[i - 1].word.toLowerCase().replace(/[^a-z]/g, '');
      if (prevDuration < 0.15 && prevWord.length <= 3 && prevWord !== w) {
        const gap = words[i].start - words[i - 1].end;
        if (gap > 0.2) selfCorrectionCount++;
      }
    }
  }

  // ─── Rate variability (rhythm) ───
  // Compute local speaking rates in 3-second windows
  const windowSize = 3; // seconds
  const localRates: number[] = [];
  let windowStart = speechStart;

  while (windowStart < speechEnd) {
    const windowEnd = windowStart + windowSize;
    const windowWords = words.filter(w => w.start >= windowStart && w.start < windowEnd);
    if (windowWords.length > 0) {
      localRates.push(windowWords.length / windowSize * 60);
    }
    windowStart += windowSize;
  }

  let rateVariability = 0;
  if (localRates.length > 1) {
    const mean = localRates.reduce((s, r) => s + r, 0) / localRates.length;
    const variance = localRates.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / localRates.length;
    rateVariability = Math.sqrt(variance);
  }

  // ─── Composite scores (0-100) ───

  // Fluency score: penalize long pauses, fillers, repetitions
  const pausePenalty = Math.min(30, longPauses * 8 + mediumPauses * 2);
  const fillerPenalty = Math.min(25, fillerCount * 4);
  const repPenalty = Math.min(15, (repetitionCount + selfCorrectionCount) * 5);
  const fluencyScore = Math.max(0, Math.min(100, 100 - pausePenalty - fillerPenalty - repPenalty));

  // Rhythm score: reward moderate variability (monotone = low var, chaotic = very high var)
  // Optimal WPM for IELTS: 120-160
  const wpmPenalty = wpm < 80 ? (80 - wpm) * 0.5 : wpm > 200 ? (wpm - 200) * 0.3 : 0;
  const varBonus = rateVariability > 10 && rateVariability < 50 ? 15 : 0;
  const rhythmScore = Math.max(0, Math.min(100, 80 - wpmPenalty + varBonus));

  // Overall delivery: weighted combination
  const overallDelivery = Math.round(fluencyScore * 0.6 + rhythmScore * 0.4);

  return {
    words_per_minute: Math.round(wpm),
    syllable_rate: Math.round(syllableRate * 10) / 10,
    total_pause_time: Math.round(totalPauseTime * 10) / 10,
    pause_ratio: speechSpan > 0 ? Math.round((totalPauseTime / speechSpan) * 100) / 100 : 0,
    long_pauses: longPauses,
    medium_pauses: mediumPauses,
    avg_pause_duration: Math.round(avgPause * 100) / 100,
    filler_count: fillerCount,
    repetition_count: repetitionCount,
    self_correction_count: selfCorrectionCount,
    rate_variability: Math.round(rateVariability * 10) / 10,
    segment_count: verbose.segments?.length || 0,
    fluency_score: Math.round(fluencyScore),
    rhythm_score: Math.round(rhythmScore),
    overall_delivery: overallDelivery,
    raw_json: JSON.stringify({
      word_count: words.length,
      duration: totalDuration,
      pauses: pauses.length,
      long_pauses: longPauses,
      fillers: fillerCount,
    }),
  };
}

function emptyMetrics(text: string): ProsodyMetrics {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return {
    words_per_minute: 0,
    syllable_rate: 0,
    total_pause_time: 0,
    pause_ratio: 0,
    long_pauses: 0,
    medium_pauses: 0,
    avg_pause_duration: 0,
    filler_count: 0,
    repetition_count: 0,
    self_correction_count: 0,
    rate_variability: 0,
    segment_count: 0,
    fluency_score: 50,
    rhythm_score: 50,
    overall_delivery: 50,
    raw_json: JSON.stringify({ word_count: wordCount, no_timestamps: true }),
  };
}

/**
 * Call Whisper with word-level timestamps.
 * Returns both the transcription text and the full verbose result.
 */
export async function transcribeWithTimestamps(
  apiKey: string,
  audioBytes: ArrayBuffer,
): Promise<{ text: string; verbose: WhisperVerboseResult }> {
  const formData = new FormData();
  formData.append('file', new Blob([audioBytes], { type: 'audio/ogg' }), 'voice.ogg');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  const verbose: WhisperVerboseResult = await resp.json() as any;
  return {
    text: (verbose.text || '').trim(),
    verbose,
  };
}

/**
 * Format prosody metrics as a compact string for GPT scoring context.
 */
export function prosodyContextForScorer(m: ProsodyMetrics): string {
  return `[Prosody analysis] WPM: ${m.words_per_minute}, Pause ratio: ${(m.pause_ratio * 100).toFixed(0)}%, Long pauses (>1.5s): ${m.long_pauses}, Fillers: ${m.filler_count}, Repetitions: ${m.repetition_count}, Self-corrections: ${m.self_correction_count}, Fluency score: ${m.fluency_score}/100, Rhythm score: ${m.rhythm_score}/100`;
}
