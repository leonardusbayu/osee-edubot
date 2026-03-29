export interface Env {
  DB: D1Database;
  MEDIA?: R2Bucket;
  AUDIO_BUCKET?: R2Bucket;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_BOT_SECRET: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY: string;
  TEACHER_CODE?: string;
  JWT_SECRET: string;
  WEBAPP_URL: string;
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
  created_at: string;
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
