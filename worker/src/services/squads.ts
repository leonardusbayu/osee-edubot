// Study squads — accountability groups of 3-5 friends (MASTER_PLAN Phase 5.3).
//
// One squad per user. 6-char invite code (same confusable-free alphabet as
// premium-codes.ts). Status view shows each member's streak (user_xp),
// weekly XP (user_leagues) and whether they studied today (lesson_step_results
// or attempt_answers), with playful slacker call-outs in the bot message.

import type { Env } from '../types';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const MAX_MEMBERS = 5;

function generateInviteCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < 6; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

// Monday of the current WIB week — must match leagues.ts weekStart().
function weekStartWIB(): string {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getTime() - diff * 86400000);
  return monday.toISOString().slice(0, 10);
}

export interface SquadActionResult {
  ok: boolean;
  message: string; // Indonesian, ready to send to the student
  squad?: { id: number; name: string; invite_code: string };
}

export interface SquadMemberStatus {
  user_id: number;
  name: string;
  current_streak: number;
  weekly_xp: number;
  studied_today: boolean;
}

export interface SquadStatus {
  id: number;
  name: string;
  invite_code: string;
  members: SquadMemberStatus[];
}

async function findMembership(env: Env, userId: number): Promise<number | null> {
  const row = await env.DB.prepare(
    `SELECT squad_id FROM squad_members WHERE user_id = ?`,
  ).bind(userId).first<{ squad_id: number }>();
  return row ? Number(row.squad_id) : null;
}

// Strip characters that break the *bold* formatting convention when names
// are interpolated into bot messages (sendMessage converts *x* → <b>).
// Telegram display names routinely contain * _ ` [ — review finding.
function sanitizeForMessage(s: string): string {
  return (s || '').replace(/[*_`\[\]]/g, '').trim();
}

export async function createSquad(env: Env, userId: number, name: string): Promise<SquadActionResult> {
  try {
    const cleanName = sanitizeForMessage(name).slice(0, 40);
    if (!cleanName) {
      return { ok: false, message: 'Kasih nama squad-nya dulu ya. Contoh: /squad buat Pejuang IELTS' };
    }

    if (await findMembership(env, userId) !== null) {
      return { ok: false, message: 'Kamu udah punya squad! Keluar dulu pakai /squad keluar kalau mau bikin yang baru.' };
    }

    // Retry a few times on the (astronomically rare) UNIQUE collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInviteCode();
      try {
        const res = await env.DB.prepare(
          `INSERT INTO squads (name, invite_code, created_by) VALUES (?, ?, ?)`,
        ).bind(cleanName, code, userId).run();
        const squadId = Number(res.meta.last_row_id);
        await env.DB.prepare(
          `INSERT OR IGNORE INTO squad_members (squad_id, user_id) VALUES (?, ?)`,
        ).bind(squadId, userId).run();
        return {
          ok: true,
          squad: { id: squadId, name: cleanName, invite_code: code },
          message:
            `🎉 Squad *${cleanName}* berhasil dibuat!\n\n` +
            `Kode invite: *${code}*\n\n` +
            `Ajak 2-4 temanmu gabung pakai /squad gabung ${code} — belajar bareng itu lebih seru (dan lebih susah buat kabur 👀).`,
        };
      } catch {
        // UNIQUE collision on invite_code — regenerate and retry.
      }
    }
    return { ok: false, message: 'Hmm, ada gangguan sebentar. Coba lagi ya!' };
  } catch {
    return { ok: false, message: 'Hmm, ada gangguan sebentar. Coba lagi ya!' };
  }
}

export async function joinSquad(env: Env, userId: number, code: string): Promise<SquadActionResult> {
  try {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      return { ok: false, message: 'Kodenya mana? Format: /squad gabung KODE' };
    }

    if (await findMembership(env, userId) !== null) {
      return { ok: false, message: 'Kamu udah ada di squad lain. Keluar dulu pakai /squad keluar kalau mau pindah.' };
    }

    const squad = await env.DB.prepare(
      `SELECT id, name, invite_code FROM squads WHERE invite_code = ?`,
    ).bind(cleanCode).first<{ id: number; name: string; invite_code: string }>();
    if (!squad) {
      return { ok: false, message: `Kode *${cleanCode}* nggak ketemu. Cek lagi ya, mungkin ada salah ketik.` };
    }

    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM squad_members WHERE squad_id = ?`,
    ).bind(squad.id).first<{ n: number }>();
    if (Number(count?.n || 0) >= MAX_MEMBERS) {
      return { ok: false, message: `Waduh, squad *${squad.name}* udah penuh (maks ${MAX_MEMBERS} orang). Bikin squad baru aja yuk!` };
    }

    await env.DB.prepare(
      `INSERT OR IGNORE INTO squad_members (squad_id, user_id) VALUES (?, ?)`,
    ).bind(squad.id, userId).run();

    return {
      ok: true,
      squad: { id: Number(squad.id), name: squad.name, invite_code: squad.invite_code },
      message:
        `✅ Kamu resmi gabung squad *${squad.name}*!\n\n` +
        `Cek progress teman-temanmu pakai /squad — jangan jadi yang paling santai ya 😏`,
    };
  } catch {
    return { ok: false, message: 'Hmm, ada gangguan sebentar. Coba lagi ya!' };
  }
}

