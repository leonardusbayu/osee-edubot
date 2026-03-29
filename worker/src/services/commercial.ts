/**
 * Commercial Features — Trial, Gamification, Referrals, Certificates, Analytics
 */
import type { Env } from '../types';

const FREE_DAILY_LIMIT = 10;
const XP_PER_QUESTION = 10;
const XP_PER_CORRECT = 5;
const XP_PER_STREAK = 20;
const XP_PER_DIAGNOSTIC = 50;
const XP_PER_REFERRAL = 100;

const LEVELS = [
  { level: 1, xp: 0, name: 'Pemula' },
  { level: 2, xp: 100, name: 'Pelajar' },
  { level: 3, xp: 300, name: 'Rajin' },
  { level: 4, xp: 600, name: 'Terampil' },
  { level: 5, xp: 1000, name: 'Mahir' },
  { level: 6, xp: 1500, name: 'Ahli' },
  { level: 7, xp: 2500, name: 'Master' },
  { level: 8, xp: 4000, name: 'Champion' },
  { level: 9, xp: 6000, name: 'Legend' },
  { level: 10, xp: 10000, name: 'TOEFL/IELTS Pro' },
];

const BADGES = {
  first_test: { name: 'Tes Pertama', emoji: '🎯', condition: 'Complete first test' },
  streak_3: { name: '3 Hari Berturut', emoji: '🔥', condition: '3-day streak' },
  streak_7: { name: '7 Hari Berturut', emoji: '💪', condition: '7-day streak' },
  streak_30: { name: '30 Hari Berturut', emoji: '🏆', condition: '30-day streak' },
  questions_50: { name: '50 Soal', emoji: '📝', condition: 'Answer 50 questions' },
  questions_100: { name: '100 Soal', emoji: '📚', condition: 'Answer 100 questions' },
  questions_500: { name: '500 Soal', emoji: '🎓', condition: 'Answer 500 questions' },
  accuracy_80: { name: 'Akurasi 80%', emoji: '🎯', condition: '80% accuracy overall' },
  band_4: { name: 'Band 4+', emoji: '⭐', condition: 'Score Band 4 or higher' },
  referrer: { name: 'Influencer', emoji: '🤝', condition: 'Refer a friend' },
  diagnostic: { name: 'Self-Aware', emoji: '🧠', condition: 'Complete diagnostic test' },
};

// --- Gamification ---

export async function getOrCreateGamification(env: Env, userId: number) {
  let g = await env.DB.prepare('SELECT * FROM user_gamification WHERE user_id = ?').bind(userId).first() as any;
  if (!g) {
    const code = 'OSEE' + Math.random().toString(36).substring(2, 8).toUpperCase();
    await env.DB.prepare(
      'INSERT INTO user_gamification (user_id, referral_code) VALUES (?, ?)'
    ).bind(userId, code).run();
    g = await env.DB.prepare('SELECT * FROM user_gamification WHERE user_id = ?').bind(userId).first();
  }
  return g as any;
}

export async function addXP(env: Env, userId: number, amount: number, reason: string): Promise<{ newXP: number; levelUp: boolean; newLevel: number; newLevelName: string }> {
  const g = await getOrCreateGamification(env, userId);
  const newXP = (g.xp || 0) + amount;
  const oldLevel = g.level || 1;
  const newLevel = LEVELS.filter(l => newXP >= l.xp).pop() || LEVELS[0];

  await env.DB.prepare(
    'UPDATE user_gamification SET xp = ?, level = ?, total_questions = total_questions + 1 WHERE user_id = ?'
  ).bind(newXP, newLevel.level, userId).run();

  // Log analytics
  await logEvent(env, userId, 'xp_earned', { amount, reason, total: newXP });

  return {
    newXP,
    levelUp: newLevel.level > oldLevel,
    newLevel: newLevel.level,
    newLevelName: newLevel.name,
  };
}

