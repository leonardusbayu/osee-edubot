import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';

export const tutorRoutes = new Hono<{ Bindings: Env }>();

/**
 * Stash a pending question from the mini app (e.g. "ask AI why this answer
 * was wrong") so the bot can pick it up when the user is deep-linked via
 * /start ask. Avoids cramming the full question into the 64-char start param.
 */
tutorRoutes.post('/pending-question', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json().catch(() => ({})) as { question?: string };
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question || question.length < 3) {
    return c.json({ error: 'Question text required' }, 400);
  }
  if (question.length > 4000) {
    return c.json({ error: 'Question too long' }, 400);
  }

  // Ensure table exists
  await c.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS pending_tutor_questions (
       user_id INTEGER PRIMARY KEY,
       question TEXT NOT NULL,
       created_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  ).run();

  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO pending_tutor_questions (user_id, question, created_at)
     VALUES (?, ?, datetime('now'))`
  ).bind(user.id, question).run();

  return c.json({ success: true });
});
