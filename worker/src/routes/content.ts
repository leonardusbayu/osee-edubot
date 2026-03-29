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
  const user = c.get('user');
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

contentRoutes.put('/:id/publish', async (c) => {
  const contentId = parseInt(c.req.param('id'));
  await c.env.DB.prepare(
    "UPDATE test_contents SET status = 'published' WHERE id = ?"
  ).bind(contentId).run();
  return c.json({ status: 'published', id: contentId });
});

contentRoutes.delete('/:id', async (c) => {
  const contentId = parseInt(c.req.param('id'));
  await c.env.DB.prepare(
    "UPDATE test_contents SET status = 'archived' WHERE id = ?"
  ).bind(contentId).run();
  return c.json({ status: 'archived', id: contentId });
});
