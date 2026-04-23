// ═══════════════════════════════════════════════════════
// SEASONAL EVENTS ENGINE
// 
// Monthly themed events with special challenges, bonus XP,
// and limited-time badges. Keeps engagement high by
// providing fresh content and urgency.
// ═══════════════════════════════════════════════════════

import type { Env } from '../types';

export interface SeasonalEvent {
  id: string;
  name: string;
  theme: string;
  startDate: string;
  endDate: string;
  bonusXpMultiplier: number;
  specialBadge: string | null;
  description: string;
  isActive: boolean;
}

// Pre-defined seasonal events for 2026
const SEASONAL_EVENTS: Record<string, Omit<SeasonalEvent, 'isActive'>> = {
  '2026-01': {
    id: '2026-01',
    name: 'New Year, New Words',
    theme: 'vocabulary',
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    bonusXpMultiplier: 1.5,
    specialBadge: '🎆 Word Warrior',
    description: 'Awal tahun, saatnya perbanyak vocab! Setiap soal vocabulary = 1.5x XP.',
  },
  '2026-02': {
    id: '2026-02',
    name: 'Love Language',
    theme: 'romance_vocab',
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    bonusXpMultiplier: 1.5,
    specialBadge: '💕 Love Linguist',
    description: 'Belajar English lewat tema cinta & Valentine. Bonus XP untuk soal reading!',
  },
  '2026-03': {
    id: '2026-03',
    name: 'Grammar Marathon',
    theme: 'grammar',
    startDate: '2026-03-01',
    endDate: '2026-03-31',
    bonusXpMultiplier: 1.5,
    specialBadge: '🏃 Grammar Runner',
    description: 'Sebulan penuh fokus grammar! Setiap grammar exercise = bonus XP.',
  },
  '2026-04': {
    id: '2026-04',
    name: 'Earth Day English',
    theme: 'environment',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    bonusXpMultiplier: 1.5,
    specialBadge: '🌍 Eco Scholar',
    description: 'Belajar English lewat topik lingkungan. Reading comprehension = bonus XP.',
  },
  '2026-05': {
    id: '2026-05',
    name: 'Speaking Sprint',
    theme: 'speaking',
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    bonusXpMultiplier: 2.0,
    specialBadge: '🎤 Speaking Star',
    description: 'Bulan speaking! Setiap speaking practice = 2x XP. Ayo latihan!',
  },
  '2026-06': {
    id: '2026-06',
    name: 'Writing Workshop',
    theme: 'writing',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    bonusXpMultiplier: 2.0,
    specialBadge: '✍️ Writing Wizard',
    description: 'Fokus writing! Setiap essay = 2x XP. Tingkatkan skor writing kamu.',
  },
  '2026-07': {
    id: '2026-07',
    name: 'Summer Challenge',
    theme: 'mixed',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    bonusXpMultiplier: 1.5,
    specialBadge: '☀️ Summer Scholar',
    description: 'Challenge musim panas! Semua section = bonus XP. Jangan lupa belajar!',
  },
  '2026-08': {
    id: '2026-08',
    name: 'Independence Quiz',
    theme: 'quiz',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    bonusXpMultiplier: 1.5,
    specialBadge: '🇮🇩 Merdeka Scholar',
    description: 'Rayakan kemerdekaan dengan quiz marathon! Setiap quiz = bonus XP.',
  },
  '2026-09': {
    id: '2026-09',
    name: 'Back to School',
    theme: 'academic',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    bonusXpMultiplier: 1.5,
    specialBadge: '📚 Back2School',
    description: 'Kembali ke mode belajar! Academic vocabulary = bonus XP.',
  },
  '2026-10': {
    id: '2026-10',
    name: 'Spooky English',
    theme: 'halloween',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    bonusXpMultiplier: 1.5,
    specialBadge: '🎃 Spooky Scholar',
    description: 'Halloween special! Belajar English lewat cerita horror & mystery.',
  },
  '2026-11': {
    id: '2026-11',
    name: 'Gratitude Grammar',
    theme: 'grammar',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    bonusXpMultiplier: 1.5,
    specialBadge: '🦃 Grateful Grammarian',
    description: 'Bulan syukur. Latihan grammar intensif = bonus XP.',
  },
  '2026-12': {
    id: '2026-12',
    name: 'Year-End Sprint',
    theme: 'mixed',
    startDate: '2026-12-01',
    endDate: '2026-12-31',
    bonusXpMultiplier: 2.0,
    specialBadge: '🎄 Year-End Champion',
    description: 'Finish strong! Semua activity = 2x XP. Tutup tahun dengan skor tinggi!',
  },
};

