// Study Phase Tracking — detect where a student is in their study journey
// Phases: onboarding → foundation → building → refining → test_ready

import type { Env } from '../types';

export type StudyPhase = 'onboarding' | 'foundation' | 'building' | 'refining' | 'test_ready' | 'maintenance';

export interface PhaseInfo {
  phase: StudyPhase;
  phaseName: string;
  emoji: string;
  description: string;
  recommendations: string[];
  progress: number;     // 0-100 within the current phase
  daysSinceStart: number;
  testsCompleted: number;
  averageScore: number;
  streakDays: number;
  weakTopicsCount: number;
}

const PHASE_CONFIG: Record<StudyPhase, { name: string; emoji: string; description: string; recommendations: string[] }> = {
  onboarding: {
    name: 'Onboarding',
    emoji: '🌱',
    description: 'Baru mulai! Fokus kenali bot dan ambil diagnostic test.',
    recommendations: [
      'Ketik /diagnostic untuk tes penempatan',
      'Jelajahi /study untuk lihat topik',
      'Coba /vocab untuk belajar 5 kata pertama',
    ],
  },
  foundation: {
    name: 'Foundation',
    emoji: '📚',
    description: 'Bangun fondasi grammar + vocabulary dasar.',
    recommendations: [
      'Latihan 10-15 soal/hari untuk membangun konsistensi',
      'Fokus grammar fundamentals: tenses, articles, prepositions',
      'Pelajari 5-10 vocab baru/hari via /vocab',
    ],
  },
  building: {
    name: 'Building',
    emoji: '🏗️',
    description: 'Tingkatkan skill kompleks dan test familiarity.',
    recommendations: [
      'Mix practice: reading + listening setiap hari',
      'Coba /drill untuk pronunciation + prosody',
      'Mulai writing practice via /template',
    ],
  },
  refining: {
    name: 'Refining',
    emoji: '🎯',
    description: 'Perbaiki kelemahan spesifik, polishing skills.',
    recommendations: [
      'Identifikasi 2-3 weak topics via /progress',
      'Gunakan /lesson untuk targeted practice',
      'Tingkatkan listening dengan /listen',
    ],
  },
  test_ready: {
    name: 'Test-Ready',
    emoji: '🏆',
    description: 'Siap ujian! Latihan simulasi full test.',
    recommendations: [
      'Full practice tests via /test',
      'Time management practice',
      'Review mistakes dari test sebelumnya',
    ],
  },
  maintenance: {
    name: 'Maintenance',
    emoji: '🔄',
    description: 'Pertahankan skill dengan review berkala.',
    recommendations: [
      'Daily review via /review (FSRS)',
      'Latihan 1 section per hari',
      'Cek /progress untuk monitor regression',
    ],
  },
};

/**
 * Detect student's current study phase based on activity history.
 */
export async function detectPhase(env: Env, userId: number): Promise<PhaseInfo> {
  // Get key signals
  const user = await env.DB.prepare(
    'SELECT created_at, proficiency_level FROM users WHERE id = ?'
  ).bind(userId).first<{ created_at: string; proficiency_level: string }>();

  const testStats = await env.DB.prepare(
    `SELECT
       COUNT(*) as total,
       COALESCE(AVG(percentage_score), 0) as avgScore,
       COALESCE(MAX(percentage_score), 0) as bestScore
     FROM test_attempts WHERE user_id = ? AND status = 'completed'`
  ).bind(userId).first<{ total: number; avgScore: number; bestScore: number }>();

  const masteryCount = await env.DB.prepare(
    `SELECT COUNT(*) as weak FROM topic_mastery WHERE user_id = ? AND mastery_score < 0.5`
  ).bind(userId).first<{ weak: number }>();

  const streak = await env.DB.prepare(
    `SELECT current_streak FROM study_streaks WHERE user_id = ?`
  ).bind(userId).first<{ current_streak: number }>();

  // Compute days since start
  let daysSinceStart = 0;
  if (user?.created_at) {
    const start = new Date(user.created_at + 'Z').getTime();
    daysSinceStart = Math.floor((Date.now() - start) / 86400000);
  }
  const testsCompleted = testStats?.total ?? 0;
  const avgScore = Math.round(testStats?.avgScore ?? 0);
  const weakCount = masteryCount?.weak ?? 0;
  const streakDays = streak?.current_streak ?? 0;

  // Phase detection logic
  let phase: StudyPhase = 'onboarding';
  let progress = 0;

  if (testsCompleted === 0) {
    phase = 'onboarding';
    progress = Math.min(50, daysSinceStart * 5); // 10 days to 50%
  } else if (testsCompleted < 5 || avgScore < 50) {
    phase = 'foundation';
    progress = Math.min(100, testsCompleted * 20);
  } else if (testsCompleted < 15 || avgScore < 70 || weakCount > 8) {
    phase = 'building';
    progress = Math.min(100, Math.round((testsCompleted - 5) * 10 + (avgScore - 50)));
  } else if (testsCompleted < 30 || weakCount > 3) {
    phase = 'refining';
    progress = Math.min(100, Math.round((testsCompleted - 15) * 7 + (avgScore - 70)));
  } else if (avgScore >= 80 && weakCount <= 2) {
    phase = 'test_ready';
    progress = 100;
  } else {
    // Many tests but still weak areas → refining
    phase = 'refining';
    progress = 50;
  }

  // Maintenance: experienced student with low recent activity
  if (testsCompleted >= 10 && streakDays === 0 && daysSinceStart > 14) {
    phase = 'maintenance';
    progress = Math.max(0, 100 - streakDays * 10);
  }

  const config = PHASE_CONFIG[phase];
  return {
    phase,
    phaseName: config.name,
    emoji: config.emoji,
    description: config.description,
    recommendations: config.recommendations,
    progress: Math.max(0, Math.min(100, progress)),
    daysSinceStart,
    testsCompleted,
    averageScore: avgScore,
    streakDays,
    weakTopicsCount: weakCount,
  };
}

export async function savePhaseSnapshot(env: Env, userId: number, phase: StudyPhase, snapshot: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO student_phase_history (user_id, phase, snapshot, created_at)
     VALUES (?, ?, ?, datetime('now'))`
  ).bind(userId, phase, snapshot).run();
}

export async function getLatestPhase(env: Env, userId: number): Promise<{ phase: StudyPhase; created_at: string } | null> {
  const row = await env.DB.prepare(
    `SELECT phase, created_at FROM student_phase_history
     WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(userId).first<{ phase: StudyPhase; created_at: string }>();
  return row || null;
}

export function formatPhaseInfo(info: PhaseInfo): string {
  const lines: string[] = [];
  lines.push(`${info.emoji} *Phase: ${info.phaseName}* (${info.progress}% dalam phase ini)\n`);
  lines.push(`_${info.description}_\n`);
  lines.push(`📊 *Stats:*`);
  lines.push(`• Days studying: *${info.daysSinceStart}*`);
  lines.push(`• Tests completed: *${info.testsCompleted}*`);
  lines.push(`• Average score: *${info.averageScore}%*`);
  lines.push(`• Current streak: *${info.streakDays} days*`);
  lines.push(`• Weak topics: *${info.weakTopicsCount}*`);
  lines.push(`\n💡 *Rekomendasi:*`);
  for (const rec of info.recommendations) {
    lines.push(`• ${rec}`);
  }
  return lines.join('\n');
}
