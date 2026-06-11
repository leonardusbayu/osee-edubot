// Speech matching helpers for listen_and_repeat scoring.
// Tolerant of natural speech variation: filler words, contractions,
// number words vs digits, and small Whisper transcription artifacts.

const FILLER_TOKENS = new Set([
  'um', 'uh', 'er', 'ah', 'hmm', 'mm', 'like', 'okay', 'ok', 'well',
]);
// Multi-word fillers handled separately ("you know")

// Contraction → expanded form. Applied to both texts so either side matches.
const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "he's": 'he is',
  "she's": 'she is',
  "it's": 'it is',
  "that's": 'that is',
  "there's": 'there is',
  "what's": 'what is',
  "who's": 'who is',
  "let's": 'let us',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "they've": 'they have',
  "i'd": 'i would',
  "you'd": 'you would',
  "he'd": 'he would',
  "she'd": 'she would',
  "we'd": 'we would',
  "they'd": 'they would',
  "i'll": 'i will',
  "you'll": 'you will',
  "he'll": 'he will',
  "she'll": 'she will',
  "we'll": 'we will',
  "they'll": 'they will',
  "it'll": 'it will',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "can't": 'cannot',
  "couldn't": 'could not',
  "won't": 'will not',
  "wouldn't": 'would not',
  "shouldn't": 'should not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "haven't": 'have not',
  "hasn't": 'has not',
  "hadn't": 'had not',
  "mustn't": 'must not',
  // Whisper-style casual forms
  gonna: 'going to',
  wanna: 'want to',
  gotta: 'got to',
};

// Digits 0-20 + tens → words, so "3" matches "three".
const NUMBER_WORDS: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
  '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
  '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen',
  '14': 'fourteen', '15': 'fifteen', '16': 'sixteen', '17': 'seventeen',
  '18': 'eighteen', '19': 'nineteen', '20': 'twenty',
  '30': 'thirty', '40': 'forty', '50': 'fifty', '60': 'sixty',
  '70': 'seventy', '80': 'eighty', '90': 'ninety', '100': 'hundred',
};

/**
 * Normalize a transcript into comparison tokens:
 * lowercase, strip punctuation, collapse whitespace, expand contractions,
 * normalize digits to number words, drop leading/trailing filler tokens.
 */
export function normalizeTokens(text: string): string[] {
  let s = (text || '').toLowerCase();

  // Drop multi-word fillers anywhere ("you know")
  s = s.replace(/\byou know\b/g, ' ');

  // Expand contractions before stripping apostrophes
  s = s.replace(/\b[a-z]+'[a-z]+\b/g, (m) => CONTRACTIONS[m] ?? m);

  // Strip punctuation (keep digits + letters), collapse whitespace
  s = s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  let tokens = s.split(' ').filter(Boolean).map((t) => {
    if (CONTRACTIONS[t]) return CONTRACTIONS[t]; // gonna → going to
    return NUMBER_WORDS[t] ?? t;
  });
  // Contraction expansion may have produced multi-word tokens
  tokens = tokens.flatMap((t) => t.split(' '));

  // Drop leading/trailing fillers (not mid-sentence — "like" can be content)
  let start = 0;
  let end = tokens.length;
  while (start < end && FILLER_TOKENS.has(tokens[start])) start++;
  while (end > start && FILLER_TOKENS.has(tokens[end - 1])) end--;
  return tokens.slice(start, end);
}

/**
 * Character-level OSA distance (Levenshtein + adjacent transposition).
 * Transpositions count as ONE edit — "better"/"bettre" is the single most
 * common Whisper/typing artifact and plain Levenshtein would charge 2.
 */
function charLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  // Three rolling rows needed for the transposition lookback
  let prev2 = new Array<number>(n + 1);
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        curr[j] = Math.min(curr[j], prev2[j - 2] + 1);
      }
    }
    [prev2, prev, curr] = [prev, curr, prev2];
  }
  return prev[n];
}

/** Two tokens match if their char-level similarity ratio is >= 0.8. */
export function tokensFuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return true;
  // Short tokens: a 1-char edit on a 3-letter word is a different word
  if (maxLen < 4) return a === b;
  return 1 - charLevenshtein(a, b) / maxLen >= 0.8;
}

export interface AlignmentResult {
  /** 0..1 fraction of original tokens matched (in order, fuzzy) */
  accuracy: number;
  matchCount: number;
  /** Per original-token match flags, in original order */
  wordResults: { word: string; matched: boolean }[];
}

/**
 * Token-level alignment (Levenshtein over word arrays) with fuzzy
 * per-token equality. Returns which original tokens were matched.
 */
export function alignTokens(originalTokens: string[], spokenTokens: string[]): AlignmentResult {
  const m = originalTokens.length;
  const n = spokenTokens.length;
  if (m === 0) return { accuracy: 0, matchCount: 0, wordResults: [] };

  // DP: maximize number of matched original tokens (LCS with fuzzy equality)
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (tokensFuzzyMatch(originalTokens[i - 1], spokenTokens[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Traceback to flag which original tokens matched
  const matched = new Array<boolean>(m).fill(false);
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (tokensFuzzyMatch(originalTokens[i - 1], spokenTokens[j - 1]) && dp[i][j] === dp[i - 1][j - 1] + 1) {
      matched[i - 1] = true;
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const matchCount = dp[m][n];
  return {
    accuracy: matchCount / m,
    matchCount,
    wordResults: originalTokens.map((word, k) => ({ word, matched: matched[k] })),
  };
}

/**
 * Map alignment accuracy (0..1) to a band score.
 * >=0.95 → full band; >=0.85 → 90% of max; >=0.70 → 75%; >=0.5 → 50%;
 * else proportional. Minimum band is 1.
 */
export function accuracyToBand(accuracy: number, maxBand: number): number {
  let band: number;
  if (accuracy >= 0.95) band = maxBand;
  else if (accuracy >= 0.85) band = maxBand * 0.9;
  else if (accuracy >= 0.7) band = maxBand * 0.75;
  else if (accuracy >= 0.5) band = maxBand * 0.5;
  else band = maxBand * accuracy;
  return Math.max(1, Math.round(band));
}
