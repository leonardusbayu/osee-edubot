import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';

// Test configs — both TOEFL iBT and IELTS
const TEST_CONFIGS: Record<string, any> = {
  TOEFL_IBT: {
    test_type: 'TOEFL_IBT',
    display_name: 'TOEFL iBT Practice Test (2026 Format)',
    description: 'Full-length TOEFL iBT practice with adaptive sections and CEFR band scoring (1-6).',
    total_duration_minutes: 90,
    max_band: 6,
    sections: [
      { id: 'reading', name: 'Reading', duration_minutes: 30 },
      { id: 'listening', name: 'Listening', duration_minutes: 29 },
      { id: 'speaking', name: 'Speaking', duration_minutes: 8 },
      { id: 'writing', name: 'Writing', duration_minutes: 23 },
    ],
  },
  IELTS: {
    test_type: 'IELTS',
    display_name: 'IELTS Academic Practice Test',
    description: 'Full-length IELTS Academic practice test. Band 1-9 scoring.',
    total_duration_minutes: 170,
    max_band: 9,
    sections: [
      { id: 'listening', name: 'Listening', duration_minutes: 30 },
      { id: 'reading', name: 'Reading', duration_minutes: 60 },
      { id: 'writing', name: 'Writing', duration_minutes: 60 },
      { id: 'speaking', name: 'Speaking', duration_minutes: 14 },
    ],
  },
  TOEFL_ITP: {
    test_type: 'TOEFL_ITP',
    display_name: 'TOEFL ITP Practice Test',
    description: 'Full TOEFL ITP — Listening, Structure, Reading. Score 310-677.',
    total_duration_minutes: 115,
    max_band: 677,
    sections: [
      { id: 'listening', name: 'Listening', duration_minutes: 35 },
      { id: 'structure', name: 'Structure & Written Expression', duration_minutes: 25 },
      { id: 'reading', name: 'Reading', duration_minutes: 55 },
    ],
  },
  TOEIC: {
    test_type: 'TOEIC',
    display_name: 'TOEIC Listening & Reading Test',
    description: 'Full TOEIC practice — 200 multiple choice questions. Score 10-990.',
    total_duration_minutes: 120,
    max_band: 990,
    sections: [
      { id: 'listening', name: 'Listening', duration_minutes: 45 },
      { id: 'reading', name: 'Reading', duration_minutes: 75 },
    ],
  },
};

export const testRoutes = new Hono<{ Bindings: Env }>();

testRoutes.get('/available', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env).catch(() => null);
  let quotaInfo = null;

  if (user?.id) {
    const { checkTestAccess } = await import('../services/premium');
    quotaInfo = await checkTestAccess(c.env, user.id);
  }

  const tests = Object.values(TEST_CONFIGS).map((config) => ({
    test_type: config.test_type,
    display_name: config.display_name,
    description: config.description,
    total_duration_minutes: config.total_duration_minutes,
    sections: config.sections,
  }));

  return c.json({
    tests,
    quota: quotaInfo ? {
      allowed: quotaInfo.allowed,
      is_premium: quotaInfo.is_premium,
      daily_limit: quotaInfo.daily_limit,
      used_today: quotaInfo.used_today,
      bonus_quota: quotaInfo.bonus_quota,
      remaining: quotaInfo.remaining,
      reset_at: quotaInfo.reset_at,
    } : null,
  });
});

