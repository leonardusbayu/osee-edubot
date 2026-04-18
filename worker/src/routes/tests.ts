import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';
import { updateStudentAbility, getStudentIRTProfile, type IRTResponse } from '../services/irt-engine';
import { recordLearningPoint, fitAndSaveLearningCurve, updateForgettingCurve } from '../services/learning-curve';
import { selectUnderExposedQuestions, recordExposures } from '../services/question-exposure';

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

    const { test_type, section_only, question_type, mock_mode, drill_concept, drill_count } = await c.req.json();
    const config = TEST_CONFIGS[test_type];
    if (!config) return c.json({ error: 'Unknown test type' }, 404);

    // Drill mode: if a drill_concept was provided but no section_only was
    // specified, infer the section from the concept's first matching question.
    // Keeps the bot's `/warmup` → mini-app flow frictionless: we don't make
    // the bot pick a section, we just resolve it here.
    let resolvedSectionOnly: string | null = section_only || null;
    if (drill_concept && !resolvedSectionOnly) {
      try {
        const like = `%"${String(drill_concept).replace(/"/g, '')}"%`;
        const row = await c.env.DB.prepare(
          `SELECT section FROM test_contents
           WHERE test_type = ? AND status = 'published' AND skill_tags LIKE ?
           LIMIT 1`
        ).bind(test_type, like).first() as any;
        if (row?.section) resolvedSectionOnly = row.section as string;
      } catch { /* best-effort — fall through to full test if lookup fails */ }
    }

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
    if (resolvedSectionOnly) {
      const sectionConfig = config.sections.find((s: any) => s.id === resolvedSectionOnly);
      if (!sectionConfig) return c.json({ error: 'Unknown section' }, 404);
      sections = [sectionConfig];
    }

    const firstSection = sections[0].id;
    const nowDate = new Date();
    const now = nowDate.toISOString();

    // Calculate duration
    const totalDuration = sections.reduce((sum: number, s: any) => sum + s.duration_minutes, 0);

    // Mock mode: compute a hard deadline. Give a small grace buffer (30s) to account for network latency.
    const GRACE_SECONDS = 30;
    const deadlineAt = mock_mode
      ? new Date(nowDate.getTime() + (totalDuration * 60 + GRACE_SECONDS) * 1000).toISOString()
      : null;

    const metadata = {
      section_only: resolvedSectionOnly || null,
      question_type: question_type || null,
      mock_mode: !!mock_mode,
      deadline_at: deadlineAt,
      total_duration_minutes: totalDuration,
      drill_concept: drill_concept || null,
      drill_count: drill_count ? Math.max(1, Math.min(10, Number(drill_count))) : null,
    };

    const result = await c.env.DB.prepare(
      `INSERT INTO test_attempts (user_id, test_type, status, current_section, current_question_index, section_start_times, started_at, metadata)
       VALUES (?, ?, 'in_progress', ?, 0, ?, ?, ?)`
    ).bind(
      userId, test_type, firstSection,
      JSON.stringify({ [firstSection]: now }), now,
      JSON.stringify(metadata),
    ).run();

    const attemptId = result.meta.last_row_id;

    return c.json({
      attempt_id: attemptId,
      test_type,
      sections,
      current_section: firstSection,
      total_duration_minutes: totalDuration,
      section_only: resolvedSectionOnly || null,
      question_type: question_type || null,
      mock_mode: !!mock_mode,
      deadline_at: deadlineAt,
      drill_concept: drill_concept || null,
      drill_count: metadata.drill_count,
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
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const attemptId = parseInt(c.req.param('id'));
  if (isNaN(attemptId)) return c.json({ error: 'Invalid attempt ID' }, 400);
  const attempt = await c.env.DB.prepare(
    'SELECT * FROM test_attempts WHERE id = ? AND user_id = ?'
  ).bind(attemptId, user.id).first();

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
    const user = await getAuthUser(c.req.raw, c.env);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const attemptId = parseInt(c.req.param('id'));
    if (isNaN(attemptId)) return c.json({ error: 'Invalid attempt ID' }, 400);
    const attempt = await c.env.DB.prepare(
      'SELECT * FROM test_attempts WHERE id = ? AND user_id = ?'
    ).bind(attemptId, user.id).first();

    if (!attempt) return c.json({ error: 'Not found' }, 404);

    // Mock-mode deadline enforcement — reject late answers server-side
    try {
      const meta = attempt.metadata ? JSON.parse(attempt.metadata as string) : {};
      if (meta?.mock_mode && meta?.deadline_at) {
        const deadline = new Date(meta.deadline_at).getTime();
        if (Number.isFinite(deadline) && Date.now() > deadline) {
          // Auto-finish the attempt
          await c.env.DB.prepare(
            "UPDATE test_attempts SET status = 'time_expired', finished_at = datetime('now') WHERE id = ? AND status = 'in_progress'"
          ).bind(attemptId).run();
          return c.json({
            error: 'Time is up',
            code: 'TIME_EXPIRED',
            deadline_at: meta.deadline_at,
            message: 'Waktu tes habis. Tes otomatis diselesaikan.',
          }, 403);
        }
      }
    } catch {}

    const body = await c.req.json();
    const { section, question_index, content_id, answer_data, time_spent_seconds = 0, client_uuid } = body;

    // Input validation — reject malformed payloads before hitting DB
    if (typeof section !== 'string' || section.length === 0 || section.length > 50) {
      return c.json({ error: 'Invalid section' }, 400);
    }
    if (typeof question_index !== 'number' || !Number.isFinite(question_index) || question_index < 0 || question_index > 500) {
      return c.json({ error: 'Invalid question_index' }, 400);
    }
    if (answer_data === undefined || answer_data === null || typeof answer_data !== 'object') {
      return c.json({ error: 'Invalid answer_data' }, 400);
    }
    if (typeof time_spent_seconds !== 'number' || !Number.isFinite(time_spent_seconds) || time_spent_seconds < 0 || time_spent_seconds > 36000) {
      return c.json({ error: 'Invalid time_spent_seconds' }, 400);
    }
    if (content_id !== undefined && content_id !== null && (typeof content_id !== 'number' || !Number.isFinite(content_id))) {
      return c.json({ error: 'Invalid content_id' }, 400);
    }
    const safeUuid = (typeof client_uuid === 'string' && client_uuid.length > 0 && client_uuid.length <= 64)
      ? client_uuid
      : null;

    // Idempotency: if the client tagged this submission with a UUID,
    // check for an existing row with the same UUID first. This catches
    // the offline-sync retry case where the previous POST actually
    // persisted on the server but the HTTP response was lost — replaying
    // would otherwise create a duplicate or hit the position-unique
    // constraint. Nullable column (migration 052); pre-migration clients
    // that don't send uuid skip this and fall through to the position-
    // based dedup below, which is how the endpoint used to behave.
    // Tracks P1 BUGS.md #1 (server-side half).
    if (safeUuid) {
      const dup = await c.env.DB.prepare(
        'SELECT id, is_correct FROM attempt_answers WHERE attempt_id = ? AND client_uuid = ? LIMIT 1'
      ).bind(attemptId, safeUuid).first() as any;
      if (dup) {
        return c.json({
          saved: true,
          idempotent: true,
          is_correct: dup.is_correct,
          next_question_index: question_index + 1,
        });
      }
    }

    // Check if answer exists at this (attempt, section, question_index)
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
        `UPDATE attempt_answers SET answer_data = ?, is_correct = ?, submitted_at = ?,
                                    time_spent_seconds = ?, content_id = ?,
                                    client_uuid = COALESCE(client_uuid, ?)
         WHERE id = ?`
      ).bind(
        JSON.stringify(answer_data),
        isCorrect !== null ? (isCorrect ? 1 : 0) : null,
        new Date().toISOString(),
        time_spent_seconds,
        content_id || null,
        safeUuid,
        existing.id,
      ).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO attempt_answers (attempt_id, section, question_index, content_id, answer_data, is_correct, score, time_spent_seconds, client_uuid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        attemptId, section, question_index, content_id || null, JSON.stringify(answer_data),
        isCorrect !== null ? (isCorrect ? 1 : 0) : null,
        isCorrect !== null ? (isCorrect ? 1.0 : 0.0) : null,
        time_spent_seconds,
        safeUuid,
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

      // Gamification: award XP (legacy commercial + new gamification engine)
      try {
        const { addXP, incrementDailyUsage } = await import('../services/commercial');
        await addXP(c.env, userId, isCorrect ? 15 : 10, isCorrect ? 'correct_answer' : 'answer');
        await incrementDailyUsage(c.env, userId);
      } catch (e) { console.error('XP tracking error:', e); }
      try {
        const { awardXp } = await import('../services/gamification');
        const xpResult = await awardXp(c.env, userId, isCorrect ? 'question_correct' : 'question_wrong');
        // Surface level-ups and new badges the user actually cares about.
        // They're answering questions in the mini app, so a Telegram
        // notification to their chat is the right channel (it'll pop up
        // regardless of what screen they're on). Guarded to only fire on
        // level_up or badge unlock so we don't spam every correct answer.
        if ((xpResult.level_up || xpResult.new_badges.length > 0) && c.env.TELEGRAM_BOT_TOKEN) {
          c.executionCtx?.waitUntil((async () => {
            try {
              const userRow = await c.env.DB.prepare(
                'SELECT telegram_id FROM users WHERE id = ?'
              ).bind(userId).first<any>();
              const tgId = userRow?.telegram_id
                ? parseInt(String(userRow.telegram_id).replace('.0', ''))
                : null;
              if (!tgId) return;
              const parts: string[] = [];
              if (xpResult.level_up) {
                parts.push(`🎉 Level Up! Kamu sekarang level *${xpResult.level}*!`);
              }
              if (xpResult.new_badges.length > 0) {
                const badgeLine = xpResult.new_badges
                  .map((b) => `${b.icon} ${b.name}`)
                  .join(', ');
                parts.push(`🏅 Badge baru: ${badgeLine}`);
              }
              const text = parts.join('\n');
              await fetch(
                `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: tgId,
                    text,
                    parse_mode: 'Markdown',
                  }),
                },
              ).catch((e) => console.warn('[level-up] send failed:', e?.message || e));
            } catch (e: any) {
              console.warn('[level-up] notify error:', e?.message || e);
            }
          })());
        }
      } catch (e) { console.error('Gamification XP error:', e); }

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

      // IRT: update item response statistics (lightweight per-answer)
      if (isCorrect !== null && content_id) {
        try {
          await c.env.DB.prepare(
            `INSERT INTO irt_item_params (content_id, difficulty, discrimination, guessing, total_responses, total_correct, updated_at)
             VALUES (?, 0, 1.0, 0.25, 1, ?, datetime('now'))
             ON CONFLICT(content_id) DO UPDATE SET
               total_responses = total_responses + 1,
               total_correct = total_correct + ?,
               updated_at = datetime('now')`
          ).bind(content_id, isCorrect ? 1 : 0, isCorrect ? 1 : 0).run();
        } catch (e) { console.error('IRT item tracking error:', e); }
      }
    }

    // Emotional intelligence: struggle detection + question milestones
    let encouragement: string | null = null;
    try {
      const { detectStruggle, checkQuestionMilestone } = await import('../services/companion');
      const userName = (attempt.metadata ? JSON.parse(attempt.metadata as string)?.user_name : null)
        || (await c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(userId).first() as any)?.name
        || 'Teman';

      if (isCorrect === false) {
        encouragement = await detectStruggle(c.env, userId, userName, attemptId);
      }
      if (!encouragement) {
        encouragement = await checkQuestionMilestone(c.env, userId, userName);
      }
    } catch (e) { /* silent — encouragement is nice-to-have */ }

    return c.json({
      saved: true,
      is_correct: isCorrect,
      next_question_index: question_index + 1,
      ...(encouragement ? { encouragement } : {}),
    });
  } catch (e: any) {
    console.error('Answer submission error:', e);
    return c.json({ error: 'Failed to save answer: ' + (e.message || 'unknown error') }, 500);
  }
});

testRoutes.post('/attempt/:id/section/:nextSection', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const attemptId = parseInt(c.req.param('id'));
  if (isNaN(attemptId)) return c.json({ error: 'Invalid attempt ID' }, 400);
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

/**
 * Compute scores from an attempt's recorded answers.
 *
 * Handles both objective (reading/listening/structure) and AI-evaluated
 * (speaking/writing) answers:
 *   - Objective: is_correct IS NOT NULL → correct/total ratio × max_band
 *   - Speaking/Writing: is_correct IS NULL, but answer_data.score is the
 *     AI's band rating (1–max_band). Averaged per section.
 *
 * Previously the finish handler filtered is_correct !== null, which
 * silently dropped ALL speaking/writing answers → sections scored 0
 * even when the student had band-5 speaking. This was the main reason
 * students reported "Speaking saya 5/6 tapi hasil 0."
 *
 * Returns null if the attempt has zero scorable answers (empty test or
 * every answer malformed). Caller should NOT write a 0/0/0/0 row in
 * that case — it's misleading data, not a result.
 */
export interface AttemptScoring {
  sectionScores: Record<string, number | null>;
  totalScore: number;
  scoredSectionCount: number;
  scoredAnswerCount: number;
}

export function scoreAttempt(
  answers: any[],
  testType: string,
  configSections: any[] | undefined,
  maxBand: number,
): AttemptScoring | null {
  const sectionScores: Record<string, number | null> = {};
  let totalScoredAnswers = 0;

  const AI_SCORED = new Set(['speaking', 'writing']);

  for (const section of configSections || []) {
    const sectionAnswers = answers.filter((a: any) => a.section === section.id);

    if (AI_SCORED.has(section.id)) {
      // AI-scored: pull the band score out of answer_data.score (1..max_band).
      // Skip answers without a valid numeric score (e.g. speaking audio that
      // never reached Whisper + scoring pipeline — these are "missing", not
      // "zero").
      const bands: number[] = [];
      for (const a of sectionAnswers) {
        let score: number | null = null;
        try {
          const data = typeof a.answer_data === 'string'
            ? JSON.parse(a.answer_data || '{}')
            : (a.answer_data || {});
          const raw = data?.score;
          if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
            if (raw > maxBand) {
              // AI returned out-of-range score — log so we can detect a
              // misbehaving prompt/model before analytics quietly compound.
              console.warn('[score-clamp] AI score exceeds maxBand:',
                { raw, maxBand, test_type: testType, section: section.id });
            }
            score = Math.min(raw, maxBand);
          }
        } catch {}
        if (score !== null) bands.push(score);
      }
      if (bands.length === 0) {
        sectionScores[section.id] = null;
      } else {
        const avg = bands.reduce((a, b) => a + b, 0) / bands.length;
        sectionScores[section.id] = Math.round(avg * 2) / 2;
        totalScoredAnswers += bands.length;
      }
    } else {
      // Objective: boolean correctness ratio × max_band.
      const scored = sectionAnswers.filter((a: any) => a.is_correct !== null);
      if (scored.length === 0) {
        sectionScores[section.id] = null;
      } else {
        const correct = scored.filter((a: any) => a.is_correct === 1).length;
        sectionScores[section.id] = Math.round((correct / scored.length) * maxBand * 2) / 2;
        totalScoredAnswers += scored.length;
      }
    }
  }

  if (totalScoredAnswers === 0) return null;

  const values = Object.values(sectionScores).filter(
    (v): v is number => typeof v === 'number' && !isNaN(v),
  );
  const totalScore = values.length > 0
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
    : 0;

  return {
    sectionScores,
    totalScore,
    scoredSectionCount: values.length,
    scoredAnswerCount: totalScoredAnswers,
  };
}

testRoutes.post('/attempt/:id/finish', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw, c.env);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const attemptId = parseInt(c.req.param('id'));
    if (isNaN(attemptId)) return c.json({ error: 'Invalid attempt ID' }, 400);
    const attempt = await c.env.DB.prepare(
      'SELECT * FROM test_attempts WHERE id = ? AND user_id = ?'
    ).bind(attemptId, user.id).first();

    if (!attempt) return c.json({ error: 'Not found' }, 404);

    // Mock-mode deadline enforcement — mark as time_expired if past deadline
    const now = new Date().toISOString();
    let finalStatus = 'completed';
    try {
      const meta = attempt.metadata ? JSON.parse(attempt.metadata as string) : {};
      if (meta?.mock_mode && meta?.deadline_at) {
        const deadline = new Date(meta.deadline_at).getTime();
        if (Number.isFinite(deadline) && Date.now() > deadline) {
          finalStatus = 'time_expired';
        }
      }
    } catch {}

    const config = TEST_CONFIGS[attempt.test_type as string];
    if (!config) {
      // Don't silently default to the iBT scale — that was producing
      // wrong band numbers for TOEFL_ITP/TOEIC. Leave the attempt
      // in_progress so ops can repair it, and surface the cause.
      console.error(`[finish] Unknown test_type "${attempt.test_type}" for attempt ${attemptId}`);
      return c.json({ error: 'Unsupported test_type', test_type: attempt.test_type }, 500);
    }

    // Load answers and calculate scores
    const answersResult = await c.env.DB.prepare(
      'SELECT * FROM attempt_answers WHERE attempt_id = ?'
    ).bind(attemptId).all();
    const answers = (answersResult.results || []) as any[];

    const maxBand = config.max_band || 6;
    const scoring = scoreAttempt(answers, attempt.test_type as string, config.sections, maxBand);

    if (!scoring) {
      // Zero scorable answers — don't write a fake 0/0/0 row. That was
      // happening before when students clicked finish without answering;
      // the misleading "0 band" score muddied their history. Leave the
      // attempt in_progress so they can either resume or the UI can show
      // a clear "no answers submitted" state.
      return c.json({
        error: 'No scored answers',
        code: 'EMPTY_ATTEMPT',
        attempt_id: attemptId,
      }, 400);
    }

    const { sectionScores, totalScore } = scoring;

    // WRITE ORDER MATTERS: insert test_results FIRST, then flip status to
    // completed. The previous order (status first, then insert) stranded
    // students whenever the insert threw — they'd see status='completed'
    // but /results would 404 forever with no recovery path.
    try {
      await c.env.DB.prepare(
        `INSERT INTO test_results (attempt_id, user_id, test_type, total_score, section_scores, band_score)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        attemptId, attempt.user_id || 0, attempt.test_type,
        totalScore, JSON.stringify(sectionScores), totalScore,
      ).run();
    } catch (insertErr: any) {
      console.error(`[finish] test_results INSERT failed for attempt ${attemptId}:`, insertErr?.message || insertErr);
      return c.json({ error: 'Failed to save results', detail: insertErr?.message }, 500);
    }

    await c.env.DB.prepare(
      'UPDATE test_attempts SET status = ?, finished_at = ? WHERE id = ?'
    ).bind(finalStatus, now, attemptId).run();

    // ─── IRT + Learning Curve updates (non-blocking) ────────────
    const userId = attempt.user_id as number;
    if (userId > 0) {
      try {
        // 1. Build IRT responses from answers
        const irtResponses: IRTResponse[] = answers
          .filter((a: any) => a.is_correct !== null)
          .map((a: any) => ({
            content_id: (a.content_id as number) || 0,
            section: a.section as string,
            is_correct: !!(a.is_correct),
          }));

        // 2. Update IRT student ability
        if (irtResponses.length > 0) {
          await updateStudentAbility(c.env.DB, userId, irtResponses);
        }

        // 3. Record learning curve points per section
        const sectionGroups = new Map<string, { correct: number; total: number }>();
        for (const a of answers) {
          if (a.is_correct === null) continue;
          const sec = a.section as string;
          if (!sectionGroups.has(sec)) sectionGroups.set(sec, { correct: 0, total: 0 });
          const g = sectionGroups.get(sec)!;
          g.total++;
          if (a.is_correct) g.correct++;
        }

        for (const [skill, stats] of sectionGroups.entries()) {
          if (stats.total >= 3) { // Only record if meaningful session
            const acc = stats.correct / stats.total;
            await recordLearningPoint(c.env.DB, userId, skill, acc, stats.total);
            await fitAndSaveLearningCurve(c.env.DB, userId, skill);
            await updateForgettingCurve(c.env.DB, userId, skill, acc >= 0.5);
          }
        }
      } catch (irtErr: any) {
        console.error('IRT/learning-curve update error (non-fatal):', irtErr.message);
      }
    }

    // Get IRT-enhanced score if available
    let irtProfile = null;
    try {
      if (userId > 0) {
        irtProfile = await getStudentIRTProfile(c.env.DB, userId);
      }
    } catch {}

    // Growth recognition — check if student improved since last period
    let growthMessage: string | null = null;
    try {
      if (userId > 0) {
        const { detectGrowth } = await import('../services/companion');
        const userName = (await c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(userId).first() as any)?.name || 'Teman';
        growthMessage = await detectGrowth(c.env, userId, userName);
      }
    } catch (e) { /* silent */ }

    // ─── Post-test wrap-up: FSRS ingest + tutor review nudge (non-blocking) ───
    // Feeds wrongs into spaced repetition and (if the attempt has triageable
    // mistakes) pings the student on Telegram offering a conversational review.
    // Runs via waitUntil so the HTTP response to the mini app is not delayed.
    if (userId > 0 && finalStatus === 'completed') {
      c.executionCtx.waitUntil((async () => {
        try {
          const { analyzeAttempt, ingestWrongsToFsrs, sendNudge, buildAttemptSummary } = await import('../services/post-test-review');
          await ingestWrongsToFsrs(c.env, attemptId, userId);
          const analysis = await analyzeAttempt(c.env, attemptId, userId);

          // Populate test_results.ai_summary so the student sees WHY they
          // scored what they did when they open the results page a second
          // time (or when the page loads after the waitUntil finishes).
          // Rule-based, so no extra OpenAI call or latency.
          try {
            const summary = buildAttemptSummary(analysis, sectionScores, maxBand);
            if (summary) {
              await c.env.DB.prepare(
                'UPDATE test_results SET ai_summary = ? WHERE attempt_id = ?'
              ).bind(summary, attemptId).run();
            }
          } catch (e: any) {
            console.error('ai_summary update failed (non-fatal):', e?.message || e);
          }

          if (analysis && analysis.triaged_concepts && analysis.triaged_concepts.length > 0) {
            await sendNudge(c.env, userId, analysis);
          }
        } catch (e: any) {
          console.error('post-test wrap-up error (non-fatal):', e?.message || e);
        }
      })());
    }

    return c.json({
      attempt_id: attemptId,
      test_type: attempt.test_type,
      total_score: totalScore,
      band_score: totalScore,
      section_scores: sectionScores,
      irt: irtProfile ? {
        ibt_estimate: irtProfile.ibt_estimate,
        cefr: irtProfile.cefr,
        confidence: irtProfile.confidence,
        abilities: irtProfile.abilities,
      } : null,
      ai_summary: null,
      detailed_feedback: null,
      completed_at: now,
      ...(growthMessage ? { growth_message: growthMessage } : {}),
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
    const drillConcept = c.req.query('drill_concept');
    let limit = parseInt(c.req.query('limit') || '20');
    if (isNaN(limit)) limit = 20;
    limit = Math.min(limit, 50);
    let offset = parseInt(c.req.query('offset') || '0');
    if (isNaN(offset)) offset = 0;

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

    // Drill mode: filter by skill_tag using JSON-array LIKE matching. The tag
    // is a flat string inside a JSON array (e.g. '["inference","detail"]'),
    // so `%"inference"%` is the safest substring match.
    if (drillConcept) {
      query += ' AND skill_tags LIKE ?';
      params.push(`%"${drillConcept.replace(/"/g, '')}"%`);
    }

    // When no question_type filter (random mix), use RANDOM() for variety
    // Otherwise order by difficulty for progressive learning within a type
    // Drill mode always randomizes — variety matters more than progression
    // when we're hammering a single concept across a short 3–5 question set.
    if (drillConcept) {
      query += ' ORDER BY RANDOM() LIMIT ? OFFSET ?';
    } else if (questionType) {
      query += ' ORDER BY difficulty ASC LIMIT ? OFFSET ?';
    } else {
      query += ' ORDER BY RANDOM() LIMIT ? OFFSET ?';
    }
    params.push(limit, offset);

    // Exposure-aware path for EVERY authenticated request with no pagination.
    // Previously this was gated on "no question_type, no drill" which meant
    // every filtered request and every drill session bypassed the exposure
    // sampler — the same 30-50 RANDOM-winning questions kept hitting the
    // same student over and over. Now we route ALL authenticated requests
    // through the exposure sampler; each narrows the pool with its own
    // extraWhere clause. Only anonymous / paginated requests fall back.
    // Tracks "content repetitive" user report.
    let result: { results: any[] };
    if (userId && !offset) {
      const extraClauses: string[] = [`test_type = ?`, `section = ?`, `status = 'published'`];
      const extraParams: any[] = [testType, section];
      if (questionType) {
        extraClauses.push(`question_type = ?`);
        extraParams.push(questionType);
      }
      if (drillConcept) {
        extraClauses.push(`skill_tags LIKE ?`);
        extraParams.push(`%"${drillConcept.replace(/"/g, '')}"%`);
      }
      const rows = await selectUnderExposedQuestions<any>(c.env, {
        userId: Number(userId),
        limit,
        extraWhere: extraClauses.join(' AND '),
        extraParams,
        columns: 'id, question_type, title, content, media_url, difficulty',
      });
      result = { results: rows };
    } else {
      const stmt = c.env.DB.prepare(query);
      result = (await stmt.bind(...params).all()) as { results: any[] };
    }

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

    // Record exposures for the served batch so next time we spread wider.
    if (userId && questions && questions.length > 0) {
      const ids = questions.map((r: any) => Number(r.id)).filter((n: number) => Number.isInteger(n));
      if (ids.length > 0) {
        c.executionCtx.waitUntil(recordExposures(c.env, Number(userId), ids, 'test'));
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
      // Speaking questions put the sentence in `sq.script` (from parse-ielts
      // and parse-toeic ingestion), reading/error-ID put it in
      // `sq.question_text`. Accept either. Without checking sq.script the
      // whole Speaking section was being filtered out as "empty" → the
      // mini app showed "Belum ada soal" for every speaking test.
      const topText = String(c.question_text || c.passage_text || c.passage || c.script || '').trim();
      const topOpts = Array.isArray(c.options) ? c.options.length : 0;
      if (topText || topOpts > 0) return true;
      const subs = Array.isArray(c.questions) ? c.questions : [];
      return subs.some((sq: any) => {
        const t = String(sq?.question_text || sq?.script || '').trim();
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
  if (isNaN(attemptId)) return c.json({ error: 'Invalid attempt ID' }, 400);

  const attempt = await c.env.DB.prepare(
    'SELECT * FROM test_attempts WHERE id = ? AND user_id = ?'
  ).bind(attemptId, user.id).first();

  if (!attempt) return c.json({ error: 'Not found' }, 404);

  let result: any = await c.env.DB.prepare(
    'SELECT * FROM test_results WHERE attempt_id = ?'
  ).bind(attemptId).first();

  // Recovery path: attempts that were marked completed/time_expired but
  // never got a test_results row (e.g. the historical bug where status was
  // flipped BEFORE the INSERT, and the INSERT failed). Re-score from
  // attempt_answers rather than leave the student with "Hasil tidak
  // ditemukan" forever. Only attempts that are already finished qualify —
  // in-progress attempts should finish the normal way.
  if (!result && (attempt.status === 'completed' || attempt.status === 'time_expired')) {
    const config = TEST_CONFIGS[attempt.test_type as string];
    if (config) {
      const answersResult = await c.env.DB.prepare(
        'SELECT * FROM attempt_answers WHERE attempt_id = ?'
      ).bind(attemptId).all();
      const answers = (answersResult.results || []) as any[];
      const scoring = scoreAttempt(answers, attempt.test_type as string, config.sections, config.max_band || 6);
      if (scoring) {
        try {
          await c.env.DB.prepare(
            `INSERT INTO test_results (attempt_id, user_id, test_type, total_score, section_scores, band_score)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(
            attemptId, attempt.user_id || 0, attempt.test_type,
            scoring.totalScore, JSON.stringify(scoring.sectionScores), scoring.totalScore,
          ).run();
          console.log(`[results] re-scored orphaned attempt ${attemptId}`);
          result = await c.env.DB.prepare(
            'SELECT * FROM test_results WHERE attempt_id = ?'
          ).bind(attemptId).first();
        } catch (e: any) {
          console.error(`[results] re-score INSERT failed for ${attemptId}:`, e?.message || e);
        }
      }
    }
  }

  if (!result) return c.json({ error: 'Results not found', code: 'NO_RESULT_ROW' }, 404);

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
  if (isNaN(attemptId)) return c.json({ error: 'Invalid attempt ID' }, 400);

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
      content_id: a.content_id,
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
  if (isNaN(attemptId)) return c.json({ error: 'Invalid attempt ID' }, 400);

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

  // Load questions for each section — exposure-aware so the whole bank gets used.
  for (const section of sections) {
    const rows = await selectUnderExposedQuestions<any>(c.env, {
      userId: Number(user.id),
      limit: 50,
      extraWhere: `test_type = ? AND section = ? AND status = 'published'`,
      extraParams: [attempt.test_type as string, section.id],
      columns: 'id, question_type, title, content, media_url, difficulty',
    });

    allQuestions[section.id] = rows.map((r: any) => {
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
      // as empty Q-cards. Accept sq.script as well as sq.question_text
      // because grouped_speaking content puts the sentence in `script`.
      const c = q.content || {};
      const topText = String(c.question_text || c.passage_text || c.passage || c.script || '').trim();
      const topOpts = Array.isArray(c.options) ? c.options.length : 0;
      if (topText || topOpts > 0) return true;
      const subs = Array.isArray(c.questions) ? c.questions : [];
      return subs.some((sq: any) => {
        const t = String(sq?.question_text || sq?.script || '').trim();
        const o = Array.isArray(sq?.options) ? sq.options.length : 0;
        return t.length > 0 || o > 0;
      });
    });

    // Record exposures for this batch (non-blocking if user.id missing)
    const servedIds = rows.map((r: any) => Number(r.id)).filter((n) => Number.isInteger(n));
    if (servedIds.length > 0) {
      // Fire-and-forget — don't block response on bookkeeping
      c.executionCtx.waitUntil(recordExposures(c.env, Number(user.id), servedIds, 'test'));
    }
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

// ─── Skill Practice Mode ───────────────────────────────────────────────
// Focused per-skill practice sessions with IRT-driven recommendations

const SKILL_PRACTICE_CONFIG: Record<string, {
  id: string;
  name: string;
  icon: string;
  description: string;
  question_count: number;
  duration_minutes: number;
}> = {
  reading: {
    id: 'reading', name: 'Reading', icon: '📖',
    description: 'Latihan passage & comprehension',
    question_count: 10, duration_minutes: 20,
  },
  listening: {
    id: 'listening', name: 'Listening', icon: '🎧',
    description: 'Latihan conversation & lecture',
    question_count: 8, duration_minutes: 15,
  },
  speaking: {
    id: 'speaking', name: 'Speaking', icon: '🗣️',
    description: 'Latihan recording & AI evaluation',
    question_count: 4, duration_minutes: 10,
  },
  writing: {
    id: 'writing', name: 'Writing', icon: '✍️',
    description: 'Latihan essay & integrated writing',
    question_count: 3, duration_minutes: 20,
  },
  structure: {
    id: 'structure', name: 'Structure', icon: '📝',
    description: 'Latihan grammar & written expression',
    question_count: 10, duration_minutes: 15,
  },
};

// GET /api/tests/skill-practice/config — skill cards + IRT scores + recommendation
testRoutes.get('/skill-practice/config', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw, c.env);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const testType = c.req.query('test_type') || 'TOEFL_IBT';
    const config = TEST_CONFIGS[testType];
    if (!config) return c.json({ error: 'Unknown test type' }, 404);

    // Get available skills for this test type
    const availableSkills = config.sections.map((s: any) => s.id);

    // Get question counts per skill
    const countResult = await c.env.DB.prepare(
      `SELECT section, COUNT(*) as count FROM test_contents
       WHERE test_type = ? AND status = 'published' AND section IN (${availableSkills.map(() => '?').join(',')})
       GROUP BY section`
    ).bind(testType, ...availableSkills).all();

    const questionCounts: Record<string, number> = {};
    for (const row of countResult.results || []) {
      questionCounts[(row as any).section] = (row as any).count;
    }

    // Get IRT profile for this user
    let irtAbilities: Record<string, { theta: number; se: number; ibt_estimate?: number; cefr?: string }> = {};
    try {
      const { getStudentIRTProfile: getIRT, thetaToIBTSection: toIBT, thetaToCEFR: toCEFR } = await import('../services/irt-engine');
      const profile = await getIRT(c.env.DB, user.id);
      if (profile?.abilities) {
        for (const a of profile.abilities) {
          if (a.skill === 'overall') continue;
          irtAbilities[a.skill] = {
            theta: a.theta,
            se: a.standard_error,
            ibt_estimate: toIBT(a.theta),
            cefr: toCEFR(a.theta),
          };
        }
      }
    } catch {}

    // Get learning curve data for projections
    let learningData: Record<string, any> = {};
    try {
      const { getStudentLearningAnalytics: getLC } = await import('../services/learning-curve');
      const lc = await getLC(c.env.DB, user.id);
      if (lc?.learningCurves) {
        for (const curve of lc.learningCurves) {
          learningData[curve.skill] = {
            current_accuracy: curve.a_max,
            projected_accuracy: curve.predicted_accuracy_2w,
            sessions_completed: curve.data_points,
          };
        }
      }
    } catch {}

    // Get recent practice history (last 7 days)
    const recentHistory = await c.env.DB.prepare(
      `SELECT aa.section, COUNT(*) as questions_done,
              SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct,
              MAX(ta.started_at) as last_practiced
       FROM attempt_answers aa
       JOIN test_attempts ta ON ta.id = aa.attempt_id
       WHERE ta.user_id = ? AND ta.test_type = ?
       AND ta.started_at > datetime('now', '-7 days')
       AND aa.is_correct IS NOT NULL
       GROUP BY aa.section`
    ).bind(user.id, testType).all();

    const practiceHistory: Record<string, { questions_done: number; correct: number; accuracy: number; last_practiced: string | null }> = {};
    for (const row of recentHistory.results || []) {
      const r = row as any;
      practiceHistory[r.section] = {
        questions_done: r.questions_done,
        correct: r.correct,
        accuracy: r.questions_done > 0 ? Math.round((r.correct / r.questions_done) * 100) : 0,
        last_practiced: r.last_practiced,
      };
    }

    // Determine recommended skill (weakest theta with enough data, or least practiced)
    let recommended: string | null = null;
    let recommendReason = '';

    // Priority 1: Skill with lowest IRT theta
    const irtSkills = Object.entries(irtAbilities)
      .filter(([skill]) => availableSkills.includes(skill))
      .sort(([, a], [, b]) => a.theta - b.theta);

    if (irtSkills.length > 0) {
      recommended = irtSkills[0][0];
      const theta = irtSkills[0][1].theta;
      recommendReason = `Skill terlemah berdasarkan IRT (θ = ${theta.toFixed(2)})`;
    }

    // Priority 2: Least practiced skill (if no IRT data)
    if (!recommended) {
      const leastPracticed = availableSkills
        .map((s: string) => ({ skill: s, done: practiceHistory[s]?.questions_done || 0 }))
        .sort((a: any, b: any) => a.done - b.done);

      if (leastPracticed.length > 0) {
        recommended = leastPracticed[0].skill;
        recommendReason = 'Skill paling jarang dilatih minggu ini';
      }
    }

    // Get quota
    const { checkTestAccess } = await import('../services/premium');
    const quotaInfo = await checkTestAccess(c.env, user.id);

    // Build skill cards
    const skills = availableSkills.map((skillId: string) => {
      const skillConfig = SKILL_PRACTICE_CONFIG[skillId] || {
        id: skillId, name: skillId, icon: '📋',
        description: '', question_count: 10, duration_minutes: 15,
      };
      const irt = irtAbilities[skillId];
      const lc = learningData[skillId];
      const history = practiceHistory[skillId];

      return {
        ...skillConfig,
        available_questions: questionCounts[skillId] || 0,
        irt: irt ? {
          theta: Math.round(irt.theta * 100) / 100,
          se: Math.round(irt.se * 100) / 100,
          ibt_estimate: irt.ibt_estimate,
          cefr: irt.cefr,
        } : null,
        learning_curve: lc ? {
          current_accuracy: Math.round(lc.current_accuracy * 100),
          projected_accuracy: Math.round(lc.projected_accuracy * 100),
          sessions: lc.sessions_completed,
        } : null,
        recent: history || null,
        is_recommended: skillId === recommended,
      };
    });

    return c.json({
      test_type: testType,
      skills,
      recommended: recommended ? { skill: recommended, reason: recommendReason } : null,
      quota: quotaInfo ? {
        allowed: quotaInfo.allowed,
        is_premium: quotaInfo.is_premium,
        remaining: quotaInfo.remaining,
        daily_limit: quotaInfo.daily_limit,
        used_today: quotaInfo.used_today,
      } : null,
    });
  } catch (e: any) {
    console.error('Skill practice config error:', e);
    return c.json({ error: e.message || 'Failed to load skill practice config' }, 500);
  }
});

// POST /api/tests/skill-practice/start — start a focused skill practice session
testRoutes.post('/skill-practice/start', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw, c.env);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { test_type, skill, question_count } = await c.req.json();
    const config = TEST_CONFIGS[test_type];
    if (!config) return c.json({ error: 'Unknown test type' }, 404);

    const sectionConfig = config.sections.find((s: any) => s.id === skill);
    if (!sectionConfig) return c.json({ error: 'Unknown skill for this test type' }, 404);

    // Check quota
    const { checkTestAccess } = await import('../services/premium');
    const access = await checkTestAccess(c.env, user.id);
    if (!access.allowed) {
      return c.json({
        error: 'Batas harian tercapai',
        code: 'LIMIT_REACHED',
        quota: {
          daily_limit: access.daily_limit,
          used_today: access.used_today,
          remaining: 0,
          reset_at: access.reset_at,
        },
      }, 403);
    }

    // Auto-complete stale attempts
    try {
      await c.env.DB.prepare(
        `UPDATE test_attempts SET status = 'abandoned', finished_at = datetime('now')
         WHERE user_id = ? AND status = 'in_progress'
         AND started_at < datetime('now', '-2 hours')`
      ).bind(user.id).run();
    } catch {}

    const skillPracticeConfig = SKILL_PRACTICE_CONFIG[skill];
    const qCount = question_count || skillPracticeConfig?.question_count || 10;
    const duration = skillPracticeConfig?.duration_minutes || sectionConfig.duration_minutes;

    const now = new Date().toISOString();
    const metadata = {
      practice_mode: 'skill',
      skill,
      target_question_count: qCount,
      section_only: skill,
      total_duration_minutes: duration,
    };

    const result = await c.env.DB.prepare(
      `INSERT INTO test_attempts (user_id, test_type, status, current_section, current_question_index, section_start_times, started_at, metadata)
       VALUES (?, ?, 'in_progress', ?, 0, ?, ?, ?)`
    ).bind(
      user.id, test_type, skill,
      JSON.stringify({ [skill]: now }), now,
      JSON.stringify(metadata),
    ).run();

    const attemptId = result.meta.last_row_id;

    return c.json({
      attempt_id: attemptId,
      test_type,
      skill,
      sections: [sectionConfig],
      current_section: skill,
      question_count: qCount,
      duration_minutes: duration,
      practice_mode: 'skill',
    });
  } catch (e: any) {
    return c.json({ error: e.message || 'Failed to start skill practice' }, 500);
  }
});

// GET /api/tests/skill-practice/history — recent skill practice results
testRoutes.get('/skill-practice/history', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw, c.env);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const testType = c.req.query('test_type') || 'TOEFL_IBT';
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);

    const results = await c.env.DB.prepare(
      `SELECT ta.id, ta.test_type, ta.current_section as skill, ta.started_at, ta.finished_at, ta.metadata,
              COUNT(aa.id) as total_questions,
              SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct,
              SUM(CASE WHEN aa.is_correct = 0 THEN 1 ELSE 0 END) as wrong,
              AVG(aa.time_spent_seconds) as avg_time
       FROM test_attempts ta
       LEFT JOIN attempt_answers aa ON aa.attempt_id = ta.id AND aa.is_correct IS NOT NULL
       WHERE ta.user_id = ? AND ta.test_type = ? AND ta.status = 'completed'
       AND ta.metadata LIKE '%"practice_mode":"skill"%'
       GROUP BY ta.id
       ORDER BY ta.started_at DESC
       LIMIT ?`
    ).bind(user.id, testType, limit).all();

    return c.json({
      sessions: (results.results || []).map((r: any) => {
        const meta = r.metadata ? JSON.parse(r.metadata) : {};
        return {
          attempt_id: r.id,
          skill: meta.skill || r.skill,
          started_at: r.started_at,
          finished_at: r.finished_at,
          total_questions: r.total_questions,
          correct: r.correct,
          wrong: r.wrong,
          accuracy: r.total_questions > 0 ? Math.round((r.correct / r.total_questions) * 100) : 0,
          avg_time_seconds: r.avg_time ? Math.round(r.avg_time) : null,
        };
      }),
    });
  } catch (e: any) {
    return c.json({ error: e.message || 'Failed to load history' }, 500);
  }
});
