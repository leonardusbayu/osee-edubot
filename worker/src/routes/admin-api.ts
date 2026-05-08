import { Hono } from 'hono';
import type { Env, User } from '../types';
import { getAuthUser } from '../services/auth';
import { buildStudentReport, buildStudentReportForAI } from '../services/student-report';
import { validateContent } from '../services/content-validator';

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

  // Method 2: Legacy admin secret (checks both ADMIN_API_KEY and ADMIN_SECRET)
  const adminSecret = c.req.header('x-admin-secret');
  if (adminSecret) {
    if ((c.env.ADMIN_API_KEY && adminSecret === c.env.ADMIN_API_KEY) ||
        (c.env.ADMIN_SECRET && adminSecret === c.env.ADMIN_SECRET)) {
      c.set('authMethod', 'admin_secret');
      return next();
    }
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
  let page = parseInt(c.req.query('page') || '1');
  if (isNaN(page) || page < 1) page = 1;
  let limit = parseInt(c.req.query('limit') || '50');
  if (isNaN(limit) || limit < 1) limit = 50;
  limit = Math.min(limit, 200);
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
        WHERE ta.user_id = u.id
          AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))) as questions_answered,
       (SELECT ROUND(AVG(CASE
          WHEN aa2.is_correct = 1 THEN 100.0
          WHEN aa2.is_correct IS NULL AND aa2.section IN ('speaking','writing')
               AND json_extract(aa2.answer_data, '$.score') >= 5 THEN 100.0
          ELSE 0 END), 1)
        FROM attempt_answers aa2
        JOIN test_attempts ta2 ON aa2.attempt_id = ta2.id
        WHERE ta2.user_id = u.id
          AND NOT (aa2.is_correct IS NULL AND aa2.section NOT IN ('speaking','writing'))) as accuracy,
       (SELECT COUNT(*) FROM spaced_repetition sr
        WHERE sr.user_id = u.id AND sr.next_review_at <= datetime('now')) as due_reviews,
       (SELECT MAX(last_ts) FROM (
          SELECT MAX(created_at) as last_ts FROM conversation_messages WHERE user_id = u.id
          UNION ALL SELECT MAX(aa3.submitted_at) FROM attempt_answers aa3 JOIN test_attempts ta3 ON aa3.attempt_id = ta3.id WHERE ta3.user_id = u.id
       )) as last_activity
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
  if (isNaN(userId)) return c.json({ error: 'Invalid student ID' }, 400);

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
      `SELECT ta.id, ta.test_type, ta.current_section as section, ta.status, ta.started_at as created_at,
              ta.current_question_index as total_questions,
              (SELECT SUM(CASE WHEN aa.is_correct = 1 THEN 1
                WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing')
                     AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
                ELSE 0 END)
               FROM attempt_answers aa WHERE aa.attempt_id = ta.id) as score
       FROM test_attempts ta WHERE ta.user_id = ? AND ta.status = 'completed'
       ORDER BY ta.started_at DESC LIMIT 20`
    ).bind(userId).all(),
    // Daily activity (from conversation_messages + attempt_answers, not empty daily_study_logs)
    c.env.DB.prepare(
      `SELECT date as log_date,
              SUM(questions) as questions_answered,
              SUM(correct) as correct_answers,
              0 as study_minutes,
              SUM(messages) as messages
       FROM (
         SELECT DATE(aa.submitted_at) as date, COUNT(*) as questions,
                SUM(CASE WHEN aa.is_correct = 1 THEN 1
                  WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing')
                       AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
                  ELSE 0 END) as correct,
                0 as messages
         FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id
         WHERE ta.user_id = ?
         GROUP BY DATE(aa.submitted_at)
         UNION ALL
         SELECT DATE(created_at) as date, 0 as questions, 0 as correct, COUNT(*) as messages
         FROM conversation_messages WHERE user_id = ?
         GROUP BY DATE(created_at)
       ) GROUP BY date ORDER BY date DESC LIMIT 30`
    ).bind(userId, userId).all(),
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

  // Section breakdown — include speaking/writing (score-based) alongside MC (is_correct)
  const sectionBreakdown = await c.env.DB.prepare(
    `SELECT aa.section,
            COUNT(*) as total,
            SUM(CASE
              WHEN aa.is_correct = 1 THEN 1
              WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing')
                   AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
              ELSE 0
            END) as correct,
            CASE WHEN aa.section IN ('speaking','writing')
              THEN ROUND(AVG(json_extract(aa.answer_data, '$.score')), 1)
              ELSE NULL
            END as avg_score
     FROM attempt_answers aa
     JOIN test_attempts ta ON aa.attempt_id = ta.id
     WHERE ta.user_id = ?
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
  if (isNaN(userId)) return c.json({ error: 'Invalid student ID' }, 400);
  const report = await buildStudentReport(c.env, userId);
  if (!report) return c.json({ error: 'Student not found' }, 404);
  return c.json(report);
});

// GET /students/:id/report/ai — AI-optimized context string for lesson planning
adminApiRoutes.get('/students/:id/report/ai', async (c) => {
  const userId = parseInt(c.req.param('id'));
  if (isNaN(userId)) return c.json({ error: 'Invalid student ID' }, 400);
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
  if (isNaN(userId)) return c.json({ error: 'Invalid student ID' }, 400);
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
  if (isNaN(userId)) return c.json({ error: 'Invalid student ID' }, 400);
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
  if (isNaN(userId)) return c.json({ error: 'Invalid student ID' }, 400);
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
         SELECT user_id FROM conversation_messages WHERE created_at >= datetime('now', '-1 day')
         UNION SELECT ta.user_id FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE aa.submitted_at >= datetime('now', '-1 day')
         UNION SELECT user_id FROM daily_question_logs WHERE question_date >= date('now', '-1 day')
       )`
    ).first(),
    c.env.DB.prepare(
      `SELECT COUNT(DISTINCT user_id) as c FROM (
         SELECT user_id FROM conversation_messages WHERE created_at >= datetime('now', '-7 days')
         UNION SELECT ta.user_id FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE aa.submitted_at >= datetime('now', '-7 days')
         UNION SELECT user_id FROM daily_question_logs WHERE question_date >= date('now', '-7 days')
       )`
    ).first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM attempt_answers WHERE NOT (is_correct IS NULL AND section NOT IN ('speaking','writing'))").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM test_contents WHERE status = 'published'").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE is_premium = 1").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM test_attempts WHERE status = 'completed'").first(),
    c.env.DB.prepare(
      `SELECT SUM(CASE
         WHEN is_correct = 1 THEN 1
         WHEN is_correct IS NULL AND section IN ('speaking','writing') AND json_extract(answer_data, '$.score') >= 5 THEN 1
         ELSE 0 END) as correct,
              COUNT(*) as total
       FROM attempt_answers WHERE submitted_at >= datetime('now', '-7 days')
         AND NOT (is_correct IS NULL AND section NOT IN ('speaking','writing'))`
    ).first(),
    c.env.DB.prepare(
      `SELECT aa.section, COUNT(*) as total,
              SUM(CASE
                WHEN aa.is_correct = 1 THEN 1
                WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
                ELSE 0 END) as correct
       FROM attempt_answers aa
       WHERE NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))
       GROUP BY aa.section`
    ).all(),
    c.env.DB.prepare(
      `SELECT u.id, u.name, u.username, COUNT(aa.id) as questions,
              ROUND(AVG(CASE
                WHEN aa.is_correct = 1 THEN 100.0
                WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
                ELSE 0 END), 1) as accuracy
       FROM users u
       JOIN test_attempts ta ON u.id = ta.user_id
       JOIN attempt_answers aa ON ta.id = aa.attempt_id
       WHERE aa.submitted_at >= datetime('now', '-7 days')
         AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))
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
  let days = parseInt(c.req.query('days') || '30');
  if (isNaN(days) || days < 1) days = 30;
  days = Math.min(days, 90);

  // Questions answered trend (from test answers)
  const questionTrends = await c.env.DB.prepare(
    `SELECT DATE(aa.submitted_at) as date,
            COUNT(*) as questions_answered,
            SUM(CASE
              WHEN aa.is_correct = 1 THEN 1
              WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
              ELSE 0 END) as correct,
            ROUND(AVG(CASE
              WHEN aa.is_correct = 1 THEN 100.0
              WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
              ELSE 0 END), 1) as accuracy
     FROM attempt_answers aa
     JOIN test_attempts ta ON aa.attempt_id = ta.id
     WHERE aa.submitted_at >= datetime('now', '-' || ? || ' days')
       AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))
     GROUP BY DATE(aa.submitted_at)
     ORDER BY date ASC`
  ).bind(days).all();

  // Active users trend (conversation_messages is primary)
  const activeUserTrends = await c.env.DB.prepare(
    `SELECT date, COUNT(DISTINCT user_id) as active_users FROM (
       SELECT DATE(created_at) as date, user_id FROM conversation_messages WHERE created_at >= datetime('now', '-' || ? || ' days')
       UNION ALL SELECT DATE(aa.submitted_at) as date, ta.user_id FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE aa.submitted_at >= datetime('now', '-' || ? || ' days')
     ) GROUP BY date ORDER BY date ASC`
  ).bind(days, days).all();

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
  if (isNaN(userId)) return c.json({ error: 'Invalid user ID' }, 400);

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
  if (isNaN(userId)) return c.json({ error: 'Invalid user ID' }, 400);
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
  let page = parseInt(c.req.query('page') || '1');
  if (isNaN(page) || page < 1) page = 1;
  let limit = parseInt(c.req.query('limit') || '50');
  if (isNaN(limit) || limit < 1) limit = 50;
  limit = Math.min(limit, 200);
  const offset = (page - 1) * limit;

  let where = '1=1';
  const params: any[] = [];
  if (userId) {
    const userIdNum = parseInt(userId);
    if (!isNaN(userIdNum)) { where += ' AND lp.user_id = ?'; params.push(userIdNum); }
  }
  if (classId) {
    const classIdNum = parseInt(classId);
    if (!isNaN(classIdNum)) { where += ' AND lp.class_id = ?'; params.push(classIdNum); }
  }
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
  if (isNaN(planId)) return c.json({ error: 'Invalid lesson plan ID' }, 400);

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
  if (isNaN(planId)) return c.json({ error: 'Invalid lesson plan ID' }, 400);
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
  let page = parseInt(c.req.query('page') || '1');
  if (isNaN(page) || page < 1) page = 1;
  let limit = parseInt(c.req.query('limit') || '50');
  if (isNaN(limit) || limit < 1) limit = 50;
  limit = Math.min(limit, 200);
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
  const warnings: { index: number; warnings: string[] }[] = [];
  const skipOnError = c.req.query('skip_on_error') !== '0'; // default: skip invalid

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    try {
      // Validate before insert. For bulk-insert we use 'publish' mode since
      // status defaults to 'published' — catches garbage going live.
      const mode = (q.status || 'published') === 'published' ? 'publish' : 'draft';
      const parsedContent = typeof q.content === 'string'
        ? (() => { try { return JSON.parse(q.content); } catch { return { question_text: q.content }; } })()
        : q.content;
      const v = validateContent(
        {
          section: q.section,
          question_type: q.question_type,
          content: parsedContent,
          media_url: q.media_url ?? null,
        },
        { mode },
      );
      if (v.errors.length > 0 && skipOnError) {
        errors.push({ index: i, error: `Validation failed: ${v.errors.join('; ')}` });
        continue;
      }
      if (v.warnings.length > 0) {
        warnings.push({ index: i, warnings: v.warnings });
      }

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

  return c.json({ inserted: inserted.length, errors, warnings, ids: inserted });
});

// POST /content/:id/audio — Upload audio to R2 and update content media_url
adminApiRoutes.post('/content/:id/audio', async (c) => {
  const contentId = parseInt(c.req.param('id'));
  if (isNaN(contentId)) return c.json({ error: 'Invalid content ID' }, 400);
  const bucket = c.env.AUDIO_BUCKET;
  if (!bucket) return c.json({ error: 'R2 audio bucket not configured' }, 501);

  const formData = await c.req.formData();
  const file = formData.get('audio') as File | null;
  if (!file) return c.json({ error: 'No audio file provided' }, 400);

  // Validate file type
  const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/m4a'];
  if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|ogg|wav|webm|m4a)$/i)) {
    return c.json({ error: 'Invalid audio format. Supported: mp3, ogg, wav, webm, m4a' }, 400);
  }

  // Check content exists
  const content = await c.env.DB.prepare('SELECT id, test_type, section FROM test_contents WHERE id = ?')
    .bind(contentId).first();
  if (!content) return c.json({ error: 'Content not found' }, 404);

  // Upload to R2
  const ext = file.name.split('.').pop() || 'mp3';
  const key = `content-audio/${(content as any).test_type}/${(content as any).section}/${contentId}.${ext}`;

  await bucket.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'audio/mpeg' },
  });

  // Build the public URL
  const audioUrl = `/api/audio/${key}`;

  // Update content media_url
  await c.env.DB.prepare(
    'UPDATE test_contents SET media_url = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(audioUrl, contentId).run();

  return c.json({
    id: contentId,
    audio_url: audioUrl,
    size: file.size,
    key,
  });
});

// POST /content/restore-with-tts — Batch: generate TTS audio for draft listening questions and restore to published
adminApiRoutes.post('/content/restore-with-tts', async (c) => {
  const { test_type, section, limit: batchLimit } = await c.req.json().catch(() => ({}));
  const maxBatch = Math.min(batchLimit || 5, 10); // Max 10 per call to stay under subrequest limit

  // Find draft questions that had broken media URLs
  let query = `SELECT id, test_type, section, question_type, content
               FROM test_contents
               WHERE status = 'draft'
               AND (media_url IS NULL OR media_url = '' OR (media_url NOT LIKE 'http://%' AND media_url NOT LIKE 'https://%'))
               AND section IN ('listening', 'speaking')`;
  const params: any[] = [];

  if (test_type) { query += ' AND test_type = ?'; params.push(test_type); }
  if (section) { query += ' AND section = ?'; params.push(section); }
  query += ' LIMIT ?';
  params.push(maxBatch);

  const stmt = c.env.DB.prepare(query);
  const rows = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

  const results: any[] = [];

  for (const row of (rows.results || []) as any[]) {
    try {
      const content = JSON.parse(row.content as string || '{}');

      // Extract the text to generate TTS from
      let ttsText = '';
      if (content.passage_script) {
        ttsText = content.passage_script;
      } else if (content.passage_text) {
        ttsText = content.passage_text;
      } else if (content.questions?.[0]?.script) {
        ttsText = content.questions.map((q: any) => q.script || '').join('\n\n');
      }

      if (!ttsText || ttsText.length < 10) {
        results.push({ id: row.id, status: 'skipped', reason: 'No text for TTS' });
        continue;
      }

      // Generate TTS URL using existing TTS endpoint pattern
      // The TTS is served on-demand via /api/tts/speak, so we just need to construct the URL
      const ttsUrl = `/api/tts/speak?multi=true&text=${encodeURIComponent(ttsText.substring(0, 4000))}`;

      // Update the content with the TTS URL and restore to published
      await c.env.DB.prepare(
        "UPDATE test_contents SET media_url = ?, status = 'published', updated_at = datetime('now') WHERE id = ?"
      ).bind(ttsUrl, row.id).run();

      results.push({ id: row.id, status: 'restored', tts_length: ttsText.length });
    } catch (e: any) {
      results.push({ id: row.id, status: 'error', message: e.message });
    }
  }

  return c.json({
    processed: results.length,
    restored: results.filter(r => r.status === 'restored').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    errors: results.filter(r => r.status === 'error').length,
    results,
  });
});

// POST /content/audit-and-publish — Batch-audit drafts against validateContent
// and promote the ones that pass in 'publish' mode. The safety switch is
// dry_run=1 (default): returns the decision breakdown without mutating.
// dry_run=0 actually flips status='published' on the passing rows.
//
// Query params:
//   test_type     (default 'TOEFL_IBT')
//   section       (optional: 'listening' | 'speaking' | 'reading' | 'writing')
//   question_type (optional, for a surgical batch)
//   dry_run       ('1' default, '0' to commit)
//   limit         (max rows to evaluate; default 5000, capped at 5000)
//   strict_warnings ('1' to treat warnings as blockers; default '0')
//
// Response includes per-row pass/fail with error list so the caller can
// triage the skipped rows without re-running.
adminApiRoutes.post('/content/audit-and-publish', async (c) => {
  const testType = c.req.query('test_type') || 'TOEFL_IBT';
  const sectionFilter = c.req.query('section');
  const questionTypeFilter = c.req.query('question_type');
  const dryRun = c.req.query('dry_run') !== '0';
  const strictWarnings = c.req.query('strict_warnings') === '1';
  const limit = Math.min(parseInt(c.req.query('limit') || '5000', 10) || 5000, 5000);

  // Build the select for draft rows matching the filter
  let where = "status = 'draft' AND test_type = ?";
  const params: any[] = [testType];
  if (sectionFilter) { where += ' AND section = ?'; params.push(sectionFilter); }
  if (questionTypeFilter) { where += ' AND question_type = ?'; params.push(questionTypeFilter); }

  const rowsRes = await c.env.DB.prepare(
    `SELECT id, test_type, section, question_type, content, media_url, title
     FROM test_contents WHERE ${where} ORDER BY id LIMIT ?`
  ).bind(...params, limit).all();
  const rows = (rowsRes.results || []) as any[];

  type Skip = { id: number; section: string; question_type: string; errors: string[]; warnings?: string[] };
  const wouldPublish: number[] = [];
  const wouldSkip: Skip[] = [];
  const warningsOnly: Skip[] = [];

  for (const row of rows) {
    let parsed: any = {};
    try { parsed = JSON.parse(String(row.content || '{}')); }
    catch { wouldSkip.push({ id: row.id, section: row.section, question_type: row.question_type, errors: ['content is not valid JSON'] }); continue; }

    const v = validateContent(
      {
        section: row.section,
        question_type: row.question_type,
        content: parsed,
        media_url: row.media_url,
        title: row.title,
      },
      { mode: 'publish' },
    );

    const blockers = strictWarnings ? [...v.errors, ...v.warnings] : v.errors;
    if (blockers.length === 0) {
      wouldPublish.push(row.id);
      if (v.warnings.length > 0) {
        warningsOnly.push({ id: row.id, section: row.section, question_type: row.question_type, errors: [], warnings: v.warnings });
      }
    } else {
      wouldSkip.push({ id: row.id, section: row.section, question_type: row.question_type, errors: blockers, warnings: v.warnings });
    }
  }

  // Aggregate by (section, question_type) for the response preview
  type Agg = { section: string; question_type: string; would_publish: number; would_skip: number };
  const aggMap = new Map<string, Agg>();
  for (const id of wouldPublish) {
    const r = rows.find((x: any) => x.id === id)!;
    const k = `${r.section}|${r.question_type}`;
    const a = aggMap.get(k) || { section: r.section, question_type: r.question_type, would_publish: 0, would_skip: 0 };
    a.would_publish++;
    aggMap.set(k, a);
  }
  for (const s of wouldSkip) {
    const k = `${s.section}|${s.question_type}`;
    const a = aggMap.get(k) || { section: s.section, question_type: s.question_type, would_publish: 0, would_skip: 0 };
    a.would_skip++;
    aggMap.set(k, a);
  }
  const byType = Array.from(aggMap.values()).sort((a, b) =>
    a.section.localeCompare(b.section) || a.question_type.localeCompare(b.question_type),
  );

  // Commit promotion if not a dry run
  let promoted = 0;
  if (!dryRun && wouldPublish.length > 0) {
    // D1 has a bind-parameter ceiling; chunk in batches of 100 to stay well under limits
    const CHUNK = 100;
    for (let i = 0; i < wouldPublish.length; i += CHUNK) {
      const slice = wouldPublish.slice(i, i + CHUNK);
      const placeholders = slice.map(() => '?').join(',');
      const res = await c.env.DB.prepare(
        `UPDATE test_contents SET status = 'published', updated_at = datetime('now') WHERE id IN (${placeholders}) AND status = 'draft'`
      ).bind(...slice).run();
      promoted += res.meta?.changes || 0;
    }
  }

  return c.json({
    test_type: testType,
    section: sectionFilter || null,
    question_type: questionTypeFilter || null,
    dry_run: dryRun,
    strict_warnings: strictWarnings,
    evaluated: rows.length,
    would_publish: wouldPublish.length,
    would_skip: wouldSkip.length,
    promoted,
    by_type: byType,
    // Cap detail arrays so the JSON doesn't balloon on large batches
    skip_sample: wouldSkip.slice(0, 50),
    warnings_sample: warningsOnly.slice(0, 50),
    would_publish_ids: wouldPublish,
  });
});

// GET /content/draft-stats — Get stats on draft/broken content for admin visibility
adminApiRoutes.get('/content/draft-stats', async (c) => {
  const stats = await c.env.DB.prepare(`
    SELECT
      test_type,
      section,
      COUNT(*) as total_draft,
      SUM(CASE WHEN media_url IS NOT NULL AND media_url != '' AND media_url NOT LIKE 'http://%' AND media_url NOT LIKE 'https://%' THEN 1 ELSE 0 END) as broken_media,
      SUM(CASE WHEN media_url IS NULL OR media_url = '' THEN 1 ELSE 0 END) as no_media,
      SUM(CASE WHEN media_url LIKE 'http://%' OR media_url LIKE 'https://%' THEN 1 ELSE 0 END) as valid_media
    FROM test_contents
    WHERE status = 'draft'
    GROUP BY test_type, section
    ORDER BY total_draft DESC
  `).all();

  const total = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM test_contents WHERE status = 'draft'"
  ).first() as any;

  return c.json({
    total_draft: total?.count || 0,
    by_type_section: stats.results,
  });
});

// ═══════════════════════════════════════════════════════════════
// CLASSES
// ═══════════════════════════════════════════════════════════════

// GET /classes — List all classes with member counts
adminApiRoutes.get('/classes', async (c) => {
  const classes = await c.env.DB.prepare(
    `SELECT c.*,
       u.name as teacher_name,
       (SELECT COUNT(*) FROM class_enrollments cm WHERE cm.class_id = c.id) as member_count
     FROM classes c
     LEFT JOIN users u ON c.teacher_id = u.id
     ORDER BY c.created_at DESC`
  ).all();

  return c.json({ classes: classes.results });
});

// GET /classes/:id/students — Students in a class with mastery
adminApiRoutes.get('/classes/:id/students', async (c) => {
  const classId = parseInt(c.req.param('id'));
  if (isNaN(classId)) return c.json({ error: 'Invalid class ID' }, 400);

  const students = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.username, u.proficiency_level, u.target_test,
       sp.confidence_score, sp.learning_pace, sp.frustration_score,
       (SELECT ROUND(AVG(CASE
          WHEN aa.is_correct = 1 THEN 100.0
          WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
          ELSE 0 END), 1)
        FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id
        WHERE ta.user_id = u.id
          AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))) as accuracy,
       (SELECT COUNT(*) FROM attempt_answers aa2
        JOIN test_attempts ta2 ON aa2.attempt_id = ta2.id
        WHERE ta2.user_id = u.id
          AND NOT (aa2.is_correct IS NULL AND aa2.section NOT IN ('speaking','writing'))) as questions_answered
     FROM class_enrollments cm
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
       AVG(review_level) as avg_level
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
      `SELECT SUM(amount) as total_stars, COUNT(*) as transactions
       FROM payment_requests WHERE status = 'paid'`
    ).first(),
    c.env.DB.prepare(
      `SELECT pr.*, u.name as user_name
       FROM payment_requests pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.status = 'paid'
       ORDER BY pr.confirmed_at DESC LIMIT 20`
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
// POST /system/companion-outreach — manually trigger the idle-student re-engagement
// flow. Normally runs via cron at 0 11 * * * (18:00 WIB). This endpoint exists so
// admins can test the feature without waiting for the next cron window.
// Usage:
//   curl -X POST -H "X-API-Key: $ADMIN_API_KEY" \
//        https://edubot-api.edubot-leonardus.workers.dev/api/v1/admin/system/companion-outreach
adminApiRoutes.post('/system/companion-outreach', async (c) => {
  try {
    const { runCompanionOutreach, findIdleStudents } = await import('../services/companion');

    // dry_run=1 returns the detection results without sending any messages
    const dryRun = c.req.query('dry_run') === '1';
    if (dryRun) {
      const idle = await findIdleStudents(c.env);
      return c.json({
        dry_run: true,
        tier1_count: idle.tier1.length,
        tier2_count: idle.tier2.length,
        tier3_count: idle.tier3.length,
        sample_tier1: idle.tier1.slice(0, 5),
        sample_tier2: idle.tier2.slice(0, 5),
        sample_tier3: idle.tier3.slice(0, 5),
      });
    }

    const result = await runCompanionOutreach(c.env);
    return c.json({ ok: true, result });
  } catch (e: any) {
    return c.json({
      error: e?.message || 'Companion outreach failed',
      stack: (e?.stack || '').split('\n').slice(0, 6).join('\n'),
    }, 500);
  }
});

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

// ═══════════════════════════════════════════════════════════════
// TEACHER DASHBOARD
// ═══════════════════════════════════════════════════════════════

// GET /teacher-dashboard/alerts — Students needing attention
adminApiRoutes.get('/teacher-dashboard/alerts', requireAdmin, async (c) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();

  // 1. Churn risk: were active in days 7-14, but NOT active in last 7 days
  const churnRisk = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.username, u.target_test, u.proficiency_level,
            MAX(activity.last_active) as last_active
     FROM users u
     JOIN (
       SELECT user_id, MAX(created_at) as last_active FROM conversation_messages GROUP BY user_id
       UNION ALL
       SELECT ta.user_id, MAX(aa.submitted_at) as last_active FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id GROUP BY ta.user_id
     ) activity ON u.id = activity.user_id
     WHERE u.role = 'student'
     GROUP BY u.id
     HAVING MAX(activity.last_active) < ? AND MAX(activity.last_active) >= ?
     ORDER BY MAX(activity.last_active) DESC
     LIMIT 20`
  ).bind(threeDaysAgo, fourteenDaysAgo).all();

  // 2. Plateauing: active in last 14 days, but accuracy hasn't changed (compare week1 vs week2)
  const plateauing = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.username, u.target_test,
            ROUND(AVG(CASE WHEN aa.submitted_at >= ? THEN
              CASE WHEN aa.is_correct = 1 THEN 100.0
                   WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
                   ELSE 0 END
            END), 1) as recent_accuracy,
            ROUND(AVG(CASE WHEN aa.submitted_at < ? AND aa.submitted_at >= ? THEN
              CASE WHEN aa.is_correct = 1 THEN 100.0
                   WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
                   ELSE 0 END
            END), 1) as previous_accuracy,
            COUNT(CASE WHEN aa.submitted_at >= ? THEN 1 END) as recent_questions,
            COUNT(CASE WHEN aa.submitted_at < ? AND aa.submitted_at >= ? THEN 1 END) as prev_questions
     FROM users u
     JOIN test_attempts ta ON u.id = ta.user_id
     JOIN attempt_answers aa ON ta.id = aa.attempt_id
     WHERE u.role = 'student' AND aa.submitted_at >= ?
       AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))
     GROUP BY u.id
     HAVING recent_questions >= 5 AND prev_questions >= 5
            AND ABS(COALESCE(recent_accuracy, 0) - COALESCE(previous_accuracy, 0)) < 5
     ORDER BY recent_questions DESC
     LIMIT 15`
  ).bind(sevenDaysAgo, sevenDaysAgo, fourteenDaysAgo, sevenDaysAgo, sevenDaysAgo, fourteenDaysAgo, fourteenDaysAgo).all();

  // 3. Struggling: high effort but low accuracy (active last 7 days, accuracy < 40%)
  const struggling = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.username, u.target_test,
            COUNT(aa.id) as questions,
            ROUND(AVG(CASE
              WHEN aa.is_correct = 1 THEN 100.0
              WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
              ELSE 0 END), 1) as accuracy
     FROM users u
     JOIN test_attempts ta ON u.id = ta.user_id
     JOIN attempt_answers aa ON ta.id = aa.attempt_id
     WHERE u.role = 'student' AND aa.submitted_at >= ?
       AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))
     GROUP BY u.id
     HAVING questions >= 5 AND accuracy < 40
     ORDER BY accuracy ASC
     LIMIT 15`
  ).bind(sevenDaysAgo).all();

  // 4. Close to goal: estimated band within 0.5 of target (or accuracy > 75%)
  const closeToGoal = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.username, u.target_test, u.proficiency_level,
            dr.estimated_band,
            COUNT(aa.id) as total_questions,
            ROUND(AVG(CASE
              WHEN aa.is_correct = 1 THEN 100.0
              WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
              ELSE 0 END), 1) as accuracy
     FROM users u
     LEFT JOIN diagnostic_results dr ON u.id = dr.user_id
     JOIN test_attempts ta ON u.id = ta.user_id
     JOIN attempt_answers aa ON ta.id = aa.attempt_id
     WHERE u.role = 'student' AND aa.submitted_at >= ?
       AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))
     GROUP BY u.id
     HAVING accuracy >= 75 AND total_questions >= 10
     ORDER BY accuracy DESC
     LIMIT 15`
  ).bind(fourteenDaysAgo).all();

  return c.json({
    churn_risk: churnRisk.results,
    plateauing: plateauing.results,
    struggling: struggling.results,
    close_to_goal: closeToGoal.results,
  });
});

// GET /teacher-dashboard/weakness-heatmap — Class-wide weakness analysis
adminApiRoutes.get('/teacher-dashboard/weakness-heatmap', requireAdmin, async (c) => {
  const classId = c.req.query('class_id');

  // Overall weakness by section + question_type
  let sectionTypeQuery = `
    SELECT aa.section, tc.question_type, tc.skill_tags,
           COUNT(aa.id) as attempts,
           SUM(CASE
             WHEN aa.is_correct = 1 THEN 1
             WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
             ELSE 0 END) as correct,
           ROUND(AVG(CASE
             WHEN aa.is_correct = 1 THEN 100.0
             WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
             ELSE 0 END), 1) as accuracy
    FROM attempt_answers aa
    JOIN test_contents tc ON aa.content_id = tc.id
    JOIN test_attempts ta ON aa.attempt_id = ta.id`;

  const binds: any[] = [];
  if (classId) {
    sectionTypeQuery += ` JOIN class_enrollments cm ON ta.user_id = cm.user_id AND cm.class_id = ?`;
    binds.push(classId);
  }
  sectionTypeQuery += ` WHERE NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))`;
  sectionTypeQuery += ` GROUP BY aa.section, tc.question_type ORDER BY accuracy ASC`;

  const heatmap = await c.env.DB.prepare(sectionTypeQuery).bind(...binds).all();

  // Most-missed specific questions
  let missedQuery = `
    SELECT tc.id, tc.section, tc.question_type, tc.skill_tags,
           SUBSTR(tc.content, 1, 120) as content_preview,
           COUNT(aa.id) as attempts,
           SUM(CASE
             WHEN aa.is_correct = 1 THEN 0
             WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 0
             ELSE 1 END) as wrong_count,
           ROUND(AVG(CASE
             WHEN aa.is_correct = 1 THEN 100.0
             WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
             ELSE 0 END), 1) as accuracy
    FROM attempt_answers aa
    JOIN test_contents tc ON aa.content_id = tc.id
    JOIN test_attempts ta ON aa.attempt_id = ta.id`;

  const missedBinds: any[] = [];
  if (classId) {
    missedQuery += ` JOIN class_enrollments cm ON ta.user_id = cm.user_id AND cm.class_id = ?`;
    missedBinds.push(classId);
  }
  missedQuery += ` WHERE NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))`;
  missedQuery += ` GROUP BY tc.id HAVING attempts >= 3 ORDER BY accuracy ASC LIMIT 20`;

  const missed = await c.env.DB.prepare(missedQuery).bind(...missedBinds).all();

  // Skill tag breakdown (aggregate skill_tags across all answers)
  let skillQuery = `
    SELECT tc.skill_tags, COUNT(aa.id) as attempts,
           ROUND(AVG(CASE
             WHEN aa.is_correct = 1 THEN 100.0
             WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
             ELSE 0 END), 1) as accuracy
    FROM attempt_answers aa
    JOIN test_contents tc ON aa.content_id = tc.id
    JOIN test_attempts ta ON aa.attempt_id = ta.id`;

  const skillBinds: any[] = [];
  if (classId) {
    skillQuery += ` JOIN class_enrollments cm ON ta.user_id = cm.user_id AND cm.class_id = ?`;
    skillBinds.push(classId);
  }
  skillQuery += ` WHERE tc.skill_tags IS NOT NULL AND tc.skill_tags != '' AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing')) GROUP BY tc.skill_tags ORDER BY accuracy ASC`;

  const skills = await c.env.DB.prepare(skillQuery).bind(...skillBinds).all();

  return c.json({
    section_type_heatmap: heatmap.results,
    most_missed_questions: missed.results,
    skill_breakdown: skills.results,
  });
});

