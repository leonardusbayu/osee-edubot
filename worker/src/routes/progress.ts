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

    // 7. Study streak (consecutive days with activity)
    const recentDays = await c.env.DB.prepare(
      `SELECT DISTINCT date(submitted_at) as day
       FROM attempt_answers aa
       JOIN test_attempts ta ON aa.attempt_id = ta.id
       WHERE ta.user_id = ?
       ORDER BY day DESC
       LIMIT 30`
    ).bind(userId).all();

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
      const { getReviewStats } = await import('../services/spaced-repetition');
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

    return c.json({
      total_tests: totalTests,
      total_questions_practiced: totalAnswers,
      correct_answers: correctAnswers,
      wrong_answers: wrongAnswers,
      overall_accuracy: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
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
    return c.json({ error: e.message }, 500);
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
    return c.json({ error: e.message }, 500);
  }
});
