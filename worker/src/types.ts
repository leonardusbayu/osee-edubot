export interface Env {
  DB: D1Database;
  MEDIA?: R2Bucket;
  AUDIO_BUCKET?: R2Bucket;
  VISUAL_BUCKET?: R2Bucket;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_BOT_SECRET: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY: string;
  FAL_API_KEY?: string;
  TEACHER_CODE?: string;
  JWT_SECRET: string;
  WEBAPP_URL: string;
  ADMIN_API_KEY?: string;
  ADMIN_SECRET?: string;
  NOTION_API_KEY?: string;
  NOTION_STUDENTS_DB?: string;
  NOTION_ATTEMPTS_DB?: string;
  NOTION_WEEKLY_DB?: string;
  NOTION_DASHBOARD_PAGE?: string;
  ENVIRONMENT?: string;
  TRIPAY_API_KEY?: string;
  TRIPAY_PRIVATE_KEY?: string;
  TRIPAY_MERCHANT_CODE?: string;
}

export interface User {
  id: number;
  telegram_id: number;
  role: string;
  name: string;
  username: string | null;
  target_test: string | null;
  proficiency_level: string | null;
  onboarding_complete: number;
  is_premium: number;
  premium_until: string | null;
  referred_by: number | null;
  referral_code: string | null;
  referral_count: number;
  is_founding_student: number;
  created_at: string;
  current_streak?: number | null;
  longest_streak?: number | null;
  last_study_date?: string | null;
  onboarding_step?: string | null;
  exam_deadline?: string | null;
  daily_minutes_goal?: number | null;
  tips_enabled?: number | null;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface JWTPayload {
  sub: string;
  telegram_id: number;
  role: string;
  exp: number;
  type: string;
}
