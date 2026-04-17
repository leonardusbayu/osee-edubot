import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';
import {
  getStudentIRTProfile,
  updateStudentAbility,
  recalibrateItems,
  thetaToIBTSection,
  thetaToCEFR,
} from '../services/irt-engine';
import {
  getStudentLearningAnalytics,
  fitAndSaveLearningCurve,
  recomputePsychProfile,
} from '../services/learning-curve';

export function isAdminRequest(c: any): boolean {
  const secret = c.req.header('x-admin-secret');
  return secret === c.env.ADMIN_SECRET;
}
import {
  trackMessage,
  startSession,
  endSession,
  incrementDailyStudyLog,
  trackSkillProgress,
  updateStreak,
  getStudentAnalytics,
  backfillDailyLogs,
} from '../services/analytics';

export const analyticsRoutes = new Hono<{ Bindings: Env }>();

// Teacher dashboard — full class analytics
analyticsRoutes.get('/dashboard', async (c) => {
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  const classId = c.req.query('class_id');
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const today = new Date().toISOString().split('T')[0];

  // Build user filter: when classId provided, only enrolled students
  let userFilterClause = '';
  let userFilterParams: any[] = [];
  if (classId) {
    userFilterClause = ' AND ta.user_id IN (SELECT user_id FROM class_enrollments WHERE class_id = ? AND status = ?)';
    userFilterParams = [classId, 'active'];
  }

  // Total students
  const students = classId
    ? await c.env.DB.prepare("SELECT COUNT(*) as c FROM class_enrollments WHERE class_id = ? AND status = 'active'").bind(classId).first() as any
    : await c.env.DB.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').bind('student').first() as any;

  // Active today (filtered by class if classId) — conversation_messages is primary activity
  const activeTodayFilterClause = classId
    ? ` AND user_id IN (SELECT user_id FROM class_enrollments WHERE class_id = ? AND status = 'active')`
    : '';
  const activeTodayParams = classId ? [today, classId, 'active', today, ...userFilterParams] : [today, today, ...userFilterParams];
  const activeToday = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT user_id) as c FROM (
       SELECT user_id FROM conversation_messages WHERE date(created_at) >= ?${activeTodayFilterClause}
       UNION
       SELECT ta.user_id FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE aa.submitted_at >= ?${userFilterClause}
     )`
  ).bind(...activeTodayParams).first() as any;

  // Total questions answered this week (speaking/writing use score in answer_data)
  const weekActivity = await c.env.DB.prepare(
    `SELECT COUNT(*) as total, SUM(CASE
       WHEN is_correct=1 THEN 1
       WHEN is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
       ELSE 0 END) as correct
     FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id=ta.id
     WHERE aa.submitted_at >= ?${userFilterClause}`
  ).bind(weekAgo, ...userFilterParams).first() as any;

  // Average band score (last 7 days, filtered by class)
  const avgScore = await c.env.DB.prepare(
    `SELECT AVG(tr.band_score) as avg FROM test_results tr
     JOIN test_attempts ta ON tr.attempt_id = ta.id
     WHERE tr.band_score IS NOT NULL AND tr.created_at >= ?${userFilterClause}`
  ).bind(weekAgo, ...userFilterParams).first() as any;

  // Weakest sections (filtered by class, speaking/writing score-aware)
  const weakSections = await c.env.DB.prepare(
    `SELECT aa.section, COUNT(*) as total,
     SUM(CASE
       WHEN aa.is_correct=1 THEN 1
       WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
       ELSE 0 END) as correct
     FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id=ta.id
     WHERE aa.submitted_at >= ?${userFilterClause}
     GROUP BY aa.section ORDER BY (CAST(correct AS FLOAT)/total) ASC`
  ).bind(weekAgo, ...userFilterParams).all();

  // Top students (filtered by class, this week, score-aware)
  const topStudents = await c.env.DB.prepare(
    `SELECT COALESCE(u.name, u.username, 'Student ' || u.id) as name,
            COUNT(aa.id) as questions,
            SUM(CASE
              WHEN aa.is_correct=1 THEN 1
              WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
              ELSE 0 END) as correct
     FROM users u
     JOIN test_attempts ta ON u.id=ta.user_id
     JOIN attempt_answers aa ON ta.id=aa.attempt_id
     WHERE aa.submitted_at >= ?${userFilterClause}
     GROUP BY u.id ORDER BY correct DESC LIMIT 10`
  ).bind(weekAgo, ...userFilterParams).all();

  // API costs (no filter — system-wide)
  const costs = await c.env.DB.prepare(
    "SELECT SUM(cost_usd) as total FROM api_usage"
  ).first() as any;

  const weekCorrect = weekActivity?.correct || 0;
  const weekTotal = weekActivity?.total || 0;

  return c.json({
    total_students: students?.c || 0,
    active_today: activeToday?.c || 0,
    week_questions: weekTotal,
    week_accuracy: weekTotal > 0 ? Math.round((weekCorrect / weekTotal) * 100) : 0,
    avg_band_score: avgScore?.avg ? Math.round(avgScore.avg * 10) / 10 : null,
    weak_sections: weakSections.results.map((s: any) => ({
      section: s.section,
      accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
      total: s.total,
    })),
    top_students: topStudents.results.map((s: any) => ({
      name: s.name || 'Unknown',
      questions: s.questions,
      accuracy: s.questions > 0 ? Math.round((s.correct / s.questions) * 100) : 0,
    })),
    api_cost: costs?.total || 0,
  });
});

// Student activity heatmap — hours × days
analyticsRoutes.get('/heatmap', async (c) => {
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  const classId = c.req.query('class_id');
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  let userFilterClause = '';
  let userFilterParams: any[] = [];
  if (classId) {
    userFilterClause = ' AND ta.user_id IN (SELECT user_id FROM class_enrollments WHERE class_id = ? AND status = ?)';
    userFilterParams = [classId, 'active'];
  }

  // Count activity by hour and day of week (last 30 days)
  const activity = await c.env.DB.prepare(
    `SELECT strftime('%w', aa.submitted_at) as day_of_week,
            strftime('%H', aa.submitted_at) as hour,
            COUNT(*) as count
     FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id=ta.id
     WHERE aa.submitted_at >= ?${userFilterClause}
     GROUP BY day_of_week, hour`
  ).bind(monthAgo, ...userFilterParams).all();

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
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || user.role !== 'admin')) return c.json({ error: 'Admin only' }, 403);

  // For each question, calculate accuracy → set difficulty (score-aware)
  // This is a heavy operation — update in batches
  const questions = await c.env.DB.prepare(
    `SELECT tc.id, tc.section, COUNT(aa.id) as attempts,
     SUM(CASE
       WHEN aa.is_correct=1 THEN 1
       WHEN aa.is_correct IS NULL AND tc.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
       ELSE 0 END) as correct
     FROM test_contents tc
     LEFT JOIN attempt_answers aa ON aa.content_id = tc.id
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
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  const classId = c.req.query('class_id');
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  let userFilterClause = '';
  let userFilterParams: any[] = [];
  if (classId) {
    userFilterClause = ' AND u.id IN (SELECT user_id FROM class_enrollments WHERE class_id = ? AND status = ?)';
    userFilterParams = [classId, 'active'];
  }

  // Students with no activity in 3+ days — conversation_messages is primary activity source
  const atRisk = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.telegram_id,
     (SELECT MAX(last_ts) FROM (
        SELECT MAX(created_at) as last_ts FROM conversation_messages WHERE user_id = u.id
        UNION ALL SELECT MAX(aa2.submitted_at) FROM attempt_answers aa2 JOIN test_attempts ta2 ON aa2.attempt_id = ta2.id WHERE ta2.user_id = u.id
     )) as last_active,
     (SELECT COUNT(*) FROM attempt_answers aa3 JOIN test_attempts ta3 ON aa3.attempt_id = ta3.id WHERE ta3.user_id = u.id) as total_questions
     FROM users u
     WHERE u.role = 'student'${userFilterClause}
       AND (
         (SELECT MAX(last_ts) FROM (
            SELECT MAX(created_at) as last_ts FROM conversation_messages WHERE user_id = u.id
            UNION ALL SELECT MAX(aa4.submitted_at) FROM attempt_answers aa4 JOIN test_attempts ta4 ON aa4.attempt_id = ta4.id WHERE ta4.user_id = u.id
         )) < ? OR
         (SELECT MAX(last_ts) FROM (
            SELECT MAX(created_at) as last_ts FROM conversation_messages WHERE user_id = u.id
            UNION ALL SELECT MAX(aa5.submitted_at) FROM attempt_answers aa5 JOIN test_attempts ta5 ON aa5.attempt_id = ta5.id WHERE ta5.user_id = u.id
         )) IS NULL
       )
     ORDER BY last_active ASC`
  ).bind(...userFilterParams, threeDaysAgo).all();

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
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) {
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
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || user.role !== 'admin')) return c.json({ error: 'Admin only' }, 403);

  const { test_name, variant_a, variant_b } = await c.req.json();

  // Store A/B test config in analytics
  await c.env.DB.prepare(
    "INSERT INTO analytics (event, data) VALUES ('ab_test_created', ?)"
  ).bind(JSON.stringify({ test_name, variant_a, variant_b, created: new Date().toISOString() })).run();

  return c.json({ status: 'created', test_name });
});

// Get A/B test results
analyticsRoutes.get('/ab-results', async (c) => {
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || user.role !== 'admin')) return c.json({ error: 'Admin only' }, 403);

  const tests = await c.env.DB.prepare(
    "SELECT data FROM analytics WHERE event = 'ab_test_created' ORDER BY created_at DESC LIMIT 10"
  ).all();

  return c.json({ tests: tests.results.map((t: any) => JSON.parse(t.data || '{}')) });
});

// ─── Tracking Endpoints ───────────────────────────────────────────────

// Log client or server errors
analyticsRoutes.post('/error', async (c) => {
  try {
    const body = await c.req.json();
    const user = await getAuthUser(c.req.raw, c.env).catch(() => null);

    await c.env.DB.prepare(
      `INSERT INTO error_logs (source, error_type, message, stack, user_id, url, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.source || 'client',
      body.error_type || 'unknown',
      (body.message || 'Unknown error').substring(0, 1000),
      (body.stack || '').substring(0, 2000),
      user?.id || null,
      (body.url || '').substring(0, 500),
      body.metadata ? JSON.stringify(body.metadata).substring(0, 2000) : null,
    ).run();

    return c.json({ logged: true });
  } catch (e) {
    console.error('Error logging failed:', e);
    return c.json({ logged: false }, 500);
  }
});

