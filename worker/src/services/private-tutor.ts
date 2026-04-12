/**
 * OSEE Private Tutor Engine v3
 *
 * Persona: Academic expert with Mojok.com editorial voice.
 * Smart, witty, slightly sarcastic but deeply caring.
 * Uses "aku" and "kamu". Never "lo/gue" or "saya/Anda".
 *
 * Engagement: Socratic questioning + Real-life context + Gamified challenges
 * Tracking: Full cognitive profile — adapts difficulty, tone, and approach per student.
 */

import type { Env, User } from '../types';
import {
  getStudentProfile,
  getAllTopicMasteries,
  getWeakestTopics,
  getTopicsDueForReview,
  recordExerciseResult,
  updateTutorState,
  buildAdaptiveContext,
  detectConfidenceSignal,
  type StudentProfile,
  type TopicMastery,
} from './student-profile';
import { TEST_NAMES } from './teaching';
import { buildMentalModelContext, recordEvidence } from './mental-model';
import { getActivePlan, formatLessonStepMessage, formatTopicName } from './lesson-engine';

// ═══════════════════════════════════════════════════════
// PERSONA — Mojok.com-style academic expert
// ═══════════════════════════════════════════════════════
const PERSONA_PROMPT = `IDENTITAS: Kamu adalah tutor {target_test} dari OSEE. Seorang akademisi yang menulis seperti kolumnis Mojok.com — cerdas, tajam, kadang sarkastis tipis, tapi peduli betul sama muridmu.

REGISTER BAHASA:
- "Aku" dan "kamu". BUKAN lo/gue, BUKAN saya/Anda.
- Bahasa Indonesia yang cerdas, berwawasan, tapi nggak pernah menggurui.
- Boleh campur English terms kalau natural (code-switching, bukan show-off).
- Humor intelektual oke. Sarkasme ringan oke. Merendahkan TIDAK.
- Kadang pakai analogi khas Indonesia: "Ini kayak naik ojol tapi kasih alamat 'di deket situ' — kurang spesifik."
- Emoji boleh 1-2 per pesan, jangan kebanyakan.

KEPRIBADIAN:
- Kamu paham betul kenapa orang Indonesia struggle di English. Kamu empati, bukan simpatik.
- Kamu nggak sabar sama kesalahan berulang — tapi kamu sabar sama murid yang berusaha.
- Kalau murid bener, kamu apresiasi dengan tulus (bukan "Bagus!" generik — tapi spesifik kenapa bagus).
- Kalau murid salah, kamu nggak bilang "salah" — kamu tanya balik sampai mereka nemuin sendiri.
- Kamu sering kaitkan grammar/vocab ke kehidupan nyata: melamar kerja, chat sama bule, nonton film, apply beasiswa.

PRINSIP MENGAJAR:
1. SOCRATIC FIRST — Jangan langsung kasih jawaban. Tanya balik: "Menurut kamu kenapa?" / "Coba baca lagi — ada yang janggal?"
2. REAL-LIFE ANCHORS — Setiap konsep harus punya contoh dari dunia nyata murid.
3. PATTERN DISCOVERY — Kasih 3-4 contoh, biarkan murid nemuin polanya sendiri sebelum kamu jelaskan aturannya.
4. MICRO-EXERCISES — Setiap 2-3 penjelasan, kasih 1 soal cepat untuk cek pemahaman.
5. GAMIFICATION — Frame latihan sebagai tantangan: "3 soal lagi untuk unlock level berikutnya", streak tracking, personal best.

FORMAT KETAT:
1. MAKS 10 BARIS per pesan. Lebih dari itu = kamu gagal.
2. JANGAN pakai heading (#), bold (**), italic (*), markdown APAPUN. Plain text.
3. JANGAN buka dengan "[Nama], mari kita..." — langsung substansi.
4. KASIH MAKS 1 SOAL per pesan. Tunggu jawaban sebelum lanjut.
5. Kalau kasih soal MCQ, tulis A/B/C/D di baris terpisah.`;

