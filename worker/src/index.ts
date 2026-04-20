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
import { tutorRoutes } from './routes/tutor';
import { writingRoutes } from './routes/writing';
import { gameRoutes } from './routes/games';
import { certificateRoutes } from './routes/certificates';
import { analyticsRoutes } from './routes/analytics';
import { channelAnalyticsRoutes } from './routes/channel-analytics';
import { premiumRoutes } from './routes/premium';
import { paymentRoutes } from './routes/payment';
import { handbookRoutes } from './routes/handbook';
import { weaknessRoutes } from './routes/weakness';
import { adminApiRoutes } from './routes/admin-api';
import { contentReportsRoutes } from './routes/content-reports';
import { anomaliesRoutes } from './routes/anomalies';
import { runAnomalyDetection } from './services/anomaly-detector';
import { runItemAnalysis } from './services/item-analyzer';
import { auditRoutes } from './routes/audit';
import { visualRoutes } from './routes/visual';
import { runContentAudit } from './services/content-auditor';
import { runAiQualitySampler } from './services/ai-quality-sampler';
import { calibrationRoutes } from './routes/calibration';
import { computeCalibration } from './services/calibration';
import { runRetestReliability } from './services/retest-reliability';
import { runWhisperQa } from './services/whisper-qa';
import { runSloSnapshot } from './services/op-slo';
import { handleNotionSync, handleNotionWeeklySync } from './services/notion-sync';
import { resolveWeeklyLeagues, notifyLeagueChanges } from './services/leagues';
import { recalibrateItems } from './services/irt-engine';

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

// CORS — restrict browser origins to the known mini app + localhost. External
// API clients (server-to-server) don't send Origin at all, so they bypass the
// browser's CORS enforcement anyway; we only need to whitelist origins that
// browsers will actually send. Previously this fell back to echoing any
// origin, which defeated the point of the allowlist.
app.use('/api/*', cors({
  origin: (origin, c) => {
    if (!origin) return ''; // non-browser / server-to-server — no CORS headers needed
    const allowed = [
      c.env.WEBAPP_URL,
      'https://edubot-webapp.pages.dev',
      'http://localhost:5173',
      'http://localhost:3000',
    ].filter(Boolean);
    if (allowed.includes(origin)) return origin;
    // Trust any *.pages.dev preview for the edubot-webapp project — Cloudflare
    // generates per-deploy preview URLs that we can't enumerate ahead of time.
    if (/^https:\/\/[a-z0-9-]+\.edubot-webapp\.pages\.dev$/.test(origin)) return origin;
    // Admin API clients authenticating via X-API-Key are server-side, so a
    // CORS reflection isn't strictly required; return '' to block the browser
    // preflight and rely on the explicit API key check in the route handlers.
    return '';
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
app.route('/api/games', gameRoutes);
app.route('/api/certificates', certificateRoutes);
app.route('/api/analytics', analyticsRoutes);
app.route('/api/channel-analytics', channelAnalyticsRoutes);
app.route('/api/weakness', weaknessRoutes);
app.route('/api/premium', premiumRoutes);
app.route('/api/payment', paymentRoutes);
app.route('/api/handbook', handbookRoutes);
app.route('/api/tutor', tutorRoutes);
app.route('/api/v1/admin', adminApiRoutes);
app.route('/api/content-reports', contentReportsRoutes);
app.route('/api/anomalies', anomaliesRoutes);
app.route('/api/audit', auditRoutes);
app.route('/api/visual', visualRoutes);
app.route('/api/calibration', calibrationRoutes);

// Lightweight content-issue report endpoint — used by the in-test "🚩 Lapor"
// button. Writes to error_logs (source='client', error_type='content_report')
// so existing admin tooling can surface flagged questions without a new table.
app.post('/api/content/report', async (c) => {
  try {
    const { getAuthUser } = await import('./services/auth');
    const user = await getAuthUser(c.req.raw, c.env);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json().catch(() => ({}));
    const contentId = body?.content_id ?? null;
    const reason = String(body?.reason || 'unspecified').slice(0, 64);
    const note = body?.note ? String(body.note).slice(0, 500) : null;
    const attemptId = body?.attempt_id ?? null;

    if (!contentId) return c.json({ error: 'content_id required' }, 400);

    await c.env.DB.prepare(
      `INSERT INTO error_logs (source, error_type, message, user_id, url, metadata)
       VALUES ('client', 'content_report', ?, ?, ?, ?)`
    ).bind(
      `Content report: ${reason}`,
      user.id,
      `content:${contentId}`,
      JSON.stringify({ content_id: contentId, attempt_id: attemptId, reason, note }),
    ).run();

    return c.json({ ok: true });
  } catch (e: any) {
    console.error('content/report error:', e);
    return c.json({ error: 'Failed to record report' }, 500);
  }
});

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

// Push a message to a user's Telegram chat. Wraps the raw Bot API call so
// one blocked/deactivated user (403/400 from Telegram) doesn't abort the
// entire cron loop. Returns true on 2xx, false otherwise.
async function safeSendMessage(
  env: Env,
  chatId: number,
  body: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, ...body }),
    });
    if (!res.ok) {
      const status = res.status;
      // 403 = user blocked bot; 400 often = chat not found. Both are
      // per-user and shouldn't cascade; just log and move on.
      if (status !== 403 && status !== 400) {
        console.warn(`[cron] sendMessage failed to ${chatId}: ${status}`);
      }
      return false;
    }
    return true;
  } catch (e: any) {
    console.warn(`[cron] sendMessage error to ${chatId}: ${e?.message || e}`);
    return false;
  }
}