testRoutes.post('/start', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw, c.env);
    const userId = user?.id || 1;

    const { test_type, section_only, question_type } = await c.req.json();
    const config = TEST_CONFIGS[test_type];
    if (!config) return c.json({ error: 'Unknown test type' }, 404);

    // Check quota for non-premium users
    if (user?.id) {
      const { checkTestAccess } = await import('../services/premium');
      const access = await checkTestAccess(c.env, user.id);
      if (!access.allowed) {
        return c.json({
          error: 'Daily limit reached',
          code: 'LIMIT_REACHED',
          quota: {
            daily_limit: access.daily_limit,
            used_today: access.used_today,
            bonus_quota: access.bonus_quota,
            remaining: 0,
            reset_at: access.reset_at,
            upgrade_url: 'https://t.me/OSEE_TOEFL_IELTS_TOEIC_study_bot?start=premium',
          },
        }, 403);
      }
    }

    // Determine sections to include
    let sections = config.sections;
    if (section_only) {
      const sectionConfig = config.sections.find((s: any) => s.id === section_only);
      if (!sectionConfig) return c.json({ error: 'Unknown section' }, 404);
      sections = [sectionConfig];
    }

    const firstSection = sections[0].id;
    const now = new Date().toISOString();

    // Calculate duration
    const totalDuration = sections.reduce((sum: number, s: any) => sum + s.duration_minutes, 0);

    const result = await c.env.DB.prepare(
      `INSERT INTO test_attempts (user_id, test_type, status, current_section, current_question_index, section_start_times, started_at, metadata)
       VALUES (?, ?, 'in_progress', ?, 0, ?, ?, ?)`
    ).bind(
      userId, test_type, firstSection,
      JSON.stringify({ [firstSection]: now }), now,
      JSON.stringify({ section_only: section_only || null, question_type: question_type || null }),
    ).run();

    const attemptId = result.meta.last_row_id;

    return c.json({
      attempt_id: attemptId,
      test_type,
      sections,
      current_section: firstSection,
      total_duration_minutes: totalDuration,
      section_only: section_only || null,
      question_type: question_type || null,
    });
  } catch (e: any) {
    return c.json({ error: e.message || 'Failed to start test' }, 500);
  }
});

testRoutes.get('/attempt/:id', async (c) => {
  const attemptId = parseInt(c.req.param('id'));
  const attempt = await c.env.DB.prepare(
    'SELECT * FROM test_attempts WHERE id = ?'
  ).bind(attemptId).first();

  if (!attempt) return c.json({ error: 'Not found' }, 404);

  const config = TEST_CONFIGS[attempt.test_type as string];
  const answerCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM attempt_answers WHERE attempt_id = ?'
  ).bind(attemptId).first();

  // Calculate time remaining
  let timeRemaining: number | null = null;
  if (attempt.current_section) {
    const sectionConfig = config?.sections.find((s: any) => s.id === attempt.current_section);
    const startTimes = JSON.parse((attempt.section_start_times as string) || '{}');
    const startStr = startTimes[attempt.current_section as string];
    if (sectionConfig && startStr) {
      const elapsed = (Date.now() - new Date(startStr).getTime()) / 1000;
      timeRemaining = Math.max(0, sectionConfig.duration_minutes * 60 - elapsed);
    }
  }

  return c.json({
    attempt_id: attempt.id,
    test_type: attempt.test_type,
    status: attempt.status,
    current_section: attempt.current_section,
    current_question_index: attempt.current_question_index,
    sections: config?.sections || [],
    answers_submitted: (answerCount as any)?.count || 0,
    time_remaining_seconds: timeRemaining !== null ? Math.round(timeRemaining) : null,
  });
});

testRoutes.post('/attempt/:id/answer', async (c) => {
  const attemptId = parseInt(c.req.param('id'));
  const attempt = await c.env.DB.prepare(
    'SELECT * FROM test_attempts WHERE id = ?'
  ).bind(attemptId).first();

  if (!attempt) return c.json({ error: 'Not found' }, 404);

  const { section, question_index, answer_data } = await c.req.json();

  // Check if answer exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM attempt_answers WHERE attempt_id = ? AND section = ? AND question_index = ?'
  ).bind(attemptId, section, question_index).first();

  // Track quota for new answers (not updates)
  const userId = (attempt.user_id as number) || 1;
  if (!existing && userId > 1) {
    const { trackQuestionAnswer } = await import('../services/premium');
    const trackResult = await trackQuestionAnswer(c.env, userId);
    if (!trackResult.success) {
      return c.json({
        error: trackResult.error,
        code: 'LIMIT_REACHED',
        remaining: 0,
      }, 403);
    }
  }

  let isCorrect: boolean | null = null;

  // Score objective questions
  if (answer_data.selected && answer_data.correct_answer) {
    isCorrect = answer_data.selected.toLowerCase() === answer_data.correct_answer.toLowerCase();
  }

  if (existing) {
    await c.env.DB.prepare(
      'UPDATE attempt_answers SET answer_data = ?, is_correct = ?, submitted_at = ? WHERE id = ?'
    ).bind(JSON.stringify(answer_data), isCorrect !== null ? (isCorrect ? 1 : 0) : null, new Date().toISOString(), existing.id).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO attempt_answers (attempt_id, section, question_index, answer_data, is_correct, score)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      attemptId, section, question_index, JSON.stringify(answer_data),
      isCorrect !== null ? (isCorrect ? 1 : 0) : null,
      isCorrect !== null ? (isCorrect ? 1.0 : 0.0) : null,
    ).run();
  }

  // Update position
  await c.env.DB.prepare(
    'UPDATE test_attempts SET current_question_index = ? WHERE id = ?'
  ).bind(question_index + 1, attemptId).run();

  // Gamification: award XP
  try {
    const { addXP, incrementDailyUsage } = await import('../services/commercial');
    await addXP(c.env, userId, isCorrect ? 15 : 10, isCorrect ? 'correct_answer' : 'answer');
    await incrementDailyUsage(c.env, userId);
  } catch {}

  if (isCorrect === false) {
    try {
      const { addToReview } = await import('../services/spaced-repetition');
      await addToReview(
        c.env, userId, section, '',
        JSON.stringify(answer_data), answer_data.correct_answer || '', answer_data.selected || '',
      );
    } catch {}
  }

  // Update skill score for this section
  if (isCorrect !== null) {
    try {
      const { updateSkillScore } = await import('../services/prerequisites');
      // Map section to skill
      const sectionSkills: Record<string, string> = {
        reading: 'reading_strategy',
        listening: 'listening_strategy',
        speaking: 'speaking_templates',
        writing: 'writing_templates',
      };
      await updateSkillScore(c.env, userId, sectionSkills[section] || section, isCorrect);
    } catch {}
  }

  return c.json({ saved: true, is_correct: isCorrect, next_question_index: question_index + 1 });
});

