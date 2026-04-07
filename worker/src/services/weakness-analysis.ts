import type { Env } from '../types';
import { analyzeConversationWeaknesses } from './chat-analysis';

export interface StudentWeaknessProfile {
  user_id: number;
  user_name: string;
  
  // Source 1: Diagnostic scores
  diagnostic: {
    has_diagnostic: boolean;
    grammar_score: number | null;
    grammar_total: number;
    vocab_score: number | null;
    vocab_total: number;
    reading_score: number | null;
    reading_total: number;
    listening_score: number | null;
    listening_total: number;
    writing_band: number | null;
    estimated_band: number | null;
  };
  
  // Source 2: Practice test results
  practice: {
    total_questions: number;
    listening: { attempted: number; correct: number; accuracy: number } | null;
    reading: { attempted: number; correct: number; accuracy: number } | null;
    speaking: { attempted: number; correct: number; accuracy: number } | null;
    writing: { attempted: number; correct: number; accuracy: number } | null;
  };
  
  // Source 3: Chat analysis
  chat: {
    total_messages: number;
    top_topics: Array<{ topic: string; count: number }>;
    confused_topics: Array<{ topic: string; count: number }>;
  };
  
  // Combined weakness analysis
  weaknesses: {
    from_diagnostic: string[];
    from_practice: string[];
    from_chat: string[];
    combined: Array<{ skill: string; priority: 'high' | 'medium' | 'low'; evidence: string[] }>;
  };
  
  // Priority recommendation
  recommendation: {
    priority: 'critical' | 'high' | 'medium' | 'low';
    focus_areas: string[];
    action: string;
  };
}

// Get the latest diagnostic for a user
async function getLatestDiagnostic(env: Env, userId: number) {
  const result = await env.DB.prepare(
    `SELECT * FROM diagnostic_results 
     WHERE user_id = ? AND created_at = (
       SELECT MAX(created_at) FROM diagnostic_results WHERE user_id = ?
     )`
  ).bind(userId, userId).first();
  return result as any;
}

// Get practice stats by section for a user
async function getPracticeStats(env: Env, userId: number) {
  const results = await env.DB.prepare(
    `SELECT 
       aa.section,
       COUNT(*) as attempted,
       SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct
     FROM attempt_answers aa
     JOIN test_attempts ta ON aa.attempt_id = ta.id
     WHERE ta.user_id = ? AND aa.is_correct IS NOT NULL
     GROUP BY aa.section`
  ).bind(userId).all();
  
  const stats: Record<string, { attempted: number; correct: number; accuracy: number }> = {};
  
  for (const r of results.results as any[]) {
    if (r.section) {
      stats[r.section] = {
        attempted: r.attempted,
        correct: r.correct,
        accuracy: r.attempted > 0 ? Math.round((r.correct / r.attempted) * 100) : 0,
      };
    }
  }
  
  return stats;
}

// Convert topic to readable skill name
function topicToSkill(topic: string): string {
  const mapping: Record<string, string> = {
    'grammar_tenses': 'Tenses (Grammar)',
    'grammar_sv_agreement': 'Subject-Verb Agreement',
    'grammar_prepositions': 'Prepositions',
    'grammar_articles': 'Articles (a/an/the)',
    'grammar_conditionals': 'Conditionals',
    'grammar_passive': 'Passive Voice',
    'grammar_direct_indirect': 'Direct & Indirect Speech',
    'vocab_word_formation': 'Word Formation',
    'vocab_idioms': 'Idioms',
    'vocab_collocations': 'Collocations',
    'vocab_synonyms': 'Synonyms & Vocabulary',
    'reading_main_idea': 'Reading Main Idea',
    'reading_vocab_context': 'Vocabulary in Context',
    'reading_inference': 'Reading Inference',
    'reading_details': 'Reading Details',
    'listening_comprehension': 'Listening Comprehension',
    'listening_vocab': 'Listening Vocabulary',
    'listening_inference': 'Listening Inference',
    'speaking_pronunciation': 'Pronunciation',
    'speaking_fluency': 'Speaking Fluency',
    'speaking_content': 'Speaking Content',
    'writing_essay': 'Essay Writing',
    'writing_grammar': 'Writing Grammar',
    'writing_structure': 'Writing Structure',
    'study_tips': 'Study Tips',
    'motivation': 'Motivation',
    'test_format': 'Test Format',
    'practice_motivation': 'Practice',
  };
  return mapping[topic] || topic;
}

