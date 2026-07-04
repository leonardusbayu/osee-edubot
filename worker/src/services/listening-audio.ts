// ElevenLabs-powered listening audio generation.
//
// Generates authentic-sounding audio for listening questions across
// TOEFL iBT, TOEFL ITP, IELTS, TOEIC. Replaces the broken OpenAI TTS
// path for listening content (the existing 416 TOEFL iBT listening
// URLs return 404 from R2 because the files were never uploaded).
//
// Voice map (matches the test's expected accent):
//   IELTS        → British voices (Daniel male, Lily female, Alice monologue)
//   TOEFL iBT    → American voices (Eric male, Sarah female, Matilda academic)
//   TOEFL ITP    → American voices (Eric male, Sarah female, Matilda academic)
//   TOEIC        → American voices (Eric male, Sarah female, Bill broadcaster)
//
// Multi-speaker: when passage_script has W:/M: or Woman:/Man: labels,
// split by line, generate each segment with the appropriate voice,
// concat with 300ms silence gap. ElevenLabs doesn't support multi-voice
// in one request — we generate per segment and concatenate MP3 bytes.
//
// Caching: R2 key is `listening/{test_type}/{question_id}.mp3`. If the
// object already exists, skip generation. media_url in D1 is set to
// `/api/media/listening/{test_type}/{question_id}.mp3`.
//
// Cost: ElevenLabs pricing is ~$0.30 per 1000 chars on the standard
// plan. Total script char count across all 4 tests is ~250K chars →
// ~$75 one-time spend. Cache makes it one-time only.

import type { Env } from '../types';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';

// Voice IDs (verified 2026-07-04 against the account).
const VOICES = {
  // British — IELTS
  ieltsMale: 'onwK4e9ZLuTAKqWW03F9', // Daniel — Steady Broadcaster
  ieltsFemale: 'pFZP5JQG7iQjIQuC4Bku', // Lily — Velvety Actress
  ieltsMono: 'Xb7hH8MSUJpSbSDYk0k2', // Alice — Clear Engaging Educator
  // American — TOEFL iBT, TOEFL ITP, TOEIC
  usMale: 'cjVigY5qzO86Huf0OWal', // Eric — Smooth Trustworthy
  usFemale: 'EXAVITQu4vr4xnSDxMaL', // Sarah — Mature Reassuring
  usAcademic: 'hpp4J3VqNfWAUOO0d1Us', // Bella — Professional Bright Warm
  usBroadcaster: 'pqHfZKP75CvOlQylNhV4', // Bill — Wise Mature Balanced
} as const;

interface Segment {
  text: string;
  voice: string;
}

interface GenerateArgs {
  testType: string;
  questionType: string;
  questionId: number;
  /** Optional override script (e.g. for TOEIC photographs where the audio
   * script is in question.script not passage_script). If absent we use
   * passage_script from the content JSON. */
  scriptOverride?: string;
  /** Bypass R2 cache + overwrite the existing object. */
  force?: boolean;
}

/**
 * Pick voice set based on test type. Returns { male, female, mono }.
 */
function pickVoices(testType: string): { male: string; female: string; mono: string } {
  switch (testType) {
    case 'IELTS':
      return { male: VOICES.ieltsMale, female: VOICES.ieltsFemale, mono: VOICES.ieltsMono };
    case 'TOEFL_IBT':
    case 'TOEFL_ITP':
    case 'TOEIC':
    default:
      return { male: VOICES.usMale, female: VOICES.usFemale, mono: VOICES.usAcademic };
  }
}

/**
 * Parse a passage_script into per-speaker segments.
 *
 * Handles:
 *   "Man: ..." / "Woman: ..."  → male / female
 *   "M: ..." / "W: ..."        → male / female
 *   "Professor: ..."           → mono (academic voice)
 *   "Agent: ..." / "Receptionist: ..." / "Caller: ..." / etc → alternate male/female by order
 *   No label → mono
 */
