from datetime import datetime

from pydantic import BaseModel


# Auth
class LoginRequest(BaseModel):
    init_data: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class RefreshRequest(BaseModel):
    refresh_token: str


# User
class UserResponse(BaseModel):
    id: int
    telegram_id: int
    role: str
    name: str
    username: str | None
    target_test: str | None
    proficiency_level: str | None
    onboarding_complete: bool

    class Config:
        from_attributes = True


# Test
class StartTestRequest(BaseModel):
    test_type: str
    practice_mode: bool = False


class StartTestResponse(BaseModel):
    attempt_id: int
    test_type: str
    sections: list[dict]
    current_section: str
    total_duration_minutes: int


class SubmitAnswerRequest(BaseModel):
    section: str
    question_index: int
    answer_data: dict  # {"selected": "B"} or {"text": "..."} or {"audio_url": "..."}


class SubmitAnswerResponse(BaseModel):
    saved: bool
    is_correct: bool | None = None  # For objective questions only
    next_question_index: int | None = None


class TestAttemptState(BaseModel):
    attempt_id: int
    test_type: str
    status: str
    current_section: str | None
    current_question_index: int
    sections: list[dict]
    answers_submitted: int
    time_remaining_seconds: int | None


class TestResultResponse(BaseModel):
    attempt_id: int
    test_type: str
    total_score: float
    band_score: float | None
    section_scores: dict
    ai_summary: str | None
    detailed_feedback: dict | None
    completed_at: datetime | None


# Progress
class ProgressOverview(BaseModel):
    total_tests_taken: int
    average_score: float | None
    best_score: float | None
    recent_scores: list[dict]
    study_streak: int
    skills: list[dict]


class SkillDetail(BaseModel):
    skill: str
    proficiency_score: float
    total_attempts: int
    correct_rate: float


# Content
class CreateContentRequest(BaseModel):
    test_type: str
    section: str
    question_type: str
    title: str | None = None
    content: dict
    media_url: str | None = None
    difficulty: int = 3
    topic: str | None = None


class ContentResponse(BaseModel):
    id: int
    test_type: str
    section: str
    question_type: str
    title: str | None
    content: dict
    media_url: str | None
    difficulty: int
    status: str
    source: str
    created_at: datetime

    class Config:
        from_attributes = True