export async function leaveSquad(env: Env, userId: number): Promise<SquadActionResult> {
  try {
    const squadId = await findMembership(env, userId);
    if (squadId === null) {
      return { ok: false, message: 'Kamu belum gabung squad mana pun. Bikin pakai /squad buat NAMA atau gabung pakai kode invite!' };
    }

    await env.DB.prepare(
      `DELETE FROM squad_members WHERE squad_id = ? AND user_id = ?`,
    ).bind(squadId, userId).run();

    // Clean up empty squads so dead invite codes don't pile up.
    try {
      const left = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM squad_members WHERE squad_id = ?`,
      ).bind(squadId).first<{ n: number }>();
      if (Number(left?.n || 0) === 0) {
        await env.DB.prepare(`DELETE FROM squads WHERE id = ?`).bind(squadId).run();
      }
    } catch {}

    return { ok: true, message: 'Kamu udah keluar dari squad. Kalau berubah pikiran, gabung lagi kapan aja ya!' };
  } catch {
    return { ok: false, message: 'Hmm, ada gangguan sebentar. Coba lagi ya!' };
  }
}

export async function getSquadStatus(env: Env, userId: number): Promise<SquadStatus | null> {
  try {
    const squadId = await findMembership(env, userId);
    if (squadId === null) return null;

    const squad = await env.DB.prepare(
      `SELECT id, name, invite_code FROM squads WHERE id = ?`,
    ).bind(squadId).first<{ id: number; name: string; invite_code: string }>();
    if (!squad) return null;

    // Timestamps are stored in UTC; '+7 hours' converts to the WIB calendar day.
    const { results } = await env.DB.prepare(
      `SELECT u.id AS user_id, u.name, u.username,
              COALESCE(x.current_streak, 0) AS current_streak,
              COALESCE(l.weekly_xp, 0) AS weekly_xp,
              (EXISTS(SELECT 1 FROM lesson_step_results lsr
                       WHERE lsr.user_id = u.id
                         AND date(lsr.completed_at, '+7 hours') = date('now', '+7 hours'))
               OR EXISTS(SELECT 1 FROM attempt_answers aa
                          JOIN test_attempts ta ON ta.id = aa.attempt_id
                         WHERE ta.user_id = u.id
                           AND date(aa.submitted_at, '+7 hours') = date('now', '+7 hours'))
              ) AS studied_today
         FROM squad_members sm
         JOIN users u ON u.id = sm.user_id
         LEFT JOIN user_xp x ON x.user_id = u.id
         LEFT JOIN user_leagues l ON l.user_id = u.id AND l.week_start = ?
        WHERE sm.squad_id = ?
        ORDER BY current_streak DESC, weekly_xp DESC`,
    ).bind(weekStartWIB(), squadId).all<any>();

    const members: SquadMemberStatus[] = (results || []).map((r: any) => ({
      user_id: Number(r.user_id),
      name: sanitizeForMessage(r.name || (r.username ? `@${r.username}` : `Member ${r.user_id}`)) || `Member ${r.user_id}`,
      current_streak: Number(r.current_streak || 0),
      weekly_xp: Number(r.weekly_xp || 0),
      studied_today: Boolean(Number(r.studied_today || 0)),
    }));

    return { id: Number(squad.id), name: squad.name, invite_code: squad.invite_code, members };
  } catch {
    return null;
  }
}

export function formatSquadMessage(status: SquadStatus): string {
  const lines: string[] = [];
  lines.push(`👥 *Squad ${status.name}*`);
  lines.push('');

  for (const m of status.members) {
    const check = m.studied_today ? '✅' : '⬜';
    const xpPart = m.weekly_xp > 0 ? ` • ${m.weekly_xp} XP minggu ini` : '';
    lines.push(`${check} *${m.name}* — 🔥 ${m.current_streak} hari${xpPart}`);
  }

  lines.push('');

  const studied = status.members.filter((m) => m.studied_today);
  const slackers = status.members.filter((m) => !m.studied_today);

  if (slackers.length === 0) {
    lines.push('Semua udah latihan hari ini — squad goals banget! 🎉');
  } else if (studied.length === 0) {
    lines.push('Belum ada yang latihan hari ini nih... siapa yang berani mulai duluan? 👀');
  } else {
    const hero = studied[0].name;
    const lazy = slackers.map((m) => m.name).join(' & ');
    lines.push(`${hero} udah latihan hari ini, ${lazy} belum 👀 Jangan mau kalah dong!`);
  }

  lines.push('');
  if (status.members.length < MAX_MEMBERS) {
    lines.push(`Ajak teman gabung pakai kode: *${status.invite_code}*`);
  } else {
    lines.push('Squad penuh — sekarang tinggal saling jaga streak ya! 💪');
  }

  return lines.join('\n');
}
