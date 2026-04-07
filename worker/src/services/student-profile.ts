/**
 * Student Cognitive Profile — Living Model of Each Student
 *
 * Tracks behavior, weaknesses, learning pace, emotional signals,
 * and provides adaptive context to the tutor engine.
 */

import type { Env, User } from '../types';

export interface StudentProfile {
  user_id: number;
  learning_pace: 'slow' | 'normal' | 'fast';
  avg_response_time_sec: number;
  preferred_study_time: string | null;
  avg_session_minutes: number;
  frustration_score: number;
  confidence_score: number;
  engagement_level: 'low' | 'moderate' | 'high' | 'very_high';
  consecutive_correct: number;
  consecutive_wrong: number;
  longest_correct_streak: number;
  grammar_errors: Record<string, number>;
  vocab_errors: Record<string, number>;
  reading_errors: Record<string, number>;
  listening_errors: Record<string, number>;
  skill_mastery: Record<string, number>;
  current_topic: string | null;
  current_lesson_step: number;
  tutor_mode: 'lesson' | 'exercise' | 'review' | 'free_chat';
  socratic_depth: number;
  exercises_in_current_topic: number;
  correct_in_current_topic: number;
  topics_completed: string[];
  topics_in_progress: string[];
  total_tutor_sessions: number;
  total_tutor_messages: number;
  last_tutor_topic: string | null;
  last_interaction_at: string | null;
}

export interface TopicMastery {
  topic: string;
  mastery_level: number;
  exercises_attempted: number;
  exercises_correct: number;
  accuracy_percent: number;
  current_difficulty: number;
  highest_difficulty_passed: number;
  status: 'not_started' | 'learning' | 'practicing' | 'mastered' | 'needs_review';
  next_review_at: string | null;
}

// ── Get or create student profile ──
export async function getStudentProfile(env: Env, userId: number): Promise<StudentProfile> {
  const row = await env.DB.prepare(
    'SELECT * FROM student_profiles WHERE user_id = ?'
  ).bind(userId).first() as any;

  if (row) {
    return {
      ...row,
      grammar_errors: safeParseJSON(row.grammar_errors, {}),
      vocab_errors: safeParseJSON(row.vocab_errors, {}),
      reading_errors: safeParseJSON(row.reading_errors, {}),
      listening_errors: safeParseJSON(row.listening_errors, {}),
      skill_mastery: safeParseJSON(row.skill_mastery, {}),
      topics_completed: safeParseJSON(row.topics_completed, []),
      topics_in_progress: safeParseJSON(row.topics_in_progress, []),
    };
  }

  // Create new profile
  await env.DB.prepare(
    'INSERT OR IGNORE INTO student_profiles (user_id) VALUES (?)'
  ).bind(userId).run();

  return {
    user_id: userId,
    learning_pace: 'normal',
    avg_response_time_sec: 0,
    preferred_study_time: null,
    avg_session_minutes: 0,
    frustration_score: 0,
    confidence_score: 0.5,
    engagement_level: 'moderate',
    consecutive_correct: 0,
    consecutive_wrong: 0,
    longest_correct_streak: 0,
    grammar_errors: {},
    vocab_errors: {},
    reading_errors: {},
    listening_errors: {},
    skill_mastery: {},
    current_topic: null,
    current_lesson_step: 0,
    tutor_mode: 'lesson',
    socratic_depth: 0,
    exercises_in_current_topic: 0,
    correct_in_current_topic: 0,
    topics_completed: [],
    topics_in_progress: [],
    total_tutor_sessions: 0,
    total_tutor_messages: 0,
    last_tutor_topic: null,
    last_interaction_at: null,
  };
}