export async function checkAndAwardBadges(env: Env, userId: number, stats: any): Promise<string[]> {
  const g = await getOrCreateGamification(env, userId);
  const existing = JSON.parse(g.badges || '[]') as string[];
  const newBadges: string[] = [];

  const checks: [string, boolean][] = [
    ['first_test', stats.totalTests >= 1],
    ['streak_3', stats.streak >= 3],
    ['streak_7', stats.streak >= 7],
    ['streak_30', stats.streak >= 30],
    ['questions_50', stats.totalQuestions >= 50],
    ['questions_100', stats.totalQuestions >= 100],
    ['questions_500', stats.totalQuestions >= 500],
    ['accuracy_80', stats.accuracy >= 80],
    ['band_4', stats.bestBand >= 4],
    ['referrer', (g.referral_count || 0) >= 1],
    ['diagnostic', stats.diagnosticDone],
  ];

  for (const [badge, earned] of checks) {
    if (earned && !existing.includes(badge)) {
      existing.push(badge);
      newBadges.push(badge);
    }
  }

  if (newBadges.length > 0) {
    await env.DB.prepare('UPDATE user_gamification SET badges = ? WHERE user_id = ?')
      .bind(JSON.stringify(existing), userId).run();
  }

  return newBadges;
}

export function formatBadges(badgeIds: string[]): string {
  return badgeIds.map(id => {
    const b = BADGES[id as keyof typeof BADGES];
    return b ? `${b.emoji} ${b.name}` : id;
  }).join(' | ');
}

export function formatLevel(level: number, xp: number): string {
  const l = LEVELS.find(lv => lv.level === level) || LEVELS[0];
  const next = LEVELS.find(lv => lv.level === level + 1);
  const progress = next ? Math.round(((xp - l.xp) / (next.xp - l.xp)) * 100) : 100;
  return `Level ${level} — ${l.name} (${xp} XP${next ? `, ${progress}% ke level ${level + 1}` : ''})`;
}

// --- Free Trial / Paywall ---

export async function checkDailyLimit(env: Env, userId: number): Promise<{ allowed: boolean; used: number; limit: number; isPremium: boolean }> {
  const g = await getOrCreateGamification(env, userId);
  const today = new Date().toISOString().split('T')[0];

  if (g.is_premium) return { allowed: true, used: 0, limit: 999, isPremium: true };

  if (g.daily_limit_date !== today) {
    await env.DB.prepare('UPDATE user_gamification SET daily_limit_used = 0, daily_limit_date = ? WHERE user_id = ?')
      .bind(today, userId).run();
    return { allowed: true, used: 0, limit: FREE_DAILY_LIMIT, isPremium: false };
  }

  return {
    allowed: (g.daily_limit_used || 0) < FREE_DAILY_LIMIT,
    used: g.daily_limit_used || 0,
    limit: FREE_DAILY_LIMIT,
    isPremium: false,
  };
}

export async function incrementDailyUsage(env: Env, userId: number) {
  const today = new Date().toISOString().split('T')[0];
  await env.DB.prepare(
    'UPDATE user_gamification SET daily_limit_used = daily_limit_used + 1, daily_limit_date = ? WHERE user_id = ?'
  ).bind(today, userId).run();
}

export function formatPaywall(): string {
  return `Batas harian tercapai (${FREE_DAILY_LIMIT} soal/hari).\n\n` +
    `Upgrade ke Premium untuk:\n` +
    `- Soal unlimited\n` +
    `- Speaking evaluation\n` +
    `- Personalized study plan\n` +
    `- Sertifikat digital\n\n` +
    `Hubungi: wa.me/628112647784\n` +
    `Atau kunjungi: osee.co.id/tutor`;
}

// --- Referral System ---

export async function processReferral(env: Env, newUserId: number, referralCode: string): Promise<string | null> {
  const referrer = await env.DB.prepare(
    'SELECT user_id FROM user_gamification WHERE referral_code = ?'
  ).bind(referralCode.toUpperCase()).first() as any;

  if (!referrer || referrer.user_id === newUserId) return null;

  // Mark new user as referred
  await env.DB.prepare(
    'UPDATE user_gamification SET referred_by = ? WHERE user_id = ?'
  ).bind(referrer.user_id, newUserId).run();

  // Give referrer bonus
  await env.DB.prepare(
    'UPDATE user_gamification SET referral_count = referral_count + 1, xp = xp + ? WHERE user_id = ?'
  ).bind(XP_PER_REFERRAL, referrer.user_id).run();

  // Give new user bonus
  await addXP(env, newUserId, 50, 'referral_bonus');

  return referrer.user_id;
}

