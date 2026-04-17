import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';
import { runContentAudit } from '../services/content-auditor';
import { runAiQualitySampler } from '../services/ai-quality-sampler';
import { runScoringReliability } from '../services/scoring-reliability';
import { runRetestReliability } from '../services/retest-reliability';
import { runWhisperQa } from '../services/whisper-qa';
import { runSloSnapshot } from '../services/op-slo';

export const auditRoutes = new Hono<{ Bindings: Env }>();

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

// POST /api/audit/run — trigger a full audit pass
auditRoutes.post('/run', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const notes = c.req.query('notes') || `manual-run by user=${(actor as any).id || 'api'}`;
  const result = await runContentAudit(c.env, { notes });
  return c.json({ ok: true, ...result });
});

// GET /api/audit/runs — list recent runs
auditRoutes.get('/runs', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM content_audit_runs ORDER BY started_at DESC LIMIT 50`,
  ).all();
  return c.json({ runs: results || [] });
});

// GET /api/audit/findings?issue_code=empty_option&severity=high&limit=100
auditRoutes.get('/findings', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const issueCode = c.req.query('issue_code');
  const severity = c.req.query('severity');
  const section = c.req.query('section');
  const limit = Math.min(500, parseInt(c.req.query('limit') || '100'));

  let sql = `SELECT f.*, tc.title AS content_title, tc.test_type
               FROM content_audit_findings f
          LEFT JOIN test_contents tc ON tc.id = f.content_id
              WHERE 1=1`;
  const params: any[] = [];
  if (issueCode) { sql += ' AND f.issue_code = ?'; params.push(issueCode); }
  if (severity)  { sql += ' AND f.severity = ?'; params.push(severity); }
  if (section)   { sql += ' AND f.section = ?'; params.push(section); }
  sql += ` ORDER BY
             CASE f.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
             f.content_id ASC
           LIMIT ?`;
  params.push(limit);

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ findings: results || [], filters: { issue_code: issueCode, severity, section } });
});

// ──────────────────────────── AI quality sampler ────────────────────────────

// POST /api/audit/ai-quality/run?sample=50
auditRoutes.post('/ai-quality/run', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const sampleSize = Math.min(200, Math.max(5, parseInt(c.req.query('sample') || '50')));
  try {
    const result = await runAiQualitySampler(c.env, {
      sampleSize,
      notes: `manual-run by user=${(actor as any).id || 'api'}`,
    });
    return c.json({ ok: true, ...result });
  } catch (e: any) {
    return c.json({ error: e?.message || 'sampler failed' }, 500);
  }
});

// GET /api/audit/ai-quality/runs
auditRoutes.get('/ai-quality/runs', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM content_ai_score_runs ORDER BY started_at DESC LIMIT 50`,
  ).all();
  return c.json({ runs: results || [] });
});

// GET /api/audit/ai-quality/scores?verdict=fail&run_id=N&limit=100
auditRoutes.get('/ai-quality/scores', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const verdict = c.req.query('verdict');
  const runId = c.req.query('run_id');
  const limit = Math.min(500, parseInt(c.req.query('limit') || '100'));

  let sql = `SELECT s.*, tc.title AS content_title, tc.test_type
               FROM content_ai_scores s
          LEFT JOIN test_contents tc ON tc.id = s.content_id
              WHERE 1=1`;
  const params: any[] = [];
  if (verdict) { sql += ' AND s.verdict = ?'; params.push(verdict); }
  if (runId)   { sql += ' AND s.run_id = ?'; params.push(Number(runId)); }
  sql += ' ORDER BY s.overall_score ASC, s.created_at DESC LIMIT ?';
  params.push(limit);

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ scores: results || [] });
});

// ──────────────────────── Scoring reliability (writing/speaking) ────────────────────────

