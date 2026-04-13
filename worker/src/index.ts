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
import { handleNotionSync, handleNotionWeeklySync } from './services/notion-sync';

const app = new Hono<{ Bindings: Env }>();

// Global error handler — sanitize error messages for production
app.onError((err, c) => {
  console.error(`[${c.req.method}] ${c.req.url} — Error:`, err.message);
  // Don't expose internal error details to clients
  const isDev = c.env.ENVIRONMENT === 'development';
  return c.json({
    error: isDev ? err.message : 'An internal error occurred. Please try again.',
    ...(isDev ? { stack: err.stack } : {}),
  }, 500);
});

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

// Health check — basic
app.get('/api/health', (c) => c.json({ status: 'ok', version: '0.1.0', runtime: 'cloudflare-workers' }));

// Manual Notion sync trigger (admin only)
app.post('/api/admin/notion-sync', async (c) => {
  const apiKey = c.req.header('X-API-Key') || c.req.header('x-admin-secret');
  if (!apiKey || (apiKey !== c.env.ADMIN_API_KEY && apiKey !== c.env.ADMIN_SECRET)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  try {
    const type = c.req.query('type'); // ?type=students|attempts|weekly
    const results = await handleNotionSync(c.env, type || undefined);
    return c.json({ ok: true, results });
  } catch (e: any) {
    return c.json({ error: 'Notion sync failed' }, 500);
  }
});

// Generate missing listening scripts for TOEFL ITP using AI
app.post('/api/admin/generate-listening-scripts', async (c) => {
  const apiKey = c.req.header('X-API-Key') || c.req.header('x-admin-secret');
  if (!apiKey || (apiKey !== c.env.ADMIN_API_KEY && apiKey !== c.env.ADMIN_SECRET)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const limit = parseInt(c.req.query('limit') || '10');
  const dryRun = c.req.query('dry') === 'true';

  try {
    // Find questions with empty passage_script
    const rows = await c.env.DB.prepare(`
      SELECT id, question_type, content FROM test_contents
      WHERE test_type = 'TOEFL_ITP' AND section = 'listening'
      AND (content LIKE '%"passage_script": ""%' OR content LIKE '%"passage_script":""%')
      LIMIT ?
    `).bind(limit).all();

    if (!rows.results || rows.results.length === 0) {
      return c.json({ ok: true, message: 'No empty scripts found', updated: 0 });
    }

    const results: any[] = [];

    for (const row of rows.results) {
      const content = JSON.parse(row.content as string);
      const questionType = row.question_type as string;
      const questions = content.questions || [];
      const part = content.part || 'A';

      // Check if answers are also missing
      const hasAnswers = questions.some((q: any) => q.answers?.[0] && q.answers[0].trim() !== '');

      // Build prompt based on question type
      let systemPrompt = '';
      if (questionType === 'listen_short_dialogue' || part === 'A') {
        systemPrompt = `You are writing TOEFL ITP Listening Part A dialogue scripts.
Each script is a SHORT conversation between two speakers (Man and Woman, 2-4 lines total).
Format: "W: [line]\\nM: [line]" (or M first).
Keep it brief (2-4 exchanges). Use natural academic/campus English.
The dialogue must clearly and naturally lead to the correct answer.`;
      } else if (questionType === 'listen_long_conversation' || part === 'B') {
        systemPrompt = `You are writing TOEFL ITP Listening Part B dialogue scripts.
Each script is a LONGER conversation (8-12 lines) between two speakers.
Format: "W: [line]\\nM: [line]\\nW: [line]..." etc.
Use natural academic/campus English.
The conversation must contain enough information to answer ALL questions correctly.`;
      } else {
        systemPrompt = `You are writing TOEFL ITP Listening Part C talk/lecture scripts.
Each script is a SHORT academic talk or announcement (6-10 sentences) by one speaker.
Format: "Professor: [full talk text]" or "Narrator: [text]".
Use academic English appropriate for a university setting.
The talk must contain enough information to answer ALL questions correctly.`;
      }

      // Always ask AI to return JSON with script + answers
      systemPrompt += `\n\nIMPORTANT: Respond in valid JSON format:
{
  "script": "W: ...\nM: ...",
  "answers": ["A", "B", ...]
}
Where "answers" is an array with the correct answer letter for each question (in order).
Pick the most logical/natural answer for each question based on the dialogue you write.`;

      // Extract question info for context
      const qInfo = questions.map((q: any, i: number) => {
        const opts = (q.options || []).map((o: any) => `${o.key}) ${o.text}`).join(', ');
        const ans = q.answers?.[0] && q.answers[0].trim() !== '' ? q.answers[0] : '(you decide)';
        return `Q${i + 1}: ${q.question_text || '(infer from options)'}\nOptions: ${opts}\nCorrect: ${ans}`;
      }).join('\n\n');

      const userPrompt = `Generate a dialogue/talk script for this TOEFL ITP listening question.

Group: ${content.group_name || 'Unknown'}
Type: ${questionType} (Part ${part})
Direction: ${content.direction || 'Listen and choose the best answer.'}
Number of questions: ${questions.length}

Questions:
${qInfo}

Respond with JSON only: {"script": "...", "answers": ["A", ...]}`;

      if (dryRun) {
        results.push({ id: row.id, type: questionType, part, numQuestions: questions.length, hasAnswers, status: 'dry_run' });
        continue;
      }

      // Call OpenAI
      const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 800,
          response_format: { type: 'json_object' },
        }),
      });

      const aiData: any = await aiResp.json();
      const raw = aiData.choices?.[0]?.message?.content?.trim() || '';

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        results.push({ id: row.id, status: 'failed', error: 'Invalid JSON from AI', raw: raw.substring(0, 200) });
        continue;
      }

      const script = parsed.script || '';
      const aiAnswers = parsed.answers || [];

      if (script.length < 10) {
        results.push({ id: row.id, status: 'failed', error: 'Script too short' });
        continue;
      }

      // Update content: set passage_script
      content.passage_script = script;

      // Fill in missing answers + generate explanations
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.answers?.[0] || q.answers[0].trim() === '') {
          const aiAns = (aiAnswers[i] || '').toUpperCase().trim();
          if (['A', 'B', 'C', 'D'].includes(aiAns)) {
            q.answers = [aiAns];
            // Generate a simple explanation
            const correctOpt = (q.options || []).find((o: any) => o.key === aiAns);
            q.explanation = correctOpt
              ? `The correct answer is ${aiAns}: "${correctOpt.text}". This can be inferred from the conversation.`
              : `The correct answer is ${aiAns}.`;
          }
        }
      }

      content.questions = questions;
      await c.env.DB.prepare('UPDATE test_contents SET content = ? WHERE id = ?')
        .bind(JSON.stringify(content), row.id).run();

      results.push({
        id: row.id,
        status: 'updated',
        scriptLength: script.length,
        answersGenerated: aiAnswers.length,
        answers: aiAnswers,
      });
    }

    return c.json({
      ok: true,
      total_found: rows.results.length,
      updated: results.filter((r: any) => r.status === 'updated').length,
      failed: results.filter((r: any) => r.status === 'failed').length,
      results,
    });
  } catch (e: any) {
    return c.json({ error: e.message || 'Failed' }, 500);
  }
});