// ═══════════════════════════════════════════════════════
// ADAPTIVE CONTEXT BUILDER — Injected per conversation
// With Ranedeer-style personalization + Mental Model
// ═══════════════════════════════════════════════════════
async function buildFullSystemPrompt(
  env: Env,
  user: User,
  profile: StudentProfile,
  masteries: TopicMastery[],
  targetTest: string,
): Promise<string> {
  const persona = PERSONA_PROMPT.split('{target_test}').join(targetTest);

  // ── Ranedeer-style learning preferences ──
  const learningStyle = (profile as any).learning_style || 'balanced';
  const commStyle = (profile as any).communication_style || 'socratic';
  const depthLevel = (profile as any).depth_level || 'intermediate';
  const studyGoal = (profile as any).study_goal || null;
  const targetBand = (profile as any).target_band_score || null;

  const prefsContext = `
PREFERENSI BELAJAR (Ranedeer-adapted):
- Learning Style: ${LEARNING_STYLE_DESC[learningStyle] || learningStyle}
- Communication: ${COMM_STYLE_DESC[commStyle] || commStyle}
- Depth Level: ${DEPTH_LEVEL_DESC[depthLevel] || depthLevel}
${targetBand ? `- Target Score: ${targetBand}` : ''}
${studyGoal ? `- Tujuan: ${studyGoal}` : ''}

ADAPTASI BERDASARKAN PREFERENSI:
${getStyleAdaptation(learningStyle, commStyle, depthLevel)}`;

  const studentContext = `
PROFIL MURID — {name}:
Target: ${targetTest}. Level: ${user.proficiency_level || depthLevel}.
Sesi ke-${profile.total_tutor_sessions + 1}. Total pesan: ${profile.total_tutor_messages}.
${profile.last_tutor_topic ? `Terakhir belajar: ${profile.last_tutor_topic}.` : 'Belum pernah belajar sebelumnya.'}`.split('{name}').join(user.name);

  const adaptiveContext = buildAdaptiveContext(profile, masteries);

  // ── Full Student Intelligence Report (for richer AI context) ──
  let studentReportCtx = '';
  try {
    const { buildStudentReportForAI } = await import('./student-report');
    studentReportCtx = await buildStudentReportForAI(env, user.id);
  } catch {}

  // ── Theory-of-Mind: Mental Model Context ──
  let mentalModelCtx = '';
  try {
    mentalModelCtx = await buildMentalModelContext(env, user.id);
  } catch {}

  // ── Active Lesson Plan Context ──
  let lessonPlanCtx = '';
  try {
    const activePlan = await getActivePlan(env, user.id);
    if (activePlan && activePlan.current_step < activePlan.total_steps) {
      const currentLesson = activePlan.lessons[activePlan.current_step];
      lessonPlanCtx = `
ACTIVE LESSON PLAN: "${activePlan.title}" (step ${activePlan.current_step + 1}/${activePlan.total_steps})
Current step: ${currentLesson.title} (${currentLesson.type})
Instruction: ${currentLesson.content}
Progress: ${activePlan.progress_percent}%`;
    }
  } catch {}

  // Tutor mode-specific instructions
  let modeInstructions = '';
  if (profile.tutor_mode === 'lesson') {
    modeInstructions = `
MODE: LESSON — Kamu sedang mengajarkan topik "${profile.current_topic || 'baru'}".
Step ${profile.current_lesson_step} dari pelajaran ini.
ALUR: Socratic question → Pattern discovery (kasih contoh) → Micro-exercise → Feedback → Soal berikutnya (makin susah).
Kalau step 0: mulai dengan pertanyaan Socratic atau contoh pattern. JANGAN langsung jelasin aturan.`;
  } else if (profile.tutor_mode === 'exercise') {
    modeInstructions = `
MODE: EXERCISE — Kamu sedang drill topik "${profile.current_topic}".
Sudah ${profile.exercises_in_current_topic} soal (${profile.correct_in_current_topic} benar).
Kasih soal sesuai difficulty. Feedback singkat setelah jawab. Langsung soal berikutnya.
GAMIFICATION: Sebutin streak kalau ada. "4/5 benar — 1 lagi untuk perfect round!"`;
  } else if (profile.tutor_mode === 'review') {
    modeInstructions = `
MODE: REVIEW — Kamu me-review topik yang perlu diulang.
Kasih soal dari topik lemah. Kalau salah, jelaskan singkat lalu kasih soal serupa.
Tone: supportive tapi tegas. "Ini pernah kita bahas — coba ingat lagi."`;
  } else {
    modeInstructions = `
MODE: FREE CHAT — Murid ngobrol bebas atau tanya sesuatu.
Jawab pertanyaan mereka, tapi kalau ada kesempatan, sisipkan mini-lesson.
Kalau mereka terlihat bosan/random, suggest topik yang perlu diperbaiki.`;
  }

  return `${persona}

${prefsContext}

${studentContext}

${adaptiveContext}

${mentalModelCtx}

${studentReportCtx ? `\n--- FULL STUDENT INTELLIGENCE ---\n${studentReportCtx}\n--- END REPORT ---` : ''}

${lessonPlanCtx}

${modeInstructions}

AUDIO LISTENING:
Kalau konteks latihan listening, bisa kasih dialog multi-speaker dalam format:
[AUDIO] Man: kalimat. Woman: kalimat.
Ini akan dikonversi jadi audio suara untuk murid.

AFTER EACH RESPONSE:
Jika murid menjawab soal, tentukan apakah jawabannya menunjukkan pemahaman konsep.
Di akhir response, tambahkan tag invisible untuk tracking (JANGAN ditampilkan ke murid):
[CONCEPT:nama_konsep|UNDERSTANDING:solid/partial/misconception|DETAIL:penjelasan singkat]

INFO: osee.co.id | WA +62 811-2647-784`;
}

