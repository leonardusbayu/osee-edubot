import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';

export const classRoutes = new Hono<{ Bindings: Env }>();

function isAdminRequest(c: any): boolean {
  const secret = c.req.header('x-admin-secret');
  return secret === c.env.ADMIN_SECRET;
}

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
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);
  if (!isSecret && !user) return c.json({ error: 'Unauthorized' }, 401);

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

// Get ALL students system-wide (admin/teacher)
classRoutes.get('/all/students', async (c) => {
  const isSecret = isAdminRequest(c);
  const user = isSecret ? { id: 0, role: 'admin' } : await getAuthUser(c.req.raw, c.env);

  if (!isSecret && (!user || user.role === 'student')) {
    return c.json({ error: 'Teacher/Admin access required' }, 403);
  }

  try {
    // Step 1: get all users (including streak columns)
    const usersResult = await c.env.DB.prepare(
      `SELECT id, name, username, role, proficiency_level, target_test, created_at,
              current_streak, longest_streak, last_study_date
       FROM users ORDER BY name`
    ).all();

    // Step 2: attempt stats per user (speaking/writing use score in answer_data, not is_correct)
    const statsResult = await c.env.DB.prepare(
      `SELECT ta.user_id,
         COUNT(CASE WHEN aa.id IS NOT NULL AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing')) THEN 1 END) as questions_answered,
         SUM(CASE
           WHEN aa.is_correct = 1 THEN 1
           WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing')
                AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
           ELSE 0
         END) as correct_answers,
         COUNT(DISTINCT CASE WHEN ta.status = 'completed' THEN ta.id END) as tests_taken,
         (SELECT MAX(last_ts) FROM (
            SELECT MAX(cm.created_at) as last_ts FROM conversation_messages cm WHERE cm.user_id = ta.user_id
            UNION ALL SELECT MAX(aa2.submitted_at) FROM attempt_answers aa2 JOIN test_attempts ta2 ON aa2.attempt_id = ta2.id WHERE ta2.user_id = ta.user_id
         )) as last_active
       FROM test_attempts ta
       LEFT JOIN attempt_answers aa ON aa.attempt_id = ta.id
       GROUP BY ta.user_id`
    ).all();

    // Step 3: latest test scores per user
    const scoresResult = await c.env.DB.prepare(
      `SELECT ta.user_id, tr.total_score, tr.band_score
       FROM test_results tr
       JOIN test_attempts ta ON tr.attempt_id = ta.id
       WHERE tr.rowid IN (
         SELECT MAX(tr2.rowid) FROM test_results tr2
         JOIN test_attempts ta2 ON tr2.attempt_id = ta2.id
         GROUP BY ta2.user_id
       )`
    ).all();

    // Step 4: diagnostic results per user (latest)
    const diagResult = await c.env.DB.prepare(
      `SELECT user_id, estimated_band FROM diagnostic_results
       WHERE rowid IN (SELECT MAX(rowid) FROM diagnostic_results GROUP BY user_id)`
    ).all();

    // Step 5: conversation messages per user (diligence metric)
    const convResult = await c.env.DB.prepare(
      `SELECT user_id, COUNT(*) as message_count, MAX(created_at) as last_message
       FROM conversation_messages
       WHERE role = 'user'
       GROUP BY user_id`
    ).all();

    // Step 6: gamification stats per user (including is_premium)
    const gamResult = await c.env.DB.prepare(
      `SELECT user_id, xp, level, total_questions, daily_limit_used, is_premium
       FROM user_gamification`
    ).all();

    // Step 7: active days per user (conversation_messages + attempt_answers)
    const streakResult = await c.env.DB.prepare(
      `SELECT user_id, COUNT(DISTINCT date) as active_days FROM (
         SELECT ta.user_id, DATE(aa.submitted_at) as date
         FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id
         UNION
         SELECT user_id, DATE(created_at) as date FROM conversation_messages
       ) GROUP BY user_id`
    ).all();

    // Step 8: avg time per question and weakest section per user
    // weakest = most wrong for MC sections, or lowest avg score for speaking/writing
    const timeAndSectionResult = await c.env.DB.prepare(
      `SELECT ta.user_id,
         AVG(aa.time_spent_seconds) as avg_time_per_question,
         (SELECT aa2.section FROM attempt_answers aa2
          JOIN test_attempts ta2 ON aa2.attempt_id = ta2.id
          WHERE ta2.user_id = ta.user_id AND (aa2.is_correct = 0 OR (aa2.is_correct IS NULL AND aa2.section IN ('speaking','writing') AND json_extract(aa2.answer_data, '$.score') < 5))
          GROUP BY aa2.section ORDER BY COUNT(*) DESC LIMIT 1) as weakest_section
       FROM attempt_answers aa
       JOIN test_attempts ta ON aa.attempt_id = ta.id
       GROUP BY ta.user_id`
    ).all();

    // Step 9: /today usage (study plan interactions) per user
    const todayUsageResult = await c.env.DB.prepare(
      `SELECT user_id, COUNT(*) as today_usage
       FROM analytics
       WHERE event = 'study_plan_viewed'
       GROUP BY user_id`
    ).all();

    // Step 10: week stats (last 7 days) per user — handle speaking/writing scores
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const weekStatsResult = await c.env.DB.prepare(
      `SELECT ta.user_id,
          COUNT(aa.id) as week_questions,
          CAST(SUM(CASE
            WHEN aa.is_correct = 1 THEN 1
            WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing')
                 AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
            ELSE 0
          END) AS FLOAT) / NULLIF(COUNT(*), 0) * 100 as week_accuracy,
          SUM(COALESCE(aa.time_spent_seconds, 0)) as week_seconds,
          COUNT(DISTINCT DATE(aa.submitted_at)) as active_days
       FROM attempt_answers aa
       JOIN test_attempts ta ON aa.attempt_id = ta.id
       WHERE aa.submitted_at >= ?
         AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))
       GROUP BY ta.user_id`
    ).bind(sevenDaysAgo).all();

    // Step 11: daily_question_logs (bot study questions, separate from mini app tests)
    const dqlResult = await c.env.DB.prepare(
      `SELECT user_id, SUM(questions_answered) as bot_questions
       FROM daily_question_logs GROUP BY user_id`
    ).all();

    // Step 12: week messages from conversation_messages (for bot-only students)
    const weekMsgsResult = await c.env.DB.prepare(
      `SELECT user_id,
          COUNT(*) as week_messages,
          COUNT(DISTINCT DATE(created_at)) as msg_active_days
       FROM conversation_messages
       WHERE role = 'user' AND created_at >= ?
       GROUP BY user_id`
    ).bind(sevenDaysAgo).all();

    // Build lookup maps (normalize user_id to integer to handle .0 suffix)
    function normalizeId(id: any): number {
      if (typeof id === 'number') return Math.floor(id);
      return parseInt(String(id).replace('.0', ''));
    }

    const statsMap: Record<number, any> = {};
    for (const s of statsResult.results as any[]) {
      statsMap[normalizeId(s.user_id)] = s;
    }
    const scoresMap: Record<number, any> = {};
    for (const s of scoresResult.results as any[]) {
      scoresMap[normalizeId(s.user_id)] = s;
    }
    const diagMap: Record<number, any> = {};
    for (const s of diagResult.results as any[]) {
      diagMap[normalizeId(s.user_id)] = s;
    }
    const convMap: Record<number, any> = {};
    for (const s of convResult.results as any[]) {
      convMap[normalizeId(s.user_id)] = s;
    }
    const gamMap: Record<number, any> = {};
    for (const s of gamResult.results as any[]) {
      gamMap[normalizeId(s.user_id)] = s;
    }
    const streakMap: Record<number, any> = {};
    for (const s of streakResult.results as any[]) {
      streakMap[normalizeId(s.user_id)] = s;
    }
    const timeAndSectionMap: Record<number, any> = {};
    for (const s of timeAndSectionResult.results as any[]) {
      timeAndSectionMap[normalizeId(s.user_id)] = s;
    }
    const todayUsageMap: Record<number, any> = {};
    for (const s of todayUsageResult.results as any[]) {
      todayUsageMap[normalizeId(s.user_id)] = s;
    }
    const weekStatsMap: Record<number, any> = {};
    for (const s of weekStatsResult.results as any[]) {
      weekStatsMap[normalizeId(s.user_id)] = s;
    }
    const dqlMap: Record<number, any> = {};
    for (const s of dqlResult.results as any[]) {
      dqlMap[normalizeId(s.user_id)] = s;
    }
    const weekMsgsMap: Record<number, any> = {};
    for (const s of weekMsgsResult.results as any[]) {
      weekMsgsMap[normalizeId(s.user_id)] = s;
    }

    const result = (usersResult.results as any[]).map((u: any) => {
      const uid = normalizeId(u.id);
      const stats = statsMap[uid] || { questions_answered: 0, correct_answers: 0, tests_taken: 0, last_active: null };
      const score = scoresMap[uid] || { total_score: null, band_score: null };
      const diag = diagMap[uid] || { estimated_band: null };
      const conv = convMap[uid] || { message_count: 0, last_message: null };
      const gam = gamMap[uid] || { xp: 0, level: 1, total_questions: 0, daily_limit_used: 0 };
      const streak = streakMap[uid] || { active_days: 0 };
      const timeAndSection = timeAndSectionMap[uid] || { avg_time_per_question: null, weakest_section: null };
      const todayUsage = todayUsageMap[uid] || { today_usage: 0 };
      const weekStats = weekStatsMap[uid] || { week_questions: 0, week_accuracy: 0, week_seconds: 0, active_days: 0 };
      const dql = dqlMap[uid] || { bot_questions: 0 };
      const weekMsgs = weekMsgsMap[uid] || { week_messages: 0, msg_active_days: 0 };

      // Total questions = mini app test answers + bot study questions
      const testQuestions = stats.questions_answered || 0;
      const botQuestions = dql.bot_questions || 0;
      const totalQuestions = testQuestions + botQuestions;

      // Determine study type for display
      const hasTests = testQuestions > 0;
      const hasMessages = (conv.message_count || 0) > 0;
      const studyType = hasTests ? 'test' : hasMessages ? 'bot_only' : 'inactive';

      return {
        id: uid,
        name: u.name,
        username: u.username,
        role: u.role,
        proficiency_level: u.proficiency_level,
        target_test: u.target_test,
        tests_taken: stats.tests_taken || 0,
        questions_answered: totalQuestions,
        correct_answers: stats.correct_answers || 0,
        accuracy: testQuestions > 0
          ? Math.round(((stats.correct_answers || 0) / testQuestions) * 100)
          : 0,
        study_type: studyType,
        bot_questions: botQuestions,
        latest_score: score.total_score,
        diagnostic_band: diag.estimated_band || score.band_score,
        estimated_band: diag.estimated_band || null,
        last_active: stats.last_active || conv.last_message || null,
        messages_sent: conv.message_count || 0,
        last_message: conv.last_message || null,
        xp: gam.xp || 0,
        level: gam.level || 1,
        active_days: streak.active_days || 0,
        avg_time_per_question: timeAndSection.avg_time_per_question ? Math.round(timeAndSection.avg_time_per_question) : null,
        weakest_section: timeAndSection.weakest_section || null,
        today_usage: todayUsage.today_usage || 0,
        created_at: u.created_at,
        current_streak: u.current_streak || 0,
        longest_streak: u.longest_streak || 0,
        last_study_date: u.last_study_date || null,
        is_premium: !!gam.is_premium,
        week_stats: {
          questions: weekStats.week_questions || 0,
          accuracy: Math.round(weekStats.week_accuracy || 0),
          minutes: Math.round((weekStats.week_seconds || 0) / 60),
          active_days: Math.max(weekStats.active_days || 0, weekMsgs.msg_active_days || 0),
          messages: weekMsgs.week_messages || 0,
        },
      };
    });

    return c.json(result);
  } catch (e: any) {
    return c.json({ error: 'Class operation failed' }, 500);
  }
});

