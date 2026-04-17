/**
 * Visual explanation cache service.
 *
 * Most students learn faster when a concept comes with a picture. But
 * generating images via fal.ai (Gemini 2.5 Flash Image, a.k.a. "Nano
 * Banana") is not free — each call is ~$0.03–0.04. The economics only
 * work if we cache aggressively, because:
 *
 *   • An "inference analogy" diagram is equally useful for student A and
 *     student B — the concept is universal.
 *   • Per-question visuals (specific reading passage structure) are
 *     universal too — every student who misses question #1247 benefits
 *     from the same diagram.
 *
 * So every image we generate is saved to R2 + indexed in D1, and before
 * calling fal.ai we always check the cache first.
 *
 * Design decisions:
 *   • Bytes live in R2, metadata in D1 — D1 rows stay small and fast.
 *   • Cache key is (concept, explanation_type, content_id?, variant).
 *     Concept-general visuals have content_id=NULL; per-question ones
 *     carry the content_id.
 *   • Variants exist so that after a student has seen analogy-0 we can
 *     try analogy-1 next time instead of re-serving the same image.
 *   • Retired images stay in the DB for audit but are filtered out of
 *     reads. Never delete — we may want to A/B later.
 *   • The serve URL is always `/api/visual/:id/bytes` — a worker-mediated
 *     stream from R2, not the fal.ai CDN URL (which expires). This also
 *     keeps us in control of caching headers + access control.
 */

import type { Env } from '../types';

// ═══════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════

const FAL_MODEL = 'fal-ai/gemini-25-flash-image';
const FAL_SYNC_URL = `https://fal.run/${FAL_MODEL}`;
// Approx per-image price (USD). Used for logging/analytics only — billing
// of record is still fal.ai's dashboard.
const APPROX_COST_PER_IMAGE = 0.04;

export type ExplanationType =
  | 'analogy'             // visual metaphor comparing the concept to something familiar
  | 'diagram'             // structured visual (flowchart, boxes, arrows)
  | 'misconception_contrast' // side-by-side: wrong way vs. right way
  | 'worked_example';     // step-by-step illustration of a solved problem

// ═══════════════════════════════════════════════════════
// AUTO-VISUAL CONCEPT CATALOG
// ═══════════════════════════════════════════════════════
// Concepts where a picture earns its keep. Each entry lists the
// explanation types that work best — we pre-warm these and tell the
// tutor prompt to emit [VISUAL:concept:type] tags when teaching them.
//
// Kept roughly in sync with the importanceWeight map in
// post-test-review.ts — the concepts that drive remediation most are
// also the ones worth a cached picture.
//
// To add a concept: append here. The tutor prompt reads it at runtime
// via buildAutoVisualHint(); prewarm_visuals.mjs reads the same list
// so the prompt promises what the cache can actually deliver.
// ═══════════════════════════════════════════════════════
export interface AutoVisualEntry {
  concept: string;            // must match skill_tags / mental_model concept strings
  types: ExplanationType[];   // preferred order; pre-warm generates each
  note?: string;              // short description for the tutor prompt
}

export const AUTO_VISUAL_CONCEPTS: AutoVisualEntry[] = [
  // Reading
  { concept: 'inference',             types: ['analogy', 'diagram'],                       note: 'reading between the lines' },
  { concept: 'main_idea',             types: ['diagram', 'analogy'],                       note: 'finding the central claim' },
  { concept: 'detail',                types: ['diagram'],                                  note: 'factual detail scan' },
  { concept: 'factual_info',          types: ['diagram'],                                  note: 'factual information question type' },
  { concept: 'negative_factual',      types: ['misconception_contrast'],                   note: 'NOT/EXCEPT elimination traps' },
  { concept: 'vocabulary_in_context', types: ['analogy'],                                  note: 'word meaning from context' },
  { concept: 'rhetorical_purpose',    types: ['analogy'],                                  note: 'why the author wrote this part' },
  { concept: 'pronoun_reference',     types: ['diagram'],                                  note: 'what does this/it/they point to' },
  // Grammar (high-impact remediation targets)
  { concept: 'subject_verb',          types: ['misconception_contrast', 'worked_example'], note: 'subject-verb agreement' },
  { concept: 'tense',                 types: ['diagram', 'worked_example'],                note: 'tense selection + timeline' },
];

