import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';
import { submitRealScore, computeCalibration } from '../services/calibration';

export const calibrationRoutes = new Hono<{ Bindings: Env }>();

async function requireAdmin(c: any) {
  const apiKey = c.req.header('X-API-Key') || c.req.header('x-admin-secret');
  if (apiKey && (apiKey === c.env.ADMIN_API_KEY || apiKey === c.env.ADMIN_SECRET)) {
    return { id: 0, role: 'api' };
  }
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) return null;
  return user;
}

// POST /api/calibration/real-score — student submits real test score
calibrationRoutes.post('/real-score', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid JSON' }, 400); }

  const testType = String(body.test_type || '').trim();
  const realOverall = Number(body.real_overall_score);

  if (!testType) return c.json({ error: 'test_type required' }, 400);
  if (!['IELTS', 'TOEFL_IBT', 'TOEIC', 'TOEFL_ITP'].includes(testType)) {
    return c.json({ error: 'invalid test_type' }, 400);
  }
  if (!Number.isFinite(realOverall) || realOverall < 0 || realOverall > 120) {
    return c.json({ error: 'real_overall_score must be between 0 and 120' }, 400);
  }
  // IELTS band 0-9, TOEFL iBT 0-120, TOEIC 10-990 — accept broadly, validate per-type
  if (testType === 'IELTS' && realOverall > 9) {
    return c.json({ error: 'IELTS overall must be 0-9' }, 400);
  }

  const result = await submitRealScore(c.env, {
    userId: user.id,
    testType,
    realOverall,
    realReading: body.real_reading !== undefined ? Number(body.real_reading) : undefined,
    realListening: body.real_listening !== undefined ? Number(body.real_listening) : undefined,
    realSpeaking: body.real_speaking !== undefined ? Number(body.real_speaking) : undefined,
    realWriting: body.real_writing !== undefined ? Number(body.real_writing) : undefined,
    testTakenAt: body.test_taken_at ? String(body.test_taken_at) : undefined,
  });

  return c.json({
    ok: true,
    id: result.id,
    bot_prediction: result.predicted,
    delta: result.predicted.overall !== null ? realOverall - result.predicted.overall : null,
  });
});

// GET /api/calibration/my-scores — user's own submissions
calibrationRoutes.get('/my-scores', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM real_test_scores WHERE user_id = ?
      ORDER BY reported_at DESC LIMIT 50`,
  ).bind(user.id).all();
  return c.json({ scores: results || [] });
});

// ─── Admin-only ───────────────────────────────────────

// GET /api/calibration/summary?test_type=IELTS
calibrationRoutes.get('/summary', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const testType = c.req.query('test_type');

  let sql = `SELECT * FROM calibration_snapshots WHERE 1=1`;
  const params: any[] = [];
  if (testType) { sql += ' AND test_type = ?'; params.push(testType); }
  sql += ' ORDER BY snapshot_at DESC LIMIT 20';

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ snapshots: results || [] });
});

// POST /api/calibration/compute — recompute snapshot
calibrationRoutes.post('/compute', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const testType = c.req.query('test_type') || undefined;
  const snapshots = await computeCalibration(c.env, testType);
  return c.json({ ok: true, snapshots });
});

// GET /api/calibration/pairs?test_type=IELTS — raw pairs for scatter plot
calibrationRoutes.get('/pairs', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const testType = c.req.query('test_type');
  let sql = `SELECT id, user_id, test_type, bot_predicted_overall, real_overall_score,
                    reported_at, verification_status
               FROM real_test_scores
              WHERE bot_predicted_overall IS NOT NULL`;
  const params: any[] = [];
  if (testType) { sql += ' AND test_type = ?'; params.push(testType); }
  sql += ' ORDER BY reported_at DESC LIMIT 1000';

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ pairs: results || [] });
});

// PATCH /api/calibration/verify/:id — admin marks score as verified/flagged
calibrationRoutes.patch('/verify/:id', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);
  const id = Number(c.req.param('id'));

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid JSON' }, 400); }

  const status = String(body.verification_status || '');
  if (!['unverified', 'verified', 'flagged'].includes(status)) {
    return c.json({ error: 'invalid verification_status' }, 400);
  }
  const note = body.verification_note ? String(body.verification_note).slice(0, 500) : null;

  await c.env.DB.prepare(
    `UPDATE real_test_scores
        SET verification_status = ?, verification_note = COALESCE(?, verification_note)
      WHERE id = ?`,
  ).bind(status, note, id).run();

  return c.json({ ok: true });
});