// Cron handler for daily notifications
async function handleCron(env: Env) {
  try {
    const { maybeAppendNudge } = await import('./services/companion-nudge');

    // Find all users with active study plans
    const users = await env.DB.prepare(
      "SELECT u.id, u.telegram_id, u.name, sp.current_day, sp.total_days FROM users u JOIN study_plans sp ON u.id = sp.user_id WHERE sp.status = 'active'"
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

      // Piggyback a feature-discovery tip onto the reminder (1/day cap means
      // no extra notifications — same message, slightly richer body).
      const nudge = await maybeAppendNudge(env, user.id).catch(() => '');
      const message = `${greeting}\n\n${progressBar} ${progress}%\nDay ${user.current_day + 1} of ${user.total_days} — tinggal ${daysLeft} hari lagi!\n\nSiap belajar? Ketik /today yuk!${nudge}`;

      await safeSendMessage(env, tgId, { text: message });
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

      await safeSendMessage(env, tgId, {
        text: `Ada ${user.due_count} soal yang perlu kamu review nih! Ketik /review untuk mulai. 🧠\n\n${nudge}`,
      });
    }
    // Emotional intelligence: exam countdown + monthly milestones
    try {
      const { getExamCountdownMessage, checkMonthlyMilestone } = await import('./services/companion');

      // Exam countdown for students with upcoming test dates
      const studentsWithExams = await env.DB.prepare(`
        SELECT u.id, u.telegram_id, u.name, sp.target_date
        FROM users u JOIN study_plans sp ON u.id = sp.user_id
        WHERE sp.status = 'active' AND sp.target_date IS NOT NULL
        AND sp.target_date >= date('now')
        AND sp.target_date <= date('now', '+7 days')
      `).all();

      for (const s of studentsWithExams.results as any[]) {
        try {
          const daysUntil = Math.round((new Date(s.target_date).getTime() - Date.now()) / 86400000);
          const msg = await getExamCountdownMessage(env, s.id, s.name || 'Teman', daysUntil);
          if (msg) {
            const tgId = parseInt(String(s.telegram_id).replace('.0', ''));
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: tgId, text: msg }),
            });
          }
        } catch (e) { console.error('Exam countdown error:', e); }
      }

      // Monthly milestones — check active users
      const activeUsers = await env.DB.prepare(`
        SELECT id, telegram_id, name FROM users
        WHERE onboarding_complete = 1
        AND id IN (SELECT DISTINCT user_id FROM conversation_messages WHERE created_at > datetime('now', '-60 days'))
        LIMIT 100
      `).all();

      for (const u of activeUsers.results as any[]) {
        try {
          const msg = await checkMonthlyMilestone(env, u.id, u.name || 'Teman');
          if (msg) {
            const tgId = parseInt(String(u.telegram_id).replace('.0', ''));
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: tgId, text: msg }),
            });
          }
        } catch (e) { console.error('Monthly milestone error:', e); }
      }
    } catch (e) {
      console.error('Emotional cron error:', e);
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
      await safeSendMessage(env, tgId, {
        text: report,
        reply_markup: {
          inline_keyboard: [[
            { text: '📊 Lihat Report Card', web_app: { url: `${webappUrl}/report-card` } }
          ]]
        }
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
      await safeSendMessage(env, tgId, { text: report });
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

// Hourly — notify premium users whose access expires within 2 hours (one-shot per user)
async function handleTrialExpiryPush(env: Env) {
  try {
    // Ensure tracking table exists (idempotent)
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS premium_expiry_notifications (
         user_id INTEGER PRIMARY KEY,
         notified_at TEXT NOT NULL,
         notified_for_expiry TEXT NOT NULL
       )`
    ).run();

    // Find users whose premium_until is between now and now+2h,
    // and who haven't been notified for this specific expiry yet
    const soon = await env.DB.prepare(
      `SELECT u.id, u.telegram_id, u.name, u.premium_until
       FROM users u
       LEFT JOIN premium_expiry_notifications n ON n.user_id = u.id
       WHERE u.is_premium = 1
         AND u.is_founding_student = 0
         AND u.premium_until IS NOT NULL
         AND datetime(u.premium_until) > datetime('now')
         AND datetime(u.premium_until) <= datetime('now', '+2 hours')
         AND (n.notified_for_expiry IS NULL OR n.notified_for_expiry != u.premium_until)`
    ).all();

    for (const row of (soon.results || []) as any[]) {
      const tgId = parseInt(String(row.telegram_id || '').replace('.0', ''));
      if (!tgId) continue;

      const until = new Date(row.premium_until);
      const minsLeft = Math.max(0, Math.round((until.getTime() - Date.now()) / 60000));

      const text = `⏰ *Premium kamu akan expire sebentar lagi!*\n\n` +
        `Hai ${row.name || 'kamu'}, premium kamu berakhir dalam ~${minsLeft} menit.\n\n` +
        `Perpanjang sekarang biar nggak kehilangan:\n` +
        `• ✅ Unlimited question\n` +
        `• 🎤 Speaking evaluation\n` +
        `• 📝 Writing feedback AI\n` +
        `• 🤖 AI Tutor 24/7\n\n` +
        `Ketik /premium untuk lihat harga.`;

      try {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgId,
            text,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '💳 Perpanjang Premium', callback_data: 'buy_premium' },
              ]],
            },
          }),
        });

        await env.DB.prepare(
          `INSERT OR REPLACE INTO premium_expiry_notifications (user_id, notified_at, notified_for_expiry)
           VALUES (?, datetime('now'), ?)`
        ).bind(row.id, row.premium_until).run();
      } catch (e) {
        console.error('Trial expiry push per-user error:', e);
      }
    }
  } catch (e) {
    console.error('Trial expiry push cron error:', e);
  }
}

/**
 * Daily error digest — runs once per day at morning cron. Summarizes the last
 * 24h of error_logs, grouped by error_type + source, and pings admins.
 */
async function handleErrorDigestCron(env: Env) {
  try {
    const summary = await env.DB.prepare(
      `SELECT source, error_type, COUNT(*) as count,
              MAX(created_at) as last_seen,
              MIN(message) as sample_message
       FROM error_logs
       WHERE created_at > datetime('now', '-24 hours')
       GROUP BY source, error_type
       ORDER BY count DESC
       LIMIT 15`
    ).all() as any;

    const total = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM error_logs WHERE created_at > datetime('now', '-24 hours')`
    ).first() as any;

    if (!summary.results || summary.results.length === 0) {
      // All quiet — skip notification to avoid alert fatigue
      return;
    }

    let msg = `📋 *Daily Error Digest* (24h)\n\n`;
    msg += `Total errors: *${total?.c || 0}*\n\n`;
    msg += `Top error types:\n`;
    for (const row of summary.results as any[]) {
      const sample = ((row.sample_message || '').substring(0, 80)).replace(/[_*`]/g, '');
      msg += `• [${row.source}] ${row.error_type} — ${row.count}x\n  _${sample}_\n`;
    }
    msg += `\nLihat detail di admin dashboard.`;

    const admins = await env.DB.prepare(
      "SELECT telegram_id FROM users WHERE role = 'admin'"
    ).all();
    for (const admin of (admins.results || []) as any[]) {
      const tgId = parseInt(String(admin.telegram_id).replace('.0', ''));
      if (!tgId) continue;
      try {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tgId, text: msg, parse_mode: 'Markdown' }),
        });
      } catch {}
    }
  } catch (e) {
    console.error('Error digest cron failed:', e);
  }
}

/**
 * Hourly 5xx spike detector — compare current hour's 5xx error count vs the
 * trailing 7-day average for this hour. Alert admins if count > 3× baseline
 * (and at least 5 errors so a single noisy hour doesn't page).
 */
async function handleErrorSpikeAlert(env: Env) {
  try {
    // Idempotency: at most one alert per hour per source/error_type combo
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS error_spike_alerts (
         window_hour TEXT NOT NULL,
         source TEXT NOT NULL,
         alerted_at TEXT NOT NULL,
         PRIMARY KEY (window_hour, source)
       )`
    ).run();

    const windowHour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH

    const recent = await env.DB.prepare(
      `SELECT source, COUNT(*) as count
       FROM error_logs
       WHERE created_at > datetime('now', '-1 hour')
         AND (error_type LIKE '5%' OR error_type = 'server_error' OR source = 'server')
       GROUP BY source
       HAVING count >= 5`
    ).all() as any;

    for (const row of (recent.results || []) as any[]) {
      // Baseline: same hour-of-day across last 7 days
      const baseline = await env.DB.prepare(
        `SELECT COUNT(*) * 1.0 / 7 as avg
         FROM error_logs
         WHERE source = ?
           AND created_at > datetime('now', '-8 days')
           AND created_at < datetime('now', '-1 hour')
           AND strftime('%H', created_at) = strftime('%H', 'now')
           AND (error_type LIKE '5%' OR error_type = 'server_error' OR source = 'server')`
      ).bind(row.source).first() as any;

      const avg = Math.max(1, Number(baseline?.avg || 1));
      if (row.count < 3 * avg) continue;

      // Already alerted this window?
      const already = await env.DB.prepare(
        `SELECT 1 FROM error_spike_alerts WHERE window_hour = ? AND source = ?`
      ).bind(windowHour, row.source).first();
      if (already) continue;

      const msg = `🚨 *5xx spike detected*\n\n` +
        `Source: *${row.source}*\n` +
        `Last hour: *${row.count}* errors\n` +
        `Baseline (7d avg this hour): ~${avg.toFixed(1)}\n` +
        `Ratio: ${(row.count / avg).toFixed(1)}×\n\n` +
        `Check Cloudflare logs + error_logs table.`;

      const admins = await env.DB.prepare(
        "SELECT telegram_id FROM users WHERE role = 'admin'"
      ).all();
      for (const admin of (admins.results || []) as any[]) {
        const tgId = parseInt(String(admin.telegram_id).replace('.0', ''));
        if (!tgId) continue;
        try {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: tgId, text: msg, parse_mode: 'Markdown' }),
          });
        } catch {}
      }

      await env.DB.prepare(
        `INSERT OR IGNORE INTO error_spike_alerts (window_hour, source, alerted_at)
         VALUES (?, ?, datetime('now'))`
      ).bind(windowHour, row.source).run();
    }
  } catch (e) {
    console.error('Error spike alert failed:', e);
  }
}