// Analyze a single student's weakness profile
export async function getStudentWeaknessProfile(env: Env, userId: number, userName: string): Promise<StudentWeaknessProfile> {
  const [diagnostic, practiceStats, chatAnalysis] = await Promise.all([
    getLatestDiagnostic(env, userId),
    getPracticeStats(env, userId),
    analyzeConversationWeaknesses(env, userId),
  ]);
  
  // Diagnostic weaknesses
  const diagnosticWeaknesses: string[] = [];
  if (diagnostic) {
    if (diagnostic.grammar_score !== null && diagnostic.grammar_score <= 4) {
      diagnosticWeaknesses.push(`Grammar only ${diagnostic.grammar_score}/${diagnostic.grammar_total}`);
    }
    if (diagnostic.vocab_score !== null && diagnostic.vocab_score <= 2) {
      diagnosticWeaknesses.push(`Vocabulary only ${diagnostic.vocab_score}/${diagnostic.vocab_total}`);
    }
    if (diagnostic.reading_score !== null && diagnostic.reading_score <= 1) {
      diagnosticWeaknesses.push(`Reading only ${diagnostic.reading_score}/${diagnostic.reading_total}`);
    }
    if (diagnostic.listening_score !== null && diagnostic.listening_score <= 1) {
      diagnosticWeaknesses.push(`Listening only ${diagnostic.listening_score}/${diagnostic.listening_total}`);
    }
    if (diagnostic.writing_band !== null && diagnostic.writing_band <= 2) {
      diagnosticWeaknesses.push(`Writing Band ${diagnostic.writing_band}`);
    }
  }
  
  // Practice weaknesses (accuracy < 40% is weak)
  const practiceWeaknesses: string[] = [];
  const practiceDetails: Record<string, { attempted: number; correct: number; accuracy: number } | null> = {
    listening: practiceStats.listening || null,
    reading: practiceStats.reading || null,
    speaking: practiceStats.speaking || null,
    writing: practiceStats.writing || null,
  };
  
  for (const [section, stats] of Object.entries(practiceDetails)) {
    if (stats && stats.attempted >= 3 && stats.accuracy < 40) {
      practiceWeaknesses.push(`${section} only ${stats.accuracy}% accuracy (${stats.correct}/${stats.attempted})`);
    }
  }
  
  // Chat weaknesses (topics they're confused about)
  const chatWeaknesses = chatAnalysis.confusedTopics.map(c => 
    `${topicToSkill(c.topic)} (asked ${c.count}x and still confused)`
  );
  
  // Combined analysis
  const combined: Array<{ skill: string; priority: 'high' | 'medium' | 'low'; evidence: string[] }> = [];
  
  // High priority: weak in diagnostic AND confused in chat
  const confusedTopicsSet = new Set(chatAnalysis.confusedTopics.map(c => c.topic));
  
  // Check each diagnostic weakness
  if (diagnostic?.grammar_score !== null && diagnostic.grammar_score <= 4) {
    const evidence = [`Diagnostic: Grammar ${diagnostic.grammar_score}/9`];
    if (confusedTopicsSet.has('grammar_tenses')) evidence.push('Chat: Confused about tenses');
    if (confusedTopicsSet.has('grammar_sv_agreement')) evidence.push('Chat: Confused about S-V agreement');
    combined.push({ skill: 'Grammar', priority: evidence.length >= 2 ? 'high' : 'medium', evidence });
  }
  
  if (diagnostic?.vocab_score !== null && diagnostic.vocab_score <= 2) {
    const evidence = [`Diagnostic: Vocab ${diagnostic.vocab_score}/4`];
    if (confusedTopicsSet.has('vocab_word_formation')) evidence.push('Chat: Confused about word formation');
    if (confusedTopicsSet.has('vocab_idioms')) evidence.push('Chat: Confused about idioms');
    combined.push({ skill: 'Vocabulary', priority: evidence.length >= 2 ? 'high' : 'medium', evidence });
  }
  
  if (diagnostic?.listening_score !== null && diagnostic.listening_score <= 1) {
    const evidence = [`Diagnostic: Listening ${diagnostic.listening_score}/3`];
    if (confusedTopicsSet.has('listening_comprehension')) evidence.push('Chat: Confused about listening');
    combined.push({ skill: 'Listening', priority: 'high', evidence });
  }
  
  if (diagnostic?.writing_band !== null && diagnostic.writing_band <= 2) {
    combined.push({
      skill: 'Writing',
      priority: 'high',
      evidence: [`Diagnostic: Writing Band ${diagnostic.writing_band}/5`],
    });
  }
  
  // Determine priority
  const highPriorityCount = combined.filter(w => w.priority === 'high').length;
  let priority: 'critical' | 'high' | 'medium' | 'low' = 'low';
  if (highPriorityCount >= 3) priority = 'critical';
  else if (highPriorityCount >= 2) priority = 'high';
  else if (highPriorityCount >= 1) priority = 'medium';
  
  // Focus areas
  const focusAreas = combined
    .filter(w => w.priority === 'high')
    .map(w => w.skill);
  
  return {
    user_id: userId,
    user_name: userName,
    diagnostic: {
      has_diagnostic: !!diagnostic,
      grammar_score: diagnostic?.grammar_score ?? null,
      grammar_total: 9,
      vocab_score: diagnostic?.vocab_score ?? null,
      vocab_total: 4,
      reading_score: diagnostic?.reading_score ?? null,
      reading_total: 3,
      listening_score: diagnostic?.listening_score ?? null,
      listening_total: 3,
      writing_band: diagnostic?.writing_band ?? null,
      estimated_band: diagnostic?.estimated_band ?? null,
    },
    practice: {
      total_questions: Object.values(practiceDetails).filter(s => s).reduce((sum, s) => sum + (s?.attempted || 0), 0),
      listening: practiceDetails.listening || null,
      reading: practiceDetails.reading || null,
      speaking: practiceDetails.speaking || null,
      writing: practiceDetails.writing || null,
    },
    chat: {
      total_messages: chatAnalysis.totalMessages,
      top_topics: chatAnalysis.topTopics,
      confused_topics: chatAnalysis.confusedTopics,
    },
    weaknesses: {
      from_diagnostic: diagnosticWeaknesses,
      from_practice: practiceWeaknesses,
      from_chat: chatWeaknesses,
      combined,
    },
    recommendation: {
      priority,
      focus_areas: focusAreas.length > 0 ? focusAreas : ['General Review'],
      action: generateAction(priority, focusAreas, chatAnalysis.topTopics),
    },
  };
}

