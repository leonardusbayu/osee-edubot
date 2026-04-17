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
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const userId = user.id;

    const { test_type, section_only, question_type } = await c.req.json();
    const config = TEST_CONFIGS[test_type];
    if (!config) return c.json({ error: 'Unknown test type' }, 404);

    // Check quota for non-premium users
    {
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

    // Auto-complete any stale in_progress attempts for this user (older than 2 hours)
    try {
      await c.env.DB.prepare(
        `UPDATE test_attempts SET status = 'abandoned', finished_at = datetime('now')
         WHERE user_id = ? AND status = 'in_progress'
         AND started_at < datetime('now', '-2 hours')`
      ).bind(userId).run();
    } catch {}

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

testRoutes.get('/attempt/resume', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw, c.env);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    // Find most recent in_progress attempt less than 4 hours old
    const attempt = await c.env.DB.prepare(
      `SELECT ta.*, COUNT(aa.id) as answer_count
       FROM test_attempts ta
       LEFT JOIN attempt_answers aa ON aa.attempt_id = ta.id
       WHERE ta.user_id = ? AND ta.status = 'in_progress'
       AND ta.started_at > datetime('now', '-4 hours')
       GROUP BY ta.id
       ORDER BY ta.started_at DESC LIMIT 1`
    ).bind(user.id).first();

    if (!attempt) return c.json({ has_active: false });

    const config = TEST_CONFIGS[attempt.test_type as string];

    // Get the last answered question index per section
    const lastAnswers = await c.env.DB.prepare(
      `SELECT section, MAX(question_index) as last_index
       FROM attempt_answers WHERE attempt_id = ?
       GROUP BY section`
    ).bind(attempt.id).all();

    const sectionProgress: Record<string, number> = {};
    for (const row of lastAnswers.results || []) {
      sectionProgress[(row as any).section] = ((row as any).last_index || 0) + 1;
    }

    return c.json({
      has_active: true,
      attempt_id: attempt.id,
      test_type: attempt.test_type,
      sections: config?.sections || [],
      current_section: attempt.current_section,
      current_question_index: attempt.current_question_index,
      answers_submitted: attempt.answer_count || 0,
      section_progress: sectionProgress,
      started_at: attempt.started_at,
      metadata: attempt.metadata ? JSON.parse(attempt.metadata as string) : null,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
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
  try {
    const attemptId = parseInt(c.req.param('id'));
    const attempt = await c.env.DB.prepare(
      'SELECT * FROM test_attempts WHERE id = ?'
    ).bind(attemptId).first();

    if (!attempt) return c.json({ error: 'Not found' }, 404);

    const { section, question_index, content_id, answer_data, time_spent_seconds = 0 } = await c.req.json();

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
    if (answer_data?.selected && answer_data?.correct_answer) {
      isCorrect = answer_data.selected.toLowerCase() === answer_data.correct_answer.toLowerCase();
    }

    if (existing) {
      await c.env.DB.prepare(
        'UPDATE attempt_answers SET answer_data = ?, is_correct = ?, submitted_at = ?, time_spent_seconds = ?, content_id = ? WHERE id = ?'
      ).bind(JSON.stringify(answer_data), isCorrect !== null ? (isCorrect ? 1 : 0) : null, new Date().toISOString(), time_spent_seconds, content_id || null, existing.id).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO attempt_answers (attempt_id, section, question_index, content_id, answer_data, is_correct, score, time_spent_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        attemptId, section, question_index, content_id || null, JSON.stringify(answer_data),
        isCorrect !== null ? (isCorrect ? 1 : 0) : null,
        isCorrect !== null ? (isCorrect ? 1.0 : 0.0) : null,
        time_spent_seconds,
      ).run();
    }

    // Update position
    await c.env.DB.prepare(
      'UPDATE test_attempts SET current_question_index = ? WHERE id = ?'
    ).bind(question_index + 1, attemptId).run();

    // Analytics: track progress, skills, and streak only for new answers
    if (!existing) {
      try {
        const { incrementDailyStudyLog, trackSkillProgress, updateStreak } = await import('../services/analytics');
        await incrementDailyStudyLog(c.env, userId, 1, time_spent_seconds, isCorrect === true ? 1 : 0, 0, 0);
        await updateStreak(c.env, userId);

        // Track sub-skill progress
        const skillMap: Record<string, string> = {
          reading: 'reading_strategy',
          listening: 'listening_strategy',
          speaking: 'speaking_templates',
          writing: 'writing_templates',
          structure: 'grammar_structure',
        };
        const skill = skillMap[section] || section;
        await trackSkillProgress(c.env, userId, skill, attempt.test_type as string, 1, isCorrect === true ? 1 : 0, time_spent_seconds);
      } catch (e) { console.error('Analytics tracking error:', e); }

      // Gamification: award XP
      try {
        const { addXP, incrementDailyUsage } = await import('../services/commercial');
        await addXP(c.env, userId, isCorrect ? 15 : 10, isCorrect ? 'correct_answer' : 'answer');
        await incrementDailyUsage(c.env, userId);
      } catch (e) { console.error('XP tracking error:', e); }

      // Spaced repetition: schedule every scored answer (not just wrong).
      // Correct answers still decay — FSRS picks longer initial interval.
      // Dedup inside addToReview ensures re-answers update the existing card
      // via markReviewed() rather than creating parallel cards.
      if (isCorrect !== null) {
        try {
          const { addToReview } = await import('../services/fsrs-engine');
          await addToReview(
            c.env, userId, section, '',
            JSON.stringify(answer_data), answer_data.correct_answer || '', answer_data.selected || '',
            content_id || undefined,
            isCorrect === true,
          );
        } catch (e) { console.error('Spaced repetition error:', e); }
      }

      // Update skill score for this section
      if (isCorrect !== null) {
        try {
          const { updateSkillScore } = await import('../services/prerequisites');
          const sectionSkills: Record<string, string> = {
            reading: 'reading_strategy',
            listening: 'listening_strategy',
            speaking: 'speaking_templates',
            writing: 'writing_templates',
          };
          await updateSkillScore(c.env, userId, sectionSkills[section] || section, isCorrect);
        } catch (e) { console.error('Skill update error:', e); }
      }
    }

    return c.json({ saved: true, is_correct: isCorrect, next_question_index: question_index + 1 });
  } catch (e: any) {
    console.error('Answer submission error:', e);
    return c.json({ error: 'Failed to save answer: ' + (e.message || 'unknown error') }, 500);
  }
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
  try {
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
      const sectionAnswers = (answers.results || []).filter((a: any) => a.section === section.id);
      // Only count objectively scored answers (is_correct not null) for band calculation
      const scoredAnswers = sectionAnswers.filter((a: any) => a.is_correct !== null);
      const correct = scoredAnswers.filter((a: any) => a.is_correct === 1).length;
      const total = scoredAnswers.length;
      const maxBand = config?.max_band || 6;
      if (total === 0) {
        sectionScores[section.id] = 0;
      } else {
        sectionScores[section.id] = Math.round((correct / total) * maxBand * 2) / 2;
      }
    }

    const values = Object.values(sectionScores).filter((v: number) => !isNaN(v));
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
  } catch (e: any) {
    console.error('finish error:', e);
    return c.json({ error: 'Failed to finish test: ' + e.message }, 500);
  }
});

