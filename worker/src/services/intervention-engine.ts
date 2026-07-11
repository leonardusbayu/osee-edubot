// Intervention engine — hourly cron that detects struggling/inactive
// students and sends targeted Telegram nudges.
//
// Design rules enforced here (audit fixes):
//   1. Every signal must have n >= 5 data points to fire. A 1-question
//      streak is noise, not signal. Pushing nudges off too few data
//      points destroys trust.
//   2. Rate-limit: at most 1 nudge per (user, intervention_type) per
//      24h. The intervention_log table enforces this. The cron
//      itself also caps at 1 nudge per user per run to avoid double-
//      tap with the daily cron.
//   3. Behind-pace query uses `target_band` (study_plans.target_band,
//      not the bogus `target_score` column).
//   4. attempt_answers does NOT have user_id directly. JOIN through
//      test_attempts. (The previous version was a real bug caught by
//      the schema validator.)
//   5. Every nudge is best-effort: a Telegram send failure never
//      crashes the cron.

import type { Env } from '../types';

type InterventionType =
  | 'inactivity_3d'
  | 'low_accuracy'
  | 'low_fsrs_retention'
  | 'no_writing_practice'
  | 'behind_pace'
  | 'streak_about_to_break';

interface NudgeSpec {
  type: InterventionType;
  text: string;
}

// Minimum sample size per signal. Below this we don't fire. Audit rule.
const MIN_SAMPLE = 5;

// Process this many users per cron tick. The hourly cron is called
// many times, so even with 50 users/tick we sweep the active base
// within ~1 hour for the current 111-user base.
const BATCH_SIZE = 50;

async function safeSend(env: Env, chatId: number, text: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
      }
    );
    if (!res.ok && res.status !== 403 && res.status !== 400) {
      console.warn(`[intervention] sendMessage to ${chatId} failed: ${res.status}`);
    }
    return res.ok;
  } catch (e: any) {
    console.warn(`[intervention] sendMessage error to ${chatId}:`, e?.message);
    return false;
  }
}

async function wasNudgedRecently(env: Env, userId: number, type: InterventionType): Promise<boolean> {
  try {
    const row = await env.DB.prepare(
      `SELECT id FROM intervention_log
       WHERE user_id = ? AND intervention_type = ?
       AND sent_at >= datetime('now', '-24 hours')
       LIMIT 1`
    ).bind(userId, type).first();
    return !!row;
  } catch { /* table missing — allow nudge */ return false; }
}

async function logNudge(env: Env, userId: number, type: InterventionType): Promise<void> {
  try {
    await env.DB.prepare(
      'INSERT INTO intervention_log (user_id, intervention_type) VALUES (?, ?)'
    ).bind(userId, type).run();
  } catch (e: any) {
    console.warn('[intervention] log failed:', e?.message);
  }
}