// --- Certificate ---

export async function generateCertificate(env: Env, userId: number, userName: string, testType: string, score: number, band: number): Promise<string> {
  const certId = `OSEE-${testType}-${Date.now().toString(36).toUpperCase()}`;
  const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const certText =
    `SERTIFIKAT LATIHAN\n` +
    `OSEE English Education\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Diberikan kepada:\n` +
    `${userName}\n\n` +
    `Telah menyelesaikan:\n` +
    `${testType === 'IELTS' ? 'IELTS Academic' : 'TOEFL iBT 2026'} Practice Test\n\n` +
    `Skor: Band ${band}\n` +
    `Tanggal: ${date}\n` +
    `ID Sertifikat: ${certId}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `OSEE.CO.ID — Authorized TOEFL Test Center\n` +
    `Catatan: Ini adalah sertifikat latihan, bukan skor resmi.`;

  await env.DB.prepare(
    'INSERT INTO certificates (user_id, cert_type, test_type, score, band, cert_data) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(userId, 'practice', testType, score, band, certText).run();

  return certText;
}

// --- Analytics ---

export async function logEvent(env: Env, userId: number | null, event: string, data: any = {}) {
  try {
    await env.DB.prepare(
      'INSERT INTO analytics (user_id, event, data) VALUES (?, ?, ?)'
    ).bind(userId, event, JSON.stringify(data)).run();
  } catch {}
}

// --- Weekly Report ---

export async function generateWeeklyReport(env: Env, userId: number, userName: string): Promise<string> {
  // Get this week's stats
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const answers = await env.DB.prepare(
    `SELECT COUNT(*) as total, SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) as correct
     FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id=ta.id
     WHERE ta.user_id=? AND aa.submitted_at>=?`
  ).bind(userId, weekAgo).first() as any;

  const tests = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM test_attempts WHERE user_id=? AND status='completed' AND started_at>=?"
  ).bind(userId, weekAgo).first() as any;

  const g = await getOrCreateGamification(env, userId);

  const total = answers?.total || 0;
  const correct = answers?.correct || 0;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  let report = `Laporan Mingguan — ${userName}\n`;
  report += `${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n`;
  report += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  report += `Soal dijawab: ${total}\n`;
  report += `Benar: ${correct} (${accuracy}%)\n`;
  report += `Tes selesai: ${tests?.count || 0}\n`;
  report += `XP: ${g.xp || 0} | Level: ${g.level || 1}\n`;

  const badges = JSON.parse(g.badges || '[]');
  if (badges.length > 0) {
    report += `Badges: ${formatBadges(badges)}\n`;
  }

  report += `\n`;
  if (total === 0) {
    report += `Kamu belum latihan minggu ini. Yuk mulai! Ketik /study`;
  } else if (accuracy >= 80) {
    report += `Akurasi tinggi! Terus pertahankan!`;
  } else if (accuracy >= 60) {
    report += `Progress bagus. Fokus di area yang masih lemah.`;
  } else {
    report += `Perlu latihan lebih. Review kesalahan kamu dengan /review`;
  }

  return report;
}

// --- Terms of Service ---

export const TERMS_OF_SERVICE = `Syarat & Ketentuan EduBot OSEE

1. Layanan ini adalah alat bantu belajar, BUKAN tes resmi.
2. Skor yang diberikan adalah estimasi dan tidak mewakili skor resmi ETS/British Council.
3. Data kamu disimpan untuk melacak progress dan meningkatkan layanan.
4. Konten soal bersifat latihan dan tidak boleh dibagikan ulang.
5. Penggunaan berlebihan atau penyalahgunaan dapat mengakibatkan pembatasan akses.

Dengan menggunakan bot ini, kamu menyetujui syarat di atas.

OSEE.CO.ID — Authorized TOEFL Test Center
WA: +62 811-2647-784`;

export async function acceptToS(env: Env, userId: number) {
  await env.DB.prepare(
    'UPDATE user_gamification SET tos_accepted = 1, tos_accepted_at = ? WHERE user_id = ?'
  ).bind(new Date().toISOString(), userId).run();
}
