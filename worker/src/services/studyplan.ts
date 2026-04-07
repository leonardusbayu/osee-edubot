import type { Env, User } from '../types';

// ─── Test-specific topic orders ───────────────────────────────────────

const TOEFL_IBT_TOPICS = [
  // Priority 1: Core academic skills
  'academic_words', 'reading_strategy', 'listening_strategy',
  // Priority 2: Grammar fundamentals (Indonesian pain points)
  'articles', 'sv_agreement', 'tenses', 'prepositions',
  // Priority 3: Production skills
  'speaking_templates', 'writing_templates',
  // Priority 4: Advanced grammar
  'passive_voice', 'conditionals', 'relative_clauses', 'word_formation',
  // Priority 5: Polish
  'collocations', 'paraphrasing', 'pronunciation', 'linking_words',
  // Priority 6: Note-taking & integrated tasks
  'note_taking', 'integrated_writing', 'integrated_speaking',
];

const TOEFL_ITP_TOPICS = [
  // Priority 1: Structure & Written Expression (biggest section)
  'sv_agreement', 'tenses', 'articles', 'prepositions',
  'passive_voice', 'conditionals', 'relative_clauses',
  // Priority 2: Error identification (key ITP skill)
  'word_formation', 'parallelism', 'sentence_completion',
  // Priority 3: Reading Comprehension
  'reading_strategy', 'academic_words', 'paraphrasing',
  // Priority 4: Listening Comprehension
  'listening_strategy', 'collocations',
  // Priority 5: Polish
  'linking_words', 'pronunciation',
];

const IELTS_TOPICS = [
  // Priority 1: Speaking & Writing (biggest differentiator)
  'speaking_templates', 'writing_templates', 'pronunciation',
  // Priority 2: Grammar for production
  'tenses', 'conditionals', 'relative_clauses', 'passive_voice',
  // Priority 3: Vocabulary
  'academic_words', 'collocations', 'word_formation', 'paraphrasing',
  // Priority 4: Receptive skills
  'reading_strategy', 'listening_strategy',
  // Priority 5: IELTS-specific
  'true_false_not_given', 'matching_headings', 'cue_card_speaking',
  // Priority 6: Polish
  'articles', 'prepositions', 'linking_words',
];

const TOEIC_TOPICS = [
  // Priority 1: Business vocabulary & reading
  'business_vocabulary', 'business_reading', 'business_writing',
  // Priority 2: Listening (50% of test)
  'listening_strategy', 'collocations',
  // Priority 3: Grammar (common in Part 5-6)
  'tenses', 'sv_agreement', 'prepositions', 'articles',
  'passive_voice', 'word_formation',
  // Priority 4: Reading comprehension
  'reading_strategy', 'paraphrasing',
  // Priority 5: Polish
  'conditionals', 'relative_clauses', 'linking_words',
];

// ─── Test-specific scoring targets ────────────────────────────────────

interface TestConfig {
  topics: string[];
  targetLabel: string;
  targetValue: string;
  dbTargetBand: number; // stored in study_plans.target_band
  dailySchedule: { morning: string; afternoon: string; evening: string; night: string; totalMin: number };
}

const TEST_CONFIGS: Record<string, TestConfig> = {
  TOEFL_IBT: {
    topics: TOEFL_IBT_TOPICS,
    targetLabel: 'Band',
    targetValue: '4',
    dbTargetBand: 4.0,
    dailySchedule: {
      morning: '1 pelajaran + 5 vocab (10 min)',
      afternoon: '5 soal drill (10 min)',
      evening: '1 integrated task (10 min)',
      night: 'Review kesalahan (10 min)',
      totalMin: 40,
    },
  },
  TOEFL_ITP: {
    topics: TOEFL_ITP_TOPICS,
    targetLabel: 'Score',
    targetValue: '500',
    dbTargetBand: 500,
    dailySchedule: {
      morning: '1 pelajaran grammar (10 min)',
      afternoon: '10 soal Structure (10 min)',
      evening: '1 Reading passage (10 min)',
      night: 'Review kesalahan (10 min)',
      totalMin: 40,
    },
  },
  IELTS: {
    topics: IELTS_TOPICS,
    targetLabel: 'Band',
    targetValue: '6.0',
    dbTargetBand: 6.0,
    dailySchedule: {
      morning: '1 pelajaran + speaking practice (15 min)',
      afternoon: '5 soal drill (10 min)',
      evening: '1 writing task (15 min)',
      night: 'Review kesalahan (10 min)',
      totalMin: 50,
    },
  },
  TOEIC: {
    topics: TOEIC_TOPICS,
    targetLabel: 'Score',
    targetValue: '600',
    dbTargetBand: 600,
    dailySchedule: {
      morning: '1 pelajaran + business vocab (10 min)',
      afternoon: '10 soal Listening (15 min)',
      evening: '10 soal Reading (15 min)',
      night: 'Review kesalahan (10 min)',
      totalMin: 50,
    },
  },
};