/**
 * Compact hint block for the tutor prompt. Lists concepts + preferred
 * explanation types so the LLM knows which [VISUAL:...] tags will hit
 * the warm cache.
 */
export function buildAutoVisualHint(): string {
  return AUTO_VISUAL_CONCEPTS.map((e) => {
    const types = e.types.join('|');
    return `- ${e.concept} (${types})${e.note ? ` — ${e.note}` : ''}`;
  }).join('\n');
}

/**
 * For a given concept, what explanation_type should the tutor default
 * to? null if the concept isn't in the auto-visual catalog.
 */
export function pickAutoVisualType(concept: string): ExplanationType | null {
  const entry = AUTO_VISUAL_CONCEPTS.find((e) => e.concept === concept);
  return entry ? entry.types[0] : null;
}

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface VisualRow {
  id: number;
  concept: string;
  explanation_type: ExplanationType;
  variant: number;
  content_id: number | null;
  r2_key: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  prompt_used: string;
  model: string;
  hit_count: number;
  helpful_count: number;
  not_helpful_count: number;
  generated_at: string;
  last_served_at: string | null;
}

export interface GetOrGenerateOpts {
  concept: string;
  explanation_type: ExplanationType;
  content_id?: number | null;
  /**
   * If true and the cache is non-empty, force generation of a new variant
   * instead of serving an existing one. Useful when a student said "show
   * me differently" — they've seen variant 0, so we pick 1, or create it.
   */
  prefer_new_variant?: boolean;
  /**
   * user_id of the student requesting the visual. Used to skip variants
   * they've already seen recently when prefer_new_variant is false.
   */
  user_id?: number;
  /**
   * Custom prompt override. If omitted, we build one from a template based
   * on (concept, explanation_type). Callers providing a custom prompt are
   * responsible for determinism if they want cache hits.
   */
  prompt?: string;
  /** Aspect ratio passed through to fal.ai. Defaults to "1:1". */
  aspect_ratio?: '1:1' | '4:3' | '16:9' | '3:4' | '9:16';
}

export interface VisualResult {
  id: number;
  concept: string;
  explanation_type: ExplanationType;
  variant: number;
  bytes_url: string; // worker-served URL, e.g. "/api/visual/42/bytes"
  cache_hit: boolean; // true = we served an existing image; false = generated
  width: number | null;
  height: number | null;
}

// ═══════════════════════════════════════════════════════
// PROMPT BUILDER
// ═══════════════════════════════════════════════════════

/**
 * Build a generation prompt from (concept, type). Kept deterministic so
 * the same inputs produce the same `prompt_used` — this lets us dedupe
 * and detect when a prompt change justifies regeneration.
 *
 * Tone: diagrammatic, educational, minimal text (the student's UI already
 * carries the text explanation — the image is there to add intuition).
 */
export function buildPromptForConcept(
  concept: string,
  type: ExplanationType,
): string {
  const humanConcept = concept
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const baseStyle =
    'Clean educational illustration, flat design, high contrast, ' +
    'minimal text (at most 2–3 short English words as labels), ' +
    'white or light background, clear readable layout for mobile viewing. ' +
    'No watermarks. No lorem ipsum.';

  switch (type) {
    case 'analogy':
      return (
        `A visual analogy that explains the English-test concept "${humanConcept}" ` +
        `by comparing it to something concrete and familiar from everyday life. ` +
        `Show the analogy as a side-by-side pairing: the real-world thing on the ` +
        `left, the language concept on the right, with matching elements visually ` +
        `linked by simple arrows or dashed lines. ${baseStyle}`
      );
    case 'diagram':
      return (
        `A simple educational diagram that explains the English-test concept ` +
        `"${humanConcept}". Use boxes, arrows, or a flowchart to show the core ` +
        `structure. Label only the essentials. ${baseStyle}`
      );
    case 'misconception_contrast':
      return (
        `A side-by-side "wrong vs right" comparison chart for the English-test ` +
        `concept "${humanConcept}". Left panel labelled with an X shows a common ` +
        `student mistake; right panel labelled with a checkmark shows the correct ` +
        `approach. The two panels should share the same visual structure so the ` +
        `difference pops. ${baseStyle}`
      );
    case 'worked_example':
      return (
        `A step-by-step visual walkthrough of a single worked example of the ` +
        `English-test concept "${humanConcept}". Show 3–4 numbered steps arranged ` +
        `vertically or in a grid, each with a tiny caption. ${baseStyle}`
      );
  }
}

