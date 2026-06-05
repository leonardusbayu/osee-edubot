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

// Week 4: Auto-publish a "vocab of the day" article from real
// test_contents. The channel's daily vocab post links to
// /api/blog/article/vocab-of-the-day, so this function keeps that link
// alive with fresh content. Idempotent — re-running on the same day
// updates the same row (slug is date-stamped).
export async function publishVocabOfTheDay(env: Env, date: Date = new Date()): Promise<BlogArticle | null> {
  // Pick today's word — same logic as generateVocabularyOfTheDay but
  // deterministic per date so multiple invocations on the same day
  // produce the same article.
  const ACADEMIC_WORDS = [
    { word: 'mitigate',     pos: 'verb', indonesian: 'meringankan dampak' },
    { word: 'substantiate', pos: 'verb', indonesian: 'membuktikan' },
    { word: 'paradigm',     pos: 'noun', indonesian: 'pola / kerangka pikir' },
    { word: 'ephemeral',    pos: 'adj',  indonesian: 'tidak kekal' },
    { word: 'catalyst',     pos: 'noun', indonesian: 'pemicu perubahan' },
    { word: 'pragmatic',    pos: 'adj',  indonesian: 'realistis' },
    { word: 'exacerbate',   pos: 'verb', indonesian: 'memperburuk' },
    { word: 'pristine',     pos: 'adj',  indonesian: 'asli / belum tersentuh' },
    { word: 'ambiguous',    pos: 'adj',  indonesian: 'ambigu / tdk jelas' },
    { word: 'prevalent',    pos: 'adj',  indonesian: 'umum / banyak' },
    { word: 'coherent',     pos: 'adj',  indonesian: 'koheren / logis' },
    { word: 'undermine',    pos: 'verb', indonesian: 'melemahkan' },
    { word: 'nuance',       pos: 'noun', indonesian: 'nuansa / hal halus' },
    { word: 'compelling',   pos: 'adj',  indonesian: 'meyakinkan' },
    { word: 'viable',       pos: 'adj',  indonesian: 'layak / bisa diterapkan' },
    { word: 'detriment',    pos: 'noun', indonesian: 'kerugian / dampak buruk' },
    { word: 'inclination',  pos: 'noun', indonesian: 'kecenderungan' },
    { word: 'feasible',     pos: 'adj',  indonesian: 'layak laksana' },
    { word: 'concise',      pos: 'adj',  indonesian: 'ringkas' },
    { word: 'reluctant',    pos: 'adj',  indonesian: 'enggan / tdk mau' },
  ];
  const dayIndex = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
  const todayWord = ACADEMIC_WORDS[dayIndex % ACADEMIC_WORDS.length];

  // Pull a real example sentence from test_contents
  let example = '';
  let sourceContentId: number | null = null;
  try {
    const passageRows = await env.DB.prepare(
      `SELECT id, content FROM test_contents
       WHERE status = 'published' AND question_type IN ('read_academic_passage', 'read_in_daily_life', 'listen_academic_talk')
       ORDER BY RANDOM() LIMIT 10`
    ).all<{ id: number; content: string }>();
    for (const row of passageRows.results || []) {
      try {
        const c = JSON.parse(row.content);
        const text = c.passage_text || c.passage || c.script || '';
        const sentences = text.match(/[^.!?]{60,200}[.!?]/g) || [];
        for (const s of sentences) {
          if (s.length > 80 && s.length < 200) {
            example = s.trim();
            sourceContentId = row.id;
            break;
          }
        }
        if (example) break;
      } catch { /* skip */ }
    }
  } catch (e) {
    console.error('[blog] publishVocabOfTheDay D1 query error:', e);
  }
  if (!example) {
    example = `Researchers must use this word precisely in academic writing to avoid ambiguity.`;
  }

  const dateStr = date.toISOString().slice(0, 10);
  const slug = 'vocab-of-the-day';
  const title = `Vocab Hari Ini: "${todayWord.word}" — ${dateStr}`;
  const bodyHtml = `
<article>
  <p class="lead"><strong>${todayWord.word}</strong> (${todayWord.pos}) — <em>${todayWord.indonesian}</em></p>

  <h2>📖 Arti &amp; Penggunaan</h2>
  <p>Kata <strong>${todayWord.word}</strong> adalah salah satu kata academic yang paling sering muncul di TOEFL iBT, IELTS Academic, dan TOEIC. Memahami cara pakainya bisa langsung naikin skor lo di Reading &amp; Writing.</p>

  <h2>📝 Contoh Kalimat (dari soal asli)</h2>
  <blockquote>${example}</blockquote>

  <h2>🇮🇩 Artinya dalam Bahasa Indonesia</h2>
  <p>"${example}" → <em>${todayWord.indonesian} sesuai konteks.</em></p>

  <h2>💡 Tips Pake di Exam</h2>
  <ul>
    <li>TOEFL iBT Reading: sering muncul di vocabulary questions (cari sinonim/antonim)</li>
    <li>IELTS Writing Task 2: gunakan 1-2 kata academic per paragraph buat naikkan band score</li>
    <li>TOEFL iBT Speaking: pakai di Task 4 (lecture summary) untuk sound natural</li>
  </ul>

  <h2>🎯 Latihan</h2>
  <p>Coba bikin 2 kalimat pake kata <strong>${todayWord.word}</strong>:</p>
  <ol>
    <li>Kalimat tentang topik akademik (education, environment, atau technology)</li>
    <li>Kalimat tentang kehidupan sehari-hari</li>
  </ol>
  <p>Kirim jawaban lo ke bot EduBot di @edubot_bot dan dapet feedback gratis dari AI tutor.</p>
</article>`;

  return await publishArticle(env, {
    slug,
    title,
    topic: 'vocabulary',
    test_type: 'TOEFL_IBT',
    meta_description: `Vocab akademik "${todayWord.word}" — ${todayWord.indonesian}. Contoh kalimat dari soal asli, tips TOEFL/IELTS/TOEIC.`,
    body_html: bodyHtml,
    source_content_id: sourceContentId ?? undefined,
    status: 'published',
  });
}

