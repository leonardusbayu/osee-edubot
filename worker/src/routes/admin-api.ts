import { Hono } from 'hono';
import type { Env, User } from '../types';
import { getAuthUser } from '../services/auth';
import { buildStudentReport, buildStudentReportForAI } from '../services/student-report';

export const adminApiRoutes = new Hono<{ Bindings: Env }>();

// ─── Auth Middleware ─────────────────────────────────────────────
// Supports two auth methods:
// 1. API Key via X-API-Key header (for external apps)
// 2. JWT + role check (for mini app / browser)
// 3. x-admin-secret header (legacy, kept for backward compat)

async function requireAdmin(c: any, next: any) {
  // Method 1: API Key auth (for external app integration)
  const apiKey = c.req.header('X-API-Key');
  if (apiKey && c.env.ADMIN_API_KEY && apiKey === c.env.ADMIN_API_KEY) {
    c.set('authMethod', 'api_key');
    return next();
  }

  // Method 2: Legacy admin secret
  const adminSecret = c.req.header('x-admin-secret');
  if (adminSecret && c.env.ADMIN_API_KEY && adminSecret === c.env.ADMIN_API_KEY) {
    c.set('authMethod', 'admin_secret');
    return next();
  }

  // Method 3: JWT auth (mini app)
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized', message: 'Provide X-API-Key header or valid JWT' }, 401);
  if (user.role !== 'teacher' && user.role !== 'admin') {
    return c.json({ error: 'Forbidden', message: 'Admin or teacher role required' }, 403);
  }
  c.set('user', user);
  c.set('authMethod', 'jwt');
  return next();
}

adminApiRoutes.use('/*', requireAdmin);

// ═══════════════════════════════════════════════════════════════
// STUDENTS
// ═══════════════════════════════════════════════════════════════

// GET /students — List all students with summary stats
adminApiRoutes.get('/students', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const offset = (page - 1) * limit;
  const search = c.req.query('search') || '';
  const role = c.req.query('role') || '';
  const targetTest = c.req.query('target_test') || '';
  const sortBy = c.req.query('sort') || 'created_at';
  const order = c.req.query('order') === 'asc' ? 'ASC' : 'DESC';

  let where = '1=1';
  const params: any[] = [];

  if (search) {
    where += ' AND (u.name LIKE ? OR u.username LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (role) {
    where += ' AND u.role = ?';
    params.push(role);
  }
  if (targetTest) {
    where += ' AND u.target_test = ?';
    params.push(targetTest);
  }

  const allowedSorts: Record<string, string> = {
    created_at: 'u.created_at',
    name: 'u.name',
    role: 'u.role',
    accuracy: 'accuracy',
    questions_answered: 'questions_answered',
  };
  const sortCol = allowedSorts[sortBy] || 'u.created_at';

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM users u WHERE ${where}`
  ).bind(...params).first() as any;

  const students = await c.env.DB.prepare(
    `SELECT u.*,
       sp.learning_style, sp.communication_style, sp.depth_level,
       sp.confidence_score, sp.learning_pace, sp.frustration_score,
       (SELECT COUNT(*) FROM attempt_answers aa
        JOIN test_attempts ta ON aa.attempt_id = ta.id
        WHERE ta.user_id = u.id AND aa.is_correct IS NOT NULL) as questions_answered,
       (SELECT ROUND(AVG(CASE WHEN aa2.is_correct = 1 THEN 100.0 ELSE 0 END), 1)
        FROM attempt_answers aa2
        JOIN test_attempts ta2 ON aa2.attempt_id = ta2.id
        WHERE ta2.user_id = u.id AND aa2.is_correct IS NOT NULL) as accuracy,
       (SELECT COUNT(*) FROM spaced_repetition sr
        WHERE sr.user_id = u.id AND sr.next_review_at <= datetime('now')) as due_reviews,
       (SELECT MAX(aa3.submitted_at) FROM attempt_answers aa3
        JOIN test_attempts ta3 ON aa3.attempt_id = ta3.id
        WHERE ta3.user_id = u.id) as last_activity
     FROM users u
     LEFT JOIN student_profiles sp ON u.id = sp.user_id
     WHERE ${where}
     ORDER BY ${sortCol} ${order}
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return c.json({
    students: students.results,
    pagination: {
      page,
      limit,
      total: countResult?.total || 0,
      pages: Math.ceil((countResult?.total || 0) / limit),
    },
  });
});

