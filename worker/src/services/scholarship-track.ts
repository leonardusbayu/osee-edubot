// ═══════════════════════════════════════════════════════
// JALUR BEASISWA — Scholarship Track (MASTER_PLAN Phase 6.2)
//
// Hardcoded, curated scholarship info for the #1 motivation
// segment of Indonesian test-takers. Pure content + matching
// logic — no DB writes. Wiring (/beasiswa command + the
// 'beasiswa:' callback prefix) lives in bot/webhook.ts.
//
// Copy rules: Bahasa Indonesia, Aku/kamu voice, *bold* single
// asterisk (rendered as Telegram HTML <b>), blank lines between
// beats, no markdown headers. Exact numbers are hedged with
// "cek situs resmi" — requirements shift per intake year.
// ═══════════════════════════════════════════════════════

export interface Scholarship {
  id: string;
  name: string;
  /** e.g. "IELTS 6.5 / TOEFL iBT 80" */
  english_req: string;
  /** e.g. "Biasanya buka Januari & Juli" */
  deadline_hint: string;
  /** 3-4 line Indonesian thread-style tips */
  tips: string;
  /** Internal: typical IELTS-equivalent band the applicant needs. */
  target_band: number;
  /** Internal: minimum estimated band to count as "within striking distance". */
  min_band: number;
  /** Short flavor line for menus/match lists. */
  tagline: string;
}