// Track a user message / interaction
analyticsRoutes.post('/message', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user?.id) return c.json({ error: 'Unauthorized' }, 401);

  const { message_type = 'text', content_length = 0 } = await c.req.json();
  await trackMessage(c.env, user.id, message_type, content_length);
  await incrementDailyStudyLog(c.env, user.id, 0, 0, 0, 0, 1);
  return c.json({ ok: true });
});

// Start a session (mini app open)
analyticsRoutes.post('/session/start', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user?.id) return c.json({ error: 'Unauthorized' }, 401);

  const { platform = 'mini_app', source = 'unknown' } = await c.req.json();
  const sessionId = await startSession(c.env, user.id, platform, source);
  return c.json({ session_id: sessionId });
});

// End a session (mini app close)
analyticsRoutes.post('/session/end', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user?.id) return c.json({ error: 'Unauthorized' }, 401);

  const { session_id, questions_answered = 0 } = await c.req.json();
  if (session_id) {
    await endSession(c.env, session_id, questions_answered);
  }
  return c.json({ ok: true });
});

// ─── Rich Student Analytics (Teacher/Admin) ────────────────────────

analyticsRoutes.get('/student/:userId', async (c) => {
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) {
    return c.json({ error: 'Teacher or admin access required' }, 403);
  }

  const targetUserId = parseInt(c.req.param('userId'));
  if (!targetUserId) return c.json({ error: 'Invalid user ID' }, 400);

  const analytics = await getStudentAnalytics(c.env, targetUserId);
  return c.json(analytics);
});

