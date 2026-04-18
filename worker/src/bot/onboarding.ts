// Conversational onboarding — 6-screen companion-led setup.
//
// Replaces the old 2-step (target → level → "suggest /diagnostic") flow,
// which dropped clueless students at the suggestion because they had no
// sense of what the bot does or why diagnostic matters.
//
// Flow: welcome → target → deadline → level → commitment → try-one →
// handoff (diagnostic or menu). Resumes mid-flow via users.onboarding_step
// so /start never restarts; it re-renders the last unfinished screen.
//
// Callback prefixes:
//   onb_start   onb_target_<test>   onb_deadline_<code>   onb_level_<code>
//   onb_commit_<min>   onb_try_<correct|wrong>   onb_done_<diag|menu>
//
// Owns its own keyboards and copy so webhook.ts stays lean.

import type { Env, User } from '../types';
import { sendMessage } from './webhook';

// ─── Keyboards ──────────────────────────────────────────────────────────

export const onbWelcomeKeyboard = {
  inline_keyboard: [
    [{ text: '✨ Oke, mulai kenalan!', callback_data: 'onb_start' }],
  ],
};

export const onbTargetKeyboard = {
  inline_keyboard: [
    [
      { text: '🇺🇸 TOEFL iBT', callback_data: 'onb_target_TOEFL_IBT' },
      { text: '🇬🇧 IELTS', callback_data: 'onb_target_IELTS' },
    ],
    [
      { text: '📚 TOEFL ITP', callback_data: 'onb_target_TOEFL_ITP' },
      { text: '🏢 TOEIC', callback_data: 'onb_target_TOEIC' },
    ],
    [{ text: '🤷 Belum tahu — bantuin', callback_data: 'onb_target_UNSURE' }],
  ],
};

export const onbDeadlineKeyboard = {
  inline_keyboard: [
    [
      { text: '📅 Bulan ini', callback_data: 'onb_deadline_month' },
      { text: '🗓 1-3 bulan', callback_data: 'onb_deadline_1-3m' },
    ],
    [
      { text: '📆 3-6 bulan', callback_data: 'onb_deadline_3-6m' },
      { text: '🤷 Belum yakin', callback_data: 'onb_deadline_unknown' },
    ],
  ],
};

export const onbLevelKeyboard = {
  inline_keyboard: [
    [
      { text: '🌱 Pemula (A1-A2)', callback_data: 'onb_level_beginner' },
      { text: '🌿 Menengah (B1)', callback_data: 'onb_level_intermediate' },
    ],
    [{ text: '🌳 Mahir (B2+)', callback_data: 'onb_level_advanced' }],
    [{ text: '❓ Gatau — biar aku dites', callback_data: 'onb_level_unknown' }],
  ],
};

export const onbCommitKeyboard = {
  inline_keyboard: [
    [
      { text: '5 min', callback_data: 'onb_commit_5' },
      { text: '15 min', callback_data: 'onb_commit_15' },
    ],
    [
      { text: '30 min', callback_data: 'onb_commit_30' },
      { text: '60 min', callback_data: 'onb_commit_60' },
    ],
  ],
};

export const onbTryKeyboard = {
  inline_keyboard: [
    [
      { text: 'drink', callback_data: 'onb_try_wrong_a' },
      { text: 'drinks', callback_data: 'onb_try_correct' },
    ],
    [
      { text: 'drinking', callback_data: 'onb_try_wrong_c' },
      { text: 'drunk', callback_data: 'onb_try_wrong_d' },
    ],
  ],
};

export function onbDoneKeyboard(isFree: boolean) {
  const rows: any[] = [
    [{ text: '🩺 Mulai Diagnostic (20 soal)', callback_data: 'onb_done_diag' }],
    [{ text: '📖 Nanti aja — kasih menu utama', callback_data: 'onb_done_menu' }],
  ];
  return { inline_keyboard: rows };
}

// ─── Screen copy ────────────────────────────────────────────────────────

function screenWelcome(firstName: string): string {
  return (
    `Halo ${firstName}! 👋\n\n` +
    `Aku *Arin*, teman belajarmu di sini. Seneng banget kamu join 💛\n\n` +
    `Sebentar (2 menit) kita kenalan dulu — biar aku bisa bantu kamu se-spesifik mungkin. ` +
    `Nggak ada jawaban salah, santai aja ya.\n\n` +
    `Tap tombol di bawah kalau siap 👇`
  );
}

