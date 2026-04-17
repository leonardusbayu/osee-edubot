// Content validator — centralizes quality checks for test_contents rows.
//
// Used at write-time (POST/PUT/bulk-insert) and at publish-time to catch
// the failure modes we've hit in production:
//   • Empty options[].text (the 635-row reading corruption)
//   • Ultra-short options like "Ms" / "Mr" (2-char placeholder leftovers)
//   • Near-duplicate options (paraphrases where 2+ choices mean the same thing)
//   • Listening rows missing media_url
//   • MCQ rows with no correct answer
//   • Grouped content with zero sub-questions
//
// Usage:
//   const { errors, warnings } = validateContent({
//     section, question_type, content, media_url
//   }, { mode: 'publish' });
//   if (errors.length) return c.json({ error: errors[0], details: errors }, 400);

export type ValidatorMode = 'draft' | 'publish';

export interface ValidatorInput {
  section: string;
  question_type: string;
  content: any;               // parsed object (not string)
  media_url?: string | null;
  title?: string | null;
}

export interface ValidatorResult {
  errors: string[];           // block the write
  warnings: string[];         // allow, but surface
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'at', 'for', 'by', 'with', 'from', 'as', 'it',
  'this', 'that', 'these', 'those', 'he', 'she', 'they', 'them', 'his',
  'her', 'their', 'its', 'and', 'or', 'but', 'not', 'no', 'so', 'if',
  'will', 'would', 'can', 'could', 'should', 'have', 'has', 'had', 'do',
  'does', 'did', 'just', 'some', 'any', 'all', 'one', 'two',
]);

function tokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Validate a single options[] array (flat MCQ or one sub-question's options).
function validateOptions(options: any[], prefix: string, errors: string[], warnings: string[]) {
  if (!Array.isArray(options) || options.length === 0) return;

  if (options.length < 2) {
    warnings.push(`${prefix} has fewer than 2 options (${options.length})`);
  }

  const texts: string[] = [];
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const text = typeof opt === 'string' ? opt : (opt?.text ?? '');
    const cleaned = String(text).trim();

    if (cleaned === '') {
      errors.push(`${prefix} option ${i + 1} has empty text`);
    } else if (cleaned.length <= 2) {
      warnings.push(`${prefix} option ${i + 1} is ultra-short ("${cleaned}") — likely truncated`);
    }
    texts.push(cleaned);
  }

  // Duplicate detection — exact match
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      if (texts[i] && texts[j] && texts[i].toLowerCase() === texts[j].toLowerCase()) {
        errors.push(`${prefix} options ${i + 1} and ${j + 1} are identical: "${texts[i].slice(0, 40)}"`);
      }
    }
  }

  // Near-paraphrase detection — Jaccard > 0.7 on content tokens
  // (Used threshold 0.55 during reconstruction; 0.7 for write-time to
  // minimize false positives on legit options that share sentence frames)
  const tokenSets = texts.map(tokens);
  for (let i = 0; i < tokenSets.length; i++) {
    for (let j = i + 1; j < tokenSets.length; j++) {
      if (tokenSets[i].size < 3 || tokenSets[j].size < 3) continue;
      const sim = jaccard(tokenSets[i], tokenSets[j]);
      if (sim >= 0.7) {
        warnings.push(
          `${prefix} options ${i + 1} and ${j + 1} look like near-paraphrases (Jaccard ${sim.toFixed(2)})`,
        );
      }
    }
  }

  // Check for at least one correct-marked option (if option is object form)
  if (typeof options[0] === 'object') {
    const hasCorrect = options.some((o: any) => o?.is_answer === true || o?.is_correct === true);
    if (!hasCorrect) {
      // Not fatal — many rows mark correctness via `answers` field instead
    }
  }
}

const MCQ_TYPES = new Set([
  'multiple_choice',
  'reading_passage',
  'error_identification',
  'incomplete_sentences',
  'insert_text',
  'photographs',
  'question_response',
  'sentence_completion',
  'true_false_not_given',
]);

const GROUPED_TYPES = new Set([
  'grouped_reading',
  'grouped_listening',
  'grouped_writing',
  'grouped_speaking',
]);

/**
 * Resolve the correct option text from a content row.
 * Handles the common shapes we see in production:
 *   • content.answer: 'a'|'A'|'b'|...  → options[0], options[1], ...
 *   • content.correct_answer: 'A'|'B'|...
 *   • content.answers: ['A'] or [0] or ['option text']
 *   • options[].is_answer / is_correct
 * Returns { letter: 'A', text: 'make' } or null if unresolvable.
 */