// Deep health check — tests critical data flows
app.get('/api/health/deep', async (c) => {
  const checks: Record<string, { ok: boolean; error?: string; ms?: number }> = {};

  // 1. DB connection
  try {
    const t0 = Date.now();
    await c.env.DB.prepare('SELECT 1').first();
    checks.db_connection = { ok: true, ms: Date.now() - t0 };
  } catch (e: any) {
    checks.db_connection = { ok: false, error: e.message };
  }

  // 2. FK integrity — check all FK references point to real tables
  try {
    const t0 = Date.now();
    const fkResults = await c.env.DB.prepare(`
      SELECT m.name as table_name, p."table" as referenced_table
      FROM sqlite_master m, pragma_foreign_key_list(m.name) p
      WHERE m.type = 'table'
    `).all();
    const tables = await c.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all();
    const tableNames = new Set((tables.results || []).map((t: any) => t.name));
    const broken = (fkResults.results || []).filter((fk: any) => !tableNames.has(fk.referenced_table));
    checks.fk_integrity = {
      ok: broken.length === 0,
      ms: Date.now() - t0,
      ...(broken.length > 0 ? { error: `Broken FKs: ${broken.map((b: any) => `${b.table_name} -> ${b.referenced_table}`).join(', ')}` } : {}),
    };
  } catch (e: any) {
    checks.fk_integrity = { ok: false, error: e.message };
  }

  // 3. Answer write test — INSERT + DELETE a test row
  try {
    const t0 = Date.now();
    // Use a test attempt_id that won't conflict (negative)
    await c.env.DB.prepare(
      "INSERT INTO attempt_answers (attempt_id, section, question_index, answer_data) VALUES (-999, '_health', 0, '{}')"
    ).run();
    await c.env.DB.prepare(
      "DELETE FROM attempt_answers WHERE attempt_id = -999 AND section = '_health'"
    ).run();
    checks.answer_write = { ok: true, ms: Date.now() - t0 };
  } catch (e: any) {
    checks.answer_write = { ok: false, error: e.message };
  }

  // 4. Orphaned attempts — recent attempts with 0 answers (warning sign)
  try {
    const t0 = Date.now();
    const orphaned = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM test_attempts ta
      WHERE ta.started_at > datetime('now', '-24 hours')
      AND ta.status != 'abandoned'
      AND (SELECT COUNT(*) FROM attempt_answers aa WHERE aa.attempt_id = ta.id) = 0
      AND ta.current_question_index = 0
    `).first() as any;
    checks.orphaned_attempts_24h = {
      ok: (orphaned?.count || 0) < 5,
      ms: Date.now() - t0,
      ...(orphaned?.count > 0 ? { error: `${orphaned.count} attempts with 0 answers in last 24h` } : {}),
    };
  } catch (e: any) {
    checks.orphaned_attempts_24h = { ok: false, error: e.message };
  }

  const allOk = Object.values(checks).every(c => c.ok);
  return c.json({ status: allOk ? 'healthy' : 'unhealthy', checks }, allOk ? 200 : 503);
});

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

// Serve R2 files (audio + images)
app.get('/api/audio/:path{.+}', async (c) => {
  const bucket = c.env.AUDIO_BUCKET;
  if (!bucket) return c.text('R2 not configured', 500);
  const key = c.req.param('path');
  const obj = await bucket.get(key);
  if (!obj) return c.text('Not found', 404);
  // Detect content type from extension
  const ext = key.split('.').pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/opus', wav: 'audio/wav',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  };
  return new Response(obj.body, {
    headers: {
      'Content-Type': contentTypes[ext || ''] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*',
    },
  });
});

// Admin: upload image to R2 and link to a question
app.post('/api/admin/upload-question-image', async (c) => {
  const apiKey = c.req.header('X-API-Key') || c.req.header('x-admin-secret');
  if (!apiKey || (apiKey !== c.env.ADMIN_API_KEY && apiKey !== c.env.ADMIN_SECRET)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const bucket = c.env.AUDIO_BUCKET;
  if (!bucket) return c.json({ error: 'R2 not configured' }, 500);

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const questionId = formData.get('question_id') as string;
  const imageField = (formData.get('image_field') as string) || 'image_url'; // which JSON field to set

  if (!file || !questionId) return c.json({ error: 'file and question_id required' }, 400);

  // Upload to R2
  const ext = file.name.split('.').pop() || 'png';
  const r2Key = `images/ielts/${questionId}.${ext}`;
  const arrayBuf = await file.arrayBuffer();
  await bucket.put(r2Key, arrayBuf, {
    httpMetadata: { contentType: file.type || 'image/png' },
  });

  // Update question content in D1
  const row = await c.env.DB.prepare('SELECT content FROM test_contents WHERE id = ?').bind(parseInt(questionId)).first();
  if (!row) return c.json({ error: 'Question not found' }, 404);

  const content = JSON.parse(row.content as string);
  const imageUrl = `/api/audio/${r2Key}`;

  // Set image_url at the right level depending on content structure
  if (imageField === 'question_image' && content.questions?.[0]) {
    content.questions[0].image_url = imageUrl;
  } else {
    content.image_url = imageUrl;
  }

  await c.env.DB.prepare('UPDATE test_contents SET content = ? WHERE id = ?')
    .bind(JSON.stringify(content), parseInt(questionId))
    .run();

  return c.json({ ok: true, r2_key: r2Key, image_url: imageUrl });
});

// Generate photograph images for TOEIC Part 1 using fal.ai
app.post('/api/admin/generate-photograph-images', async (c) => {
  const apiKey = c.req.header('X-API-Key') || c.req.header('x-admin-secret');
  if (!apiKey || (apiKey !== c.env.ADMIN_API_KEY && apiKey !== c.env.ADMIN_SECRET)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const falKey = c.req.query('fal_key') || '';
  if (!falKey) return c.json({ error: 'fal_key query param required' }, 400);

  const limit = parseInt(c.req.query('limit') || '5');
  const dryRun = c.req.query('dry') === 'true';
  const bucket = c.env.AUDIO_BUCKET;
  if (!bucket && !dryRun) return c.json({ error: 'R2 not configured' }, 500);

  // Find photograph questions without images
  const rows = await c.env.DB.prepare(`
    SELECT id, content FROM test_contents
    WHERE question_type = 'photographs'
    AND json_extract(content, '$.type') = 'grouped_listening'
    ORDER BY id LIMIT ?
  `).bind(limit).all();

  const results: any[] = [];

  for (const row of rows.results) {
    const content = JSON.parse(row.content as string);
    const questions = content.questions || [];
    let updated = false;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      // Skip if already has image
      if (q.image_url) continue;

      // Get the correct answer text as the scene description
      const correctKey = (q.answers?.[0] || '').toUpperCase();
      const correctOption = q.options?.find((o: any) => o.key === correctKey);
      if (!correctOption) continue;

      const sceneDesc = correctOption.text;
      const prompt = `${sceneDesc}, realistic photograph, workplace or daily life scene, natural lighting, stock photo style, no text or watermarks`;

      if (dryRun) {
        results.push({ id: row.id, index: i, prompt, status: 'dry_run' });
        continue;
      }

      try {
        // Generate image with fal.ai
        const falResp = await fetch('https://fal.run/fal-ai/flux/schnell', {
          method: 'POST',
          headers: {
            'Authorization': `Key ${falKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            image_size: 'landscape_4_3',
            num_images: 1,
          }),
        });

        if (!falResp.ok) {
          results.push({ id: row.id, index: i, status: 'fal_error', error: await falResp.text() });
          continue;
        }

        const falData: any = await falResp.json();
        const imageUrl = falData.images?.[0]?.url;
        if (!imageUrl) {
          results.push({ id: row.id, index: i, status: 'no_image_url' });
          continue;
        }

        // Download image from fal.ai
        const imgResp = await fetch(imageUrl);
        if (!imgResp.ok) {
          results.push({ id: row.id, index: i, status: 'download_error' });
          continue;
        }

        // Upload to R2
        const r2Key = `images/toeic/${row.id}_${i}.jpg`;
        await bucket!.put(r2Key, imgResp.body, {
          httpMetadata: { contentType: 'image/jpeg' },
        });

        // Update question with image URL
        q.image_url = `/api/audio/${r2Key}`;
        updated = true;
        results.push({ id: row.id, index: i, status: 'ok', r2_key: r2Key });
      } catch (e: any) {
        results.push({ id: row.id, index: i, status: 'error', error: e.message });
      }
    }

    // Save updated content back to D1
    if (updated) {
      await c.env.DB.prepare('UPDATE test_contents SET content = ? WHERE id = ?')
        .bind(JSON.stringify(content), row.id)
        .run();
    }
  }

  return c.json({ processed: results.length, results });
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

      // Send report with inline keyboard button to view visual report card
      const webappUrl = env.WEBAPP_URL || 'https://edubot-webapp.pages.dev';
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgId,
          text: report,
          reply_markup: {
            inline_keyboard: [[
              { text: '📊 Lihat Report Card', web_app: { url: `${webappUrl}/report-card` } }
            ]]
          }
        }),
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
    `SELECT COUNT(*) as count FROM attempt_answers WHERE submitted_at >= ? AND NOT (is_correct IS NULL AND section NOT IN ('speaking','writing'))`
  ).bind(weekAgoStr).first() as any;

  // Get weekly accuracy (speaking/writing use score in answer_data, not is_correct)
  const weeklyAccuracy = await env.DB.prepare(
    `SELECT
       SUM(CASE
         WHEN is_correct = 1 THEN 1
         WHEN is_correct IS NULL AND section IN ('speaking','writing')
              AND json_extract(answer_data, '$.score') >= 5 THEN 1
         ELSE 0
       END) as correct,
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

// Hourly — cleanup abandoned test attempts
async function handleAbandonedAttemptCleanup(env: Env) {
  try {
    // Cleanup: mark abandoned test attempts (in_progress with 0 answers, older than 4 hours)
    const result = await env.DB.prepare(
      `UPDATE test_attempts SET status = 'abandoned', finished_at = datetime('now')
       WHERE status = 'in_progress'
       AND id NOT IN (SELECT DISTINCT attempt_id FROM attempt_answers)
       AND started_at < datetime('now', '-4 hours')`
    ).run();

    if (result.meta?.changes > 0) {
      console.log(`Marked ${result.meta.changes} test attempts as abandoned`);
    }
  } catch (e) {
    console.error('Abandoned attempt cleanup error:', e);
  }
}

// Daily data integrity check — alerts admin on Telegram if critical issues found
async function handleIntegrityCheck(env: Env) {
  try {
    const issues: string[] = [];

    // 1. Check for orphaned attempts (started yesterday, 0 answers, not abandoned)
    const orphaned = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM test_attempts ta
      WHERE ta.started_at > datetime('now', '-24 hours')
      AND (SELECT COUNT(*) FROM attempt_answers aa WHERE aa.attempt_id = ta.id) = 0
      AND ta.current_question_index = 0
    `).first() as any;
    if (orphaned?.count > 3) {
      issues.push(`⚠️ ${orphaned.count} test attempts with 0 answers in last 24h — possible answer submission failure`);
    }

    // 2. FK integrity check
    const fkResults = await env.DB.prepare(`
      SELECT m.name as table_name, p."table" as referenced_table
      FROM sqlite_master m, pragma_foreign_key_list(m.name) p
      WHERE m.type = 'table'
    `).all();
    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all();
    const tableNames = new Set((tables.results || []).map((t: any) => t.name));
    const brokenFKs = (fkResults.results || []).filter((fk: any) => !tableNames.has(fk.referenced_table));
    if (brokenFKs.length > 0) {
      issues.push(`🔴 Broken FK constraints: ${brokenFKs.map((b: any) => `${b.table_name} → ${b.referenced_table}`).join(', ')}`);
    }

    // 3. Test the actual answer write path
    try {
      await env.DB.prepare(
        "INSERT INTO attempt_answers (attempt_id, section, question_index, answer_data) VALUES (-999, '_health', 0, '{}')"
      ).run();
      await env.DB.prepare(
        "DELETE FROM attempt_answers WHERE attempt_id = -999 AND section = '_health'"
      ).run();
    } catch (e: any) {
      issues.push(`🔴 Answer INSERT test FAILED: ${e.message}`);
    }

    // 4. Check answer rate vs attempt rate (last 24h)
    const stats = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM test_attempts WHERE started_at > datetime('now', '-24 hours')) as attempts,
        (SELECT COUNT(*) FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE ta.started_at > datetime('now', '-24 hours')) as answers
    `).first() as any;
    if (stats?.attempts > 5 && stats?.answers === 0) {
      issues.push(`🔴 CRITICAL: ${stats.attempts} attempts but 0 answers saved in last 24h — answer submission is broken!`);
    }

    // Send alert to admin if issues found
    if (issues.length > 0) {
      const admins = await env.DB.prepare("SELECT telegram_id FROM users WHERE role = 'admin'").all();
      const msg = `🚨 *EduBot Integrity Alert*\n\n${issues.join('\n\n')}\n\n🔧 Check /api/health/deep for details`;

      for (const admin of admins.results as any[]) {
        const tgId = parseInt(String(admin.telegram_id).replace('.0', ''));
        try {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: tgId, text: msg, parse_mode: 'Markdown' }),
          });
        } catch {}
      }
      console.error('Integrity issues found:', issues);
    }
  } catch (e) {
    console.error('Integrity check error:', e);
  }
}

// Daily content health check — detect and report content quality issues
async function handleContentHealthCheck(env: Env) {
  try {
    const issues: string[] = [];

    // 1. Check for newly broken media URLs (published content with non-HTTP URLs)
    const brokenMedia = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM test_contents
      WHERE status = 'published' AND media_url IS NOT NULL AND media_url != ''
      AND media_url NOT LIKE 'http://%' AND media_url NOT LIKE 'https://%'
    `).first() as any;
    if (brokenMedia?.count > 0) {
      issues.push(`🔗 ${brokenMedia.count} published questions with broken media URLs`);
    }

    // 2. Check for invalid JSON content
    const allPublished = await env.DB.prepare(
      "SELECT id, content FROM test_contents WHERE status = 'published'"
    ).all();
    let invalidJson = 0;
    for (const row of (allPublished.results || []) as any[]) {
      try {
        JSON.parse(row.content || '{}');
      } catch {
        invalidJson++;
      }
    }
    if (invalidJson > 0) {
      issues.push(`📄 ${invalidJson} published questions with invalid JSON`);
    }

    // 3. Check content distribution — flag severely underserved test types
    const distribution = await env.DB.prepare(`
      SELECT test_type, section, COUNT(*) as count
      FROM test_contents WHERE status = 'published'
      GROUP BY test_type, section
    `).all();

    const sectionCounts: Record<string, number> = {};
    for (const row of (distribution.results || []) as any[]) {
      sectionCounts[`${row.test_type}/${row.section}`] = (row as any).count;
    }

    const criticalGaps: string[] = [];
    const minThreshold = 20;
    const expectedSections = [
      'TOEFL_IBT/reading', 'TOEFL_IBT/listening', 'TOEFL_IBT/writing', 'TOEFL_IBT/speaking',
      'IELTS/reading', 'IELTS/listening', 'IELTS/writing', 'IELTS/speaking',
      'TOEFL_ITP/listening', 'TOEFL_ITP/structure', 'TOEFL_ITP/reading',
      'TOEIC/listening', 'TOEIC/reading',
    ];
    for (const key of expectedSections) {
      const count = sectionCounts[key] || 0;
      if (count < minThreshold) {
        criticalGaps.push(`${key}: ${count} questions`);
      }
    }
    if (criticalGaps.length > 0) {
      issues.push(`📊 Low content sections:\n  ${criticalGaps.join('\n  ')}`);
    }

    // 4. Check draft questions count (pending review)
    const draftCount = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM test_contents WHERE status = 'draft'"
    ).first() as any;
    if (draftCount?.count > 50) {
      issues.push(`📝 ${draftCount.count} questions in draft status awaiting review`);
    }

    // Report to admin if issues found
    if (issues.length > 0) {
      const admins = await env.DB.prepare("SELECT telegram_id FROM users WHERE role = 'admin'").all();
      const totalPublished = allPublished.results?.length || 0;
      const healthScore = totalPublished > 0
        ? Math.round(((totalPublished - (brokenMedia?.count || 0) - invalidJson) / totalPublished) * 100)
        : 0;

      const msg = `📋 *Content Health Report*\n` +
        `Health Score: ${healthScore}%\n` +
        `Total Published: ${totalPublished}\n\n` +
        `${issues.join('\n\n')}\n\n` +
        `🔧 Use /admin to review and fix issues`;

      for (const admin of admins.results as any[]) {
        const tgId = parseInt(String(admin.telegram_id).replace('.0', ''));
        try {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: tgId, text: msg, parse_mode: 'Markdown' }),
          });
        } catch {}
      }
    }

    console.log(`Content health check: ${issues.length} issues found`);
  } catch (e) {
    console.error('Content health check error:', e);
  }
}

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Check which cron triggered — explicit match for all patterns
    if (event.cron === '3 1 * * *') {
      // Morning cron (8:03 AM WIB) — study reminders + daily quiz + channel posts
      ctx.waitUntil(handleCron(env));
      // Also run daily integrity check
      ctx.waitUntil(handleIntegrityCheck(env));
      // Daily content quality check
      ctx.waitUntil(handleContentHealthCheck(env));
      // Notion daily sync — students only (attempts run at evening cron)
      ctx.waitUntil(handleNotionSync(env, 'students'));
    } else if (event.cron === '7 1 * * 1') {
      // Monday weekly leaderboard (8:07 AM WIB)
      ctx.waitUntil(handleWeeklyCron(env));
      // Notion weekly reports sync
      ctx.waitUntil(handleNotionWeeklySync(env));
    } else if (event.cron === '0 11 * * *') {
      // Evening channel post (6 PM WIB = 11 AM UTC)
      ctx.waitUntil(handleEveningCron(env));
      // Notion attempts sync (separate from students to stay under subrequest limit)
      ctx.waitUntil(handleNotionSync(env, 'attempts'));
    } else if (event.cron === '30 * * * *') {
      // Hourly — channel content rotation + cancel expired payments + cleanup abandoned attempts
      ctx.waitUntil(handleHourlyChannelCron(env));
      ctx.waitUntil(handlePaymentExpiryCron(env));
      ctx.waitUntil(handleAbandonedAttemptCleanup(env));
    } else {
      console.warn(`Unknown cron pattern: ${event.cron}`);
    }
  },
};