// --- Serve questions from D1 ---

testRoutes.get('/questions/:section', async (c) => {
  try {
    const section = c.req.param('section');
    const testType = c.req.query('test_type') || 'TOEFL_IBT';
    const questionType = c.req.query('question_type');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const offset = parseInt(c.req.query('offset') || '0');

    // Try to get authenticated user for smart sequencing
    let userId: number | null = null;
    try {
      const { getAuthUser } = await import('../services/auth');
      const user = await getAuthUser(c.req.raw, c.env).catch(() => null);
      userId = user?.id || null;
    } catch {}

    let query = `SELECT id, question_type, title, content, media_url, difficulty
                 FROM test_contents
                 WHERE test_type = ? AND section = ? AND status = 'published'`;
    const params: any[] = [testType, section];

    if (questionType) {
      query += ' AND question_type = ?';
      params.push(questionType);
    }

    // When no question_type filter (random mix), use RANDOM() for variety
    // Otherwise order by difficulty for progressive learning within a type
    if (questionType) {
      query += ' ORDER BY difficulty ASC LIMIT ? OFFSET ?';
    } else {
      query += ' ORDER BY RANDOM() LIMIT ? OFFSET ?';
    }
    params.push(limit, offset);

    const stmt = c.env.DB.prepare(query);
    const result = await stmt.bind(...params).all();

    // Apply smart sequencing if user is authenticated and no specific question_type filter
    let questions = result.results;
    if (userId && !questionType && !offset) {
      try {
        const { reorderQuestionsSmart } = await import('../services/smart-sequencing');
        const reordered = await reorderQuestionsSmart(c.env, userId, questions, testType, section);
        questions = reordered;
      } catch (e) {
        console.error('Smart sequencing error:', e);
        // Fall back to unordered results
      }
    }

    // Shape + filter: drop questions whose payload is too empty to render
    // (e.g. legacy TOEFL_ITP error_identification rows imported with blank
    // question_text and no options — frontend would show "Q1/10" with an
    // empty card and no way to answer). Keep the filter narrow: only skip
    // rows where BOTH the top-level and every sub-question are blank.
    const shaped = questions.map((r: any) => {
      let content: any = {};
      try { content = JSON.parse(r.content || '{}'); } catch {}
      const mediaUrl = r.media_url;
      const isValidUrl = mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://'));
      return {
        id: r.id,
        question_type: r.question_type,
        title: r.title,
        content,
        media_url: isValidUrl ? mediaUrl : null,
        difficulty: r.difficulty,
      };
    }).filter((q: any) => {
      const c = q.content || {};
      const topText = String(c.question_text || c.passage_text || c.passage || '').trim();
      const topOpts = Array.isArray(c.options) ? c.options.length : 0;
      if (topText || topOpts > 0) return true;
      const subs = Array.isArray(c.questions) ? c.questions : [];
      return subs.some((sq: any) => {
        const t = String(sq?.question_text || '').trim();
        const o = Array.isArray(sq?.options) ? sq.options.length : 0;
        return t.length > 0 || o > 0;
      });
    });

    return c.json({
      section,
      test_type: testType,
      total: shaped.length,
      questions: shaped,
    });
  } catch (e: any) {
    console.error('questions error:', e);
    return c.json({ error: 'Failed to load questions: ' + e.message }, 500);
  }
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
    'SELECT aa.*, tc.content, tc.question_type, tc.section AS tc_section FROM attempt_answers aa LEFT JOIN test_contents tc ON aa.content_id = tc.id WHERE aa.attempt_id = ? ORDER BY aa.section, aa.question_index'
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
      options: (content.options || content.grouped_reading?.questions?.[0]?.options || []),
      correct_answer: content.answers?.[0] || '',
    };
  });

  return c.json({ attempt_id: attemptId, review });
});

