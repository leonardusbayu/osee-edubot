// Taper plan engine — ROADMAP_M3 §2.3
// Maps days-until-exam to a study phase with short Indonesian guidance
// that /today (and future surfaces) can append to the daily message.

export type TaperPhase = 'build' | 'sharpen' | 'mock' | 'patch' | 'rest' | 'exam';

export interface TaperInfo {
  phase: TaperPhase;
  /** Whole days until the exam (0 = today, negative = past). */
  daysLeft: number;
  /** 1-2 line Indonesian guidance, "Aku/kamu" voice, *bold* single-asterisk. */
  guidance: string;
}

/** Parse YYYY-MM-DD as a UTC date at midnight. Returns null if invalid. */
function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (isNaN(d.getTime())) return null;
  // Reject overflow dates like 2026-02-31
  if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return d;
}

/** Whole days from `now` to `examDate` (ISO YYYY-MM-DD), date-to-date in WIB. */
export function daysUntilExam(examDate: string, now: Date = new Date()): number | null {
  const exam = parseISODate(examDate);
  if (!exam) return null;
  // Compare calendar dates in WIB (UTC+7) so the countdown flips at local midnight.
  const wibNow = new Date(now.getTime() + 7 * 3600 * 1000);
  const today = Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate());
  return Math.round((exam.getTime() - today) / 86400000);
}

export function getTaperPhase(examDate: string, now: Date = new Date()): TaperInfo | null {
  const daysLeft = daysUntilExam(examDate, now);
  if (daysLeft === null) return null;

  if (daysLeft <= 0) {
    return {
      phase: 'exam',
      daysLeft,
      guidance: daysLeft === 0
        ? `🎯 *Hari tes!* Tarik napas, kamu sudah siap. Datang lebih awal, baca instruksi pelan-pelan, dan percaya latihanmu.`
        : `Tes kamu sudah lewat — gimana hasilnya? Ceritain ke aku, atau set tanggal baru dengan /examdate kalau mau ambil tes lagi.`,
    };
  }
  if (daysLeft === 1) {
    return {
      phase: 'rest',
      daysLeft,
      guidance: `😌 *H-1!* Hari ini cukup review ringan — jangan belajar materi baru.\nTidur cukup malam ini ya, otak yang segar lebih berharga dari 100 soal tambahan.`,
    };
  }
  if (daysLeft <= 6) {
    return {
      phase: 'patch',
      daysLeft,
      guidance: `🩹 Fase *patching*: fokus ke topik terlemah kamu aja, jangan buka materi baru.\nBersihin antrian /review sampai nol — itu prioritas utama minggu ini.`,
    };
  }
  if (daysLeft === 7) {
    return {
      phase: 'mock',
      daysLeft,
      guidance: `🧠 *H-7* — waktunya simulasi! Kerjakan satu mini-test penuh hari ini lewat "Latihan Tes" biar kamu tahu posisi terakhirmu.`,
    };
  }
  if (daysLeft <= 14) {
    return {
      phase: 'sharpen',
      daysLeft,
      guidance: `⚔️ Fase *sharpening*: di sisa 2 minggu, strategi ngangkat skor lebih cepat dari materi baru.\nBuka /strategi dan tambal kelemahan yang masih bolong.`,
    };
  }
  return {
    phase: 'build',
    daysLeft,
    guidance: `📚 Masih fase *building* — lanjutkan pelajaran dan latihan rutin seperti biasa. Konsistensi tiap hari yang bakal kerasa di hari H.`,
  };
}

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** "2026-08-15" → "15 Agustus 2026". Falls back to the raw string if invalid. */
export function formatExamDateID(examDate: string): string {
  const d = parseISODate(examDate);
  if (!d) return examDate;
  return `${d.getUTCDate()} ${MONTHS_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
