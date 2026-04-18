// Bot-facing formatters that render a StudentReport as Telegram-flavored
// Markdown. Both /progress and /profile previously hand-rolled their own
// SQL subsets, which drifted over time — a student could run /progress and
// /profile back-to-back and see different totals because the queries
// filtered answers differently (one counted speaking/writing, the other
// didn't). This module centralizes the rendering so /progress is always
// "progress-shaped view of the same data" and /profile is "profile-shaped
// view of the same data" — never "different answers to the same question".
//
// Tracks P2 BUGS.md #7.

import type { StudentReport } from './student-report';

const TEST_TYPE_LABELS: Record<string, string> = {
  TOEFL_IBT: 'TOEFL iBT',
  IELTS: 'IELTS',
  TOEFL_ITP: 'TOEFL ITP',
  TOEIC: 'TOEIC',
};

const SECTION_ICONS: Record<string, string> = {
  reading: '📖',
  listening: '🎧',
  speaking: '🗣',
  writing: '✍️',
  structure: '📐',
};

const STYLE_EMOJI: Record<string, string> = {
  visual: '👁️', verbal: '💬', active: '🏃', reflective: '🤔', balanced: '⚖️',
};

const DEPTH_EMOJI: Record<string, string> = {
  beginner: '🌱', elementary: '🌿', intermediate: '🌳', advanced: '🏔️', expert: '⭐',
};

const LEAGUE_EMOJI: Record<string, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', diamond: '💎', champion: '👑',
};

/**
 * /progress — activity + accuracy overview. Optimized for
 * "how much have I done lately" — the question most students actually ask.
 */
export function formatProgressMessage(report: StudentReport): string {
  const s = report.student;
  const a = report.activity;
  const g = report.gamification;
  const sr = report.srs;

  const testLabel = s.target_test ? (TEST_TYPE_LABELS[s.target_test] || s.target_test) : 'belum diset';

  let msg = `📊 *Progress ${s.name}*\n\n`;
  msg += `🎯 Target: ${testLabel}\n`;
  msg += `📈 Level: ${s.proficiency_level || 'belum diset'}\n\n`;

  msg += `*📝 Aktivitas*\n`;
  msg += `Total soal: ${a.total_questions_answered}\n`;
  msg += `Correct: ${a.total_correct} (${a.overall_accuracy}% accuracy)\n`;
  msg += `Tes selesai: ${a.recent_tests.length}\n`;
  msg += `🔥 Streak: ${a.study_streak} hari (terpanjang: ${g.longest_streak})\n\n`;

  if (g.total_xp > 0) {
    const leagueStr = g.league ? `${LEAGUE_EMOJI[g.league] || '🏆'} ${g.league}` : '';
    msg += `*🎮 Level*\n`;
    msg += `Lvl ${g.level} · ${g.total_xp} XP · ${g.coins} 🪙\n`;
    if (leagueStr) msg += `League: ${leagueStr} (${g.weekly_xp} XP minggu ini)\n`;
    msg += '\n';
  }

  if (report.section_performance.length > 0) {
    msg += `*📊 Per Bagian*\n`;
    for (const sp of report.section_performance) {
      const icon = SECTION_ICONS[sp.section] || '📌';
      const trendIcon = sp.trend === 'improving' ? ' 📈'
        : sp.trend === 'declining' ? ' 📉'
        : '';
      msg += `${icon} ${sp.section}: ${sp.accuracy}% (${sp.correct}/${sp.total_questions})${trendIcon}\n`;
    }
    msg += '\n';
  }

  if (sr.total_items > 0) {
    msg += `*🧠 Spaced Repetition*\n`;
    msg += `Due: ${sr.overdue} · Mastered: ${sr.mastered} / ${sr.total_items} total`;
    if (sr.avg_retention !== null) msg += ` · Retention: ${sr.avg_retention}%`;
    msg += '\n\n';
  }

  msg += `💡 Buka /test untuk latihan, /review buat FSRS, /lesson buat plan`;

  return msg;
}

/**
 * /profile — learning profile + cognitive state. Optimized for
 * "what does the tutor know about me and what's tuned for me" — useful
 * for students asking "why is the tutor teaching me this way?".
 */
export function formatProfileMessage(report: StudentReport): string {
  const s = report.student;
  const p = report.preferences;
  const c = report.cognitive;
  const sr = report.srs;
  const mm = report.mental_model.misconceptions;
  const gaps = report.mental_model.knowledge_gaps;
  const diag = report.diagnostic;

  let msg = `📋 *Profil Belajar — ${s.name}*\n\n`;

  msg += `*🎨 Gaya Belajar*\n`;
  msg += `${STYLE_EMOJI[p.learning_style || 'balanced'] || '⚖️'} Style: ${p.learning_style || 'balanced'}\n`;
  msg += `💬 Komunikasi: ${p.communication_style || 'socratic'}\n`;
  msg += `${DEPTH_EMOJI[p.depth_level || 'intermediate'] || '🌳'} Level: ${p.depth_level || 'intermediate'}\n`;
  msg += `⏱️ Target harian: ${p.daily_study_target_min || 30} menit\n\n`;

  msg += `*🧠 Cognitive Profile*\n`;
  msg += `Confidence: ${Math.round((c.confidence_score || 0) * 100)}%\n`;
  msg += `Frustration: ${Math.round((c.frustration_score || 0) * 100)}%\n`;
  msg += `Engagement: ${c.engagement_level}\n`;
  msg += `Pace: ${c.learning_pace}\n`;
  msg += `🔥 Streak terbaik: ${c.longest_correct_streak}\n`;
  msg += `💬 Total tutor messages: ${c.total_tutor_messages}\n\n`;

  msg += `*📦 Spaced Repetition*\n`;
  msg += `Total: ${sr.total_items} · Due: ${sr.overdue} · Mastered: ${sr.mastered}\n`;
  if (sr.avg_retention !== null) msg += `Avg retention: ${sr.avg_retention}%\n`;
  msg += '\n';

  if (diag.has_taken) {
    msg += `*🎯 Diagnostic*\n`;
    msg += `Estimated band: ${diag.score ?? 'N/A'} · Placed: ${diag.level_placed ?? 'N/A'}\n`;
    msg += `Date: ${diag.date ? diag.date.slice(0, 10) : 'N/A'}\n\n`;
  }

  if (mm.length > 0) {
    msg += `*⚠️ Misconceptions (top ${Math.min(3, mm.length)})*\n`;
    msg += mm.slice(0, 3).map((m) => `🔴 ${m.concept}`).join('\n') + '\n\n';
  }

  if (gaps.length > 0) {
    msg += `*📚 Knowledge Gaps (top ${Math.min(5, gaps.length)})*\n`;
    // `knowledge_gaps` is a plain string[] of concept names the tutor
    // has never seen evidence for. We display them flat — "partial
    // understanding" vs "solid" distinctions are surfaced elsewhere.
    msg += gaps.slice(0, 5).map((concept) => `⚪ ${concept}`).join('\n') + '\n\n';
  }

  if (report.recommendations.next_steps.length > 0) {
    msg += `*💡 Saran*\n`;
    msg += report.recommendations.next_steps.slice(0, 3).map((s) => `→ ${s}`).join('\n');
  }

  return msg;
}