export const SCHOLARSHIPS: Scholarship[] = [
  {
    id: 'lpdp',
    name: 'LPDP (Kemenkeu RI)',
    english_req: 'IELTS 6.5 / TOEFL iBT 80 (LN) — tujuan dalam negeri biasanya lebih rendah, cek situs resmi',
    deadline_hint: 'Biasanya buka 2 batch: sekitar Januari–Februari & Juni–Juli',
    target_band: 6.5,
    min_band: 5.0,
    tagline: 'Beasiswa paling populer se-Indonesia — full funding S2/S3',
    tips:
      `Sertifikat bahasa itu *syarat administrasi pertama* yang bikin ribuan orang gugur — urus tes JAUH sebelum batch buka, jangan mepet.\n` +
      `Esai kontribusi lebih menentukan daripada skor tinggi-tinggian: skor cukup lolos ambang, sisanya cerita kamu.\n` +
      `Banyak pendaftar gagal karena sertifikatnya kedaluwarsa (masa berlaku 2 tahun) — hitung mundur dari jadwal batch.\n` +
      `Angka persisnya beda per jalur (reguler/afirmasi/targeted), selalu cek situs resmi lpdp.kemenkeu.go.id.`,
  },
  {
    id: 'aas',
    name: 'AAS (Australia Awards)',
    english_req: 'IELTS 5.5 (beberapa kategori afirmasi 5.0) / TOEFL iBT setara — cek situs resmi',
    deadline_hint: 'Biasanya buka sekitar Februari–April/Mei, setahun sekali',
    target_band: 5.5,
    min_band: 4.5,
    tagline: 'Ambang masuk paling ramah — plus pre-departure English training',
    tips:
      `Ini salah satu beasiswa besar dengan *ambang IELTS paling rendah* — 5.5 itu sangat kejar-able dari nol dalam beberapa bulan.\n` +
      `Kalau diterima, kamu dapat pelatihan bahasa Inggris tambahan sebelum berangkat — jadi jangan minder duluan.\n` +
      `Prioritas ke bidang pembangunan (kesehatan, pendidikan, pemerintahan) dan daerah fokus — sesuaikan ceritamu.\n` +
      `Detail kategori & ambang skor tiap intake bisa bergeser, cek australiaawardsindonesia.org.`,
  },
  {
    id: 'chevening',
    name: 'Chevening (UK)',
    english_req: 'Saat apply nggak wajib lampirkan IELTS — tapi kampus UK tujuanmu biasanya minta IELTS 6.5–7.0',
    deadline_hint: 'Biasanya buka sekitar Agustus–November tiap tahun',
    target_band: 6.5,
    min_band: 5.0,
    tagline: 'S2 1 tahun di UK — kuat di leadership & networking',
    tips:
      `Sejak beberapa tahun lalu Chevening *nggak minta sertifikat bahasa saat apply* — tapi jangan santai: unconditional offer dari kampus UK tetap butuh IELTS.\n` +
      `Empat esainya (leadership, networking, study plan, career plan) adalah medan perang sesungguhnya — mulai draft dari jauh hari.\n` +
      `Syarat unik: minimal 2 tahun pengalaman kerja (magang & organisasi bisa dihitung).\n` +
      `Aturan bisa berubah tiap siklus, cek chevening.org sebelum apply.`,
  },
  {
    id: 'fulbright',
    name: 'Fulbright (USA / AMINEF)',
    english_req: 'TOEFL iBT 80 / IELTS 6.5 untuk S2 — beberapa program terima TOEFL ITP di tahap awal, cek situs resmi',
    deadline_hint: 'Biasanya deadline sekitar Februari tiap tahun',
    target_band: 6.5,
    min_band: 5.0,
    tagline: 'Beasiswa paling bergengsi ke Amerika Serikat',
    tips:
      `Fulbright termasuk yang masih *menerima TOEFL ITP* di tahap awal untuk beberapa skema — kabar baik kalau kamu lebih familiar dengan format ITP.\n` +
      `Study objective essay harus spesifik: bidang apa, kenapa di AS, dan dampaknya buat Indonesia setelah pulang.\n` +
      `Prosesnya panjang (apply → interview → tes ulang → placement), bisa setahun lebih — niatkan sebagai maraton.\n` +
      `Skema & syarat skor per program beda-beda, cek aminef.or.id.`,
  },
  {
    id: 'mext',
    name: 'MEXT (Jepang)',
    english_req: 'Nggak ada ambang resmi yang kaku — ada tes bahasa Inggris/Jepang saat seleksi; IELTS 5.5+ jadi nilai plus',
    deadline_hint: 'Jalur kedutaan biasanya buka sekitar April–Mei',
    target_band: 5.5,
    min_band: 4.5,
    tagline: 'Full funding ke Jepang — tanpa ikatan dinas',
    tips:
      `MEXT *nggak mewajibkan IELTS/TOEFL* secara kaku — tapi ada ujian tulis bahasa Inggris saat seleksi, jadi kemampuanmu tetap diuji.\n` +
      `Punya sertifikat IELTS 5.5+ atau setara bikin profilmu jauh lebih meyakinkan di mata profesor pembimbing.\n` +
      `Kunci jalur research student: kontak profesor di Jepang duluan dan dapatkan Letter of Acceptance informal.\n` +
      `Timeline jalur kedutaan vs jalur universitas beda, cek situs Kedutaan Besar Jepang di Indonesia.`,
  },
  {
    id: 'erasmus',
    name: 'Erasmus Mundus (Eropa)',
    english_req: 'Tergantung konsorsium — umumnya IELTS 6.0–6.5 / TOEFL iBT 80–90, cek halaman tiap program',
    deadline_hint: 'Biasanya deadline sekitar Oktober–Januari (beda-beda per program)',
    target_band: 6.0,
    min_band: 5.0,
    tagline: 'Kuliah di 2-3 negara Eropa dalam satu program S2',
    tips:
      `Satu program = kuliah di *2-3 negara Eropa* — pengalaman paling unik di daftar ini.\n` +
      `Tiap konsorsium pasang syarat sendiri: ada yang minta 6.0, ada yang 6.5 — pilih program dengan ambang yang cocok dengan posisimu sekarang.\n` +
      `Kamu boleh apply ke maksimal 3 program sekaligus — manfaatkan kuotanya, jangan cuma satu.\n` +
      `Daftar program & syaratnya ada di katalog resmi Erasmus Mundus (situs Komisi Eropa) — selalu cek halaman programnya langsung.`,
  },
  {
    id: 'gks',
    name: 'GKS (Global Korea Scholarship)',
    english_req: 'Bahasa Inggris nggak wajib — tapi IELTS 5.5+ atau TOPIK level 3+ nambah poin seleksi besar',
    deadline_hint: 'Jalur kedutaan biasanya buka sekitar Februari–Maret (S2/S3) & September (S1)',
    target_band: 5.5,
    min_band: 4.5,
    tagline: 'Full funding ke Korea + 1 tahun kursus bahasa Korea',
    tips:
      `GKS termasuk yang *paling fleksibel soal sertifikat* — bahasa Inggris nggak wajib, tapi pelamar yang lolos hampir selalu melampirkannya.\n` +
      `Sertifikat IELTS/TOEFL atau TOPIK memberi poin tambahan resmi di rubrik penilaian — ini pembeda di seleksi berkas yang ketat.\n` +
      `Tahun pertama kamu digembleng bahasa Korea dulu sebelum kuliah — jadi fokusmu sekarang cukup bahasa Inggris untuk berkas.\n` +
      `Kuota & jalur (embassy vs university track) berubah tiap tahun, cek studyinkorea.go.kr.`,
  },
  {
    id: 'unggulan',
    name: 'Beasiswa Unggulan (Kemendikbud) & DAAD',
    english_req: 'Beasiswa Unggulan: umumnya TOEFL ITP 500+ / IELTS 5.5 untuk LN. DAAD (Jerman): umumnya IELTS 6.0+ / setara',
    deadline_hint: 'Beasiswa Unggulan biasanya buka sekitar Juni–Agustus; DAAD beda-beda per program',
    target_band: 5.5,
    min_band: 4.5,
    tagline: 'Opsi dalam negeri + jalur Jerman yang sering dilupakan orang',
    tips:
      `*Beasiswa Unggulan* itu opsi bagus buat kamu yang mau S2 di kampus dalam negeri — persaingan sertifikat bahasanya lebih ringan dari LPDP LN.\n` +
      `Buat tujuan dalam negeri, TOEFL ITP sering cukup — nggak harus iBT/IELTS yang mahal.\n` +
      `*DAAD* (Jerman) underrated: banyak program S2 di Jerman gratis SPP, DAAD menanggung biaya hidup — saingan dari Indonesia lebih sedikit.\n` +
      `Syarat skor tiap skema beda jauh, cek beasiswaunggulan.kemdikbud.go.id dan daad.id.`,
  },
];

