/**
 * Blog articles — internal blog served by /api/blog/article/<slug>.
 * Replaces the dead osee.co.id/blog links that were killing channel
 * conversions. The channel posts now point here, and a Week 4 pipeline
 * will auto-publish articles from the test_contents bank.
 *
 * Three things happen in this file:
 *   1. publishArticle — inserts/updates a blog article
 *   2. getArticle — fetches one article by slug (returns null if missing)
 *   3. trackClick — logs a click for analytics
 *   4. listArticles — for the admin/blog-list endpoint
 *
 * Articles have HTML body. Render them as full HTML pages in
 * routes/blog.ts with a clean, brandable shell.
 */

import type { Env } from '../types';

export interface BlogArticle {
  id: number;
  slug: string;
  title: string;
  topic: string;
  test_type: string | null;
  body_html: string;
  meta_description: string | null;
  source_content_id: number | null;
  source_attribution_id: number | null;
  status: 'draft' | 'published' | 'archived';
  view_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface PublishInput {
  slug: string;
  title: string;
  topic: string;
  body_html: string;
  test_type?: string | null;
  meta_description?: string;
  source_content_id?: number;
  source_attribution_id?: number;
  status?: 'draft' | 'published';
}

export async function getArticle(env: Env, slug: string): Promise<BlogArticle | null> {
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return null;
  const row = await env.DB.prepare(
    `SELECT * FROM blog_articles WHERE slug = ? AND status = 'published' LIMIT 1`
  ).bind(slug).first<BlogArticle>();
  return row || null;
}

export async function publishArticle(env: Env, input: PublishInput): Promise<BlogArticle> {
  // Validate slug
  if (!/^[a-z0-9-]{2,80}$/.test(input.slug)) {
    throw new Error('Invalid slug format. Use 2-80 chars: a-z, 0-9, -.');
  }
  const existing = await env.DB.prepare(
    'SELECT id FROM blog_articles WHERE slug = ?'
  ).bind(input.slug).first<{ id: number }>();

  const status = input.status || 'published';
  if (existing) {
    await env.DB.prepare(
      `UPDATE blog_articles
       SET title = ?, topic = ?, body_html = ?, test_type = ?, meta_description = ?,
           source_content_id = ?, source_attribution_id = ?, status = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(
      input.title, input.topic, input.body_html, input.test_type || null,
      input.meta_description || null, input.source_content_id || null,
      input.source_attribution_id || null, status, existing.id
    ).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO blog_articles
         (slug, title, topic, test_type, body_html, meta_description,
          source_content_id, source_attribution_id, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      input.slug, input.title, input.topic, input.test_type || null,
      input.body_html, input.meta_description || null,
      input.source_content_id || null, input.source_attribution_id || null,
      status
    ).run();
  }
  return (await getArticle(env, input.slug))!;
}

export async function trackClick(env: Env, args: {
  slug: string;
  source?: string;
  userAgent?: string;
  referrer?: string;
}): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO blog_clicks (slug, source, user_agent, referrer) VALUES (?, ?, ?, ?)`
    ).bind(
      args.slug,
      args.source || 'direct',
      args.userAgent?.slice(0, 200) || null,
      args.referrer?.slice(0, 500) || null
    ).run();
    // Increment view_count atomically
    await env.DB.prepare(
      `UPDATE blog_articles SET view_count = view_count + 1 WHERE slug = ?`
    ).bind(args.slug).run();
  } catch (e) {
    console.error('[blog] trackClick error (non-fatal):', e);
  }
}

export async function listArticles(env: Env, args: {
  topic?: string;
  test_type?: string;
  limit?: number;
} = {}): Promise<BlogArticle[]> {
  const limit = args.limit || 50;
  let query = `SELECT * FROM blog_articles WHERE status = 'published'`;
  const params: any[] = [];
  if (args.topic) {
    query += ` AND topic = ?`;
    params.push(args.topic);
  }
  if (args.test_type) {
    query += ` AND test_type = ?`;
    params.push(args.test_type);
  }
  query += ` ORDER BY published_at DESC LIMIT ?`;
  params.push(limit);
  const rows = await env.DB.prepare(query).bind(...params).all<BlogArticle>();
  return rows.results || [];
}

export async function getClickStats(env: Env, days: number = 30): Promise<{
  total_clicks: number;
  by_slug: Array<{ slug: string; clicks: number }>;
  by_source: Array<{ source: string; clicks: number }>;
}> {
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM blog_clicks WHERE clicked_at >= ?`
  ).bind(cutoff).first<{ n: number }>();
  const bySlug = await env.DB.prepare(
    `SELECT slug, COUNT(*) as clicks FROM blog_clicks WHERE clicked_at >= ? GROUP BY slug ORDER BY clicks DESC LIMIT 20`
  ).bind(cutoff).all<{ slug: string; clicks: number }>();
  const bySource = await env.DB.prepare(
    `SELECT source, COUNT(*) as clicks FROM blog_clicks WHERE clicked_at >= ? GROUP BY source ORDER BY clicks DESC`
  ).bind(cutoff).all<{ source: string; clicks: number }>();
  return {
    total_clicks: total?.n || 0,
    by_slug: bySlug.results,
    by_source: bySource.results,
  };
}
