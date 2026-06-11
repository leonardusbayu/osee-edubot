// Fatigue detection during practice sessions (ROADMAP_M3 §2.2).
//
// A student grinding through questions while tired learns little and starts
// hating the app. We watch the current attempt for two signals:
//   - accuracy collapse: last 5 answers ≥20 points below the earlier average
//   - slowdown: last 5 answers take ≥2× the earlier average time
// and suggest a break once per attempt. Detection is logged for later
// validation; no schema changes.

import type { Env } from '../types';

export interface FatigueResult {
  fatigued: boolean;
  reason?: string;
  hint?: string;
}

const FATIGUE_HINT =
  'Otak kamu udah kasih sinyal — 5 soal terakhir melambat. Break 5 menit dulu, nanti lanjut. 🧘';

export async function checkFatigue(
  env: Env,
  userId: number,
  attemptId: number,
): Promise<FatigueResult> {
  try {
    const rows = await env.DB.prepare(
      `SELECT is_correct, time_spent_seconds FROM attempt_answers
       WHERE attempt_id = ? AND is_correct IS NOT NULL
       ORDER BY id ASC`
    ).bind(attemptId).all<{ is_correct: number; time_spent_seconds: number }>();
    const answers = rows.results || [];
    if (answers.length < 10) return { fatigued: false };

    const recent = answers.slice(-5);
    const earlier = answers.slice(0, -5);

    const acc = (xs: typeof answers) =>
      xs.reduce((s, a) => s + (Number(a.is_correct) ? 1 : 0), 0) / xs.length;
    const accDrop = acc(earlier) - acc(recent);

    // Time signal only when timing data is actually being recorded
    const timed = (xs: typeof answers) => xs.filter((a) => Number(a.time_spent_seconds) > 0);
    let slowdown = false;
    const earlierTimed = timed(earlier);
    const recentTimed = timed(recent);
    if (earlierTimed.length >= 5 && recentTimed.length >= 3) {
      const avg = (xs: typeof answers) =>
        xs.reduce((s, a) => s + Number(a.time_spent_seconds), 0) / xs.length;
      slowdown = avg(recentTimed) > 2 * avg(earlierTimed);
    }

    if (accDrop >= 0.2 || slowdown) {
      const reason = accDrop >= 0.2
        ? `accuracy drop ${(accDrop * 100).toFixed(0)}pp over last 5`
        : 'response time >2x earlier average';
      console.log(`[fatigue] user=${userId} attempt=${attemptId}: ${reason}`);
      return { fatigued: true, reason, hint: FATIGUE_HINT };
    }
    return { fatigued: false };
  } catch (e) {
    console.warn('[fatigue] check failed (non-fatal):', e);
    return { fatigued: false };
  }
}
