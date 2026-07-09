// Adaptive daily session engine.
//
// Replaces the fixed DAILY_LESSONS array with a personalized 20-minute
// session built from:
//   - FSRS due cards (review block)
//   - Weakest skill_tag (targeted practice block)
//   - IRT theta + 0.5 (stretch block)
//
// If the student has no IRT theta, no FSRS cards, and no weakness profile
// (brand new user), falls back to the existing DAILY_LESSONS logic in
// studyplan.ts — so /today still works for new users.
//
// Exam-taper: if the exam is <3 days away, return light review only.

import type { Env } from '../types';

export interface DailySessionBlock {
  type: 'review' | 'targeted_practice' | 'stretch' | 'light_review';
  title: string;
  duration_minutes: number;
  item_count: number;
  detail: string; // human-readable: "5 FSRS cards", "3 inference questions", etc
}

export interface DailySession {
  greeting: string;
  blocks: DailySessionBlock[];
  summary: string;
  exam_countdown: string | null;
}

export async function buildDailySession(env: Env, userId: number, userName: string): Promise<DailySession | null> {
  try {
    // 1. Fetch signals in parallel
    const [fsrsStats, weaknessProfile, irtProfile, studyPlan] = await Promise.all([
      import('../services/fsrs-engine').then(m => m.getReviewStats(env, userId)).catch(() => null),
      import('../services/weakness-analysis').then(m => m.getStudentWeaknessProfile(env, userId, userName)).catch(() => null),
      import('../services/irt-engine').then(m => m.getStudentIRTProfile(env.DB, userId)).catch(() => null),
      env.DB.prepare(
        `SELECT target_date FROM study_plans WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`
      ).bind(userId).first<{ target_date: string | null }>().catch(() => null),
    ]);

    // 2. Exam countdown
    let examCountdown: string | null = null;
    let daysToExam: number | null = null;
    if (studyPlan?.target_date) {
      const examMs = new Date(studyPlan.target_date).getTime();
      if (Number.isFinite(examMs)) {
        daysToExam = Math.max(0, Math.round((examMs - Date.now()) / (1000 * 60 * 60 * 24)));
        if (daysToExam === 0) examCountdown = '🎯 Ujian hari ini!';
        else if (daysToExam === 1) examCountdown = '🎯 Ujian besok!';
        else examCountdown = `🎯 Ujian ${daysToExam} hari lagi`;
      }
    }

    // 3. Exam taper: if <3 days, light review only
    if (daysToExam !== null && daysToExam < 3) {
      const dueCount = fsrsStats?.due || 0;
      const blocks: DailySessionBlock[] = [{
        type: 'light_review',
        title: 'Mode taper — review ringan',
        duration_minutes: 5,
        item_count: Math.min(dueCount, 5),
        detail: dueCount > 0
          ? `${Math.min(dueCount, 5)} kartu review (FSRS)`
          : 'Tidak ada yang due — santai aja, kamu siap!',
      }];
      return {
        greeting: `${userName}, ujian sebentar lagi! 🎯`,
        blocks,
        summary: 'Sekarang bukan waktunya belajar materi baru — cukup review yang sudah dipelajari. Istirahat cukup, kamu pasti bisa! 💪',
        exam_countdown: examCountdown,
      };
    }

    // 4. Build the 3-block session
    const blocks: DailySessionBlock[] = [];

    // Block 1: FSRS review (5 min if 10+ due, 3 min if <10 due)
    const dueCount = fsrsStats?.due || 0;
    if (dueCount > 0) {
      const reviewMins = dueCount >= 10 ? 5 : 3;
      const reviewCount = Math.min(dueCount, reviewMins === 5 ? 8 : 5);
      blocks.push({
        type: 'review',
        title: '🧠 Review',
        duration_minutes: reviewMins,
        item_count: reviewCount,
        detail: `${reviewCount} kartu review (FSRS)${dueCount > reviewCount ? ` dari ${dueCount} due` : ''}`,
      });
    }

    // Block 2: Targeted practice on weakest skill (10 min)
    const weaknesses = weaknessProfile?.weaknesses?.combined || [];
    if (weaknesses.length > 0) {
      const top = weaknesses[0];
      blocks.push({
        type: 'targeted_practice',
        title: '🎯 Targeted Practice',
        duration_minutes: 10,
        item_count: 3,
        detail: `3 soal ${top.skill.replace(/_/g, ' ')} (kelemahan utamamu)`,
      });
    }

    // Block 3: Stretch (5 min) — only if we have an IRT theta
    const abilities = irtProfile?.abilities || [];
    if (abilities.length > 0) {
      blocks.push({
        type: 'stretch',
        title: '🚀 Stretch',
        duration_minutes: 5,
        item_count: 2,
        detail: '2 soal di atas level kamu sekarang (theta + 0.5)',
      });
    }

    // 5. If no blocks at all (brand new user), return null to signal fallback
    if (blocks.length === 0) return null;

    // 6. Greeting + summary
    const totalMins = blocks.reduce((s, b) => s + b.duration_minutes, 0);
    const greeting = `Hai ${userName}! Siap belajar?`;
    const summary = `Sesi ${totalMins} menit: ` + blocks.map(b => `${b.duration_minutes}m ${b.type === 'review' ? 'review' : b.type === 'targeted_practice' ? 'practice' : 'stretch'}`).join(' → ');

    return { greeting, blocks, summary, exam_countdown: examCountdown };
  } catch (e: any) {
    console.error('[daily-session] error (non-fatal):', e?.message || e);
    return null;
  }
}