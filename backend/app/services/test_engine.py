import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    AttemptAnswer,
    AttemptStatus,
    ContentStatus,
    TestAttempt,
    TestContent,
    TestResult,
    TestType,
)
from app.services.scoring import scoring_service

logger = logging.getLogger(__name__)

# Load test configs at module level
TEST_CONFIGS: dict[str, dict] = {}
CONFIG_DIR = Path(__file__).parent.parent.parent.parent / "shared" / "test_configs"


def load_test_configs():
    global TEST_CONFIGS
    for config_file in CONFIG_DIR.glob("*.json"):
        with open(config_file) as f:
            config = json.load(f)
            TEST_CONFIGS[config["test_type"]] = config
    logger.info(f"Loaded {len(TEST_CONFIGS)} test configurations")


load_test_configs()


class TestEngine:
    def get_config(self, test_type: str) -> dict | None:
        return TEST_CONFIGS.get(test_type)

    def get_available_tests(self) -> list[dict]:
        results = []
        for key, config in TEST_CONFIGS.items():
            if config.get("status") == "planned":
                continue
            results.append({
                "test_type": key,
                "display_name": config["display_name"],
                "description": config.get("description", ""),
                "total_duration_minutes": config["total_duration_minutes"],
                "sections": [
                    {
                        "id": s["id"],
                        "name": s["name"],
                        "duration_minutes": s["duration_minutes"],
                    }
                    for s in config["sections"]
                ],
            })
        return results

    async def start_attempt(
        self, db: AsyncSession, user_id: int, test_type: str
    ) -> TestAttempt:
        config = self.get_config(test_type)
        if not config:
            raise ValueError(f"Unknown test type: {test_type}")

        # Fetch content for this test type
        result = await db.execute(
            select(TestContent)
            .where(TestContent.test_type == TestType(test_type))
            .where(TestContent.status == ContentStatus.published)
        )
        contents = result.scalars().all()
        content_ids = [c.id for c in contents] if contents else []

        first_section = config["sections"][0]["id"]

        attempt = TestAttempt(
            user_id=user_id,
            test_type=TestType(test_type),
            content_ids=content_ids,
            status=AttemptStatus.in_progress,
            current_section=first_section,
            current_question_index=0,
            section_start_times={first_section: datetime.now(timezone.utc).isoformat()},
        )
        db.add(attempt)
        await db.commit()
        await db.refresh(attempt)
        return attempt

    async def get_attempt_state(self, db: AsyncSession, attempt_id: int) -> dict:
        result = await db.execute(
            select(TestAttempt).where(TestAttempt.id == attempt_id)
        )
        attempt = result.scalar_one_or_none()
        if not attempt:
            raise ValueError("Attempt not found")

        config = self.get_config(attempt.test_type.value)

        # Count submitted answers
        answer_count = await db.execute(
            select(func.count(AttemptAnswer.id))
            .where(AttemptAnswer.attempt_id == attempt_id)
        )
        answers_submitted = answer_count.scalar() or 0

        # Calculate time remaining for current section
        time_remaining = None
        if attempt.current_section and attempt.section_start_times:
            section_config = next(
                (s for s in config["sections"] if s["id"] == attempt.current_section),
                None,
            )
            if section_config:
                start_str = attempt.section_start_times.get(attempt.current_section)
                if start_str:
                    start_time = datetime.fromisoformat(start_str)
                    elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
                    time_remaining = max(0, section_config["duration_minutes"] * 60 - elapsed)

        return {
            "attempt_id": attempt.id,
            "test_type": attempt.test_type.value,
            "status": attempt.status.value,
            "current_section": attempt.current_section,
            "current_question_index": attempt.current_question_index,
            "sections": [
                {
                    "id": s["id"],
                    "name": s["name"],
                    "duration_minutes": s["duration_minutes"],
                }
                for s in config["sections"]
            ],
            "answers_submitted": answers_submitted,
            "time_remaining_seconds": int(time_remaining) if time_remaining is not None else None,
        }

    async def submit_answer(
        self,
        db: AsyncSession,
        attempt_id: int,
        section: str,
        question_index: int,
        answer_data: dict,
        question_id: int | None = None,
    ) -> dict:
        # Check for existing answer (update if exists)
        result = await db.execute(
            select(AttemptAnswer)
            .where(AttemptAnswer.attempt_id == attempt_id)
            .where(AttemptAnswer.section == section)
            .where(AttemptAnswer.question_index == question_index)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.answer_data = answer_data
            existing.submitted_at = datetime.now(timezone.utc)
        else:
            answer = AttemptAnswer(
                attempt_id=attempt_id,
                section=section,
                question_index=question_index,
                question_id=question_id,
                answer_data=answer_data,
            )
            db.add(answer)

        # Score objective questions immediately
        is_correct = None
        if "selected" in answer_data and "correct_answer" in answer_data:
            score_result = await scoring_service.score_objective(
                answer_data["selected"], answer_data["correct_answer"]
            )
            is_correct = score_result["is_correct"]
            if existing:
                existing.is_correct = is_correct
                existing.score = score_result["score"]
            else:
                answer.is_correct = is_correct
                answer.score = score_result["score"]

        # Update attempt position
        attempt_result = await db.execute(
            select(TestAttempt).where(TestAttempt.id == attempt_id)
        )
        attempt = attempt_result.scalar_one()
        attempt.current_question_index = question_index + 1

        await db.commit()

        return {
            "saved": True,
            "is_correct": is_correct,
            "next_question_index": question_index + 1,
        }

    async def advance_section(
        self, db: AsyncSession, attempt_id: int, next_section: str
    ):
        result = await db.execute(
            select(TestAttempt).where(TestAttempt.id == attempt_id)
        )
        attempt = result.scalar_one()

        attempt.current_section = next_section
        attempt.current_question_index = 0

        start_times = dict(attempt.section_start_times or {})
        start_times[next_section] = datetime.now(timezone.utc).isoformat()
        attempt.section_start_times = start_times

        await db.commit()

    async def finish_attempt(self, db: AsyncSession, attempt_id: int) -> dict:
        result = await db.execute(
            select(TestAttempt).where(TestAttempt.id == attempt_id)
        )
        attempt = result.scalar_one()
        attempt.status = AttemptStatus.completed
        attempt.finished_at = datetime.now(timezone.utc)

        config = self.get_config(attempt.test_type.value)

        # Load all answers
        answers_result = await db.execute(
            select(AttemptAnswer).where(AttemptAnswer.attempt_id == attempt_id)
        )
        answers = answers_result.scalars().all()

        # Calculate section scores
        section_scores = {}
        for section_config in config["sections"]:
            section_id = section_config["id"]
            section_answers = [a for a in answers if a.section == section_id]

            if section_config.get("scoring", {}).get("method") in ("ai_rubric",):
                # AI-scored sections — average AI scores if available
                ai_scores = [a.score for a in section_answers if a.score is not None]
                section_scores[section_id] = round(sum(ai_scores) / len(ai_scores), 1) if ai_scores else 0
            else:
                # Objective scoring
                correct = sum(1 for a in section_answers if a.is_correct)
                total = len(section_answers) or 1
                max_band = section_config.get("scoring", {}).get("max_band", 6)
                section_scores[section_id] = round((correct / total) * max_band, 1)

        # Calculate total/band score
        total_score = round(sum(section_scores.values()) / len(section_scores), 1) if section_scores else 0

        # Create test result
        test_result = TestResult(
            attempt_id=attempt_id,
            total_score=total_score,
            band_score=total_score,
            section_scores=section_scores,
        )
        db.add(test_result)
        await db.commit()
        await db.refresh(test_result)

        return {
            "attempt_id": attempt_id,
            "test_type": attempt.test_type.value,
            "total_score": total_score,
            "band_score": total_score,
            "section_scores": section_scores,
            "completed_at": attempt.finished_at.isoformat() if attempt.finished_at else None,
        }


test_engine = TestEngine()
