import { describe, it, expect } from 'vitest';
import { scoreAttempt } from './tests';

// These tests lock in the scoring contract that the user actually cares about:
// "speaking/writing students saw 0 instead of their real score" was the
// reported bug that drove the refactor. Every branch of scoreAttempt gets
// explicit coverage so a future refactor can't silently regress it.

const iBtSections = [
  { id: 'reading', name: 'Reading', duration_minutes: 30 },
  { id: 'listening', name: 'Listening', duration_minutes: 29 },
  { id: 'speaking', name: 'Speaking', duration_minutes: 8 },
  { id: 'writing', name: 'Writing', duration_minutes: 23 },
];

describe('scoreAttempt', () => {
  it('returns null for an attempt with zero scorable answers', () => {
    expect(scoreAttempt([], 'TOEFL_IBT', iBtSections, 6)).toBeNull();
  });

  it('returns null when every answer is malformed (no is_correct, no answer_data.score)', () => {
    const answers = [
      { section: 'reading', is_correct: null, answer_data: '{}' },
      { section: 'speaking', is_correct: null, answer_data: '{"note":"missing score"}' },
    ];
    expect(scoreAttempt(answers, 'TOEFL_IBT', iBtSections, 6)).toBeNull();
  });

  it('scores objective sections as correct/total × max_band, rounded to .5', () => {
    const answers = [
      { section: 'reading', is_correct: 1, answer_data: '{}' },
      { section: 'reading', is_correct: 1, answer_data: '{}' },
      { section: 'reading', is_correct: 0, answer_data: '{}' },
    ];
    const result = scoreAttempt(answers, 'TOEFL_IBT', iBtSections, 6);
    expect(result).not.toBeNull();
    // 2/3 × 6 = 4.0 (rounded to nearest 0.5)
    expect(result!.sectionScores.reading).toBe(4);
    // Skipped sections are null, not 0 — UI renders them as "—"
    expect(result!.sectionScores.listening).toBeNull();
    expect(result!.sectionScores.speaking).toBeNull();
    expect(result!.sectionScores.writing).toBeNull();
  });

  it('scores speaking/writing from answer_data.score (the bug this test locks in)', () => {
    // Previously is_correct !== null filter excluded speaking answers
    // entirely → student who got 5/6 saw "Speaking: 0". Now we pull the
    // band directly from answer_data.score.
    const answers = [
      { section: 'speaking', is_correct: null, answer_data: '{"score": 5}' },
      { section: 'speaking', is_correct: null, answer_data: '{"score": 4.5}' },
      { section: 'writing', is_correct: null, answer_data: JSON.stringify({ score: 3 }) },
    ];
    const result = scoreAttempt(answers, 'TOEFL_IBT', iBtSections, 6);
    // (5 + 4.5) / 2 = 4.75 → rounded to nearest .5 is 5 (Math.round(9.5)=10 / 2)
    expect(result!.sectionScores.speaking).toBe(5);
    expect(result!.sectionScores.writing).toBe(3);
  });

  it('clamps speaking/writing scores to max_band (protects against AI returning 99)', () => {
    const answers = [
      { section: 'speaking', is_correct: null, answer_data: '{"score": 99}' },
    ];
    const result = scoreAttempt(answers, 'TOEFL_IBT', iBtSections, 6);
    expect(result!.sectionScores.speaking).toBe(6);
  });

  it('ignores non-numeric answer_data.score (falls back to null section)', () => {
    const answers = [
      { section: 'speaking', is_correct: null, answer_data: '{"score": "excellent"}' },
    ];
    expect(scoreAttempt(answers, 'TOEFL_IBT', iBtSections, 6)).toBeNull();
  });

  it('tolerates malformed answer_data JSON without throwing', () => {
    const answers = [
      { section: 'speaking', is_correct: null, answer_data: 'not-valid-json' },
      { section: 'reading', is_correct: 1, answer_data: '{}' },
    ];
    const result = scoreAttempt(answers, 'TOEFL_IBT', iBtSections, 6);
    expect(result!.sectionScores.reading).toBe(6); // 1/1 × 6
    expect(result!.sectionScores.speaking).toBeNull();
  });

  it('accepts answer_data as already-parsed object (not just string)', () => {
    const answers = [
      { section: 'speaking', is_correct: null, answer_data: { score: 5 } as any },
    ];
    const result = scoreAttempt(answers, 'TOEFL_IBT', iBtSections, 6);
    expect(result!.sectionScores.speaking).toBe(5);
  });

  it('computes totalScore as average of non-null section scores', () => {
    const answers = [
      { section: 'reading', is_correct: 1, answer_data: '{}' },
      { section: 'reading', is_correct: 1, answer_data: '{}' }, // reading 6.0
      { section: 'speaking', is_correct: null, answer_data: '{"score": 4}' }, // speaking 4.0
    ];
    const result = scoreAttempt(answers, 'TOEFL_IBT', iBtSections, 6);
    expect(result!.totalScore).toBe(5); // (6 + 4) / 2
  });

  it('reports scoredSectionCount and scoredAnswerCount accurately', () => {
    const answers = [
      { section: 'reading', is_correct: 1, answer_data: '{}' },
      { section: 'listening', is_correct: 0, answer_data: '{}' },
      { section: 'listening', is_correct: 1, answer_data: '{}' },
      { section: 'speaking', is_correct: null, answer_data: '{"score": 4}' },
    ];
    const result = scoreAttempt(answers, 'TOEFL_IBT', iBtSections, 6);
    expect(result!.scoredSectionCount).toBe(3); // reading, listening, speaking
    expect(result!.scoredAnswerCount).toBe(4);
  });
});