const SCHOLARSHIP_EMOJI: Record<string, string> = {
  lpdp: '🇮🇩',
  aas: '🇦🇺',
  chevening: '🇬🇧',
  fulbright: '🇺🇸',
  mext: '🇯🇵',
  erasmus: '🇪🇺',
  gks: '🇰🇷',
  unggulan: '🎓',
};

export function getScholarship(id: string): Scholarship | null {
  return SCHOLARSHIPS.find((s) => s.id === id) || null;
}

/**
 * /beasiswa menu — intro text + inline keyboard.
 * callback_data format: 'beasiswa:<id>' (handled in webhook.ts).
 */
export function getScholarshipMenu(): {
  text: string;
  keyboard: { inline_keyboard: { text: string; callback_data: string }[][] };
} {
  const text =
    `🎓 *Jalur Beasiswa*\n\n` +
    `Mayoritas pejuang TOEFL/IELTS di Indonesia ngejar satu hal: *beasiswa*. Aku rangkum 8 beasiswa terbesar + strategi skornya.\n\n` +
    `Pilih beasiswa yang kamu incar — aku kasih syarat bahasa, perkiraan timeline, dan strategi belajarnya:`;

  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < SCHOLARSHIPS.length; i += 2) {
    rows.push(
      SCHOLARSHIPS.slice(i, i + 2).map((s) => ({
        text: `${SCHOLARSHIP_EMOJI[s.id] || '🎓'} ${s.name.split(' (')[0]}`,
        callback_data: `beasiswa:${s.id}`,
      })),
    );
  }
  return { text, keyboard: { inline_keyboard: rows } };
}