// Export all students data as CSV (admin/teacher)
classRoutes.get('/export', async (c) => {
  const authHeader = c.req.raw.headers.get('Authorization');
  const tgHeader = c.req.raw.headers.get('X-Telegram-User-Id');
  const user = await getAuthUser(c.req.raw, c.env);
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  if (user.role === 'student') {
    return c.json({ error: 'Teacher/Admin access required' }, 403);
  }

  try {
    const testType = c.req.query('test_type');
    
    // Get all users (optionally filtered by test_type)
    let userQuery = `SELECT id, name, username, role, proficiency_level, target_test, created_at FROM users`;
    if (testType) {
      userQuery += ` WHERE target_test = '${testType}'`;
    }
    userQuery += ` ORDER BY name`;
    const usersResult = await c.env.DB.prepare(userQuery).all();

    // Build CSV
    const headers = [
      'Name', 'Username', 'Role', 'Proficiency', 'Target Test', 'Tests Taken',
      'Questions', 'Correct', 'Accuracy %', 'Latest Score', 'Diagnostic Band',
      'Last Active', 'Messages', 'XP', 'Level', 'Active Days',
      'Avg Time/Q (sec)', 'Weakest Section', '/today Usage', 'Joined'
    ];

    const rows: string[][] = [headers];

    // Reuse the same queries as /all/students for data
    const statsResult = await c.env.DB.prepare(
      `SELECT ta.user_id,
         COUNT(CASE WHEN aa.id IS NOT NULL AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing')) THEN 1 END) as questions_answered,
         SUM(CASE
           WHEN aa.is_correct = 1 THEN 1
           WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
           ELSE 0
         END) as correct_answers,
         COUNT(DISTINCT CASE WHEN ta.status = 'completed' THEN ta.id END) as tests_taken,
         MAX(aa.submitted_at) as last_active
       FROM test_attempts ta
       LEFT JOIN attempt_answers aa ON aa.attempt_id = ta.id
       GROUP BY ta.user_id`
    ).all();

    const scoresResult = await c.env.DB.prepare(
      `SELECT ta.user_id, tr.total_score, tr.band_score
       FROM test_results tr
       JOIN test_attempts ta ON tr.attempt_id = ta.id
       WHERE tr.rowid IN (
         SELECT MAX(tr2.rowid) FROM test_results tr2
         JOIN test_attempts ta2 ON tr2.attempt_id = ta2.id
         GROUP BY ta2.user_id
       )`
    ).all();

    const diagResult = await c.env.DB.prepare(
      `SELECT user_id, estimated_band FROM diagnostic_results
       WHERE rowid IN (SELECT MAX(rowid) FROM diagnostic_results GROUP BY user_id)`
    ).all();

    const convResult = await c.env.DB.prepare(
      `SELECT user_id, COUNT(*) as message_count
       FROM conversation_messages WHERE role = 'user'
       GROUP BY user_id`
    ).all();

    const gamResult = await c.env.DB.prepare(
      `SELECT user_id, xp, level FROM user_gamification`
    ).all();

    const streakResult = await c.env.DB.prepare(
      `SELECT ta.user_id, COUNT(DISTINCT DATE(aa.submitted_at)) as active_days
       FROM attempt_answers aa
       JOIN test_attempts ta ON aa.attempt_id = ta.id
       GROUP BY ta.user_id`
    ).all();

    const timeAndSectionResult = await c.env.DB.prepare(
      `SELECT ta.user_id,
         AVG(aa.time_spent_seconds) as avg_time,
         (SELECT aa2.section FROM attempt_answers aa2
          JOIN test_attempts ta2 ON aa2.attempt_id = ta2.id
          WHERE ta2.user_id = ta.user_id AND aa2.is_correct = 0
          GROUP BY aa2.section ORDER BY COUNT(*) DESC LIMIT 1) as weakest
       FROM attempt_answers aa
       JOIN test_attempts ta ON aa.attempt_id = ta.id
       GROUP BY ta.user_id`
    ).all();

    const todayUsageResult = await c.env.DB.prepare(
      `SELECT user_id, COUNT(*) as usage FROM analytics
       WHERE event = 'study_plan_viewed' GROUP BY user_id`
    ).all();

    function normalizeId(id: any): number {
      if (typeof id === 'number') return Math.floor(id);
      return parseInt(String(id).replace('.0', ''));
    }

    const statsMap: Record<number, any> = {};
    for (const s of statsResult.results as any[]) { statsMap[normalizeId(s.user_id)] = s; }
    const scoresMap: Record<number, any> = {};
    for (const s of scoresResult.results as any[]) { scoresMap[normalizeId(s.user_id)] = s; }
    const diagMap: Record<number, any> = {};
    for (const s of diagResult.results as any[]) { diagMap[normalizeId(s.user_id)] = s; }
    const convMap: Record<number, any> = {};
    for (const s of convResult.results as any[]) { convMap[normalizeId(s.user_id)] = s; }
    const gamMap: Record<number, any> = {};
    for (const s of gamResult.results as any[]) { gamMap[normalizeId(s.user_id)] = s; }
    const streakMap: Record<number, any> = {};
    for (const s of streakResult.results as any[]) { streakMap[normalizeId(s.user_id)] = s; }
    const timeMap: Record<number, any> = {};
    for (const s of timeAndSectionResult.results as any[]) { timeMap[normalizeId(s.user_id)] = s; }
    const todayMap: Record<number, any> = {};
    for (const s of todayUsageResult.results as any[]) { todayMap[normalizeId(s.user_id)] = s; }

    for (const u of usersResult.results as any[]) {
      const uid = normalizeId(u.id);
      const stats = statsMap[uid] || { questions_answered: 0, correct_answers: 0, tests_taken: 0, last_active: null };
      const score = scoresMap[uid] || { total_score: null, band_score: null };
      const diag = diagMap[uid] || { estimated_band: null };
      const conv = convMap[uid] || { message_count: 0 };
      const gam = gamMap[uid] || { xp: 0, level: 1 };
      const streak = streakMap[uid] || { active_days: 0 };
      const time = timeMap[uid] || { avg_time: null, weakest: null };
      const today = todayMap[uid] || { usage: 0 };

      const accuracy = stats.questions_answered > 0
        ? Math.round(((stats.correct_answers || 0) / stats.questions_answered) * 100)
        : 0;

      rows.push([
        u.name || '',
        u.username || '',
        u.role || '',
        u.proficiency_level || '',
        u.target_test || '',
        String(stats.tests_taken || 0),
        String(stats.questions_answered || 0),
        String(stats.correct_answers || 0),
        String(accuracy),
        score.total_score != null ? String(score.total_score) : '',
        diag.estimated_band != null ? String(diag.estimated_band) : (score.band_score != null ? String(score.band_score) : ''),
        stats.last_active || '',
        String(conv.message_count || 0),
        String(gam.xp || 0),
        String(gam.level || 1),
        String(streak.active_days || 0),
        time.avg_time ? String(Math.round(time.avg_time)) : '',
        time.weakest || '',
        String(today.usage || 0),
        u.created_at || '',
      ]);
    }

    // Build CSV string
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="students_export_${testType || 'all'}_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (e: any) {
    return c.json({ error: 'Class operation failed' }, 500);
  }
});

// Get class students with progress (teacher only)
classRoutes.get('/:id/students', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  // Deny explicit students, allow admin/teacher/unassigned
  if (!user || user.role === 'student') {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  const classId = parseInt(c.req.param('id'));

  const students = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.username, u.proficiency_level, u.target_test,
       (SELECT COUNT(*) FROM test_attempts WHERE user_id = u.id AND status = 'completed') as tests_taken,
       (SELECT COUNT(*) FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE ta.user_id = u.id AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))) as questions_answered,
       (SELECT SUM(CASE WHEN aa.is_correct = 1 THEN 1 WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1 ELSE 0 END) FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE ta.user_id = u.id AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))) as correct_answers,
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