// POST /api/audit/reliability/run?kind=writing|speaking&sample=15&regrades=3
auditRoutes.post('/reliability/run', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const kind = (c.req.query('kind') || 'writing') as 'writing' | 'speaking';
  if (kind !== 'writing' && kind !== 'speaking') {
    return c.json({ error: 'kind must be writing or speaking' }, 400);
  }
  const sampleSize = Math.min(100, Math.max(3, parseInt(c.req.query('sample') || '15')));
  const regrades = Math.min(7, Math.max(2, parseInt(c.req.query('regrades') || '3')));

  try {
    const result = await runScoringReliability(c.env, {
      kind,
      sampleSize,
      regrades,
      notes: `manual-run by user=${(actor as any).id || 'api'}`,
    });
    return c.json({ ok: true, ...result });
  } catch (e: any) {
    return c.json({ error: e?.message || 'run failed' }, 500);
  }
});

// GET /api/audit/reliability/runs?kind=writing
auditRoutes.get('/reliability/runs', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const kind = c.req.query('kind');
  let sql = `SELECT * FROM scoring_reliability_runs WHERE 1=1`;
  const params: any[] = [];
  if (kind) { sql += ' AND kind = ?'; params.push(kind); }
  sql += ' ORDER BY started_at DESC LIMIT 50';

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ runs: results || [] });
});

// GET /api/audit/reliability/samples?run_id=N
auditRoutes.get('/reliability/samples', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const runId = c.req.query('run_id');
  if (!runId) return c.json({ error: 'run_id required' }, 400);

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM scoring_reliability_samples
      WHERE run_id = ?
      ORDER BY stddev DESC LIMIT 500`,
  ).bind(Number(runId)).all();
  return c.json({ samples: results || [] });
});

// ──────────────────────── Test-retest reliability ────────────────────────

// POST /api/audit/retest/run?window_hours=168
auditRoutes.post('/retest/run', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);
  const windowHours = Math.min(720, Math.max(1, parseInt(c.req.query('window_hours') || '168')));
  const r = await runRetestReliability(c.env, windowHours);
  return c.json({ ok: true, ...r });
});

// GET /api/audit/retest/snapshots?test_type=IELTS
auditRoutes.get('/retest/snapshots', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const testType = c.req.query('test_type');
  let sql = `SELECT * FROM test_retest_snapshots WHERE 1=1`;
  const params: any[] = [];
  if (testType) { sql += ' AND test_type = ?'; params.push(testType); }
  sql += ' ORDER BY snapshot_at DESC LIMIT 50';

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ snapshots: results || [] });
});

// GET /api/audit/retest/pairs?flag=unreliable&test_type=IELTS
auditRoutes.get('/retest/pairs', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const flag = c.req.query('flag');
  const testType = c.req.query('test_type');
  let sql = `SELECT * FROM test_retest_pairs WHERE 1=1`;
  const params: any[] = [];
  if (flag) { sql += ' AND flag = ?'; params.push(flag); }
  if (testType) { sql += ' AND test_type = ?'; params.push(testType); }
  sql += ' ORDER BY abs_delta DESC LIMIT 200';

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ pairs: results || [] });
});

// ──────────────────────── Whisper transcription QA ────────────────────────

// POST /api/audit/whisper-qa/run?lookback_days=30
auditRoutes.post('/whisper-qa/run', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const lookbackDays = Math.min(180, Math.max(1, parseInt(c.req.query('lookback_days') || '30')));
  try {
    const result = await runWhisperQa(c.env, {
      lookbackDays,
      notes: `manual-run by user=${(actor as any).id || 'api'}`,
    });
    return c.json({ ok: true, ...result });
  } catch (e: any) {
    return c.json({ error: e?.message || 'whisper-qa failed' }, 500);
  }
});

// GET /api/audit/whisper-qa/runs
auditRoutes.get('/whisper-qa/runs', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM whisper_qa_runs ORDER BY started_at DESC LIMIT 50`,
  ).all();
  return c.json({ runs: results || [] });
});