// GET /students/:id — Deep student profile
adminApiRoutes.get('/students/:id', async (c) => {
  const userId = parseInt(c.req.param('id'));

  const [user, profile, mastery, mentalModel, recentAttempts, studyLogs, srStats, lessonPlans] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first(),
    c.env.DB.prepare('SELECT * FROM student_profiles WHERE user_id = ?').bind(userId).first(),
    c.env.DB.prepare(
      `SELECT topic, mastery_level, accuracy_percent, exercises_attempted,
              current_difficulty, highest_difficulty_passed, status,
              first_attempted_at, last_attempted_at
       FROM topic_mastery WHERE user_id = ? ORDER BY mastery_level DESC`
    ).bind(userId).all(),
    c.env.DB.prepare(
      `SELECT concept, believed_understanding, misconceptions, confidence, times_assessed, last_assessed_at
       FROM student_mental_model WHERE user_id = ? ORDER BY last_assessed_at DESC`
    ).bind(userId).all(),
    c.env.DB.prepare(
      `SELECT ta.id, ta.test_type, ta.section, ta.score, ta.total_questions, ta.status, ta.created_at
       FROM test_attempts ta WHERE ta.user_id = ? AND ta.status = 'completed'
       ORDER BY ta.created_at DESC LIMIT 20`
    ).bind(userId).all(),
    c.env.DB.prepare(
      `SELECT log_date, questions_answered, correct_answers, study_minutes, streak_count
       FROM daily_study_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT 30`
    ).bind(userId).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN next_review_at <= datetime('now') THEN 1 ELSE 0 END) as overdue,
              SUM(CASE WHEN review_level >= 4 THEN 1 ELSE 0 END) as mastered,
              AVG(review_level) as avg_level
       FROM spaced_repetition WHERE user_id = ?`
    ).bind(userId).first(),
    c.env.DB.prepare(
      `SELECT id, title, plan_type, status, progress_percent, total_steps, current_step, created_at
       FROM lesson_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`
    ).bind(userId).all(),
  ]);

  if (!user) return c.json({ error: 'Student not found' }, 404);

  // Section breakdown
  const sectionBreakdown = await c.env.DB.prepare(
    `SELECT aa.section,
            COUNT(*) as total,
            SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct
     FROM attempt_answers aa
     JOIN test_attempts ta ON aa.attempt_id = ta.id
     WHERE ta.user_id = ? AND aa.is_correct IS NOT NULL
     GROUP BY aa.section`
  ).bind(userId).all();

  return c.json({
    user,
    profile,
    mastery: mastery.results,
    mental_model: mentalModel.results.map((m: any) => ({
      ...m,
      misconceptions: m.misconceptions ? JSON.parse(m.misconceptions) : [],
    })),
    section_breakdown: sectionBreakdown.results,
    recent_attempts: recentAttempts.results,
    study_logs: studyLogs.results,
    spaced_repetition: srStats,
    lesson_plans: lessonPlans.results,
  });
});

// GET /students/:id/report — Full intelligence report (JSON)
adminApiRoutes.get('/students/:id/report', async (c) => {
  const userId = parseInt(c.req.param('id'));
  const report = await buildStudentReport(c.env, userId);
  if (!report) return c.json({ error: 'Student not found' }, 404);
  return c.json(report);
});

// GET /students/:id/report/ai — AI-optimized context string for lesson planning
adminApiRoutes.get('/students/:id/report/ai', async (c) => {
  const userId = parseInt(c.req.param('id'));
  const aiContext = await buildStudentReportForAI(c.env, userId);
  const format = c.req.query('format');
  if (format === 'json') {
    return c.json({ user_id: userId, ai_context: aiContext });
  }
  // Default: plain text (easy to inject into prompts)
  return new Response(aiContext, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
});

// PUT /students/:id/role — Update student role
adminApiRoutes.put('/students/:id/role', async (c) => {
  const userId = parseInt(c.req.param('id'));
  const { role } = await c.req.json();
  if (!['student', 'teacher', 'admin'].includes(role)) {
    return c.json({ error: 'Invalid role. Must be student, teacher, or admin' }, 400);
  }
  await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, userId).run();
  return c.json({ status: 'updated', user_id: userId, new_role: role });
});

// PUT /students/:id/profile — Update student profile fields
adminApiRoutes.put('/students/:id/profile', async (c) => {
  const userId = parseInt(c.req.param('id'));
  const body = await c.req.json();

  // Allowed user fields
  const userFields = ['name', 'target_test', 'proficiency_level'];
  const userUpdates: string[] = [];
  const userParams: any[] = [];
  for (const f of userFields) {
    if (body[f] !== undefined) {
      userUpdates.push(`${f} = ?`);
      userParams.push(body[f]);
    }
  }
  if (userUpdates.length > 0) {
    await c.env.DB.prepare(
      `UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`
    ).bind(...userParams, userId).run();
  }

  // Allowed profile fields
  const profileFields = ['learning_style', 'communication_style', 'depth_level', 'confidence_score', 'frustration_score', 'learning_pace'];
  const profileUpdates: string[] = [];
  const profileParams: any[] = [];
  for (const f of profileFields) {
    if (body[f] !== undefined) {
      profileUpdates.push(`${f} = ?`);
      profileParams.push(body[f]);
    }
  }
  if (profileUpdates.length > 0) {
    await c.env.DB.prepare(
      `UPDATE student_profiles SET ${profileUpdates.join(', ')} WHERE user_id = ?`
    ).bind(...profileParams, userId).run();
  }

  return c.json({ status: 'updated', user_id: userId });
});

// DELETE /students/:id — Soft-delete (set role to 'banned')
adminApiRoutes.delete('/students/:id', async (c) => {
  const userId = parseInt(c.req.param('id'));
  await c.env.DB.prepare("UPDATE users SET role = 'banned' WHERE id = ?").bind(userId).run();
  return c.json({ status: 'banned', user_id: userId });
});

// ═══════════════════════════════════════════════════════════════
// ANALYTICS / DASHBOARD
// ═══════════════════════════════════════════════════════════════

// GET /analytics/overview — System-wide stats
adminApiRoutes.get('/analytics/overview', async (c) => {
  const [
    totalUsers, activeToday, activeWeek, totalQuestions, publishedContent,
    premiumUsers, totalAttempts, weeklyAccuracy, sectionStats, topStudents
  ] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as c FROM users").first(),
    c.env.DB.prepare(
      `SELECT COUNT(DISTINCT user_id) as c FROM (
         SELECT ta.user_id FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE aa.submitted_at >= datetime('now', '-1 day')
         UNION SELECT user_id FROM user_messages WHERE created_at >= datetime('now', '-1 day')
         UNION SELECT user_id FROM tutor_interactions WHERE created_at >= datetime('now', '-1 day')
         UNION SELECT user_id FROM daily_study_logs WHERE log_date >= date('now', '-1 day')
       )`
    ).first(),
    c.env.DB.prepare(
      `SELECT COUNT(DISTINCT user_id) as c FROM (
         SELECT ta.user_id FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE aa.submitted_at >= datetime('now', '-7 days')
         UNION SELECT user_id FROM user_messages WHERE created_at >= datetime('now', '-7 days')
         UNION SELECT user_id FROM tutor_interactions WHERE created_at >= datetime('now', '-7 days')
         UNION SELECT user_id FROM daily_study_logs WHERE log_date >= date('now', '-7 days')
       )`
    ).first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM attempt_answers WHERE is_correct IS NOT NULL").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM test_contents WHERE status = 'published'").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE is_premium = 1").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM test_attempts WHERE status = 'completed'").first(),
    c.env.DB.prepare(
      `SELECT SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct,
              COUNT(*) as total
       FROM attempt_answers WHERE submitted_at >= datetime('now', '-7 days') AND is_correct IS NOT NULL`
    ).first(),
    c.env.DB.prepare(
      `SELECT aa.section, COUNT(*) as total,
              SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct
       FROM attempt_answers aa WHERE aa.is_correct IS NOT NULL
       GROUP BY aa.section`
    ).all(),
    c.env.DB.prepare(
      `SELECT u.id, u.name, u.username, COUNT(aa.id) as questions,
              ROUND(AVG(CASE WHEN aa.is_correct = 1 THEN 100.0 ELSE 0 END), 1) as accuracy
       FROM users u
       JOIN test_attempts ta ON u.id = ta.user_id
       JOIN attempt_answers aa ON ta.id = aa.attempt_id
       WHERE aa.is_correct IS NOT NULL AND aa.submitted_at >= datetime('now', '-7 days')
       GROUP BY u.id ORDER BY questions DESC LIMIT 10`
    ).all(),
  ]);

  const weeklyAcc = (weeklyAccuracy as any);

  return c.json({
    total_users: (totalUsers as any)?.c || 0,
    active_today: (activeToday as any)?.c || 0,
    active_this_week: (activeWeek as any)?.c || 0,
    total_questions_answered: (totalQuestions as any)?.c || 0,
    published_content: (publishedContent as any)?.c || 0,
    premium_users: (premiumUsers as any)?.c || 0,
    completed_attempts: (totalAttempts as any)?.c || 0,
    weekly_accuracy: weeklyAcc?.total > 0 ? Math.round((weeklyAcc.correct / weeklyAcc.total) * 100) : 0,
    section_breakdown: (sectionStats as any).results,
    top_students_this_week: (topStudents as any).results,
  });
});

// GET /analytics/trends — Daily activity over last N days
adminApiRoutes.get('/analytics/trends', async (c) => {
  const days = Math.min(parseInt(c.req.query('days') || '30'), 90);

  // Questions answered trend (from test answers)
  const questionTrends = await c.env.DB.prepare(
    `SELECT DATE(aa.submitted_at) as date,
            COUNT(*) as questions_answered,
            SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct,
            ROUND(AVG(CASE WHEN aa.is_correct = 1 THEN 100.0 ELSE 0 END), 1) as accuracy
     FROM attempt_answers aa
     JOIN test_attempts ta ON aa.attempt_id = ta.id
     WHERE aa.submitted_at >= datetime('now', '-' || ? || ' days')
     AND aa.is_correct IS NOT NULL
     GROUP BY DATE(aa.submitted_at)
     ORDER BY date ASC`
  ).bind(days).all();

  // Active users trend (from all activity sources)
  const activeUserTrends = await c.env.DB.prepare(
    `SELECT date, COUNT(DISTINCT user_id) as active_users FROM (
       SELECT DATE(aa.submitted_at) as date, ta.user_id FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE aa.submitted_at >= datetime('now', '-' || ? || ' days')
       UNION ALL SELECT DATE(created_at) as date, user_id FROM user_messages WHERE created_at >= datetime('now', '-' || ? || ' days')
       UNION ALL SELECT DATE(created_at) as date, user_id FROM tutor_interactions WHERE created_at >= datetime('now', '-' || ? || ' days')
     ) GROUP BY date ORDER BY date ASC`
  ).bind(days, days, days).all();

  // Merge question trends with active user counts
  const activeMap = new Map((activeUserTrends.results || []).map((r: any) => [r.date, r.active_users]));
  const trends = {
    results: (questionTrends.results || []).map((r: any) => ({
      ...r,
      active_users: activeMap.get(r.date) || 0,
    })),
  };
  // Add dates that have active users but no questions answered
  for (const [date, count] of activeMap) {
    if (!trends.results.find((r: any) => r.date === date)) {
      trends.results.push({ date, active_users: count, questions_answered: 0, correct: 0, accuracy: 0 });
    }
  }
  trends.results.sort((a: any, b: any) => a.date.localeCompare(b.date));

  const signups = await c.env.DB.prepare(
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM users WHERE created_at >= datetime('now', '-' || ? || ' days')
     GROUP BY DATE(created_at) ORDER BY date ASC`
  ).bind(days).all();

  return c.json({
    daily_activity: trends.results,
    daily_signups: signups.results,
  });
});