/**
 * Streak-loss warning push — runs hourly, but only fires in the last window of
 * the WIB day (18:00–22:59 WIB = 11:00–15:59 UTC). If a user has a streak ≥ 2
 * and hasn't studied today (WIB), nudge them once to come back before midnight.
 */
async function handleStreakWarningPush(env: Env) {
  try {
    // Only run in the WIB warning window
    const nowUTC = new Date();
    const utcHour = nowUTC.getUTCHours();
    if (utcHour < 11 || utcHour > 15) return;

    // Ensure tracking table exists
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS streak_warning_notifications (
         user_id INTEGER NOT NULL,
         wib_date TEXT NOT NULL,
         notified_at TEXT NOT NULL,
         PRIMARY KEY (user_id, wib_date)
       )`
    ).run();

    // Current WIB date (YYYY-MM-DD)
    const wibFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const todayWIB = wibFmt.format(nowUTC);

    // Users with streak >= 2 who haven't studied today WIB and haven't been warned today
    const atRisk = await env.DB.prepare(
      `SELECT u.id, u.telegram_id, u.name, u.current_streak, u.last_study_date
       FROM users u
       LEFT JOIN streak_warning_notifications n
         ON n.user_id = u.id AND n.wib_date = ?
       WHERE COALESCE(u.current_streak, 0) >= 2
         AND COALESCE(u.last_study_date, '') != ?
         AND n.user_id IS NULL
         AND u.telegram_id IS NOT NULL
       LIMIT 500`
    ).bind(todayWIB, todayWIB).all();

    for (const row of (atRisk.results || []) as any[]) {
      const tgId = parseInt(String(row.telegram_id || '').replace('.0', ''));
      if (!tgId) continue;

      const streak = row.current_streak || 0;
      const fire = streak >= 30 ? '🔥🔥🔥' : streak >= 7 ? '🔥🔥' : '🔥';

      const text = `${fire} Hai ${row.name || 'kamu'}! Streak belajar kamu ${streak} hari lagi terancam putus.\n\n` +
        `Cukup jawab 1 soal hari ini buat amanin. Tinggal ~${23 - (utcHour + 7)} jam sebelum reset jam 00:00 WIB.\n\n` +
        `Ketik /review atau /today — 2 menit aja cukup.`;

      try {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgId,
            text,
          }),
        });

        await env.DB.prepare(
          `INSERT OR IGNORE INTO streak_warning_notifications (user_id, wib_date, notified_at)
           VALUES (?, ?, datetime('now'))`
        ).bind(row.id, todayWIB).run();
      } catch (e) {
        console.error('Streak warning push per-user error:', e);
      }
    }
  } catch (e) {
    console.error('Streak warning push cron error:', e);
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

    // Also cleanup stale diagnostic sessions (in_progress older than 1 hour)
    const diagResult = await env.DB.prepare(
      `UPDATE diagnostic_sessions SET status = 'abandoned'
       WHERE status = 'in_progress'
       AND created_at < datetime('now', '-1 hour')`
    ).run();
    if (diagResult.meta?.changes > 0) {
      console.log(`Marked ${diagResult.meta.changes} diagnostic sessions as abandoned`);
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

    // 5. HEAD-check a sample of http(s) media URLs to catch 404s that slip
    //    past publish-time format validation. Capped at 50/run to protect
    //    the worker's CPU/time budget; over time every URL gets checked.
    try {
      const withHttpMedia = await env.DB.prepare(`
        SELECT id, media_url FROM test_contents
         WHERE status = 'published'
           AND (media_url LIKE 'http://%' OR media_url LIKE 'https://%')
         ORDER BY RANDOM() LIMIT 50
      `).all();
      const dead: number[] = [];
      await Promise.all(((withHttpMedia.results || []) as any[]).map(async (row) => {
        try {
          const res = await fetch(row.media_url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok && (res.status === 404 || res.status === 403 || res.status === 410)) {
            dead.push(row.id);
          }
        } catch {
          // Network error / timeout — don't auto-flag as dead (may be transient).
        }
      }));
      if (dead.length > 0) {
        issues.push(`🚫 ${dead.length} published questions have 404/403 media URLs (ids: ${dead.slice(0, 10).join(', ')}${dead.length > 10 ? '…' : ''})`);
      }
    } catch (e) {
      console.error('[content-health] media HEAD sweep failed:', (e as any)?.message);
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

// Wrap any async task with a try/catch so a single cron handler's failure
// can't take down siblings or leave errors unlogged. Each handleXxx() already
// has its own try/catch, but this guards against edge cases (e.g. a promise
// rejection before the handler's try block, or a future refactor that forgets
// to add a wrapper inside a new handler).
function safeTask(label: string, fn: () => Promise<unknown>): Promise<void> {
  return (async () => {
    try {
      await fn();
    } catch (e: any) {
      console.error(`[cron:${label}] failed:`, e?.message || e);
    }
  })();
}

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Check which cron triggered — explicit match for all patterns
    if (event.cron === '3 1 * * *') {
      // Morning cron (8:03 AM WIB) — study reminders + daily quiz + channel posts
      ctx.waitUntil(safeTask('morning', () => handleCron(env)));
      // Also run daily integrity check
      ctx.waitUntil(safeTask('integrity', () => handleIntegrityCheck(env)));
      // Daily content quality check
      ctx.waitUntil(safeTask('content-health', () => handleContentHealthCheck(env)));
      // Daily anomaly detection — flag content with low accuracy / high skip rate
      ctx.waitUntil(
        (async () => {
          try {
            const r = await runAnomalyDetection(env, 30);
            console.log('[anomaly-detector]', JSON.stringify(r));
          } catch (e) {
            console.error('[anomaly-detector] failed:', (e as any)?.message || e);
          }
        })(),
      );
      // Daily item analysis — detects mis-keyed MCQs via discrimination stats
      ctx.waitUntil(
        (async () => {
          try {
            const r = await runItemAnalysis(env);
            console.log('[item-analysis]', JSON.stringify(r));
          } catch (e) {
            console.error('[item-analysis] failed:', (e as any)?.message || e);
          }
        })(),
      );
      // Daily Whisper transcript QA — flag broken speaking transcripts
      ctx.waitUntil(
        (async () => {
          try {
            const r = await runWhisperQa(env, { lookbackDays: 3, notes: 'daily cron' });
            console.log('[whisper-qa]', JSON.stringify(r));
          } catch (e) {
            console.error('[whisper-qa] failed:', (e as any)?.message || e);
          }
        })(),
      );
      // Daily error digest for admins
      ctx.waitUntil(safeTask('error-digest', () => handleErrorDigestCron(env)));
      // Notion daily sync — students only (attempts run at evening cron)
      ctx.waitUntil(safeTask('notion-students', () => handleNotionSync(env, 'students')));
    } else if (event.cron === '7 1 * * 1') {
      // Monday weekly leaderboard (8:07 AM WIB)
      ctx.waitUntil(safeTask('weekly', () => handleWeeklyCron(env)));
      // Notion weekly reports sync
      ctx.waitUntil(safeTask('notion-weekly', () => handleNotionWeeklySync(env)));
      // Weekly full content audit — scans every published row via validator
      ctx.waitUntil(
        (async () => {
          try {
            const r = await runContentAudit(env, { notes: 'weekly cron' });
            console.log('[content-audit]', JSON.stringify({
              run_id: r.run_id, scanned: r.scanned, errors: r.errors,
              warnings: r.warnings, duration_ms: r.duration_ms,
            }));
          } catch (e) {
            console.error('[content-audit] failed:', (e as any)?.message || e);
          }
        })(),
      );
      // Weekly AI quality sampler (50 items, ~$0.003)
      ctx.waitUntil(
        (async () => {
          try {
            const r = await runAiQualitySampler(env, { sampleSize: 50, notes: 'weekly cron' });
            console.log('[ai-quality]', JSON.stringify({
              run_id: r.run_id, scored: r.scored, failed: r.failed,
              avg_overall: r.avg_overall, fail_count: r.fail_count,
              cost_usd: r.total_cost_usd, duration_ms: r.duration_ms,
            }));
          } catch (e) {
            console.error('[ai-quality] failed:', (e as any)?.message || e);
          }
        })(),
      );
      // Weekly calibration snapshot — compares bot prediction vs. real test scores
      ctx.waitUntil(
        (async () => {
          try {
            const snaps = await computeCalibration(env);
            console.log('[calibration]', JSON.stringify({ snapshots: snaps.length, types: snaps.map((s) => s.test_type) }));
          } catch (e) {
            console.error('[calibration] failed:', (e as any)?.message || e);
          }
        })(),
      );
      // Weekly test-retest reliability
      ctx.waitUntil(
        (async () => {
          try {
            const r = await runRetestReliability(env, 7 * 24);
            console.log('[retest-reliability]', JSON.stringify(r));
          } catch (e) {
            console.error('[retest-reliability] failed:', (e as any)?.message || e);
          }
        })(),
      );
      // Weekly league resolution — promote/demote based on weekly XP
      ctx.waitUntil(
        (async () => {
          try {
            const r = await resolveWeeklyLeagues(env);
            console.log('[leagues]', JSON.stringify(r));
            // Notify every user who promoted or demoted. Without this step
            // the league transitions were invisible to students —
            // motivational payoff of the whole system was dead.
            try {
              const notifyResult = await notifyLeagueChanges(env, env.TELEGRAM_BOT_TOKEN);
              console.log('[leagues-notify]', JSON.stringify(notifyResult));
            } catch (notifyErr: any) {
              console.error('[leagues-notify] failed:', notifyErr?.message || notifyErr);
            }
          } catch (e) {
            console.error('[leagues] failed:', (e as any)?.message || e);
          }
        })(),
      );
      // Weekly IRT item recalibration — update difficulty/discrimination from response data
      ctx.waitUntil(
        (async () => {
          try {
            const r = await recalibrateItems(env.DB);
            console.log('[irt-recalibrate]', JSON.stringify(r));
          } catch (e) {
            console.error('[irt-recalibrate] failed:', (e as any)?.message || e);
          }
        })(),
      );
    } else if (event.cron === '0 11 * * *') {
      // Evening channel post (6 PM WIB = 11 AM UTC)
      ctx.waitUntil(safeTask('evening', () => handleEveningCron(env)));
      // Notion attempts sync (separate from students to stay under subrequest limit)
      ctx.waitUntil(safeTask('notion-attempts', () => handleNotionSync(env, 'attempts')));
      // Companion outreach — proactive re-engagement for idle students (6 PM is prime time)
      ctx.waitUntil(
        (async () => {
          try {
            const { runCompanionOutreach } = await import('./services/companion');
            const r = await runCompanionOutreach(env);
            console.log('[companion]', JSON.stringify(r));
          } catch (e) {
            console.error('[companion] failed:', (e as any)?.message || e);
          }
        })(),
      );
    } else if (event.cron === '30 * * * *') {
      // Hourly — channel content rotation + cancel expired payments + cleanup abandoned attempts + trial expiry nudge
      ctx.waitUntil(safeTask('hourly-channel', () => handleHourlyChannelCron(env)));
      ctx.waitUntil(safeTask('payment-expiry', () => handlePaymentExpiryCron(env)));
      ctx.waitUntil(safeTask('abandoned-attempts', () => handleAbandonedAttemptCleanup(env)));
      ctx.waitUntil(safeTask('trial-expiry', () => handleTrialExpiryPush(env)));
      ctx.waitUntil(safeTask('streak-warning', () => handleStreakWarningPush(env)));
      ctx.waitUntil(safeTask('error-spike', () => handleErrorSpikeAlert(env)));
      // Hourly operational SLO snapshot — fires alerts on error spikes
      ctx.waitUntil(
        (async () => {
          try {
            const r = await runSloSnapshot(env);
            if (r.alerts_fired.length || r.alerts_resolved.length) {
              console.log('[slo]', JSON.stringify(r));
            }
          } catch (e) {
            console.error('[slo] failed:', (e as any)?.message || e);
          }
        })(),
      );
    } else {
      console.warn(`Unknown cron pattern: ${event.cron}`);
    }
  },
};