// ── Record an exercise result and update profile ──
export async function recordExerciseResult(
  env: Env,
  userId: number,
  topic: string,
  isCorrect: boolean,
  responseTimeSec: number,
  errorCategory: string | null,
  difficulty: number,
): Promise<StudentProfile> {
  const profile = await getStudentProfile(env, userId);

  // Update streaks
  if (isCorrect) {
    profile.consecutive_correct += 1;
    profile.consecutive_wrong = 0;
    profile.correct_in_current_topic += 1;
    if (profile.consecutive_correct > profile.longest_correct_streak) {
      profile.longest_correct_streak = profile.consecutive_correct;
    }
  } else {
    profile.consecutive_wrong += 1;
    profile.consecutive_correct = 0;

    // Track error category
    if (errorCategory) {
      const section = categorizeError(errorCategory);
      const errors = profile[`${section}_errors` as keyof StudentProfile] as Record<string, number>;
      if (errors && typeof errors === 'object') {
        errors[errorCategory] = (errors[errorCategory] || 0) + 1;
      }
    }
  }

  profile.exercises_in_current_topic += 1;
  profile.total_tutor_messages += 1;

  // Update confidence & frustration (exponential moving average)
  const alpha = 0.3;
  if (isCorrect) {
    profile.confidence_score = profile.confidence_score * (1 - alpha) + 1.0 * alpha;
    profile.frustration_score = profile.frustration_score * (1 - alpha) + 0.0 * alpha;
  } else {
    profile.confidence_score = profile.confidence_score * (1 - alpha) + 0.0 * alpha;
    // Frustration increases more with consecutive wrong answers
    const frustrationBump = Math.min(profile.consecutive_wrong * 0.15, 0.5);
    profile.frustration_score = Math.min(1, profile.frustration_score * (1 - alpha) + frustrationBump * alpha + 0.2);
  }

  // Update learning pace from response times
  const prevAvg = profile.avg_response_time_sec;
  profile.avg_response_time_sec = prevAvg === 0
    ? responseTimeSec
    : prevAvg * 0.7 + responseTimeSec * 0.3;

  if (profile.avg_response_time_sec < 8) profile.learning_pace = 'fast';
  else if (profile.avg_response_time_sec > 25) profile.learning_pace = 'slow';
  else profile.learning_pace = 'normal';

  // Update engagement level
  profile.engagement_level = computeEngagement(profile);

  // Update topic mastery
  await updateTopicMastery(env, userId, topic, isCorrect, difficulty);

  // Update skill mastery in profile
  const mastery = await getTopicMastery(env, userId, topic);
  if (mastery) {
    profile.skill_mastery[topic] = mastery.mastery_level;
  }

  // Persist
  await saveProfile(env, profile);

  // Log the interaction
  await env.DB.prepare(
    `INSERT INTO tutor_interactions (user_id, topic, interaction_type, tutor_mode, tutor_message, was_correct, error_category, response_time_sec, difficulty_level)
     VALUES (?, ?, 'exercise', ?, '', ?, ?, ?, ?)`
  ).bind(
    userId, topic, profile.tutor_mode,
    isCorrect ? 1 : 0, errorCategory, responseTimeSec, difficulty
  ).run();

  return profile;
}

// ── Update tutor state (what mode, topic, step) ──
export async function updateTutorState(
  env: Env,
  userId: number,
  updates: Partial<Pick<StudentProfile,
    'current_topic' | 'current_lesson_step' | 'tutor_mode' |
    'socratic_depth' | 'exercises_in_current_topic' | 'correct_in_current_topic'
  >>,
): Promise<void> {
  const sets: string[] = [];
  const values: any[] = [];

  for (const [key, val] of Object.entries(updates)) {
    sets.push(`${key} = ?`);
    values.push(val);
  }
  sets.push("updated_at = datetime('now')");
  values.push(userId);

  await env.DB.prepare(
    `UPDATE student_profiles SET ${sets.join(', ')} WHERE user_id = ?`
  ).bind(...values).run();
}