// GET /analytics/content-coverage — Question bank distribution
adminApiRoutes.get('/analytics/content-coverage', async (c) => {
  const coverage = await c.env.DB.prepare(
    `SELECT section, question_type, difficulty, COUNT(*) as count
     FROM test_contents WHERE status = 'published'
     GROUP BY section, question_type, difficulty
     ORDER BY section, question_type, difficulty`
  ).all();

  const totalBySection = await c.env.DB.prepare(
    `SELECT section, COUNT(*) as count FROM test_contents WHERE status = 'published'
     GROUP BY section ORDER BY section`
  ).all();

  return c.json({
    detailed: coverage.results,
    by_section: totalBySection.results,
  });
});

// ═══════════════════════════════════════════════════════════════
// MENTAL MODEL
// ═══════════════════════════════════════════════════════════════

// GET /mental-model/:userId — View a student's full mental model
adminApiRoutes.get('/mental-model/:userId', async (c) => {
  const userId = parseInt(c.req.param('userId'));

  const model = await c.env.DB.prepare(
    `SELECT * FROM student_mental_model WHERE user_id = ? ORDER BY concept ASC`
  ).bind(userId).all();

  const misconceptions = model.results.filter((m: any) => m.believed_understanding === 'misconception');
  const gaps = model.results.filter((m: any) => m.believed_understanding === 'unknown');
  const solid = model.results.filter((m: any) =>
    m.believed_understanding === 'solid' || m.believed_understanding === 'mastered'
  );

  return c.json({
    user_id: userId,
    total_concepts: model.results.length,
    misconceptions: misconceptions.length,
    knowledge_gaps: gaps.length,
    solid_understanding: solid.length,
    concepts: model.results.map((m: any) => ({
      ...m,
      misconceptions: m.misconceptions ? JSON.parse(m.misconceptions) : [],
      evidence: m.evidence ? JSON.parse(m.evidence) : [],
    })),
  });
});

