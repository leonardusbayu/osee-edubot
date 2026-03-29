import type { Env, User } from '../types';

const TOPIC_ORDER = [
  // Priority 1: Most common Indonesian errors
  'articles', 'sv_agreement', 'tenses', 'prepositions',
  // Priority 2: Next level grammar
  'passive_voice', 'conditionals', 'relative_clauses', 'word_formation',
  // Priority 3: Vocabulary
  'academic_words', 'collocations', 'paraphrasing',
  // Priority 4: Skills
  'reading_strategy', 'listening_strategy',
  // Priority 5: Templates
  'speaking_templates', 'writing_templates',
  // Priority 6: Polish
  'pronunciation', 'linking_words',
];

export async function generateStudyPlan(
  env: Env,
  userId: number,
  targetDate: string,
  weaknesses: string[],
): Promise<string> {
  // Calculate days
  const target = new Date(targetDate);
  const now = new Date();
  const totalDays = Math.max(7, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // Prioritize weaknesses first, then fill with other topics
  const orderedTopics: string[] = [];

  // Weaknesses first (repeat them more)
  for (const w of weaknesses) {
    if (!orderedTopics.includes(w)) orderedTopics.push(w);
  }
  // Then rest
  for (const t of TOPIC_ORDER) {
    if (!orderedTopics.includes(t)) orderedTopics.push(t);
  }

  // Build daily curriculum
  const weeks = Math.ceil(totalDays / 7);
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
     VALUES (?, 4.0, ?, ?, 0, ?, 'active')`
  ).bind(userId, targetDate, totalDays, JSON.stringify(plan)).run();

  // Format plan message
  let msg = `STUDY PLAN: ${totalDays} hari menuju Band 4\n`;
  msg += `Target: ${target.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n`;

  if (weaknesses.length > 0) {
    msg += `Fokus utama: ${weaknesses.join(', ')}\n\n`;
  }

  // Show first 2 weeks
  const maxShow = Math.min(14, totalDays);
  let currentWeek = 0;

  for (let i = 0; i < maxShow; i++) {
    const p = plan[i];
    if (p.week !== currentWeek) {
      currentWeek = p.week;
      msg += `\nMinggu ${currentWeek}:\n`;
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

  msg += `\nSetiap hari:\n`;
  msg += `  Pagi: 1 pelajaran (5 min)\n`;
  msg += `  Siang: 5 soal drill (5 min)\n`;
  msg += `  Sore: 1 mini test (5 min)\n`;
  msg += `  Malam: Review kesalahan (5 min)\n`;
  msg += `  Total: ~20 min/hari\n`;
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
    return 'Study plan kamu sudah selesai! Ketik /diagnostic untuk tes ulang dan lihat progress.';
  }

  const today = planData[currentDay];

  // Advance day counter
  await env.DB.prepare(
    "UPDATE study_plans SET current_day = ? WHERE id = ?"
  ).bind(currentDay + 1, plan.id).run();

  if (today.type === 'rest') {
    return 'Hari ini istirahat. Otak butuh waktu untuk memproses yang sudah dipelajari. Besok kita lanjut!';
  }

  if (today.type === 'review') {
    return `Hari ini: REVIEW\n\nCoba buka /study dan ulangi topik yang kemarin salah. Atau ketik soal yang masih bingung, nanti aku jelaskan.`;
  }

  if (today.type === 'mini_test') {
    return `Hari ini: MINI TEST\n\nBuka "Latihan Tes" dan kerjakan 10 soal dari section manapun. Ini untuk cek progress mingguan kamu.`;
  }

  return `Pelajaran hari ini (Hari ${currentDay + 1}/${planData.length}):\n\nTopik: ${today.topic.replace(/_/g, ' ')}\nTipe: ${today.type === 'drill' ? 'Latihan drill' : 'Pelajaran baru'}\n\nKetik /study lalu pilih "${today.topic.replace(/_/g, ' ')}" untuk mulai.`;
}
