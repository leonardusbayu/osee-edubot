import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';

export const channelAnalyticsRoutes = new Hono<{ Bindings: Env }>();

async function requireAdmin(c: any, next: any) {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  if (user.role !== 'admin' && user.role !== 'teacher') {
    return c.json({ error: 'Admin or teacher access required' }, 403);
  }
  c.set('user', user);
  return next();
}

channelAnalyticsRoutes.use('/*', requireAdmin);

// Summary stats
channelAnalyticsRoutes.get('/summary', async (c) => {
  const days = parseInt(c.req.query('days') || '7');

  const postsByType = await c.env.DB.prepare(`
    SELECT post_type as content_type,
           COUNT(*) as total,
           SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM channel_posts
    WHERE posted_at >= datetime('now', '-${days} days')
    GROUP BY post_type
    ORDER BY total DESC
  `).all();

  const totalPosts = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM channel_posts
    WHERE posted_at >= datetime('now', '-${days} days')
  `).first();

  const totalFailed = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM channel_posts
    WHERE posted_at >= datetime('now', '-${days} days') AND status = 'failed'
  `).first();

  const referralsBySource = await c.env.DB.prepare(`
    SELECT source_channel, COUNT(*) as count
    FROM channel_referrals
    WHERE referred_at >= datetime('now', '-${days} days')
    GROUP BY source_channel
    ORDER BY count DESC
  `).all();

  const hourlyStats = await c.env.DB.prepare(`
    SELECT hour_bucket, content_type, posts_sent, posts_failed
    FROM channel_hourly_stats
    WHERE hour_bucket >= datetime('now', '-${days} days')
    ORDER BY hour_bucket DESC
    LIMIT 200
  `).all();

  const totalPostsCount = (totalPosts?.count as number) || 0;
  const totalFailedCount = (totalFailed?.count as number) || 0;
  const successRate = totalPostsCount > 0
    ? Math.round(((totalPostsCount - totalFailedCount) / totalPostsCount) * 100)
    : 100;

  return c.json({
    period_days: days,
    total_posts: totalPostsCount,
    total_failed: totalFailedCount,
    success_rate: successRate,
    by_type: postsByType.results,
    referrals_by_source: referralsBySource.results,
    hourly_stats: hourlyStats.results,
  });
});

// Recent posts
channelAnalyticsRoutes.get('/posts', async (c) => {
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const failedOnly = c.req.query('failed') === '1';

  let query = `
    SELECT id, posted_at, post_type as content_type, post_content as content_preview, message_id, sent_to_channel, status, error_message
    FROM channel_posts
  `;
  if (failedOnly) query += ` WHERE status = 'failed'`;
  query += ` ORDER BY posted_at DESC LIMIT ? OFFSET ?`;

  const posts = await c.env.DB.prepare(query).bind(limit, offset).all();

  return c.json({ posts: posts.results, count: posts.results.length });
});

// Referral breakdown
channelAnalyticsRoutes.get('/referrals', async (c) => {
  const days = parseInt(c.req.query('days') || '30');

  const byContext = await c.env.DB.prepare(`
    SELECT signup_context, COUNT(*) as count
    FROM channel_referrals
    WHERE referred_at >= datetime('now', '-${days} days')
    GROUP BY signup_context
    ORDER BY count DESC
  `).all();

  const recent = await c.env.DB.prepare(`
    SELECT id, referred_at, referrer_code, source_channel, signup_context
    FROM channel_referrals
    ORDER BY referred_at DESC
    LIMIT 50
  `).all();

  return c.json({
    period_days: days,
    by_context: byContext.results,
    recent: recent.results,
    total: byContext.results.reduce((sum: number, r: any) => sum + r.count, 0),
  });
});

// Manually trigger a test post (admin only)
channelAnalyticsRoutes.post('/test-post', async (c) => {
  const body = await c.req.json();
  const { generateSpeakingCTA, generatePromoCTA, generateGrammarTip, generateIdiom, postToChannel } = await import('../services/contentGenerator');

  type GenFn = () => string | Promise<string>;
  const generators: Record<string, GenFn> = {
    speaking_cta: () => generateSpeakingCTA(),
    cta: () => generatePromoCTA(),
    grammar_tip: () => generateGrammarTip(c.env),
    idiom: () => generateIdiom(c.env),
  };

  const generator = generators[body.type || 'cta'];
  if (!generator) return c.json({ error: 'Invalid content type' }, 400);

  const content = await generator();
  const sent = await postToChannel(c.env, content, body.type || 'cta');

  return c.json({ sent, content_type: body.type || 'cta', preview: content.substring(0, 100) });
});