// ═══════════════════════════════════════════════════════
// CACHE LOOKUP
// ═══════════════════════════════════════════════════════

/** Find all existing variants for (concept, type, content_id). */
export async function listCachedVariants(
  env: Env,
  concept: string,
  explanation_type: ExplanationType,
  content_id: number | null = null,
): Promise<VisualRow[]> {
  const rows = content_id == null
    ? await env.DB.prepare(
        `SELECT * FROM visual_explanations
         WHERE concept = ? AND explanation_type = ? AND content_id IS NULL AND retired = 0
         ORDER BY variant ASC`,
      ).bind(concept, explanation_type).all()
    : await env.DB.prepare(
        `SELECT * FROM visual_explanations
         WHERE concept = ? AND explanation_type = ? AND content_id = ? AND retired = 0
         ORDER BY variant ASC`,
      ).bind(concept, explanation_type, content_id).all();
  return (rows.results || []) as unknown as VisualRow[];
}

/** Get variant numbers this user has already seen for (concept, type). */
async function getSeenVariants(
  env: Env,
  userId: number,
  concept: string,
  explanation_type: ExplanationType,
): Promise<Set<number>> {
  try {
    const rows = await env.DB.prepare(
      `SELECT ve.variant
       FROM student_visual_exposures sve
       JOIN visual_explanations ve ON ve.id = sve.visual_id
       WHERE sve.user_id = ? AND ve.concept = ? AND ve.explanation_type = ?`,
    ).bind(userId, concept, explanation_type).all();
    return new Set(((rows.results || []) as any[]).map((r) => Number(r.variant)));
  } catch {
    return new Set();
  }
}

// ═══════════════════════════════════════════════════════
// FAL.AI GENERATION
// ═══════════════════════════════════════════════════════

interface FalGeneratedImage {
  url: string;
  content_type?: string;
  width?: number;
  height?: number;
}

interface FalResponse {
  images?: FalGeneratedImage[];
  description?: string;
}

/**
 * Call fal.ai's Gemini 2.5 Flash Image sync endpoint and return the first
 * generated image bytes. Sync is fine for Nano Banana — it's typically
 * 2–5 seconds. If it starts timing out we'll switch to the queue API.
 */
async function generateWithFal(
  env: Env,
  prompt: string,
  aspect_ratio: string = '1:1',
): Promise<{ bytes: ArrayBuffer; mime_type: string; width: number | null; height: number | null }> {
  const apiKey = env.FAL_API_KEY;
  if (!apiKey) {
    throw new Error('FAL_API_KEY is not configured');
  }

  const body = {
    prompt,
    num_images: 1,
    aspect_ratio,
    output_format: 'png' as const,
  };

  const res = await fetch(FAL_SYNC_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Fal-No-Retry': '1', // we handle our own retries
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => '');
    throw new Error(`fal.ai ${res.status}: ${errTxt.slice(0, 300)}`);
  }

  const data = (await res.json()) as FalResponse;
  const first = data.images?.[0];
  if (!first?.url) {
    throw new Error('fal.ai response contained no image URL');
  }

  // fal.ai returns a CDN URL that expires. We immediately fetch the bytes
  // and put them in R2 so we own the artifact.
  const imgRes = await fetch(first.url);
  if (!imgRes.ok) {
    throw new Error(`failed to fetch fal.ai image: ${imgRes.status}`);
  }
  const bytes = await imgRes.arrayBuffer();

  return {
    bytes,
    mime_type: first.content_type || 'image/png',
    width: first.width ?? null,
    height: first.height ?? null,
  };
}

// ═══════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════

