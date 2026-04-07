import type { Env } from '../types';

// Chat topic categories for weakness analysis
export const CHAT_TOPICS = {
  // Grammar topics
  GRAMMAR_TENSES: 'grammar_tenses',
  GRAMMAR_SV_AGREEMENT: 'grammar_sv_agreement',
  GRAMMAR_PREPOSITIONS: 'grammar_prepositions',
  GRAMMAR_ARTICLES: 'grammar_articles',
  GRAMMAR_CONDITIONALS: 'grammar_conditionals',
  GRAMMAR_PASSIVE: 'grammar_passive',
  GRAMMAR_DIRECT_INDIRECT: 'grammar_direct_indirect',
  
  // Vocab topics
  VOCAB_WORD_FORMATION: 'vocab_word_formation',
  VOCAB_IDIOMS: 'vocab_idioms',
  VOCAB_COLLOCATIONS: 'vocab_collocations',
  VOCAB_SYNONYMS: 'vocab_synonyms',
  
  // Reading topics
  READING_MAIN_IDEA: 'reading_main_idea',
  READING_VOCAB_CONTEXT: 'reading_vocab_context',
  READING_INFERENCE: 'reading_inference',
  READING_DETAILS: 'reading_details',
  
  // Listening topics
  LISTENING_COMPREHENSION: 'listening_comprehension',
  LISTENING_VOCAB: 'listening_vocab',
  LISTENING_INFERENCE: 'listening_inference',
  
  // Speaking topics
  SPEAKING_PRONUNCIATION: 'speaking_pronunciation',
  SPEAKING_FLUENCY: 'speaking_fluency',
  SPEAKING_CONTENT: 'speaking_content',
  
  // Writing topics
  WRITING_ESSAY: 'writing_essay',
  WRITING_GRAMMAR: 'writing_grammar',
  WRITING_STRUCTURE: 'writing_structure',
  
  // General
  STUDY_TIPS: 'study_tips',
  MOTIVATION: 'motivation',
  TEST_FORMAT: 'test_format',
  PRACTICE_MOTIVATION: 'practice_motivation',
  
  OTHER: 'other',
} as const;

export type ChatTopic = typeof CHAT_TOPICS[keyof typeof CHAT_TOPICS];

// Keyword mappings for topic detection (manual/hybrid approach)
const TOPIC_KEYWORDS: Record<ChatTopic, string[]> = {
  [CHAT_TOPICS.GRAMMAR_TENSES]: [
    'tense', 'tenses', 'past', 'present', 'future', 'yesterday', 'tomorrow',
    'last year', 'next week', 'have been', 'has been', 'will', 'would',
    'simple past', 'simple present', 'present perfect', 'past perfect',
    'kapan', 'waktu', 'temporal', 'udah', 'belum', 'sudah', 'akan',
  ],
  [CHAT_TOPICS.GRAMMAR_SV_AGREEMENT]: [
    'subject verb', 'agreement', 'everyone', 'nobody', 'each', 'either',
    'neither', 'nor', 'pertama', 'subjek', 'verba', 'sesuai',
  ],
  [CHAT_TOPICS.GRAMMAR_PREPOSITIONS]: [
    'preposition', 'at', 'on', 'in', 'since', 'for', 'until', 'during',
    'awalnya', 'terjadi', 'di', 'ke', 'dari', 'pada',
  ],
  [CHAT_TOPICS.GRAMMAR_ARTICLES]: [
    'article', 'a', 'an', 'the', 'artikel',
  ],
  [CHAT_TOPICS.GRAMMAR_CONDITIONALS]: [
    'conditional', 'if', 'unless', 'would', 'could', 'might',
    'condition', 'jika', 'kalau', 'seandainya', 'andaikan',
  ],
  [CHAT_TOPICS.GRAMMAR_PASSIVE]: [
    'passive', 'was', 'were', 'been', 'being', 'obyek',
    'pasif', 'rumus',
  ],
  [CHAT_TOPICS.GRAMMAR_DIRECT_INDIRECT]: [
    'direct', 'indirect', 'speech', 'reported', 'katanya', 'tersebut',
  ],
  [CHAT_TOPICS.VOCAB_WORD_FORMATION]: [
    'suffix', 'prefix', 'root', 'word formation', ' endings', '-tion', '-ness',
    'imbuhan', 'awalan', 'akhiran', 'bentukan',
  ],
  [CHAT_TOPICS.VOCAB_IDIOMS]: [
    'idiom', 'idioms', 'phrase', 'ungkapan', 'peribahasa',
  ],
  [CHAT_TOPICS.VOCAB_COLLOCATIONS]: [
    'collocation', 'berartner', 'の組み合わせ', 'kata yang sering',
  ],
  [CHAT_TOPICS.VOCAB_SYNONYMS]: [
    'synonym', 'antonym', 'similar', 'meaning', 'sinonim', 'artinya',
    'maksud', 'separable',
  ],
  [CHAT_TOPICS.READING_MAIN_IDEA]: [
    'main idea', 'central', 'purpose', 'skim', 'overview',
    'gagasan', 'inti', 'tema',
  ],
  [CHAT_TOPICS.READING_VOCAB_CONTEXT]: [
    'context clue', 'vocab in context', 'berarti', 'makna',
  ],
  [CHAT_TOPICS.READING_INFERENCE]: [
    'infer', 'imply', 'suggest', 'assumption', 'disimpulan', 'tersirat',
  ],
  [CHAT_TOPICS.READING_DETAILS]: [
    'detail', 'fact', 'explicit', 'sebutkan', 'dimana', 'kapan',
  ],
  [CHAT_TOPICS.LISTENING_COMPREHENSION]: [
    'listen', 'audio', 'hear', 'dengar', 'pendengar',
  ],
  [CHAT_TOPICS.LISTENING_VOCAB]: [
    ' pronunciation', 'dibaca', 'dieja',
  ],
  [CHAT_TOPICS.LISTENING_INFERENCE]: [
    'intonation', 'stress', 'nuansa', 'implikasinya',
  ],
  [CHAT_TOPICS.SPEAKING_PRONUNCIATION]: [
    'pronounce', 'pronunciation', 'ucapan', 'fonetik', 'audio', 'rekaman',
    'berbicara', 'ujar', ' pronunciation',
  ],
  [CHAT_TOPICS.SPEAKING_FLUENCY]: [
    'fluency', 'lancar', 'kelancaran', 'flow',
  ],
  [CHAT_TOPICS.SPEAKING_CONTENT]: [
    'content', 'idea', 'relevant', 'topik',
  ],
  [CHAT_TOPICS.WRITING_ESSAY]: [
    'essay', 'writing', 'paragraph', 'introduction', 'conclusion',
    'tulis', 'karangan', 'paragraf',
  ],
  [CHAT_TOPICS.WRITING_GRAMMAR]: [
    'writing grammar', 'penulisan',
  ],
  [CHAT_TOPICS.WRITING_STRUCTURE]: [
    'structure', 'organize', 'urutan',
  ],
  [CHAT_TOPICS.STUDY_TIPS]: [
    'study tips', 'how to', 'strategy', 'tips', 'cara belajar',
    'strategi', 'technique',
  ],
  [CHAT_TOPICS.MOTIVATION]: [
    'motivate', 'support', 'semangat', 'motivasi', "don't give up",
    'you can', 'believe',
  ],
  [CHAT_TOPICS.TEST_FORMAT]: [
    'toefl', 'ielts', 'format', 'structure', 'section',
    'format', 'bagian', 'soal',
  ],
  [CHAT_TOPICS.PRACTICE_MOTIVATION]: [
    'practice', 'exercise', 'try', 'latihan', 'coba',
  ],
  [CHAT_TOPICS.OTHER]: [],
};

