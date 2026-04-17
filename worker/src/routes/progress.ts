import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';

export const progressRoutes = new Hono<{ Bindings: Env }>();

progressRoutes.get('/overview', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user?.id) {
    return c.json({
      total_tests: 0, total_questions_practiced: 0, correct_answers: 0, wrong_answers: 0,
      overall_accuracy: 0, best_score: null, average_score: null, study_streak: 0,
      section_stats: [], test_results: [], weaknesses: [],
      spaced_repetition: { total: 0, due: 0, mastered: 0 },
      time_per_question: [],
    });
  }
  const userId = user.id;

  try {
    // 1. Total completed tests + practice sessions
    const testsResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM test_attempts WHERE user_id = ? AND status = 'completed'"
    ).bind(userId).first() as any;
    const totalTests = testsResult?.count || 0;

    // 2. Total answers submitted across all attempts
    const answersResult = await c.env.DB.prepare(
      `SELECT
         COUNT(*) as total_answers,
         SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
         SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) as wrong_answers
       FROM attempt_answers aa
       JOIN test_attempts ta ON aa.attempt_id = ta.id
       WHERE ta.user_id = ?`
    ).bind(userId).first() as any;

    const totalAnswers = answersResult?.total_answers || 0;
    const correctAnswers = answersResult?.correct_answers || 0;
    const wrongAnswers = answersResult?.wrong_answers || 0;

    // 3. Answers by section
    const sectionStats = await c.env.DB.prepare(
      `SELECT
         aa.section,
         COUNT(*) as total,
         SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct,
         SUM(CASE WHEN aa.is_correct = 0 THEN 1 ELSE 0 END) as wrong
       FROM attempt_answers aa
       JOIN test_attempts ta ON aa.attempt_id = ta.id
       WHERE ta.user_id = ?
       GROUP BY aa.section`
    ).bind(userId).all();

    // 4. Test results (full test scores)
    const testResults = await c.env.DB.prepare(
      `SELECT tr.*, ta.test_type, ta.finished_at, ta.started_at
       FROM test_results tr
       JOIN test_attempts ta ON tr.attempt_id = ta.id
       WHERE ta.user_id = ?
       ORDER BY tr.created_at DESC
       LIMIT 20`
    ).bind(userId).all();

    const scores = testResults.results.map((r: any) => r.total_score as number).filter((s: number) => s != null && !isNaN(s));
    const bestScore = scores.length > 0 ? Math.max(...scores) : null;
    const avgScore = scores.length > 0
      ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10
      : null;

    // 5. Question type breakdown (what types the student practiced most)
    const typeBreakdown = await c.env.DB.prepare(
      `SELECT
         aa.section,
         COUNT(*) as total,
         SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct
       FROM attempt_answers aa
       JOIN test_attempts ta ON aa.attempt_id = ta.id
       WHERE ta.user_id = ?
       GROUP BY aa.section
       ORDER BY total DESC`
    ).bind(userId).all();

    // 6. Recent wrong answers (to find recurring mistakes)
    const recentWrong = await c.env.DB.prepare(
      `SELECT aa.section, aa.answer_data, aa.question_index, aa.submitted_at
       FROM attempt_answers aa
       JOIN test_attempts ta ON aa.attempt_id = ta.id
       WHERE ta.user_id = ? AND aa.is_correct = 0
       ORDER BY aa.submitted_at DESC
       LIMIT 30`
    ).bind(userId).all();

    // Analyze weakness patterns from wrong answers
    const weaknessBySection: Record<string, number> = {};
    for (const w of recentWrong.results) {
      const section = w.section as string;
      weaknessBySection[section] = (weaknessBySection[section] || 0) + 1;
    }

    // Sort sections by most errors
    const weaknesses = Object.entries(weaknessBySection)
      .sort(([, a], [, b]) => b - a)
      .map(([section, errorCount]) => {
        const sectionStat = sectionStats.results.find((s: any) => s.section === section);
        const total = (sectionStat as any)?.total || 0;
        const correct = (sectionStat as any)?.correct || 0;
        return {
          section,
          error_count: errorCount,
          total_practiced: total,
          accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
        };
      });

    // 6b. Bot activity: conversations, exercises, daily question logs
    let conversationCount = 0;
    let conversationDays: string[] = [];
    let botExerciseStats = { total: 0, completed: 0, avgScore: 0 };
    let dailyQuestionTotal = 0;
    try {
      const convResult = await c.env.DB.prepare(
        `SELECT COUNT(*) as msg_count FROM conversation_messages
         WHERE user_id = ? AND role = 'user'`
      ).bind(userId).first() as any;
      conversationCount = convResult?.msg_count || 0;

      const convDays = await c.env.DB.prepare(
        `SELECT DISTINCT date(created_at) as day FROM conversation_messages
         WHERE user_id = ? AND role = 'user'
         ORDER BY day DESC LIMIT 30`
      ).bind(userId).all();
      conversationDays = (convDays.results || []).map((d: any) => d.day as string);
    } catch {}

    // Exercise sessions via bot
    try {
      const exerciseResult = await c.env.DB.prepare(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
           AVG(CASE WHEN status = 'completed' AND score IS NOT NULL THEN score END) as avg_score
         FROM exercise_sessions WHERE user_id = ?`
      ).bind(userId).first() as any;
      botExerciseStats = {
        total: exerciseResult?.total || 0,
        completed: exerciseResult?.completed || 0,
        avgScore: Math.round(exerciseResult?.avg_score || 0),
      };
    } catch {}

    // Daily question log totals (tracks all bot + mini app questions)
    try {
      const dailyResult = await c.env.DB.prepare(
        `SELECT SUM(questions_answered) as total FROM daily_question_logs WHERE user_id = ?`
      ).bind(userId).first() as any;
      dailyQuestionTotal = dailyResult?.total || 0;
    } catch {}

    // 7. Study streak (consecutive days with activity — tests + conversations)
    const recentDays = await c.env.DB.prepare(
      `SELECT DISTINCT day FROM (
         SELECT date(submitted_at) as day FROM attempt_answers aa
         JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE ta.user_id = ?
         UNION
         SELECT date(created_at) as day FROM conversation_messages
         WHERE user_id = ? AND role = 'user'
       ) ORDER BY day DESC LIMIT 30`
    ).bind(userId, userId).all();

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const days = recentDays.results.map((d: any) => d.day as string);
    if (days.length > 0) {
      const checkDate = new Date();
      for (let i = 0; i < 30; i++) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (days.includes(dateStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (i === 0) {
          // Today might not have activity yet, check yesterday
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        } else {
          break;
        }
      }
    }

    // 8. Spaced repetition stats
    let srStats = { total: 0, due: 0, mastered: 0 };
    try {
      const { getReviewStats } = await import('../services/fsrs-engine');
      srStats = await getReviewStats(c.env, userId);
    } catch {}

    // 9. Average time per question by section
    const timeStats = await c.env.DB.prepare(
      `SELECT aa.section, AVG(aa.time_spent_seconds) as avg_time, COUNT(*) as count
       FROM attempt_answers aa
       JOIN test_attempts ta ON aa.attempt_id = ta.id
       WHERE ta.user_id = ? AND aa.time_spent_seconds > 0
       GROUP BY aa.section`
    ).bind(userId).all();

    // Include all activity in total count — daily_question_logs is the most comprehensive tracker
    const totalPracticed = Math.max(totalAnswers + conversationCount, dailyQuestionTotal);

    return c.json({
      target_test: user.target_test || 'TOEFL_IBT',
      total_tests: totalTests,
      total_questions_practiced: totalPracticed,
      correct_answers: correctAnswers,
      wrong_answers: wrongAnswers,
      overall_accuracy: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
      bot_practice: conversationCount,
      bot_exercises: botExerciseStats,
      daily_questions_total: dailyQuestionTotal,
      best_score: bestScore,
      average_score: avgScore,
      study_streak: streak,
      section_stats: sectionStats.results.map((s: any) => ({
        section: s.section,
        total: s.total,
        correct: s.correct,
        wrong: s.wrong,
        accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
      })),
      test_results: testResults.results.map((r: any) => {
        let sectionScores: Record<string, number> = {};
        try { sectionScores = JSON.parse(r.section_scores || '{}'); } catch {}
        return {
          attempt_id: r.attempt_id,
          total_score: r.total_score ?? 0,
          band_score: r.band_score ?? null,
          section_scores: sectionScores,
          test_type: r.test_type || null,
          date: r.created_at,
        };
      }),
      weaknesses,
      spaced_repetition: srStats,
      time_per_question: timeStats.results.map((t: any) => ({
        section: t.section,
        avg_seconds: Math.round(t.avg_time || 0),
        count: t.count,
      })),
    });
  } catch (e: any) {
    return c.json({ error: 'Failed to load progress data' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// Deep Student Analysis — individual student report + personalized recommendations
// ═══════════════════════════════════════════════════════
progressRoutes.get('/analysis', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user?.id) return c.json({ error: 'Unauthorized' }, 401);
  const userId = user.id;

  try {
    const { getStudentAnalytics } = await import('../services/analytics');
    const analytics = await getStudentAnalytics(c.env, userId);

    // Generate AI-powered personalized recommendations
    let aiRecommendations: any = null;
    try {
      // Build context for AI analysis
      const weakestSection = analytics.weakest_section;
      const accuracy = analytics.overall_accuracy;
      const diagnostic = analytics.diagnostic;
      const skills = analytics.skills;
      const totalQ = analytics.total_questions;

      if (totalQ >= 5 || diagnostic) {
        const prompt = `Analyze this student's TOEFL/IELTS preparation data and give 3 specific, actionable study recommendations in Indonesian. Be concise (max 3 lines each).

Student Profile:
- Target: ${user.target_test || 'TOEFL_IBT'}
- Level: ${user.proficiency_level}
- Total questions practiced: ${totalQ}
- Overall accuracy: ${accuracy}%
- Weakest section: ${weakestSection} (${analytics.weakest_accuracy}%)
- Study frequency: ${analytics.study_tendency.weekly_frequency} days/week
${diagnostic ? `- Diagnostic: Grammar ${diagnostic.grammar.score}/${diagnostic.grammar.total}, Vocab ${diagnostic.vocab.score}/${diagnostic.vocab.total}, Reading ${diagnostic.reading.score}/${diagnostic.reading.total}, Listening ${diagnostic.listening.score}/${diagnostic.listening.total}` : ''}
${skills.length > 0 ? `- Skills: ${skills.map((s: any) => `${s.skill}=${s.accuracy}%`).join(', ')}` : ''}

Return JSON: {"recommendations": [{"title": "...", "description": "...", "priority": "high|medium|low", "section": "reading|listening|writing|speaking|grammar|vocabulary"}], "next_focus": "...", "estimated_days_to_improve": N}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            response_format: { type: 'json_object' },
          }),
        });

        if (response.ok) {
          const data = await response.json() as any;
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            aiRecommendations = JSON.parse(content);
          }
        }
      }
    } catch (e) { console.error('AI recommendations error:', e); }

    // Get personalized practice materials based on weakness
    let recommendedMaterials: any[] = [];
    if (analytics.weakest_section) {
      const materials = await c.env.DB.prepare(
        `SELECT id, question_type, title, difficulty FROM test_contents
         WHERE section = ? AND test_type = ? AND status = 'published'
         AND id NOT IN (
           SELECT COALESCE(aa.content_id, 0) FROM attempt_answers aa
           JOIN test_attempts ta ON aa.attempt_id = ta.id
           WHERE ta.user_id = ?
         )
         ORDER BY difficulty ASC LIMIT 10`
      ).bind(analytics.weakest_section, user.target_test || 'TOEFL_IBT', userId).all();

      recommendedMaterials = (materials.results as any[]).map((m: any) => ({
        id: m.id,
        type: m.question_type,
        title: m.title,
        difficulty: m.difficulty,
      }));
    }

    return c.json({
      ...analytics,
      ai_recommendations: aiRecommendations,
      recommended_materials: recommendedMaterials,
      user: {
        name: user.name,
        target_test: user.target_test,
        proficiency_level: user.proficiency_level,
      },
    });
  } catch (e: any) {
    console.error('Analysis error:', e);
    return c.json({ error: 'Failed to load progress data' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// Admin: Student analysis for a specific student
// ═══════════════════════════════════════════════════════
progressRoutes.get('/analysis/:userId', async (c) => {
  const admin = await getAuthUser(c.req.raw, c.env);
  if (!admin || (admin.role !== 'admin' && admin.role !== 'teacher')) {
    return c.json({ error: 'Admin/teacher access required' }, 403);
  }

  const targetUserId = parseInt(c.req.param('userId'));
  const targetUser = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(targetUserId).first() as any;
  if (!targetUser) return c.json({ error: 'Student not found' }, 404);

  try {
    const { getStudentAnalytics } = await import('../services/analytics');
    const analytics = await getStudentAnalytics(c.env, targetUserId);

    // Get conversation summary for admin
    const recentChats = await c.env.DB.prepare(
      `SELECT role, content, created_at FROM conversation_messages
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`
    ).bind(targetUserId).all();

    // Get weakness summary
    const weakness = await c.env.DB.prepare(
      'SELECT * FROM skill_weakness_summary WHERE user_id = ?'
    ).bind(targetUserId).first();

    return c.json({
      ...analytics,
      student: {
        id: targetUser.id,
        name: targetUser.name,
        username: targetUser.username,
        target_test: targetUser.target_test,
        proficiency_level: targetUser.proficiency_level,
        is_premium: targetUser.is_premium,
        created_at: targetUser.created_at,
      },
      weakness_summary: weakness,
      recent_conversations: (recentChats.results as any[]).reverse().map((m: any) => ({
        role: m.role,
        content: (m.content as string).substring(0, 200),
        at: m.created_at,
      })),
    });
  } catch (e: any) {
    return c.json({ error: 'Failed to load progress data' }, 500);
  }
});

// Admin: API cost dashboard
progressRoutes.get('/costs', async (c) => {
  try {
    const today = await c.env.DB.prepare(
      "SELECT service, SUM(cost_usd) as cost, COUNT(*) as calls FROM api_usage WHERE created_at >= date('now') GROUP BY service"
    ).all();
    const month = await c.env.DB.prepare(
      "SELECT service, SUM(cost_usd) as cost, COUNT(*) as calls FROM api_usage WHERE created_at >= date('now', '-30 days') GROUP BY service"
    ).all();
    const total = await c.env.DB.prepare("SELECT SUM(cost_usd) as cost FROM api_usage").first() as any;
    return c.json({ today: today.results, month: month.results, all_time: total?.cost || 0 });
  } catch (e: any) {
    return c.json({ error: 'Failed to load progress data' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// Weekly Report Card Data — visual report card page
// ═══════════════════════════════════════════════════════
progressRoutes.get('/report-card', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user?.id) return c.json({ error: 'Unauthorized' }, 401);
  const userId = user.id;

  try {
    const { getOrCreateGamification } = await import('../services/commercial');

    // Get week parameter (YYYY-WW format) or default to current week
    const weekParam = c.req.query('week');
    let startDate: Date;
    let endDate: Date;

    if (weekParam && /^\d{4}-\d{2}$/.test(weekParam)) {
      // Parse ISO week format YYYY-WW
      const [year, week] = weekParam.split('-').map(Number);
      const jan4 = new Date(year, 0, 4);
      const dayOfWeek = jan4.getDay();
      const ISOWeek1Start = new Date(jan4);
      ISOWeek1Start.setDate(jan4.getDate() - dayOfWeek + 1);
      startDate = new Date(ISOWeek1Start);
      startDate.setDate(ISOWeek1Start.getDate() + (week - 1) * 7);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else {
      // Default: current week (Sunday to Saturday, or Monday to Sunday depending on locale)
      const today = new Date();
      const dayOfWeek = today.getDay();
      startDate = new Date(today);
      startDate.setDate(today.getDate() - dayOfWeek); // Start of week (Sunday)
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6); // End of week (Saturday)
    }

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    // Get week label
    const weekLabel = `${startDate.getDate()}-${endDate.getDate()} ${endDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;

    // Total questions answered this week
    const answers = await c.env.DB.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) as correct
       FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id=ta.id
       WHERE ta.user_id=? AND aa.submitted_at>=? AND aa.submitted_at<?`
    ).bind(userId, startDateStr, endDateStr).first() as any;

    // Tests completed this week
    const tests = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM test_attempts WHERE user_id=? AND status='completed' AND started_at>=? AND started_at<?"
    ).bind(userId, startDateStr, endDateStr).first() as any;

    // By section breakdown
    const bySection = await c.env.DB.prepare(
      `SELECT aa.section, COUNT(*) as total, SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) as correct
       FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id=ta.id
       WHERE ta.user_id=? AND aa.submitted_at>=? AND aa.submitted_at<?
       GROUP BY aa.section`
    ).bind(userId, startDateStr, endDateStr).all();

    // Gamification data
    const g = await getOrCreateGamification(c.env, userId);

    // Get previous week's data for improvement calculation
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - 7);
    const prevEndDate = new Date(endDate);
    prevEndDate.setDate(prevEndDate.getDate() - 7);
    const prevStartDateStr = prevStartDate.toISOString();
    const prevEndDateStr = prevEndDate.toISOString();

    const prevAnswers = await c.env.DB.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) as correct
       FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id=ta.id
       WHERE ta.user_id=? AND aa.submitted_at>=? AND aa.submitted_at<?`
    ).bind(userId, prevStartDateStr, prevEndDateStr).first() as any;

    // Calculate metrics
    const total = answers?.total || 0;
    const correct = answers?.correct || 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const testsCompleted = tests?.count || 0;

    const prevTotal = prevAnswers?.total || 0;
    const prevCorrect = prevAnswers?.correct || 0;
    const prevAccuracy = prevTotal > 0 ? Math.round((prevCorrect / prevTotal) * 100) : 0;
    const improvementAccuracy = prevTotal > 0 ? accuracy - prevAccuracy : null;

    // Study streak (from progress overview logic)
    const recentDays = await c.env.DB.prepare(
      `SELECT DISTINCT day FROM (
         SELECT date(submitted_at) as day FROM attempt_answers aa
         JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE ta.user_id = ?
         UNION
         SELECT date(created_at) as day FROM conversation_messages
         WHERE user_id = ? AND role = 'user'
       ) ORDER BY day DESC LIMIT 30`
    ).bind(userId, userId).all();

    let streak = 0;
    const days = recentDays.results.map((d: any) => d.day as string);
    if (days.length > 0) {
      const checkDate = new Date();
      for (let i = 0; i < 30; i++) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (days.includes(dateStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (i === 0) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        } else {
          break;
        }
      }
    }

    // Calculate study minutes (estimate: ~2 min per question)
    const studyMinutes = Math.round(total * 2);

    // Rank percentile (rough: users with higher accuracy rank higher)
    let rankPercentile = 50;
    try {
      const userRank = await c.env.DB.prepare(
        `SELECT COUNT(*) as count FROM user_gamification WHERE accuracy >= ?`
      ).bind(accuracy).first() as any;
      const totalUsers = await c.env.DB.prepare(
        `SELECT COUNT(*) as count FROM user_gamification`
      ).first() as any;
      if (totalUsers?.count > 0) {
        rankPercentile = Math.round((1 - (userRank?.count || 1) / (totalUsers?.count || 1)) * 100);
      }
    } catch {}

    // Section breakdown with colors
    const sectionBreakdown: Record<string, any> = {};
    for (const sec of bySection.results as any[]) {
      const secTotal = sec.total || 0;
      const secCorrect = sec.correct || 0;
      const secAccuracy = secTotal > 0 ? Math.round((secCorrect / secTotal) * 100) : 0;
      sectionBreakdown[sec.section] = {
        total: secTotal,
        correct: secCorrect,
        accuracy: secAccuracy,
      };
    }

    // Get badges earned
    const badges = JSON.parse(g.badges || '[]') as string[];

    const reportData = {
      user_name: user.name || 'Student',
      week_label: weekLabel,
      questions_answered: total,
      correct,
      accuracy,
      tests_completed: testsCompleted,
      streak_days: streak,
      xp: g.xp || 0,
      level: g.level || 1,
      badges: badges.slice(0, 5), // Top 5 badges
      by_section: sectionBreakdown,
      improvement: improvementAccuracy !== null ? (improvementAccuracy > 0 ? `+${improvementAccuracy}%` : `${improvementAccuracy}%`) : null,
      rank_percentile: rankPercentile,
      study_minutes: studyMinutes,
    };

    return c.json(reportData);
  } catch (e: any) {
    console.error('Report card error:', e);
    return c.json({ error: 'Failed to load report card data' }, 500);
  }
});
