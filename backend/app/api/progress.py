from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import get_current_user
from app.db.database import get_db
from app.models.models import (
    AttemptStatus,
    SkillTracker,
    TestAttempt,
    TestResult,
    User,
)
from app.schemas.schemas import ProgressOverview

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("/overview", response_model=ProgressOverview)
async def get_progress_overview(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Total completed tests
    count_result = await db.execute(
        select(func.count(TestAttempt.id))
        .where(TestAttempt.user_id == user.id)
        .where(TestAttempt.status == AttemptStatus.completed)
    )
    total_tests = count_result.scalar() or 0

    # Get all results for score stats
    results_query = await db.execute(
        select(TestResult)
        .join(TestAttempt, TestResult.attempt_id == TestAttempt.id)
        .where(TestAttempt.user_id == user.id)
        .order_by(TestResult.created_at.desc())
    )
    results = results_query.scalars().all()

    scores = [r.total_score for r in results]
    average_score = round(sum(scores) / len(scores), 1) if scores else None
    best_score = max(scores) if scores else None

    recent_scores = [
        {
            "attempt_id": r.attempt_id,
            "total_score": r.total_score,
            "band_score": r.band_score,
            "section_scores": r.section_scores,
            "date": r.created_at.isoformat() if r.created_at else None,
        }
        for r in results[:10]
    ]

    # Skills
    skills_result = await db.execute(
        select(SkillTracker).where(SkillTracker.user_id == user.id)
    )
    skills = [
        {
            "skill": s.skill,
            "proficiency_score": s.proficiency_score,
            "total_attempts": s.total_attempts,
            "correct_rate": round(s.correct_count / s.total_attempts, 2) if s.total_attempts > 0 else 0,
        }
        for s in skills_result.scalars().all()
    ]

    # Simple study streak (count consecutive days with attempts)
    study_streak = 0  # TODO: implement proper streak calculation

    return ProgressOverview(
        total_tests_taken=total_tests,
        average_score=average_score,
        best_score=best_score,
        recent_scores=recent_scores,
        study_streak=study_streak,
        skills=skills,
    )


@router.get("/skills")
async def get_skills(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SkillTracker).where(SkillTracker.user_id == user.id)
    )
    skills = result.scalars().all()

    return [
        {
            "skill": s.skill,
            "test_type": s.test_type.value,
            "proficiency_score": s.proficiency_score,
            "total_attempts": s.total_attempts,
            "correct_count": s.correct_count,
            "correct_rate": round(s.correct_count / s.total_attempts, 2) if s.total_attempts > 0 else 0,
        }
        for s in skills
    ]
