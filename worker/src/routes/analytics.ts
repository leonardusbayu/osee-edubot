import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';

export const analyticsRoutes = new Hono<{ Bindings: Env }>();

// Teacher dashboard — full class analytics
analyticsRoutes.get('/dashboard', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  const classId = c.req.query('class_id');

  // Total students
  const students = classId
    ? await c.env.DB.prepare("SELECT COUNT(*) as c FROM class_enrollments WHERE class_id = ? AND status = 'active'").bind(classId).first() as any
    : await c.env.DB.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').bind('student').first() as any;

  // Active today
  const today = new Date().toISOString().split('T')[0];
  const activeToday = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT ta.user_id) as c FROM attempt_answers aa
     JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE aa.submitted_at >= ?`
  ).bind(today).first() as any;

  // Total questions answered this week
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const weekActivity = await c.env.DB.prepare(
    `SELECT COUNT(*) as total, SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) as correct
     FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id=ta.id WHERE aa.submitted_at >= ?`
  ).bind(weekAgo).first() as any;

  // Average band score
  const avgScore = await c.env.DB.prepare(
    'SELECT AVG(band_score) as avg FROM test_results WHERE band_score IS NOT NULL'
  ).first() as any;

  // Weakest sections across all students
  const weakSections = await c.env.DB.prepare(
    `SELECT aa.section, COUNT(*) as total,
     SUM(CASE WHEN aa.is_correct=1 THEN 1 ELSE 0 END) as correct
     FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id=ta.id
     GROUP BY aa.section ORDER BY (CAST(correct AS FLOAT)/total) ASC`
  ).all();

  // Top students
  const topStudents = await c.env.DB.prepare(
    `SELECT u.name, COUNT(aa.id) as questions, SUM(CASE WHEN aa.is_correct=1 THEN 1 ELSE 0 END) as correct
     FROM users u JOIN test_attempts ta ON u.id=ta.user_id JOIN attempt_answers aa ON ta.id=aa.attempt_id
     GROUP BY u.id ORDER BY correct DESC LIMIT 10`
  ).all();

  // API costs
  const costs = await c.env.DB.prepare(
    "SELECT SUM(cost_usd) as total FROM api_usage"
  ).first() as any;

  return c.json({
    total_students: students?.c || 0,
    active_today: activeToday?.c || 0,
    week_questions: weekActivity?.total || 0,
    week_accuracy: weekActivity?.total > 0 ? Math.round(((weekActivity?.correct || 0) / weekActivity.total) * 100) : 0,
    avg_band_score: avgScore?.avg ? Math.round(avgScore.avg * 10) / 10 : null,
    weak_sections: weakSections.results.map((s: any) => ({
      section: s.section,
      accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
      total: s.total,
    })),
    top_students: topStudents.results.map((s: any) => ({
      name: s.name,
      questions: s.questions,
      accuracy: s.questions > 0 ? Math.round((s.correct / s.questions) * 100) : 0,
    })),
    api_cost: costs?.total || 0,
  });
});

// Student activity heatmap — hours × days
analyticsRoutes.get('/heatmap', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  // Count activity by hour and day of week (last 30 days)
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const activity = await c.env.DB.prepare(
    `SELECT strftime('%w', aa.submitted_at) as day_of_week,
            strftime('%H', aa.submitted_at) as hour,
            COUNT(*) as count
     FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id=ta.id
     WHERE aa.submitted_at >= ?
     GROUP BY day_of_week, hour`
  ).bind(monthAgo).all();

  // Build 7x24 grid
  const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
  for (const row of activity.results as any[]) {
    const day = parseInt(row.day_of_week);
    const hour = parseInt(row.hour);
    if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
      grid[day][hour] = row.count;
    }
  }

  return c.json({
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    hours: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    data: grid,
  });
});

// Auto question difficulty — recalculate from student performance
analyticsRoutes.post('/calibrate-difficulty', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user || user.role !== 'admin') return c.json({ error: 'Admin only' }, 403);

  // For each question, calculate accuracy → set difficulty
  // This is a heavy operation — update in batches
  const questions = await c.env.DB.prepare(
    `SELECT tc.id, COUNT(aa.id) as attempts,
     SUM(CASE WHEN aa.is_correct=1 THEN 1 ELSE 0 END) as correct
     FROM test_contents tc
     LEFT JOIN attempt_answers aa ON aa.question_id = tc.id
     WHERE tc.status = 'published'
     GROUP BY tc.id
     HAVING attempts >= 5`
  ).all();

  let updated = 0;
  for (const q of questions.results as any[]) {
    const accuracy = q.attempts > 0 ? (q.correct / q.attempts) * 100 : 50;
    let difficulty = 3;
    if (accuracy >= 90) difficulty = 1;      // Too easy
    else if (accuracy >= 70) difficulty = 2; // Easy
    else if (accuracy >= 50) difficulty = 3; // Medium
    else if (accuracy >= 30) difficulty = 4; // Hard
    else difficulty = 5;                     // Very hard

    await c.env.DB.prepare('UPDATE test_contents SET difficulty = ? WHERE id = ?')
      .bind(difficulty, q.id).run();
    updated++;
  }

  return c.json({ calibrated: updated });
});

// Churn prediction — find inactive students to re-engage
analyticsRoutes.get('/churn-risk', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  // Students with no activity in 3+ days
  const atRisk = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.telegram_id, MAX(aa.submitted_at) as last_active,
     COUNT(aa.id) as total_questions
     FROM users u
     LEFT JOIN test_attempts ta ON u.id = ta.user_id
     LEFT JOIN attempt_answers aa ON ta.id = aa.attempt_id
     WHERE u.role = 'student'
     GROUP BY u.id
     HAVING last_active < ? OR last_active IS NULL
     ORDER BY last_active ASC`
  ).bind(threeDaysAgo).all();

  return c.json({
    at_risk: atRisk.results.map((s: any) => ({
      id: s.id,
      name: s.name,
      telegram_id: s.telegram_id,
      last_active: s.last_active || 'never',
      total_questions: s.total_questions || 0,
      risk_level: !s.last_active ? 'high' : s.last_active < sevenDaysAgo ? 'high' : 'medium',
    })),
    total_at_risk: atRisk.results.length,
  });
});