// PUT /mental-model/:userId/:concept — Manually adjust a concept
adminApiRoutes.put('/mental-model/:userId/:concept', async (c) => {
  const userId = parseInt(c.req.param('userId'));
  const concept = c.req.param('concept');
  const { believed_understanding, confidence, notes } = await c.req.json();

  const existing = await c.env.DB.prepare(
    'SELECT id FROM student_mental_model WHERE user_id = ? AND concept = ?'
  ).bind(userId, concept).first();

  if (existing) {
    const updates: string[] = [];
    const params: any[] = [];
    if (believed_understanding) { updates.push('believed_understanding = ?'); params.push(believed_understanding); }
    if (confidence !== undefined) { updates.push('confidence = ?'); params.push(confidence); }
    if (notes) { updates.push("misconceptions = ?"); params.push(JSON.stringify([notes])); }
    updates.push("last_assessed_at = datetime('now')");

    await c.env.DB.prepare(
      `UPDATE student_mental_model SET ${updates.join(', ')} WHERE user_id = ? AND concept = ?`
    ).bind(...params, userId, concept).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO student_mental_model (user_id, concept, believed_understanding, confidence, misconceptions, evidence, times_assessed, last_assessed_at)
       VALUES (?, ?, ?, ?, '[]', '[]', 1, datetime('now'))`
    ).bind(userId, concept, believed_understanding || 'unknown', confidence || 0.5).run();
  }

  return c.json({ status: 'updated', user_id: userId, concept });
});

// ═══════════════════════════════════════════════════════════════
// LESSON PLANS
// ═══════════════════════════════════════════════════════════════

// GET /lessons — List all lesson plans (filterable)
adminApiRoutes.get('/lessons', async (c) => {
  const userId = c.req.query('user_id');
  const classId = c.req.query('class_id');
  const status = c.req.query('status');
  const planType = c.req.query('plan_type');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const offset = (page - 1) * limit;

  let where = '1=1';
  const params: any[] = [];
  if (userId) { where += ' AND lp.user_id = ?'; params.push(parseInt(userId)); }
  if (classId) { where += ' AND lp.class_id = ?'; params.push(parseInt(classId)); }
  if (status) { where += ' AND lp.status = ?'; params.push(status); }
  if (planType) { where += ' AND lp.plan_type = ?'; params.push(planType); }

  const result = await c.env.DB.prepare(
    `SELECT lp.*, u.name as student_name
     FROM lesson_plans lp
     LEFT JOIN users u ON lp.user_id = u.id
     WHERE ${where}
     ORDER BY lp.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM lesson_plans lp WHERE ${where}`
  ).bind(...params).first() as any;

  return c.json({
    lessons: result.results.map((lp: any) => ({
      ...lp,
      lessons: lp.lessons ? JSON.parse(lp.lessons) : [],
      target_skills: lp.target_skills ? JSON.parse(lp.target_skills) : [],
    })),
    pagination: {
      page, limit,
      total: countResult?.total || 0,
      pages: Math.ceil((countResult?.total || 0) / limit),
    },
  });
});

// GET /lessons/:id — Single lesson plan detail
adminApiRoutes.get('/lessons/:id', async (c) => {
  const planId = parseInt(c.req.param('id'));

  const plan = await c.env.DB.prepare(
    `SELECT lp.*, u.name as student_name
     FROM lesson_plans lp LEFT JOIN users u ON lp.user_id = u.id
     WHERE lp.id = ?`
  ).bind(planId).first() as any;

  if (!plan) return c.json({ error: 'Lesson plan not found' }, 404);

  const stepResults = await c.env.DB.prepare(
    `SELECT * FROM lesson_step_results WHERE plan_id = ? ORDER BY step_index ASC`
  ).bind(planId).all();

  return c.json({
    ...plan,
    lessons: plan.lessons ? JSON.parse(plan.lessons) : [],
    target_skills: plan.target_skills ? JSON.parse(plan.target_skills) : [],
    step_results: stepResults.results,
  });
});

// DELETE /lessons/:id — Remove a lesson plan
adminApiRoutes.delete('/lessons/:id', async (c) => {
  const planId = parseInt(c.req.param('id'));
  await c.env.DB.prepare("UPDATE lesson_plans SET status = 'archived' WHERE id = ?").bind(planId).run();
  return c.json({ status: 'archived', plan_id: planId });
});

// ═══════════════════════════════════════════════════════════════
// CONTENT MANAGEMENT (bulk operations)
// ═══════════════════════════════════════════════════════════════

// GET /content — List content with filtering
adminApiRoutes.get('/content', async (c) => {
  const section = c.req.query('section');
  const questionType = c.req.query('question_type');
  const difficulty = c.req.query('difficulty');
  const status = c.req.query('status') || 'published';
  const topic = c.req.query('topic');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const offset = (page - 1) * limit;

  let where = '1=1';
  const params: any[] = [];
  if (section) { where += ' AND section = ?'; params.push(section); }
  if (questionType) { where += ' AND question_type = ?'; params.push(questionType); }
  if (difficulty) { where += ' AND difficulty = ?'; params.push(parseInt(difficulty)); }
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (topic) { where += ' AND topic = ?'; params.push(topic); }

  const result = await c.env.DB.prepare(
    `SELECT * FROM test_contents WHERE ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM test_contents WHERE ${where}`
  ).bind(...params).first() as any;

  return c.json({
    content: result.results,
    pagination: {
      page, limit,
      total: countResult?.total || 0,
      pages: Math.ceil((countResult?.total || 0) / limit),
    },
  });
});

// POST /content/bulk-status — Bulk update content status
adminApiRoutes.post('/content/bulk-status', async (c) => {
  const { ids, status } = await c.req.json();
  if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: 'ids array required' }, 400);
  if (!['published', 'draft', 'archived'].includes(status)) return c.json({ error: 'Invalid status' }, 400);

  const placeholders = ids.map(() => '?').join(',');
  await c.env.DB.prepare(
    `UPDATE test_contents SET status = ? WHERE id IN (${placeholders})`
  ).bind(status, ...ids).run();

  return c.json({ status: 'updated', count: ids.length });
});

// POST /content/bulk-insert — Bulk insert questions (for content-factory integration)
adminApiRoutes.post('/content/bulk-insert', async (c) => {
  const { questions } = await c.req.json();
  if (!Array.isArray(questions) || questions.length === 0) {
    return c.json({ error: 'questions array required' }, 400);
  }

  const inserted: number[] = [];
  const errors: { index: number; error: string }[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    try {
      const result = await c.env.DB.prepare(
        `INSERT INTO test_contents (section, question_type, topic, difficulty, content, passage, direction, options, correct_answer, explanation, scoring_rubric, sample_response, skill_tags, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        q.section, q.question_type, q.topic || null, q.difficulty || 3,
        q.content, q.passage || null, q.direction || null,
        typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
        q.correct_answer || null, q.explanation || null,
        q.scoring_rubric || null, q.sample_response || null,
        q.skill_tags || null, q.status || 'published'
      ).run();
      inserted.push(result.meta?.last_row_id || 0);
    } catch (e: any) {
      errors.push({ index: i, error: e.message || 'Insert failed' });
    }
  }

  return c.json({ inserted: inserted.length, errors, ids: inserted });
});

