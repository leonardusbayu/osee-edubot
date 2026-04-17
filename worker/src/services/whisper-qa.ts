// Whisper transcription QA.
//
// Speaking evaluation = Whisper → GPT. If Whisper hallucinates or garbles
// the audio, the GPT score grades fiction. This scanner walks recent
// speaking_sessions and flags transcripts that look broken:
//
//   empty                  — no transcription at all
//   too_short              — <10 words (almost always means Whisper got nothing)
//   high_repetition        — one token dominates (>40% of output) — classic
//                            Whisper loop / hallucination mode
//   no_punctuation         — no sentence terminators in 30+ words (not by
//                            itself fatal, but combined with other flags
//                            it signals garbled audio)
//   gibberish              — unique/total word ratio < 0.2 (runaway loops)
//   hallucination_marker   — contains Whisper-known hallucination phrases
//                            like "[BLANK_AUDIO]", "...", "Thanks for
//                            watching!", "Subtitles by the Amara.org
//                            community" (yes, really — Whisper picks these
//                            up from YouTube training data)
//
// We don't try to "fix" the transcript here; we just flag the session so a
// human can relisten, and so the scoring reliability audit knows to drop it.

import type { Env } from '../types';

export interface WhisperQaResult {
  scanned: number;
  flagged: number;
  breakdown: Record<string, number>;
  duration_ms: number;
}

export type FlagCode =
  | 'empty'
  | 'too_short'
  | 'high_repetition'
  | 'no_punctuation'
  | 'gibberish'
  | 'hallucination_marker';

const MIN_WORDS = 10;
const REPETITION_THRESHOLD = 0.4;
const UNIQUE_RATIO_THRESHOLD = 0.2;
const NO_PUNCTUATION_MIN_WORDS = 30;

// Phrases Whisper famously hallucinates from silence / background noise /
// YouTube-style training data. Case-insensitive contains match.
const HALLUCINATION_PHRASES: readonly string[] = [
  '[blank_audio]',
  '[silence]',
  '[music]',
  'subtitles by the amara.org community',
  'thanks for watching',
  'thank you for watching',
  'please subscribe',
  'like and subscribe',
  'www.mooji.org',
  'beadaquiz.com',
];

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+/g) || []);
}

function countSentenceTerminators(text: string): number {
  return (text.match(/[.!?]/g) || []).length;
}

function mostCommonTokenShare(tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
  let max = 0;
  for (const v of counts.values()) if (v > max) max = v;
  return max / tokens.length;
}

function uniqueRatio(tokens: string[]): number {
  if (tokens.length === 0) return 0;
  return new Set(tokens).size / tokens.length;
}

function hasHallucinationMarker(text: string): boolean {
  const lower = text.toLowerCase();
  for (const phrase of HALLUCINATION_PHRASES) {
    if (lower.includes(phrase)) return true;
  }
  return false;
}

export interface FlagPayload {
  flag_code: FlagCode;
  severity: 'low' | 'medium' | 'high';
  word_count: number;
  unique_word_ratio: number;
  repetition_ratio: number;
  detail: string;
}

/**
 * Inspect a transcript and return the highest-severity flag, or null if
 * the transcript looks healthy. We return only one flag per session to
 * avoid noise — the most severe problem is what a reviewer should see
 * first.
 */
export function inspectTranscript(raw: string | null | undefined): FlagPayload | null {
  const text = (raw || '').trim();
  const tokens = tokenize(text);
  const wordCount = tokens.length;
  const repetition = mostCommonTokenShare(tokens);
  const unique = uniqueRatio(tokens);

  if (text.length === 0) {
    return {
      flag_code: 'empty',
      severity: 'high',
      word_count: 0,
      unique_word_ratio: 0,
      repetition_ratio: 0,
      detail: 'transcription is empty',
    };
  }

  if (hasHallucinationMarker(text)) {
    return {
      flag_code: 'hallucination_marker',
      severity: 'high',
      word_count: wordCount,
      unique_word_ratio: unique,
      repetition_ratio: repetition,
      detail: 'known Whisper hallucination phrase detected',
    };
  }

  if (wordCount > 5 && unique < UNIQUE_RATIO_THRESHOLD) {
    return {
      flag_code: 'gibberish',
      severity: 'high',
      word_count: wordCount,
      unique_word_ratio: unique,
      repetition_ratio: repetition,
      detail: `unique/total ratio=${unique.toFixed(2)}`,
    };
  }

  if (wordCount >= 5 && repetition >= REPETITION_THRESHOLD) {
    return {
      flag_code: 'high_repetition',
      severity: 'high',
      word_count: wordCount,
      unique_word_ratio: unique,
      repetition_ratio: repetition,
      detail: `one token = ${(repetition * 100).toFixed(0)}% of transcript`,
    };
  }

  if (wordCount < MIN_WORDS) {
    return {
      flag_code: 'too_short',
      severity: 'medium',
      word_count: wordCount,
      unique_word_ratio: unique,
      repetition_ratio: repetition,
      detail: `${wordCount} words (min ${MIN_WORDS})`,
    };
  }

  if (wordCount >= NO_PUNCTUATION_MIN_WORDS && countSentenceTerminators(text) === 0) {
    return {
      flag_code: 'no_punctuation',
      severity: 'low',
      word_count: wordCount,
      unique_word_ratio: unique,
      repetition_ratio: repetition,
      detail: 'no sentence terminators in long transcript',
    };
  }

  return null;
}

