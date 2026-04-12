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
import { analyticsRoutes } from './routes/analytics';
import { channelAnalyticsRoutes } from './routes/channel-analytics';
import { premiumRoutes } from './routes/premium';
import { handbookRoutes } from './routes/handbook';
import { weaknessRoutes } from './routes/weakness';
import { adminApiRoutes } from './routes/admin-api';

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('/api/*', cors({
  origin: (origin, c) => {
    const allowed = [
      c.env.WEBAPP_URL,
      'http://localhost:5173',
      'http://localhost:3000',
    ];
    // Allow listed origins, or any origin if using API key auth (external apps)
    if (allowed.includes(origin)) return origin;
    return origin || '*'; // Allow external API clients
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Telegram-User-Id', 'x-admin-secret', 'X-API-Key'],
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
app.route('/api/analytics', analyticsRoutes);
app.route('/api/channel-analytics', channelAnalyticsRoutes);
app.route('/api/weakness', weaknessRoutes);
app.route('/api/premium', premiumRoutes);
app.route('/api/handbook', handbookRoutes);
app.route('/api/v1/admin', adminApiRoutes);

// Serve R2 audio files
app.get('/api/audio/:path{.+}', async (c) => {
  const bucket = c.env.AUDIO_BUCKET;
  if (!bucket) return c.text('R2 not configured', 500);
  const key = c.req.param('path');
  const obj = await bucket.get(key);
  if (!obj) return c.text('Not found', 404);
  return new Response(obj.body, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=31536000', 'Access-Control-Allow-Origin': '*' },
  });
});

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
      const daysLeft = user.total_days - user.current_day;

      const greetings = [
        `Pagi, ${user.name}! ☀️`,
        `Hei ${user.name}! 👋`,
        `Morning, ${user.name}! ☕`,
        `Rise and shine, ${user.name}! 🌅`,
      ];
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];

      const progressBar = '🟩'.repeat(Math.round(progress / 10)) + '⬜'.repeat(10 - Math.round(progress / 10));

      const message = `${greeting}\n\n${progressBar} ${progress}%\nDay ${user.current_day + 1} of ${user.total_days} — tinggal ${daysLeft} hari lagi!\n\nSiap belajar? Ketik /today yuk!`;

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
      const nudges = [
        `Ingat: tanpa review, otak kamu lupa 20% materi kemarin!`,
        `Review itu cuma 5 menit, tapi efeknya tahan berminggu-minggu!`,
        `Mumpung masih inget, langsung review yuk!`,
        `Makin sering review, makin nempel di otak!`,
      ];
      const nudge = nudges[Math.floor(Math.random() * nudges.length)];

      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgId,
          text: `Ada ${user.due_count} soal yang perlu kamu review nih! Ketik /review untuk mulai. 🧠\n\n${nudge}`,
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

  // Post to public channel - Morning (8 AM WIB = 1 AM UTC)
  try {
    const { generateVocabularyOfTheDay, generateDailyQuiz, formatQuizPost, postToChannel } = await import('./services/contentGenerator');
    const vocab = await generateVocabularyOfTheDay(env);
    const vocabOk = await postToChannel(env, vocab.text, 'vocab');
    console.log('Channel vocab post:', vocabOk ? 'OK' : 'FAILED');

    const quiz = await generateDailyQuiz(env);
    const quizText = formatQuizPost(quiz, 'https://t.me/osee_IBT_IELTS_tutor_bot?start=quiz_channel');
    const quizOk = await postToChannel(env, quizText, 'quiz');
    console.log('Channel quiz post:', quizOk ? 'OK' : 'FAILED');
  } catch (e) {
    console.error('Morning channel post error:', e);
  }
}

// Hourly channel content rotation (every hour)
async function handleHourlyChannelCron(env: Env) {
  try {
    const {
      generateGrammarTip,
      generateIdiom,
      generateVocabularyOfTheDay,
      generatePromoCTA,
      generateSpeakingCTA,
      postToChannel,
    } = await import('./services/contentGenerator');

    // Rotate content based on UTC hour (WIB = UTC+7, so UTC hour +7 = WIB hour)
    // 5 content types × 4 hour cycle = 20 hours coverage, slight overlap at top of hour
    const utcHour = new Date().getUTCHours();
    const contentTypes = [
      { type: 'grammar_tip', generate: () => generateGrammarTip(env) },
      { type: 'speaking_cta', generate: () => generateSpeakingCTA() },
      { type: 'idiom', generate: () => generateIdiom(env) },
      { type: 'vocab', generate: () => generateVocabularyOfTheDay(env).then(v => v.text) },
      { type: 'cta', generate: () => generatePromoCTA() },
    ];

    const idx = utcHour % contentTypes.length;
    const content = await contentTypes[idx].generate();
    const contentType = contentTypes[idx].type as string;
    const ok = await postToChannel(env, content, contentType);
    console.log(`Channel hourly post (${contentType}, UTC ${utcHour}):`, ok ? 'OK' : 'FAILED');
  } catch (e) {
    console.error('Hourly channel post error:', e);
  }
}

// Evening — 6 PM WIB (11 AM UTC): Grammar tip + Idiom + CTA
async function handleEveningCron(env: Env) {
  try {
    const { generateGrammarTip, generateIdiom, generateStudentSpotlight, generatePromoCTA, postToChannel } = await import('./services/contentGenerator');

    // Grammar tip
    const grammarTip = await generateGrammarTip(env);
    const tipOk = await postToChannel(env, grammarTip, 'grammar_tip');
    console.log('Channel grammar tip post:', tipOk ? 'OK' : 'FAILED');

    // Idiom
    const idiom = await generateIdiom(env);
    const idiomOk = await postToChannel(env, idiom, 'idiom');
    console.log('Channel idiom post:', idiomOk ? 'OK' : 'FAILED');

    // Student spotlight (sometimes)
    const studentSpotlight = await generateStudentSpotlight(env);
    if (studentSpotlight) {
      const spotlightOk = await postToChannel(env, studentSpotlight, 'spotlight');
      console.log('Channel spotlight post:', spotlightOk ? 'OK' : 'FAILED');
    }

    // Promo CTA
    const cta = generatePromoCTA();
    const ctaOk = await postToChannel(env, cta, 'cta');
    console.log('Channel CTA post:', ctaOk ? 'OK' : 'FAILED');
  } catch (e) {
    console.error('Evening channel post error:', e);
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

  // Send weekly teacher report to all teachers/admins
  try {
    const teachers = await env.DB.prepare(
      "SELECT DISTINCT u.telegram_id, u.name FROM users u WHERE u.role IN ('teacher', 'admin')"
    ).all();
    for (const t of teachers.results as any[]) {
      const tgId = parseInt(String(t.telegram_id).replace('.0', ''));
      if (!tgId) continue;
      const report = await generateTeacherWeeklyReport(env);
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgId, text: report }),
      });
    }
  } catch (e) {
    console.error('Teacher weekly report error:', e);
  }
}