function resolveCorrectOption(content: any): { letter: string; text: string } | null {
  if (!content || typeof content !== 'object') return null;
  const options = Array.isArray(content.options) ? content.options : null;
  if (!options || options.length === 0) return null;

  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const getText = (opt: any): string => {
    if (typeof opt === 'string') return opt.trim();
    return String(opt?.text ?? opt?.value ?? '').trim();
  };

  // Try: options[].is_answer / is_correct flag
  for (let i = 0; i < options.length; i++) {
    const o = options[i];
    if (o && typeof o === 'object' && (o.is_answer === true || o.is_correct === true)) {
      return { letter: LETTERS[i] || String(i + 1), text: getText(o) };
    }
  }

  // Try: answer / correct_answer as a letter
  const letterRaw = String(content.answer ?? content.correct_answer ?? '').trim().toUpperCase();
  if (letterRaw && /^[A-F]$/.test(letterRaw)) {
    const idx = LETTERS.indexOf(letterRaw);
    if (idx >= 0 && idx < options.length) {
      return { letter: letterRaw, text: getText(options[idx]) };
    }
  }

  // Try: answers[] as letter or index or text
  const answers = Array.isArray(content.answers) ? content.answers : null;
  if (answers && answers.length > 0) {
    const a = answers[0];
    if (typeof a === 'number' && a >= 0 && a < options.length) {
      return { letter: LETTERS[a] || String(a + 1), text: getText(options[a]) };
    }
    if (typeof a === 'string') {
      const up = a.trim().toUpperCase();
      if (/^[A-F]$/.test(up)) {
        const idx = LETTERS.indexOf(up);
        if (idx >= 0 && idx < options.length) return { letter: up, text: getText(options[idx]) };
      }
      // Match by option text
      const lc = a.trim().toLowerCase();
      for (let i = 0; i < options.length; i++) {
        if (getText(options[i]).toLowerCase() === lc) {
          return { letter: LETTERS[i] || String(i + 1), text: getText(options[i]) };
        }
      }
    }
  }
  return null;
}

/**
 * Check that the explanation text actually relates to the question + correct option.
 * Uses low-threshold token overlap (Jaccard). Flags as *warning* because short
 * valid explanations (e.g., `"B"`) would otherwise trip false positives.
 * We only emit when the explanation is substantial (≥3 content tokens) AND
 * has near-zero overlap with both question and correct option.
 */
function validateExplanationCoherence(
  content: any,
  warnings: string[],
): void {
  const explanation = String(content?.explanation ?? '').trim();
  if (!explanation || explanation.length < 10) return; // skip tiny explanations — nothing to judge

  const explTokens = tokens(explanation);
  if (explTokens.size < 3) return;

  const questionText = String(
    content?.question_text ??
    content?.question ??
    content?.stem ??
    content?.passage ??
    '',
  ).trim();
  const qTokens = tokens(questionText);

  const correct = resolveCorrectOption(content);
  const correctTokens = correct ? tokens(correct.text) : new Set<string>();

  // Union of question + correct option tokens = what we'd expect the explanation to reference.
  const reference = new Set<string>([...qTokens, ...correctTokens]);
  if (reference.size < 2) return; // nothing to compare against

  const sim = jaccard(explTokens, reference);

  // Overlap threshold: below this, explanation looks unrelated to the question/answer.
  // 0.02 is conservative — catches clearly-wrong pairings while letting minimal
  // overlap through (e.g., when explanation uses synonyms).
  if (sim < 0.02) {
    const preview = explanation.slice(0, 60).replace(/\s+/g, ' ');
    warnings.push(
      `explanation-mismatch: explanation "${preview}..." has near-zero token overlap with question/correct-option (Jaccard ${sim.toFixed(3)})`,
    );
  }
}

/**
 * Check that content.answer (letter) points to an option that exists.
 * Catches the bug where `answer: 'E'` but only 4 options are defined.
 */
function validateAnswerLetterInRange(content: any, errors: string[]): void {
  const options = Array.isArray(content?.options) ? content.options : null;
  if (!options || options.length === 0) return;

  const letter = String(content.answer ?? content.correct_answer ?? '').trim().toUpperCase();
  if (!letter || !/^[A-F]$/.test(letter)) return;

  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const idx = LETTERS.indexOf(letter);
  if (idx < 0 || idx >= options.length) {
    errors.push(`answer-out-of-range: answer letter "${letter}" but only ${options.length} option(s) present`);
  }
}