// ── Get topic mastery for a specific topic ──
export async function getTopicMastery(env: Env, userId: number, topic: string): Promise<TopicMastery | null> {
  const row = await env.DB.prepare(
    'SELECT * FROM topic_mastery WHERE user_id = ? AND topic = ?'
  ).bind(userId, topic).first() as any;

  return row || null;
}

// ── Get all topic masteries for a student ──
export async function getAllTopicMasteries(env: Env, userId: number): Promise<TopicMastery[]> {
  const rows = await env.DB.prepare(
    'SELECT * FROM topic_mastery WHERE user_id = ? ORDER BY mastery_level ASC'
  ).bind(userId).all();

  return (rows.results || []) as any[];
}

// ── Get weakest topics that need attention ──
export async function getWeakestTopics(env: Env, userId: number, limit: number = 5): Promise<TopicMastery[]> {
  const rows = await env.DB.prepare(
    `SELECT * FROM topic_mastery WHERE user_id = ? AND status != 'mastered' AND exercises_attempted > 0
     ORDER BY accuracy_percent ASC, exercises_attempted ASC LIMIT ?`
  ).bind(userId, limit).all();

  return (rows.results || []) as any[];
}

// ── Get topics due for review ──
export async function getTopicsDueForReview(env: Env, userId: number): Promise<TopicMastery[]> {
  const rows = await env.DB.prepare(
    `SELECT * FROM topic_mastery WHERE user_id = ? AND next_review_at <= datetime('now') AND status = 'needs_review'
     ORDER BY next_review_at ASC LIMIT 5`
  ).bind(userId).all();

  return (rows.results || []) as any[];
}

// ── Detect emotional state from message patterns ──
export function detectConfidenceSignal(message: string, responseTimeSec: number, profile: StudentProfile): string {
  const lower = message.toLowerCase().trim();

  // Frustrated signals
  if (profile.consecutive_wrong >= 3) return 'frustrated';
  if (/ga(k)? (ngerti|paham|bisa|tau)/.test(lower)) return 'frustrated';
  if (/susah|bingung|pusing/.test(lower)) return 'confused';
  if (lower.length <= 2 && profile.consecutive_wrong > 0) return 'frustrated'; // one-letter answers after errors

  // Hedging signals
  if (/kayaknya|mungkin|gatau sih|bukan ya/.test(lower)) return 'hedging';
  if (/\?$/.test(lower) && lower.length < 20) return 'hedging'; // answer as question

  // Confident signals
  if (profile.consecutive_correct >= 3) return 'certain';
  if (/pasti|yakin|jelas/.test(lower)) return 'certain';
  if (responseTimeSec < 5 && profile.consecutive_correct >= 1) return 'certain';

  return 'neutral';
}