// Class student list with key metrics (for teacher dashboard)
analyticsRoutes.get('/class/:classId/students', async (c) => {
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) {
    return c.json({ error: 'Teacher or admin access required' }, 403);
  }

  const classId = parseInt(c.req.param('classId'));
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  // Get all enrolled students in this class
  const students = await c.env.DB.prepare(`
    SELECT
      u.id, u.name, u.username, u.target_test,
      u.current_streak, u.longest_streak, u.last_study_date,
      ug.xp, ug.level, ug.total_questions, ug.is_premium,
      (SELECT COUNT(*) FROM test_attempts ta
       JOIN attempt_answers aa ON ta.id = aa.attempt_id
       WHERE ta.user_id = u.id AND aa.submitted_at >= ?) as week_questions,
      (SELECT CAST(SUM(CASE
         WHEN aa.is_correct=1 THEN 1
         WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
         ELSE 0 END) AS FLOAT) / NULLIF(COUNT(*), 0) * 100
       FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id
       WHERE ta.user_id = u.id AND aa.submitted_at >= ?) as week_accuracy,
      (SELECT SUM(aa.time_spent_seconds) FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE ta.user_id = u.id AND aa.submitted_at >= ?) as week_minutes,
      (SELECT COUNT(DISTINCT date) FROM (
         SELECT DATE(cm.created_at) as date FROM conversation_messages cm WHERE cm.user_id = u.id AND cm.created_at >= ?
         UNION SELECT DATE(aa2.submitted_at) FROM attempt_answers aa2 JOIN test_attempts ta2 ON aa2.attempt_id = ta2.id WHERE ta2.user_id = u.id AND aa2.submitted_at >= ?
      )) as active_days,
      (SELECT MAX(diagnostic.estimated_band) FROM diagnostic_results diagnostic WHERE diagnostic.user_id = u.id) as estimated_band
    FROM users u
    JOIN class_enrollments ce ON ce.user_id = u.id
    LEFT JOIN user_gamification ug ON ug.user_id = u.id
    WHERE ce.class_id = ? AND ce.status = 'active' AND u.role = 'student'
    ORDER BY week_questions DESC
  `).bind(sevenDaysAgo, sevenDaysAgo, sevenDaysAgo, sevenDaysAgo, sevenDaysAgo, classId).all() as any;

  return c.json({
    class_id: classId,
    students: (students.results || []).map((s: any) => ({
      id: s.id,
      name: s.name || s.username || 'Student ' + s.id,
      target_test: s.target_test,
      current_streak: s.current_streak || 0,
      longest_streak: s.longest_streak || 0,
      last_study_date: s.last_study_date,
      xp: s.xp || 0,
      level: s.level || 1,
      total_questions: s.total_questions || 0,
      is_premium: !!s.is_premium,
      estimated_band: s.estimated_band || null,
      week_stats: {
        questions: s.week_questions || 0,
        accuracy: Math.round(s.week_accuracy || 0),
        minutes: Math.round((s.week_minutes || 0) / 60),
        active_days: s.active_days || 0,
      },
    })),
  });
});