// ═══════════════════════════════════════════════════════
// RANEDEER-STYLE PREFERENCE DESCRIPTIONS
// ═══════════════════════════════════════════════════════
const LEARNING_STYLE_DESC: Record<string, string> = {
  visual: 'VISUAL — Suka diagram, tabel, contoh visual. Gunakan format yang bisa "dilihat": before/after, side-by-side comparison, highlight patterns.',
  verbal: 'VERBAL — Suka penjelasan naratif, cerita, analogi. Jelaskan lewat kalimat mengalir, bukan list.',
  active: 'ACTIVE — Suka langsung praktek. Kasih soal duluan, baru jelaskan setelahnya. Learning by doing.',
  reflective: 'REFLECTIVE — Suka mikir dulu. Kasih waktu untuk proses. Tanya "kenapa menurut kamu?" sebelum kasih jawaban.',
  balanced: 'BALANCED — Mix semua pendekatan. Variasikan antara penjelasan, contoh visual, dan latihan.',
};

const COMM_STYLE_DESC: Record<string, string> = {
  socratic: 'SOCRATIC — Jangan kasih jawaban langsung. Selalu balik tanya. Guide mereka ke jawaban sendiri.',
  storytelling: 'STORYTELLING — Frame pelajaran sebagai cerita atau skenario real-life. "Bayangkan kamu lagi interview di Google..."',
  formal: 'FORMAL — Akademis tapi tetap hangat. Strukturnya jelas: konsep → contoh → latihan → summary.',
  casual: 'CASUAL — Kayak ngobrol sama teman yang jago English. Santai tapi substansi tetap dalam.',
  direct: 'DIRECT — To the point. Minimal basa-basi. Kasih aturan, contoh, soal. Efisien.',
};

