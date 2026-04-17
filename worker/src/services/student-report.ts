/**
 * Student Report Builder — Comprehensive Student Intelligence
 *
 * Aggregates ALL data we have about a student into a single structured report.
 * Two output formats:
 * 1. Full JSON — for API consumers and admin dashboards
 * 2. AI Context String — optimized prompt context for the lesson engine & tutor
 *
 * This is the "brain dump" that lets an AI agent build truly personalized
 * lesson plans, knowing exactly where the student is, what they struggle with,
 * how they learn best, and what to do next.
 */

import type { Env, User } from '../types';
import { getStudentProfile, getAllTopicMasteries, getWeakestTopics, type StudentProfile, type TopicMastery } from './student-profile';
import { getStudentMentalModel, getMisconceptions, getKnowledgeGaps, buildMentalModelContext, type ConceptModel } from './mental-model';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface StudentReport {
  // Identity
  student: {
    id: number;
    name: string;
    username: string | null;
    target_test: string | null;
    proficiency_level: string | null;
    is_premium: boolean;
    created_at: string;
    days_since_signup: number;
  };

  // Learning preferences (Ranedeer-style)
  preferences: {
    learning_style: string | null;
    communication_style: string | null;
    depth_level: string | null;
    preferred_language: string | null;
    daily_study_target_min: number;
    personality_notes: string | null;
  };

  // Cognitive profile
  cognitive: {
    learning_pace: string;
    confidence_score: number;
    frustration_score: number;
    engagement_level: string;
    avg_response_time_sec: number;
    consecutive_correct: number;
    consecutive_wrong: number;
    longest_correct_streak: number;
    total_tutor_sessions: number;
    total_tutor_messages: number;
  };

  // Performance by section
  section_performance: {
    section: string;
    total_questions: number;
    correct: number;
    accuracy: number;
    avg_difficulty: number;
    trend: 'improving' | 'declining' | 'stable' | 'new';
  }[];

  // Topic mastery (sorted weakest first)
  topic_mastery: {
    topic: string;
    mastery_level: number;
    accuracy_percent: number;
    exercises_attempted: number;
    current_difficulty: number;
    highest_difficulty_passed: number;
    status: string;
  }[];

  // Mental model — what the tutor believes
  mental_model: {
    total_concepts: number;
    misconceptions: { concept: string; details: string[] }[];
    knowledge_gaps: string[];
    partial_understanding: string[];
    solid_understanding: string[];
    mastered: string[];
  };

  // Error patterns
  error_patterns: {
    grammar_errors: Record<string, number>;
    vocab_errors: Record<string, number>;
    reading_errors: Record<string, number>;
    listening_errors: Record<string, number>;
    most_common_errors: { category: string; count: number }[];
  };

  // Spaced repetition
  srs: {
    total_items: number;
    overdue: number;
    mastered: number;
    avg_level: number;
    avg_retention: number | null;
    items_by_state: { state: string; count: number }[];
  };

  // Recent activity & trends
  activity: {
    last_active: string | null;
    days_active_last_30: number;
    total_questions_answered: number;
    total_correct: number;
    overall_accuracy: number;
    daily_trend: { date: string; questions: number; correct: number; accuracy: number; messages: number }[];
    recent_tests: { id: number; section: string; score: number; total: number; date: string }[];
    study_streak: number;
    total_messages: number;
  };

  // Conversation analysis
  conversation: {
    total_messages: number;
    user_messages: number;
    topics_discussed: { topic: string; count: number }[];
    first_message_at: string | null;
    last_message_at: string | null;
    avg_messages_per_active_day: number;
  };

  // Lesson plan history
  lessons: {
    total_plans: number;
    completed: number;
    active_plan: { id: number; title: string; progress: number; current_step: number; total_steps: number } | null;
    completed_plans: { id: number; title: string; target_skills: string[]; completed_at: string }[];
  };

  // Diagnostic results
  diagnostic: {
    has_taken: boolean;
    score: number | null;
    level_placed: string | null;
    date: string | null;
    section_scores: Record<string, number>;
  };

  // AI recommendations (computed)
  recommendations: {
    priority_skills: string[];
    suggested_difficulty: number;
    suggested_lesson_type: string;
    next_steps: string[];
    estimated_readiness: Record<string, number>;
  };
}

// ═══════════════════════════════════════════════════════
// BUILD FULL REPORT (JSON)
// ═══════════════════════════════════════════════════════

