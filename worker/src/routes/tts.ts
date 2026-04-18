import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';

export const ttsRoutes = new Hono<{ Bindings: Env }>();

// Require any authenticated user (free tier included) — prevents anonymous OpenAI credit burn
async function requireAuthedTTS(c: any): Promise<boolean> {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return false;
  return true;
}

// Simple hash for cache key
async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// Check D1 cache for TTS audio
async function getCachedAudio(db: D1Database, textHash: string): Promise<ArrayBuffer | null> {
  try {
    const row = await db.prepare('SELECT audio_data FROM tts_cache WHERE text_hash = ?').bind(textHash).first() as any;
    if (row?.audio_data) return row.audio_data;
  } catch {}
  return null;
}

// Save TTS audio to D1 cache (max 1MB per entry to stay within D1 limits)
async function cacheAudio(db: D1Database, textHash: string, audio: ArrayBuffer, voice: string) {
  if (audio.byteLength > 1024 * 1024) return; // Skip if > 1MB
  try {
    await db.prepare('INSERT OR REPLACE INTO tts_cache (text_hash, audio_data, voice) VALUES (?, ?, ?)')
      .bind(textHash, audio, voice).run();
  } catch {}
}

// Voice mapping for different speakers
// OpenAI voices: alloy, echo, fable, onyx, nova, shimmer
const SPEAKER_VOICES: Record<string, string> = {
  'woman': 'nova',
  'female': 'nova',
  'girl': 'shimmer',
  'student_f': 'nova',
  'man': 'onyx',
  'male': 'onyx',
  'boy': 'echo',
  'student_m': 'echo',
  'professor': 'fable',
  'narrator': 'alloy',
  'announcer': 'alloy',
  'instructor': 'fable',
  'advisor': 'fable',
  'librarian': 'shimmer',
  'receptionist': 'shimmer',
  'default': 'alloy',
};

function detectSpeakerVoice(label: string): string {
  const lower = label.toLowerCase().trim().replace(/:$/, '');
  // Direct match
  if (SPEAKER_VOICES[lower]) return SPEAKER_VOICES[lower];
  // Partial match
  if (lower.includes('woman') || lower.includes('female')) return 'nova';
  if (lower.includes('man') || lower.includes('male')) return 'onyx';
  if (lower.includes('professor') || lower.includes('instructor') || lower.includes('teacher')) return 'fable';
  if (lower.includes('girl') || lower.includes('receptionist') || lower.includes('librarian')) return 'shimmer';
  if (lower.includes('boy') || lower.includes('student')) return 'echo';
  if (lower.includes('narrator') || lower.includes('announcer')) return 'alloy';
  return 'alloy';
}

// Parse transcript into speaker segments
// Input: "Woman: Hi there. Man: Hello. Woman: How are you?"
// Output: [{voice: "nova", text: "Hi there."}, {voice: "onyx", text: "Hello."}, ...]
function parseDialogue(text: string): { voice: string; text: string }[] {
  // Split by speaker labels like "Woman:", "Man:", "Professor:", "Narrator:", etc.
  // Labels can appear after: start of string, newline, or sentence-ending punctuation (. ? !)
  // Character class includes apostrophes/hyphens/periods so names like
  // "O'Brien", "St. John", and "Jean-Paul" aren't truncated at punctuation.
  const speakerPattern = /(?:^|\n|[.?!]\s*)((?:Woman|Man|Male|Female|Professor|Instructor|Narrator|Announcer|Student|Advisor|Librarian|Receptionist|Girl|Boy|Speaker\s*\d?)[\w\s'\-.]*?):\s*/gi;

  const segments: { voice: string; text: string }[] = [];
  let lastIndex = 0;
  let lastVoice = 'alloy';
  const matches = [...text.matchAll(speakerPattern)];

  if (matches.length === 0) {
    // No speaker labels — single narrator
    return [{ voice: 'alloy', text: text.trim() }];
  }

  // Text before first speaker label (if any)
  if (matches[0].index! > 0) {
    const before = text.substring(0, matches[0].index!).trim();
    if (before.length > 0) {
      segments.push({ voice: 'alloy', text: before });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const speakerLabel = match[1];
    const voice = detectSpeakerVoice(speakerLabel);
    const startPos = match.index! + match[0].length;
    const endPos = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const spokenText = text.substring(startPos, endPos).trim();

    if (spokenText.length > 0) {
      segments.push({ voice, text: spokenText });
    }
  }

  return segments.length > 0 ? segments : [{ voice: 'alloy', text: text.trim() }];
}

// Fetch TTS audio for a single segment
// format: 'mp3' for browser/HTTP, 'opus' for Telegram sendVoice (OGG Opus)
async function fetchTTSAudio(apiKey: string, text: string, voice: string, format: string = 'mp3'): Promise<ArrayBuffer> {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text.substring(0, 4096),
      voice,
      response_format: format,
    }),
  });

  if (!response.ok) throw new Error(`TTS failed: ${response.status}`);
  return response.arrayBuffer();
}