const DEPTH_LEVEL_DESC: Record<string, string> = {
  beginner: 'BEGINNER — Pakai bahasa Indonesia dominan. Jelaskan dari nol. Vocabulary dasar. Jangan assume prior knowledge.',
  elementary: 'ELEMENTARY — Sudah tahu basic grammar. Fokus ke pattern recognition. Mix English 30%.',
  intermediate: 'INTERMEDIATE — Bisa paham penjelasan English. Fokus ke nuance dan common mistakes. Mix English 50%.',
  advanced: 'ADVANCED — Diskusi mostly in English. Fokus ke fine-tuning, academic register, scoring strategies.',
  expert: 'EXPERT — Full English. Fokus ke test-taking strategies, time management, perfect score tips.',
};

function getStyleAdaptation(learningStyle: string, commStyle: string, depthLevel: string): string {
  const adaptations: string[] = [];

  // Learning style adaptations
  if (learningStyle === 'visual') {
    adaptations.push('- Gunakan contoh side-by-side (Salah vs Benar)');
    adaptations.push('- Format pattern: [Pattern] → [Example 1] / [Example 2] / [Example 3]');
  } else if (learningStyle === 'active') {
    adaptations.push('- Kasih soal DULU, baru jelaskan setelah mereka coba');
    adaptations.push('- Challenge: "Coba tebak mana yang benar sebelum aku jelaskan"');
  } else if (learningStyle === 'reflective') {
    adaptations.push('- Setelah kasih contoh, tanya: "Menurut kamu kenapa yang ini benar?"');
    adaptations.push('- Beri jeda antara penjelasan dan soal');
  }

  // Communication style adaptations
  if (commStyle === 'storytelling') {
    adaptations.push('- Mulai tiap topik baru dengan skenario: "Kamu lagi ngerjain essay untuk apply beasiswa..."');
  } else if (commStyle === 'direct') {
    adaptations.push('- Format: Aturan → Contoh → Soal. Maksimal 5 baris.');
  }

  // Depth adaptations
  if (depthLevel === 'beginner' || depthLevel === 'elementary') {
    adaptations.push('- SELALU terjemahkan istilah grammar ke Bahasa Indonesia');
    adaptations.push('- Soal mulai dari yang paling basic');
  } else if (depthLevel === 'advanced' || depthLevel === 'expert') {
    adaptations.push('- Jelaskan exceptions dan edge cases');
    adaptations.push('- Fokus ke nuances yang membedakan band 7 vs 8+');
  }

  return adaptations.join('\n');
}

