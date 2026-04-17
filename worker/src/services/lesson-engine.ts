/**
 * Adaptive Lesson Engine — Guided Learning System
 *
 * Inspired by DeepTutor's LocateAgent: analyzes student's knowledge gaps,
 * organizes concepts in progressive relationships, and generates
 * structured lesson plans (3-7 steps) personalized to each student.
 *
 * Two modes:
 * 1. PERSONALIZED — AI-generated plan based on individual weaknesses
 * 2. CLASSROOM — Teacher-triggered plan for a group with mixed levels
 */

import type { Env, User } from '../types';
import { getStudentProfile, getAllTopicMasteries, type StudentProfile, type TopicMastery } from './student-profile';
import { getKnowledgeGaps, buildMentalModelContext, CONCEPT_MAP, type ConceptModel } from './mental-model';
import { buildStudentReportForAI, buildStudentReport } from './student-report';
import { checkPrerequisites } from './prerequisites';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface LessonPlan {
  id?: number;
  user_id: number;
  title: string;
  description: string;
  plan_type: 'personalized' | 'classroom' | 'diagnostic_follow_up' | 'weakness_drill';
  target_skills: string[];
  lessons: LessonStep[];
  current_step: number;
  total_steps: number;
  status: 'active' | 'completed' | 'paused' | 'expired';
  difficulty_level: number;
  estimated_minutes: number;
  progress_percent: number;
  class_id: number | null;
}

export interface LessonStep {
  index: number;
  type: 'explanation' | 'exercise' | 'quiz' | 'discussion' | 'reflection';
  title: string;
  content: string;           // The lesson content or prompt
  skill: string;             // Target skill/concept
  difficulty: number;        // 1-5
  expected_minutes: number;
  hints?: string[];
  success_criteria?: string;
  completed?: boolean;
  score?: number;
}

// ═══════════════════════════════════════════════════════
// SKILL DEPENDENCY TREE — Prerequisites
// ═══════════════════════════════════════════════════════
const SKILL_PREREQUISITES: Record<string, string[]> = {
  // Grammar chain
  'present_perfect': ['simple_past', 'simple_present'],
  'present_perfect_continuous': ['present_perfect', 'present_continuous'],
  'past_perfect': ['simple_past', 'present_perfect'],
  'tense_sequence_in_reported_speech': ['past_perfect', 'present_perfect'],
  'mixed_conditionals': ['second_conditional', 'third_conditional'],
  'third_conditional': ['past_perfect', 'second_conditional'],
  'second_conditional': ['first_conditional', 'simple_past'],
  'first_conditional': ['zero_conditional', 'future_forms'],
  'reduced_relative': ['defining_relative', 'non_defining_relative'],
  'passive_with_modals': ['basic_passive'],
  'passive_reporting_verbs': ['basic_passive'],

  // Reading chain
  'inference': ['topic_sentence_identification', 'distinguishing_main_from_detail'],
  'negative_factual': ['scanning', 'detail_listening'],
  'insert_text': ['reference_questions', 'topic_sentence_identification'],
  'vocabulary_in_context': ['context_clues', 'word_families'],

  // Writing chain
  'counter_argument': ['thesis_statement', 'paragraph_development'],
  'independent_essay_structure': ['thesis_statement', 'paragraph_development'],
  'integrated_writing_structure': ['summary_skills', 'paragraph_development'],

  // Speaking chain
  'integrated_speaking_structure': ['independent_speaking_structure', 'note_taking_for_speaking'],
};

// ═══════════════════════════════════════════════════════
// GENERATE PERSONALIZED LESSON PLAN
// ═══════════════════════════════════════════════════════

/**
 * Generate a personalized lesson plan based on student's current state.
 * Uses knowledge gaps, prerequisites, and learning preferences.
 */
