// Speaking Drill Engine — listen-and-repeat with prosody scoring
// Picks drills from speaking_drills, scores user attempts based on
// phrase accuracy + prosody metrics

import type { Env } from '../types';

export interface SpeakingDrill {
  id: number;
  phrase: string;
  ipa: string | null;
  category: string;
  difficulty: string;
  test_type: string;
  target_rhythm: string | null;
  common_mistake: string | null;
  tip: string | null;
  cefr_level: string;
}

export interface DrillAttemptInput {
  env: Env;
  userId: number;
  drillId: number;
  transcription: string;
  prosody: {
    wpm: number;
    pause_ratio: number;
    fluency_score: number;
    rhythm_score: number;
  };
  audioSeconds: number;
}

export interface DrillScore {
  accuracy: number;       // 0-100, how close the phrase matches
  prosody_overall: number; // 0-100
  combined: number;       // weighted blend
  word_diff: string[];    // words that didn't match
  matched_count: number;
  expected_count: number;
}

/**
 * Compute Levenshtein-based similarity between two strings.
 * Returns 0..1 where 1 = identical.
 */
export function phraseSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const A = a.toLowerCase().replace(/[^a-z0-9'\s]/g, '').trim();
  const B = b.toLowerCase().replace(/[^a-z0-9'\s]/g, '').trim();
  if (!A.length || !B.length) return 0;
  if (A === B) return 1;

  const m = A.length;
  const n = B.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  const maxLen = Math.max(m, n);
  return 1 - dp[m][n] / maxLen;
}

/**
 * Extract words that match / mismatch between expected and actual.
 */
export function diffWords(expected: string, actual: string): { matched: number; total: number; missing: string[] } {
  const expWords = expected.toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/).filter(Boolean);
  const actWords = actual.toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/).filter(Boolean);

  const actSet = new Set(actWords);
  const missing: string[] = [];
  let matched = 0;
  for (const w of expWords) {
    if (actSet.has(w)) matched++;
    else missing.push(w);
  }
  return { matched, total: expWords.length, missing };
}

/**
 * Score a drill attempt: blend phrase accuracy + prosody overall.
 * Accuracy weight 60%, prosody weight 40%.
 */
export function scoreDrillAttempt(expected: string, transcription: string, prosody: DrillAttemptInput['prosody']): DrillScore {
  const sim = phraseSimilarity(expected, transcription);
  const word = diffWords(expected, transcription);
  const accuracy = Math.round(sim * 100);
  const prosodyOverall = Math.round(
    (prosody.fluency_score * 0.5) + (prosody.rhythm_score * 0.3) + (Math.min(prosody.wpm, 180) / 180 * 100 * 0.2)
  );
  const combined = Math.round(accuracy * 0.6 + prosodyOverall * 0.4);
  return {
    accuracy,
    prosody_overall: prosodyOverall,
    combined,
    word_diff: word.missing,
    matched_count: word.matched,
    expected_count: word.total,
  };
}

/**
 * Pick a random drill, optionally filtered by category / difficulty / test_type / CEFR.
 * Respects user's proficiency level: shows drills up to user level + 1 stretch.
 */
export async function pickDrill(
  env: Env,
  opts: { category?: string; difficulty?: string; test_type?: string; userLevel?: string } = {}
): Promise<SpeakingDrill | null> {
  const conditions: string[] = [];
  const binds: any[] = [];
  if (opts.category) { conditions.push('category = ?'); binds.push(opts.category); }
  if (opts.difficulty) { conditions.push('difficulty = ?'); binds.push(opts.difficulty); }
  if (opts.test_type) { conditions.push('test_type IN (?, "ALL")'); binds.push(opts.test_type); }
  if (opts.userLevel) {
    // CEFR ordering
    const order: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
    const userIdx = order[opts.userLevel] ?? 2;
    // Allow same level, +1, or -1 (slightly below for review)
    const allowedLevels = Object.keys(order).filter(k => {
      const idx = order[k];
      return idx >= userIdx - 1 && idx <= userIdx + 1;
    });
    const placeholders = allowedLevels.map(() => '?').join(',');
    conditions.push(`cefr_level IN (${placeholders})`);
    binds.push(...allowedLevels);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = `SELECT * FROM speaking_drills ${where} ORDER BY RANDOM() LIMIT 1`;
  const row = await env.DB.prepare(stmt).bind(...binds).first<SpeakingDrill>();
  return row || null;
}

/**
 * Get all distinct categories available.
 */
export async function listDrillCategories(env: Env): Promise<{ category: string; count: number }[]> {
  const result = await env.DB.prepare(
    `SELECT category, COUNT(*) as count FROM speaking_drills GROUP BY category ORDER BY count DESC`
  ).all<{ category: string; count: number }>();
  return result.results || [];
}

/**
 * Save a drill attempt and return the stored row id.
 */
export async function saveDrillAttempt(input: DrillAttemptInput & { score: DrillScore; feedback: string }): Promise<number> {
  const r = await input.env.DB.prepare(
    `INSERT INTO speaking_drill_attempts
      (user_id, drill_id, transcription, prosody_wpm, prosody_pause_ratio,
       prosody_fluency_score, prosody_rhythm_score, prosody_overall,
       accuracy_score, combined_score, feedback, audio_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`
  ).bind(
    input.userId,
    input.drillId,
    input.transcription,
    input.prosody.wpm,
    input.prosody.pause_ratio,
    input.prosody.fluency_score,
    input.prosody.rhythm_score,
    input.score.prosody_overall,
    input.score.accuracy,
    input.score.combined,
    input.feedback,
    input.audioSeconds,
  ).first<{ id: number }>();
  return r?.id ?? 0;
}

/**
 * Build concise feedback message for a drill attempt.
 */
export function formatDrillFeedback(drill: SpeakingDrill, score: DrillScore, transcription: string): string {
  const lines: string[] = [];
  lines.push(`🎯 *Drill Result*\n`);
  lines.push(`📝 Target: *${drill.phrase}*`);
  if (drill.ipa) lines.push(`🔤 IPA: \`${drill.ipa}\``);
  lines.push(`\n🎙️ Kamu bilang: _"${transcription || '(tidak terdengar)'}"_\n`);

  // Score breakdown
  const scoreEmoji = score.combined >= 80 ? '🌟' : score.combined >= 60 ? '👍' : score.combined >= 40 ? '🤔' : '📚';
  lines.push(`${scoreEmoji} *Skor Gabungan: ${score.combined}/100*`);
  lines.push(`   • Akurasi frasa: ${score.accuracy}/100 (${score.matched_count}/${score.expected_count} kata cocok)`);
  lines.push(`   • Prosodi: ${score.prosody_overall}/100`);

  if (score.word_diff.length > 0 && score.accuracy < 100) {
    lines.push(`\n❌ Kata yang terlewat/jauh: ${score.word_diff.slice(0, 5).map(w => `\`${w}\``).join(', ')}`);
  }

  if (drill.common_mistake && score.accuracy < 90) {
    lines.push(`\n⚠️ Kesalahan umum: ${drill.common_mistake}`);
  }
  if (drill.tip) {
    lines.push(`💡 Tips: ${drill.tip}`);
  }

  return lines.join('\n');
}

/**
 * Get user's drill stats: total attempts, best score, attempts today.
 */
export async function getDrillStats(env: Env, userId: number): Promise<{
  total: number;
  bestScore: number;
  attemptsToday: number;
  averageScore: number;
}> {
  const row = await env.DB.prepare(
    `SELECT
       COUNT(*) as total,
       COALESCE(MAX(combined_score), 0) as bestScore,
       COALESCE(AVG(combined_score), 0) as averageScore,
       SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) as attemptsToday
     FROM speaking_drill_attempts WHERE user_id = ?`
  ).bind(userId).first<{ total: number; bestScore: number; averageScore: number; attemptsToday: number }>();

  return {
    total: row?.total ?? 0,
    bestScore: row?.bestScore ?? 0,
    averageScore: Math.round(row?.averageScore ?? 0),
    attemptsToday: row?.attemptsToday ?? 0,
  };
}

/**
 * Build a keyboard for the drill command menu.
 */
export function drillMenuKeyboard(hasActiveSession: boolean = false): { inline_keyboard: { text: string; callback_data: string }[][] } {
  const rows: { text: string; callback_data: string }[][] = [
    [
      { text: '🎲 Random Drill', callback_data: 'drill_random' },
      { text: '🦷 TH Sounds', callback_data: 'drill_cat_th_sounds' },
    ],
    [
      { text: '🔤 Vowel Pairs', callback_data: 'drill_cat_vowel_pairs' },
      { text: '🎯 Word Stress', callback_data: 'drill_cat_word_stress' },
    ],
    [
      { text: '🗣️ Sentence Stress', callback_data: 'drill_cat_sentence_stress' },
      { text: '🔗 Connected Speech', callback_data: 'drill_cat_connected_speech' },
    ],
    [
      { text: '🆚 Minimal Pairs', callback_data: 'drill_cat_minimal_pairs' },
      { text: '🔄 R & L', callback_data: 'drill_cat_r_and_l' },
    ],
    [
      { text: '📚 Academic', callback_data: 'drill_cat_academic_vocab' },
      { text: '🔢 Numbers', callback_data: 'drill_cat_numbers_dates' },
    ],
    [
      { text: '🔊 Schwa', callback_data: 'drill_cat_schwa_sound' },
      { text: '📝 Academic Phrases', callback_data: 'drill_cat_academic_phrases' },
    ],
  ];
  if (hasActiveSession) {
    rows.push([{ text: '❌ Cancel Active Drill', callback_data: 'drill_cancel' }]);
  }
  return { inline_keyboard: rows };
}