// ═══════════════════════════════════════════════════════════════
// CLASSES
// ═══════════════════════════════════════════════════════════════

// GET /classes — List all classes with member counts
adminApiRoutes.get('/classes', async (c) => {
  const classes = await c.env.DB.prepare(
    `SELECT c.*,
       u.name as teacher_name,
       (SELECT COUNT(*) FROM class_members cm WHERE cm.class_id = c.id) as member_count
     FROM classes c
     LEFT JOIN users u ON c.teacher_id = u.id
     ORDER BY c.created_at DESC`
  ).all();

  return c.json({ classes: classes.results });
});

// GET /classes/:id/students — Students in a class with mastery
adminApiRoutes.get('/classes/:id/students', async (c) => {
  const classId = parseInt(c.req.param('id'));

  const students = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.username, u.proficiency_level, u.target_test,
       sp.confidence_score, sp.learning_pace, sp.frustration_score,
       (SELECT ROUND(AVG(CASE WHEN aa.is_correct = 1 THEN 100.0 ELSE 0 END), 1)
        FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id
        WHERE ta.user_id = u.id AND aa.is_correct IS NOT NULL) as accuracy,
       (SELECT COUNT(*) FROM attempt_answers aa2
        JOIN test_attempts ta2 ON aa2.attempt_id = ta2.id
        WHERE ta2.user_id = u.id AND aa2.is_correct IS NOT NULL) as questions_answered
     FROM class_members cm
     JOIN users u ON cm.user_id = u.id
     LEFT JOIN student_profiles sp ON u.id = sp.user_id
     WHERE cm.class_id = ?
     ORDER BY accuracy DESC`
  ).bind(classId).all();

  return c.json({ class_id: classId, students: students.results });
});

// ═══════════════════════════════════════════════════════════════
// SPACED REPETITION / FSRS
// ═══════════════════════════════════════════════════════════════

// GET /srs/overview — System-wide SRS stats
adminApiRoutes.get('/srs/overview', async (c) => {
  const stats = await c.env.DB.prepare(
    `SELECT
       COUNT(*) as total_items,
       SUM(CASE WHEN next_review_at <= datetime('now') THEN 1 ELSE 0 END) as total_overdue,
       SUM(CASE WHEN review_level >= 4 THEN 1 ELSE 0 END) as total_mastered,
       COUNT(DISTINCT user_id) as users_with_srs,
       AVG(review_level) as avg_level,
       AVG(correct_streak) as avg_streak
     FROM spaced_repetition`
  ).first();

  const perUser = await c.env.DB.prepare(
    `SELECT u.name, sr.user_id,
       COUNT(*) as items,
       SUM(CASE WHEN sr.next_review_at <= datetime('now') THEN 1 ELSE 0 END) as overdue,
       AVG(sr.review_level) as avg_level
     FROM spaced_repetition sr
     JOIN users u ON sr.user_id = u.id
     GROUP BY sr.user_id
     ORDER BY overdue DESC LIMIT 20`
  ).all();

  return c.json({ overview: stats, per_user: perUser.results });
});

// ═══════════════════════════════════════════════════════════════
// PREMIUM & REVENUE
// ═══════════════════════════════════════════════════════════════

// GET /premium/overview — Premium stats
adminApiRoutes.get('/premium/overview', async (c) => {
  const [premiumCount, revenue, recentPurchases, referralStats] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COUNT(*) as active FROM users WHERE is_premium = 1 AND premium_until > datetime('now')`
    ).first(),
    c.env.DB.prepare(
      `SELECT SUM(stars_amount) as total_stars, COUNT(*) as transactions
       FROM payment_requests WHERE status = 'completed'`
    ).first(),
    c.env.DB.prepare(
      `SELECT pr.*, u.name as user_name
       FROM payment_requests pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.status = 'completed'
       ORDER BY pr.completed_at DESC LIMIT 20`
    ).all(),
    c.env.DB.prepare(
      `SELECT COUNT(DISTINCT referred_by) as referrers,
              COUNT(*) as total_referrals,
              SUM(CASE WHEN is_premium = 1 THEN 1 ELSE 0 END) as premium_from_referral
       FROM users WHERE referred_by IS NOT NULL`
    ).first(),
  ]);

  return c.json({
    active_premium: (premiumCount as any)?.active || 0,
    total_stars_revenue: (revenue as any)?.total_stars || 0,
    total_transactions: (revenue as any)?.transactions || 0,
    recent_purchases: recentPurchases.results,
    referral_stats: referralStats,
  });
});