function screenTarget(): string {
  return (
    `📋 *1/5 — Target Tes*\n\n` +
    `Kamu mau persiapan tes yang mana?\n\n` +
    `• 🇺🇸 *TOEFL iBT* — S2 / beasiswa ke US\n` +
    `• 🇬🇧 *IELTS* — Australia, UK, Canada\n` +
    `• 📚 *TOEFL ITP* — beasiswa dalam negeri, LPDP\n` +
    `• 🏢 *TOEIC* — karir / kerja`
  );
}

function screenDeadline(): string {
  return (
    `📋 *2/5 — Kapan Rencananya?*\n\n` +
    `Kira-kira kapan kamu mau ambil tesnya? Jujur aja — ini buat aku bisa ` +
    `bikin ritme belajar yang pas buat kamu.`
  );
}

function deadlineReaction(code: string): string {
  switch (code) {
    case 'month':
      return `😱 Wah, tight schedule! Ok kita bikin plan intensif, fokus ke weak-spot doang. Jangan panik — doable kok.`;
    case '1-3m':
      return `🔥 Spot-on buat prep serius. Cukup waktu buat diagnostic + plan yang realistis.`;
    case '3-6m':
      return `👍 Mantap, waktu kamu cukup banyak. Kita bangun fondasi pelan-pelan, gak buru-buru.`;
    default:
      return `Oke, santai. Kita mulai dulu, nanti kalau sudah ada target tanggal tinggal update di /settings ya.`;
  }
}

function screenLevel(deadlineText: string): string {
  return (
    `${deadlineText}\n\n` +
    `📋 *3/5 — Level Sekarang*\n\n` +
    `Skill bahasa Inggris kamu sekarang kira-kira gimana?`
  );
}

function screenCommit(): string {
  return (
    `📋 *4/5 — Komitmen Harian*\n\n` +
    `Mau luangin berapa menit per hari? Jujur aja ya — aku pegang janjimu. ` +
    `Konsistensi > intensitas.`
  );
}

function commitReaction(min: number): string {
  if (min <= 5) return `5 menit sehari udah cukup buat mulai. Micro habits > marathon 🌱`;
  if (min <= 15) return `15 menit — sweet spot buat kebanyakan student 🎯`;
  if (min <= 30) return `30 menit — serius nih. Aku respect 💪`;
  return `1 jam — warrior mode 🔥 Jangan burn out ya.`;
}

function screenTry(commitMsg: string): string {
  return (
    `${commitMsg}\n\n` +
    `📋 *5/5 — Coba Satu Soal*\n\n` +
    `Gampang kok, biar kamu nggak grogi nanti:\n\n` +
    `"She ___ coffee every morning."\n\n` +
    `Mana yang bener?`
  );
}

function tryCorrectReaction(): string {
  return (
    `✅ *Yes, bener!* "drinks" — subject ketiga tunggal (she/he/it) ` +
    `kerja kata present tense dapet -s. Kamu udah tau dasarnya 👌\n\n` +
    `Nah, itu tadi cara kita belajar — short, clear, langsung practice. ` +
    `Sekarang waktunya cari tau kamu level-nya di mana.`
  );
}

function tryWrongReaction(): string {
  return (
    `Hampir — jawabannya *"drinks"*.\n\n` +
    `Rule-nya: subject ketiga tunggal (she / he / it) + present tense = kerja + *s*. ` +
    `Santai, ini justru kenapa ada *diagnostic* — biar kita tau mulai dari mana.\n\n` +
    `Aku gak judge, beneran 💛`
  );
}

function screenDone(firstName: string, minutes: number | null): string {
  const minLine = minutes ? `\n🎯 Target harian: *${minutes} menit*` : '';
  return (
    `🎉 *Setup selesai, ${firstName}!*${minLine}\n\n` +
    `Progress onboarding:\n` +
    `  ✅ Kenalan\n` +
    `  ⬜ Diagnostic — 20 soal, 15 menit (tahu level pasti)\n` +
    `  ⬜ Pelajaran pertama\n` +
    `  ⬜ Review pertama\n\n` +
    `Saran kuat: diagnostic dulu. Tanpa itu, plan-ku cuma tebakan.`
  );
}

// ─── Entry points ───────────────────────────────────────────────────────