// ═══════════════════════════════════════════════════════
// MAIN TUTOR ENTRY POINT
// ═══════════════════════════════════════════════════════
export async function getPrivateTutorResponse(
  env: Env,
  user: User,
  message: string,
): Promise<{ text: string; profile: StudentProfile }> {
  if (!env.OPENAI_API_KEY) {
    const profile = await getStudentProfile(env, user.id);
    return { text: 'AI tutoring belum dikonfigurasi. Hubungi admin.', profile };
  }

  // 1. Load student profile + masteries
  const profile = await getStudentProfile(env, user.id);
  const masteries = await getAllTopicMasteries(env, user.id);

  // 2. Detect intent and emotional state
  const intent = detectIntent(message, profile);
  const confidenceSignal = detectConfidenceSignal(message, 0, profile);

  // 3. Handle meta-commands
  if (intent.type === 'topic_request') {
    await updateTutorState(env, user.id, {
      current_topic: intent.topic!,
      current_lesson_step: 0,
      tutor_mode: 'lesson',
      socratic_depth: 0,
      exercises_in_current_topic: 0,
      correct_in_current_topic: 0,
    });
    profile.current_topic = intent.topic!;
    profile.current_lesson_step = 0;
    profile.tutor_mode = 'lesson';
  } else if (intent.type === 'exercise_request') {
    await updateTutorState(env, user.id, {
      tutor_mode: 'exercise',
      exercises_in_current_topic: 0,
      correct_in_current_topic: 0,
    });
    profile.tutor_mode = 'exercise';
  } else if (intent.type === 'review_request') {
    const dueTopics = await getTopicsDueForReview(env, user.id);
    const weakTopics = await getWeakestTopics(env, user.id, 3);
    const reviewTopic = dueTopics[0]?.topic || weakTopics[0]?.topic || profile.current_topic;
    if (reviewTopic) {
      await updateTutorState(env, user.id, {
        current_topic: reviewTopic,
        tutor_mode: 'review',
      });
      profile.current_topic = reviewTopic;
      profile.tutor_mode = 'review';
    }
  } else if (intent.type === 'answer' && profile.tutor_mode !== 'free_chat') {
    // Student is answering an exercise — we'll let the LLM evaluate but also track
    // The LLM's response will contain whether it was correct; we'll parse that afterward
  }

  // 4. Build adaptive system prompt (now async — includes mental model + lesson plan)
  const targetTest = TEST_NAMES[user.target_test || 'TOEFL_IBT'] || 'English Test';
  const systemPrompt = await buildFullSystemPrompt(env, user, profile, masteries, targetTest);

  // 5. Load conversation history
  const history = await env.DB.prepare(
    'SELECT role, content FROM conversation_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 14'
  ).bind(user.id).all();

  const messages: { role: string; content: string }[] = [];
  if (history.results) {
    for (const msg of [...history.results].reverse()) {
      messages.push({ role: msg.role as string, content: msg.content as string });
    }
  }

  // Inject confidence signal as context
  if (confidenceSignal !== 'neutral') {
    messages.push({
      role: 'system',
      content: `[SIGNAL: Murid terdeteksi ${confidenceSignal}. Sesuaikan respons.]`,
    });
  }

  messages.push({ role: 'user', content: message });

  // 6. Call LLM with fallback
  let responseText: string;
  try {
    responseText = await callLLM(env, systemPrompt, messages, 500);
  } catch (e: any) {
    console.error('Tutor LLM error:', e);
    responseText = 'Maaf, ada gangguan teknis. Coba kirim ulang pesanmu ya.';
  }

  // 7. Extract mental model signals from response & strip tags
  try {
    const conceptMatch = responseText.match(/\[CONCEPT:([^|]+)\|UNDERSTANDING:([^|]+)\|DETAIL:([^\]]+)\]/);
    if (conceptMatch) {
      const [, concept, understanding, detail] = conceptMatch;
      const evidenceType = understanding.trim() === 'solid' || understanding.trim() === 'mastered'
        ? 'correct_answer' as const
        : 'wrong_answer' as const;
      await recordEvidence(env, user.id, concept.trim(), evidenceType, detail.trim(), 0.6);
      // Strip the tag from visible response
      responseText = responseText.replace(/\[CONCEPT:[^\]]+\]/g, '').trim();
    }
  } catch {}

  // 8. Save conversation
  try {
    await env.DB.prepare(
      'INSERT INTO conversation_messages (user_id, role, content) VALUES (?, ?, ?)'
    ).bind(user.id, 'user', message).run();
    await env.DB.prepare(
      'INSERT INTO conversation_messages (user_id, role, content) VALUES (?, ?, ?)'
    ).bind(user.id, 'assistant', responseText).run();
  } catch {}

  // 9. Update profile message count
  profile.total_tutor_messages += 1;
  profile.last_tutor_topic = profile.current_topic;
  try {
    await env.DB.prepare(
      `UPDATE student_profiles SET total_tutor_messages = total_tutor_messages + 1,
       last_tutor_topic = ?, last_interaction_at = datetime('now'), updated_at = datetime('now')
       WHERE user_id = ?`
    ).bind(profile.current_topic, user.id).run();
  } catch {}

  // 10. Log API usage
  try {
    const tokens = Math.ceil((message.length + responseText.length + systemPrompt.length) / 4);
    const cost = tokens * 0.0000025; // gpt-4o rate
    await env.DB.prepare(
      'INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd, user_id) VALUES (?, ?, ?, ?, ?)'
    ).bind('openai', 'private-tutor', tokens, cost, user.id).run();
  } catch {}

  return { text: responseText, profile };
}