// ═══════════════════════════════════════════════════════════════
// SYSTEM CONFIG
// ═══════════════════════════════════════════════════════════════

// GET /system/tables — List all D1 tables with row counts
adminApiRoutes.get('/system/tables', async (c) => {
  const tables = await c.env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all();

  const counts: { name: string; rows: number }[] = [];
  for (const t of tables.results as any[]) {
    try {
      const count = await c.env.DB.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).first() as any;
      counts.push({ name: t.name, rows: count?.c || 0 });
    } catch {
      counts.push({ name: t.name, rows: -1 });
    }
  }

  return c.json({ tables: counts });
});

// GET /system/health — Deep health check
adminApiRoutes.get('/system/health', async (c) => {
  const checks: Record<string, any> = {};

  // Database connectivity
  try {
    const dbCheck = await c.env.DB.prepare("SELECT COUNT(*) as c FROM users").first() as any;
    checks.database = { status: 'ok', users: dbCheck?.c || 0 };
  } catch (e: any) {
    checks.database = { status: 'error', message: e.message };
  }

  // Content status
  try {
    const content = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM test_contents WHERE status = 'published'"
    ).first() as any;
    checks.content = { status: 'ok', published: content?.c || 0 };
  } catch (e: any) {
    checks.content = { status: 'error', message: e.message };
  }

  // SRS health
  try {
    const srs = await c.env.DB.prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN next_review_at <= datetime('now') THEN 1 ELSE 0 END) as overdue
       FROM spaced_repetition`
    ).first() as any;
    checks.srs = { status: 'ok', total: srs?.total || 0, overdue: srs?.overdue || 0 };
  } catch (e: any) {
    checks.srs = { status: 'error', message: e.message };
  }

  // R2 bucket
  checks.r2_audio = { status: c.env.AUDIO_BUCKET ? 'configured' : 'not_configured' };
  checks.r2_media = { status: c.env.MEDIA ? 'configured' : 'not_configured' };

  return c.json({
    status: Object.values(checks).every((ch: any) => ch.status === 'ok' || ch.status === 'configured') ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// POST /system/query — Run arbitrary read-only SQL (dangerous but useful)
adminApiRoutes.post('/system/query', async (c) => {
  const { sql, params: queryParams } = await c.req.json();
  if (!sql) return c.json({ error: 'sql field required' }, 400);

  // Safety: only allow SELECT statements
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('PRAGMA') && !trimmed.startsWith('EXPLAIN')) {
    return c.json({ error: 'Only SELECT, PRAGMA, and EXPLAIN statements allowed' }, 400);
  }

  try {
    const stmt = c.env.DB.prepare(sql);
    const result = queryParams && queryParams.length > 0
      ? await stmt.bind(...queryParams).all()
      : await stmt.all();
    return c.json({ results: result.results, meta: result.meta });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

// GET /export/students — CSV export of all students
adminApiRoutes.get('/export/students', async (c) => {
  const students = await c.env.DB.prepare(
    `SELECT u.id, u.telegram_id, u.name, u.username, u.role, u.target_test,
            u.proficiency_level, u.is_premium, u.premium_until, u.referral_count, u.created_at,
            sp.learning_style, sp.communication_style, sp.depth_level,
            sp.confidence_score, sp.frustration_score, sp.learning_pace
     FROM users u LEFT JOIN student_profiles sp ON u.id = sp.user_id
     ORDER BY u.id ASC`
  ).all();

  if (c.req.query('format') === 'csv') {
    const headers = ['id', 'telegram_id', 'name', 'username', 'role', 'target_test', 'proficiency_level', 'is_premium', 'premium_until', 'referral_count', 'created_at', 'learning_style', 'communication_style', 'depth_level', 'confidence_score', 'frustration_score', 'learning_pace'];
    let csv = headers.join(',') + '\n';
    for (const s of students.results as any[]) {
      csv += headers.map(h => {
        const val = s[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',') + '\n';
    }
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="edubot-students.csv"',
      },
    });
  }

  return c.json({ students: students.results });
});

// GET /export/content — CSV export of question bank
adminApiRoutes.get('/export/content', async (c) => {
  const content = await c.env.DB.prepare(
    `SELECT id, section, question_type, topic, difficulty, content, correct_answer, skill_tags, status, created_at
     FROM test_contents ORDER BY id ASC`
  ).all();

  if (c.req.query('format') === 'csv') {
    const headers = ['id', 'section', 'question_type', 'topic', 'difficulty', 'content', 'correct_answer', 'skill_tags', 'status', 'created_at'];
    let csv = headers.join(',') + '\n';
    for (const r of content.results as any[]) {
      csv += headers.map(h => {
        const val = r[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',') + '\n';
    }
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="edubot-content.csv"',
      },
    });
  }

  return c.json({ content: content.results });
});