/** Per-scholarship English-score strategy line (the coach beat). */
function scoreStrategy(s: Scholarship): string {
  if (s.target_band >= 6.5) {
    return (
      `Target IELTS ${s.target_band.toFixed(1)} = fokus *Writing* dulu — itu blocker paling umum. ` +
      `Reading & Listening bisa naik cepat dengan latihan rutin, tapi Writing butuh feedback berulang. ` +
      `Mulai dari Task 2 (essay), karena bobotnya 2x Task 1.`
    );
  }
  if (s.target_band >= 6.0) {
    return (
      `Target IELTS ${s.target_band.toFixed(1)} itu titik di mana *vocabulary range* mulai menentukan. ` +
      `Reading & Listening kejar lewat latihan harian, lalu rapikan grammar dasar di Writing — ` +
      `kesalahan kecil yang konsisten itu yang nahan skor di 5.5.`
    );
  }
  return (
    `Target IELTS ${s.target_band.toFixed(1)} itu sangat realistis dari level pemula — ` +
    `kuncinya *konsistensi harian*, bukan belajar marathon. ` +
    `Fokus Reading & Listening dulu (paling cepat naik), Speaking & Writing nyusul lewat latihan terstruktur.`
  );
}

/**
 * Thread-style detail for one scholarship.
 * Returns null if id is unknown.
 */
export function formatScholarshipDetail(id: string): string | null {
  const s = getScholarship(id);
  if (!s) return null;

  const emoji = SCHOLARSHIP_EMOJI[s.id] || '🎓';

  return (
    `${emoji} *${s.name}*\n` +
    `${s.tagline}\n\n` +
    `📋 *Syarat bahasa Inggris*\n` +
    `${s.english_req}\n\n` +
    `🗓 *Perkiraan timeline*\n` +
    `${s.deadline_hint} — jadwal pasti tiap tahun bisa bergeser, cek situs resmi.\n\n` +
    `💡 *Tips dari aku*\n` +
    `${s.tips}\n\n` +
    `🎯 *Strategi skor*\n` +
    `${scoreStrategy(s)}\n\n` +
    `Langkah berikutnya:\n` +
    `1. Set tanggal tes kamu: /examdate YYYY-MM-DD — aku bikinin countdown + taper plan\n` +
    `2. Kunci target skor di /settings biar semua latihanmu ngarah ke beasiswa ini\n` +
    `3. Belum tau posisi sekarang? Mulai dari /diagnostic`
  );
}

// ─── Matching ───────────────────────────────────────────

export interface ScholarshipMatch {
  scholarship: Scholarship;
  /** Student's estimate converted to IELTS-equivalent band. */
  current_band: number;
  /** target_band - current_band (negative = already above target). */
  gap: number;
  /** Encouragement line, ready to render. */
  framing: string;
}

/**
 * Convert a score estimate (from score-predictor scales) to a rough
 * IELTS-equivalent band for matching. Conversions are approximate
 * concordances — good enough for "striking distance" framing, never
 * shown as official equivalences.
 */
export function toIeltsEquivalent(scale: string, score: number): number {
  switch (scale) {
    case 'ielts_band':
      return score;
    case 'toefl_ibt':
      if (score >= 110) return 8.0;
      if (score >= 102) return 7.5;
      if (score >= 94) return 7.0;
      if (score >= 79) return 6.5;
      if (score >= 60) return 6.0;
      if (score >= 46) return 5.5;
      if (score >= 35) return 5.0;
      return 4.5;
    case 'toefl_itp':
      if (score >= 627) return 7.0;
      if (score >= 600) return 6.5;
      if (score >= 550) return 6.0;
      if (score >= 513) return 5.5;
      if (score >= 477) return 5.0;
      return 4.5;
    case 'toeic':
      if (score >= 945) return 7.5;
      if (score >= 850) return 7.0;
      if (score >= 785) return 6.5;
      if (score >= 700) return 6.0;
      if (score >= 550) return 5.5;
      if (score >= 450) return 5.0;
      return 4.5;
    default:
      return score; // unknown scale: assume band-like
  }
}