// GET /teacher-dashboard/score-progression — Score trends per student and class average
adminApiRoutes.get('/teacher-dashboard/score-progression', requireAdmin, async (c) => {
  const studentId = c.req.query('student_id');
  const classId = c.req.query('class_id');
  let days = parseInt(c.req.query('days') || '60');
  if (isNaN(days) || days < 1) days = 60;
  days = Math.min(days, 180);
  const daysAgo = new Date(Date.now() - days * 86400000).toISOString();

  if (studentId) {
    // Individual student progression: weekly accuracy buckets
    const progression = await c.env.DB.prepare(
      `SELECT
         strftime('%Y-W%W', aa.submitted_at) as week,
         MIN(DATE(aa.submitted_at)) as week_start,
         aa.section,
         COUNT(aa.id) as questions,
         ROUND(AVG(CASE
           WHEN aa.is_correct = 1 THEN 100.0
           WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
           ELSE 0 END), 1) as accuracy
       FROM attempt_answers aa
       JOIN test_attempts ta ON aa.attempt_id = ta.id
       WHERE ta.user_id = ? AND aa.submitted_at >= ?
         AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))
       GROUP BY week, aa.section
       ORDER BY week ASC, aa.section`
    ).bind(studentId, daysAgo).all();

    // Overall weekly (not by section)
    const overall = await c.env.DB.prepare(
      `SELECT
         strftime('%Y-W%W', aa.submitted_at) as week,
         MIN(DATE(aa.submitted_at)) as week_start,
         COUNT(aa.id) as questions,
         ROUND(AVG(CASE
           WHEN aa.is_correct = 1 THEN 100.0
           WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
           ELSE 0 END), 1) as accuracy
       FROM attempt_answers aa
       JOIN test_attempts ta ON aa.attempt_id = ta.id
       WHERE ta.user_id = ? AND aa.submitted_at >= ?
         AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))
       GROUP BY week
       ORDER BY week ASC`
    ).bind(studentId, daysAgo).all();

    return c.json({ by_section: progression.results, overall: overall.results });
  }

  // Class or system-wide: weekly average accuracy across all students
  let classFilter = '';
  const binds: any[] = [daysAgo];
  if (classId) {
    classFilter = 'JOIN class_enrollments cm ON ta.user_id = cm.user_id AND cm.class_id = ?';
    binds.push(classId);
  }

  const classProgression = await c.env.DB.prepare(
    `SELECT
       strftime('%Y-W%W', aa.submitted_at) as week,
       MIN(DATE(aa.submitted_at)) as week_start,
       COUNT(DISTINCT ta.user_id) as active_students,
       COUNT(aa.id) as questions,
       ROUND(AVG(CASE
         WHEN aa.is_correct = 1 THEN 100.0
         WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
         ELSE 0 END), 1) as avg_accuracy
     FROM attempt_answers aa
     JOIN test_attempts ta ON aa.attempt_id = ta.id
     ${classFilter}
     WHERE aa.submitted_at >= ?
       AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))
     GROUP BY week
     ORDER BY week ASC`
  ).bind(...(classId ? [classId, daysAgo] : [daysAgo])).all();

  // Per-section progression (class-wide)
  const sectionProgression = await c.env.DB.prepare(
    `SELECT
       strftime('%Y-W%W', aa.submitted_at) as week,
       MIN(DATE(aa.submitted_at)) as week_start,
       aa.section,
       COUNT(aa.id) as questions,
       ROUND(AVG(CASE
         WHEN aa.is_correct = 1 THEN 100.0
         WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
         ELSE 0 END), 1) as accuracy
     FROM attempt_answers aa
     JOIN test_attempts ta ON aa.attempt_id = ta.id
     ${classFilter}
     WHERE aa.submitted_at >= ?
       AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))
     GROUP BY week, aa.section
     ORDER BY week ASC, aa.section`
  ).bind(...(classId ? [classId, daysAgo] : [daysAgo])).all();

  // Top improvers: students whose recent accuracy > past accuracy (compare halves)
  const halfPoint = new Date(Date.now() - (days / 2) * 86400000).toISOString();
  const improvers = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.username,
            ROUND(AVG(CASE WHEN aa.submitted_at >= ? THEN
              CASE WHEN aa.is_correct = 1 THEN 100.0
                   WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
                   ELSE 0 END END), 1) as recent_acc,
            ROUND(AVG(CASE WHEN aa.submitted_at < ? THEN
              CASE WHEN aa.is_correct = 1 THEN 100.0
                   WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 100.0
                   ELSE 0 END END), 1) as past_acc,
            COUNT(aa.id) as total_questions
     FROM users u
     JOIN test_attempts ta ON u.id = ta.user_id
     JOIN attempt_answers aa ON ta.id = aa.attempt_id
     ${classFilter ? classFilter.replace('ta.user_id', 'u.id') : ''}
     WHERE aa.submitted_at >= ? AND u.role = 'student'
       AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))
     GROUP BY u.id
     HAVING total_questions >= 10 AND recent_acc > past_acc
     ORDER BY (recent_acc - past_acc) DESC
     LIMIT 10`
  ).bind(...(classId ? [halfPoint, halfPoint, classId, daysAgo] : [halfPoint, halfPoint, daysAgo])).all();

  return c.json({
    class_overall: classProgression.results,
    by_section: sectionProgression.results,
    top_improvers: improvers.results,
  });
});

// GET /teacher-dashboard/engagement — Engagement & consistency metrics
adminApiRoutes.get('/teacher-dashboard/engagement', requireAdmin, async (c) => {
  const classId = c.req.query('class_id');
  const days = Math.min(parseInt(c.req.query('days') || '30'), 90);
  const daysAgo = new Date(Date.now() - days * 86400000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  // 1. Daily active users over time
  const dailyActive = await c.env.DB.prepare(
    `SELECT date, COUNT(DISTINCT user_id) as active_users FROM (
       SELECT DATE(created_at) as date, user_id FROM conversation_messages WHERE created_at >= ?
       UNION ALL
       SELECT DATE(aa.submitted_at) as date, ta.user_id FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE aa.submitted_at >= ?
     ) GROUP BY date ORDER BY date ASC`
  ).bind(daysAgo, daysAgo).all();

  // 2. Total enrolled students
  const totalStudents = await c.env.DB.prepare(
    "SELECT COUNT(*) as c FROM users WHERE role = 'student'"
  ).first();

  // 3. Study consistency per student (last 30 days): active days / total days
  const consistencyResult = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.username,
            COUNT(DISTINCT activity.active_date) as active_days,
            u.current_streak, u.longest_streak
     FROM users u
     LEFT JOIN (
       SELECT user_id, DATE(created_at) as active_date FROM conversation_messages WHERE created_at >= ?
       UNION
       SELECT ta.user_id, DATE(aa.submitted_at) FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE aa.submitted_at >= ?
     ) activity ON u.id = activity.user_id
     WHERE u.role = 'student'
     GROUP BY u.id
     ORDER BY active_days DESC`
  ).bind(daysAgo, daysAgo).all();

  // 4. Feature usage breakdown (last 30 days)
  const featureUsage = await c.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM conversation_messages WHERE created_at >= ? AND role = 'user') as bot_messages,
       (SELECT COUNT(*) FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE aa.submitted_at >= ?) as test_answers,
       (SELECT COUNT(*) FROM daily_question_logs WHERE question_date >= DATE(?)) as study_button_uses,
       (SELECT COUNT(*) FROM lesson_plans WHERE created_at >= ?) as lessons_generated,
       (SELECT COUNT(*) FROM spaced_repetition WHERE last_reviewed_at >= ?) as srs_reviews`
  ).bind(daysAgo, daysAgo, daysAgo, daysAgo, daysAgo).first();

  // 5. Study time distribution (hour of day, from conversation_messages)
  const hourDistribution = await c.env.DB.prepare(
    `SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour,
            COUNT(*) as activity_count
     FROM (
       SELECT created_at FROM conversation_messages WHERE created_at >= ? AND role = 'user'
       UNION ALL
       SELECT aa.submitted_at FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE aa.submitted_at >= ?
     ) GROUP BY hour ORDER BY hour`
  ).bind(daysAgo, daysAgo).all();

  // 6. Weekly active rate over time (for chart)
  const weeklyRates = await c.env.DB.prepare(
    `SELECT week, COUNT(DISTINCT user_id) as active_users FROM (
       SELECT strftime('%Y-W%W', created_at) as week, user_id FROM conversation_messages WHERE created_at >= ?
       UNION ALL
       SELECT strftime('%Y-W%W', aa.submitted_at), ta.user_id FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE aa.submitted_at >= ?
     ) GROUP BY week ORDER BY week ASC`
  ).bind(daysAgo, daysAgo).all();

  // 7. Average study minutes per student per week (from test time_spent_seconds)
  const avgStudyTime = await c.env.DB.prepare(
    `SELECT strftime('%Y-W%W', aa.submitted_at) as week,
            ROUND(SUM(COALESCE(aa.time_spent_seconds, 0)) / 60.0 / NULLIF(COUNT(DISTINCT ta.user_id), 0), 1) as avg_minutes_per_student,
            COUNT(DISTINCT ta.user_id) as students
     FROM attempt_answers aa
     JOIN test_attempts ta ON aa.attempt_id = ta.id
     WHERE aa.submitted_at >= ?
     GROUP BY week ORDER BY week ASC`
  ).bind(daysAgo).all();

  return c.json({
    daily_active_users: dailyActive.results,
    total_students: (totalStudents as any)?.c || 0,
    student_consistency: consistencyResult.results,
    feature_usage: featureUsage,
    hour_distribution: hourDistribution.results,
    weekly_active_rates: weeklyRates.results,
    avg_study_time_weekly: avgStudyTime.results,
  });
});