// Hourly — cancel expired payment requests
async function handlePaymentExpiryCron(env: Env) {
  try {
    // Cancel pending payments that have expired
    const result = await env.DB.prepare(
      `UPDATE payment_requests 
       SET status = 'expired' 
       WHERE status = 'pending' AND expires_at < datetime('now')`
    ).run();

    if (result.meta?.changes > 0) {
      console.log(`Cancelled ${result.meta.changes} expired payment requests`);
    }
  } catch (e) {
    console.error('Payment expiry cron error:', e);
  }
}

// Generate weekly report for teachers (class overview)
async function generateTeacherWeeklyReport(env: Env): Promise<string> {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoStr = weekAgo.toISOString();

  // Get total students
  const totalStudents = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM users WHERE role = 'student'"
  ).first() as any;

  // Get active students this week
  const activeStudents = await env.DB.prepare(
    `SELECT COUNT(DISTINCT ta.user_id) as count
     FROM test_attempts ta
     JOIN attempt_answers aa ON ta.id = aa.attempt_id
     WHERE aa.submitted_at >= ?`
  ).bind(weekAgoStr).first() as any;

  // Get total questions answered this week
  const weeklyQuestions = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM attempt_answers WHERE submitted_at >= ?`
  ).bind(weekAgoStr).first() as any;

  // Get weekly accuracy
  const weeklyAccuracy = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct,
       COUNT(*) as total
     FROM attempt_answers
     WHERE submitted_at >= ?`
  ).bind(weekAgoStr).first() as any;

  // Get top improvers (users who completed a test this week vs last week)
  const topStudents = await env.DB.prepare(
    `SELECT u.name, u.telegram_id, COUNT(aa.id) as questions
     FROM attempt_answers aa
     JOIN test_attempts ta ON aa.attempt_id = ta.id
     JOIN users u ON ta.user_id = u.id
     WHERE aa.submitted_at >= ?
     GROUP BY u.id
     ORDER BY questions DESC
     LIMIT 5`
  ).bind(weekAgoStr).all();

  // Get class breakdown by target_test
  const classBreakdown = await env.DB.prepare(
    `SELECT target_test, COUNT(*) as count FROM users
     WHERE role = 'student' AND target_test IS NOT NULL
     GROUP BY target_test`
  ).all();

  // Get weekly challenges count
  const challengesCount = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM analytics WHERE event = 'challenge_sent' AND created_at >= ?`
  ).bind(weekAgoStr).first() as any;

  const accuracyRate = weeklyAccuracy.total > 0
    ? Math.round((weeklyAccuracy.correct / weeklyAccuracy.total) * 100)
    : 0;

  let report = `📊 *Weekly Teacher Report*\n━━━━━━━━━━━━━━━━━━━━\n`;
  report += `📅 ${today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n`;

  report += `*Overall Stats*\n`;
  report += `👥 Total Students: ${totalStudents?.count || 0}\n`;
  report += `✅ Active This Week: ${activeStudents?.count || 0}\n`;
  report += `📝 Questions Answered: ${weeklyQuestions?.count || 0}\n`;
  report += `🎯 Weekly Accuracy: ${accuracyRate}%\n`;
  report += `⚔️ Challenges Sent: ${challengesCount?.count || 0}\n\n`;

  report += `*Class Breakdown*\n`;
  for (const c of classBreakdown.results as any[]) {
    const emoji = c.target_test === 'TOEFL_IBT' ? '📝' :
                  c.target_test === 'IELTS' ? '🎓' :
                  c.target_test === 'TOEFL_ITP' ? '📋' :
                  c.target_test === 'TOEIC' ? '💼' : '📌';
    report += `${emoji} ${c.target_test}: ${c.count} students\n`;
  }

  report += `\n*Top Active Students*\n`;
  for (const s of topStudents.results as any[]) {
    report += `🏆 ${s.name}: ${s.questions} questions\n`;
  }

  report += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  report += `Export data: /admin → Students → Export CSV`;

  return report;
}

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Check which cron triggered — explicit match for all patterns
    if (event.cron === '3 1 * * *') {
      // Morning cron (8:03 AM WIB) — study reminders + daily quiz + channel posts
      ctx.waitUntil(handleCron(env));
    } else if (event.cron === '7 1 * * 1') {
      // Monday weekly leaderboard (8:07 AM WIB)
      ctx.waitUntil(handleWeeklyCron(env));
    } else if (event.cron === '0 11 * * *') {
      // Evening channel post (6 PM WIB = 11 AM UTC)
      ctx.waitUntil(handleEveningCron(env));
    } else if (event.cron === '30 * * * *') {
      // Hourly — channel content rotation + cancel expired payments
      ctx.waitUntil(handleHourlyChannelCron(env));
      ctx.waitUntil(handlePaymentExpiryCron(env));
    } else {
      console.warn(`Unknown cron pattern: ${event.cron}`);
    }
  },
};