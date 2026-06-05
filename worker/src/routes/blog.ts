/**
 * Blog route — serves HTML articles at /api/blog/article/<slug>.
 * Replaces osee.co.id/blog which was returning "connection closed"
 * (broken WordPress backend) and killing channel CTA conversions.
 *
 * Two endpoints:
 *   GET /api/blog/article/<slug>  — renders the article as HTML
 *   GET /api/blog                  — lists recent articles (for nav)
 *
 * For the channel, every "Baca penjelasan lengkap" link in the
 * contentGenerator.ts posts now points here, so the click never 404s.
 * A redirect-to-bot CTA is always shown at the bottom — even if a
 * student just wants the article, they get nudged into the bot.
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { getArticle, trackClick, listArticles, getClickStats } from '../services/blog';

export const blogRoutes = new Hono<{ Bindings: Env }>();

const BOT_LINK = 'https://t.me/osee_IBT_IELTS_tutor_bot?start=blog_visitor';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pageShell(args: {
  title: string;
  metaDescription: string;
  bodyHtml: string;
  ctaLabel: string;
}): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(args.title)} | OSEE EduBot</title>
<meta name="description" content="${escapeHtml(args.metaDescription)}">
<meta property="og:title" content="${escapeHtml(args.title)}">
<meta property="og:description" content="${escapeHtml(args.metaDescription)}">
<meta property="og:type" content="article">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; line-height: 1.6; color: #1a1a2e; background: #f7f8fa; }
  .container { max-width: 720px; margin: 0 auto; padding: 24px 16px; }
  .badge { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
  h1 { font-size: 28px; line-height: 1.3; margin-bottom: 12px; color: #16213e; }
  .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
  .article-body { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .article-body p { margin-bottom: 16px; }
  .article-body h2 { font-size: 22px; margin: 24px 0 12px; color: #16213e; }
  .article-body h3 { font-size: 18px; margin: 20px 0 8px; }
  .article-body ul, .article-body ol { margin: 12px 0 12px 24px; }
  .article-body code { background: #f1f3f5; padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 14px; }
  .article-body strong { color: #16213e; }
  .article-body em { color: #555; }
  .article-body blockquote { border-left: 4px solid #4263eb; padding: 8px 16px; margin: 12px 0; background: #eef2ff; color: #213; }
  .cta-box { background: linear-gradient(135deg, #4263eb 0%, #5e7ce6 100%); color: #fff; padding: 24px; border-radius: 12px; margin-top: 24px; text-align: center; }
  .cta-box h3 { font-size: 20px; margin-bottom: 8px; }
  .cta-box p { margin-bottom: 16px; opacity: 0.95; }
  .cta-box a { display: inline-block; background: #fff; color: #4263eb; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
  .footer { text-align: center; margin-top: 32px; color: #888; font-size: 13px; }
  .footer a { color: #4263eb; }
</style>
</head>
<body>
<div class="container">
  <span class="badge">📚 OSEE EduBot Blog</span>
  <h1>${escapeHtml(args.title)}</h1>
  <div class="article-body">
    ${args.bodyHtml}
  </div>
  <div class="cta-box">
    <h3>${escapeHtml(args.ctaLabel)}</h3>
    <p>Mau practice TOEFL / IELTS langsung di bot? Adaptive learning, AI tutor 24/7, dan ribuan soal siap bantu kamu siap ujian.</p>
    <a href="${BOT_LINK}">🤖 Buka EduBot di Telegram</a>
  </div>
  <div class="footer">
    <p>OSEE EduBot — AI-Powered TOEFL & IELTS Preparation</p>
    <p><a href="${BOT_LINK}">Mulai belajar gratis</a></p>
  </div>
</div>
</body>
</html>`;
}

blogRoutes.get('/article/:slug', async (c) => {
  const slug = c.req.param('slug');
  const article = await getArticle(c.env, slug);

  if (!article) {
    // Article not yet published. Render a minimal "coming soon" page
    // that still routes to the bot — much better UX than a 404
    // because the channel CTA is still a real, working link.
    return c.html(pageShell({
      title: 'Artikel Sedang Disiapkan',
      metaDescription: 'Artikel ini sedang disiapkan tim OSEE. Sementara itu, mulai latihan di bot.',
      bodyHtml: `
        <p>📝 Kami sedang menyiapkan artikel lengkap tentang topik ini.</p>
        <p>Sementara menunggu, kamu bisa mulai practice langsung di bot — dapat soal latihan, penjelasan AI, dan tracking progress.</p>
        <h2>Mau dapat notifikasi ketika artikel ini rilis?</h2>
        <p>Buka bot dan ketik <code>/start</code> untuk mulai belajar. Kami akan notify kamu ketika artikel baru tersedia.</p>
      `,
      ctaLabel: 'Buka Bot Sekarang',
    }), 200);
  }

  // Track click (non-blocking; errors are swallowed inside)
  const userAgent = c.req.header('user-agent') || '';
  const referrer = c.req.header('referer') || '';
  // Infer source: Telegram clients set a specific UA
  let source = 'direct';
  if (userAgent.includes('TelegramBot') || userAgent.includes('Telegram') || userAgent.includes('tdesktop')) {
    source = 'telegram_channel';
  } else if (referrer.includes('t.me/') || referrer.includes('telegram.org')) {
    source = 'telegram_bot';
  } else if (referrer.includes('google.')) {
    source = 'google';
  }
  await trackClick(c.env, { slug, source, userAgent, referrer });

  return c.html(pageShell({
    title: article.title,
    metaDescription: article.meta_description || article.title,
    bodyHtml: article.body_html,
    ctaLabel: 'Latihan Soal Sekarang',
  }), 200);
});

blogRoutes.get('/', async (c) => {
  const topic = c.req.query('topic');
  const testType = c.req.query('test_type');
  const limit = parseInt(c.req.query('limit') || '30');

  const articles = await listArticles(c.env, { topic, test_type: testType, limit });

  const items = articles.map((a) =>
    `<li><a href="/api/blog/article/${escapeHtml(a.slug)}">${escapeHtml(a.title)}</a> <small>(${escapeHtml(a.topic)}, ${a.view_count} views)</small></li>`
  ).join('\n');

  return c.html(`<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><title>OSEE EduBot Blog</title></head>
<body>
<h1>📚 OSEE EduBot Blog</h1>
<p>${articles.length} artikel</p>
<ul>${items}</ul>
<p><a href="${BOT_LINK}">Buka bot</a></p>
</body>
</html>`);
});

// Admin: click stats (requires admin auth — checked at index.ts route mount)
blogRoutes.get('/admin/stats', async (c) => {
  const days = parseInt(c.req.query('days') || '30');
  const stats = await getClickStats(c.env, days);
  return c.json(stats);
});

// Admin: seed today's blog articles. Used as a backstop if the
// morning cron didn't run, and to make the channel CTA links resolve
// to real content immediately after a deploy. Idempotent: re-running
// on the same day updates the same row.
blogRoutes.post('/admin/seed', async (c) => {
  const { publishVocabOfTheDay, publishQuizOfTheDay } = await import('../services/blog');
  const vocab = await publishVocabOfTheDay(c.env);
  const quiz = await publishQuizOfTheDay(c.env);
  return c.json({
    ok: true,
    vocab: vocab ? { slug: vocab.slug, title: vocab.title, view_count: vocab.view_count } : null,
    quiz: quiz ? { slug: quiz.slug, title: quiz.title, view_count: quiz.view_count } : null,
  });
});
