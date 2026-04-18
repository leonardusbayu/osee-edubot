import { describe, it, expect } from 'vitest';
import { buildAttemptSummary, type AttemptAnalysis } from './post-test-review';

// Lock in the 4 narrative paths that buildAttemptSummary chooses between.
// These messages are what students see on their results page, so subtle
// wording regressions matter — they shape how a student feels about the test.

const emptyAnalysis: AttemptAnalysis = {
  attempt_id: 1,
  user_id: 1,
  wrong_count: 0,
  total_scored: 0,
  concept_clusters: [],
  triaged_concepts: [],
};

describe('buildAttemptSummary', () => {
  it('returns null when there are zero scored answers (no fake praise)', () => {
    expect(buildAttemptSummary(emptyAnalysis, {}, 6)).toBeNull();
  });

  it('celebrates a strong section with a concrete band number', () => {
    const analysis: AttemptAnalysis = {
      ...emptyAnalysis,
      total_scored: 10,
      wrong_count: 2,
      concept_clusters: [
        { concept: 'inference', miss_count: 2, example_content_ids: [], mental_model_confidence: 0.5, priority_score: 2 },
      ],
      triaged_concepts: ['inference'],
    };
    const summary = buildAttemptSummary(analysis, { reading: 5, listening: 3, speaking: 4, writing: null }, 6);
    expect(summary).not.toBeNull();
    expect(summary).toContain('Reading'); // strongest section named
    expect(summary).toContain('5/6');     // exact score included
    expect(summary).toContain('inference'); // top concept called out
  });

  it('frames a perfect-score path (no strong section named) as "solid banget"', () => {
    // No sectionScores key means topSection stays null → falls to the
    // wrong_count === 0 branch which produces the "solid banget" copy.
    const analysis: AttemptAnalysis = {
      ...emptyAnalysis,
      total_scored: 10,
      wrong_count: 0,
    };
    const summary = buildAttemptSummary(analysis, {}, 6);
    expect(summary).toMatch(/solid/i);
  });

  it('leads with the named strongest section when a section hits ≥50% of max band', () => {
    const analysis: AttemptAnalysis = {
      ...emptyAnalysis,
      total_scored: 10,
      wrong_count: 0,
    };
    const summary = buildAttemptSummary(analysis, { reading: 6 }, 6);
    expect(summary).toContain('Reading kamu paling kuat');
    expect(summary).toContain('6/6');
  });

  it('never produces the word "null" or literal template placeholders in student-facing text', () => {
    const analysis: AttemptAnalysis = {
      ...emptyAnalysis,
      total_scored: 5,
      wrong_count: 2,
      concept_clusters: [
        { concept: 'main_idea', miss_count: 2, example_content_ids: [], mental_model_confidence: null, priority_score: 1 },
      ],
      triaged_concepts: ['main_idea'],
    };
    const summary = buildAttemptSummary(analysis, { reading: 3, listening: null }, 6);
    expect(summary).not.toMatch(/\bnull\b/i);
    expect(summary).not.toMatch(/\{[a-z_]+\}/); // curly-brace placeholder leak
    expect(summary).not.toMatch(/undefined/i);
  });

  it('humanizes snake_case skill tags ("main_idea" → "main idea")', () => {
    const analysis: AttemptAnalysis = {
      ...emptyAnalysis,
      total_scored: 8,
      wrong_count: 3,
      concept_clusters: [
        { concept: 'main_idea', miss_count: 2, example_content_ids: [], mental_model_confidence: null, priority_score: 1 },
        { concept: 'subject_verb', miss_count: 1, example_content_ids: [], mental_model_confidence: null, priority_score: 1 },
      ],
      triaged_concepts: ['main_idea', 'subject_verb'],
    };
    const summary = buildAttemptSummary(analysis, { reading: 4 }, 6);
    expect(summary).toContain('main idea');
    expect(summary).toContain('subject-verb agreement');
    expect(summary).not.toContain('main_idea'); // raw tag must not leak
  });

  it('mentions /review when there are concepts to review', () => {
    const analysis: AttemptAnalysis = {
      ...emptyAnalysis,
      total_scored: 5,
      wrong_count: 3,
      concept_clusters: [
        { concept: 'inference', miss_count: 3, example_content_ids: [], mental_model_confidence: 0.3, priority_score: 3 },
      ],
      triaged_concepts: ['inference'],
    };
    const summary = buildAttemptSummary(analysis, { reading: 3 }, 6);
    expect(summary).toMatch(/\/review/);
  });
});