// GET /api/audit/whisper-qa/flags?status=open&flag_code=high_repetition&limit=100
auditRoutes.get('/whisper-qa/flags', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const status = c.req.query('status') || 'open';
  const flagCode = c.req.query('flag_code');
  const severity = c.req.query('severity');
  const limit = Math.min(500, parseInt(c.req.query('limit') || '100'));

  let sql = `SELECT f.*,
                    s.user_id AS user_id,
                    s.prompt AS prompt,
                    s.test_type AS test_type,
                    s.score AS score,
                    substr(s.transcription, 1, 300) AS transcription_preview
               FROM whisper_qa_flags f
          LEFT JOIN speaking_sessions s ON s.id = f.speaking_session_id
              WHERE f.status = ?`;
  const params: any[] = [status];
  if (flagCode) { sql += ' AND f.flag_code = ?'; params.push(flagCode); }
  if (severity) { sql += ' AND f.severity = ?'; params.push(severity); }
  sql += ` ORDER BY
             CASE f.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
             f.detected_at DESC
           LIMIT ?`;
  params.push(limit);

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ flags: results || [] });
});

// PATCH /api/audit/whisper-qa/flags/:id — set status (open|resolved|ignored)
auditRoutes.patch('/whisper-qa/flags/:id', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const status = String(body?.status || '');
  if (!['open', 'resolved', 'ignored'].includes(status)) {
    return c.json({ error: 'status must be open|resolved|ignored' }, 400);
  }
  await c.env.DB.prepare(
    `UPDATE whisper_qa_flags SET status = ? WHERE id = ?`,
  ).bind(status, id).run();
  return c.json({ ok: true });
});

// ──────────────────────── Operational SLO ────────────────────────

// POST /api/audit/slo/run — snapshot and evaluate alerts
auditRoutes.post('/slo/run', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);
  try {
    const r = await runSloSnapshot(c.env);
    return c.json({ ok: true, ...r });
  } catch (e: any) {
    return c.json({ error: e?.message || 'slo run failed' }, 500);
  }
});

// GET /api/audit/slo/snapshots?limit=100
auditRoutes.get('/slo/snapshots', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const limit = Math.min(500, parseInt(c.req.query('limit') || '100'));
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM system_slo_snapshots ORDER BY snapshot_at DESC LIMIT ?`,
  ).bind(limit).all();
  return c.json({ snapshots: results || [] });
});

// GET /api/audit/slo/alerts?state=firing&metric=error_rate
auditRoutes.get('/slo/alerts', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const state = c.req.query('state');
  const metric = c.req.query('metric');
  const limit = Math.min(500, parseInt(c.req.query('limit') || '100'));

  let sql = `SELECT * FROM system_slo_alerts WHERE 1=1`;
  const params: any[] = [];
  if (state) { sql += ' AND state = ?'; params.push(state); }
  if (metric) { sql += ' AND metric = ?'; params.push(metric); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ alerts: results || [] });
});

// GET /api/audit/slo/health — current status + recent firing alerts
auditRoutes.get('/slo/health', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const latest = await c.env.DB.prepare(
    `SELECT * FROM system_slo_snapshots ORDER BY snapshot_at DESC LIMIT 1`,
  ).first<any>();

  const { results: firing } = await c.env.DB.prepare(
    `SELECT metric, severity, current_value, baseline_value, threshold, detail, created_at
       FROM system_slo_alerts
      WHERE state = 'firing'
        AND created_at > datetime('now', '-2 hours')
      ORDER BY created_at DESC`,
  ).all<any>();

  return c.json({
    latest_snapshot: latest || null,
    active_alerts: firing || [],
    healthy: (firing?.length || 0) === 0,
  });
});

// GET /api/audit/summary — latest run breakdown for dashboard
auditRoutes.get('/summary', async (c) => {
  const actor = await requireAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const latest = await c.env.DB.prepare(
    `SELECT * FROM content_audit_runs
      WHERE finished_at IS NOT NULL
      ORDER BY started_at DESC LIMIT 1`,
  ).first<any>();

  let breakdown: Record<string, number> = {};
  if (latest?.breakdown) {
    try { breakdown = JSON.parse(latest.breakdown); } catch {}
  }

  return c.json({
    latest_run: latest ? {
      id: latest.id,
      started_at: latest.started_at,
      finished_at: latest.finished_at,
      scanned: latest.scanned_count,
      errors: latest.error_count,
      warnings: latest.warning_count,
      healthy: latest.healthy_count,
      breakdown,
    } : null,
  });
});