// ── Generate adaptive context for the tutor prompt ──
export function buildAdaptiveContext(profile: StudentProfile, masteries: TopicMastery[]): string {
  const lines: string[] = [];

  // Learning pace
  lines.push(`PACE: Siswa ini belajar ${profile.learning_pace === 'fast' ? 'cepat — bisa kasih soal lebih menantang' : profile.learning_pace === 'slow' ? 'pelan — sabar, kasih penjelasan lebih detail' : 'normal'}.`);

  // Emotional state
  if (profile.frustration_score > 0.6) {
    lines.push('EMOSI: Siswa FRUSTRASI. Turunkan difficulty. Kasih motivasi. Pecah soal jadi bagian lebih kecil. Jangan langsung kasih soal baru — validasi dulu perasaannya.');
  } else if (profile.frustration_score > 0.3) {
    lines.push('EMOSI: Siswa agak struggle. Kasih hint sebelum soal berikutnya. Acknowledge effort-nya.');
  } else if (profile.confidence_score > 0.7) {
    lines.push('EMOSI: Siswa percaya diri. Naikkan difficulty. Tantang dia.');
  }

  // Current streak
  if (profile.consecutive_correct >= 5) {
    lines.push(`STREAK: ${profile.consecutive_correct} benar berturut! Acknowledge ini. Naikkan difficulty.`);
  } else if (profile.consecutive_wrong >= 3) {
    lines.push(`STREAK: ${profile.consecutive_wrong} salah berturut. Turunkan difficulty. Kasih step-by-step hints.`);
  }

  // Weak areas
  const weakTopics = masteries.filter(m => m.accuracy_percent < 50 && m.exercises_attempted >= 3);
  if (weakTopics.length > 0) {
    const weakNames = weakTopics.map(t => t.topic).slice(0, 3).join(', ');
    lines.push(`KELEMAHAN: Topik paling lemah: ${weakNames}. Kaitkan penjelasan ke kelemahan ini kalau relevan.`);
  }

  // Strong areas
  const strongTopics = masteries.filter(m => m.mastery_level >= 80);
  if (strongTopics.length > 0) {
    const strongNames = strongTopics.map(t => t.topic).slice(0, 3).join(', ');
    lines.push(`KEKUATAN: Sudah menguasai: ${strongNames}. Jangan ulangi kecuali diminta.`);
  }

  // Error patterns
  const allErrors = { ...profile.grammar_errors, ...profile.vocab_errors };
  const sortedErrors = Object.entries(allErrors).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (sortedErrors.length > 0) {
    const errorStr = sortedErrors.map(([cat, count]) => `${cat} (${count}x)`).join(', ');
    lines.push(`POLA ERROR: Kesalahan paling sering: ${errorStr}. Targetkan area ini.`);
  }

  // Engagement
  if (profile.engagement_level === 'low') {
    lines.push('ENGAGEMENT: Rendah. Pakai contoh real-life yang menarik. Gamification. Jangan terlalu panjang.');
  }

  return lines.join('\n');
}

// ── Private helpers ──

async function updateTopicMastery(
  env: Env,
  userId: number,
  topic: string,
  isCorrect: boolean,
  difficulty: number,
): Promise<void> {
  const existing = await getTopicMastery(env, userId, topic);

  if (!existing) {
    const accuracy = isCorrect ? 100 : 0;
    const mastery = isCorrect ? Math.min(difficulty * 10, 30) : 0;
    await env.DB.prepare(
      `INSERT INTO topic_mastery (user_id, topic, mastery_level, exercises_attempted, exercises_correct, accuracy_percent, current_difficulty, highest_difficulty_passed, first_attempted_at, last_attempted_at, status)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?, datetime('now'), datetime('now'), 'learning')`
    ).bind(
      userId, topic, mastery, isCorrect ? 1 : 0, accuracy,
      difficulty, isCorrect ? difficulty : 0,
    ).run();
    return;
  }

  const newAttempted = existing.exercises_attempted + 1;
  const newCorrect = existing.exercises_correct + (isCorrect ? 1 : 0);
  const newAccuracy = Math.round((newCorrect / newAttempted) * 100);

  // Mastery calculation: accuracy-weighted with difficulty bonus
  let masteryDelta = 0;
  if (isCorrect) {
    masteryDelta = Math.max(2, difficulty * 3);  // harder questions = bigger gain
  } else {
    masteryDelta = -Math.max(3, (6 - difficulty) * 2);  // easier questions wrong = bigger penalty
  }
  const newMastery = Math.max(0, Math.min(100, existing.mastery_level + masteryDelta));

  const highestPassed = isCorrect
    ? Math.max(existing.highest_difficulty_passed, difficulty)
    : existing.highest_difficulty_passed;

  // Status transitions
  let status = existing.status;
  if (newMastery >= 85 && newAccuracy >= 80 && newAttempted >= 10) {
    status = 'mastered';
  } else if (newMastery >= 50) {
    status = 'practicing';
  } else if (newAttempted > 0) {
    status = 'learning';
  }

  // Schedule review if mastered
  let nextReview = existing.next_review_at;
  if (status === 'mastered' && existing.status !== 'mastered') {
    // First mastery — review in 3 days
    nextReview = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  }

  await env.DB.prepare(
    `UPDATE topic_mastery SET
       mastery_level = ?, exercises_attempted = ?, exercises_correct = ?,
       accuracy_percent = ?, current_difficulty = ?, highest_difficulty_passed = ?,
       last_attempted_at = datetime('now'), next_review_at = ?, status = ?, updated_at = datetime('now')
     WHERE user_id = ? AND topic = ?`
  ).bind(
    newMastery, newAttempted, newCorrect, newAccuracy,
    difficulty, highestPassed, nextReview, status,
    userId, topic,
  ).run();
}