// ═══════════════════════════════════════════════════════
// SMART TOPIC RECOMMENDATION
// ═══════════════════════════════════════════════════════
export async function recommendNextTopic(env: Env, userId: number): Promise<{
  topic: string;
  reason: string;
  mode: 'lesson' | 'review' | 'exercise';
}> {
  // Priority 1: Topics due for review
  const dueTopics = await getTopicsDueForReview(env, userId);
  if (dueTopics.length > 0) {
    return {
      topic: dueTopics[0].topic,
      reason: `Topik "${dueTopics[0].topic}" perlu direview supaya nggak lupa.`,
      mode: 'review',
    };
  }

  // Priority 2: Weakest attempted topics
  const weakTopics = await getWeakestTopics(env, userId, 3);
  if (weakTopics.length > 0) {
    const weakest = weakTopics[0];
    if (weakest.accuracy_percent < 40) {
      return {
        topic: weakest.topic,
        reason: `Akurasi kamu di "${weakest.topic}" baru ${weakest.accuracy_percent}% — perlu latihan lagi.`,
        mode: 'exercise',
      };
    }
  }

  // Priority 3: New topics not yet started
  const allMasteries = await getAllTopicMasteries(env, userId);
  const masteredTopics = new Set(allMasteries.map(m => m.topic));
  const allTopics = [
    'articles', 'sv_agreement', 'tenses', 'prepositions',
    'passive_voice', 'conditionals', 'relative_clauses', 'word_formation',
    'academic_words', 'collocations', 'paraphrasing', 'linking_words',
    'reading_main_idea', 'reading_strategy',
    'listening_practice', 'listening_strategy',
    'speaking_templates', 'writing_templates', 'pronunciation',
  ];

  for (const topic of allTopics) {
    if (!masteredTopics.has(topic)) {
      return {
        topic,
        reason: `Belum pernah belajar "${topic}" — saatnya mulai.`,
        mode: 'lesson',
      };
    }
  }

  // All topics started — go to weakest
  if (weakTopics.length > 0) {
    return {
      topic: weakTopics[0].topic,
      reason: `Semua topik sudah dicoba! Ayo perkuat yang paling lemah.`,
      mode: 'exercise',
    };
  }

  return {
    topic: 'articles',
    reason: 'Mari mulai dari dasar — articles.',
    mode: 'lesson',
  };
}

// ═══════════════════════════════════════════════════════
// GAMIFICATION MESSAGES
// ═══════════════════════════════════════════════════════
export function getGamificationMessage(profile: StudentProfile): string | null {
  // Streak celebrations
  if (profile.consecutive_correct === 3) {
    return '3 berturut! Kayaknya otakmu lagi dalam mode on fire nih.';
  }
  if (profile.consecutive_correct === 5) {
    return '5 berturut! Ini bukan keberuntungan — ini skill. Aku naikin level soalnya ya.';
  }
  if (profile.consecutive_correct === 10) {
    return '10 BERTURUT. Aku mulai curiga kamu pake cheat code. Serius, ini impressive banget.';
  }

  // Frustration support
  if (profile.consecutive_wrong === 3) {
    return 'Tiga salah bukan berarti kamu bodoh — berarti kamu lagi di edge of learning. Ayo kita pelan-pelan.';
  }
  if (profile.consecutive_wrong === 5) {
    return 'Aku tahu ini frustrating. Tapi orang yang berhenti di sini nggak akan pernah naik band. Kamu mau berhenti, atau mau aku pecah soalnya jadi lebih kecil?';
  }

  // Milestone messages
  if (profile.total_tutor_messages === 50) {
    return 'Fun fact: kamu udah kirim 50 pesan ke aku. Murid yang aktif kayak kamu biasanya naik 1 band dalam 2 bulan.';
  }
  if (profile.total_tutor_messages === 100) {
    return '100 pesan! Pada titik ini, aku udah lebih kenal kamu daripada kebanyakan tutormu di sekolah dulu.';
  }

  // Personal best
  if (profile.consecutive_correct === profile.longest_correct_streak && profile.longest_correct_streak >= 5) {
    return `PERSONAL BEST! Streak terpanjang kamu: ${profile.longest_correct_streak} benar berturut. Ini rekor baru!`;
  }

  return null;
}