function getTestConfig(targetTest: string): TestConfig {
  return TEST_CONFIGS[targetTest] || TEST_CONFIGS['TOEFL_IBT'];
}

// ─── Main study plan generator ────────────────────────────────────────

export async function generateStudyPlan(
  env: Env,
  userId: number,
  targetDate: string,
  weaknesses: string[],
  targetTest?: string,
): Promise<string> {
  // Resolve test type: param > user setting > default
  let testType: string = targetTest || '';
  if (!testType) {
    const userRow = await env.DB.prepare(
      'SELECT target_test FROM users WHERE id = ?'
    ).bind(userId).first() as any;
    testType = userRow?.target_test || 'TOEFL_IBT';
  }

  const config = getTestConfig(testType);

  // Calculate days
  const target = new Date(targetDate);
  const now = new Date();
  const totalDays = Math.max(7, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // Prioritize weaknesses first, then fill with test-specific topics
  const orderedTopics: string[] = [];

  // Weaknesses first (repeat them more)
  for (const w of weaknesses) {
    if (!orderedTopics.includes(w)) orderedTopics.push(w);
  }
  // Then rest from test-specific order
  for (const t of config.topics) {
    if (!orderedTopics.includes(t)) orderedTopics.push(t);
  }

  // Build daily curriculum
  const plan: { week: number; day: number; date: string; topic: string; type: string }[] = [];

  let topicIndex = 0;
  const startDate = new Date();

  for (let day = 0; day < totalDays; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];
    const week = Math.floor(day / 7) + 1;
    const dayOfWeek = day % 7;

    // Day pattern: lesson → drill → lesson → drill → review → mini test → rest
    let type = 'lesson';
    if (dayOfWeek === 1 || dayOfWeek === 3) type = 'drill';
    if (dayOfWeek === 4) type = 'review';
    if (dayOfWeek === 5) type = 'mini_test';
    if (dayOfWeek === 6) type = 'rest';

    // Pick topic (cycle through, repeating weaknesses more)
    let topic = orderedTopics[topicIndex % orderedTopics.length];

    // Weaknesses get extra repetition in early weeks
    if (week <= 2 && weaknesses.length > 0) {
      topic = weaknesses[day % weaknesses.length];
    }

    if (type !== 'rest' && type !== 'review' && type !== 'mini_test') {
      topicIndex++;
    }

    plan.push({ week, day: day + 1, date: dateStr, topic, type });
  }

  // Save to D1
  await env.DB.prepare(
    `INSERT INTO study_plans (user_id, target_band, target_date, total_days, current_day, plan_data, status)
     VALUES (?, ?, ?, ?, 0, ?, 'active')`
  ).bind(userId, config.dbTargetBand, targetDate, totalDays, JSON.stringify(plan)).run();

  // Format plan message
  const testLabel = testType.replace(/_/g, ' ');
  let msg = `📋 STUDY PLAN ${testLabel}: ${totalDays} hari menuju ${config.targetLabel} ${config.targetValue}\n`;
  msg += `Target: ${target.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n`;

  if (weaknesses.length > 0) {
    msg += `🎯 Fokus utama: ${weaknesses.map(w => w.replace(/_/g, ' ')).join(', ')}\n\n`;
  }

  // Show first 2 weeks
  const maxShow = Math.min(14, totalDays);
  let currentWeek = 0;

  for (let i = 0; i < maxShow; i++) {
    const p = plan[i];
    if (p.week !== currentWeek) {
      currentWeek = p.week;
      msg += `\n📅 Minggu ${currentWeek}:\n`;
    }

    const dayLabel = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][i % 7];
    const typeEmoji: Record<string, string> = {
      lesson: '📖', drill: '🏋️', review: '🔄', mini_test: '🧠', rest: '😴',
    };

    if (p.type === 'rest') {
      msg += `  ${dayLabel}: ${typeEmoji[p.type]} Istirahat\n`;
    } else {
      msg += `  ${dayLabel}: ${typeEmoji[p.type]} ${p.topic.replace(/_/g, ' ')}\n`;
    }
  }

  if (totalDays > 14) {
    msg += `\n... dan ${totalDays - 14} hari lagi\n`;
  }

  msg += `\n⏰ Jadwal harian ${testLabel}:\n`;
  msg += `  Pagi: ${config.dailySchedule.morning}\n`;
  msg += `  Siang: ${config.dailySchedule.afternoon}\n`;
  msg += `  Sore: ${config.dailySchedule.evening}\n`;
  msg += `  Malam: ${config.dailySchedule.night}\n`;
  msg += `  Total: ~${config.dailySchedule.totalMin} min/hari\n`;
  msg += `\nAku akan kirim reminder setiap hari. Ketik /today untuk lihat pelajaran hari ini.`;

  return msg;
}

