import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { authRoutes } from './routes/auth';
import { testRoutes } from './routes/tests';
import { progressRoutes } from './routes/progress';
import { contentRoutes } from './routes/content';
import { mediaRoutes } from './routes/media';
import { handleWebhook } from './bot/webhook';
import { ttsRoutes } from './routes/tts';
import { classRoutes } from './routes/classes';
import { speakingRoutes } from './routes/speaking';
import { aiGenRoutes } from './routes/ai-generate';
import { writingRoutes } from './routes/writing';

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('/api/*', cors({
  origin: (origin, c) => {
    const allowed = [
      c.env.WEBAPP_URL,
      'http://localhost:5173',
      'http://localhost:3000',
    ];
    return allowed.includes(origin) ? origin : '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', version: '0.1.0', runtime: 'cloudflare-workers' }));

// Bot webhook
app.post('/api/bot/webhook', async (c) => {
  const secret = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  if (c.env.TELEGRAM_BOT_SECRET && secret !== c.env.TELEGRAM_BOT_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const update = await c.req.json();
  await handleWebhook(update, c.env);
  return c.json({ ok: true });
});

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/tests', testRoutes);
app.route('/api/progress', progressRoutes);
app.route('/api/admin/content', contentRoutes);
app.route('/api/media', mediaRoutes);
app.route('/api/tts', ttsRoutes);
app.route('/api/classes', classRoutes);
app.route('/api/speaking', speakingRoutes);
app.route('/api/ai-generate', aiGenRoutes);
app.route('/api/writing', writingRoutes);

// Serve frontend — proxy to Cloudflare Pages (same origin, no CORS issues)
app.get('*', async (c) => {
  const url = new URL(c.req.url);
  const pagesUrl = `https://edubot-webapp.pages.dev${url.pathname}${url.search}`;

  try {
    const response = await fetch(pagesUrl, {
      headers: { 'Accept': c.req.header('Accept') || '*/*' },
    });

    // If Pages returns 404, serve index.html for SPA routing
    if (response.status === 404) {
      const indexResponse = await fetch('https://edubot-webapp.pages.dev/index.html');
      return new Response(indexResponse.body, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Forward the response with original headers
    const newHeaders = new Headers(response.headers);
    newHeaders.delete('x-frame-options'); // Allow embedding in Telegram
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  } catch (e) {
    // Fallback: serve a minimal page
    return c.html('<html><body><h2>EduBot</h2><p>Loading...</p></body></html>');
  }
});

// Cron handler for daily notifications
async function handleCron(env: Env) {
  try {
    // Find all users with active study plans
    const users = await env.DB.prepare(
      "SELECT u.telegram_id, u.name, sp.current_day, sp.total_days FROM users u JOIN study_plans sp ON u.id = sp.user_id WHERE sp.status = 'active'"
    ).all();

    for (const user of users.results as any[]) {
      const tgId = parseInt(String(user.telegram_id).replace('.0', ''));
      const progress = Math.round((user.current_day / user.total_days) * 100);

      const message = `Selamat pagi, ${user.name}!\n\nHari ${user.current_day + 1}/${user.total_days} study plan kamu (${progress}% selesai).\n\nKetik /today untuk lihat pelajaran hari ini, atau tap "Belajar" untuk mulai latihan.`;

      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgId, text: message }),
      });
    }

    // Also remind users with due spaced repetition items
    const srUsers = await env.DB.prepare(
      `SELECT DISTINCT u.telegram_id, u.name, COUNT(sr.id) as due_count
       FROM users u JOIN spaced_repetition sr ON u.id = sr.user_id
       WHERE sr.next_review_at <= datetime('now')
       GROUP BY u.id`
    ).all();

    for (const user of srUsers.results as any[]) {
      const tgId = parseInt(String(user.telegram_id).replace('.0', ''));
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgId,
          text: `Kamu punya ${user.due_count} item yang perlu di-review. Ketik /review untuk mulai.\n\nIngat: tanpa review, otak kamu lupa 20% materi kemarin!`,
        }),
      });
    }
    // Post daily quiz to class groups
    try {
      const { postDailyQuiz, postDiscussionPrompt } = await import('./services/classroom');
      await postDailyQuiz(env);
      // Post discussion prompt on Wednesdays and Saturdays
      const day = new Date().getDay();
      if (day === 3 || day === 6) {
        await postDiscussionPrompt(env);
      }
    } catch (e) {
      console.error('Quiz/discussion cron error:', e);
    }

  } catch (e) {
    console.error('Cron error:', e);
  }
}

// Weekly — Mondays at 8 AM WIB: leaderboard + progress reports
async function handleWeeklyCron(env: Env) {
  try {
    const { postWeeklyLeaderboard } = await import('./services/classroom');
    await postWeeklyLeaderboard(env);
  } catch (e) {
    console.error('Leaderboard cron error:', e);
  }

  // Send weekly progress reports to all users
  try {
    const { generateWeeklyReport } = await import('./services/commercial');
    const users = await env.DB.prepare('SELECT id, telegram_id, name FROM users').all();
    for (const u of users.results as any[]) {
      const tgId = parseInt(String(u.telegram_id).replace('.0', ''));
      const report = await generateWeeklyReport(env, u.id, u.name);
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgId, text: report }),
      });
    }
  } catch (e) {
    console.error('Weekly report error:', e);
  }
}

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Check which cron triggered
    if (event.cron === '7 1 * * 1') {
      ctx.waitUntil(handleWeeklyCron(env));
    } else {
      ctx.waitUntil(handleCron(env));
    }
  },
};