function framingFor(gap: number, s: Scholarship): string {
  if (gap <= 0) {
    return `Estimasi skor kamu *udah masuk range* syarat bahasanya — sekarang tinggal jaga konsistensi dan amankan sertifikat resmi sebelum batch buka.`;
  }
  if (gap <= 0.5) {
    return `Kamu *tinggal selangkah lagi* — naik ${gap.toFixed(1)} band itu biasanya 4-8 minggu latihan fokus. Ini target paling realistis buat kamu sekarang.`;
  }
  if (gap <= 1.0) {
    return `Gap ${gap.toFixed(1)} band itu *sangat kejar-able* dalam 2-3 bulan latihan rutin. Banyak awardee ${s.name.split(' (')[0]} mulai dari posisi yang sama dengan kamu.`;
  }
  return `Masih ada jarak ${gap.toFixed(1)} band, tapi bukan tembok — dengan rencana belajar terstruktur, 3-6 bulan itu cukup. Yang penting mulai dari sekarang, bukan nanti.`;
}

/**
 * Match the student's current estimate against the scholarship list.
 * Returns 2-3 scholarships within striking distance (estimate >= min_band),
 * closest-gap first, each with an encouragement framing line.
 *
 * null estimate (no data yet) → empty array; caller should point the
 * student to /diagnostic instead.
 */
export function matchScholarships(
  currentEstimate: { scale: string; score: number } | null,
): ScholarshipMatch[] {
  if (!currentEstimate) return [];

  const band = toIeltsEquivalent(currentEstimate.scale, currentEstimate.score);

  const ranked = SCHOLARSHIPS
    .map((s) => ({
      scholarship: s,
      current_band: band,
      gap: Math.round((s.target_band - band) * 10) / 10,
      framing: '',
    }))
    .sort((a, b) => a.gap - b.gap || a.scholarship.target_band - b.scholarship.target_band);

  // Within striking distance: at/above the scholarship's internal floor.
  let matches = ranked.filter((m) => band >= m.scholarship.min_band).slice(0, 3);
  // Very low estimate: still surface the 2 most reachable so the student
  // always has a concrete goal to aim at.
  if (matches.length < 2) matches = ranked.slice(0, 2);

  for (const m of matches) m.framing = framingFor(m.gap, m.scholarship);
  return matches;
}

/**
 * Ready-to-send Indonesian block for the /beasiswa command: the student's
 * matched scholarships with encouragement, or a /diagnostic nudge when we
 * have no estimate yet. Designed to be prepended above getScholarshipMenu().
 */
export function formatScholarshipMatches(
  currentEstimate: { scale: string; score: number } | null,
): string {
  const matches = matchScholarships(currentEstimate);
  if (!currentEstimate || matches.length === 0) {
    return (
      `Aku belum punya estimasi skor kamu, jadi belum bisa nunjukin beasiswa mana yang paling dekat.\n\n` +
      `Kerjain /diagnostic dulu (20 soal, ±15 menit) — habis itu aku cocokkan posisimu dengan daftar di bawah.`
    );
  }

  const band = matches[0].current_band;
  const lines = matches.map((m) => {
    const emoji = SCHOLARSHIP_EMOJI[m.scholarship.id] || '🎓';
    const status =
      m.gap <= 0 ? 'udah masuk range ✅' : `gap ${m.gap.toFixed(1)} band`;
    return `${emoji} *${m.scholarship.name.split(' (')[0]}* — butuh ~IELTS ${m.scholarship.target_band.toFixed(1)} (${status})`;
  });

  return (
    `Berdasarkan estimasi skor kamu sekarang (~IELTS ${band.toFixed(1)} setara), ini beasiswa yang *paling dekat dalam jangkauan*:\n\n` +
    `${lines.join('\n')}\n\n` +
    `${matches[0].framing}`
  );
}