export async function getTodayLesson(env: Env, userId: number): Promise<string | null> {
  const plan = await env.DB.prepare(
    "SELECT * FROM study_plans WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
  ).bind(userId).first() as any;

  if (!plan) return null;

  const planData = JSON.parse(plan.plan_data || '[]');
  const currentDay = plan.current_day;

  if (currentDay >= planData.length) {
    return '🎉 Study plan kamu sudah selesai! Ketik /diagnostic untuk tes ulang dan lihat progress.';
  }

  const today = planData[currentDay];

  // Advance day counter
  await env.DB.prepare(
    "UPDATE study_plans SET current_day = ? WHERE id = ?"
  ).bind(currentDay + 1, plan.id).run();

  // Check for overdue spaced repetition items
  let reviewReminder = '';
  try {
    const overdueCount = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM spaced_repetition WHERE user_id = ? AND next_review <= datetime('now') AND status = 'active'"
    ).bind(userId).first() as any;
    if (overdueCount?.cnt > 0) {
      reviewReminder = `\n\n🔄 Kamu punya ${overdueCount.cnt} soal review yang menunggu. Ketik /review untuk mengulangnya.`;
    }
  } catch {
    // spaced_repetition table might not exist — ignore
  }

  if (today.type === 'rest') {
    return `😴 Hari ini istirahat. Otak butuh waktu untuk memproses yang sudah dipelajari. Besok kita lanjut!${reviewReminder}`;
  }

  if (today.type === 'review') {
    return `🔄 Hari ini: REVIEW\n\nCoba buka /study dan ulangi topik yang kemarin salah. Atau ketik soal yang masih bingung, nanti aku jelaskan.${reviewReminder || '\n\nKetik /review untuk latihan spaced repetition.'}`;
  }

  if (today.type === 'mini_test') {
    return `🧠 Hari ini: MINI TEST\n\nBuka "Latihan Tes" dan kerjakan 10 soal dari section manapun. Ini untuk cek progress mingguan kamu.${reviewReminder}`;
  }

  return `📖 Pelajaran hari ini (Hari ${currentDay + 1}/${planData.length}):\n\nTopik: ${today.topic.replace(/_/g, ' ')}\nTipe: ${today.type === 'drill' ? 'Latihan drill' : 'Pelajaran baru'}\n\nKetik /study lalu pilih "${today.topic.replace(/_/g, ' ')}" untuk mulai.${reviewReminder}`;
}
