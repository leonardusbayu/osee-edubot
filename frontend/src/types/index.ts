export interface User {
  id: number;
  telegram_id: number;
  role: string;
  name: string;
  username: string | null;
  target_test: string | null;
  proficiency_level: string | null;
  onboarding_complete: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface TestInfo {
  test_type: string;
  display_name: string;
  description: string;
  total_duration_minutes: number;
  sections: SectionInfo[];
}

export interface SectionInfo {
  id: string;
  name: string;
  duration_minutes: number;
}

export interface TestAttemptState {
  attempt_id: number;
  test_type: string;
  status: string;
  current_section: string | null;
  current_question_index: number;
  sections: SectionInfo[];
  answers_submitted: number;
  time_remaining_seconds: number | null;
}

export interface StartTestResponse {
  attempt_id: number;
  test_type: string;
  sections: SectionInfo[];
  current_section: string;
  total_duration_minutes: number;
}

export interface SubmitAnswerResponse {
  saved: boolean;
  is_correct: boolean | null;
  next_question_index: number | null;
}

export interface TestResult {
  attempt_id: number;
  test_type: string;
  total_score: number;
  band_score: number | null;
  section_scores: Record<string, number>;
  ai_summary: string | null;
  detailed_feedback: Record<string, unknown> | null;
  completed_at: string | null;
}

export interface ProgressOverview {
  total_tests_taken: number;
  average_score: number | null;
  best_score: number | null;
  recent_scores: RecentScore[];
  study_streak: number;
  skills: SkillInfo[];
}

export interface RecentScore {
  attempt_id: number;
  total_score: number;
  band_score: number | null;
  section_scores: Record<string, number>;
  date: string | null;
}

export interface SkillInfo {
  skill: string;
  proficiency_score: number;
  total_attempts: number;
  correct_rate: number;
}

export interface TestContent {
  id: number;
  test_type: string;
  section: string;
  question_type: string;
  title: string | null;
  content: Record<string, unknown>;
  media_url: string | null;
  difficulty: number;
  status: string;
  source: string;
  created_at: string;
}