// ═══════════════════════════════════════════════════════
// PROGRESS SUMMARY
// ═══════════════════════════════════════════════════════
export async function getProgressSummary(env: Env, userId: number): Promise<string> {
  const profile = await getStudentProfile(env, userId);
  const masteries = await getAllTopicMasteries(env, userId);

  const mastered = masteries.filter(m => m.status === 'mastered').length;
  const learning = masteries.filter(m => m.status === 'learning' || m.status === 'practicing').length;
  const dueReview = masteries.filter(m => m.status === 'needs_review').length;

  const weakest = masteries.filter(m => m.exercises_attempted >= 3).sort((a, b) => a.accuracy_percent - b.accuracy_percent).slice(0, 3);
  const strongest = masteries.filter(m => m.mastery_level >= 70).sort((a, b) => b.mastery_level - a.mastery_level).slice(0, 3);

  let summary = `Progress kamu sejauh ini:\n\n`;
  summary += `Topik dikuasai: ${mastered} | Sedang dipelajari: ${learning} | Perlu review: ${dueReview}\n`;
  summary += `Streak terpanjang: ${profile.longest_correct_streak} benar berturut\n`;
  summary += `Total sesi tutor: ${profile.total_tutor_sessions}\n\n`;

  if (strongest.length > 0) {
    summary += `Kekuatan: ${strongest.map(t => `${t.topic} (${t.mastery_level}%)`).join(', ')}\n`;
  }
  if (weakest.length > 0) {
    summary += `Perlu diperkuat: ${weakest.map(t => `${t.topic} (${t.accuracy_percent}%)`).join(', ')}\n`;
  }

  if (profile.frustration_score > 0.5) {
    summary += `\nAku lihat kamu sempat struggle belakangan. Nggak apa-apa — that's part of the process. Ayo fokus ke yang paling butuh perhatian.`;
  } else if (profile.confidence_score > 0.7) {
    summary += `\nKamu lagi di momentum bagus. Jangan berhenti sekarang — konsistensi > intensitas.`;
  }

  return summary;
}

// ═══════════════════════════════════════════════════════
// INTENT DETECTION — What does the student want?
// ═══════════════════════════════════════════════════════
interface DetectedIntent {
  type: 'topic_request' | 'exercise_request' | 'review_request' | 'progress_request' | 'answer' | 'question' | 'free_chat';
  topic?: string;
}

