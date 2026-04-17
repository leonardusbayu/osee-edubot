/**
 * Visual explanation routes.
 *
 * Students never get fal.ai URLs directly — the worker mediates every
 * image request. This gives us:
 *   • permanent URLs (fal.ai CDN links expire)
 *   • cache-control headers tuned for our CDN edge
 *   • access control (exposure logging, possible rate limits)
 *   • clean analytics (we see every serve)
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';
import {
  getOrGenerateVisual,
  loadImageBytes,
  recordFeedback,
  listVisuals,
  retireVisual,
  type ExplanationType,
} from '../services/visual-explanation';

export const visualRoutes = new Hono<{ Bindings: Env }>();

/**
 * Admin auth: accept either X-API-Key (for CLI / smoke tests) or a JWT
 * whose user has role teacher|admin. Returns { ok, userId?, viaApiKey? }
 * so callers can attribute exposures when possible.
 */
async function checkAdminAuth(c: any): Promise<{ ok: boolean; userId: number | null; viaApiKey: boolean }> {
  const apiKey = c.req.header('X-API-Key');
  if (apiKey && c.env.ADMIN_API_KEY && apiKey === c.env.ADMIN_API_KEY) {
    return { ok: true, userId: null, viaApiKey: true };
  }
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return { ok: false, userId: null, viaApiKey: false };
  if (user.role !== 'teacher' && user.role !== 'admin') {
    return { ok: false, userId: user.id, viaApiKey: false };
  }
  return { ok: true, userId: user.id, viaApiKey: false };
}

// ─────────────────────────────────────────────────────────────
// GET /api/visual/:id/bytes
//
// Public-ish: any authenticated student can fetch the bytes by ID. IDs
// are not sensitive — they're just numbers keyed to (concept, type). If
// we want to tighten this later, gate behind a signed URL.
// ─────────────────────────────────────────────────────────────
visualRoutes.get('/:id/bytes', async (c) => {
  const visualId = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(visualId) || visualId <= 0) {
    return c.json({ error: 'Invalid visual ID' }, 400);
  }

  const loaded = await loadImageBytes(c.env, visualId);
  if (!loaded) return c.json({ error: 'Not found' }, 404);

  return new Response(loaded.body as any, {
    headers: {
      'Content-Type': loaded.mime_type,
      // Images are immutable once generated (we always create a new row
      // for a new variant), so aggressive caching is safe.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/visual/get-or-generate
//
// Body: {
//   concept: string,
//   explanation_type: 'analogy' | 'diagram' | 'misconception_contrast' | 'worked_example',
//   content_id?: number | null,
//   prefer_new_variant?: boolean,
//   prompt?: string,
//   aspect_ratio?: string,
// }
//
// Auth: requires a logged-in user (exposure gets logged against them).
// The tutor/webhook is the primary caller; admin can also trigger
// pre-warming via this endpoint.
// ─────────────────────────────────────────────────────────────
visualRoutes.post('/get-or-generate', async (c) => {
  try {
    // Dual auth: student JWT OR admin (X-API-Key / teacher|admin JWT).
    // Students can generate for themselves (exposure gets logged).
    // Admin/CLI can generate without a user — used for cache pre-warming.
    const apiKey = c.req.header('X-API-Key');
    const isApiKey = !!(apiKey && c.env.ADMIN_API_KEY && apiKey === c.env.ADMIN_API_KEY);
    let userId: number | null = null;
    if (!isApiKey) {
      const user = await getAuthUser(c.req.raw, c.env);
      if (!user) return c.json({ error: 'Unauthorized', message: 'Provide X-API-Key header or valid JWT' }, 401);
      userId = user.id;
    }

    const body = await c.req.json().catch(() => ({})) as any;
    const concept = String(body.concept || '').trim();
    const type = String(body.explanation_type || '').trim() as ExplanationType;
    if (!concept || !type) {
      return c.json({ error: 'concept and explanation_type are required' }, 400);
    }
    const validTypes: ExplanationType[] = ['analogy', 'diagram', 'misconception_contrast', 'worked_example'];
    if (!validTypes.includes(type)) {
      return c.json({ error: `explanation_type must be one of: ${validTypes.join(', ')}` }, 400);
    }

    const result = await getOrGenerateVisual(c.env, {
      concept,
      explanation_type: type,
      content_id: body.content_id ?? null,
      prefer_new_variant: !!body.prefer_new_variant,
      user_id: userId ?? undefined,
      prompt: body.prompt ? String(body.prompt) : undefined,
      aspect_ratio: body.aspect_ratio,
    });

    return c.json(result);
  } catch (e: any) {
    console.error('visual get-or-generate error:', e);
    return c.json({ error: e?.message || 'Failed to generate visual' }, 500);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/visual/:id/feedback
//
// Body: { feedback: 'helpful' | 'not_helpful' }
//
// Captures 👍/👎 from students. Feeds retirement decisions later.
// ─────────────────────────────────────────────────────────────
visualRoutes.post('/:id/feedback', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw, c.env);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const visualId = parseInt(c.req.param('id'), 10);
    if (!Number.isFinite(visualId) || visualId <= 0) {
      return c.json({ error: 'Invalid visual ID' }, 400);
    }

    const body = await c.req.json().catch(() => ({})) as any;
    const fb = String(body.feedback || '');
    if (fb !== 'helpful' && fb !== 'not_helpful') {
      return c.json({ error: 'feedback must be "helpful" or "not_helpful"' }, 400);
    }

    await recordFeedback(c.env, user.id, visualId, fb as 'helpful' | 'not_helpful');
    return c.json({ status: 'ok' });
  } catch (e: any) {
    console.error('visual feedback error:', e);
    return c.json({ error: e?.message || 'Failed to record feedback' }, 500);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/visual/list
//
// Admin-only: browse the cache. Teacher+ role required.
// Query: ?concept=inference&type=analogy&limit=50
// ─────────────────────────────────────────────────────────────
visualRoutes.get('/list', async (c) => {
  const auth = await checkAdminAuth(c);
  if (!auth.ok) return c.json({ error: 'Unauthorized', message: 'Provide X-API-Key header or teacher/admin JWT' }, 401);
  const concept = c.req.query('concept') || undefined;
  const type = (c.req.query('type') as ExplanationType) || undefined;
  const limit = parseInt(c.req.query('limit') || '50', 10) || 50;
  const rows = await listVisuals(c.env, { concept, type, limit });
  return c.json({ visuals: rows });
});

// ─────────────────────────────────────────────────────────────
// POST /api/visual/:id/retire
//
// Admin-only: soft-remove a bad variant from future selection.
// ─────────────────────────────────────────────────────────────
visualRoutes.post('/:id/retire', async (c) => {
  const auth = await checkAdminAuth(c);
  if (!auth.ok) return c.json({ error: 'Unauthorized', message: 'Provide X-API-Key header or teacher/admin JWT' }, 401);
  const visualId = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(visualId) || visualId <= 0) {
    return c.json({ error: 'Invalid visual ID' }, 400);
  }
  await retireVisual(c.env, visualId);
  return c.json({ status: 'ok' });
});
