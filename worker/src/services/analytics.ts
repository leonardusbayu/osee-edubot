import type { Env } from '../types';

// ─── Message Tracking ───────────────────────────────────────────────

export async function trackMessage(env: Env, userId: number, messageType: string, contentLength = 0) {
  try {
    await env.DB.prepare(
      'INSERT INTO user_messages (user_id, message_type, content_length) VALUES (?, ?, ?)'
    ).bind(userId, messageType, contentLength).run();
  } catch (e) { console.error('trackMessage error:', e); }
}

// ─── Session Tracking ───────────────────────────────────────────────

export async function startSession(env: Env, userId: number, platform = 'mini_app', source = 'unknown') {
  try {
    const result = await env.DB.prepare(
      'INSERT INTO user_sessions (user_id, platform, source) VALUES (?, ?, ?)'
    ).bind(userId, platform, source).run();
    return result.meta?.last_row_id || null;
  } catch (e) { console.error('startSession error:', e); return null; }
}

export async function endSession(env: Env, sessionId: number, questionsAnswered = 0) {
  try {
    await env.DB.prepare(
      `UPDATE user_sessions
       SET ended_at = datetime('now'),
           duration_seconds = CAST((julianday(datetime('now')) - julianday(started_at)) * 86400 AS INTEGER),
           questions_answered = ?
       WHERE id = ? AND ended_at IS NULL`
    ).bind(questionsAnswered, sessionId).run();
  } catch (e) { console.error('endSession error:', e); }
}

// ─── Daily Study Log Aggregation ────────────────────────────────────

export async function getOrCreateDailyLog(env: Env, userId: number, dateStr: string) {
  const today = dateStr || new Date().toISOString().split('T')[0];
  try {
    const existing = await env.DB.prepare(
      'SELECT * FROM daily_study_logs WHERE user_id = ? AND log_date = ?'
    ).bind(userId, today).first();
    if (existing) return existing;

    await env.DB.prepare(
      'INSERT INTO daily_study_logs (user_id, log_date) VALUES (?, ?)'
    ).bind(userId, today).run();
    return await env.DB.prepare(
      'SELECT * FROM daily_study_logs WHERE user_id = ? AND log_date = ?'
    ).bind(userId, today).first();
  } catch (e) { console.error('getOrCreateDailyLog error:', e); return null; }
}

export async function incrementDailyStudyLog(
  env: Env,
  userId: number,
  questionsDelta: number,
  timeDeltaSeconds: number,
  correctDelta: number,
  testsDelta: number,
  messagesDelta: number,
) {
  const today = new Date().toISOString().split('T')[0];
  try {
    await env.DB.prepare(
      `INSERT INTO daily_study_logs (user_id, log_date, questions_answered, time_spent_seconds, correct_answers, tests_completed, messages_sent)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, log_date) DO UPDATE SET
         questions_answered = questions_answered + ?,
         time_spent_seconds = time_spent_seconds + ?,
         correct_answers = correct_answers + ?,
         tests_completed = tests_completed + ?,
         messages_sent = messages_sent + ?,
         accuracy_percent = CASE
           WHEN questions_answered + ? > 0
           THEN CAST(ROUND(CAST(correct_answers + ? AS FLOAT) * 100 / (questions_answered + ?)) AS INTEGER)
           ELSE 0 END,
         updated_at = datetime('now')`
    ).bind(
      userId, today,
      questionsDelta, timeDeltaSeconds, correctDelta, testsDelta, messagesDelta,
      questionsDelta, timeDeltaSeconds, correctDelta, testsDelta, messagesDelta,
      questionsDelta, correctDelta, questionsDelta,
    ).run();
  } catch (e) { console.error('incrementDailyStudyLog error:', e); }
}

// ─── Skill Progress Tracking ────────────────────────────────────────

