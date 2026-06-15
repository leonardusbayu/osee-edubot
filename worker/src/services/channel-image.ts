// Channel post image generation + R2 caching.
//
// Channel posts used to be text-only — the existing `imagePrompt` field
// in generateVocabularyOfTheDay was a TEXT prompt that was never used.
// This module generates real DALL-E 3 images for channel posts and caches
// them in R2 by prompt-hash so the same prompt never costs twice.
//
// DALL-E 3 pricing: $0.040/image at 1024x1024 standard. The cache makes
// each unique image a one-time cost; subsequent channel posts reuse
// the same artifact. For the daily vocabulary post, a stable
// prompt (3 word names + minimal style hint) means the same image is
// generated once per word set, served forever after.
//
// On any failure (missing key, OpenAI 4xx/5xx, R2 outage) the caller
// falls back to text-only. Image generation is best-effort — never
// block the channel post on it.

import type { Env } from '../types';

const DALLE_MODEL = 'dall-e-3';
const DALLE_SIZE = '1024x1024';
const DALLE_QUALITY = 'standard';

// ─── Prompt builder ─────────────────────────────────────────────────────

/**
 * Normalise a prompt to a stable R2 cache key. Lowercase, collapse
 * whitespace, strip punctuation that varies between runs.
 */
function normalisePromptForCacheKey(prompt: string): string {
  return prompt.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function sha1(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Style guardrails ──────────────────────────────────────────────────

/**
 * Append style guide rails so all channel-post images look like part of
 * the same series. DALL-E 3 tends to be literal — without these rails
 * the same prompt produces wildly different visual styles.
 */
function applyChannelStyleGuide(prompt: string): string {
  return (
    `${prompt} ` +
    `Modern minimalist educational illustration, soft purple and teal ` +
    `gradient background, generous white space, crisp sans-serif readable ` +
    `typography, mobile-optimised composition (no fine details that get lost ` +
    `at thumbnail size), friendly and approachable tone, suitable for a ` +
    `Telegram channel post. No photographic people, no watermarks, no logos.`
  );
}

// ─── Public API ─────────────────────────────────────────────────────────

export type ChannelImage = {
  bytes: ArrayBuffer;
  mime_type: string;
  cache_key: string;
  source: 'cache' | 'fresh' | 'fallback';
};

export interface BuildChannelImageArgs {
  /** Short topic label, e.g. "vocab" / "grammar" / "idiom" / "quiz". */
  topic: 'vocab' | 'grammar' | 'idiom' | 'quiz';
  /** Concrete subject of the post — words, rule title, idiom text. */
  subject: string;
  /** Optional short tag for cache keying (e.g. test type, language). */
  variant?: string;
  /** Override the default style guide. */
  styleOverride?: string;
}

/**
 * Generate (or fetch from R2 cache) a channel-post image for the given
 * subject. Best-effort — returns a fallback image (data: URL of a
 * plain gradient) on any failure so the channel post is never blocked.
 *
 * Fallback images are 1x1 PNGs, intentionally tiny — the worker
 * channels API caller checks `source === 'fallback'` and skips the
 * sendPhoto call to avoid cluttering the channel with empty pixels.
 */
export async function getOrGenerateChannelImage(
  env: Env,
  args: BuildChannelImageArgs,
): Promise<ChannelImage> {
  const topic = args.topic;
  const subject = args.subject.trim();
  if (!subject) return fallbackImage('empty');

  // 1. Build the prompt + style guide.
  const basePrompt = promptForTopic(topic, subject, args.styleOverride);
  const styledPrompt = applyChannelStyleGuide(basePrompt);
  const keySeed = normalisePromptForCacheKey(`${topic}:${args.variant || ''}:${basePrompt}`);
  const hash = await sha1(keySeed);
  const r2Key = `channel-images/${hash}.png`;

  // 2. Cache hit?
  if (env.VISUAL_BUCKET) {
    try {
      const cached = await env.VISUAL_BUCKET.get(r2Key);
      if (cached) {
        const bytes = await cached.arrayBuffer();
        return { bytes, mime_type: cached.httpMetadata?.contentType || 'image/png', cache_key: r2Key, source: 'cache' };
      }
    } catch (e) {
      console.warn('[channel-image] cache read failed:', (e as any)?.message);
    }
  }

  // 3. Generate fresh.
  if (!env.OPENAI_API_KEY) {
    console.warn('[channel-image] OPENAI_API_KEY missing — usando fallback');
    return fallbackImage('no-key');
  }

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DALLE_MODEL,
        prompt: styledPrompt,
        n: 1,
        size: DALLE_SIZE,
        quality: DALLE_QUALITY,
        response_format: 'url',
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[channel-image] DALL-E ${res.status}: ${errBody.substring(0, 300)}`);
      return fallbackImage(`dalle-${res.status}`);
    }

    const data = (await res.json()) as { data?: Array<{ url?: string }> };
    const imgUrl = data.data?.[0]?.url;
    if (!imgUrl) {
      console.error('[channel-image] DALL-E returned no image url');
      return fallbackImage('no-url');
    }

    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) {
      console.error(`[channel-image] DALL-E CDN returned ${imgRes.status}`);
      return fallbackImage('cdn-failed');
    }
    const bytes = await imgRes.arrayBuffer();

    // 4. Persist to R2 (best-effort; current request still succeeds).
    if (env.VISUAL_BUCKET) {
      try {
        await env.VISUAL_BUCKET.put(r2Key, bytes, {
          httpMetadata: { contentType: 'image/png' },
        });
      } catch (e) {
        console.warn('[channel-image] r2 put failed:', (e as any)?.message);
      }
    }

    return { bytes, mime_type: 'image/png', cache_key: r2Key, source: 'fresh' };
  } catch (e: any) {
    console.error('[channel-image] generation failed:', e?.message || e);
    return fallbackImage('exception');
  }
}

function promptForTopic(
  topic: 'vocab' | 'grammar' | 'idiom' | 'quiz',
  subject: string,
  override?: string,
): string {
  if (override) return override;
  switch (topic) {
    case 'vocab':
      // The subject is the 3 word names (e.g. "mitigate, substantiate, paradigm")
      return `Three academic English vocabulary words displayed as elegant flashcards: "${subject}". Each word has its part of speech, an Indonesian translation, and a small contextual icon. The cards are arranged in a row, connected by a subtle dotted line suggesting a learning path. Top label: "Vocabulary of the Day".`;
    case 'grammar':
      return `A clean educational diagram illustrating the English grammar rule: ${subject}. Use icons, arrows, color-coded example sentences, and a before/after transformation to make the rule memorable. Title: "${subject.split('.')[0].substring(0, 60)}".`;
    case 'idiom':
      return `A visual pun illustration of the English idiom: "${subject}". Show literal objects arranged in a way that hints at the figurative meaning (e.g. a literal "piece of cake" for "a piece of cake"). Style: clean vector illustration with a small caption showing the idiom and its meaning.`;
    case 'quiz':
      return `An English test-style question card with the prompt: ${subject}. A clean serif/sans-serif question header, four multiple-choice option bubbles (A, B, C, D), and a subtle "Test Your English" stamp. Use neutral pastel colors.`;
  }
}

// ─── Fallback (tiny transparent PNG) ──────────────────────────────────

// 1x1 transparent PNG (~67 bytes). Channel post caller detects this via
// `source === 'fallback'` and skips the sendPhoto call.
const TRANSPARENT_PNG = Uint8Array.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
  0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
  0x42, 0x60, 0x82,
]);

function fallbackImage(reason: string): ChannelImage {
  // The reason is logged at the call site via the channel_posts error_message
  // column; we don't include it in the returned struct to keep the channel
  // post path simple.
  console.warn(`[channel-image] returning fallback (${reason})`);
  // Copy the static bytes into a fresh ArrayBuffer so the caller can
  // pass it to fetch / send without worrying about SharedArrayBuffer reuse.
  const copy = TRANSPARENT_PNG.slice().buffer;
  return {
    bytes: copy,
    mime_type: 'image/png',
    cache_key: '',
    source: 'fallback',
  };
}
