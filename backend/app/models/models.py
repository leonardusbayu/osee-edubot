import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class UserRole(str, enum.Enum):
    student = "student"
    teacher = "teacher"
    admin = "admin"


class TestType(str, enum.Enum):
    TOEFL_IBT = "TOEFL_IBT"
    IELTS = "IELTS"
    TOEIC = "TOEIC"
    TOEFL_ITP = "TOEFL_ITP"
    PTE = "PTE"


class ContentStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class AttemptStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"
    abandoned = "abandoned"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    telegram_id = Column(Integer, unique=True, nullable=False, index=True)
    role = Column(Enum(UserRole), default=UserRole.student, nullable=False)
    name = Column(String(255), nullable=False)
    username = Column(String(255), nullable=True)
    target_test = Column(Enum(TestType), nullable=True)
    proficiency_level = Column(String(50), nullable=True)  # e.g. "beginner", "intermediate", "advanced"
    timezone = Column(String(50), default="UTC")
    language = Column(String(10), default="en")
    onboarding_complete = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    enrollments = relationship("ClassEnrollment", back_populates="user")
    attempts = relationship("TestAttempt", back_populates="user")
    skill_trackers = relationship("SkillTracker", back_populates="user")
    conversations = relationship("ConversationMessage", back_populates="user")


class Class(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    test_type = Column(Enum(TestType), nullable=False)
    invite_code = Column(String(20), unique=True, nullable=False)
    schedule = Column(JSON, nullable=True)  # {"days": ["mon", "wed"], "time": "14:00"}
    max_students = Column(Integer, default=50)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    teacher = relationship("User", foreign_keys=[teacher_id])
    enrollments = relationship("ClassEnrollment", back_populates="class_")


class ClassEnrollment(Base):
    __tablename__ = "class_enrollments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    enrolled_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="active")  # active, dropped, completed

    user = relationship("User", back_populates="enrollments")
    class_ = relationship("Class", back_populates="enrollments")


class TestContent(Base):
    __tablename__ = "test_contents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    test_type = Column(Enum(TestType), nullable=False, index=True)
    section = Column(String(50), nullable=False)  # reading, listening, speaking, writing
    question_type = Column(String(100), nullable=False)  # multiple_choice, fill_blank, etc.
    title = Column(String(500), nullable=True)
    content = Column(JSON, nullable=False)  # Flexible structure per question type
    media_url = Column(String(1000), nullable=True)
    difficulty = Column(Integer, default=3)  # 1-5 scale
    topic = Column(String(255), nullable=True)
    source = Column(String(50), default="curated")  # curated, ai_generated
    status = Column(Enum(ContentStatus), default=ContentStatus.draft)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TestAttempt(Base):
    __tablename__ = "test_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    test_type = Column(Enum(TestType), nullable=False)
    content_ids = Column(JSON, nullable=True)  # List of TestContent IDs used
    status = Column(Enum(AttemptStatus), default=AttemptStatus.in_progress)
    current_section = Column(String(50), nullable=True)
    current_question_index = Column(Integer, default=0)
    section_start_times = Column(JSON, default=dict)  # {"reading": "2026-03-27T10:00:00"}
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    metadata_ = Column("metadata", JSON, default=dict)  # Extra state (adaptive stage, etc.)

    user = relationship("User", back_populates="attempts")
    answers = relationship("AttemptAnswer", back_populates="attempt", cascade="all, delete-orphan")
    result = relationship("TestResult", back_populates="attempt", uselist=False)


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    attempt_id = Column(Integer, ForeignKey("test_attempts.id"), nullable=False)
    section = Column(String(50), nullable=False)
    question_index = Column(Integer, nullable=False)
    question_id = Column(Integer, ForeignKey("test_contents.id"), nullable=True)
    answer_data = Column(JSON, nullable=False)  # {"selected": "B"} or {"text": "..."} or {"audio_url": "..."}
    is_correct = Column(Boolean, nullable=True)  # null for AI-scored
    score = Column(Float, nullable=True)
    ai_feedback = Column(JSON, nullable=True)  # AI evaluation details
    submitted_at = Column(DateTime, default=datetime.utcnow)

    attempt = relationship("TestAttempt", back_populates="answers")


class TestResult(Base):
    __tablename__ = "test_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    attempt_id = Column(Integer, ForeignKey("test_attempts.id"), unique=True, nullable=False)
    total_score = Column(Float, nullable=False)
    section_scores = Column(JSON, nullable=False)  # {"reading": 4.5, "listening": 5.0, ...}
    band_score = Column(Float, nullable=True)  # CEFR-aligned band for TOEFL 2026
    ai_summary = Column(Text, nullable=True)  # AI-generated performance summary
    detailed_feedback = Column(JSON, nullable=True)  # Per-section detailed feedback
    created_at = Column(DateTime, default=datetime.utcnow)

    attempt = relationship("TestAttempt", back_populates="result")


class SkillTracker(Base):
    __tablename__ = "skill_trackers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    test_type = Column(Enum(TestType), nullable=False)
    skill = Column(String(100), nullable=False)  # e.g. "reading_vocab", "listening_main_ideas"
    proficiency_score = Column(Float, default=1500.0)  # ELO-like rating
    total_attempts = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="skill_trackers")


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    context_type = Column(String(50), default="tutoring")  # tutoring, test_help, general
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="conversations")
