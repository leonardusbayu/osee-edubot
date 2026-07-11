// Schema validation script for EduBot (converts # to // to avoid shebang issues on some platforms).
// Compares columns referenced in service code against the actual D1
// schema. Catches drift between what code expects and what the
// migration created. Run before every deploy; in CI on every push.
//
// Usage:
//   node scripts/schema-validate.mjs [--strict]
//
// --strict exits non-zero on any discrepancy.
// Without --strict, prints a report and only exits non-zero on
// missing tables (the showstopper case).

import { execSync } from 'node:child_process';

const STRICT = process.argv.includes('--strict');

const WORKER = 'D:/claude telegram bot/worker';

// All tables the new services query. Listed explicitly so the
// validator catches missing migrations immediately.
const TABLES = [
  'attempt_answers',
  // 'attempt_attempts', -- not referenced by any code; uncomment when needed
  'test_attempts',
  'test_contents',
  'spaced_repetition',
  'writing_drafts',
  'user_outcomes',
  'mock_test_history',
  'student_ability',
  'class_enrollments',
  'classes',
  'class_homework',
  'homework_completions',
  'study_plans',
  'writing_criterion_scores',
  'fsrs_retention_cache',
  'diagnostic_sessions',
  'intervention_log',
  'prediction_history',
  'user_outcomes',
  'student_ability_history',
  'prediction_history',
  'student_ability_history',
  'users',
];

function run(cmd) {
  try {
    const out = execSync(cmd, {
      cwd: WORKER,
      env: { ...process.env },
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // wrangler --json output starts with progress logs; find the JSON
    const jsonStart = out.indexOf('[');
    if (jsonStart < 0) return [];
    const j = JSON.parse(out.substring(jsonStart));
    return Array.isArray(j) ? j[0].results : j.results || [];
  } catch (e) {
    console.error('Query failed:', cmd);
    console.error(e.message || e);
    return null;
  }
}

function listColumns(table) {
  const rows = run(`npx wrangler d1 execute edubot-db --remote --command "PRAGMA table_info(${table})" --json`);
  if (rows === null) return null;
  return rows.map((r) => r.name);
}

// Columns each service code references. Sourced by reading the actual
// .ts files; kept inline so the script has zero cross-package
// dependencies. The audit flagged these as the highest-risk queries;
// we validate them explicitly.
const EXPECTED_COLUMNS = {
  attempt_answers: [
    'id', 'attempt_id', 'content_id', 'section', 'question_index',
    'answer_data', 'is_correct', 'score', 'ai_feedback', 'media_url',
    'submitted_at', 'time_spent_seconds', 'client_uuid',
  ],
  // attempt_attempts removed � no code references it
  test_attempts: [
    'id', 'user_id', 'test_type', 'mode', 'status', 'metadata',
    'started_at', 'finished_at', 'current_section', 'current_question_index',
    'mock_mode', 'deadline_at', 'exam_mode_started_at',
  ],
  test_contents: [
    'id', 'test_type', 'section', 'question_type', 'difficulty',
    'topic', 'skill_tags', 'content',
  ],
  spaced_repetition: [
    'id', 'user_id', 'content_id', 'section', 'next_review_at',
    'last_reviewed_at', 'times_correct', 'times_wrong', 'fsrs_state',
    'created_at', 'correct_answer', 'student_answer', 'question_data',
  ],
  writing_drafts: [
    'id', 'user_id', 'content_id', 'test_type', 'task_type',
    'prompt', 'draft_number', 'text', 'overall_band', 'criteria',
    'feedback', 'corrections', 'word_count', 'created_at',
  ],
  user_outcomes: [
    'id', 'user_id', 'test_type', 'window_start', 'window_end',
    'avg_band', 'best_band', 'attempts_count', 'improvement',
    'created_at', 'updated_at',
  ],
  mock_test_history: [
    'id', 'user_id', 'test_type', 'attempt_id', 'estimated_score',
    'score_scale', 'taken_at',
  ],
  student_ability: [
    'user_id', 'section', 'theta', 'se', 'response_count', 'updated_at',
  ],
  class_enrollments: [
    'id', 'user_id', 'class_id', 'status', 'enrolled_at',
  ],
  classes: ['id', 'teacher_id', 'name', 'invite_code', 'is_active'],
  class_homework: [
    'id', 'class_id', 'assigned_by', 'section', 'question_count',
    'due_date', 'notes', 'status', 'created_at',
  ],
  homework_completions: [
    'id', 'homework_id', 'user_id', 'completed_count', 'completed_at',
  ],
  study_plans: [
    'id', 'user_id', 'target_band', 'target_date', 'total_days',
    'current_day', 'plan_data', 'status', 'created_at',
  ],
  writing_criterion_scores: [
    'user_id', 'test_type', 'task_achievement', 'coherence_cohesion',
    'lexical_resource', 'grammar_range', 'overall_band', 'relevancy_score',
    'word_count', 'feedback_summary', 'created_at',
  ],
  fsrs_retention_cache: [
    'user_id', 'avg_retention', 'item_count', 'computed_at',
  ],
  diagnostic_sessions: [
    'id', 'user_id', 'current_question', 'answers', 'status',
  ],
  intervention_log: [
    'id', 'user_id', 'intervention_type', 'sent_at',
  ],
  prediction_history: [
    'id', 'user_id', 'test_type', 'prediction', 'actual_band',
    'error', 'created_at',
  ],
  student_ability_history: [
    'id', 'user_id', 'section', 'theta', 'se', 'response_count',
    'created_at',
  ],
  users: [
    'id', 'telegram_id', 'name', 'role', 'target_test',
    'current_streak', 'last_study_date', 'is_active',
  ],
};

let missingTables = 0;
let missingColumns = 0;
let extraColumns = 0;

for (const table of TABLES) {
  const actual = listColumns(table);
  if (actual === null) {
    console.log(`[FAIL] ${table}: TABLE NOT FOUND in D1`);
    missingTables++;
    continue;
  }
  if (actual === undefined) {
    // The query returned but with no results array
    console.log(`[SKIP] ${table}: empty result from D1`);
    continue;
  }

  const expected = EXPECTED_COLUMNS[table];
  if (!expected) {
    console.log(`[INFO] ${table}: exists but not in expected list (add it to the script if you use it)`);
    continue;
  }

  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((c) => !actualSet.has(c));
  const extra = actual.filter((c) => !expectedSet.has(c));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`[OK]   ${table}: ${actual.length} columns match`);
  } else {
    if (missing.length > 0) {
      console.log(`[FAIL] ${table}: MISSING columns: ${missing.join(', ')}`);
      missingColumns += missing.length;
    }
    if (extra.length > 0 && STRICT) {
      console.log(`[INFO] ${table}: extra columns (ok in strict mode): ${extra.join(', ')}`);
      extraColumns += extra.length;
    }
  }
}

console.log('');
console.log('--- Summary ---');
console.log(`Tables checked:    ${TABLES.length}`);
console.log(`Missing tables:    ${missingTables}`);
console.log(`Missing columns:   ${missingColumns}`);
console.log(`Extra columns:     ${extraColumns} (${STRICT ? 'shown' : 'hidden without --strict'})`);

if (missingTables > 0 || missingColumns > 0) {
  console.log('');
  console.log('SCHEMA DRIFT DETECTED. The code references columns that do not');
  console.log('exist in D1. This will cause runtime SQL errors.');
  console.log('Write a migration and apply it before deploying.');
  process.exit(1);
}

if (STRICT && extraColumns > 0) {
  console.log('STRICT mode: extra columns present. Consider trimming.');
  process.exit(1);
}

process.exit(0);