testRoutes.post('/attempt/:id/section/:nextSection', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const attemptId = parseInt(c.req.param('id'));
  const nextSection = c.req.param('nextSection');

  const attempt = await c.env.DB.prepare(
    'SELECT * FROM test_attempts WHERE id = ? AND user_id = ?'
  ).bind(attemptId, user.id).first();

  if (!attempt) return c.json({ error: 'Not found' }, 404);

  const startTimes = JSON.parse((attempt.section_start_times as string) || '{}');
  startTimes[nextSection] = new Date().toISOString();

  await c.env.DB.prepare(
    'UPDATE test_attempts SET current_section = ?, current_question_index = 0, section_start_times = ? WHERE id = ?'
  ).bind(nextSection, JSON.stringify(startTimes), attemptId).run();

  return c.json({ status: 'ok', current_section: nextSection });
});

testRoutes.post('/attempt/:id/finish', async (c) => {
  const attemptId = parseInt(c.req.param('id'));
  const attempt = await c.env.DB.prepare(
    'SELECT * FROM test_attempts WHERE id = ?'
  ).bind(attemptId).first();

  if (!attempt) return c.json({ error: 'Not found' }, 404);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'UPDATE test_attempts SET status = ?, finished_at = ? WHERE id = ?'
  ).bind('completed', now, attemptId).run();

  const config = TEST_CONFIGS[attempt.test_type as string];

  // Load answers and calculate scores
  const answers = await c.env.DB.prepare(
    'SELECT * FROM attempt_answers WHERE attempt_id = ?'
  ).bind(attemptId).all();

  const sectionScores: Record<string, number> = {};

  for (const section of config?.sections || []) {
    const sectionAnswers = answers.results.filter((a: any) => a.section === section.id);
    const correct = sectionAnswers.filter((a: any) => a.is_correct === 1).length;
    const total = sectionAnswers.length || 1;
    const maxBand = config?.max_band || 6;
    sectionScores[section.id] = Math.round((correct / total) * maxBand * 2) / 2; // 0.5 increments
  }

  const values = Object.values(sectionScores);
  const totalScore = values.length > 0
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
    : 0;

  await c.env.DB.prepare(
    `INSERT INTO test_results (attempt_id, user_id, test_type, total_score, section_scores, band_score)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(attemptId, attempt.user_id || 0, attempt.test_type, totalScore, JSON.stringify(sectionScores), totalScore).run();

  return c.json({
    attempt_id: attemptId,
    test_type: attempt.test_type,
    total_score: totalScore,
    band_score: totalScore,
    section_scores: sectionScores,
    ai_summary: null,
    detailed_feedback: null,
    completed_at: now,
  });
});

// --- Serve questions from D1 ---

testRoutes.get('/questions/:section', async (c) => {
  const section = c.req.param('section');
  const testType = c.req.query('test_type') || 'TOEFL_IBT';
  const questionType = c.req.query('question_type');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  // Adaptive difficulty: check student's skill level for this section
  const user = await getAuthUser(c.req.raw, c.env);
  let targetDifficulty = 3; // default medium
  if (user?.id) {
    try {
      const skill = await c.env.DB.prepare(
        'SELECT score FROM student_skills WHERE user_id = ? AND skill = ?'
      ).bind(user.id, section === 'reading' ? 'reading_strategy' : section === 'listening' ? 'listening_strategy' : section + '_templates').first() as any;
      if (skill) {
        // Map 0-100 score to difficulty 1-5
        if (skill.score >= 80) targetDifficulty = 5;
        else if (skill.score >= 60) targetDifficulty = 4;
        else if (skill.score >= 40) targetDifficulty = 3;
        else if (skill.score >= 20) targetDifficulty = 2;
        else targetDifficulty = 1;
      }
    } catch {}
  }

  let query = `SELECT id, question_type, title, content, media_url, difficulty
               FROM test_contents
               WHERE test_type = ? AND section = ? AND status = 'published'`;
  const params: any[] = [testType, section];

  if (questionType) {
    query += ' AND question_type = ?';
    params.push(questionType);
  }

  // Adaptive: prefer questions near target difficulty, but include some variety
  query += ' ORDER BY ABS(difficulty - ?) ASC, RANDOM() LIMIT ? OFFSET ?';
  params.push(targetDifficulty, limit, offset);

  const stmt = c.env.DB.prepare(query);
  const result = await stmt.bind(...params).all();

  return c.json({
    section,
    test_type: testType,
    total: result.results.length,
    questions: result.results.map((r: any) => ({
      id: r.id,
      question_type: r.question_type,
      title: r.title,
      content: JSON.parse(r.content || '{}'),
      media_url: r.media_url,
      difficulty: r.difficulty,
    })),
  });
});

// Get question count per section
testRoutes.get('/question-counts', async (c) => {
  const testType = c.req.query('test_type') || 'TOEFL_IBT';
  const result = await c.env.DB.prepare(
    `SELECT section, question_type, COUNT(*) as count
     FROM test_contents
     WHERE test_type = ? AND status = 'published'
     GROUP BY section, question_type
     ORDER BY section, question_type`
  ).bind(testType).all();

  return c.json(result.results);
});

testRoutes.get('/results/:id', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const attemptId = parseInt(c.req.param('id'));

  const attempt = await c.env.DB.prepare(
    'SELECT * FROM test_attempts WHERE id = ? AND user_id = ?'
  ).bind(attemptId, user.id).first();

  if (!attempt) return c.json({ error: 'Not found' }, 404);

  const result = await c.env.DB.prepare(
    'SELECT * FROM test_results WHERE attempt_id = ?'
  ).bind(attemptId).first();

  if (!result) return c.json({ error: 'Results not found' }, 404);

  return c.json({
    attempt_id: attemptId,
    test_type: attempt.test_type,
    total_score: result.total_score,
    band_score: result.band_score,
    section_scores: JSON.parse(result.section_scores as string),
    ai_summary: result.ai_summary,
    detailed_feedback: result.detailed_feedback ? JSON.parse(result.detailed_feedback as string) : null,
    completed_at: attempt.finished_at,
  });
});

// Get detailed review of all answers with explanations
testRoutes.get('/attempt/:id/review', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const attemptId = parseInt(c.req.param('id'));

  const attempt = await c.env.DB.prepare(
    'SELECT * FROM test_attempts WHERE id = ? AND user_id = ?'
  ).bind(attemptId, user.id).first();

  if (!attempt) return c.json({ error: 'Not found' }, 404);

  const answers = await c.env.DB.prepare(
    'SELECT aa.*, tc.content, tc.question_type, tc.section FROM attempt_answers aa LEFT JOIN test_contents tc ON aa.question_id = tc.id WHERE aa.attempt_id = ? ORDER BY aa.section, aa.question_index'
  ).bind(attemptId).all();

  const review = answers.results.map((a: any) => {
    let content: any = {};
    try { content = JSON.parse(a.content || '{}'); } catch {}
    return {
      section: a.section,
      question_index: a.question_index,
      question_type: a.question_type,
      answer_data: a.answer_data,
      is_correct: a.is_correct,
      score: a.score,
      explanation: content.explanation || content.grouped_reading?.explanation || '',
      question_text: content.question_text || content.passage_text || '',
      passage: content.passage || content.grouped_reading?.passage || '',
      options: content.options || content.grouped_reading?.questions?.[0]?.options || [],
      correct_answer: content.answers?.[0] || '',
    };
  });

  return c.json({ attempt_id: attemptId, review });
});