export async function generatePersonalizedPlan(
  env: Env,
  user: User,
  focusArea?: string, // Optional: force focus on specific area
): Promise<LessonPlan> {
  // Build full student intelligence report for informed planning
  const report = await buildStudentReport(env, user.id);
  const profile = await getStudentProfile(env, user.id);
  const masteries = await getAllTopicMasteries(env, user.id);
  const gaps = await getKnowledgeGaps(env, user.id);

  // Determine target skills — use report recommendations if available
  let targetSkills: string[];
  if (focusArea) {
    targetSkills = getSkillsForArea(focusArea);
  } else if (report?.recommendations.priority_skills.length) {
    targetSkills = report.recommendations.priority_skills.slice(0, 5);
  } else {
    targetSkills = identifyHighPrioritySkills(profile, masteries, gaps);
  }

  // Enforce prerequisites: if a target skill's prereqs aren't mastered,
  // inject the missing prereqs into the plan first. Without this, a student
  // assigned "complex_clauses" without "simple_past" would hit lessons they
  // can't follow.
  const skillSet = new Set(targetSkills);
  for (const skill of [...targetSkills]) {
    try {
      const check = await checkPrerequisites(env, user.id, skill);
      if (!check.ready) {
        for (const missing of check.missing) {
          if (!skillSet.has(missing)) {
            skillSet.add(missing);
          }
        }
      }
    } catch (e) { console.error('Prerequisite check failed for', skill, e); }
  }
  targetSkills = Array.from(skillSet);

  // Order by prerequisites (topo sort now covers injected prereqs too)
  const orderedSkills = topologicalSort(targetSkills);

  // Use report's suggested difficulty, or compute from depth level
  const baseDifficulty = report?.recommendations.suggested_difficulty
    ?? depthToBaseDifficulty(await getStudentDepthLevel(env, user.id));

  // Generate lesson steps — enriched with report context
  const lessons = generateLessonSteps(orderedSkills, profile, baseDifficulty, masteries, report);

  // Build description using report intelligence
  const lessonType = report?.recommendations.suggested_lesson_type || 'personalized';
  const description = report
    ? buildSmartPlanDescription(orderedSkills, profile, report)
    : buildPlanDescription(orderedSkills, profile);

  const plan: LessonPlan = {
    user_id: user.id,
    title: focusArea
      ? `Lesson: ${formatTopicName(focusArea)}`
      : `Personalized Plan — ${formatTopicName(orderedSkills[0] || 'review')}`,
    description,
    plan_type: 'personalized',
    target_skills: orderedSkills,
    lessons,
    current_step: 0,
    total_steps: lessons.length,
    status: 'active',
    difficulty_level: baseDifficulty,
    estimated_minutes: lessons.reduce((sum, l) => sum + l.expected_minutes, 0),
    progress_percent: 0,
    class_id: null,
  };

  // Save to DB
  const result = await env.DB.prepare(
    `INSERT INTO lesson_plans (user_id, title, description, plan_type, target_skills, lessons, current_step, total_steps, status, difficulty_level, estimated_minutes, progress_percent, class_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    plan.user_id, plan.title, plan.description, plan.plan_type,
    JSON.stringify(plan.target_skills), JSON.stringify(plan.lessons),
    plan.current_step, plan.total_steps, plan.status,
    plan.difficulty_level, plan.estimated_minutes, plan.progress_percent, plan.class_id,
  ).run();

  plan.id = result.meta?.last_row_id as number;
  return plan;
}

/**
 * Generate a classroom lesson plan for a class with mixed skill levels.
 */
export async function generateClassroomPlan(
  env: Env,
  classId: number,
  topic: string,
  teacherId: number,
): Promise<LessonPlan> {
  // Get all students in the class
  const members = await env.DB.prepare(
    'SELECT user_id FROM class_enrollments WHERE class_id = ?'
  ).bind(classId).all();

  const studentIds = (members.results || []).map((m: any) => m.user_id);

  // Analyze class-wide skill levels for this topic
  let totalMastery = 0;
  let count = 0;
  const weakestConcepts: string[] = [];

  for (const studentId of studentIds) {
    const masteries = await getAllTopicMasteries(env, studentId);
    const relevant = masteries.find(m => m.topic === topic);
    if (relevant) {
      totalMastery += relevant.mastery_level;
      count++;
    }
  }

  const avgMastery = count > 0 ? totalMastery / count : 0;
  const classDifficulty = avgMastery > 70 ? 4 : avgMastery > 40 ? 3 : 2;

  // Get sub-concepts for this topic
  const topicConcepts = CONCEPT_MAP[topic] || [topic];

  // Generate mixed-level lesson with scaffolding
  const lessons: LessonStep[] = [
    {
      index: 0,
      type: 'explanation',
      title: `Review: ${formatTopicName(topic)}`,
      content: `Berikan penjelasan singkat tentang ${formatTopicName(topic)} yang cocok untuk level kelas (avg mastery: ${Math.round(avgMastery)}%). Sertakan 2-3 contoh real-life. Jika banyak yang sudah paham, fokus ke aspek advanced.`,
      skill: topic,
      difficulty: classDifficulty,
      expected_minutes: 5,
    },
    {
      index: 1,
      type: 'exercise',
      title: 'Warm-up Exercise',
      content: `Buat 3 soal warm-up tentang ${formatTopicName(topic)} dengan difficulty bertingkat: 1 mudah (untuk yang masih belajar), 1 sedang, 1 challenging (untuk yang sudah paham). Format MCQ.`,
      skill: topic,
      difficulty: classDifficulty,
      expected_minutes: 5,
    },
    ...topicConcepts.slice(0, 3).map((concept, i) => ({
      index: i + 2,
      type: 'exercise' as const,
      title: `Drill: ${formatTopicName(concept)}`,
      content: `Buat 2 soal tentang ${formatTopicName(concept)}. Sertakan hint untuk yang kesulitan.`,
      skill: concept,
      difficulty: classDifficulty + (i > 1 ? 1 : 0),
      expected_minutes: 4,
    })),
    {
      index: topicConcepts.slice(0, 3).length + 2,
      type: 'quiz',
      title: 'Class Quiz Challenge',
      content: `Buat 5 soal quiz kompetitif tentang ${formatTopicName(topic)}. Mix difficulty. Soal harus bisa dijawab dalam 30 detik. Format: soal + 4 pilihan + jawaban benar.`,
      skill: topic,
      difficulty: classDifficulty,
      expected_minutes: 8,
    },
    {
      index: topicConcepts.slice(0, 3).length + 3,
      type: 'reflection',
      title: 'Wrap-up & Takeaways',
      content: `Buat 3 key takeaways dari pelajaran ${formatTopicName(topic)} ini. Sertakan 1 tip praktis untuk latihan mandiri.`,
      skill: topic,
      difficulty: classDifficulty,
      expected_minutes: 3,
    },
  ];

  const plan: LessonPlan = {
    user_id: teacherId,
    title: `Classroom: ${formatTopicName(topic)}`,
    description: `Lesson plan untuk kelas (${studentIds.length} siswa, avg mastery: ${Math.round(avgMastery)}%)`,
    plan_type: 'classroom',
    target_skills: topicConcepts,
    lessons,
    current_step: 0,
    total_steps: lessons.length,
    status: 'active',
    difficulty_level: classDifficulty,
    estimated_minutes: lessons.reduce((sum, l) => sum + l.expected_minutes, 0),
    progress_percent: 0,
    class_id: classId,
  };

  const result = await env.DB.prepare(
    `INSERT INTO lesson_plans (user_id, title, description, plan_type, target_skills, lessons, current_step, total_steps, status, difficulty_level, estimated_minutes, progress_percent, class_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    plan.user_id, plan.title, plan.description, plan.plan_type,
    JSON.stringify(plan.target_skills), JSON.stringify(plan.lessons),
    plan.current_step, plan.total_steps, plan.status,
    plan.difficulty_level, plan.estimated_minutes, plan.progress_percent, plan.class_id,
  ).run();

  plan.id = result.meta?.last_row_id as number;
  return plan;
}

/**
 * Get the current active lesson plan for a user.
 */
export async function getActivePlan(env: Env, userId: number): Promise<LessonPlan | null> {
  const row = await env.DB.prepare(
    `SELECT * FROM lesson_plans WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`
  ).bind(userId).first() as any;

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    plan_type: row.plan_type,
    target_skills: safeJSON(row.target_skills, []),
    lessons: safeJSON(row.lessons, []),
    current_step: row.current_step,
    total_steps: row.total_steps,
    status: row.status,
    difficulty_level: row.difficulty_level,
    estimated_minutes: row.estimated_minutes,
    progress_percent: row.progress_percent,
    class_id: row.class_id,
  };
}

