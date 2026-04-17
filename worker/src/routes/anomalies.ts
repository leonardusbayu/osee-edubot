import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';
import { runAnomalyDetection } from '../services/anomaly-detector';
import { runItemAnalysis } from '../services/item-analyzer';

export const anomaliesRoutes = new Hono<{ Bindings: Env }>();

async function requireAdmin(c: any) {
  const apiKey = c.req.header('X-API-Key') || c.req.header('x-admin-secret');
  if (apiKey && (apiKey === c.env.ADMIN_API_KEY || apiKey === c.env.ADMIN_SECRET)) {
    return { id: 0, role: 'api' };
  }
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return null;
  if (user.role !== 'admin' && user.role !== 'teacher') return null;
  return user;
}

// GET /api/anomalies?status=open&flag_type=low_accuracy&severity=high
anomaliesRoutes.get('/', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const status = c.req.query('status') || 'open';
  const flagType = c.req.query('flag_type');
  const severity = c.req.query('severity');
  const section = c.req.query('section');
  const limit = Math.min(500, parseInt(c.req.query('limit') || '100'));

  let sql = `SELECT a.*, tc.title AS content_title, tc.test_type
               FROM content_anomalies a
          LEFT JOIN test_contents tc ON tc.id = a.content_id
              WHERE a.status = ?`;
  const params: any[] = [status];

  if (flagType) { sql += ' AND a.flag_type = ?'; params.push(flagType); }
  if (severity) { sql += ' AND a.severity = ?'; params.push(severity); }
  if (section)  { sql += ' AND a.section = ?'; params.push(section); }

  sql += ` ORDER BY
            CASE a.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
            a.detected_at DESC
           LIMIT ?`;
  params.push(limit);

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ anomalies: results || [], filters: { status, flag_type: flagType, severity, section } });
});

// POST /api/anomalies/run — manually trigger detection (admin only)
anomaliesRoutes.post('/run', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const days = parseInt(c.req.query('days') || '30');
  const result = await runAnomalyDetection(c.env, days);
  return c.json({ ok: true, ...result });
});

// PATCH /api/anomalies/:id — update status or add note
anomaliesRoutes.patch('/:id', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);
  const id = Number(c.req.param('id'));

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const status = body.status ? String(body.status).trim() : null;
  const notes = body.notes ? String(body.notes).slice(0, 1000) : null;

  const validStatuses = new Set(['open', 'acknowledged', 'resolved', 'false_positive']);
  if (status && !validStatuses.has(status)) {
    return c.json({ error: 'invalid status' }, 400);
  }

  const resolvedAt = status && status !== 'open' ? new Date().toISOString() : null;
  const resolvedBy = status && status !== 'open' ? (actor.id || null) : null;

  await c.env.DB.prepare(
    `UPDATE content_anomalies
        SET status = COALESCE(?, status),
            notes = COALESCE(?, notes),
            resolved_at = COALESCE(?, resolved_at),
            resolved_by = COALESCE(?, resolved_by)
      WHERE id = ?`,
  ).bind(status, notes, resolvedAt, resolvedBy, id).run();

  return c.json({ ok: true });
});

// ─────────────────── Item analysis (answer-key sanity) ───────────────────

// POST /api/anomalies/item-analysis/run
anomaliesRoutes.post('/item-analysis/run', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);
  const result = await runItemAnalysis(c.env);
  return c.json({ ok: true, ...result });
});

// GET /api/anomalies/item-analysis?status=open&flag_type=likely_miskeyed
anomaliesRoutes.get('/item-analysis', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const status = c.req.query('status') || 'open';
  const flagType = c.req.query('flag_type');
  const severity = c.req.query('severity');
  const limit = Math.min(500, parseInt(c.req.query('limit') || '100'));

  let sql = `SELECT f.*, tc.title AS content_title, tc.test_type
               FROM item_analysis_findings f
          LEFT JOIN test_contents tc ON tc.id = f.content_id
              WHERE f.status = ?`;
  const params: any[] = [status];
  if (flagType) { sql += ' AND f.flag_type = ?'; params.push(flagType); }
  if (severity) { sql += ' AND f.severity = ?'; params.push(severity); }
  sql += ` ORDER BY
             CASE f.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
             f.discrimination ASC
           LIMIT ?`;
  params.push(limit);

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ findings: results || [] });
});

// PATCH /api/anomalies/item-analysis/:id
anomaliesRoutes.patch('/item-analysis/:id', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);
  const id = Number(c.req.param('id'));

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid JSON' }, 400); }
  const status = body.status ? String(body.status) : null;
  const notes = body.notes ? String(body.notes).slice(0, 1000) : null;

  const valid = new Set(['open', 'acknowledged', 'resolved', 'false_positive']);
  if (status && !valid.has(status)) return c.json({ error: 'invalid status' }, 400);

  const resolvedAt = status && status !== 'open' ? new Date().toISOString() : null;
  const resolvedBy = status && status !== 'open' ? ((actor as any).id || null) : null;

  await c.env.DB.prepare(
    `UPDATE item_analysis_findings
        SET status = COALESCE(?, status),
            notes = COALESCE(?, notes),
            resolved_at = COALESCE(?, resolved_at),
            resolved_by = COALESCE(?, resolved_by)
      WHERE id = ?`,
  ).bind(status, notes, resolvedAt, resolvedBy, id).run();

  return c.json({ ok: true });
});

// GET /api/anomalies/summary — counts by flag_type + severity for dashboard
anomaliesRoutes.get('/summary', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const { results } = await c.env.DB.prepare(
    `SELECT flag_type, severity, status, COUNT(*) AS count
       FROM content_anomalies
      WHERE detected_at > datetime('now', '-30 days')
      GROUP BY flag_type, severity, status
      ORDER BY flag_type, severity`,
  ).all();

  const lastRun = await c.env.DB.prepare(
    `SELECT MAX(detected_at) AS last_run FROM content_anomalies`,
  ).first<any>();

  return c.json({ summary: results || [], last_run: lastRun?.last_run || null });
});
