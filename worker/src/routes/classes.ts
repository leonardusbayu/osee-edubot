import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';

export const classRoutes = new Hono<{ Bindings: Env }>();

// Create a class (teacher only)
classRoutes.post('/', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  const { name, description, test_type } = await c.req.json();
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  await c.env.DB.prepare(
    'INSERT INTO classes (teacher_id, name, description, test_type, invite_code) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.id, name, description || '', test_type || 'TOEFL_IBT', inviteCode).run();

  return c.json({ status: 'created', invite_code: inviteCode, name });
});

// List teacher's classes
classRoutes.get('/', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let classes;
  if (user.role === 'teacher' || user.role === 'admin') {
    classes = await c.env.DB.prepare(
      'SELECT c.*, (SELECT COUNT(*) FROM class_enrollments WHERE class_id = c.id AND status = ?) as student_count FROM classes c WHERE c.teacher_id = ?'
    ).bind('active', user.id).all();
  } else {
    classes = await c.env.DB.prepare(
      `SELECT c.* FROM classes c
       JOIN class_enrollments ce ON c.id = ce.class_id
       WHERE ce.user_id = ? AND ce.status = 'active'`
    ).bind(user.id).all();
  }

  return c.json(classes.results);
});

// Join a class by invite code
classRoutes.post('/join', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { invite_code } = await c.req.json();
  const cls = await c.env.DB.prepare(
    'SELECT * FROM classes WHERE invite_code = ? AND is_active = 1'
  ).bind(invite_code.toUpperCase()).first();

  if (!cls) return c.json({ error: 'Invalid invite code' }, 404);

  // Check if already enrolled
  const existing = await c.env.DB.prepare(
    'SELECT id FROM class_enrollments WHERE user_id = ? AND class_id = ?'
  ).bind(user.id, cls.id).first();

  if (existing) return c.json({ error: 'Already enrolled' }, 400);

  await c.env.DB.prepare(
    'INSERT INTO class_enrollments (user_id, class_id) VALUES (?, ?)'
  ).bind(user.id, cls.id).run();

  return c.json({ status: 'joined', class_name: cls.name });
});

// Get class students with progress (teacher only)
classRoutes.get('/:id/students', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  const classId = parseInt(c.req.param('id'));

  const students = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.username, u.proficiency_level, u.target_test,
       (SELECT COUNT(*) FROM test_attempts WHERE user_id = u.id AND status = 'completed') as tests_taken,
       (SELECT COUNT(*) FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE ta.user_id = u.id) as questions_answered,
       (SELECT COUNT(*) FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE ta.user_id = u.id AND aa.is_correct = 1) as correct_answers,
       (SELECT total_score FROM test_results tr JOIN test_attempts ta ON tr.attempt_id = ta.id WHERE ta.user_id = u.id ORDER BY tr.created_at DESC LIMIT 1) as latest_score,
       (SELECT estimated_band FROM diagnostic_results WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as diagnostic_band
     FROM users u
     JOIN class_enrollments ce ON u.id = ce.user_id
     WHERE ce.class_id = ? AND ce.status = 'active'
     ORDER BY u.name`
  ).bind(classId).all();

  return c.json(students.results.map((s: any) => ({
    ...s,
    accuracy: s.questions_answered > 0 ? Math.round((s.correct_answers / s.questions_answered) * 100) : 0,
  })));
});

// Broadcast message to class (teacher only)
classRoutes.post('/:id/broadcast', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  const classId = parseInt(c.req.param('id'));
  const { message } = await c.req.json();

  const students = await c.env.DB.prepare(
    `SELECT u.telegram_id FROM users u
     JOIN class_enrollments ce ON u.id = ce.user_id
     WHERE ce.class_id = ? AND ce.status = 'active'`
  ).bind(classId).all();

  let sent = 0;
  for (const s of students.results as any[]) {
    const tgId = parseInt(String(s.telegram_id).replace('.0', ''));
    try {
      await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgId, text: message }),
      });
      sent++;
    } catch {}
  }

  return c.json({ sent, total: students.results.length });
});