function makeR2Key(concept: string, type: ExplanationType, variant: number, content_id: number | null): string {
  const safe = concept.replace(/[^a-z0-9_]/gi, '_');
  const suffix = content_id != null ? `q${content_id}/` : '';
  return `visual/${safe}/${type}/${suffix}v${variant}.png`;
}

async function persistGenerated(
  env: Env,
  opts: {
    concept: string;
    explanation_type: ExplanationType;
    content_id: number | null;
    variant: number;
    bytes: ArrayBuffer;
    mime_type: string;
    width: number | null;
    height: number | null;
    prompt_used: string;
  },
): Promise<VisualRow> {
  const r2Key = makeR2Key(opts.concept, opts.explanation_type, opts.variant, opts.content_id);

  if (!env.VISUAL_BUCKET) {
    throw new Error('VISUAL_BUCKET binding is missing — add the R2 binding to wrangler.toml');
  }
  await env.VISUAL_BUCKET.put(r2Key, opts.bytes, {
    httpMetadata: { contentType: opts.mime_type },
  });

  const ins = await env.DB.prepare(
    `INSERT INTO visual_explanations
       (concept, explanation_type, variant, content_id, r2_key, mime_type,
        width, height, bytes, prompt_used, model, generation_cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
  ).bind(
    opts.concept,
    opts.explanation_type,
    opts.variant,
    opts.content_id,
    r2Key,
    opts.mime_type,
    opts.width,
    opts.height,
    opts.bytes.byteLength,
    opts.prompt_used,
    FAL_MODEL,
    APPROX_COST_PER_IMAGE,
  ).first();

  return ins as unknown as VisualRow;
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

/**
 * Cache-first get-or-generate. This is the one function the tutor/webhook
 * should call when it wants a visual. Returns a worker-served URL the
 * Telegram client (or mini app) can consume directly.
 *
 * Selection policy when variants already exist:
 *   • If user_id given: prefer variants this user has NOT seen yet; if
 *     all are seen, serve the least-recently-shown one.
 *   • If no user_id: serve the variant with the highest helpful_count
 *     (ties broken by lowest hit_count, for fairness).
 *   • If prefer_new_variant=true: always generate a fresh variant.
 */
export async function getOrGenerateVisual(
  env: Env,
  opts: GetOrGenerateOpts,
): Promise<VisualResult> {
  const { concept, explanation_type } = opts;
  const content_id = opts.content_id ?? null;
  const aspect_ratio = opts.aspect_ratio || '1:1';

  const variants = opts.prefer_new_variant
    ? []
    : await listCachedVariants(env, concept, explanation_type, content_id);

  if (variants.length > 0) {
    // Pick from cache
    let chosen = variants[0];

    if (opts.user_id) {
      const seen = await getSeenVariants(env, opts.user_id, concept, explanation_type);
      const unseen = variants.filter((v) => !seen.has(v.variant));
      if (unseen.length > 0) {
        // Prefer unseen; within unseen, prefer the one with most helpful feedback
        unseen.sort((a, b) => b.helpful_count - a.helpful_count || a.hit_count - b.hit_count);
        chosen = unseen[0];
      } else {
        // All seen — pick the one we showed them least recently
        // (approximated by: lowest hit_count — spreads exposure)
        variants.sort((a, b) => a.hit_count - b.hit_count);
        chosen = variants[0];
      }
    } else {
      variants.sort((a, b) => b.helpful_count - a.helpful_count || a.hit_count - b.hit_count);
      chosen = variants[0];
    }

    // Count the hit + timestamp (best-effort; don't block serving on this)
    try {
      await env.DB.prepare(
        `UPDATE visual_explanations
         SET hit_count = hit_count + 1, last_served_at = datetime('now')
         WHERE id = ?`,
      ).bind(chosen.id).run();
    } catch { /* ignore */ }

    if (opts.user_id) {
      await logExposure(env, opts.user_id, chosen.id).catch(() => { /* ignore */ });
    }

    return {
      id: chosen.id,
      concept,
      explanation_type,
      variant: chosen.variant,
      bytes_url: `/api/visual/${chosen.id}/bytes`,
      cache_hit: true,
      width: chosen.width,
      height: chosen.height,
    };
  }

  // Cache miss (or prefer_new_variant) — generate.
  // New variant number = max existing + 1 (re-query in case prefer_new was set)
  const existing = await listCachedVariants(env, concept, explanation_type, content_id);
  const nextVariant = existing.length > 0
    ? Math.max(...existing.map((v) => v.variant)) + 1
    : 0;

  const prompt = opts.prompt ?? buildPromptForConcept(concept, explanation_type);
  const gen = await generateWithFal(env, prompt, aspect_ratio);
  const row = await persistGenerated(env, {
    concept,
    explanation_type,
    content_id,
    variant: nextVariant,
    bytes: gen.bytes,
    mime_type: gen.mime_type,
    width: gen.width,
    height: gen.height,
    prompt_used: prompt,
  });

  if (opts.user_id) {
    await logExposure(env, opts.user_id, row.id).catch(() => { /* ignore */ });
  }

  return {
    id: row.id,
    concept,
    explanation_type,
    variant: row.variant,
    bytes_url: `/api/visual/${row.id}/bytes`,
    cache_hit: false,
    width: row.width,
    height: row.height,
  };
}

// ═══════════════════════════════════════════════════════
// SERVE
// ═══════════════════════════════════════════════════════

/**
 * Stream an image's bytes from R2. Called by the route handler. Returns
 * null if the image row or the R2 object is missing — the route should
 * translate that into a 404.
 */
export async function loadImageBytes(
  env: Env,
  visualId: number,
): Promise<{ body: ReadableStream | ArrayBuffer; mime_type: string } | null> {
  const row = await env.DB.prepare(
    `SELECT r2_key, mime_type FROM visual_explanations WHERE id = ? AND retired = 0`,
  ).bind(visualId).first() as any;
  if (!row) return null;

  if (!env.VISUAL_BUCKET) return null;
  const obj = await env.VISUAL_BUCKET.get(row.r2_key);
  if (!obj) return null;

  return {
    body: obj.body,
    mime_type: row.mime_type || 'image/png',
  };
}

// ═══════════════════════════════════════════════════════
// FEEDBACK
// ═══════════════════════════════════════════════════════

export async function logExposure(env: Env, userId: number, visualId: number): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO student_visual_exposures (user_id, visual_id) VALUES (?, ?)`,
  ).bind(userId, visualId).run();
}