// Fetch all questions for a test attempt at once (offline-first mode)
testRoutes.get('/attempt/:id/questions-batch', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const attemptId = parseInt(c.req.param('id'));

  const attempt = await c.env.DB.prepare(
    'SELECT * FROM test_attempts WHERE id = ? AND user_id = ?'
  ).bind(attemptId, user.id).first();

  if (!attempt) return c.json({ error: 'Not found' }, 404);
  if (attempt.status !== 'in_progress') {
    return c.json({ error: 'Attempt is not in progress' }, 400);
  }

  const config = TEST_CONFIGS[attempt.test_type as string];
  if (!config) return c.json({ error: 'Unknown test type' }, 404);

  // Determine which sections to load
  let sections = config.sections;
  const metadata = attempt.metadata ? JSON.parse(attempt.metadata as string) : {};
  if (metadata.section_only) {
    const sectionConfig = config.sections.find((s: any) => s.id === metadata.section_only);
    if (sectionConfig) sections = [sectionConfig];
  }

  const allQuestions: Record<string, any[]> = {};

  // Load questions for each section
  for (const section of sections) {
    const result = await c.env.DB.prepare(
      `SELECT id, question_type, title, content, media_url, difficulty
       FROM test_contents
       WHERE test_type = ? AND section = ? AND status = 'published'
       ORDER BY RANDOM() LIMIT 50`
    ).bind(attempt.test_type, section.id).all();

    allQuestions[section.id] = (result.results || []).map((r: any) => {
      let content: any = {};
      try { content = JSON.parse(r.content || '{}'); } catch {}
      const mediaUrl = r.media_url;
      const isValidUrl = mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://'));
      return {
        id: r.id,
        question_type: r.question_type,
        title: r.title,
        content,
        media_url: isValidUrl ? mediaUrl : null,
        difficulty: r.difficulty,
      };
    }).filter((q: any) => {
      // Mirror the /questions/:section filter: drop rows that would render
      // as empty Q-cards (no question_text, no passage, no options, and no
      // sub-questions with any of those).
      const c = q.content || {};
      const topText = String(c.question_text || c.passage_text || c.passage || '').trim();
      const topOpts = Array.isArray(c.options) ? c.options.length : 0;
      if (topText || topOpts > 0) return true;
      const subs = Array.isArray(c.questions) ? c.questions : [];
      return subs.some((sq: any) => {
        const t = String(sq?.question_text || '').trim();
        const o = Array.isArray(sq?.options) ? sq.options.length : 0;
        return t.length > 0 || o > 0;
      });
    });
  }

  return c.json({
    attempt_id: attemptId,
    test_type: attempt.test_type,
    sections: sections.map((s: any) => ({
      id: s.id,
      name: s.name,
      duration_minutes: s.duration_minutes,
      question_count: (allQuestions[s.id] || []).length,
    })),
    questions_by_section: allQuestions,
  });
});