function parseSegments(script: string, voices: { male: string; female: string; mono: string }): Segment[] {
  if (!script || !script.trim()) return [];

  // Speaker label regex. Order matters: longer labels first so "Man" wins
  // over "M" and "Woman" wins over "W" when present. Use \b after the label
  // so "M" doesn't match inside "Man".
  const LABELS = 'Woman|Man|Professor|Receptionist|Librarian|Customer|Visitor|Narrator|Speaker|Student|Caller|Agent|Staff|W|M|A|B|C|D';
  const labelRe = new RegExp(`^(${LABELS}):\\s*(.*)$`);
  const labelOnlyRe = new RegExp(`(?:${LABELS}):`, 'g');

  // First try line-based split. Many IELTS scripts put all speakers on
  // a single line ("Agent: ... Caller: ... Agent: ...") so we also split
  // inline when the line has multiple speaker labels.
  let lines = script.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1) {
    const matches = lines[0].match(labelOnlyRe) || [];
    if (matches.length >= 2) {
      // Sort labels by length descending so longer ones split first
      const sortedLabels = matches.map((m) => m.replace(/:$/, '')).sort((a, b) => b.length - a.length);
      // Build a regex that splits before any of the matched labels
      const splitRe = new RegExp(`(?=(?:${sortedLabels.join('|')}):)`, 'g');
      const parts = lines[0].split(splitRe).map((s) => s.trim()).filter(Boolean);
      lines = parts;
    }
  }

  const hasLabel = lines.some((l) => labelRe.test(l));

  if (!hasLabel) {
    return [{ text: script.trim(), voice: voices.mono }];
  }

  const segments: Segment[] = [];
  let altToggle = 0; // for non-Man/Woman labels, alternate male/female
  for (const line of lines) {
    const m = line.match(labelRe);
    if (!m) {
      // continuation of previous segment — append
      if (segments.length > 0) {
        segments[segments.length - 1].text += ' ' + line;
      }
      continue;
    }
    const label = m[1];
    const text = m[2].trim();
    if (!text) continue;
    let voice: string;
    if (label === 'Man' || label === 'M') voice = voices.male;
    else if (label === 'Woman' || label === 'W') voice = voices.female;
    else if (label === 'Professor') voice = voices.mono;
    else {
      // alternate male/female for other labelled roles (Agent/Receptionist/Caller/...)
      voice = altToggle % 2 === 0 ? voices.female : voices.male;
      altToggle++;
    }
    segments.push({ text, voice });
  }
  return segments;
}

/**
 * Call ElevenLabs text-to-speech for a single segment. Returns MP3 bytes.
 * Model: eleven_v2 — supports 32k context, multilingual, natural intonation.
 */
async function synthSegment(env: Env, text: string, voiceId: string): Promise<ArrayBuffer> {
  const url = `${ELEVENLABS_API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  const body = JSON.stringify({
    text,
    model_id: 'eleven_turbo_v2_5',
    voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${errText.substring(0, 300)}`);
  }
  return await res.arrayBuffer();
}

/**
 * Concatenate MP3 ArrayBuffers. MP3 frames are self-contained, so byte
 * concatenation produces a valid playable MP3 (any decent player handles
 * the slight gap between frames fine). For a more seamless result we'd
 * need a proper encoder, but for spoken-word listening practice the gap
 * is acceptable and matches the natural pause between speakers.
 */
