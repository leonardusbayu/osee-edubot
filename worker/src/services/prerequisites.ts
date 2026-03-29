import type { Env } from '../types';

// Skill Dependency Tree — each skill has a level and prerequisites
export const SKILL_TREE: Record<string, { level: number; requires: string[]; label: string }> = {
  // Level 0: Foundation
  basic_vocabulary: { level: 0, requires: [], label: 'Vocabulary Dasar' },
  basic_sentence: { level: 0, requires: [], label: 'Struktur Kalimat Dasar (S-V-O)' },

  // Level 1: Core Grammar
  articles: { level: 1, requires: ['basic_vocabulary'], label: 'Articles (a/an/the)' },
  sv_agreement: { level: 1, requires: ['basic_sentence'], label: 'Subject-Verb Agreement' },
  tenses: { level: 1, requires: ['sv_agreement'], label: 'Tenses (Past/Present/Future)' },

  // Level 2: Intermediate
  prepositions: { level: 2, requires: ['basic_vocabulary'], label: 'Prepositions (in/on/at)' },
  passive_voice: { level: 2, requires: ['tenses'], label: 'Passive Voice' },
  conditionals: { level: 2, requires: ['tenses'], label: 'Conditionals (If clauses)' },
  relative_clauses: { level: 2, requires: ['basic_sentence'], label: 'Relative Clauses (who/which/that)' },
  word_formation: { level: 2, requires: ['basic_vocabulary'], label: 'Word Formation (prefix/suffix)' },
  linking_words: { level: 2, requires: ['basic_sentence'], label: 'Linking Words' },

  // Level 3: TOEFL Skills
  reading_strategy: { level: 3, requires: ['basic_vocabulary', 'tenses', 'articles'], label: 'Reading Comprehension' },
  listening_strategy: { level: 3, requires: ['basic_vocabulary', 'prepositions'], label: 'Listening Comprehension' },
  speaking_templates: { level: 3, requires: ['tenses', 'relative_clauses'], label: 'Speaking Templates' },
  writing_templates: { level: 3, requires: ['tenses', 'prepositions', 'articles'], label: 'Writing Email' },
  academic_words: { level: 3, requires: ['basic_vocabulary', 'word_formation'], label: 'Academic Vocabulary' },
  collocations: { level: 3, requires: ['basic_vocabulary'], label: 'Collocations' },
  paraphrasing: { level: 3, requires: ['tenses', 'relative_clauses', 'passive_voice'], label: 'Paraphrasing' },
};

// Map lesson callback names to skill tree keys
export const LESSON_TO_SKILL: Record<string, string> = {
  articles: 'articles',
  tenses: 'tenses',
  prepositions: 'prepositions',
  sv_agreement: 'sv_agreement',
  passive_voice: 'passive_voice',
  conditionals: 'conditionals',
  relative_clauses: 'relative_clauses',
  word_formation: 'word_formation',
  linking_words: 'linking_words',
  speaking_templates: 'speaking_templates',
  writing_templates: 'writing_templates',
  academic_words: 'academic_words',
  collocations: 'collocations',
  paraphrasing: 'paraphrasing',
  reading_strategy: 'reading_strategy',
  listening_strategy: 'listening_strategy',
  word_of_day: 'basic_vocabulary',
  pronunciation: 'basic_vocabulary',
};

const THRESHOLD = 60; // Minimum score to "pass" a prerequisite

// Get student's skill scores
export async function getStudentSkills(env: Env, userId: number): Promise<Record<string, number>> {
  const results = await env.DB.prepare(
    'SELECT skill, score FROM student_skills WHERE user_id = ?'
  ).bind(userId).all();

  const skills: Record<string, number> = {};
  for (const r of results.results as any[]) {
    skills[r.skill] = r.score;
  }
  return skills;
}

// Update a student's skill score
export async function updateSkillScore(
  env: Env, userId: number, skill: string, correct: boolean,
) {
  const existing = await env.DB.prepare(
    'SELECT * FROM student_skills WHERE user_id = ? AND skill = ?'
  ).bind(userId, skill).first() as any;

  if (existing) {
    const newTotal = existing.total_attempts + 1;
    const newCorrect = existing.correct_attempts + (correct ? 1 : 0);
    const newScore = Math.round((newCorrect / newTotal) * 100);

    await env.DB.prepare(
      'UPDATE student_skills SET score = ?, total_attempts = ?, correct_attempts = ?, last_tested = ? WHERE id = ?'
    ).bind(newScore, newTotal, newCorrect, new Date().toISOString(), existing.id).run();
  } else {
    await env.DB.prepare(
      'INSERT INTO student_skills (user_id, skill, score, total_attempts, correct_attempts, last_tested) VALUES (?, ?, ?, 1, ?, ?)'
    ).bind(userId, skill, correct ? 100 : 0, correct ? 1 : 0, new Date().toISOString()).run();
  }
}

