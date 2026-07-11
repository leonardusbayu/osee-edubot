// Cross-test skill transfer matrix.
//
// Heuristic mapping between the 4 tests' sections. A student strong
// in IELTS reading is likely strong in TOEFL iBT reading (the skill is
// the same: read academic text + answer questions). This is NOT a
// calibrated IRT transfer model — it's a practical heuristic for
// "if you're good at X, try Y" suggestions.
//
// Calibration: cross-test IRT transfer would require a research study
// (administer IELTS + TOEFL iBT to the same students, fit a joint IRT
// model). Until that's done, this heuristic is the best we have.
//
// Each test's section-to-skill mapping (which is just "section" since
// the 4 tests share section names like reading/listening/writing).

export type TestType = 'IELTS' | 'TOEFL_IBT' | 'TOEFL_ITP' | 'TOEIC';
export type SectionType = 'reading' | 'listening' | 'writing' | 'speaking' | 'structure';

// Transfer confidence: 1.0 = same test, 0.8 = same section across
// similar tests, 0.6 = same section across different formats.
const TRANSFER_MATRIX: Record<TestType, Record<SectionType, Array<{ test: TestType; section: SectionType; confidence: number; note: string }>>> = {
  IELTS: {
    reading: [
      { test: 'TOEFL_IBT', section: 'reading', confidence: 0.85, note: 'Both test academic reading comprehension with similar question types (main idea, detail, inference).' },
      { test: 'TOEFL_ITP', section: 'reading', confidence: 0.75, note: 'ITP reading is slightly easier (short passages vs long academic texts) but same skills.' },
    ],
    listening: [
      { test: 'TOEFL_IBT', section: 'listening', confidence: 0.80, note: 'Both test academic listening (lectures + conversations).' },
      { test: 'TOEIC', section: 'listening', confidence: 0.85, note: 'Both test short workplace conversations + talks.' },
    ],
    writing: [
      { test: 'TOEFL_IBT', section: 'writing', confidence: 0.80, note: 'Both test integrated + independent writing. iBT is more academic.' },
    ],
    speaking: [
      { test: 'TOEFL_IBT', section: 'speaking', confidence: 0.75, note: 'Both test academic speaking tasks. Format differs (iBT is recorded, IELTS is face-to-face).' },
    ],
    structure: [],
  },
  TOEFL_IBT: {
    reading: [
      { test: 'IELTS', section: 'reading', confidence: 0.85, note: 'Same academic reading skills.' },
      { test: 'TOEFL_ITP', section: 'reading', confidence: 0.75, note: 'ITP is easier passages.' },
    ],
    listening: [
      { test: 'IELTS', section: 'listening', confidence: 0.80, note: 'Same academic listening.' },
      { test: 'TOEIC', section: 'listening', confidence: 0.75, note: 'TOEIC is workplace context, iBT is academic.' },
    ],
    writing: [
      { test: 'IELTS', section: 'writing', confidence: 0.80, note: 'Both integrated + independent writing.' },
    ],
    speaking: [
      { test: 'IELTS', section: 'speaking', confidence: 0.75, note: 'Same academic speaking.' },
    ],
    structure: [],
  },
  TOEFL_ITP: {
    structure: [
      { test: 'TOEFL_IBT', section: 'writing', confidence: 0.50, note: 'ITP structure tests grammar, iBT writing tests grammar + content. Partial transfer.' },
    ],
    reading: [
      { test: 'TOEFL_IBT', section: 'reading', confidence: 0.75, note: 'Same reading skills, ITP passages shorter.' },
      { test: 'IELTS', section: 'reading', confidence: 0.70, note: 'Similar but IELTS has more question types.' },
    ],
    listening: [
      { test: 'TOEFL_IBT', section: 'listening', confidence: 0.70, note: 'ITP is academic lectures, iBT is academic lectures + conversations.' },
    ],
    writing: [],
    speaking: [],
  },
  TOEIC: {
    listening: [
      { test: 'IELTS', section: 'listening', confidence: 0.65, note: 'TOEIC is business English, IELTS is academic. Partial transfer.' },
    ],
    reading: [
      { test: 'IELTS', section: 'reading', confidence: 0.60, note: 'TOEIC is short business texts, IELTS is academic. Limited transfer.' },
    ],
    writing: [],
    speaking: [],
    structure: [],
  },
};

/**
 * Given a student's strongest section in one test, suggest sections
 * in other tests they should practice.
 */
export function suggestCrossTestPractice(
  fromTest: TestType,
  fromSection: SectionType,
  topN: number = 3,
): Array<{ test: TestType; section: SectionType; confidence: number; note: string }> {
  const transfers = TRANSFER_MATRIX[fromTest]?.[fromSection] || [];
  return transfers
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, topN);
}

/**
 * Given the student's IRT profile (theta per section), pick the top
 * recommended cross-test practice. The recommendation is based on
 * their STRONGEST section (high theta) — practice in the related test
 * will likely transfer.
 */
export function recommendFromIRT(
  abilities: Array<{ skill: string; theta: number }>,
  currentTest: TestType,
  topN: number = 2,
): Array<{ test: TestType; section: SectionType; confidence: number; note: string; source_theta: number }> {
  if (!abilities.length) return [];
  // Sort by theta descending
  const sorted = [...abilities].sort((a, b) => b.theta - a.theta);
  const recommendations: Array<{ test: TestType; section: SectionType; confidence: number; note: string; source_theta: number }> = [];
  for (const ability of sorted) {
    const section = ability.skill as SectionType;
    const transfers = suggestCrossTestPractice(currentTest, section, topN);
    for (const t of transfers) {
      recommendations.push({ ...t, source_theta: ability.theta });
    }
    if (recommendations.length >= topN) break;
  }
  return recommendations;
}