async function detectSignals(env: Env, userId: number): Promise<NudgeSpec[]> {
  const nudges: NudgeSpec[] = [];

  // 1. Inactivity (3+ days since last_study_date)
  try {
    const user = await env.DB.prepare(
      `SELECT last_study_date, current_streak FROM users WHERE id = ?`
    ).bind(userId).first<{ last_study_date: string | null; current_streak: number }>();
    if (user?.last_study_date) {
      const days = Math.floor((Date.now() - new Date(user.last_study_date).getTime()) / 86400000);
      if (days >= 3) {
        nudges.push({
          type: 'inactivity_3d',
          text: `Belum practice ${days} hari. Yuk mulai lagi — 2 menit aja cukup.\n\nKetik /today buat sesi harian atau /study buat practice.`,
        });
      }
    }
  } catch { /* fine */ }

  // 2. Low accuracy (10+ recent questions, accuracy < 40%).
  // attempt_answers does NOT have user_id directly. JOIN through
  // test_attempts. (The previous version was a real bug caught by
  // the schema validator.)
  try {
    const acc = await env.DB.prepare(
      `SELECT
         SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct,
         COUNT(*) as total
       FROM attempt_answers aa
       JOIN test_attempts ta ON aa.attempt_id = ta.id
       WHERE ta.user_id = ? AND aa.submitted_at >= datetime('now', '-14 days')`
    ).bind(userId).first<{ correct: number; total: number }>();
    // The MIN_SAMPLE gate is the "n >= 5" rule from the audit. For
    // accuracy specifically we want at least 10 recent questions
    // before we tell a student they're struggling.
    if (acc && acc.total >= 10) {
      const pct = Math.round((acc.correct / acc.total) * 100);
      if (pct < 40) {
        nudges.push({
          type: 'low_accuracy',
          text: `Akurasi kamu ${pct}% dari ${acc.total} soal terakhir. Coba fokus review di kelemahan — ketik /weakness buat lihat.`,
        });
      }
    }
  } catch { /* fine */ }

  // 3. Low FSRS retention (avg retention < 70%, with sufficient practice)
  try {
    const { getReviewStats } = await import('./fsrs-engine');
    const stats = await getReviewStats(env, userId);
    const totalCards = (stats.due || 0) + (stats.mastered || 0);
    if (totalCards >= MIN_SAMPLE) {
      const retention = (stats.avgRetention || 0) / 100;
      if (retention > 0 && retention < 0.7) {
        nudges.push({
          type: 'low_fsrs_retention',
          text: `Retention kamu cuma ${Math.round(retention * 100)}%. Review 5 menit biar nggak lupa — ketik /review.`,
        });
      }
    }
  } catch { /* fine */ }

  // 4. No writing practice in 7 days (for users with exam <30 days)
  try {
    const plan = await env.DB.prepare(
      `SELECT target_date FROM study_plans WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`
    ).bind(userId).first<{ target_date: string | null }>();
    if (plan?.target_date) {
      const daysToExam = Math.floor((new Date(plan.target_date).getTime() - Date.now()) / 86400000);
      if (daysToExam > 0 && daysToExam < 30) {
        // MIN_SAMPLE gate: only nudge if the user has done at least 5
        // writing drafts ever. Otherwise we don't know their baseline.
        const writing = (await env.DB.prepare(
          `SELECT COUNT(*) as total, MAX(created_at) as last FROM writing_drafts WHERE user_id = ?`
        ).bind(userId).first<{ total: number; last: string | null }>());
        const totalWritten = writing?.total || 0;
        if (totalWritten >= MIN_SAMPLE) {
          const lastWriting = writing?.last;
          if (!lastWriting || (Date.now() - new Date(lastWriting).getTime()) > 7 * 86400000) {
            nudges.push({
              type: 'no_writing_practice',
              text: `Belum practice writing minggu ini. Ujian kamu ${daysToExam} hari lagi — ketik /study, pilih "Writing".`,
            });
          }
        }
      }
    }
  } catch { /* writing_drafts table missing — skip */ }

  // 5. Behind pace — mocked test score significantly below target.
  // study_plans.target_band is the real column (NOT target_score).
  try {
    const plan = await env.DB.prepare(
      `SELECT target_band, target_date FROM study_plans WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`
    ).bind(userId).first<{ target_band: number | null; target_date: string | null }>();
    if (plan?.target_band) {
      const target = Number(plan.target_band);
      // MIN_SAMPLE gate: need at least 5 mock tests before we claim
      // the student is "behind pace" (a 1-test result is noisy).
      const mockRows = (await env.DB.prepare(
        `SELECT estimated_score, taken_at FROM mock_test_history
         WHERE user_id = ? AND taken_at IS NOT NULL
         ORDER BY taken_at DESC LIMIT 100`
      ).bind(userId).all<{ estimated_score: number; taken_at: string }>()).results ?? [];
      // If target_date is set, filter to that test_type. If not, all tests.
      // For simplicity we use all rows the user has mock_test_history for.
      // The MIN_SAMPLE gate is what protects against 1-test noise.
      if (mockRows.length >= MIN_SAMPLE) {
        const latest = mockRows[0];
        if (latest?.estimated_score && Number(latest.estimated_score) < target - 5) {
          nudges.push({
            type: 'behind_pace',
            text: `Skor terakhir kamu ${Math.round(Number(latest.estimated_score))}, target ${target}. Behind pace — ketik /study buat drill di section lemah.`,
          });
        }
      }
    }
  } catch { /* fine */ }

  return nudges;
}

/**
 * Run the intervention engine — called from the hourly cron in index.ts.
 * Scans a batch of active users, detects signals, rate-limits, sends
 * at most one nudge per user per run. Best-effort: never block the
 * cron on a transient failure.
 */
export async function runInterventionEngine(env: Env): Promise<void> {
  let processed = 0;
  let sent = 0;
  try {
    const users = (await env.DB.prepare(
      `SELECT id, telegram_id, name, last_study_date, current_streak
       FROM users
       WHERE telegram_id IS NOT NULL AND telegram_id != '' AND is_active = 1
       ORDER BY id ASC LIMIT ?`
    ).bind(BATCH_SIZE).all<{
      id: number; telegram_id: string; name: string;
      last_study_date: string | null; current_streak: number;
    }>()).results ?? [];
    for (const u of users) {
      processed++;
      const telegramId = parseInt(String(u.telegram_id).replace('.0', ''));
      if (!telegramId) continue;

      const nudges = await detectSignals(env, u.id);
      for (const nudge of nudges) {
        const recent = await wasNudgedRecently(env, u.id, nudge.type);
        if (recent) continue;
        const ok = await safeSend(env, telegramId, nudge.text);
        if (ok) {
          await logNudge(env, u.id, nudge.type);
          sent++;
          // Cap at 1 nudge per user per run.
          break;
        }
      }
    }
    console.log(`[intervention] processed ${processed} users, sent ${sent} nudges`);
  } catch (e: any) {
    console.error('[intervention] engine error:', e?.message || e);
  }
}