// Generate recommended action
function generateAction(
  priority: 'critical' | 'high' | 'medium' | 'low',
  focusAreas: string[],
  topTopics: Array<{ topic: string; count: number }>
): string {
  if (priority === 'critical') {
    return `URGENT: Student has multiple high-priority weaknesses. Recommend 1-on-1 tutoring session. Focus on: ${focusAreas.join(', ')}`;
  }
  if (priority === 'high') {
    return `Focus study plan on: ${focusAreas.join(', ')}. Encourage more practice in weak areas.`;
  }
  if (priority === 'medium') {
    return `Continue practice with emphasis on weak areas. Topics of interest: ${topTopics.slice(0, 3).map(t => topicToSkill(t.topic)).join(', ')}`;
  }
  return `Student is progressing well. Continue regular practice.`;
}

// Get all students weakness summary
export async function getAllStudentsWeaknessSummary(env: Env) {
  const users = await env.DB.prepare(
    `SELECT id, name FROM users WHERE target_test = 'TOEFL_IBT' ORDER BY id`
  ).all();
  
  const profiles: StudentWeaknessProfile[] = [];
  
  // Process in batches of 5 for better performance
  const batchSize = 5;
  for (let i = 0; i < users.results.length; i += batchSize) {
    const batch = users.results.slice(i, i + batchSize) as any[];
    
    const batchProfiles = await Promise.all(
      batch.map(async (user) => {
        try {
          return await getStudentWeaknessProfile(env, user.id, user.name || 'Unknown');
        } catch (err) {
          return null;
        }
      })
    );

    for (const p of batchProfiles) {
      if (p) profiles.push(p);
    }
  }

  return profiles;
}
   