// Same idea for the daily quiz — publish a real quiz-of-the-day
// article that links to the bot for the user to try.
export async function publishQuizOfTheDay(env: Env, date: Date = new Date()): Promise<BlogArticle | null> {
  let realExample = '';
  let sourceContentId: number | null = null;
  try {
    const rows = await env.DB.prepare(
      `SELECT id, content, section, test_type, question_type
       FROM test_contents
       WHERE status = 'published'
         AND question_type IN ('read_academic_passage','read_in_daily_life','complete_the_words','listen_choose_response')
       ORDER BY RANDOM() LIMIT 5`
    ).all<{ id: number; content: string; section: string; test_type: string; question_type: string }>();
    for (const row of rows.results || []) {
      try {
        const c = JSON.parse(row.content);
        const text = c.passage_text || c.passage || c.script || c.question_text || c.question || '';
        if (text.length > 100) {
          realExample = text.slice(0, 800);
          sourceContentId = row.id;
          break;
        }
      } catch { /* skip */ }
    }
  } catch (e) {
    console.error('[blog] publishQuizOfTheDay D1 query error:', e);
  }
  if (!realExample) {
    realExample = 'Open the bot and try a new practice question every day!';
  }
  const dateStr = date.toISOString().slice(0, 10);
  const slug = 'quiz-of-the-day';
  const title = `Quiz of the Day — ${dateStr}`;
  const bodyHtml = `
<article>
  <p class="lead"><strong>Daily practice question</strong> — ${dateStr}</p>

  <h2>📝 Passage</h2>
  <blockquote>${realExample}</blockquote>

  <h2>🎯 Try It</h2>
  <p>Open the EduBot mini app → Practice → Take a test, atau langsung buka bot di @edubot_bot dan ketik /test untuk soal lengkap dari bank soal asli.</p>

  <h2>📊 Kenapa Latihan Harian?</h2>
  <ul>
    <li>Reading: 1 passage per hari × 30 hari = 30 passages, setara 1 sesi TOEFL iBT penuh</li>
    <li>Spaced repetition: 10 menit/hari × 90 hari = band score naik 0.5-1.0</li>
    <li>Free tier: 10 soal/hari gratis, premium = unlimited</li>
  </ul>
</article>`;
  return await publishArticle(env, {
    slug,
    title,
    topic: 'practice',
    test_type: 'TOEFL_IBT',
    meta_description: `Quiz harian dari soal asli TOEFL/IELTS — ${dateStr}. Latihan gratis 10 soal/hari.`,
    body_html: bodyHtml,
    source_content_id: sourceContentId ?? undefined,
    status: 'published',
  });
}
