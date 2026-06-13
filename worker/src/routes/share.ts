/**
 * Shareable score-card route (MASTER_PLAN.md Phase 5.1).
 *
 * GET /api/share/card?tg_id=123456789
 *   → 1080x1080 SVG achievement card with the student's referral deep
 *     link baked in. Students share it to IG/WA status; every signup
 *     through the link credits their referral.
 *
 * Anonymous access is intentional — the card only exposes first name,
 * an estimated score, and a streak count (all things the student is
 * actively choosing to broadcast). No auth header survives a share to
 * Instagram anyway.
 *
 * Wiring: mount in worker/src/index.ts as
 *   app.route('/api/share', shareRoutes)
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { generateScoreCardSvg } from '../services/share-card';

export const shareRoutes = new Hono<{ Bindings: Env }>();

// NOTE: the codebase references two bot usernames
// (OSEE_TOEFL_IELTS_TOEIC_study_bot in tests.ts/speaking.ts upgrade URLs,
// osee_IBT_IELTS_tutor_bot in the /referral flow). This uses the former —
// keep in sync if the canonical username is consolidated.
const BOT_USERNAME = 'OSEE_TOEFL_IELTS_TOEIC_study_bot';

const TEST_LABELS: Record<string, string> = {
  IELTS: 'IELTS',
  TOEFL_IBT: 'TOEFL iBT',
  TOEFL_ITP: 'TOEFL ITP',
  TOEIC: 'TOEIC',
};

function formatScoreLabel(score: number, scale: string, testType: string): string {
  const label = TEST_LABELS[testType] || testType;
  return scale === 'ielts_band'
    ? `${label} ${Number(score).toFixed(1)}`
    : `${label} ${Math.round(Number(score))}`;
}

/** Parse SQLite "YYYY-MM-DD HH:MM:SS" (UTC) into epoch ms, null on failure. */
function parseSqliteUtc(s: unknown): number | null {
  if (!s) return null;
  const str = String(s).replace(' ', 'T');
  const t = Date.parse(/Z$|[+-]\d{2}:\d{2}$/.test(str) ? str : str + 'Z');
  return Number.isFinite(t) ? t : null;
}

shareRoutes.get('/card', async (c) => {
  try {
    const tgId = parseInt(c.req.query('tg_id') || '', 10);
    if (!Number.isFinite(tgId) || tgId <= 0) {
      return c.json({ error: 'tg_id query param required' }, 400);
    }

    let user = await c.env.DB.prepare(
      'SELECT id, telegram_id, name, target_test, referral_code, current_streak FROM users WHERE telegram_id = ?'
    ).bind(tgId).first() as any;
    if (!user) {
      // Legacy rows store telegram_id as TEXT with a ".0" suffix — same
      // fallback auth.ts uses.
      user = await c.env.DB.prepare(
        'SELECT id, telegram_id, name, target_test, referral_code, current_streak FROM users WHERE telegram_id = ?'
      ).bind(`${tgId}.0`).first() as any;
    }
    if (!user) return c.json({ error: 'User not found' }, 404);

    // ── Latest score estimate: target test first, then any test type ──
    let scoreRow: any = null;
    try {
      if (user.target_test) {
        scoreRow = await c.env.DB.prepare(
          `SELECT estimated_score, score_scale, test_type FROM score_estimates
           WHERE user_id = ? AND test_type = ?
           ORDER BY snapshot_date DESC, id DESC LIMIT 1`
        ).bind(user.id, user.target_test).first();
      }
      if (!scoreRow) {
        scoreRow = await c.env.DB.prepare(
          `SELECT estimated_score, score_scale, test_type FROM score_estimates
           WHERE user_id = ?
           ORDER BY snapshot_date DESC, id DESC LIMIT 1`
        ).bind(user.id).first();
      }
    } catch (e) {
      console.error('[share-card] score_estimates lookup failed:', (e as any)?.message || e);
    }

    // No snapshot yet → compute live (best-effort). Card without a score
    // is pointless, so 404 if we still have nothing.
    let estimatedScore: number | null = scoreRow ? Number(scoreRow.estimated_score) : null;
    let scoreScale: string = scoreRow ? String(scoreRow.score_scale) : '';
    let testType: string = scoreRow ? String(scoreRow.test_type) : (user.target_test || 'TOEFL_IBT');
    if (estimatedScore == null) {
      try {
        const { estimateScore } = await import('../services/score-predictor');
        const live = await estimateScore(c.env, user.id, testType);
        if (live) {
          estimatedScore = live.estimatedScore;
          scoreScale = live.scale;
          testType = live.testType;
        }
      } catch (e) {
        console.error('[share-card] live estimate failed:', (e as any)?.message || e);
      }
    }
    if (estimatedScore == null) {
      return c.json({ error: 'No score data yet for this user' }, 404);
    }

    // ── Mock-test delta: last two mocks for this test type ──
    let deltaLabel: string | null = null;
    try {
      const mocks = await c.env.DB.prepare(
        `SELECT estimated_score, score_scale, taken_at FROM mock_test_history
         WHERE user_id = ? AND test_type = ?
         ORDER BY taken_at DESC, id DESC LIMIT 2`
      ).bind(user.id, testType).all();
      const rows = (mocks.results || []) as any[];
      if (rows.length >= 2) {
        const latest = Number(rows[0].estimated_score);
        const prev = Number(rows[1].estimated_score);
        const isBand = rows[0].score_scale === 'ielts_band';
        const delta = latest - prev;
        // Only brag about improvement — a negative delta never goes on a card.
        if (delta > 0) {
          const deltaStr = `+${isBand ? delta.toFixed(1) : Math.round(delta)}`;
          const t0 = parseSqliteUtc(rows[1].taken_at);
          const t1 = parseSqliteUtc(rows[0].taken_at);
          if (t0 != null && t1 != null && t1 > t0) {
            const days = Math.max(1, Math.round((t1 - t0) / 86400000));
            deltaLabel = `${deltaStr} dalam ${days} hari`;
          } else {
            deltaLabel = `${deltaStr} dari mock sebelumnya`;
          }
        }
      }
    } catch (e) {
      console.error('[share-card] mock delta failed:', (e as any)?.message || e);
    }

    // ── Referral deep link: reuse the user's code, mint one if missing ──
    // Same format the /referral command mints (ref_<userId>_<ts36>) so the
    // /start ref_ handler matches it against users.referral_code.
    let refCode: string = user.referral_code || '';
    if (!refCode) {
      try {
        refCode = `ref_${user.id}_${Date.now().toString(36)}`;
        await c.env.DB.prepare(
          'UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL'
        ).bind(refCode, user.id).run();
      } catch (e) {
        console.error('[share-card] referral code mint failed:', (e as any)?.message || e);
        refCode = `ref_${user.telegram_id}`;
      }
    }
    const refLink = `https://t.me/${BOT_USERNAME}?start=${refCode}`;

    const firstName = String(user.name || '').trim().split(/\s+/)[0] || 'Pejuang Skor';
    const svg = generateScoreCardSvg({
      name: firstName,
      testType: TEST_LABELS[testType] || testType,
      scoreLabel: formatScoreLabel(estimatedScore, scoreScale, testType),
      deltaLabel,
      streak: Number(user.current_streak) || 0,
      refCode: refLink,
    });

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (e: any) {
    console.error('[share-card] error:', e?.message || e);
    return c.json({ error: 'Failed to render score card' }, 500);
  }
});
