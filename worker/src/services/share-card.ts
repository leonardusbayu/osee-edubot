/**
 * Shareable score-card generator (MASTER_PLAN.md Phase 5.1).
 *
 * Renders a 1080x1080 SVG achievement card students can share to
 * IG/WA status. The referral deep link is baked into the image, so
 * every share is free distribution.
 *
 * Design constraints:
 *   - Pure string template, zero runtime deps, no canvas.
 *   - NO external fonts/images — system font stack only, so the SVG
 *     renders standalone in any browser/viewer with no network access.
 *   - All user-controlled strings are XML-escaped here (defense in
 *     depth even if callers pre-sanitize).
 */

export interface ShareCardOpts {
  /** Student first name (escaped + truncated internally). */
  name: string;
  /** Human test label, e.g. "TOEFL iBT", "IELTS". */
  testType: string;
  /** Big headline score, e.g. "IELTS 6.0", "TOEFL iBT 95". */
  scoreLabel: string;
  /** Improvement badge, e.g. "+0.5 dalam 30 hari" — null hides the badge. */
  deltaLabel: string | null;
  /** Current study streak in days — 0 hides the flame. */
  streak: number;
  /** Full bot deep link with the user's referral code, e.g. "https://t.me/...?start=ref_...". */
  refCode: string;
}

const FONT_STACK = `-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif`;

export function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
}

export function generateScoreCardSvg(opts: ShareCardOpts): string {
  const safeName = escapeXml(truncate(opts.name || 'Pejuang Skor', 24));
  const safeTest = escapeXml(truncate(opts.testType || '', 16));
  const safeScore = escapeXml(truncate(opts.scoreLabel || '', 18));
  const safeDelta = opts.deltaLabel ? escapeXml(truncate(opts.deltaLabel, 32)) : null;
  const streak = Math.max(0, Math.floor(Number(opts.streak) || 0));

  // Display the link without protocol; keep it short and copyable.
  const displayLink = escapeXml(String(opts.refCode || '').replace(/^https?:\/\//, ''));

  // Adaptive sizing so long labels ("TOEFL ITP 550") never overflow 1080px.
  const scoreLen = (opts.scoreLabel || '').length;
  const scoreFs = scoreLen <= 10 ? 148 : scoreLen <= 14 ? 112 : 86;
  const linkLen = displayLink.length;
  const linkFs = linkLen > 64 ? 24 : linkLen > 56 ? 27 : 30;

  // Test-type pill (top right) — width estimated from char count.
  const testPillW = Math.round(safeTest.length * 16 + 48);
  const testPillX = 984 - testPillW;

  // Delta badge (only when there is positive progress to brag about).
  let deltaBlock = '';
  if (safeDelta) {
    const text = `▲ ${safeDelta}`; // ▲ prefix — universal glyph, no emoji font needed
    const w = Math.round(text.length * 18 + 72);
    const x = Math.round(540 - w / 2);
    deltaBlock = `
  <!-- delta badge -->
  <rect x="${x}" y="556" width="${w}" height="68" rx="34" fill="rgba(16,185,129,0.18)" stroke="#34D399" stroke-width="1.5"/>
  <text x="540" y="601" text-anchor="middle" font-family="${FONT_STACK}" font-size="34" font-weight="600" fill="#6EE7B7">${text}</text>`;
  }

  // Streak flame — drawn as paths (no emoji, renders everywhere).
  let streakBlock = '';
  if (streak > 0) {
    streakBlock = `
  <!-- streak flame -->
  <g transform="translate(520,652)">
    <path d="M20 0C24 12 38 18 38 32a18 18 0 0 1-36 0C2 18 16 12 20 0Z" fill="url(#flameGrad)"/>
    <path d="M20 22c2.5 7 9 9.5 9 16a9 9 0 0 1-18 0c0-6.5 6.5-9 9-16Z" fill="#FEF3C7"/>
  </g>
  <text x="540" y="756" text-anchor="middle" font-family="${FONT_STACK}" font-size="34" font-weight="600" fill="#FDBA74">${streak} hari streak belajar</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B1026"/>
      <stop offset="55%" stop-color="#171238"/>
      <stop offset="100%" stop-color="#3B1D6E"/>
    </linearGradient>
    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
    <linearGradient id="flameGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FACC15"/>
      <stop offset="100%" stop-color="#F97316"/>
    </linearGradient>
  </defs>

  <!-- background -->
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <circle cx="940" cy="180" r="260" fill="rgba(56,189,248,0.08)"/>
  <circle cx="160" cy="920" r="220" fill="rgba(124,58,237,0.12)"/>

  <!-- card frame -->
  <rect x="40" y="40" width="1000" height="1000" rx="48" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>

  <!-- brand -->
  <rect x="96" y="88" width="72" height="72" rx="20" fill="url(#scoreGrad)"/>
  <text x="132" y="140" text-anchor="middle" font-family="${FONT_STACK}" font-size="44" font-weight="800" fill="#1E1B4B">E</text>
  <text x="192" y="124" font-family="${FONT_STACK}" font-size="46" font-weight="800" fill="#FFFFFF">EduBot</text>
  <text x="192" y="158" font-family="${FONT_STACK}" font-size="24" fill="rgba(255,255,255,0.65)">AI Tutor di Telegram</text>
  <rect x="${testPillX}" y="96" width="${testPillW}" height="52" rx="26" fill="rgba(167,139,250,0.15)" stroke="rgba(167,139,250,0.4)" stroke-width="1.5"/>
  <text x="${testPillX + Math.round(testPillW / 2)}" y="131" text-anchor="middle" font-family="${FONT_STACK}" font-size="28" font-weight="600" fill="#C4B5FD">${safeTest}</text>

  <!-- student + score -->
  <text x="540" y="300" text-anchor="middle" font-family="${FONT_STACK}" font-size="44" font-weight="700" fill="#E0E7FF">${safeName}</text>
  <text x="540" y="352" text-anchor="middle" font-family="${FONT_STACK}" font-size="28" fill="rgba(255,255,255,0.7)">Estimasi skor aku sekarang</text>
  <text x="540" y="510" text-anchor="middle" font-family="${FONT_STACK}" font-size="${scoreFs}" font-weight="800" fill="url(#scoreGrad)" letter-spacing="1">${safeScore}</text>
${deltaBlock}
${streakBlock}

  <!-- CTA -->
  <line x1="140" y1="830" x2="940" y2="830" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
  <text x="540" y="888" text-anchor="middle" font-family="${FONT_STACK}" font-size="32" font-weight="600" fill="#FFFFFF">Aku belajar di EduBot. Kamu juga bisa, gratis:</text>
  <text x="540" y="940" text-anchor="middle" font-family="${FONT_STACK}" font-size="${linkFs}" font-weight="600" fill="#93C5FD">${displayLink}</text>
  <text x="540" y="1002" text-anchor="middle" font-family="${FONT_STACK}" font-size="22" fill="rgba(255,255,255,0.5)">EduBot — TOEFL iBT • IELTS • TOEIC</text>
</svg>`;
}
