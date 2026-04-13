import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';

export const contentRoutes = new Hono<{ Bindings: Env }>();

// Middleware: require teacher role
async function requireTeacher(c: any, next: any) {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  if (user.role !== 'teacher' && user.role !== 'admin') {
    return c.json({ error: 'Teacher access required' }, 403);
  }
  c.set('user', user);
  return next();
}

contentRoutes.use('/*', requireTeacher);

contentRoutes.get('/', async (c) => {
  const testType = c.req.query('test_type');
  const section = c.req.query('section');
  const status = c.req.query('status');

  let query = 'SELECT * FROM test_contents WHERE 1=1';
  const params: any[] = [];

  if (testType) { query += ' AND test_type = ?'; params.push(testType); }
  if (section) { query += ' AND section = ?'; params.push(section); }
  if (status) { query += ' AND status = ?'; params.push(status); }

  query += ' ORDER BY created_at DESC';

  const stmt = c.env.DB.prepare(query);
  const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

  return c.json(result.results.map((r: any) => ({
    ...r,
    content: JSON.parse(r.content || '{}'),
  })));
});

contentRoutes.post('/', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  const body = await c.req.json();

  await c.env.DB.prepare(
    `INSERT INTO test_contents (test_type, section, question_type, title, content, media_url, difficulty, topic, source, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'curated', 'draft', ?)`
  ).bind(
    body.test_type, body.section, body.question_type,
    body.title || null, JSON.stringify(body.content),
    body.media_url || null, body.difficulty || 3, body.topic || null,
    user.id,
  ).run();

  return c.json({ status: 'created' }, 201);
});

contentRoutes.put('/:id', async (c) => {
  const contentId = parseInt(c.req.param('id'));
  const body = await c.req.json();

  await c.env.DB.prepare(
    `UPDATE test_contents SET test_type = ?, section = ?, question_type = ?, title = ?,
     content = ?, media_url = ?, difficulty = ?, topic = ?, updated_at = ? WHERE id = ?`
  ).bind(
    body.test_type, body.section, body.question_type,
    body.title || null, JSON.stringify(body.content),
    body.media_url || null, body.difficulty || 3, body.topic || null,
    new Date().toISOString(), contentId,
  ).run();

  return c.json({ status: 'updated' });
});

// Content health check — scan all published content for issues
contentRoutes.get('/health', async (c) => {
  const results = await c.env.DB.prepare(
    "SELECT id, test_type, section, question_type, content, media_url FROM test_contents WHERE status = 'published'"
  ).all();

  const issues: { id: number; type: string; problems: string[] }[] = [];
  let healthy = 0;

  for (const row of results.results as any[]) {
    const problems: string[] = [];

    // Check JSON
    let content: any;
    try {
      content = JSON.parse(row.content || '{}');
    } catch {
      problems.push('Invalid JSON');
    }

    // Check media URL
    if (row.media_url && !row.media_url.startsWith('http')) {
      problems.push('Non-HTTP media URL');
    }

    // Check empty content
    if (content && !content.question_text && !content.passage_text && !content.passage &&
        !content.direction && !content.questions?.length) {
      problems.push('No question content');
    }

    if (problems.length > 0) {
      issues.push({ id: row.id, type: `${row.test_type}/${row.section}/${row.question_type}`, problems });
    } else {
      healthy++;
    }
  }

  const total = results.results.length;
  const score = total > 0 ? Math.round((healthy / total) * 100) : 100;

  return c.json({
    total_published: total,
    healthy,
    issues_count: issues.length,
    health_score: `${score}%`,
    issues: issues.slice(0, 50), // Limit response size
  });
});

contentRoutes.put('/:id/publish', async (c) => {
  const contentId = parseInt(c.req.param('id'));

  // Fetch the content first
  const row = await c.env.DB.prepare(
    'SELECT * FROM test_contents WHERE id = ?'
  ).bind(contentId).first();

  if (!row) return c.json({ error: 'Content not found' }, 404);

  // Validation checks
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Parse JSON content
  let content: any;
  try {
    content = JSON.parse(row.content as string || '{}');
  } catch (e) {
    errors.push('Invalid JSON in content field');
  }

  if (content) {
    // 2. Check for question text
    const hasQuestionText = content.question_text || content.passage_text || content.passage ||
      content.direction || (content.questions?.length > 0);
    if (!hasQuestionText) {
      warnings.push('No question text, passage, or direction found');
    }

    // 3. Check for correct answer (for objective question types)
    const objectiveTypes = ['multiple_choice', 'reading_passage', 'error_identification',
      'true_false_not_given', 'matching', 'matching_headings', 'matching_information',
      'matching_features', 'incomplete_sentences', 'insert_text', 'prose_summary',
      'photographs', 'question_response', 'sentence_completion'];

    if (objectiveTypes.includes(row.question_type as string)) {
      const hasAnswer = content.answers?.length > 0 ||
        (content.questions?.some((q: any) => q.answers?.length > 0));
      if (!hasAnswer) {
        errors.push('Objective question missing correct answer (answers field)');
      }
    }

    // 4. Check grouped questions have sub-questions
    if (['grouped_reading', 'grouped_listening', 'grouped_writing', 'grouped_speaking'].includes(content.type)) {
      if (!content.questions || content.questions.length === 0) {
        errors.push('Grouped content has no sub-questions');
      }
    }

    // 5. Check options for MCQ types
    if (['multiple_choice', 'reading_passage', 'incomplete_sentences'].includes(row.question_type as string)) {
      const hasOptions = content.options?.length >= 2 ||
        content.questions?.some((q: any) => q.options?.length >= 2);
      if (!hasOptions) {
        warnings.push('Multiple choice question has fewer than 2 options');
      }
    }
  }

  // 6. Validate media URL if present
  const mediaUrl = row.media_url as string;
  if (mediaUrl && mediaUrl.length > 0) {
    if (!mediaUrl.startsWith('http://') && !mediaUrl.startsWith('https://')) {
      errors.push(`Invalid media URL: "${mediaUrl.substring(0, 50)}" (must start with http:// or https://)`);
    }
  }

  // Block publish if there are errors
  if (errors.length > 0) {
    return c.json({
      status: 'validation_failed',
      id: contentId,
      errors,
      warnings,
      message: 'Fix errors before publishing'
    }, 400);
  }

  // Publish with warnings (non-blocking)
  await c.env.DB.prepare(
    "UPDATE test_contents SET status = 'published', updated_at = datetime('now') WHERE id = ?"
  ).bind(contentId).run();

  return c.json({
    status: 'published',
    id: contentId,
    warnings: warnings.length > 0 ? warnings : undefined
  });
});

contentRoutes.delete('/:id', async (c) => {
  const contentId = parseInt(c.req.param('id'));
  await c.env.DB.prepare(
    "UPDATE test_contents SET status = 'archived' WHERE id = ?"
  ).bind(contentId).run();
  return c.json({ status: 'archived', id: contentId });
});