export async function trackSkillProgress(
  env: Env,
  userId: number,
  skill: string,
  testType: string,
  questionsAttempted: number,
  correctAnswers: number,
  timeSpentSeconds: number,
) {
  try {
    const accuracy = questionsAttempted > 0
      ? Math.round((correctAnswers / questionsAttempted) * 100)
      : 0;
    await env.DB.prepare(
      `INSERT INTO skill_progress (user_id, skill, test_type, questions_attempted, correct_answers, accuracy_percent, time_spent_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, skill, testType || 'TOEFL_IBT', questionsAttempted, correctAnswers, accuracy, timeSpentSeconds).run();
  } catch (e) { console.error('trackSkillProgress error:', e); }
}

// ─── Streak Update ─────────────────────────────────────────────────

export async function updateStreak(env: Env, userId: number): Promise<{
  newStreak: number;
  streakBroken: boolean;
  previousStreak: number;
} | undefined> {
  // Use WIB (Asia/Jakarta) so the streak day boundary matches the rest of the app
  const wibFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const today = wibFmt.format(new Date());
  const yesterday = wibFmt.format(new Date(Date.now() - 86400000));

  try {
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as any;
    if (!user) return;

    const lastDate = user.last_study_date;
    const previousStreak = user.current_streak || 0;
    let newStreak = previousStreak;
    let streakBroken = false;

    if (lastDate === today) {
      // Already studied today, nothing to update
      return { newStreak: previousStreak, streakBroken: false, previousStreak };
    } else if (lastDate === yesterday) {
      // Consecutive day — increment streak
      newStreak = previousStreak + 1;
    } else {
      // Streak broken — reset
      streakBroken = previousStreak > 1; // Only count as "broken" if they had a real streak
      newStreak = 1;
    }

    const longestStreak = Math.max(user.longest_streak || 0, newStreak);

    await env.DB.prepare(
      'UPDATE users SET current_streak = ?, longest_streak = ?, last_study_date = ? WHERE id = ?'
    ).bind(newStreak, longestStreak, today, userId).run();

    return { newStreak, streakBroken, previousStreak };
  } catch (e) { console.error('updateStreak error:', e); }
}

// ─── Backfill Historical Daily Logs ────────────────────────────────

export async function backfillDailyLogs(env: Env, userId: number, days = 30) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  try {
    // Get daily aggregated data from attempt_answers (score-aware)
    const dailyData = await env.DB.prepare(`
      SELECT
        ta.user_id,
        date(aa.submitted_at) as day,
        COUNT(*) as questions,
        SUM(CASE
          WHEN aa.is_correct = 1 THEN 1
          WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
          ELSE 0 END) as correct,
        SUM(aa.time_spent_seconds) as time_spent,
        COUNT(DISTINCT aa.attempt_id) as test_sessions
      FROM attempt_answers aa
      JOIN test_attempts ta ON aa.attempt_id = ta.id
      WHERE ta.user_id = ? AND date(aa.submitted_at) >= ?
      GROUP BY ta.user_id, day
    `).bind(userId, cutoff).all() as any;

    // Get message counts per day (use conversation_messages, not sparse user_messages)
    const messageData = await env.DB.prepare(`
      SELECT date(created_at) as day, COUNT(*) as messages
      FROM conversation_messages
      WHERE user_id = ? AND role = 'user' AND date(created_at) >= ?
      GROUP BY day
    `).bind(userId, cutoff).all() as any;

    const msgMap: Record<string, number> = {};
    for (const m of messageData.results as any[]) {
      msgMap[m.day] = m.messages;
    }

    for (const row of dailyData.results as any[]) {
      const accuracy = row.questions > 0
        ? Math.round((row.correct / row.questions) * 100)
        : 0;
      try {
        await env.DB.prepare(
          `INSERT INTO daily_study_logs (user_id, log_date, questions_answered, correct_answers, time_spent_seconds, tests_completed, accuracy_percent, messages_sent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, log_date) DO UPDATE SET
             questions_answered = COALESCE(?, questions_answered),
             correct_answers = COALESCE(?, correct_answers),
             time_spent_seconds = COALESCE(?, time_spent_seconds),
             tests_completed = COALESCE(?, tests_completed),
             accuracy_percent = COALESCE(?, accuracy_percent),
             messages_sent = ?`
        ).bind(
          row.user_id, row.day,
          row.questions, row.correct, row.time_spent || 0, row.test_sessions, accuracy, msgMap[row.day] || 0,
          row.questions, row.correct, row.time_spent || 0, row.test_sessions, accuracy, msgMap[row.day] || 0,
        ).run();
      } catch {}
    }
  } catch (e) { console.error('backfillDailyLogs error:', e); }
}

// ─── Rich Student Analytics ─────────────────────────────────────────

export async function getStudentAnalytics(env: Env, userId: number) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  // Ensure daily logs exist for today
  await getOrCreateDailyLog(env, userId, today);

  // Backfill historical data for this user
  await backfillDailyLogs(env, userId, 30);

  // Basic stats (speaking/writing use score in answer_data, not is_correct)
  const [answers, testsResult, user, streakResult] = await Promise.all([
    env.DB.prepare(`
      SELECT COUNT(*) as total, SUM(CASE
        WHEN is_correct = 1 THEN 1
        WHEN is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
        ELSE 0 END) as correct
      FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id
      WHERE ta.user_id = ?
    `).bind(userId).first() as any,

    env.DB.prepare(`
      SELECT COUNT(*) as count FROM test_attempts
      WHERE user_id = ? AND status = 'completed'
    `).bind(userId).first() as any,

    env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as any,

    env.DB.prepare('SELECT * FROM user_sessions WHERE user_id = ?').bind(userId).all() as any,
  ]);

  // Session totals (from attempt_answers instead of user_sessions)
  const sessionData = await env.DB.prepare(`
    SELECT 
      COUNT(DISTINCT date(aa.submitted_at)) as active_days,
      SUM(aa.time_spent_seconds) as total_time_seconds,
      COUNT(DISTINCT aa.attempt_id) as sessions_count
    FROM attempt_answers aa
    JOIN test_attempts ta ON aa.attempt_id = ta.id
    WHERE ta.user_id = ?
  `).bind(userId).first() as any;
  const sessions: any[] = [];
  const totalSessionMinutes = Math.round((sessionData?.total_time_seconds || 0) / 60);

  // Message count (use conversation_messages, not sparse user_messages)
  const msgResult = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM conversation_messages WHERE user_id = ? AND role = \'user\''
  ).bind(userId).first() as any;

  // Section accuracy (last 30 days, score-aware for speaking/writing)
  const sectionStats = await env.DB.prepare(`
    SELECT aa.section,
           COUNT(*) as total,
           SUM(CASE
             WHEN aa.is_correct = 1 THEN 1
             WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
             ELSE 0 END) as correct
    FROM attempt_answers aa
    JOIN test_attempts ta ON aa.attempt_id = ta.id
    WHERE ta.user_id = ? AND aa.submitted_at >= ?
    GROUP BY aa.section
  `).bind(userId, thirtyDaysAgo).all() as any;

  // Daily logs for chart (last 30 days, from attempt_answers + conversation_messages)
  const dailyLogsData = await env.DB.prepare(`
    SELECT log_date, SUM(questions_answered) as questions_answered,
           SUM(time_spent_seconds) as time_spent_seconds,
           CASE WHEN SUM(questions_answered) > 0
             THEN ROUND(CAST(SUM(correct) AS REAL) / SUM(questions_answered) * 100)
             ELSE 0 END as accuracy_percent,
           SUM(messages) as messages
    FROM (
      SELECT date(aa.submitted_at) as log_date,
             COUNT(*) as questions_answered,
             SUM(aa.time_spent_seconds) as time_spent_seconds,
             SUM(CASE
               WHEN aa.is_correct = 1 THEN 1
               WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
               ELSE 0 END) as correct,
             0 as messages
      FROM attempt_answers aa
      JOIN test_attempts ta ON aa.attempt_id = ta.id
      WHERE ta.user_id = ? AND date(aa.submitted_at) >= ?
      GROUP BY date(aa.submitted_at)
      UNION ALL
      SELECT date(created_at) as log_date, 0, 0, 0, COUNT(*) as messages
      FROM conversation_messages
      WHERE user_id = ? AND date(created_at) >= ?
      GROUP BY date(created_at)
    ) GROUP BY log_date ORDER BY log_date ASC
  `).bind(userId, thirtyDaysAgo, userId, thirtyDaysAgo).all() as any;

  // Skills breakdown
  const skillsData = await env.DB.prepare(`
    SELECT skill,
           AVG(accuracy_percent) as avg_accuracy,
           SUM(questions_attempted) as total_attempts,
           SUM(correct_answers) as total_correct,
           SUM(time_spent_seconds) as total_time,
           COUNT(*) as practice_count
    FROM skill_progress
    WHERE user_id = ? AND practiced_at >= ?
    GROUP BY skill
    ORDER BY avg_accuracy ASC
  `).bind(userId, thirtyDaysAgo).all() as any;

  // Skill trend: compare last 7 days vs previous 7 days
  const skillTrendMap: Record<string, number> = {};
  for (const s of skillsData.results as any[]) {
    const last7 = await env.DB.prepare(`
      SELECT AVG(accuracy_percent) as avg
      FROM skill_progress
      WHERE user_id = ? AND skill = ? AND practiced_at >= ?
    `).bind(userId, s.skill, sevenDaysAgo).first() as any;

    const prev7 = await env.DB.prepare(`
      SELECT AVG(accuracy_percent) as avg
      FROM skill_progress
      WHERE user_id = ? AND skill = ?
        AND practiced_at < ? AND practiced_at >= ?
    `).bind(userId, s.skill, sevenDaysAgo, thirtyDaysAgo).first() as any;

    if (last7?.avg && prev7?.avg) {
      skillTrendMap[s.skill] = last7.avg - prev7.avg;
    } else {
      skillTrendMap[s.skill] = 0;
    }
  }

  // Diagnostic result
  const diagnostic = await env.DB.prepare(`
    SELECT * FROM diagnostic_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
  `).bind(userId).first() as any;

  // Study tendency: preferred time of day (from attempt_answers)
  const hourlyActivity = await env.DB.prepare(`
    SELECT strftime('%H', aa.submitted_at) as hour, COUNT(*) as count
    FROM attempt_answers aa
    JOIN test_attempts ta ON aa.attempt_id = ta.id
    WHERE ta.user_id = ? AND aa.submitted_at >= ?
    GROUP BY hour
    ORDER BY count DESC
    LIMIT 1
  `).bind(userId, thirtyDaysAgo).first() as any;

  let preferredTime = 'morning';
  if (hourlyActivity) {
    const h = parseInt(hourlyActivity.hour);
    if (h >= 6 && h < 12) preferredTime = 'morning';
    else if (h >= 12 && h < 18) preferredTime = 'afternoon';
    else if (h >= 18 && h < 22) preferredTime = 'evening';
    else preferredTime = 'night';
  }

  // Most active day of week (from attempt_answers)
  const dayActivity = await env.DB.prepare(`
    SELECT strftime('%w', aa.submitted_at) as dow, COUNT(*) as count
    FROM attempt_answers aa
    JOIN test_attempts ta ON aa.attempt_id = ta.id
    WHERE ta.user_id = ? AND aa.submitted_at >= ?
    GROUP BY dow
    ORDER BY count DESC
    LIMIT 1
  `).bind(userId, thirtyDaysAgo).first() as any;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const mostActiveDay = dayActivity ? dayNames[parseInt(dayActivity.dow)] : null;

  // Calculate section accuracy
  const sectionAccuracy: Record<string, number> = {};
  for (const s of sectionStats.results as any[]) {
    sectionAccuracy[s.section] = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
  }

  // Weakest section
  const weakest = Object.entries(sectionAccuracy).sort(([, a], [, b]) => a - b)[0];

  // Time spent last 7 days (from attempt_answers)
  const timeStats7d = await env.DB.prepare(`
    SELECT SUM(aa.time_spent_seconds) as total_time, COUNT(*) as total_q
    FROM attempt_answers aa
    JOIN test_attempts ta ON aa.attempt_id = ta.id
    WHERE ta.user_id = ? AND aa.submitted_at >= ?
  `).bind(userId, sevenDaysAgo).first() as any;

  const totalAnswers = answers?.total || 0;
  const totalCorrect = answers?.correct || 0;

  // Avg session minutes
  const avgSessionMinutes = (sessionData?.sessions_count || 0) > 0
    ? Math.round(totalSessionMinutes / (sessionData?.sessions_count || 0))
    : 0;

  // Weekly frequency (days active per week, from attempt_answers + conversation_messages)
  const activeDays = await env.DB.prepare(`
    SELECT COUNT(DISTINCT date) as days FROM (
      SELECT date(aa.submitted_at) as date FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE ta.user_id = ? AND date(aa.submitted_at) >= ?
      UNION SELECT date(created_at) FROM conversation_messages WHERE user_id = ? AND date(created_at) >= ?
    )
  `).bind(userId, thirtyDaysAgo, userId, thirtyDaysAgo).first() as any;
  const weeklyFrequency = Math.round(((activeDays?.days || 0) / 4) * 10) / 10;

  // Percentile rank (compared to all students, score-aware)
  const userAccuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;
  const percentileResult = await env.DB.prepare(`
    WITH user_acc AS (SELECT ? as user_id, ? as accuracy),
    all_acc AS (
      SELECT ta.user_id,
             CAST(SUM(CASE
               WHEN aa.is_correct = 1 THEN 1
               WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing') AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
               ELSE 0 END) AS REAL) / NULLIF(COUNT(*), 0) * 100 as accuracy
      FROM attempt_answers aa
      JOIN test_attempts ta ON aa.attempt_id = ta.id
      GROUP BY ta.user_id
    )
    SELECT SUM(CASE WHEN accuracy < (SELECT accuracy FROM user_acc) THEN 1.0 ELSE 0.0 END) /
           COUNT(*) * 100 as percentile
    FROM all_acc
  `).bind(userId, userAccuracy).first() as any;

  return {
    // Overview
    total_questions: totalAnswers,
    total_correct: totalCorrect,
    total_time_minutes: totalSessionMinutes,
    total_messages: msgResult?.count || 0,
    total_sessions: sessionData?.sessions_count || 0,
    tests_completed: testsResult?.count || 0,
    current_streak: user?.current_streak || 0,
    longest_streak: user?.longest_streak || 0,

    // Performance
    overall_accuracy: totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0,
    section_accuracy: sectionAccuracy,
    weakest_section: weakest ? weakest[0] : null,
    weakest_accuracy: weakest ? weakest[1] : 0,

    // Study patterns
    study_tendency: {
      preferred_time: preferredTime,
      avg_session_minutes: avgSessionMinutes,
      avg_questions_per_session: sessions.length > 0 ? Math.round(totalAnswers / sessions.length) : 0,
      most_active_day: mostActiveDay,
      weekly_frequency: weeklyFrequency,
      last_7_days_minutes: Math.round((timeStats7d?.total_time || 0) / 60),
      last_7_days_questions: timeStats7d?.total_q || 0,
    },

    // Skills breakdown
    skills: (skillsData.results as any[]).map((s: any) => ({
      skill: s.skill,
      accuracy: Math.round(s.avg_accuracy || 0),
      attempts: s.total_attempts || 0,
      time_minutes: Math.round((s.total_time || 0) / 60),
      trend: skillTrendMap[s.skill] > 5 ? 'up' : skillTrendMap[s.skill] < -5 ? 'down' : 'stable',
      trend_delta: Math.round(skillTrendMap[s.skill]),
    })),

    // Diagnostic
    diagnostic: diagnostic ? {
      grammar: { score: diagnostic.grammar_score, total: diagnostic.grammar_total },
      vocab: { score: diagnostic.vocab_score, total: diagnostic.vocab_total },
      reading: { score: diagnostic.reading_score, total: diagnostic.reading_total },
      listening: { score: diagnostic.listening_score, total: diagnostic.listening_total },
      writing_band: diagnostic.writing_band,
      estimated_band: diagnostic.estimated_band,
      completed_at: diagnostic.created_at,
    } : null,

    // Daily chart data
    daily_logs: (dailyLogsData.results as any[]).map((d: any) => ({
      date: d.log_date,
      questions: d.questions_answered || 0,
      time_minutes: Math.round((d.time_spent_seconds || 0) / 60),
      accuracy: d.accuracy_percent || 0,
      messages: d.messages || 0,
      sessions: 0,
      tests: 0,
    })),

    // Comparisons
    percentile: Math.round(percentileResult?.percentile || 50),
  };
}