export async function buildStudentReport(env: Env, userId: number): Promise<StudentReport | null> {
  // ── Fetch user ──
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as any;
  if (!user) return null;

  // ── Parallel fetch everything (with per-query error handling) ──
  const safe = <T>(p: Promise<T>, fallback: T): Promise<T> => p.catch((e) => { console.error('Report query failed:', e); return fallback; });
  const safeAll = (p: Promise<any>) => safe(p, { results: [] });
  const safeFirst = (p: Promise<any>) => safe(p, null);

  const [
    profile, masteries, weakTopics, mentalModel, misconceptions, gaps,
    sectionStats, recentAttempts, dailyLogs, srStats, srItems,
    lessonPlans, activePlan, diagnosticResult, learningPrefs,
    convStats, convTopics,
  ] = await Promise.all([
    safe(getStudentProfile(env, userId), null),
    safe(getAllTopicMasteries(env, userId), []),
    safe(getWeakestTopics(env, userId, 10), []),
    safe(getStudentMentalModel(env, userId), []),
    safe(getMisconceptions(env, userId), []),
    safe(getKnowledgeGaps(env, userId), []),
    // Section-level performance — include speaking/writing (score-based)
    safeAll(env.DB.prepare(
      `SELECT aa.section,
              COUNT(*) as total,
              SUM(CASE
                WHEN aa.is_correct = 1 THEN 1
                WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing')
                     AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
                ELSE 0
              END) as correct,
              AVG(aa.time_spent_seconds) as avg_time,
              AVG(tc.difficulty) as avg_difficulty
       FROM attempt_answers aa
       JOIN test_attempts ta ON aa.attempt_id = ta.id
       LEFT JOIN test_contents tc ON aa.content_id = tc.id
       WHERE ta.user_id = ?
       GROUP BY aa.section`
    ).bind(userId).all()),
    // Recent completed tests
    safeAll(env.DB.prepare(
      `SELECT ta.id, ta.current_section as section, ta.started_at as created_at,
              ta.current_question_index as total_questions,
              (SELECT SUM(CASE WHEN aa.is_correct = 1 THEN 1
                WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing')
                     AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
                ELSE 0 END)
               FROM attempt_answers aa WHERE aa.attempt_id = ta.id) as score
       FROM test_attempts ta WHERE ta.user_id = ? AND ta.status = 'completed'
       ORDER BY ta.started_at DESC LIMIT 20`
    ).bind(userId).all()),
    // Daily activity logs (last 30 days) — combines attempt_answers + conversation_messages
    safeAll(env.DB.prepare(
      `SELECT date,
              SUM(questions) as questions,
              SUM(correct) as correct,
              SUM(messages) as messages
       FROM (
         SELECT DATE(aa.submitted_at) as date,
                COUNT(*) as questions,
                SUM(CASE
                  WHEN aa.is_correct = 1 THEN 1
                  WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing')
                       AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
                  ELSE 0
                END) as correct,
                0 as messages
         FROM attempt_answers aa
         JOIN test_attempts ta ON aa.attempt_id = ta.id
         WHERE ta.user_id = ? AND aa.submitted_at >= datetime('now', '-30 days')
         GROUP BY DATE(aa.submitted_at)
         UNION ALL
         SELECT DATE(created_at) as date,
                0 as questions,
                0 as correct,
                COUNT(*) as messages
         FROM conversation_messages
         WHERE user_id = ? AND created_at >= datetime('now', '-30 days')
         GROUP BY DATE(created_at)
       ) GROUP BY date ORDER BY date ASC`
    ).bind(userId, userId).all()),
    // SRS overview
    safeFirst(env.DB.prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN next_review_at <= datetime('now') THEN 1 ELSE 0 END) as overdue,
              SUM(CASE WHEN review_level >= 4 THEN 1 ELSE 0 END) as mastered,
              AVG(review_level) as avg_level
       FROM spaced_repetition WHERE user_id = ?`
    ).bind(userId).first()),
    // SRS items by review level
    safeAll(env.DB.prepare(
      `SELECT review_level, COUNT(*) as count FROM spaced_repetition WHERE user_id = ? GROUP BY review_level ORDER BY review_level`
    ).bind(userId).all()),
    // Lesson plans
    safeAll(env.DB.prepare(
      `SELECT id, title, plan_type, status, target_skills, progress_percent, current_step, total_steps, created_at, completed_at
       FROM lesson_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`
    ).bind(userId).all()),
    // Active lesson plan
    safeFirst(env.DB.prepare(
      `SELECT id, title, progress_percent, current_step, total_steps
       FROM lesson_plans WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`
    ).bind(userId).first()),
    // Diagnostic result
    safeFirst(env.DB.prepare(
      `SELECT * FROM diagnostic_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    ).bind(userId).first()),
    // Learning preferences
    safeFirst(env.DB.prepare(
      `SELECT learning_style, communication_style, depth_level, preferred_language,
              daily_study_target_min, personality_notes
       FROM student_profiles WHERE user_id = ?`
    ).bind(userId).first()),
    // Conversation stats
    safeFirst(env.DB.prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_msgs,
              MIN(created_at) as first_msg,
              MAX(created_at) as last_msg
       FROM conversation_messages WHERE user_id = ?`
    ).bind(userId).first()),
    // Conversation topics
    safeAll(env.DB.prepare(
      `SELECT COALESCE(topic, 'other') as topic, COUNT(*) as count
       FROM conversation_messages
       WHERE user_id = ? AND role = 'user'
       GROUP BY topic ORDER BY count DESC LIMIT 10`
    ).bind(userId).all()),
  ]);

  // ── Compute section performance with trends ──
  const sectionPerformance: StudentReport['section_performance'] = (sectionStats.results || []).map((s: any) => {
    const acc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
    let trend: 'improving' | 'declining' | 'stable' | 'new' = 'stable';
    if (s.total < 5) trend = 'new';
    return {
      section: s.section || 'unknown',
      total_questions: s.total,
      correct: s.correct,
      accuracy: acc,
      avg_difficulty: Math.round((s.avg_difficulty || 3) * 10) / 10,
      trend,
    };
  });

  // Compute section trends from daily logs
  const dailyData = (dailyLogs.results || []) as any[];
  const recentDays = dailyData.slice(-7);
  const olderDays = dailyData.slice(-14, -7);
  if (recentDays.length >= 3 && olderDays.length >= 3) {
    const recentAcc = recentDays.reduce((s: number, d: any) => s + (d.questions > 0 ? d.correct / d.questions : 0), 0) / recentDays.length;
    const olderAcc = olderDays.reduce((s: number, d: any) => s + (d.questions > 0 ? d.correct / d.questions : 0), 0) / olderDays.length;
    const diff = recentAcc - olderAcc;
    for (const sp of sectionPerformance) {
      if (sp.total_questions >= 10) {
        sp.trend = diff > 0.05 ? 'improving' : diff < -0.05 ? 'declining' : 'stable';
      }
    }
  }

  // ── Mental model summary ──
  const mentalModelSummary = {
    total_concepts: mentalModel.length,
    misconceptions: misconceptions.map(m => ({ concept: m.concept, details: m.misconceptions })),
    knowledge_gaps: mentalModel.filter(m => m.believed_understanding === 'unknown').map(m => m.concept),
    partial_understanding: mentalModel.filter(m => m.believed_understanding === 'partial').map(m => m.concept),
    solid_understanding: mentalModel.filter(m => m.believed_understanding === 'solid').map(m => m.concept),
    mastered: mentalModel.filter(m => m.believed_understanding === 'mastered').map(m => m.concept),
  };

  // ── Error patterns ──
  const allErrors = {
    ...safeJSON(profile?.grammar_errors, {}),
    ...safeJSON(profile?.vocab_errors, {}),
    ...safeJSON(profile?.reading_errors, {}),
    ...safeJSON(profile?.listening_errors, {}),
  };
  const mostCommonErrors = Object.entries(allErrors)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, count]) => ({ category, count: count as number }));

  // ── Activity stats ──
  const totalQ = dailyData.reduce((s: number, d: any) => s + d.questions, 0);
  const totalCorrect = dailyData.reduce((s: number, d: any) => s + d.correct, 0);
  const totalMsgs = dailyData.reduce((s: number, d: any) => s + (d.messages || 0), 0);
  const daysActive = dailyData.length;

  // ── Conversation stats ──
  const convStatsData = convStats as any;
  const convTopicsData = (convTopics.results || []) as any[];

  // ── Last active — use conversation_messages as primary, fallback to profile ──
  const lastActive = convStatsData?.last_msg || profile?.last_interaction_at || null;

  // Study streak (consecutive days ending today/yesterday)
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  for (let i = dailyData.length - 1; i >= 0; i--) {
    const d = dailyData[i];
    if (i === dailyData.length - 1 && d.date !== today && d.date !== yesterday) break;
    if (i < dailyData.length - 1) {
      const prev = new Date(dailyData[i + 1].date);
      const curr = new Date(d.date);
      const diff = (prev.getTime() - curr.getTime()) / 86400000;
      if (diff > 1) break;
    }
    streak++;
  }

  // ── Lesson plan stats ──
  const allPlans = (lessonPlans.results || []) as any[];
  const completedPlans = allPlans.filter((p: any) => p.status === 'completed');

  // ── Diagnostic ──
  const diag = diagnosticResult as any;
  const diagnosticInfo = {
    has_taken: !!diag,
    score: diag?.estimated_band || null,
    level_placed: user.proficiency_level || null,
    date: diag?.created_at || null,
    section_scores: diag ? {
      grammar: diag.grammar_score || 0,
      vocab: diag.vocab_score || 0,
      reading: diag.reading_score || 0,
      listening: diag.listening_score || 0,
      writing: diag.writing_band || 0,
    } as Record<string, number> : {} as Record<string, number>,
  };

  // ── Compute AI recommendations ──
  // Default profile if fetch failed
  const defaultProfile = { learning_pace: 'normal', confidence_score: 0.5, frustration_score: 0, engagement_level: 'medium', avg_response_time_sec: 0, consecutive_correct: 0, consecutive_wrong: 0, longest_correct_streak: 0, total_tutor_sessions: 0, total_tutor_messages: 0, grammar_errors: '{}', vocab_errors: '{}', reading_errors: '{}', listening_errors: '{}', last_interaction_at: null } as any;
  const safeProfile = profile || defaultProfile;

  const prioritySkills = computePrioritySkills(masteries, mentalModel, safeProfile);
  const suggestedDifficulty = computeSuggestedDifficulty(safeProfile, masteries);
  const suggestedLessonType = computeLessonType(safeProfile, masteries, mentalModel, completedPlans);
  const nextSteps = computeNextSteps(safeProfile, masteries, mentalModel, sectionPerformance, srStats as any, completedPlans);
  const readiness = computeReadiness(masteries, sectionPerformance, user.target_test);

  const prefs = learningPrefs as any;

  const report: StudentReport = {
    student: {
      id: user.id,
      name: user.name,
      username: user.username,
      target_test: user.target_test,
      proficiency_level: user.proficiency_level,
      is_premium: !!user.is_premium,
      created_at: user.created_at,
      days_since_signup: Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000),
    },
    preferences: {
      learning_style: prefs?.learning_style || null,
      communication_style: prefs?.communication_style || null,
      depth_level: prefs?.depth_level || null,
      preferred_language: prefs?.preferred_language || null,
      daily_study_target_min: prefs?.daily_study_target_min || 30,
      personality_notes: prefs?.personality_notes || null,
    },
    cognitive: {
      learning_pace: safeProfile.learning_pace,
      confidence_score: safeProfile.confidence_score,
      frustration_score: safeProfile.frustration_score,
      engagement_level: safeProfile.engagement_level,
      avg_response_time_sec: safeProfile.avg_response_time_sec,
      consecutive_correct: safeProfile.consecutive_correct,
      consecutive_wrong: safeProfile.consecutive_wrong,
      longest_correct_streak: safeProfile.longest_correct_streak,
      total_tutor_sessions: safeProfile.total_tutor_sessions,
      total_tutor_messages: safeProfile.total_tutor_messages,
    },
    section_performance: sectionPerformance,
    topic_mastery: (masteries || []).map((m: any) => ({
      topic: m.topic,
      mastery_level: m.mastery_level,
      accuracy_percent: m.accuracy_percent,
      exercises_attempted: m.exercises_attempted,
      current_difficulty: m.current_difficulty,
      highest_difficulty_passed: m.highest_difficulty_passed,
      status: m.status,
    })),
    mental_model: mentalModelSummary,
    error_patterns: {
      grammar_errors: safeJSON(safeProfile.grammar_errors, {}),
      vocab_errors: safeJSON(safeProfile.vocab_errors, {}),
      reading_errors: safeJSON(safeProfile.reading_errors, {}),
      listening_errors: safeJSON(safeProfile.listening_errors, {}),
      most_common_errors: mostCommonErrors,
    },
    srs: {
      total_items: (srStats as any)?.total || 0,
      overdue: (srStats as any)?.overdue || 0,
      mastered: (srStats as any)?.mastered || 0,
      avg_level: Math.round(((srStats as any)?.avg_level || 0) * 10) / 10,
      avg_retention: null,
      items_by_state: (srItems.results || []).map((r: any) => ({
        state: `level_${r.review_level}`,
        count: r.count,
      })),
    },
    activity: {
      last_active: lastActive,
      days_active_last_30: daysActive,
      total_questions_answered: totalQ,
      total_correct: totalCorrect,
      overall_accuracy: totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0,
      daily_trend: dailyData.map((d: any) => ({
        date: d.date,
        questions: d.questions,
        correct: d.correct,
        accuracy: d.questions > 0 ? Math.round((d.correct / d.questions) * 100) : 0,
        messages: d.messages || 0,
      })),
      recent_tests: (recentAttempts.results || []).map((a: any) => ({
        id: a.id,
        section: a.section || 'mixed',
        score: a.score || 0,
        total: a.total_questions || 0,
        date: a.created_at,
      })),
      study_streak: streak,
      total_messages: totalMsgs,
    },
    conversation: {
      total_messages: convStatsData?.total || 0,
      user_messages: convStatsData?.user_msgs || 0,
      topics_discussed: convTopicsData.map((t: any) => ({ topic: t.topic, count: t.count })),
      first_message_at: convStatsData?.first_msg || null,
      last_message_at: convStatsData?.last_msg || null,
      avg_messages_per_active_day: daysActive > 0 ? Math.round((convStatsData?.total || 0) / daysActive) : 0,
    },
    lessons: {
      total_plans: allPlans.length,
      completed: completedPlans.length,
      active_plan: activePlan ? {
        id: (activePlan as any).id,
        title: (activePlan as any).title,
        progress: (activePlan as any).progress_percent || 0,
        current_step: (activePlan as any).current_step,
        total_steps: (activePlan as any).total_steps,
      } : null,
      completed_plans: completedPlans.slice(0, 5).map((p: any) => ({
        id: p.id,
        title: p.title,
        target_skills: safeJSON(p.target_skills, []),
        completed_at: p.completed_at || p.created_at,
      })),
    },
    diagnostic: diagnosticInfo,
    recommendations: {
      priority_skills: prioritySkills,
      suggested_difficulty: suggestedDifficulty,
      suggested_lesson_type: suggestedLessonType,
      next_steps: nextSteps,
      estimated_readiness: readiness,
    },
  };

  return report;
}

// ═══════════════════════════════════════════════════════
// BUILD AI CONTEXT (optimized string for prompts)
// ═══════════════════════════════════════════════════════

/**
 * Build a structured text summary optimized for AI agent consumption.
 * This is what gets injected into the lesson planner's prompt so it can
 * make informed decisions about what to teach and how.
 */
export async function buildStudentReportForAI(env: Env, userId: number): Promise<string> {
  const report = await buildStudentReport(env, userId);
  if (!report) return 'STUDENT NOT FOUND.';

  const lines: string[] = [];

  // ── Header ──
  lines.push(`=== STUDENT INTELLIGENCE REPORT ===`);
  lines.push(`Name: ${report.student.name} | Target: ${report.student.target_test || 'Not set'} | Level: ${report.student.proficiency_level || 'Unknown'}`);
  lines.push(`Days on platform: ${report.student.days_since_signup} | Premium: ${report.student.is_premium ? 'Yes' : 'No'}`);
  lines.push('');

  // ── Learning Preferences ──
  lines.push(`LEARNING PREFERENCES:`);
  lines.push(`  Style: ${report.preferences.learning_style || 'Not set'} | Communication: ${report.preferences.communication_style || 'Not set'} | Depth: ${report.preferences.depth_level || 'intermediate'}`);
  if (report.preferences.personality_notes) {
    lines.push(`  Notes: ${report.preferences.personality_notes}`);
  }
  lines.push('');

  // ── Cognitive State ──
  lines.push(`COGNITIVE STATE:`);
  lines.push(`  Pace: ${report.cognitive.learning_pace} | Confidence: ${Math.round(report.cognitive.confidence_score * 100)}% | Frustration: ${Math.round(report.cognitive.frustration_score * 100)}%`);
  lines.push(`  Engagement: ${report.cognitive.engagement_level} | Response time: ${Math.round(report.cognitive.avg_response_time_sec)}s avg`);
  if (report.cognitive.consecutive_wrong >= 3) {
    lines.push(`  ⚠️ STRUGGLING: ${report.cognitive.consecutive_wrong} wrong in a row — lower difficulty, provide more scaffolding`);
  }
  if (report.cognitive.consecutive_correct >= 5) {
    lines.push(`  ✨ ON FIRE: ${report.cognitive.consecutive_correct} correct streak — challenge them more`);
  }
  lines.push('');

  // ── Section Performance ──
  if (report.section_performance.length > 0) {
    lines.push(`SECTION PERFORMANCE:`);
    for (const s of report.section_performance) {
      const trendIcon = s.trend === 'improving' ? '📈' : s.trend === 'declining' ? '📉' : s.trend === 'new' ? '🆕' : '➡️';
      lines.push(`  ${trendIcon} ${s.section}: ${s.accuracy}% accuracy (${s.total_questions}Q, avg difficulty ${s.avg_difficulty})`);
    }
    lines.push('');
  }

  // ── Weakest Topics (most actionable for lesson planning) ──
  const weakTopics = report.topic_mastery.filter(m => m.accuracy_percent < 60 && m.exercises_attempted >= 3);
  if (weakTopics.length > 0) {
    lines.push(`WEAK TOPICS (priority for lessons):`);
    for (const t of weakTopics.slice(0, 8)) {
      lines.push(`  🔴 ${t.topic}: ${t.accuracy_percent}% acc, mastery ${t.mastery_level}%, difficulty ${t.current_difficulty}, ${t.exercises_attempted} attempts`);
    }
    lines.push('');
  }

  // ── Strong Topics ──
  const strongTopics = report.topic_mastery.filter(m => m.mastery_level >= 70);
  if (strongTopics.length > 0) {
    lines.push(`STRONG TOPICS (skip or use as bridges):`);
    lines.push(`  ${strongTopics.map(t => t.topic).join(', ')}`);
    lines.push('');
  }

  // ── Mental Model (what the tutor believes) ──
  if (report.mental_model.total_concepts > 0) {
    lines.push(`MENTAL MODEL (${report.mental_model.total_concepts} concepts assessed):`);
    if (report.mental_model.misconceptions.length > 0) {
      lines.push(`  🚫 MISCONCEPTIONS (fix first!):`);
      for (const m of report.mental_model.misconceptions) {
        lines.push(`    - ${m.concept}${m.details.length > 0 ? `: "${m.details[0]}"` : ''}`);
      }
    }
    if (report.mental_model.knowledge_gaps.length > 0) {
      lines.push(`  ❓ GAPS: ${report.mental_model.knowledge_gaps.join(', ')}`);
    }
    if (report.mental_model.partial_understanding.length > 0) {
      lines.push(`  🟡 PARTIAL: ${report.mental_model.partial_understanding.join(', ')}`);
    }
    if (report.mental_model.mastered.length > 0) {
      lines.push(`  ✅ MASTERED: ${report.mental_model.mastered.join(', ')}`);
    }
    lines.push('');
  }

  // ── Error Patterns ──
  if (report.error_patterns.most_common_errors.length > 0) {
    lines.push(`ERROR PATTERNS (recurring mistakes):`);
    for (const e of report.error_patterns.most_common_errors.slice(0, 5)) {
      lines.push(`  - ${e.category}: ${e.count}x`);
    }
    lines.push('');
  }

  // ── SRS Status ──
  if (report.srs.total_items > 0) {
    lines.push(`SPACED REPETITION:`);
    lines.push(`  Total: ${report.srs.total_items} | Overdue: ${report.srs.overdue} | Mastered: ${report.srs.mastered} | Avg level: ${report.srs.avg_level}`);
    if (report.srs.overdue > 5) {
      lines.push(`  ⚠️ ${report.srs.overdue} items overdue — consider review session before new material`);
    }
    lines.push('');
  }

  // ── Activity ──
  lines.push(`ACTIVITY (last 30 days):`);
  lines.push(`  Days active: ${report.activity.days_active_last_30}/30 | Streak: ${report.activity.study_streak} days`);
  lines.push(`  Questions: ${report.activity.total_questions_answered} | Accuracy: ${report.activity.overall_accuracy}%`);
  lines.push(`  Bot messages: ${report.activity.total_messages} | Last active: ${report.activity.last_active || 'Unknown'}`);
  if (report.activity.days_active_last_30 < 5) {
    lines.push(`  ⚠️ LOW ACTIVITY — keep lessons short and engaging to rebuild habit`);
  }
  lines.push('');

  // ── Conversation Analysis ──
  if (report.conversation.total_messages > 0) {
    lines.push(`CONVERSATION ANALYSIS:`);
    lines.push(`  Total messages: ${report.conversation.total_messages} (${report.conversation.user_messages} from student)`);
    lines.push(`  First contact: ${report.conversation.first_message_at || 'Unknown'} | Last: ${report.conversation.last_message_at || 'Unknown'}`);
    lines.push(`  Avg messages/active day: ${report.conversation.avg_messages_per_active_day}`);
    if (report.conversation.topics_discussed.length > 0) {
      lines.push(`  Topics discussed: ${report.conversation.topics_discussed.map(t => `${t.topic}(${t.count})`).join(', ')}`);
    }
    lines.push('');
  }

  // ── Lesson History ──
  if (report.lessons.total_plans > 0) {
    lines.push(`LESSON HISTORY:`);
    lines.push(`  Plans: ${report.lessons.total_plans} total, ${report.lessons.completed} completed`);
    if (report.lessons.active_plan) {
      lines.push(`  📌 Active: "${report.lessons.active_plan.title}" — step ${report.lessons.active_plan.current_step + 1}/${report.lessons.active_plan.total_steps} (${report.lessons.active_plan.progress}%)`);
    }
    if (report.lessons.completed_plans.length > 0) {
      const recentSkills = report.lessons.completed_plans.flatMap(p => p.target_skills);
      lines.push(`  Recently covered: ${[...new Set(recentSkills)].slice(0, 8).join(', ')}`);
    }
    lines.push('');
  }

  // ── Diagnostic ──
  if (report.diagnostic.has_taken) {
    lines.push(`DIAGNOSTIC TEST:`);
    lines.push(`  Score: ${report.diagnostic.score} | Placed at: ${report.diagnostic.level_placed} | Date: ${report.diagnostic.date}`);
    lines.push('');
  }

  // ── AI Recommendations ──
  lines.push(`=== RECOMMENDATIONS ===`);
  lines.push(`Priority skills: ${report.recommendations.priority_skills.join(', ')}`);
  lines.push(`Suggested difficulty: ${report.recommendations.suggested_difficulty}/5`);
  lines.push(`Lesson type: ${report.recommendations.suggested_lesson_type}`);
  lines.push(`Next steps:`);
  for (const step of report.recommendations.next_steps) {
    lines.push(`  → ${step}`);
  }

  if (Object.keys(report.recommendations.estimated_readiness).length > 0) {
    lines.push(`Section readiness for ${report.student.target_test || 'exam'}:`);
    for (const [section, pct] of Object.entries(report.recommendations.estimated_readiness)) {
      const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
      lines.push(`  ${section}: [${bar}] ${pct}%`);
    }
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════
// RECOMMENDATION ENGINE
// ═══════════════════════════════════════════════════════

function computePrioritySkills(
  masteries: TopicMastery[],
  mentalModel: ConceptModel[],
  profile: StudentProfile,
): string[] {
  const skills: { name: string; score: number }[] = [];

  // Misconceptions = highest priority
  for (const m of mentalModel) {
    if (m.believed_understanding === 'misconception') {
      skills.push({ name: m.concept, score: 100 });
    }
  }

  // Weak topics with enough data
  for (const m of masteries) {
    if (m.accuracy_percent < 50 && m.exercises_attempted >= 3) {
      skills.push({ name: m.topic, score: 80 - m.accuracy_percent });
    }
  }

  // Partial mental model concepts
  for (const m of mentalModel) {
    if (m.believed_understanding === 'partial') {
      skills.push({ name: m.concept, score: 50 });
    }
  }

  // Error pattern targets
  const allErrors = {
    ...(typeof profile.grammar_errors === 'object' ? profile.grammar_errors : {}),
    ...(typeof profile.vocab_errors === 'object' ? profile.vocab_errors : {}),
  };
  for (const [cat, count] of Object.entries(allErrors)) {
    if ((count as number) >= 3) {
      skills.push({ name: cat, score: 40 + (count as number) });
    }
  }

  skills.sort((a, b) => b.score - a.score);
  return [...new Set(skills.map(s => s.name))].slice(0, 8);
}

function computeSuggestedDifficulty(profile: StudentProfile, masteries: TopicMastery[]): number {
  // Base from overall accuracy
  const avgAccuracy = masteries.length > 0
    ? masteries.reduce((s, m) => s + m.accuracy_percent, 0) / masteries.length
    : 50;

  let diff = 3;
  if (avgAccuracy >= 80) diff = 4;
  if (avgAccuracy >= 90) diff = 5;
  if (avgAccuracy < 40) diff = 2;
  if (avgAccuracy < 25) diff = 1;

  // Adjust for emotional state
  if (profile.frustration_score > 0.6) diff = Math.max(1, diff - 1);
  if (profile.confidence_score > 0.8 && profile.consecutive_correct >= 3) diff = Math.min(5, diff + 1);

  return diff;
}

function computeLessonType(
  profile: StudentProfile,
  masteries: TopicMastery[],
  mentalModel: ConceptModel[],
  completedPlans: any[],
): string {
  const misconceptions = mentalModel.filter(m => m.believed_understanding === 'misconception');
  if (misconceptions.length >= 3) return 'misconception_fix — focus on correcting false beliefs';
  if (profile.frustration_score > 0.6) return 'confidence_builder — easy wins first, then gradual challenge';
  if (profile.consecutive_correct >= 5) return 'challenge — push to next difficulty level';

  const weakCount = masteries.filter(m => m.accuracy_percent < 50).length;
  const strongCount = masteries.filter(m => m.mastery_level >= 70).length;

  if (weakCount > strongCount) return 'weakness_drill — targeted practice on weak areas';
  if (completedPlans.length === 0) return 'diagnostic_follow_up — structured introduction to key skills';
  return 'balanced — mix of review and new material';
}

function computeNextSteps(
  profile: StudentProfile,
  masteries: TopicMastery[],
  mentalModel: ConceptModel[],
  sectionPerf: any[],
  srStats: any,
  completedPlans: any[],
): string[] {
  const steps: string[] = [];

  // Overdue reviews
  if (srStats?.overdue > 5) {
    steps.push(`Clear ${srStats.overdue} overdue SRS items before adding new material`);
  }

  // Misconceptions
  const misconceptions = mentalModel.filter(m => m.believed_understanding === 'misconception');
  if (misconceptions.length > 0) {
    steps.push(`Fix misconceptions: ${misconceptions.map(m => m.concept).slice(0, 3).join(', ')}`);
  }

  // Weakest section
  const weakestSection = sectionPerf.sort((a: any, b: any) => a.accuracy - b.accuracy)[0];
  if (weakestSection && weakestSection.accuracy < 60) {
    steps.push(`Focus on ${weakestSection.section} section (${weakestSection.accuracy}% accuracy)`);
  }

  // Frustration management
  if (profile.frustration_score > 0.6) {
    steps.push('Lower difficulty and provide more scaffolding — student is frustrated');
  }

  // Low activity
  if (profile.engagement_level === 'low') {
    steps.push('Use gamification and short sessions to rebuild engagement');
  }

  // Suggest next topic based on prerequisites
  const masteredTopics = new Set(masteries.filter(m => m.mastery_level >= 60).map(m => m.topic));
  const weakTopics = masteries.filter(m => m.accuracy_percent < 50 && m.exercises_attempted >= 3);
  if (weakTopics.length > 0) {
    steps.push(`Drill weak topics: ${weakTopics.slice(0, 3).map(t => t.topic).join(', ')}`);
  }

  if (steps.length === 0) {
    steps.push('Student is progressing well — continue current pace with gradual difficulty increase');
  }

  return steps;
}

function computeReadiness(
  masteries: TopicMastery[],
  sectionPerf: any[],
  targetTest: string | null,
): Record<string, number> {
  const readiness: Record<string, number> = {};

  for (const s of sectionPerf) {
    readiness[s.section] = Math.min(100, Math.round(s.accuracy * 0.6 + Math.min(s.total_questions, 50) * 0.8));
  }

  // Add sections with no data
  const expectedSections = targetTest === 'IELTS'
    ? ['reading', 'listening', 'speaking', 'writing']
    : ['reading', 'listening', 'speaking', 'writing'];

  for (const section of expectedSections) {
    if (!readiness[section]) readiness[section] = 0;
  }

  return readiness;
}

// ═══════════════════════════════════════════════════════

function safeJSON(val: any, fallback: any): any {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}
