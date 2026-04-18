// Scene-image generation + caching for describe-picture exercises.
//
// The describe_pic exercise used to show a text description of a scene
// ("A serene park with people relaxing and jogging") and ask students to
// describe it in English. That defeats the purpose — the whole skill is
// describing what you SEE, not a text prompt. This module generates an
// actual image for the scene via fal.ai, caches in R2 by scene hash so
// identical scenes reuse the same artifact.
//
// On-demand generation is ~$0.003-0.01 per image and 2-5s latency, but the
// cache means each unique scene is paid for once then served free forever.

import type { Env } from '../types';

const FAL_SYNC_URL = 'https://fal.run/fal-ai/gemini-25-flash-image';

// ─── Hashing (scene text → stable R2 key) ──────────────────────────────

async function sha1(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Prompt builder ─────────────────────────────────────────────────────

/**
 * Build a concrete visual prompt from the scene description + key vocab.
 * fal.ai responds better to concrete scene descriptions than vague "describe
 * this" prompts — we add style guardrails so all describe-pic images look
 * consistent (photo-realistic, daylight, neutral framing for vocab focus).
 */
function buildScenePrompt(scene: string, keyVocab: string[] = []): string {
  const vocabHint = keyVocab.length
    ? ` Scene elements should visibly include: ${keyVocab.slice(0, 5).join(', ')}.`
    : '';
  return (
    `Photo-realistic image for an English-language practice exercise. ` +
    `Scene: ${scene}.${vocabHint} ` +
    `Natural daylight, neutral wide shot, clear details so a student can ` +
    `describe objects and actions. No text overlays, no watermarks.`
  );
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Fetch (or generate + cache) the image for a describe-picture scene.
 * Returns null on any failure (missing secret, fal error, R2 error) so the
 * caller can fall back to text-only rendering.
 */
export async function getOrGenerateSceneImage(
  env: Env,
  scene: string,
  keyVocab: string[] = [],
): Promise<{ bytes: ArrayBuffer; mime_type: string } | null> {
  if (!env.VISUAL_BUCKET) return null;

  // 1. Stable cache key from scene text. Vocab is style-hint only, not
  //    part of the identity — same scene = same image regardless of vocab.
  const hash = await sha1(scene.trim().toLowerCase());
  const r2Key = `scene-images/${hash}.png`;

  // 2. Cache hit?
  try {
    const cached = await env.VISUAL_BUCKET.get(r2Key);
    if (cached) {
      const bytes = await cached.arrayBuffer();
      return { bytes, mime_type: cached.httpMetadata?.contentType || 'image/png' };
    }
  } catch (e) {
    console.warn('[scene-image] cache read failed:', (e as any)?.message);
  }

  // 3. Generate fresh.
  const apiKey = env.FAL_API_KEY;
  if (!apiKey) {
    console.warn('[scene-image] FAL_API_KEY missing — returning text fallback');
    return null;
  }

  try {
    const prompt = buildScenePrompt(scene, keyVocab);
    const res = await fetch(FAL_SYNC_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Fal-No-Retry': '1',
      },
      body: JSON.stringify({
        prompt,
        num_images: 1,
        aspect_ratio: '4:3',
        output_format: 'png',
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error(`[scene-image] fal ${res.status}: ${err.slice(0, 200)}`);
      return null;
    }

    const data = (await res.json()) as { images?: Array<{ url?: string; content_type?: string }> };
    const imgUrl = data.images?.[0]?.url;
    if (!imgUrl) {
      console.error('[scene-image] fal returned no image url');
      return null;
    }

    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) {
      console.error(`[scene-image] could not fetch fal cdn: ${imgRes.status}`);
      return null;
    }
    const bytes = await imgRes.arrayBuffer();
    const mime = data.images?.[0]?.content_type || 'image/png';

    // 4. Persist to R2 so the next student with the same scene is instant.
    try {
      await env.VISUAL_BUCKET.put(r2Key, bytes, {
        httpMetadata: { contentType: mime },
      });
    } catch (e) {
      console.warn('[scene-image] r2 put failed:', (e as any)?.message);
      // still return bytes — current request succeeds even if cache put failed
    }

    return { bytes, mime_type: mime };
  } catch (e: any) {
    console.error('[scene-image] generation failed:', e?.message || e);
    return null;
  }
}
