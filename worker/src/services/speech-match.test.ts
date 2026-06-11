import { describe, it, expect } from 'vitest';
import { normalizeTokens, alignTokens, accuracyToBand, tokensFuzzyMatch } from './speech-match';

function accuracy(original: string, spoken: string): number {
  return alignTokens(normalizeTokens(original), normalizeTokens(spoken)).accuracy;
}

describe('normalizeTokens', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeTokens('Hello,   World!')).toEqual(['hello', 'world']);
  });

  it('drops leading/trailing filler tokens', () => {
    expect(normalizeTokens('um, the research is important, uh')).toEqual(
      ['the', 'research', 'is', 'important']
    );
  });

  it('keeps mid-sentence "like" (content word)', () => {
    expect(normalizeTokens('I like coffee')).toEqual(['i', 'like', 'coffee']);
  });

  it('expands contractions', () => {
    expect(normalizeTokens("I'm sure it's fine")).toEqual(['i', 'am', 'sure', 'it', 'is', 'fine']);
    expect(normalizeTokens("don't can't won't")).toEqual(['do', 'not', 'cannot', 'will', 'not']);
  });

  it('expands gonna/wanna', () => {
    expect(normalizeTokens('gonna study')).toEqual(['going', 'to', 'study']);
  });

  it('normalizes digits to number words', () => {
    expect(normalizeTokens('I have 3 books')).toEqual(['i', 'have', 'three', 'books']);
    expect(normalizeTokens('20 students')).toEqual(['twenty', 'students']);
  });
});

describe('tokensFuzzyMatch', () => {
  it('matches British/American spelling variants', () => {
    expect(tokensFuzzyMatch('colour', 'color')).toBe(true);
  });

  it('requires exact match for short words', () => {
    expect(tokensFuzzyMatch('cat', 'bat')).toBe(false);
    expect(tokensFuzzyMatch('cat', 'cat')).toBe(true);
  });

  it('rejects clearly different words', () => {
    expect(tokensFuzzyMatch('research', 'kitchen')).toBe(false);
  });
});

describe('alignTokens scoring', () => {
  const prompt = 'The research shows that students learn better with practice';

  it('perfect repetition scores 1.0', () => {
    expect(accuracy(prompt, prompt)).toBe(1);
  });

  it('tolerates filler words at the start', () => {
    expect(accuracy(prompt, 'Um, the research shows that students learn better with practice')).toBe(1);
  });

  it('tolerates contraction differences', () => {
    expect(accuracy("I don't think it's a problem", 'I do not think it is a problem')).toBe(1);
    expect(accuracy('I do not think it is a problem', "I don't think it's a problem")).toBe(1);
  });

  it('tolerates small Whisper typos via fuzzy match', () => {
    const a = accuracy(prompt, 'The research shows that students learn bettre with practise');
    expect(a).toBeGreaterThanOrEqual(0.95);
  });

  it('matches digits against number words', () => {
    expect(accuracy('She has three children', 'She has 3 children')).toBe(1);
  });

  it('scores a completely wrong sentence low', () => {
    const a = accuracy(prompt, 'My favorite food is fried rice and chicken soup');
    expect(a).toBeLessThan(0.3);
  });

  it('handles empty spoken input', () => {
    expect(accuracy(prompt, '')).toBe(0);
  });

  it('penalizes partially correct repetition proportionally', () => {
    const a = accuracy(prompt, 'The research shows that students');
    expect(a).toBeGreaterThan(0.4);
    expect(a).toBeLessThan(0.7);
  });
});

describe('accuracyToBand', () => {
  it('full band at >=0.95', () => {
    expect(accuracyToBand(0.96, 9)).toBe(9);
    expect(accuracyToBand(1, 6)).toBe(6);
  });

  it('90% of max at >=0.85', () => {
    expect(accuracyToBand(0.9, 9)).toBe(8); // 8.1 → 8
    expect(accuracyToBand(0.9, 6)).toBe(5); // 5.4 → 5
  });

  it('75% of max at >=0.70', () => {
    expect(accuracyToBand(0.75, 9)).toBe(7); // 6.75 → 7
  });

  it('50% of max at >=0.5', () => {
    expect(accuracyToBand(0.5, 6)).toBe(3);
  });

  it('proportional below 0.5, minimum band 1', () => {
    expect(accuracyToBand(0.3, 9)).toBe(3); // 2.7 → 3
    expect(accuracyToBand(0, 9)).toBe(1);
  });
});