// ─── Backfill Analytics (Admin only) ────────────────────────────────

analyticsRoutes.post('/backfill/:userId', async (c) => {
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || user.role !== 'admin')) return c.json({ error: 'Admin only' }, 403);

  const targetUserId = parseInt(c.req.param('userId'));
  if (!targetUserId) return c.json({ error: 'Invalid user ID' }, 400);

  await backfillDailyLogs(c.env, targetUserId, 90);
  return c.json({ ok: true, user_id: targetUserId });
});

// Bulk backfill for all students
analyticsRoutes.post('/backfill-all', async (c) => {
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || user.role !== 'admin')) return c.json({ error: 'Admin only' }, 403);

  const allStudents = await c.env.DB.prepare(
    "SELECT id FROM users WHERE role = 'student'"
  ).all() as any;

  let processed = 0;
  for (const s of (allStudents.results || [])) {
    try {
      await backfillDailyLogs(c.env, s.id, 90);
      processed++;
    } catch {}
  }

  return c.json({ success: true, processed });
});

// ─── IRT & Learning Analytics Endpoints ──────────────────────────────

// Student self-service: full analytics dashboard
analyticsRoutes.get('/me/full', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw, c.env);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const [irt, learning] = await Promise.all([
      getStudentIRTProfile(c.env.DB, user.id),
      getStudentLearningAnalytics(c.env.DB, user.id),
    ]);

    return c.json({
      user_id: user.id, name: user.name,
      irt,
      learning_curves: learning.learningCurves,
      forgetting_curves: learning.forgettingCurves,
      psych_profile: learning.psychProfile,
      retention_alerts: learning.retentionAlerts,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Student self-service: IRT ability
analyticsRoutes.get('/me/irt', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw, c.env);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    return c.json(await getStudentIRTProfile(c.env.DB, user.id));
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// Student self-service: psych profile (compute on demand if missing)
analyticsRoutes.get('/me/psych', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw, c.env);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const analytics = await getStudentLearningAnalytics(c.env.DB, user.id);
    if (!analytics.psychProfile) {
      const profile = await recomputePsychProfile(c.env.DB, user.id);
      return c.json({ profile });
    }
    return c.json({ profile: analytics.psychProfile });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// Student self-service: score predictions
analyticsRoutes.get('/me/predictions', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw, c.env);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const [irt, learning] = await Promise.all([
      getStudentIRTProfile(c.env.DB, user.id),
      getStudentLearningAnalytics(c.env.DB, user.id),
    ]);

    const predictions: Record<string, any> = {};
    for (const ability of irt.abilities.filter(a => a.skill !== 'overall')) {
      const curve = learning.learningCurves.find(lc => lc.skill === ability.skill);
      const forget = learning.forgettingCurves.find(fc => fc.skill === ability.skill);
      predictions[ability.skill] = {
        current_theta: ability.theta,
        current_ibt_section: thetaToIBTSection(ability.theta),
        standard_error: ability.standard_error,
        cefr: thetaToCEFR(ability.theta),
        learning_rate: curve?.rate ?? null,
        predicted_accuracy_2w: curve?.predicted_accuracy_2w ?? null,
        predicted_ibt_2w: curve?.predicted_ibt_section ?? null,
        current_retention: forget?.estimated_retention ?? null,
        memory_strength_hours: forget?.memory_strength ?? null,
      };
    }
    return c.json({
      overall: { ibt_estimate: irt.ibt_estimate, ielts_estimate: irt.ielts_estimate, cefr: irt.cefr, confidence: irt.confidence },
      by_skill: predictions,
    });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// Admin: IRT profile for a specific student
analyticsRoutes.get('/admin/irt/:userId', async (c) => {
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) return c.json({ error: 'Access denied' }, 403);

  const userId = parseInt(c.req.param('userId'));
  if (isNaN(userId)) return c.json({ error: 'Invalid user ID' }, 400);
  return c.json(await getStudentIRTProfile(c.env.DB, userId));
});

// Admin: learning analytics for a specific student
analyticsRoutes.get('/admin/learning/:userId', async (c) => {
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) return c.json({ error: 'Access denied' }, 403);

  const userId = parseInt(c.req.param('userId'));
  if (isNaN(userId)) return c.json({ error: 'Invalid user ID' }, 400);
  return c.json(await getStudentLearningAnalytics(c.env.DB, userId));
});

