import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';

export const contentReportsRoutes = new Hono<{ Bindings: Env }>();

const VALID_REASONS = new Set([
  'wrong_answer',
  'broken_audio',
  'confusing_question',
  'broken_options',
  'typo',
  'other',
]);

const VALID_STATUSES = new Set(['open', 'triaged', 'fixed', 'invalid']);

// ---- POST /api/content-reports ----------------------------------------
// Submit a new report. Any authenticated user can call this.
// Rate limit: max 20 reports / user / hour to prevent abuse.
contentReportsRoutes.post('/', async (c) => {
  try {
    let body: any;
    try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

    // Body might include a tg_id fallback (see ReportIssueButton). The
    // standard path through getAuthUser (JWT or headers or ?tg_id query
    // param) already handles most cases, but after a long session the JWT
    // expires and initData stops being valid — we don't want the user to
    // lose their feedback just because their auth quietly rolled over.
    let user = await getAuthUser(c.req.raw, c.env);
    if (!user && body?.tg_id) {
      const cleanId = String(body.tg_id).replace('.0', '');
      try {
        user = await c.env.DB.prepare('SELECT * FROM users WHERE telegram_id = ?').bind(cleanId).first() as any;
        if (!user) {
          const tgIdInt = parseInt(cleanId);
          if (!isNaN(tgIdInt)) {
            user = await c.env.DB.prepare('SELECT * FROM users WHERE telegram_id = ?').bind(tgIdInt).first() as any;
          }
        }
      } catch { /* fall through to 401 */ }
    }
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const contentId = Number(body.content_id);
    if (!Number.isFinite(contentId) || contentId <= 0) {
      return c.json({ error: 'content_id is required' }, 400);
    }

    const reason = String(body.reason_code || '').trim();
    if (!VALID_REASONS.has(reason)) {
      return c.json({ error: `reason_code must be one of: ${[...VALID_REASONS].join(', ')}` }, 400);
    }

    const subIndex = body.sub_index == null ? null : Number(body.sub_index);
    const freeText = body.free_text ? String(body.free_text).slice(0, 1000) : null;
    const attemptId = body.attempt_id == null ? null : Number(body.attempt_id);

    // Rate limit: 20 reports / hour / user — wrapped in try/catch so a
    // missing table (migration not applied) or a transient D1 error doesn't
    // nuke the whole submission. Rate limiting is a defense-in-depth check,
    // not a correctness invariant, so skipping it on error is acceptable.
    try {
      const row = await c.env.DB.prepare(
        `SELECT COUNT(*) AS count FROM content_reports WHERE user_id = ? AND created_at > datetime('now', '-1 hour')`,
      ).bind(user.id).first<any>();
      const count = Number(row?.count ?? 0);
      if (count >= 20) {
        return c.json({ error: 'Rate limit exceeded — please try again in an hour' }, 429);
      }
    } catch (e) {
      console.warn('[content-reports] rate-limit query failed, skipping:', e);
    }

    // Best-effort lookup for section/question_type — some synthetic questions
    // (prefetched from JSON, not test_contents rows) won't match. Store the
    // report anyway with nulls for section/question_type rather than 404-ing
    // the user: if they hit "Laporkan masalah", something is wrong and we
    // want the report, even if we can't classify it.
    let section: string | null = null;
    let questionType: string | null = null;
    try {
      const row = await c.env.DB.prepare(
        `SELECT section, question_type FROM test_contents WHERE id = ?`,
      ).bind(contentId).first<any>();
      if (row) {
        section = row.section ?? null;
        questionType = row.question_type ?? null;
      }
    } catch (e) {
      console.warn('[content-reports] content lookup failed:', e);
    }

    const result = await c.env.DB.prepare(
      `INSERT INTO content_reports (content_id, sub_index, user_id, reason_code, free_text, section, question_type, attempt_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(contentId, subIndex, user.id, reason, freeText, section, questionType, attemptId).run();

    return c.json({ ok: true, id: result.meta.last_row_id });
  } catch (e: any) {
    // Surface the actual DB error to the client — previously this route
    // could silently return a 500 with no detail, making it un-debuggable.
    console.error('[content-reports] submission failed:', e);
    return c.json({
      error: 'Gagal menyimpan laporan',
      detail: e?.message || String(e),
    }, 500);
  }
});

// ---- Admin endpoints -----------------------------------------------------
// All admin endpoints require teacher/admin role OR ADMIN_API_KEY header.

async function requireAdmin(c: any) {
  const apiKey = c.req.header('X-API-Key') || c.req.header('x-admin-secret');
  if (apiKey && (apiKey === c.env.ADMIN_API_KEY || apiKey === c.env.ADMIN_SECRET)) return { id: 0, role: 'api' };
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return null;
  if (user.role !== 'admin' && user.role !== 'teacher') return null;
  return user;
}

// GET /api/content-reports/admin?status=open&limit=50
contentReportsRoutes.get('/admin', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const status = c.req.query('status') || 'open';
  const limit = Math.min(200, parseInt(c.req.query('limit') || '50'));
  const offset = parseInt(c.req.query('offset') || '0');

  const { results } = await c.env.DB.prepare(
    `SELECT r.*, u.name AS reporter_name, u.telegram_id AS reporter_tg
       FROM content_reports r
       LEFT JOIN users u ON u.id = r.user_id
      WHERE r.status = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?`,
  ).bind(status, limit, offset).all();

  return c.json({ reports: results || [], status, limit, offset });
});

// GET /api/content-reports/admin/hotlist — items with 3+ reports
contentReportsRoutes.get('/admin/hotlist', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const { results } = await c.env.DB.prepare(
    `SELECT content_id, COUNT(*) AS report_count,
            GROUP_CONCAT(DISTINCT reason_code) AS reasons,
            MIN(created_at) AS first_reported,
            MAX(created_at) AS last_reported,
            MAX(section) AS section, MAX(question_type) AS question_type
       FROM content_reports
      WHERE status IN ('open', 'triaged')
      GROUP BY content_id
     HAVING report_count >= 3
      ORDER BY report_count DESC, last_reported DESC
      LIMIT 100`,
  ).all();

  return c.json({ hotlist: results || [] });
});

// PATCH /api/content-reports/admin/:id — update status
contentReportsRoutes.patch('/admin/:id', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);
  const id = Number(c.req.param('id'));

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const status = String(body.status || '').trim();
  if (!VALID_STATUSES.has(status)) {
    return c.json({ error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` }, 400);
  }

  const note = body.resolution_note ? String(body.resolution_note).slice(0, 1000) : null;
  const resolvedAt = status === 'open' ? null : new Date().toISOString();
  const resolvedBy = status === 'open' ? null : (actor.id || null);

  await c.env.DB.prepare(
    `UPDATE content_reports SET status = ?, resolution_note = ?, resolved_at = ?, resolved_by = ? WHERE id = ?`,
  ).bind(status, note, resolvedAt, resolvedBy, id).run();

  return c.json({ ok: true });
});