/**
 * Entry from /start. Decides which screen to render based on onboarding_step.
 * If user has `onboarding_complete=1` (legacy flag), skip entirely.
 */
export async function startOnboarding(
  env: Env,
  chatId: number,
  user: User,
  firstName: string,
): Promise<void> {
  const step = user.onboarding_step || 'welcome';

  switch (step) {
    case 'welcome':
      await sendMessage(env, chatId, screenWelcome(firstName), onbWelcomeKeyboard);
      return;
    case 'target':
      await sendMessage(env, chatId, screenTarget(), onbTargetKeyboard);
      return;
    case 'deadline':
      await sendMessage(env, chatId, screenDeadline(), onbDeadlineKeyboard);
      return;
    case 'level':
      await sendMessage(env, chatId, screenLevel(''), onbLevelKeyboard);
      return;
    case 'commitment':
      await sendMessage(env, chatId, screenCommit(), onbCommitKeyboard);
      return;
    case 'tryone':
      await sendMessage(env, chatId, screenTry(''), onbTryKeyboard);
      return;
    default:
      // Safety: if step is 'done' but onboarding_complete is 0, finalize.
      await env.DB.prepare(
        `UPDATE users SET onboarding_complete = 1, onboarding_step = 'done' WHERE id = ?`
      ).bind(user.id).run();
      return;
  }
}

// ─── Transitions (called from callback handlers) ────────────────────────
// Each function: persists step → returns (text, keyboard) so the caller
// can editMessage the previous screen.

export async function onTapStart(env: Env, user: User): Promise<{ text: string; keyboard: any }> {
  await env.DB.prepare(
    `UPDATE users SET onboarding_step = 'target' WHERE id = ?`
  ).bind(user.id).run();
  return { text: screenTarget(), keyboard: onbTargetKeyboard };
}

export async function onPickTarget(
  env: Env,
  user: User,
  target: string,
): Promise<{ text: string; keyboard: any }> {
  // UNSURE → default to TOEFL_IBT, but carry that uncertainty into mystyle later.
  const saved = target === 'UNSURE' ? 'TOEFL_IBT' : target;
  await env.DB.prepare(
    `UPDATE users SET target_test = ?, onboarding_step = 'deadline' WHERE id = ?`
  ).bind(saved, user.id).run();
  return { text: screenDeadline(), keyboard: onbDeadlineKeyboard };
}

export async function onPickDeadline(
  env: Env,
  user: User,
  code: string,
): Promise<{ text: string; keyboard: any }> {
  await env.DB.prepare(
    `UPDATE users SET exam_deadline = ?, onboarding_step = 'level' WHERE id = ?`
  ).bind(code, user.id).run();
  return { text: screenLevel(deadlineReaction(code)), keyboard: onbLevelKeyboard };
}

/**
 * If user picked 'unknown', we still set level='beginner' as placeholder
 * so downstream features work, but we'll push them to diagnostic hard.
 */
export async function onPickLevel(
  env: Env,
  user: User,
  code: string,
): Promise<{ text: string; keyboard: any }> {
  const stored = code === 'unknown' ? 'beginner' : code;
  await env.DB.prepare(
    `UPDATE users SET proficiency_level = ?, onboarding_step = 'commitment' WHERE id = ?`
  ).bind(stored, user.id).run();
  return { text: screenCommit(), keyboard: onbCommitKeyboard };
}

export async function onPickCommit(
  env: Env,
  user: User,
  minutes: number,
): Promise<{ text: string; keyboard: any }> {
  await env.DB.prepare(
    `UPDATE users SET daily_minutes_goal = ?, onboarding_step = 'tryone' WHERE id = ?`
  ).bind(minutes, user.id).run();
  return { text: screenTry(commitReaction(minutes)), keyboard: onbTryKeyboard };
}

export async function onTrySubmit(
  env: Env,
  user: User,
  correct: boolean,
  firstName: string,
): Promise<{ answerText: string; doneText: string; doneKeyboard: any }> {
  await env.DB.prepare(
    `UPDATE users SET onboarding_step = 'done', onboarding_complete = 1 WHERE id = ?`
  ).bind(user.id).run();

  const answerText = correct ? tryCorrectReaction() : tryWrongReaction();
  const minutes = user.daily_minutes_goal || null;
  const doneText = screenDone(firstName, minutes);
  const doneKeyboard = onbDoneKeyboard(!user.is_premium);
  return { answerText, doneText, doneKeyboard };
}