export function validateContent(input: ValidatorInput, opts: { mode?: ValidatorMode } = {}): ValidatorResult {
  const mode = opts.mode ?? 'draft';
  const errors: string[] = [];
  const warnings: string[] = [];

  const { section, question_type, content, media_url } = input;

  // Ensure content is an object (not null, not array, not string)
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    errors.push('content must be a JSON object');
    return { errors, warnings };
  }

  // Detect schema shape: grouped (has .questions[]) vs flat (has .options or direct answer)
  const isGrouped = Array.isArray(content.questions) && content.questions.length > 0;

  // Question text / passage presence
  const hasQuestionText =
    content.question_text ||
    content.passage_text ||
    content.passage ||
    content.direction ||
    isGrouped;
  if (!hasQuestionText) {
    (mode === 'publish' ? errors : warnings).push(
      'No question_text, passage, direction, or sub-questions found',
    );
  }

  // Grouped: must have sub-questions, each sub-question validated.
  // Routes here when either the outer question_type is in GROUPED_TYPES OR
  // the content shape itself declares questions[] (common in legacy rows
  // where the outer type is e.g. 'listen_conversation' but the JSON body is
  // grouped_listening — both should get sub-question validation).
  const routeAsGrouped = GROUPED_TYPES.has(question_type) || isGrouped;
  if (routeAsGrouped) {
    if (!isGrouped) {
      errors.push(`Grouped type "${question_type}" has no questions[] array`);
    } else {
      content.questions.forEach((sub: any, idx: number) => {
        const prefix = `Sub-question ${idx + 1}`;
        if (!sub.question_text && !sub.prompt) {
          warnings.push(`${prefix} has no question_text`);
        }
        if (Array.isArray(sub.options)) {
          validateOptions(sub.options, prefix, errors, warnings);
        }
        // Sub-question correct-answer presence (publish only)
        if (mode === 'publish' && Array.isArray(sub.options) && sub.options.length > 0) {
          const hasAns =
            (Array.isArray(sub.answers) && sub.answers.length > 0) ||
            sub.options.some((o: any) => o?.is_answer === true || o?.is_correct === true);
          if (!hasAns) {
            errors.push(`${prefix} has options but no correct answer marked`);
          }
        }
        // New: answer-letter-in-range + explanation coherence
        const subErrors: string[] = [];
        const subWarnings: string[] = [];
        validateAnswerLetterInRange(sub, subErrors);
        validateExplanationCoherence(sub, subWarnings);
        for (const e of subErrors) errors.push(`${prefix}: ${e}`);
        for (const w of subWarnings) warnings.push(`${prefix}: ${w}`);
      });
    }
  }

  // Flat MCQ: validate top-level options[]
  if (MCQ_TYPES.has(question_type) && Array.isArray(content.options)) {
    validateOptions(content.options, 'Top-level', errors, warnings);

    if (mode === 'publish') {
      const hasAns =
        (Array.isArray(content.answers) && content.answers.length > 0) ||
        content.options.some((o: any) => o?.is_answer === true || o?.is_correct === true) ||
        content.correct_answer;
      if (!hasAns) {
        errors.push('MCQ has no correct answer (answers[] or options[].is_answer or correct_answer)');
      }
    }

    // New: answer-letter-in-range (error) + explanation coherence (warning)
    validateAnswerLetterInRange(content, errors);
    validateExplanationCoherence(content, warnings);
  }

  // Listening must have audio somewhere if published. Audio can live in any of
  // these fields depending on the row's vintage:
  //   • top-level media_url column
  //   • content.audio_url / content.media_url (older flat rows)
  //   • content.passage_audio (grouped listening — passage-level audio)
  //   • content.questions[].audio_filename (grouped listening — per-sub audio,
  //     which is how Set 2 onward publishes its listen_choose_response items)
  if (mode === 'publish' && section === 'listening') {
    const hasTopMedia = media_url && String(media_url).trim().length > 0;
    const hasContentUrl = !!(content.audio_url || content.media_url);
    const hasPassageAudio = !!(content.passage_audio && String(content.passage_audio).trim().length > 0);
    const hasPerSubAudio = isGrouped && content.questions.some(
      (q: any) => q?.audio_filename && String(q.audio_filename).trim().length > 0,
    );
    if (!hasTopMedia && !hasContentUrl && !hasPassageAudio && !hasPerSubAudio) {
      errors.push('Listening row requires audio (media_url, content.audio_url, content.passage_audio, or per-sub audio_filename)');
    }
  }

  // media_url format — accept any of:
  //   • absolute URL: http(s)://...
  //   • worker-relative path: /api/...
  //   • R2 object key or bare filename with a known media extension (no traversal)
  if (media_url && String(media_url).trim().length > 0) {
    const url = String(media_url).trim();
    const isHttp = /^https?:\/\//i.test(url);
    const isRelative = url.startsWith('/api/') || url.startsWith('/audio/');
    const noTraversal = !url.includes('..') && !url.includes('\\');
    const isMediaFilename = /\.(mp3|ogg|wav|webm|m4a|mp4)$/i.test(url);
    const ok = noTraversal && (isHttp || isRelative || isMediaFilename);
    if (!ok) {
      errors.push(`media_url must be http(s), /api/... path, or a media filename (got "${url.slice(0, 60)}")`);
    }
  }

  return { errors, warnings };
}

// Convenience wrapper for when content might be a string (DB row)
export function validateRow(
  row: { section: string; question_type: string; content: string | any; media_url?: string | null; title?: string | null },
  opts: { mode?: ValidatorMode } = {},
): ValidatorResult {
  let parsed: any = row.content;
  if (typeof row.content === 'string') {
    try { parsed = JSON.parse(row.content); }
    catch { return { errors: ['Invalid JSON in content field'], warnings: [] }; }
  }
  return validateContent({ ...row, content: parsed }, opts);
}
