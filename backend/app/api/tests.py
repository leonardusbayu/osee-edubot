from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import get_current_user
from app.db.database import get_db
from app.models.models import TestAttempt, TestResult, User
from app.schemas.schemas import (
    StartTestRequest,
    StartTestResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    TestAttemptState,
    TestResultResponse,
)
from app.services.test_engine import test_engine

router = APIRouter(prefix="/api/tests", tags=["tests"])


@router.get("/available")
async def list_available_tests():
    return test_engine.get_available_tests()


@router.post("/start", response_model=StartTestResponse)
async def start_test(
    request: StartTestRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = test_engine.get_config(request.test_type)
    if not config:
        raise HTTPException(status_code=404, detail="Test type not found")

    attempt = await test_engine.start_attempt(db, user.id, request.test_type)

    return StartTestResponse(
        attempt_id=attempt.id,
        test_type=request.test_type,
        sections=[
            {"id": s["id"], "name": s["name"], "duration_minutes": s["duration_minutes"]}
            for s in config["sections"]
        ],
        current_section=config["sections"][0]["id"],
        total_duration_minutes=config["total_duration_minutes"],
    )


@router.get("/attempt/{attempt_id}", response_model=TestAttemptState)
async def get_attempt(
    attempt_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    state = await test_engine.get_attempt_state(db, attempt_id)

    # Verify ownership
    result = await db.execute(
        select(TestAttempt).where(TestAttempt.id == attempt_id)
    )
    attempt = result.scalar_one_or_none()
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")

    return state


@router.post("/attempt/{attempt_id}/answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    attempt_id: int,
    request: SubmitAnswerRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership
    result = await db.execute(
        select(TestAttempt).where(TestAttempt.id == attempt_id)
    )
    attempt = result.scalar_one_or_none()
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")

    answer_result = await test_engine.submit_answer(
        db, attempt_id, request.section, request.question_index, request.answer_data
    )
    return answer_result


@router.post("/attempt/{attempt_id}/section/{next_section}")
async def advance_section(
    attempt_id: int,
    next_section: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TestAttempt).where(TestAttempt.id == attempt_id)
    )
    attempt = result.scalar_one_or_none()
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")

    await test_engine.advance_section(db, attempt_id, next_section)
    return {"status": "ok", "current_section": next_section}


@router.post("/attempt/{attempt_id}/finish", response_model=TestResultResponse)
async def finish_attempt(
    attempt_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TestAttempt).where(TestAttempt.id == attempt_id)
    )
    attempt = result.scalar_one_or_none()
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")

    finish_result = await test_engine.finish_attempt(db, attempt_id)
    return finish_result


@router.get("/results/{attempt_id}", response_model=TestResultResponse)
async def get_results(
    attempt_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TestResult).where(TestResult.attempt_id == attempt_id)
    )
    test_result = result.scalar_one_or_none()
    if not test_result:
        raise HTTPException(status_code=404, detail="Results not found")

    # Verify ownership
    attempt_result = await db.execute(
        select(TestAttempt).where(TestAttempt.id == attempt_id)
    )
    attempt = attempt_result.scalar_one_or_none()
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")

    return TestResultResponse(
        attempt_id=attempt_id,
        test_type=attempt.test_type.value,
        total_score=test_result.total_score,
        band_score=test_result.band_score,
        section_scores=test_result.section_scores,
        ai_summary=test_result.ai_summary,
        detailed_feedback=test_result.detailed_feedback,
        completed_at=attempt.finished_at,
    )