export async function recordFeedback(
  env: Env,
  userId: number,
  visualId: number,
  feedback: 'helpful' | 'not_helpful',
): Promise<void> {
  // Log on the most recent exposure by this user for this visual
  await env.DB.prepare(
    `UPDATE student_visual_exposures
     SET feedback = ?, feedback_at = datetime('now')
     WHERE id = (
       SELECT id FROM student_visual_exposures
       WHERE user_id = ? AND visual_id = ?
       ORDER BY id DESC LIMIT 1
     )`,
  ).bind(feedback, userId, visualId).run();

  // Bump the aggregate counter on the visual row
  const col = feedback === 'helpful' ? 'helpful_count' : 'not_helpful_count';
  await env.DB.prepare(
    `UPDATE visual_explanations SET ${col} = ${col} + 1 WHERE id = ?`,
  ).bind(visualId).run();
}

// ═══════════════════════════════════════════════════════
// ADMIN / ANALYTICS
// ═══════════════════════════════════════════════════════

export async function listVisuals(
  env: Env,
  opts: { concept?: string; type?: ExplanationType; limit?: number } = {},
): Promise<VisualRow[]> {
  const limit = Math.min(Math.max(opts.limit || 50, 1), 500);
  let q = `SELECT * FROM visual_explanations WHERE retired = 0`;
  const params: any[] = [];
  if (opts.concept) { q += ' AND concept = ?'; params.push(opts.concept); }
  if (opts.type) { q += ' AND explanation_type = ?'; params.push(opts.type); }
  q += ' ORDER BY hit_count DESC, generated_at DESC LIMIT ?';
  params.push(limit);
  const rows = await env.DB.prepare(q).bind(...params).all();
  return (rows.results || []) as unknown as VisualRow[];
}

export async function retireVisual(env: Env, visualId: number): Promise<void> {
  await env.DB.prepare(
    `UPDATE visual_explanations SET retired = 1 WHERE id = ?`,
  ).bind(visualId).run();
}