// Confusion signals - phrases that indicate a student is confused
const CONFUSION_SIGNALS = [
  'still don\'t understand', 'masih bingung', 'gak ngerti',
  'tidak mengerti', 'confused', 'puzzled', 'unclear',
  'what do you mean', 'maksudnya', 'how', 'why',
  'kenapa', 'mengapa', 'apa bedanya', 'bedanya',
  'still wrong', 'tetap salah', 'still', 'masih',
  'again', 'lag', 'repeat', 'ulangi', ' مرة ',
  'same thing', 'indu', ' sama ',
];

// Analyze a message and detect topic
export function analyzeMessageTopic(content: string): { topic: ChatTopic; isConfusion: boolean } {
  const lowerContent = content.toLowerCase();
  
  // Check for confusion signals first
  const isConfusion = CONFUSION_SIGNALS.some(signal => lowerContent.includes(signal.toLowerCase()));
  
  // Count topic matches
  const topicScores: Record<string, number> = {};
  
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (topic === CHAT_TOPICS.OTHER) continue;
    
    let score = 0;
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        score++;
      }
    }
    if (score > 0) {
      topicScores[topic] = score;
    }
  }
  
  // Find best matching topic
  let bestTopic: ChatTopic = CHAT_TOPICS.OTHER;
  let bestScore = 0;
  
  for (const [topic, score] of Object.entries(topicScores)) {
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic as ChatTopic;
    }
  }
  
  return { topic: bestTopic, isConfusion };
}

// Analyze conversation history for a user and return weakness insights
export async function analyzeConversationWeaknesses(env: Env, userId: number) {
  // Get all user messages for topic analysis
  const messages = await env.DB.prepare(
    `SELECT content, role FROM conversation_messages 
     WHERE user_id = ? AND created_at >= datetime('now', '-30 days')
     ORDER BY created_at DESC LIMIT 500`
  ).bind(userId).all();
  
  const topicCounts: Record<string, number> = {};
  const confusionTopics: Record<string, number> = {};
  let totalQuestions = 0;
  
  for (const msg of messages.results as any[]) {
    if (msg.role !== 'user') continue;
    
    const { topic, isConfusion } = analyzeMessageTopic(msg.content);
    
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    totalQuestions++;
    
    if (isConfusion) {
      confusionTopics[topic] = (confusionTopics[topic] || 0) + 1;
    }
  }
  
  // Sort topics by frequency
  const sortedTopics = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([topic, count]) => ({ topic, count }));
  
  // Sort confusion topics (these are likely real weaknesses)
  const sortedConfusion = Object.entries(confusionTopics)
    .sort(([, a], [, b]) => b - a)
    .filter(([, count]) => count >= 2) // Only topics confused about 2+ times
    .map(([topic, count]) => ({ topic, count }));
  
  return {
    totalMessages: totalQuestions,
    topTopics: sortedTopics.slice(0, 5),
    confusedTopics: sortedConfusion,
    topicDistribution: topicCounts,
  };
}

// Get or update conversation_analytics for a user
export async function updateConversationAnalytics(env: Env, userId: number) {
  const analysis = await analyzeConversationWeaknesses(env, userId);
  
  for (const { topic, count } of analysis.topTopics) {
    await env.DB.prepare(
      `INSERT INTO conversation_analytics (user_id, topic, message_count, confusion_signals)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, topic) DO UPDATE SET
         message_count = message_count + ?,
         confusion_signals = confusion_signals + ?,
         last_updated = datetime('now')`
    ).bind(userId, topic, count, analysis.confusedTopics.find(c => c.topic === topic)?.count || 0, count, 0).run();
  }
  
  return analysis;
}