/**
 * Advance to the next step in a lesson plan.
 */
export async function advanceLessonStep(
  env: Env,
  planId: number,
  userId: number,
  stepResult?: { score?: number; time_spent_sec?: number; response_data?: string; feedback?: string },
): Promise<LessonPlan | null> {
  const plan = await env.DB.prepare('SELECT * FROM lesson_plans WHERE id = ? AND user_id = ?').bind(planId, userId).first() as any;
  if (!plan) return null;

  const lessons: LessonStep[] = safeJSON(plan.lessons, []);

  // Mark current step as completed
  if (plan.current_step < lessons.length) {
    lessons[plan.current_step].completed = true;
    if (stepResult?.score !== undefined) {
      lessons[plan.current_step].score = stepResult.score;
    }

    // Save step result
    if (stepResult) {
      await env.DB.prepare(
        `INSERT INTO lesson_step_results (lesson_plan_id, user_id, step_index, step_type, score, time_spent_sec, response_data, feedback)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        planId, userId, plan.current_step,
        lessons[plan.current_step].type,
        stepResult.score || null,
        stepResult.time_spent_sec || 0,
        stepResult.response_data || null,
        stepResult.feedback || null,
      ).run();
    }
  }

  const newStep = plan.current_step + 1;
  const progress = Math.round((newStep / lessons.length) * 100);
  const isComplete = newStep >= lessons.length;

  await env.DB.prepare(
    `UPDATE lesson_plans SET
       current_step = ?, lessons = ?, progress_percent = ?,
       status = ?, ${isComplete ? "completed_at = datetime('now')," : ''} updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    newStep, JSON.stringify(lessons), progress,
    isComplete ? 'completed' : 'active', planId,
  ).run();

  return {
    id: planId,
    user_id: userId,
    title: plan.title,
    description: plan.description,
    plan_type: plan.plan_type,
    target_skills: safeJSON(plan.target_skills, []),
    lessons,
    current_step: newStep,
    total_steps: lessons.length,
    status: isComplete ? 'completed' : 'active',
    difficulty_level: plan.difficulty_level,
    estimated_minutes: plan.estimated_minutes,
    progress_percent: progress,
    class_id: plan.class_id,
  };
}

/**
 * Format a lesson step into a Telegram message for the student.
 */
export function formatLessonStepMessage(plan: LessonPlan, step: LessonStep): string {
  const stepIcon = {
    explanation: '📖',
    exercise: '✏️',
    quiz: '🧪',
    discussion: '💬',
    reflection: '🪞',
  }[step.type];

  const progressBar = buildProgressBar(plan.progress_percent);

  let msg = `${stepIcon} *${plan.title}*\n`;
  msg += `Step ${step.index + 1}/${plan.total_steps} ${progressBar}\n\n`;
  msg += `*${step.title}*\n\n`;

  // The actual content will be AI-generated based on the step.content prompt
  // This function just frames it

  if (step.hints && step.hints.length > 0) {
    msg += `\nHint: ${step.hints[0]}`;
  }

  if (step.expected_minutes > 0) {
    msg += `\n(${step.expected_minutes} menit)`;
  }

  return msg;
}

// ═══════════════════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════════════════

function identifyHighPrioritySkills(
  profile: StudentProfile,
  masteries: TopicMastery[],
  gaps: ConceptModel[],
): string[] {
  const skills: { name: string; priority: number }[] = [];

  // 1. Misconceptions get highest priority
  for (const gap of gaps) {
    if (gap.believed_understanding === 'misconception') {
      skills.push({ name: gap.concept, priority: 100 });
    }
  }

  // 2. Weak masteries
  for (const m of masteries) {
    if (m.accuracy_percent < 50 && m.exercises_attempted >= 3) {
      skills.push({ name: m.topic, priority: 80 - m.accuracy_percent });
    }
  }

  // 3. Partial understanding concepts
  for (const gap of gaps) {
    if (gap.believed_understanding === 'partial') {
      skills.push({ name: gap.concept, priority: 50 });
    }
  }

  // 4. Never-started topics with satisfied prerequisites
  const knownTopics = new Set(masteries.map(m => m.topic));
  for (const [topic] of Object.entries(CONCEPT_MAP)) {
    if (!knownTopics.has(topic)) {
      const prereqs = SKILL_PREREQUISITES[topic] || [];
      const allPrereqsMet = prereqs.every(p =>
        masteries.some(m => m.topic === p && m.mastery_level >= 50)
      );
      if (allPrereqsMet || prereqs.length === 0) {
        skills.push({ name: topic, priority: 30 });
      }
    }
  }

  // Sort by priority and take top 5
  skills.sort((a, b) => b.priority - a.priority);
  return [...new Set(skills.slice(0, 5).map(s => s.name))];
}

function getSkillsForArea(area: string): string[] {
  return CONCEPT_MAP[area] || [area];
}

function topologicalSort(skills: string[]): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();

  function visit(skill: string) {
    if (visited.has(skill)) return;
    visited.add(skill);
    const prereqs = SKILL_PREREQUISITES[skill] || [];
    for (const prereq of prereqs) {
      if (skills.includes(prereq)) {
        visit(prereq);
      }
    }
    sorted.push(skill);
  }

  for (const skill of skills) {
    visit(skill);
  }

  return sorted;
}

function generateLessonSteps(
  skills: string[],
  profile: StudentProfile,
  baseDifficulty: number,
  masteries: TopicMastery[],
  report?: import('./student-report').StudentReport | null,
): LessonStep[] {
  const steps: LessonStep[] = [];
  let index = 0;

  // Extract report intelligence for richer step content
  const misconceptionSet = new Set(
    (report?.mental_model.misconceptions || []).map(m => m.concept)
  );
  const errorPatterns = (report?.error_patterns.most_common_errors || [])
    .map(e => e.category);
  const pace = report?.cognitive.learning_pace || profile.learning_pace;
  const frustrated = (report?.cognitive.frustration_score ?? profile.frustration_score) > 0.5;
  const streaking = (report?.cognitive.consecutive_correct ?? profile.consecutive_correct) >= 5;

  // Pace-adaptive timing
  const timeMultiplier = pace === 'slow' ? 1.5 : pace === 'fast' ? 0.7 : 1;

  // If student has many overdue SRS items, prepend a review step
  if (report && report.srs.overdue > 5) {
    steps.push({
      index: index++,
      type: 'exercise',
      title: 'Quick Review — Overdue Items',
      content: `Student has ${report.srs.overdue} overdue SRS items. Start with 3-5 quick review questions from previously learned material to warm up and reinforce retention before new content. Target the items closest to being forgotten.`,
      skill: 'review',
      difficulty: Math.max(1, baseDifficulty - 1),
      expected_minutes: Math.round(4 * timeMultiplier),
    });
  }

  for (const skill of skills.slice(0, 4)) {
    const mastery = masteries.find(m => m.topic === skill);
    const skillDifficulty = mastery
      ? Math.min(5, Math.max(1, Math.round(mastery.current_difficulty) || baseDifficulty))
      : baseDifficulty;

    // Build per-skill context from report
    const hasMisconception = misconceptionSet.has(skill);
    const misconceptionDetail = report?.mental_model.misconceptions.find(m => m.concept === skill);
    const relatedErrors = errorPatterns.filter(e => e.includes(skill) || skill.includes(e));
    const sectionPerf = report?.section_performance || [];

    let explainContext = `Mulai dengan pertanyaan Socratic tentang ${formatTopicName(skill)}. Tanyakan apa yang mereka sudah tahu. Kemudian berikan 3 contoh pattern discovery dan biarkan mereka menemukan aturannya sendiri.`;
    let exerciseContext = `Buat 3 soal progressive difficulty tentang ${formatTopicName(skill)}. Mulai dari difficulty ${Math.max(1, skillDifficulty - 1)}, naik ke ${skillDifficulty}, lalu ${Math.min(5, skillDifficulty + 1)}. Kasih feedback setelah tiap jawaban.`;

    // Enrich based on report intelligence
    if (hasMisconception && misconceptionDetail) {
      explainContext = `⚠️ MISCONCEPTION DETECTED: Student believes "${misconceptionDetail.details[0] || 'incorrect rule'}" about ${formatTopicName(skill)}. DO NOT start by telling them they're wrong. Instead, create a cognitive conflict: show examples where their wrong rule fails. Let them discover the contradiction. Then guide to correct understanding through pattern discovery.`;
      exerciseContext = `Create 3 questions specifically designed to test and correct the misconception about ${formatTopicName(skill)}. Include tricky cases where the misconception would lead to wrong answers. After each question, explain WHY the correct answer works and why the misconception fails.`;
    }

    if (frustrated) {
      explainContext += '\n\nSTUDENT IS FRUSTRATED. Keep explanations short and warm. Start with something they CAN do successfully. Build up gradually. Acknowledge their effort.';
      exerciseContext += '\n\nStart with an EASY question for a confidence boost, then gradually increase.';
    }

    if (streaking) {
      explainContext += '\n\nStudent is on a hot streak! Push them with advanced examples. Challenge them.';
      exerciseContext += '\n\nStudent is doing great — skip the easy warm-up. Start at difficulty ' + skillDifficulty + ' and push to ' + Math.min(5, skillDifficulty + 1) + '.';
    }

    if (relatedErrors.length > 0) {
      exerciseContext += `\n\nCommon errors in this area: ${relatedErrors.join(', ')}. Include questions that specifically target these error patterns.`;
    }

    if (report?.preferences.learning_style) {
      const style = report.preferences.learning_style;
      if (style === 'visual') explainContext += '\n\nStudent prefers VISUAL learning. Use diagrams, tables, and color-coded examples.';
      if (style === 'example_based') explainContext += '\n\nStudent learns best from EXAMPLES. Give 5+ examples instead of rules.';
      if (style === 'theoretical') explainContext += '\n\nStudent prefers THEORY first. Give the rule/formula, then show examples.';
      if (style === 'active') explainContext += '\n\nStudent is an ACTIVE learner. Make them do, not just read. Interactive fill-in-the-blank.';
      if (style === 'reflective') explainContext += '\n\nStudent is REFLECTIVE. Give them time to think. Ask "why?" after answers.';
    }

    if (mastery && mastery.accuracy_percent > 0) {
      exerciseContext += `\n\nCurrent stats: ${mastery.accuracy_percent}% accuracy over ${mastery.exercises_attempted} attempts. Highest difficulty passed: ${mastery.highest_difficulty_passed}.`;
    }

    steps.push({
      index: index++,
      type: 'explanation',
      title: `Explore: ${formatTopicName(skill)}`,
      content: explainContext,
      skill,
      difficulty: skillDifficulty,
      expected_minutes: Math.round(5 * timeMultiplier),
    });

    steps.push({
      index: index++,
      type: 'exercise',
      title: `Practice: ${formatTopicName(skill)}`,
      content: exerciseContext,
      skill,
      difficulty: skillDifficulty,
      expected_minutes: Math.round(5 * timeMultiplier),
      hints: frustrated
        ? ['Take your time! Eliminasi pilihan yang paling impossible dulu.', 'Ingat pattern yang baru dipelajari tadi.']
        : ['Kalau ragu, coba eliminasi pilihan yang paling impossible dulu.'],
    });
  }

  // Final step: Mini-quiz covering all skills
  if (skills.length > 1) {
    let quizContext = `Buat 5 soal yang menggabungkan semua skill: ${skills.map(formatTopicName).join(', ')}. Mix difficulty.`;
    if (frustrated) {
      quizContext += ' Make 3 easy and 2 medium. Focus on building confidence.';
    } else if (streaking) {
      quizContext += ' Make it challenging! 2 medium, 3 hard. Gamification: "Bisa perfect 5/5? Buktikan!"';
    } else {
      quizContext += ' Gamification: "Bisa perfect 5/5? Buktikan!"';
    }

    steps.push({
      index: index++,
      type: 'quiz',
      title: 'Challenge Round',
      content: quizContext,
      skill: skills.join(','),
      difficulty: baseDifficulty,
      expected_minutes: Math.round(6 * timeMultiplier),
      success_criteria: '80% correct to complete this plan',
    });
  }

  // Reflection step — also informed by report
  let reflectContent = `Rangkum apa yang dipelajari hari ini tentang ${skills.map(formatTopicName).join(', ')}. Highlight 3 key takeaways. Kasih 1 real-life application tip.`;
  if (report?.recommendations.priority_skills.length) {
    const nextSkills = report.recommendations.priority_skills
      .filter(s => !skills.includes(s)).slice(0, 2);
    if (nextSkills.length > 0) {
      reflectContent += ` Suggested next topics: ${nextSkills.map(formatTopicName).join(', ')}.`;
    }
  }

  steps.push({
    index: index++,
    type: 'reflection',
    title: 'Lesson Recap',
    content: reflectContent,
    skill: skills.join(','),
    difficulty: baseDifficulty,
    expected_minutes: Math.round(3 * timeMultiplier),
  });

  return steps;
}

async function getStudentDepthLevel(env: Env, userId: number): Promise<string> {
  const row = await env.DB.prepare(
    'SELECT depth_level FROM student_profiles WHERE user_id = ?'
  ).bind(userId).first() as any;
  return row?.depth_level || 'intermediate';
}

function depthToBaseDifficulty(depth: string): number {
  const map: Record<string, number> = {
    beginner: 1,
    elementary: 2,
    intermediate: 3,
    advanced: 4,
    expert: 5,
  };
  return map[depth] || 3;
}

function buildPlanDescription(skills: string[], profile: StudentProfile): string {
  const skillNames = skills.map(formatTopicName).join(', ');
  return `Fokus: ${skillNames}. Disesuaikan untuk pace ${profile.learning_pace}, confidence ${Math.round(profile.confidence_score * 100)}%.`;
}

function buildSmartPlanDescription(
  skills: string[],
  profile: StudentProfile,
  report: import('./student-report').StudentReport,
): string {
  const parts: string[] = [];
  parts.push(`Fokus: ${skills.map(formatTopicName).join(', ')}`);

  // Why these skills?
  const misconceptions = report.mental_model.misconceptions.filter(m => skills.includes(m.concept));
  if (misconceptions.length > 0) {
    parts.push(`Fixing ${misconceptions.length} misconception(s)`);
  }

  // Student state
  parts.push(`Pace: ${profile.learning_pace}`);
  if (report.cognitive.frustration_score > 0.5) {
    parts.push('Mode: confidence builder');
  } else if (report.cognitive.consecutive_correct >= 5) {
    parts.push('Mode: challenge');
  }

  // Activity context
  if (report.activity.study_streak > 0) {
    parts.push(`Streak: ${report.activity.study_streak} days`);
  }
  if (report.srs.overdue > 5) {
    parts.push(`${report.srs.overdue} SRS items overdue`);
  }

  return parts.join(' | ');
}

function buildProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + '] ' + percent + '%';
}

export function formatTopicName(topic: string): string {
  return topic
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function safeJSON(val: any, fallback: any): any {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}