// Admin: psych profile for a specific student
analyticsRoutes.get('/admin/psych/:userId', async (c) => {
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) return c.json({ error: 'Access denied' }, 403);

  const userId = parseInt(c.req.param('userId'));
  if (isNaN(userId)) return c.json({ error: 'Invalid user ID' }, 400);
  return c.json({ profile: await recomputePsychProfile(c.env.DB, userId) });
});

// Admin: cohort-wide analytics summary
analyticsRoutes.get('/admin/cohort', async (c) => {
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || user.role !== 'admin')) return c.json({ error: 'Admin only' }, 403);

  try {
    const [abilityStats, curveStats, forgetStats, psychStats, itemStats] = await Promise.all([
      c.env.DB.prepare(
        `SELECT skill, COUNT(*) as students, ROUND(AVG(theta),3) as avg_theta,
                ROUND(MIN(theta),3) as min_theta, ROUND(MAX(theta),3) as max_theta,
                ROUND(AVG(standard_error),3) as avg_se, SUM(responses_count) as total_responses
         FROM irt_student_ability GROUP BY skill ORDER BY skill`
      ).all(),
      c.env.DB.prepare(
        `SELECT skill, COUNT(*) as students, ROUND(AVG(a_max),3) as avg_ceiling,
                ROUND(AVG(rate),3) as avg_learning_rate,
                ROUND(AVG(predicted_accuracy_2w),3) as avg_predicted_2w
         FROM learning_curve_models GROUP BY skill ORDER BY skill`
      ).all(),
      c.env.DB.prepare(
        `SELECT skill, COUNT(*) as students, ROUND(AVG(memory_strength),1) as avg_memory_hours,
                ROUND(AVG(avg_recall_rate),3) as avg_recall
         FROM forgetting_curve GROUP BY skill ORDER BY skill`
      ).all(),
      c.env.DB.prepare(
        `SELECT COUNT(*) as students, ROUND(AVG(consistency_score),1) as avg_consistency,
                ROUND(AVG(persistence_score),1) as avg_persistence,
                ROUND(AVG(stamina_index),3) as avg_stamina
         FROM psych_profile`
      ).first(),
      c.env.DB.prepare(
        `SELECT COUNT(*) as total_items,
                SUM(CASE WHEN last_calibrated_at IS NOT NULL THEN 1 ELSE 0 END) as calibrated,
                ROUND(AVG(difficulty),3) as avg_difficulty, SUM(total_responses) as total_responses
         FROM irt_item_params`
      ).first(),
    ]);

    return c.json({
      ability: abilityStats.results || [],
      learning_curves: curveStats.results || [],
      forgetting: forgetStats.results || [],
      psych_profile: psychStats || {},
      item_calibration: itemStats || {},
    });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// Admin: trigger item recalibration
analyticsRoutes.post('/admin/recalibrate', async (c) => {
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || user.role !== 'admin')) return c.json({ error: 'Admin only' }, 403);

  return c.json({ success: true, ...await recalibrateItems(c.env.DB) });
});

