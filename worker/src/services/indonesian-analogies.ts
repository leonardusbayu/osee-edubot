// ═══════════════════════════════════════════════════════
// INDONESIAN ANALOGIES ENGINE
// 
// Maps English grammar concepts to Indonesian cultural
// analogies for better comprehension. Pre-seeded with
// common analogies, AI can also generate new ones.
// ═══════════════════════════════════════════════════════

import type { Env } from '../types';

export interface Analogy {
  id: number;
  concept: string;
  analogy_id: string;
  analogy_text: string;
  category: string;
  usage_count: number;
  effectiveness_score: number;
  is_active: boolean;
}

// Concept → analogy mapping for quick lookup (fallback if DB empty)
const BUILTIN_ANALOGIES: Record<string, string[]> = {
  'articles': [
    'Articles itu kayak naik ojol. Kalau bilang "tumpang ojol" (a ojol) = ojol mana aja. Kalau bilang "tumpang ojol yang tadi" (the ojol) = spesifik, yang itu.',
    'Pertama kali sebut "ada warung baru" = a warung. Kedua kali "warungnya enak" = the warung — udah tau yang mana.',
  ],
  'tenses': [
    'Tenses itu kayak foto vs video. Simple tense = foto (satu momen). Continuous = video (sedang berlangsung). Perfect = foto yang udah diambil tapi masih nyambung sampe sekarang.',
  ],
  'present_perfect': [
    'Present Perfect itu kayak chat history. "I have eaten" = udah makan (dan masih ada bekasnya di chat history). Bukan "I ate" = udah makan (tutup chat, selesai).',
  ],
  'past_simple': [
    'Simple Past itu kayak album foto lama. "I went to Bali" = foto di album, udah selesai, nggak berubah. Ada waktu spesifik: "last year", "yesterday".',
  ],
  'prepositions': [
    'Preposisi waktu itu kayak ngirim paket: AT = jam spesifik (at 3pm), ON = hari tertentu (on Monday), IN = bulan/tahun (in 2024).',
  ],
  'conditionals': [
    'Conditional itu kayak "andai" di Bahasa. "Andai aku kaya..." = nggak nyata (If I were rich). "Kalau hujan, aku bawa payung" = nyata (If it rains, I bring an umbrella).',
  ],
  'passive_voice': [
    'Passive voice itu kayak gosip — yang penting BERITANYA, bukan siapa yang ngomong. "The cake was eaten" = kue-nya dimakan (siapa? nggak penting).',
  ],
  'sv_agreement': [
    'Subject-Verb Agreement itu kayak pasangan dance. Satu pasang = verb + S (She dances). Banyak pasang = verb tanpa S (They dance).',
  ],
  'relative_clauses': [
    'Relative clause itu kayak deskripsi teman. "Teman yang pake kacamata" = the friend who wears glasses. "Buku yang merah" = the book which is red.',
  ],
  'gerunds': [
    'Gerund itu kayak kata kerja yang jadi benda. "Swimming is fun" = "Berenang itu seru". Verb + ing = jadi noun.',
  ],
  'reported_speech': [
    'Reported speech itu kayak nerusin pesan berantai. Dia bilang "Aku lapar" → Dia bilang kalau dia lapar. Tense-nya mundur satu step.',
  ],
};

/**
 * Get analogies for a concept from the database.
 */
export async function getAnalogies(env: Env, concept: string, limit: number = 2): Promise<Analogy[]> {
  try {
    const rows = await env.DB.prepare(
      `SELECT id, concept, analogy_id, analogy_text, category, usage_count, effectiveness_score, is_active
       FROM indonesian_analogies
       WHERE concept = ? AND is_active = 1
       ORDER BY effectiveness_score DESC, usage_count ASC
       LIMIT ?`
    ).bind(concept, limit).all() as any;

    return (rows.results || []).map((r: any) => ({
      id: r.id,
      concept: r.concept,
      analogy_id: r.analogy_id,
      analogy_text: r.analogy_text,
      category: r.category,
      usage_count: r.usage_count,
      effectiveness_score: r.effectiveness_score,
      is_active: !!r.is_active,
    }));
  } catch {
    return [];
  }
}

/**
 * Get a random analogy for a concept (with fallback to builtins).
 */
export async function getAnalogyForConcept(env: Env, concept: string): Promise<string | null> {
  const dbAnalogies = await getAnalogies(env, concept, 1);
  if (dbAnalogies.length > 0) {
    return dbAnalogies[0].analogy_text;
  }

  // Fallback to builtins
  const builtins = BUILTIN_ANALOGIES[concept];
  if (builtins && builtins.length > 0) {
    return builtins[Math.floor(Math.random() * builtins.length)];
  }

  return null;
}

/**
 * Track analogy usage and effectiveness.
 */
export async function trackAnalogyEffectiveness(
  env: Env,
  analogyId: number,
  wasEffective: boolean,
): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE indonesian_analogies
       SET usage_count = usage_count + 1,
           effectiveness_score = effectiveness_score + ?
       WHERE id = ?`
    ).bind(wasEffective ? 0.05 : -0.03, analogyId).run();
  } catch {}
}

/**
 * Inject analogy into system prompt for a concept.
 * Returns a formatted string to append to the system prompt.
 */
export async function buildAnalogyContext(env: Env, concept: string): Promise<string> {
  const analogy = await getAnalogyForConcept(env, concept);
  if (!analogy) return '';

  return `\nANALOGI INDONESIA: Gunakan analogi ini untuk menjelaskan konsep "${concept}":\n"${analogy}"\nJangan langsung kasih analogi ini — pakai saat murid terlihat bingung atau setelah mereka salah 2x.`;
}

/**
 * Detect which concept the student is struggling with.
 */
export function detectStruggleConcept(message: string): string | null {
  const lower = message.toLowerCase();

  const conceptMap: Record<string, RegExp[]> = {
    'articles': [/\b(a|an|the)\b.*kenapa/i, /article/i, /a an the/i],
    'tenses': [/tense/i, /present.*past/i, /past.*present/i, /waktu.*kerja/i],
    'prepositions': [/(at|on|in).*beda/i, /preposisi/i],
    'conditionals': [/if.*would/i, /conditional/i, /andai/i],
    'passive_voice': [/passive/i, /di.*-kan/i, /di.*-i/i],
    'sv_agreement': [/subject.*verb/i, /singular.*plural/i, /-s\b.*-es\b/i],
    'relative_clauses': [/who.*which/i, /relative/i, /yang.*which/i],
  };

  for (const [concept, patterns] of Object.entries(conceptMap)) {
    if (patterns.some(p => p.test(lower))) {
      return concept;
    }
  }

  return null;
}

/**
 * Get analogy for a student's question and format it into a helpful hint.
 */
export async function getAnalogyHint(env: Env, message: string): Promise<string | null> {
  const concept = detectStruggleConcept(message);
  if (!concept) return null;

  const analogy = await getAnalogyForConcept(env, concept);
  if (!analogy) return null;

  return `💡 Coba pikir gini: ${analogy}`;
}
