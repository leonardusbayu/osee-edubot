import { describe, expect, it } from 'vitest';
import { getDailyFocusLesson, normalizeTargetTest, renderDailyFocusLesson, renderStudyMenuIntro } from './daily-lesson';

describe('daily focus lessons', () => {
  it('normalizes supported target tests and defaults to TOEFL iBT', () => {
    expect(normalizeTargetTest('TOEFL_ITP')).toBe('TOEFL_ITP');
    expect(normalizeTargetTest('IELTS')).toBe('IELTS');
    expect(normalizeTargetTest('TOEIC')).toBe('TOEIC');
    expect(normalizeTargetTest('unknown')).toBe('TOEFL_IBT');
  });

  it('renders target-specific scroll-stopping content', () => {
    const lesson = getDailyFocusLesson('IELTS', new Date('2026-05-22T01:00:00Z'));
    const message = renderDailyFocusLesson(lesson, 'Bayu Santoso');

    expect(message).toContain('Lesson hari ini buat IELTS');
    expect(message).toContain('Bayu');
    expect(message).toContain('Micro-lesson');
    expect(message).toContain('Coba sekarang');
    expect(message).toContain('/study');
  });

  it('uses the target lesson hook in the study menu intro', () => {
    const intro = renderStudyMenuIntro('TOEIC');

    expect(intro).toContain('Menu Belajar');
    expect(intro).toContain('TOEIC');
    expect(intro).toContain('Lesson Hari Ini');
  });
});