/**
 * Scan finished speaking_sessions from the last 30 days, flag problems,
 * and auto-resolve old flags on sessions that no longer trip any rule
 * (e.g. transcript was edited / reprocessed).
 */
export async function runWhisperQa(env: Env, opts: { lookbackDays?: number; notes?: string } = {}): Promise<WhisperQaResult> {
  const startedAt = Date.now();
  const lookbackDays = opts.lookbackDays ?? 30;

  // Open a run row first so we can close it at the end.
  const runInsert = await env.DB.prepare(
    `INSERT INTO whisper_qa_runs (notes) VALUES (?)`,
  ).bind(opts.notes || null).run();
  const runId = (runInsert as any).meta?.last_row_id as number | undefined;

  const { results: sessions } = await env.DB.prepare(
    `SELECT id, transcription
       FROM speaking_sessions
      WHERE created_at > datetime('now', ?)
        AND status = 'completed'`,
  ).bind(`-${lookbackDays} days`).all<any>();

  const breakdown: Record<string, number> = {};
  const activeSessionIds = new Set<number>();
  let flagged = 0;
  let scanned = 0;

  for (const row of sessions || []) {
    scanned++;
    const sessionId = Number((row as any).id);
    const flag = inspectTranscript((row as any).transcription as string | null);
    if (!flag) continue;

    activeSessionIds.add(sessionId);
    breakdown[flag.flag_code] = (breakdown[flag.flag_code] || 0) + 1;
    flagged++;

    // Upsert: if an open flag already exists for this session + code, update
    // it; otherwise insert a fresh one. We intentionally do not reopen
    // resolved flags — reviewers should see resolution history.
    const existing = await env.DB.prepare(
      `SELECT id FROM whisper_qa_flags
        WHERE speaking_session_id = ? AND flag_code = ? AND status = 'open'
        LIMIT 1`,
    ).bind(sessionId, flag.flag_code).first<{ id: number }>();

    if (existing?.id) {
      await env.DB.prepare(
        `UPDATE whisper_qa_flags
            SET severity = ?, word_count = ?, unique_word_ratio = ?,
                repetition_ratio = ?, detail = ?, detected_at = datetime('now')
          WHERE id = ?`,
      ).bind(flag.severity, flag.word_count, flag.unique_word_ratio,
              flag.repetition_ratio, flag.detail, existing.id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO whisper_qa_flags
           (speaking_session_id, flag_code, severity, word_count,
            unique_word_ratio, repetition_ratio, detail)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(sessionId, flag.flag_code, flag.severity, flag.word_count,
              flag.unique_word_ratio, flag.repetition_ratio, flag.detail).run();
    }
  }

  // Auto-resolve: any open flag on a session we scanned but didn't re-flag
  // is stale. We only auto-resolve within the scan window so older flags
  // outside the window remain untouched.
  const { results: openRows } = await env.DB.prepare(
    `SELECT f.id, f.speaking_session_id
       FROM whisper_qa_flags f
       JOIN speaking_sessions s ON s.id = f.speaking_session_id
      WHERE f.status = 'open'
        AND s.created_at > datetime('now', ?)
        AND s.status = 'completed'`,
  ).bind(`-${lookbackDays} days`).all<any>();

  for (const row of openRows || []) {
    const sid = Number((row as any).speaking_session_id);
    if (!activeSessionIds.has(sid)) {
      await env.DB.prepare(
        `UPDATE whisper_qa_flags SET status = 'resolved' WHERE id = ?`,
      ).bind(Number((row as any).id)).run();
    }
  }

  const duration = Date.now() - startedAt;

  if (runId) {
    await env.DB.prepare(
      `UPDATE whisper_qa_runs
          SET finished_at = datetime('now'),
              scanned_count = ?,
              flagged_count = ?,
              breakdown = ?
        WHERE id = ?`,
    ).bind(scanned, flagged, JSON.stringify(breakdown), runId).run();
  }

  return { scanned, flagged, breakdown, duration_ms: duration };
}