// Retry wrapper for TTS — retries up to 2 times with short backoff
async function fetchTTSAudioWithRetry(
  apiKey: string, text: string, voice: string, format: string, maxRetries = 2
): Promise<ArrayBuffer | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const buffer = await fetchTTSAudio(apiKey, text, voice, format);
      if (buffer && buffer.byteLength > 100) return buffer;
    } catch (e: any) {
      console.error(`TTS attempt ${attempt + 1}/${maxRetries + 1} failed:`, e.message);
      // Don't retry on 401 (auth) or 400 (bad request)
      if (e.message?.includes('401') || e.message?.includes('400')) return null;
      if (attempt < maxRetries) {
        // Brief backoff: 500ms, then 1000ms
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  return null;
}

// Exported core function to generate TTS audio without an HTTP loopback
// format: 'mp3' for browser playback, 'opus' for Telegram bot voice messages
export async function generateTTSAudioBuffer(env: Env, text: string, multi: boolean = false, voice: string = 'alloy', format: string = 'mp3'): Promise<ArrayBuffer | null> {
  if (!env.OPENAI_API_KEY) return null;

  const decoded = decodeURIComponent(text).trim();
  if (decoded.length === 0) return null;
  // Delimiter (\x1f = ASCII unit separator, never legal in TTS input) prevents
  // collisions like "Hellotrue|alloy|mp3" vs "Hello|true|alloy|mp3". Include
  // format in cache key so mp3 and opus are cached separately.
  const cacheKey = await hashText([decoded, multi ? '1' : '0', voice, format].join('\x1f'));

  // Check cache
  const cached = await getCachedAudio(env.DB, cacheKey);
  if (cached) return cached;

  try {
    if (multi) {
      const segments = parseDialogue(decoded);
      if (segments.length > 1) {
        // Per-segment TTS with speaker-mapped voices, then concatenate.
        // OpenAI `tts-1` returns CBR MP3 without ID3 headers — frame-level
        // concatenation works in every major player we've tested (Telegram,
        // iOS Safari, Chrome). Opus is NOT concatenatable cleanly so we
        // force format='mp3' here; the caller can re-encode if needed.
        // If any segment fails, we fall back to single-voice on the full
        // text rather than ship half a dialogue.
        const buffers: ArrayBuffer[] = [];
        let voicesUsed: Set<string> = new Set();
        for (const seg of segments) {
          if (!seg.text) continue;
          const buf = await fetchTTSAudioWithRetry(env.OPENAI_API_KEY, seg.text, seg.voice, 'mp3');
          if (!buf) {
            // abandon multi — fall through to single-voice
            buffers.length = 0;
            break;
          }
          buffers.push(buf);
          voicesUsed.add(seg.voice);
        }

        if (buffers.length > 0) {
          const total = buffers.reduce((n, b) => n + b.byteLength, 0);
          const merged = new Uint8Array(total);
          let offset = 0;
          for (const b of buffers) {
            merged.set(new Uint8Array(b), offset);
            offset += b.byteLength;
          }
          await cacheAudio(env.DB, cacheKey, merged.buffer, `multi:${[...voicesUsed].join('+')}`);
          try {
            const charCount = decoded.length;
            const cost = (charCount / 1000) * 0.015;
            await env.DB.prepare(
              'INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd) VALUES (?, ?, ?, ?)'
            ).bind('openai-tts', 'multi-segmented', charCount, cost).run();
          } catch {}
          return merged.buffer;
        }

        // Fallback: single-voice on the full text.
        const fullText = segments.map(s => s.text).join(' ... ');
        const singleBuffer = await fetchTTSAudioWithRetry(env.OPENAI_API_KEY, fullText, voice, format);
        if (singleBuffer) {
          await cacheAudio(env.DB, cacheKey, singleBuffer, 'multi-fallback');
          try {
            const charCount = fullText.length;
            const cost = (charCount / 1000) * 0.015;
            await env.DB.prepare(
              'INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd) VALUES (?, ?, ?, ?)'
            ).bind('openai-tts', 'multi-fallback', charCount, cost).run();
          } catch {}
        }
        return singleBuffer;
      }
    }

    // Single voice with retry
    const audioData = await fetchTTSAudioWithRetry(env.OPENAI_API_KEY, decoded.substring(0, 4096), voice, format);
    if (!audioData) return null;

    await cacheAudio(env.DB, cacheKey, audioData, voice);

    // Try logging cost silently
    try {
      const charCount = decoded.length;
      const cost = (charCount / 1000) * 0.015;
      await env.DB.prepare(
        'INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd) VALUES (?, ?, ?, ?)'
      ).bind('openai-tts', voice, charCount, cost).run();
    } catch {}

    return audioData;
  } catch (e) {
    console.error('TTS internal error:', e);
    return null;
  }
}

// Multi-speaker TTS — generates audio for each speaker segment and concatenates
ttsRoutes.post('/dialogue', async (c) => {
  if (!c.env.OPENAI_API_KEY) {
    return c.json({ error: 'OpenAI API key not configured' }, 500);
  }
  if (!(await requireAuthedTTS(c))) return c.json({ error: 'Unauthorized' }, 401);

  const { text } = await c.req.json();
  if (!text) return c.json({ error: 'Missing text' }, 400);

  const audioBuffer = await generateTTSAudioBuffer(c.env, text, true);
  if (!audioBuffer) return c.json({ error: 'TTS generation failed' }, 500);

  return new Response(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

// Simple single-voice GET endpoint
ttsRoutes.get('/speak', async (c) => {
  if (!c.env.OPENAI_API_KEY) {
    console.error('[tts/speak] OPENAI_API_KEY missing — check wrangler secrets');
    return c.json({ error: 'TTS not configured' }, 500);
  }

  const text = c.req.query('text');
  const voice = c.req.query('voice') || 'alloy';
  const multi = c.req.query('multi'); // "true" to enable multi-speaker

  if (!text) return c.json({ error: 'Missing text param' }, 400);

  // Hono's c.req.query() returns the ALREADY-URL-DECODED value. Running
  // decodeURIComponent on top double-decodes: any legitimate '%' in the
  // script (e.g. "increased 20%") becomes an invalid escape sequence and
  // throws URIError, which the outer catch swallows silently as "TTS
  // generation failed" 500. That was the TOEFL iBT speaking audio failure.
  // Just trim what Hono gave us.
  const decoded = text.trim();
  if (decoded.length === 0) return c.json({ error: 'Empty text' }, 400);
  // Truncation handled below via .substring(0, 4096) before the OpenAI call.
  // Delimited key so "Hellotrue|alloy" vs "Hello|true|alloy" don't collide.
  // Format is hardcoded to mp3 here (GET /speak always serves MP3 for <audio>).
  const cacheKey = await hashText([decoded, multi === 'true' ? '1' : '0', voice, 'mp3'].join('\x1f'));

  // Cache-first serve. Auth is intentionally NOT required here — the browser's
  // <audio> element can't carry custom auth headers, and passing tg_id via
  // query param is unreliable (Telegram's iframe sometimes wipes sessionStorage
  // and react-router strips query params on navigation). Rarely-seen prompts
  // (e.g. a fresh speaking Q1 no one has generated yet) were failing cache-
  // miss with 401 while cached Q2+ served fine. Since the text query is
  // plaintext in the URL, there's no data to protect; and OpenAI TTS cost is
  // absorbed by the cache: the same text only generates once, and subsequent
  // hits are free D1 reads. Marginal abuse cost is trivial ($0.015/1K chars).
  const cached = await getCachedAudio(c.env.DB, cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=604800', 'X-Cache': 'HIT' },
    });
  }

  try {
    // Multi-speaker mode: per-segment TTS with speaker-mapped voices, then
    // frame-concatenate the MP3 buffers. OpenAI tts-1 outputs CBR MP3
    // without ID3, so concat works across major players. If any segment
    // TTS fails, fall back to single-voice on the full text.
    if (multi === 'true') {
      const segments = parseDialogue(decoded);

      if (segments.length > 1) {
        const buffers: ArrayBuffer[] = [];
        const voicesUsed = new Set<string>();
        for (const seg of segments) {
          if (!seg.text) continue;
          const buf = await fetchTTSAudioWithRetry(c.env.OPENAI_API_KEY, seg.text, seg.voice, 'mp3');
          if (!buf) { buffers.length = 0; break; }
          buffers.push(buf);
          voicesUsed.add(seg.voice);
        }

        if (buffers.length > 0) {
          const total = buffers.reduce((n, b) => n + b.byteLength, 0);
          const merged = new Uint8Array(total);
          let offset = 0;
          for (const b of buffers) { merged.set(new Uint8Array(b), offset); offset += b.byteLength; }
          c.executionCtx.waitUntil(cacheAudio(c.env.DB, cacheKey, merged.buffer, `multi:${[...voicesUsed].join('+')}`));
          try {
            const charCount = decoded.length;
            const cost = (charCount / 1000) * 0.015;
            await c.env.DB.prepare(
              'INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd) VALUES (?, ?, ?, ?)'
            ).bind('openai-tts', 'multi-segmented', charCount, cost).run();
          } catch {}
          return new Response(merged.buffer, {
            headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=604800', 'X-Cache': 'MISS' },
          });
        }

        // Fallback: single voice on concatenated text
        const fullText = segments.map(s => s.text).join(' ... ');
        const audioData = await fetchTTSAudioWithRetry(c.env.OPENAI_API_KEY, fullText, voice, 'mp3');
        if (!audioData) return c.json({ error: 'TTS generation failed' }, 500);

        c.executionCtx.waitUntil(cacheAudio(c.env.DB, cacheKey, audioData, 'multi-fallback'));

        try {
          const charCount = fullText.length;
          const cost = (charCount / 1000) * 0.015;
          await c.env.DB.prepare(
            'INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd) VALUES (?, ?, ?, ?)'
          ).bind('openai-tts', 'multi-fallback', charCount, cost).run();
        } catch {}

        return new Response(audioData, {
          headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=604800', 'X-Cache': 'MISS' },
        });
      }
    }

    // Single voice
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: decoded.substring(0, 4096),
        voice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      // Surface OpenAI's actual error message — previously this path just
      // returned an opaque 500, making auth/quota/model issues undiagnosable.
      const errBody = await response.text().catch(() => '');
      console.error(`[tts/speak] OpenAI ${response.status}: ${errBody.substring(0, 500)}`);
      return c.json({ error: 'TTS generation failed', status: response.status }, 500);
    }

    // Cache single voice result + log cost
    const audioData = await response.arrayBuffer();
    c.executionCtx.waitUntil(cacheAudio(c.env.DB, cacheKey, audioData, voice));
    try {
      const charCount = decoded.length;
      const cost = (charCount / 1000) * 0.015; // tts-1: $0.015/1K chars
      await c.env.DB.prepare(
        'INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd) VALUES (?, ?, ?, ?)'
      ).bind('openai-tts', voice, charCount, cost).run();
    } catch {}

    return new Response(audioData, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=604800', 'X-Cache': 'MISS' },
    });
  } catch (e: any) {
    // Don't swallow — these were silent 500s for months. Include the error
    // type + message so `wrangler tail` shows what actually went wrong
    // (URIError, TypeError from parseDialogue, D1 timeout, etc.).
    console.error(`[tts/speak] threw: ${e?.name || 'Error'}: ${e?.message || e}`);
    return c.json({ error: 'TTS generation failed', detail: e?.message || String(e) }, 500);
  }
});
