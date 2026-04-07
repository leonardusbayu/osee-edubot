import { Hono } from 'hono';
import type { Env } from '../types';

export const ttsRoutes = new Hono<{ Bindings: Env }>();

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
  const speakerPattern = /(?:^|\n|[.?!]\s*)((?:Woman|Man|Male|Female|Professor|Instructor|Narrator|Announcer|Student|Advisor|Librarian|Receptionist|Girl|Boy|Speaker\s*\d?)[^:]*?):\s*/gi;

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
async function fetchTTSAudio(apiKey: string, text: string, voice: string): Promise<ArrayBuffer> {
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
      response_format: 'mp3',
    }),
  });

  if (!response.ok) throw new Error(`TTS failed: ${response.status}`);
  return response.arrayBuffer();
}

// Exported core function to generate TTS audio without an HTTP loopback
export async function generateTTSAudioBuffer(env: Env, text: string, multi: boolean = false, voice: string = 'alloy'): Promise<ArrayBuffer | null> {
  if (!env.OPENAI_API_KEY) return null;

  const decoded = decodeURIComponent(text).trim();
  if (decoded.length === 0) return null;
  const cacheKey = await hashText(decoded + (multi ? 'true' : '') + voice);

  // Check cache
  const cached = await getCachedAudio(env.DB, cacheKey);
  if (cached) return cached;

  try {
    if (multi) {
      const segments = parseDialogue(decoded);
      if (segments.length > 1) {
        const audioBuffers: ArrayBuffer[] = [];
        const batchSize = 4;
        for (let i = 0; i < segments.length; i += batchSize) {
          const batch = segments.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map((seg) => fetchTTSAudio(env.OPENAI_API_KEY, seg.text, seg.voice))
          );
          audioBuffers.push(...results);
        }

        const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const buf of audioBuffers) {
          combined.set(new Uint8Array(buf), offset);
          offset += buf.byteLength;
        }

        cacheAudio(env.DB, cacheKey, combined.buffer, 'multi');

        // Log multi-speaker TTS cost
        try {
          const charCount = decoded.length;
          const cost = (charCount / 1000) * 0.015;
          await env.DB.prepare(
            'INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd) VALUES (?, ?, ?, ?)'
          ).bind('openai-tts', 'multi', charCount, cost).run();
        } catch {}

        return combined.buffer;
      }
    }

    // Single voice
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: decoded.substring(0, 4096),
        voice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) return null;

    const audioData = await response.arrayBuffer();
    cacheAudio(env.DB, cacheKey, audioData, voice);

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
    return c.json({ error: 'TTS not configured' }, 500);
  }

  const text = c.req.query('text');
  const voice = c.req.query('voice') || 'alloy';
  const multi = c.req.query('multi'); // "true" to enable multi-speaker

  if (!text) return c.json({ error: 'Missing text param' }, 400);

  const decoded = decodeURIComponent(text).trim();
  if (decoded.length === 0) return c.json({ error: 'Empty text' }, 400);
  if (decoded.length > 4096) {
    // Truncate silently
  }
  const cacheKey = await hashText(decoded + (multi || '') + voice);

  // Check cache
  const cached = await getCachedAudio(c.env.DB, cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=604800', 'X-Cache': 'HIT' },
    });
  }

  try {
    // Check if multi-speaker mode
    if (multi === 'true') {
      const segments = parseDialogue(decoded);

      if (segments.length > 1) {
        // Multi-speaker: generate and concat
        const audioBuffers: ArrayBuffer[] = [];
        const batchSize = 4;

        for (let i = 0; i < segments.length; i += batchSize) {
          const batch = segments.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map((seg) => fetchTTSAudio(c.env.OPENAI_API_KEY, seg.text, seg.voice))
          );
          audioBuffers.push(...results);
        }

        const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const buf of audioBuffers) {
          combined.set(new Uint8Array(buf), offset);
          offset += buf.byteLength;
        }

        // Cache the result
        cacheAudio(c.env.DB, cacheKey, combined.buffer, 'multi');

        // Log multi-speaker TTS cost
        try {
          const charCount = decoded.length;
          const cost = (charCount / 1000) * 0.015;
          await c.env.DB.prepare(
            'INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd) VALUES (?, ?, ?, ?)'
          ).bind('openai-tts', 'multi', charCount, cost).run();
        } catch {}

        return new Response(combined, {
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

    if (!response.ok) return c.json({ error: 'TTS generation failed' }, 500);

    // Cache single voice result + log cost
    const audioData = await response.arrayBuffer();
    cacheAudio(c.env.DB, cacheKey, audioData, voice);
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
  } catch {
    return c.json({ error: 'TTS generation failed' }, 500);
  }
});
