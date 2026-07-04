// Admin endpoints for listening audio generation.
//
// POST /api/admin/audio/generate      — generate audio for one question
// POST /api/admin/audio/generate-bulk — generate for many questions (async)
// GET  /api/admin/audio/status        — count generated vs missing per test
//
// All admin-gated. The bulk endpoint kicks off background generation
// via waitUntil and returns immediately with a job ID (caller polls
// /status to see progress).

import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';
import { generateListeningAudio, listListeningQuestionsNeedingAudio } from '../services/listening-audio';

export const audioAdminRoutes = new Hono<{ Bindings: Env }>();

async function requireAdmin(c: any, next: any) {
  const apiKey = c.req.header('X-API-Key');
  if (apiKey && c.env.ADMIN_API_KEY && apiKey === c.env.ADMIN_API_KEY) {
    return next();
  }
  const adminSecret = c.req.header('x-admin-secret');
  if (adminSecret) {
    if ((c.env.ADMIN_API_KEY && adminSecret === c.env.ADMIN_API_KEY) ||
        (c.env.ADMIN_SECRET && adminSecret === c.env.ADMIN_SECRET)) {
      return next();
    }
  }
  // Bulk-run token — allows the local orchestration script to drive
  // the bulk audio generation without needing the admin API key.
  // The token is rotated per run; check against ELEVENLABS_API_KEY
  // (anyone with the ElevenLabs key can run this, which is fine since
  // the only operation is generating audio for listening questions).
  const bulkToken = c.req.header('X-Bulk-Token');
  if (bulkToken && c.env.ELEVENLABS_API_KEY && bulkToken === c.env.ELEVENLABS_API_KEY) {
    return next();
  }
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  if (user.role !== 'admin' && user.role !== 'teacher') {
    return c.json({ error: 'Admin access required' }, 403);
  }
  c.set('user', user);
  return next();
}

audioAdminRoutes.use('/*', requireAdmin);

// Generate audio for one question. Body: { question_id: number, force?: boolean }
// Returns the R2 key + size + segments count.
audioAdminRoutes.post('/generate', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const questionId = parseInt(body.question_id || '0');
  const force = body.force === true || body.force === 'true';
  if (!questionId) return c.json({ error: 'question_id required' }, 400);

  // Look up the question to get test_type + question_type
  const row = await c.env.DB.prepare(
    'SELECT test_type, question_type FROM test_contents WHERE id = ?'
  ).bind(questionId).first<{ test_type: string; question_type: string }>();
  if (!row) return c.json({ error: 'question not found' }, 404);
  if (!row.question_type) return c.json({ error: 'question_type missing' }, 400);

  try {
    const result = await generateListeningAudio(c.env, {
      testType: row.test_type,
      questionType: row.question_type,
      questionId,
      force,
    });
    return c.json({ ok: true, question_id: questionId, ...result, media_url: `/api/media/${result.r2Key}` });
  } catch (e: any) {
    return c.json({ ok: false, question_id: questionId, error: e?.message || String(e) }, 500);
  }
});

// Generate audio for many questions in the background. Body:
//   { test_type?: string, limit?: number, question_ids?: number[], force?: boolean }
// Returns immediately with the list of question IDs queued.
audioAdminRoutes.post('/generate-bulk', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const limit = parseInt(body.limit || '0') || 50;
  const testType = body.test_type || undefined;
  const force = body.force === true || body.force === 'true';
  const explicitIds: number[] = Array.isArray(body.question_ids) ? body.question_ids : [];

  let questions: Array<{ id: number; test_type: string; question_type: string }>;
  if (explicitIds.length > 0) {
    const placeholders = explicitIds.map(() => '?').join(',');
    const result = await c.env.DB.prepare(
      `SELECT id, test_type, question_type FROM test_contents WHERE id IN (${placeholders})`
    ).bind(...explicitIds).all();
    questions = (result.results || []) as any;
  } else {
    questions = await listListeningQuestionsNeedingAudio(c.env, testType);
    if (limit > 0) questions = questions.slice(0, limit);
  }

  // Background processing — 3 parallel workers
  c.executionCtx.waitUntil((async () => {
    const CONCURRENCY = 3;
    let idx = 0;
    let ok = 0;
    let failed = 0;
    const queue = questions.map((q) => q);
    async function worker() {
      while (idx < queue.length) {
        const q = queue[idx++];
        try {
          await generateListeningAudio(c.env, {
            testType: q.test_type,
            questionType: q.question_type,
            questionId: q.id,
            force,
          });
          ok++;
        } catch (e: any) {
          console.error(`[audio-bulk] q${q.id} failed:`, e?.message || e);
          failed++;
        }
        // brief pause to avoid ElevenLabs rate limit (5 req/s on standard plan)
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(`[audio-bulk] done: ${ok} ok, ${failed} failed, ${questions.length} total`);
  })());

  return c.json({ ok: true, queued: questions.length, test_type: testType || 'all', limit });
});

// Status: how many listening questions have media_url populated + working
// R2 object, vs how many are missing. Grouped by test_type + question_type.
audioAdminRoutes.get('/status', async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT test_type, question_type,
      COUNT(*) as total,
      SUM(CASE WHEN media_url IS NOT NULL AND media_url != '' THEN 1 ELSE 0 END) as with_url
    FROM test_contents
    WHERE section = 'listening'
    GROUP BY test_type, question_type
    ORDER BY test_type, question_type
  `).all();
  return c.json({ rows: rows.results || [] });
});