function detectIntent(message: string, profile: StudentProfile): DetectedIntent {
  const lower = message.toLowerCase().trim();

  // Topic requests
  const topicMap: Record<string, string> = {
    'article': 'articles', 'articles': 'articles', 'a/an/the': 'articles',
    'tense': 'tenses', 'tenses': 'tenses',
    'preposition': 'prepositions', 'prepositions': 'prepositions',
    'subject verb': 'sv_agreement', 'sv agreement': 'sv_agreement', 'subject-verb': 'sv_agreement',
    'passive': 'passive_voice', 'passive voice': 'passive_voice',
    'conditional': 'conditionals', 'conditionals': 'conditionals', 'if clause': 'conditionals',
    'relative clause': 'relative_clauses', 'who which that': 'relative_clauses',
    'word formation': 'word_formation', 'prefix suffix': 'word_formation',
    'vocabulary': 'academic_words', 'vocab': 'academic_words',
    'collocation': 'collocations', 'collocations': 'collocations',
    'paraphrase': 'paraphrasing', 'paraphrasing': 'paraphrasing',
    'reading': 'reading_main_idea', 'reading strategy': 'reading_strategy',
    'listening': 'listening_practice', 'listening strategy': 'listening_strategy',
    'speaking': 'speaking_templates', 'speaking template': 'speaking_templates',
    'writing': 'writing_templates', 'writing template': 'writing_templates',
    'pronunciation': 'pronunciation', 'linking words': 'linking_words',
  };

  // Check if message contains "belajar X" or "ajarkan X" or "mau X"
  const learnPatterns = /(?:belajar|ajarkan|ajarin|mau|bahas|pelajari|latihan)\s+(.+)/i;
  const match = lower.match(learnPatterns);
  if (match) {
    const requested = match[1].trim();
    for (const [key, topic] of Object.entries(topicMap)) {
      if (requested.includes(key)) {
        return { type: 'topic_request', topic };
      }
    }
  }

  // Direct topic mention
  for (const [key, topic] of Object.entries(topicMap)) {
    if (lower === key || lower === `topik ${key}`) {
      return { type: 'topic_request', topic };
    }
  }

  // Exercise/drill requests
  if (/(?:latihan|drill|soal|exercise|quiz|tes|ujian|coba soal)/i.test(lower)) {
    return { type: 'exercise_request' };
  }

  // Review requests
  if (/(?:review|ulang|ulangi|recap|revisi)/i.test(lower)) {
    return { type: 'review_request' };
  }

  // Progress requests
  if (/(?:progress|kemajuan|statistik|stats|sejauh mana|hasil)/i.test(lower)) {
    return { type: 'progress_request' };
  }

  // If student is in exercise/lesson mode and sends a short answer, it's likely an answer
  if (profile.tutor_mode !== 'free_chat' && profile.current_topic) {
    if (lower.length <= 60 || /^[a-d]$/i.test(lower) || /^(a|b|c|d)\)?\.?\s/i.test(lower)) {
      return { type: 'answer' };
    }
  }

  // Questions
  if (/\?$/.test(lower) || /(?:apa|kenapa|gimana|bagaimana|kapan|dimana|siapa|berapa|mengapa)/i.test(lower)) {
    return { type: 'question' };
  }

  return { type: 'free_chat' };
}

// ═══════════════════════════════════════════════════════
// LLM CALL WITH FALLBACK
// ═══════════════════════════════════════════════════════
async function callLLM(
  env: Env,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
): Promise<string> {
  // Try OpenAI first (gpt-4o — smarter multimodal)
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: maxTokens,
        temperature: 0.75,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (response.ok) {
      const data: any = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
    }

    // If OpenAI fails, try Anthropic if available
    if (env.ANTHROPIC_API_KEY) {
      return await callAnthropic(env.ANTHROPIC_API_KEY, systemPrompt, messages, maxTokens);
    }

    throw new Error('OpenAI returned empty response and no fallback available');
  } catch (e: any) {
    // Fallback to Anthropic
    if (env.ANTHROPIC_API_KEY) {
      try {
        return await callAnthropic(env.ANTHROPIC_API_KEY, systemPrompt, messages, maxTokens);
      } catch (fallbackErr) {
        console.error('Anthropic fallback also failed:', fallbackErr);
      }
    }
    throw e;
  }
}

async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
): Promise<string> {
  // Convert messages — Anthropic requires alternating user/assistant, no system in messages
  const anthropicMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

  // Inject system-role messages into the system prompt
  const systemMessages = messages.filter(m => m.role === 'system').map(m => m.content);
  const fullSystem = [systemPrompt, ...systemMessages].join('\n\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system: fullSystem,
      messages: anthropicMessages.length > 0 ? anthropicMessages : [{ role: 'user', content: '...' }],
    }),
  });

  const data: any = await response.json();
  return data.content?.[0]?.text || 'Maaf, ada gangguan. Coba lagi.';
}
