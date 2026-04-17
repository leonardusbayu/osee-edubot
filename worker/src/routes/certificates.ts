// Certificate issuance + verification + battle pass routes.

import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';
import { checkPremium } from '../services/premium';

export const certificateRoutes = new Hono<{ Bindings: Env }>();

function generateHash(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function currentSeason(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  return `${wib.getFullYear()}-${String(wib.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Certificates ───────────────────────────────────────────────

// POST /api/certificates/check — check if user qualifies for a certificate
certificateRoutes.post('/check', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  // Must be premium to get certificates
  const premium = await checkPremium(c.env, user.id);
  if (!premium.is_premium) {
    return c.json({ eligible: false, reason: 'Premium required for certificates' });
  }

  const testType = user.target_test || 'TOEFL_IBT';

  // Get user's best score from finished attempts
  const best = await c.env.DB.prepare(
    `SELECT MAX(CAST(json_extract(metadata, '$.band_score') AS REAL)) AS best_band,
            MAX(CAST(json_extract(metadata, '$.total_score') AS REAL)) AS best_total
       FROM test_attempts
      WHERE user_id = ? AND test_type = ? AND status = 'completed'`,
  ).bind(user.id, testType).first<any>();

  const bestScore = best?.best_band || best?.best_total || 0;
  const targetScore = user.target_score || (testType === 'IELTS' ? 6.5 : 80);

  // Check if already has cert for this test type
  const existing = await c.env.DB.prepare(
    `SELECT * FROM certificates WHERE user_id = ? AND test_type = ? AND status = 'active' ORDER BY issued_at DESC LIMIT 1`,
  ).bind(user.id, testType).first<any>();

  const eligible = bestScore >= targetScore;

  return c.json({
    eligible,
    best_score: bestScore,
    target_score: targetScore,
    test_type: testType,
    existing_certificate: existing ? { hash_id: existing.hash_id, score: existing.score, issued_at: existing.issued_at } : null,
  });
});

// POST /api/certificates/issue — issue a new certificate
certificateRoutes.post('/issue', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const premium = await checkPremium(c.env, user.id);
  if (!premium.is_premium) {
    return c.json({ error: 'Premium required' }, 403);
  }

  const { test_type, score } = await c.req.json();
  if (!test_type || !score) return c.json({ error: 'Missing test_type or score' }, 400);

  // Validate score against user's actual best test score
  const best = await c.env.DB.prepare(
    `SELECT MAX(CAST(json_extract(metadata, '$.band_score') AS REAL)) AS best_band,
            MAX(CAST(json_extract(metadata, '$.total_score') AS REAL)) AS best_total
       FROM test_attempts
      WHERE user_id = ? AND test_type = ? AND status = 'completed'`,
  ).bind(user.id, test_type).first<any>();

  const bestScore = best?.best_band || best?.best_total || 0;
  const targetScore = user.target_score || (test_type === 'IELTS' ? 6.5 : 80);

  // Ensure score matches user's actual best score and meets target
  if (score !== bestScore) {
    return c.json({ error: 'Certificate score must match your best test score', requested: score, actual_best: bestScore }, 400);
  }
  if (score < targetScore) {
    return c.json({ error: 'Score does not meet target', score, target: targetScore }, 400);
  }

  const hashId = generateHash();
  await c.env.DB.prepare(
    `INSERT INTO certificates (user_id, test_type, score, target_score, hash_id)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(user.id, test_type, score, targetScore, hashId).run();

  return c.json({
    certificate: {
      hash_id: hashId,
      test_type,
      score,
      target_score: targetScore,
      verify_url: `https://edubot-api.edubot-leonardus.workers.dev/api/certificates/verify/${hashId}`,
      student_name: user.full_name || user.username || 'Student',
    },
  });
});

// GET /api/certificates/verify/:hash — public verification
certificateRoutes.get('/verify/:hash', async (c) => {
  const hash = c.req.param('hash');
  const cert = await c.env.DB.prepare(
    `SELECT c.*, u.full_name, u.username
       FROM certificates c
       JOIN users u ON u.id = c.user_id
      WHERE c.hash_id = ?`,
  ).bind(hash).first<any>();

  if (!cert) return c.json({ error: 'Certificate not found' }, 404);
  if (cert.status !== 'active') return c.json({ error: 'Certificate revoked', status: cert.status }, 410);

  return c.json({
    valid: true,
    student_name: cert.full_name || cert.username || 'Student',
    test_type: cert.test_type,
    score: cert.score,
    issued_at: cert.issued_at,
    hash_id: cert.hash_id,
  });
});

// GET /api/certificates/my — list user's certificates
certificateRoutes.get('/my', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM certificates WHERE user_id = ? ORDER BY issued_at DESC`,
  ).bind(user.id).all();

  return c.json({ certificates: results || [] });
});

// ─── Battle Pass ────────────────────────────────────────────────

// GET /api/certificates/battle-pass — get current season pass state
certificateRoutes.get('/battle-pass', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const season = currentSeason();

  // Ensure pass row
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO battle_pass (user_id, season) VALUES (?, ?)`,
  ).bind(user.id, season).run();

  const pass = await c.env.DB.prepare(
    `SELECT * FROM battle_pass WHERE user_id = ? AND season = ?`,
  ).bind(user.id, season).first<any>();

  const { results: rewards } = await c.env.DB.prepare(
    `SELECT * FROM battle_pass_rewards WHERE season = ? ORDER BY level, tier`,
  ).bind(season).all<any>();

  const currentLevel = pass?.current_level || 0;
  const xpPerLevel = 200; // XP needed per battle pass level
  const xpThisSeason = pass?.xp_this_season || 0;

  return c.json({
    season,
    tier: pass?.tier || 'free',
    current_level: currentLevel,
    xp_this_season: xpThisSeason,
    xp_to_next_level: xpPerLevel - (xpThisSeason % xpPerLevel),
    max_level: 5,
    rewards: rewards || [],
  });
});

// POST /api/certificates/battle-pass/upgrade — upgrade to premium pass (99 Stars)
certificateRoutes.post('/battle-pass/upgrade', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const season = currentSeason();
  await c.env.DB.prepare(
    `UPDATE battle_pass SET tier = 'premium', purchased_at = datetime('now')
      WHERE user_id = ? AND season = ?`,
  ).bind(user.id, season).run();

  return c.json({ ok: true, tier: 'premium', season });
});