async function saveProfile(env: Env, profile: StudentProfile): Promise<void> {
  await env.DB.prepare(
    `UPDATE student_profiles SET
       learning_pace = ?, avg_response_time_sec = ?, frustration_score = ?, confidence_score = ?,
       engagement_level = ?, consecutive_correct = ?, consecutive_wrong = ?, longest_correct_streak = ?,
       grammar_errors = ?, vocab_errors = ?, reading_errors = ?, listening_errors = ?,
       skill_mastery = ?, current_topic = ?, current_lesson_step = ?, tutor_mode = ?,
       socratic_depth = ?, exercises_in_current_topic = ?, correct_in_current_topic = ?,
       topics_completed = ?, topics_in_progress = ?,
       total_tutor_sessions = ?, total_tutor_messages = ?,
       last_tutor_topic = ?, last_interaction_at = datetime('now'), updated_at = datetime('now')
     WHERE user_id = ?`
  ).bind(
    profile.learning_pace, profile.avg_response_time_sec,
    profile.frustration_score, profile.confidence_score,
    profile.engagement_level, profile.consecutive_correct,
    profile.consecutive_wrong, profile.longest_correct_streak,
    JSON.stringify(profile.grammar_errors), JSON.stringify(profile.vocab_errors),
    JSON.stringify(profile.reading_errors), JSON.stringify(profile.listening_errors),
    JSON.stringify(profile.skill_mastery), profile.current_topic,
    profile.current_lesson_step, profile.tutor_mode,
    profile.socratic_depth, profile.exercises_in_current_topic,
    profile.correct_in_current_topic,
    JSON.stringify(profile.topics_completed), JSON.stringify(profile.topics_in_progress),
    profile.total_tutor_sessions, profile.total_tutor_messages,
    profile.last_tutor_topic, profile.user_id,
  ).run();
}

function computeEngagement(profile: StudentProfile): 'low' | 'moderate' | 'high' | 'very_high' {
  let score = 0;
  if (profile.total_tutor_messages > 50) score += 2;
  else if (profile.total_tutor_messages > 20) score += 1;
  if (profile.consecutive_correct >= 3) score += 1;
  if (profile.frustration_score < 0.3) score += 1;
  if (profile.avg_response_time_sec > 0 && profile.avg_response_time_sec < 30) score += 1;
  if (profile.confidence_score > 0.5) score += 1;

  if (score >= 5) return 'very_high';
  if (score >= 3) return 'high';
  if (score >= 1) return 'moderate';
  return 'low';
}

function categorizeError(errorCategory: string): 'grammar' | 'vocab' | 'reading' | 'listening' {
  const grammarTopics = ['articles', 'tenses', 'sv_agreement', 'prepositions', 'passive_voice', 'conditionals', 'relative_clauses', 'word_formation'];
  const vocabTopics = ['academic_words', 'collocations', 'word_of_day', 'paraphrasing'];
  const readingTopics = ['reading_main_idea', 'reading_strategy', 'reading_detail', 'reading_inference'];
  if (grammarTopics.includes(errorCategory)) return 'grammar';
  if (vocabTopics.includes(errorCategory)) return 'vocab';
  if (readingTopics.includes(errorCategory)) return 'reading';
  return 'listening';
}

function safeParseJSON(val: any, fallback: any): any {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}