// Check if a student has the prerequisites for a given skill
export async function checkPrerequisites(
  env: Env, userId: number, targetSkill: string,
): Promise<{ ready: boolean; missing: string[]; missingLabels: string[] }> {
  const skillDef = SKILL_TREE[targetSkill];
  if (!skillDef || skillDef.requires.length === 0) {
    return { ready: true, missing: [], missingLabels: [] };
  }

  const studentSkills = await getStudentSkills(env, userId);
  const missing: string[] = [];
  const missingLabels: string[] = [];

  for (const prereq of skillDef.requires) {
    const score = studentSkills[prereq];
    // If no score exists (never tested) or below threshold
    if (score === undefined || score < THRESHOLD) {
      missing.push(prereq);
      missingLabels.push(SKILL_TREE[prereq]?.label || prereq);
    }
  }

  return { ready: missing.length === 0, missing, missingLabels };
}

// Get all missing prerequisites recursively (deep check)
export async function getDeepMissingPrereqs(
  env: Env, userId: number, targetSkill: string,
): Promise<string[]> {
  const studentSkills = await getStudentSkills(env, userId);
  const allMissing: string[] = [];
  const visited = new Set<string>();

  function check(skill: string) {
    if (visited.has(skill)) return;
    visited.add(skill);

    const def = SKILL_TREE[skill];
    if (!def) return;

    for (const prereq of def.requires) {
      const score = studentSkills[prereq] ?? -1;
      if (score < THRESHOLD) {
        // This prerequisite is missing — check ITS prerequisites too
        check(prereq);
        if (!allMissing.includes(prereq)) {
          allMissing.push(prereq);
        }
      }
    }
  }

  check(targetSkill);

  // Sort by level (lowest first — foundation before intermediate)
  allMissing.sort((a, b) => (SKILL_TREE[a]?.level || 0) - (SKILL_TREE[b]?.level || 0));

  return allMissing;
}

// Format prerequisite warning message
export function formatPrereqWarning(targetSkill: string, missingLabels: string[]): string {
  const targetLabel = SKILL_TREE[targetSkill]?.label || targetSkill;

  if (missingLabels.length === 1) {
    return `Sebelum belajar ${targetLabel}, kamu perlu kuasai "${missingLabels[0]}" dulu.\n\nMau aku ajarkan itu dulu?`;
  }

  const list = missingLabels.map((l, i) => `${i + 1}. ${l}`).join('\n');
  return `Untuk belajar ${targetLabel}, kamu perlu kuasai dulu:\n${list}\n\nMau mulai dari yang pertama?`;
}

// Initialize skills from diagnostic results
export async function initSkillsFromDiagnostic(env: Env, userId: number, diagnosticResults: any) {
  const skillMap: Record<string, { correct: number; total: number }> = {};

  // Map diagnostic topics to skills
  const topicToSkill: Record<string, string> = {
    articles: 'articles',
    tenses: 'tenses',
    sv_agreement: 'sv_agreement',
    prepositions: 'prepositions',
    passive_voice: 'passive_voice',
    word_formation: 'word_formation',
    academic_words: 'basic_vocabulary',
    collocations: 'basic_vocabulary',
    main_idea: 'reading_strategy',
    detail: 'reading_strategy',
    vocabulary_context: 'basic_vocabulary',
    conversation: 'listening_strategy',
    inference: 'listening_strategy',
    purpose: 'listening_strategy',
    email: 'writing_templates',
  };

  // Process diagnostic answers
  if (diagnosticResults.grammar) {
    for (const [topic, stats] of Object.entries(diagnosticResults.grammar.topics || {})) {
      const skill = topicToSkill[topic] || topic;
      if (!skillMap[skill]) skillMap[skill] = { correct: 0, total: 0 };
      skillMap[skill].correct += (stats as any).correct;
      skillMap[skill].total += (stats as any).total;
    }
  }

  // Save all skill scores
  for (const [skill, stats] of Object.entries(skillMap)) {
    const score = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    await env.DB.prepare(
      'INSERT OR REPLACE INTO student_skills (user_id, skill, score, total_attempts, correct_attempts, last_tested) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userId, skill, score, stats.total, stats.correct, new Date().toISOString()).run();
  }

  // Set foundation skills based on overall performance
  const overallScore = diagnosticResults.estimatedBand ? Math.round((diagnosticResults.estimatedBand / 6) * 100) : 30;
  await env.DB.prepare(
    'INSERT OR REPLACE INTO student_skills (user_id, skill, score, total_attempts, correct_attempts, last_tested) VALUES (?, ?, ?, 1, ?, ?)'
  ).bind(userId, 'basic_vocabulary', Math.min(100, overallScore + 20), 1, overallScore >= 50 ? 1 : 0, new Date().toISOString()).run();

  await env.DB.prepare(
    'INSERT OR REPLACE INTO student_skills (user_id, skill, score, total_attempts, correct_attempts, last_tested) VALUES (?, ?, ?, 1, ?, ?)'
  ).bind(userId, 'basic_sentence', Math.min(100, overallScore + 10), 1, overallScore >= 40 ? 1 : 0, new Date().toISOString()).run();
}