// Admin: full recompute for a student (IRT + curves + psych)
analyticsRoutes.post('/admin/recompute/:userId', async (c) => {
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && (!user || user.role !== 'admin')) return c.json({ error: 'Admin only' }, 403);

  const userId = parseInt(c.req.param('userId'));
  if (isNaN(userId)) return c.json({ error: 'Invalid user ID' }, 400);

  try {
    // 1. Get all answers → update IRT
    const answers = await c.env.DB.prepare(
      `SELECT aa.content_id, aa.section, aa.is_correct
       FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id
       WHERE ta.user_id = ? AND aa.is_correct IS NOT NULL ORDER BY aa.submitted_at`
    ).bind(userId).all();

    const responses = (answers.results || []).map((r: any) => ({
      content_id: (r.content_id as number) || 0,
      section: r.section as string,
      is_correct: !!(r.is_correct),
    }));
    const irtResult = await updateStudentAbility(c.env.DB, userId, responses);

    // 2. Rebuild learning curves per skill
    const skills = [...new Set(responses.map(r => r.section))];
    const lcResults: any[] = [];
    for (const skill of skills) {
      const lc = await fitAndSaveLearningCurve(c.env.DB, userId, skill);
      if (lc) lcResults.push(lc);
    }

    // 3. Psych profile
    const psychProfile = await recomputePsychProfile(c.env.DB, userId);

    return c.json({ success: true, irt: irtResult, learning_curves: lcResults, psych_profile: psychProfile });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});