/**
 * Get the current active seasonal event.
 */
export function getCurrentEvent(): SeasonalEvent | null {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const event = SEASONAL_EVENTS[yearMonth];
  if (!event) return null;

  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  endDate.setHours(23, 59, 59, 999);

  if (now >= startDate && now <= endDate) {
    return { ...event, isActive: true };
  }

  return null;
}

/**
 * Get the seasonal event bonus multiplier for a given activity.
 */
export function getSeasonalBonusMultiplier(section?: string): number {
  const event = getCurrentEvent();
  if (!event) return 1.0;

  // Some events have section-specific bonuses
  if (event.theme === 'vocabulary' && section === 'vocabulary') return event.bonusXpMultiplier;
  if (event.theme === 'grammar' && section === 'structure') return event.bonusXpMultiplier;
  if (event.theme === 'speaking' && section === 'speaking') return event.bonusXpMultiplier;
  if (event.theme === 'writing' && section === 'writing') return event.bonusXpMultiplier;
  if (event.theme === 'romance_vocab' && section === 'reading') return event.bonusXpMultiplier;
  if (event.theme === 'environment' && section === 'reading') return event.bonusXpMultiplier;

  // Mixed themes apply to all sections
  if (event.theme === 'mixed') return event.bonusXpMultiplier;

  return 1.0;
}

/**
 * Format seasonal event announcement message.
 */
export function formatEventAnnouncement(): string | null {
  const event = getCurrentEvent();
  if (!event) return null;

  return `🎉 *EVENT BARU: ${event.name}!*

${event.description}

🏅 Badge spesial: ${event.specialBadge}
⏰ Berlaku sampai ${new Date(event.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}

Ayo mulai latihan sekarang! 💪`;
}

/**
 * Check if user has already been notified about the current event.
 */
export async function hasUserSeenEvent(env: Env, userId: number): Promise<boolean> {
  const event = getCurrentEvent();
  if (!event) return true;

  try {
    const row = await env.DB.prepare(
      'SELECT 1 FROM seasonal_event_log WHERE user_id = ? AND event_id = ?'
    ).bind(userId, event.id).first();

    return !!row;
  } catch {
    return false;
  }
}

/**
 * Mark that user has been notified about the current event.
 */
export async function markEventSeen(env: Env, userId: number): Promise<void> {
  const event = getCurrentEvent();
  if (!event) return;

  try {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO seasonal_event_log (user_id, event_id, seen_at) VALUES (?, ?, datetime("now"))'
    ).bind(userId, event.id).run();
  } catch {}
}

/**
 * Get seasonal event context for system prompt.
 */
export function getEventSystemPrompt(): string {
  const event = getCurrentEvent();
  if (!event) return '';

  const themePrompts: Record<string, string> = {
    vocabulary: 'Saat ini ada event "New Year, New Words" — fokus ke vocabulary. Kasih contoh vocabulary yang lebih sering.',
    romance_vocab: 'Saat ini ada event "Love Language" — kasih contoh kalimat bertema cinta & hubungan.',
    grammar: 'Saat ini ada event "Grammar Marathon" — fokus ke grammar. Kasih lebih banyak soal grammar.',
    environment: 'Saat ini ada event "Earth Day English" — kasih contoh kalimat bertema lingkungan.',
    speaking: 'Saat ini ada event "Speaking Sprint" — encourage student untuk latihan speaking lebih sering.',
    writing: 'Saat ini ada event "Writing Workshop" — encourage student untuk latihan writing.',
    mixed: 'Saat ini ada event seasonal — kasih semangat dan variasi soal.',
    quiz: 'Saat ini ada event "Independence Quiz" — kasih lebih banyak quiz & challenge.',
    academic: 'Saat ini ada event "Back to School" — fokus ke academic English.',
    halloween: 'Saat ini ada event "Spooky English" — kasih contoh bertema horror/mystery.',
  };

  return `\nSEASONAL EVENT: "${event.name}" — ${themePrompts[event.theme] || ''}`;
}