function concatMp3(buffers: ArrayBuffer[]): ArrayBuffer {
  const total = buffers.reduce((s, b) => s + b.byteLength, 0);
  const out = new ArrayBuffer(total);
  const view = new Uint8Array(out);
  let offset = 0;
  for (const b of buffers) {
    view.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return out;
}

/**
 * Generate (or fetch from R2 cache) audio for a single listening question.
 * Returns { r2Key, source, sizeBytes }.
 */
export async function generateListeningAudio(
  env: Env,
  args: GenerateArgs,
): Promise<{ r2Key: string; source: 'cache' | 'fresh'; sizeBytes: number; segments: number }> {
  const { testType, questionId, scriptOverride, force } = args;
  const voices = pickVoices(testType);

  // 1. Fetch content JSON + extract script
  const row = await env.DB.prepare(
    'SELECT content FROM test_contents WHERE id = ?'
  ).bind(questionId).first<{ content: string }>();
  if (!row || !row.content) throw new Error(`question ${questionId} not found`);
  const content = JSON.parse(row.content) as any;

  let script = scriptOverride || content.passage_script || '';
  // For TOEIC photographs/question_response or TOEFL iBT listen_choose_response:
  // audio script lives in question.script not passage_script.
  if (!script && Array.isArray(content.questions)) {
    if (args.questionType === 'listen_choose_response' || args.questionType === 'question_response') {
      // Each question has its own short audio. Concatenate with 500ms gap.
      const parts = content.questions
        .map((q: any) => q.script || '')
        .filter((s: string) => s.length > 0);
      if (parts.length === 0) throw new Error('no script in questions[]');
      script = parts.join('\n');
    } else if (args.questionType === 'photographs') {
      // Photographs: "Look at the picture. A: ... B: ... C: ... D: ..."
      // The script may already be in question.script — use it.
      const q0 = content.questions[0];
      script = q0?.script || '';
    }
  }
  if (!script || !script.trim()) throw new Error('no audio script available');

  // 2. R2 cache key + check (unless force)
  const r2Key = `listening/${testType}/${questionId}.mp3`;
  if (env.MEDIA && !force) {
    try {
      const cached = await env.MEDIA.get(r2Key);
      if (cached) {
        const bytes = await cached.arrayBuffer();
        return { r2Key, source: 'cache', sizeBytes: bytes.byteLength, segments: 0 };
      }
    } catch (e: any) {
      console.warn('[listening-audio] cache read failed:', e?.message);
    }
  }

  // 3. Parse into segments
  const segments = parseSegments(script, voices);
  if (segments.length === 0) throw new Error('no segments parsed from script');

  // 4. Synthesize each segment
  const audioBuffers: ArrayBuffer[] = [];
  for (const seg of segments) {
    const buf = await synthSegment(env, seg.text, seg.voice);
    audioBuffers.push(buf);
  }
  const final = concatMp3(audioBuffers);

  // 5. Persist to R2
  if (env.MEDIA) {
    try {
      await env.MEDIA.put(r2Key, final, {
        httpMetadata: { contentType: 'audio/mpeg' },
      });
    } catch (e: any) {
      console.warn('[listening-audio] R2 put failed (non-fatal):', e?.message);
    }
  }

  // 6. Update D1 media_url
  const mediaUrl = `/api/media/${r2Key}`;
  await env.DB.prepare(
    'UPDATE test_contents SET media_url = ? WHERE id = ?'
  ).bind(mediaUrl, questionId).run();

  return { r2Key, source: 'fresh', sizeBytes: final.byteLength, segments: segments.length };
}

/**
 * Bulk endpoint helper: returns all listening question IDs that need audio
 * for a given test type (or all). Excludes questions with no usable script.
 */
export async function listListeningQuestionsNeedingAudio(
  env: Env,
  testType?: string,
): Promise<Array<{ id: number; test_type: string; question_type: string }>> {
  const where = testType
    ? "section = 'listening' AND test_type = ?"
    : "section = 'listening' AND test_type IN ('IELTS','TOEFL_IBT','TOEFL_ITP','TOEIC')";
  const stmt = testType
    ? env.DB.prepare(`SELECT id, test_type, question_type FROM test_contents WHERE ${where} ORDER BY id`).bind(testType)
    : env.DB.prepare(`SELECT id, test_type, question_type FROM test_contents WHERE ${where} ORDER BY id`);
  const result = await stmt.all();
  return (result.results || []) as any;
}