// Re-engage inactive students (send reminder)
analyticsRoutes.post('/re-engage', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  const { user_ids, message } = await c.req.json();
  if (!user_ids?.length) return c.json({ error: 'No users specified' }, 400);

  const defaultMsg = message || 'Hai! Sudah beberapa hari kamu nggak latihan. Yuk kembali belajar — ketik /study untuk mulai!';
  let sent = 0;

  for (const uid of user_ids) {
    const u = await c.env.DB.prepare('SELECT telegram_id FROM users WHERE id = ?').bind(uid).first() as any;
    if (!u) continue;
    const tgId = parseInt(String(u.telegram_id).replace('.0', ''));
    try {
      await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgId, text: defaultMsg }),
      });
      sent++;
    } catch {}
  }

  return c.json({ sent, total: user_ids.length });
});

// A/B testing — store and compare prompt variants
analyticsRoutes.post('/ab-test', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user || user.role !== 'admin') return c.json({ error: 'Admin only' }, 403);

  const { test_name, variant_a, variant_b } = await c.req.json();

  // Store A/B test config in analytics
  await c.env.DB.prepare(
    "INSERT INTO analytics (event, data) VALUES ('ab_test_created', ?)"
  ).bind(JSON.stringify({ test_name, variant_a, variant_b, created: new Date().toISOString() })).run();

  return c.json({ status: 'created', test_name });
});

// Get A/B test results
analyticsRoutes.get('/ab-results', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user || user.role !== 'admin') return c.json({ error: 'Admin only' }, 403);

  const tests = await c.env.DB.prepare(
    "SELECT data FROM analytics WHERE event = 'ab_test_created' ORDER BY created_at DESC LIMIT 10"
  ).all();

  return c.json({ tests: tests.results.map((t: any) => JSON.parse(t.data || '{}')) });
});
