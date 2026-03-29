import json
import logging

import anthropic

from app.config import get_settings
from app.services.speech import speech_service

logger = logging.getLogger(__name__)


ESSAY_SCORING_PROMPT = """You are an expert English proficiency test scorer. Score the following essay based on the provided rubric.

Test Type: {test_type}
Task Type: {task_type}
Prompt: {prompt}

Scoring Criteria: {criteria}
Score Scale: {scale}

Student's Essay:
---
{essay}
---

Respond in JSON format:
{{
  "overall_score": <number>,
  "criteria_scores": {{
    "<criterion>": <number>,
    ...
  }},
  "feedback": {{
    "strengths": ["<strength1>", "<strength2>"],
    "weaknesses": ["<weakness1>", "<weakness2>"],
    "suggestions": ["<suggestion1>", "<suggestion2>"]
  }},
  "corrected_sentences": [
    {{
      "original": "<original sentence>",
      "corrected": "<corrected sentence>",
      "explanation": "<why this correction>"
    }}
  ]
}}"""


SPEAKING_SCORING_PROMPT = """You are an expert English proficiency test scorer evaluating a speaking response.

Test Type: {test_type}
Task Type: {task_type}
Prompt: {prompt}

Scoring Criteria: {criteria}
Score Scale: {scale}

Student's Transcription:
---
{transcription}
---

Evaluate the response based on the transcription. Note that this is a transcription, so minor transcription artifacts should not be penalized.

Respond in JSON format:
{{
  "overall_score": <number>,
  "criteria_scores": {{
    "<criterion>": <number>,
    ...
  }},
  "feedback": {{
    "strengths": ["<strength1>", "<strength2>"],
    "weaknesses": ["<weakness1>", "<weakness2>"],
    "suggestions": ["<suggestion1>", "<suggestion2>"]
  }},
  "pronunciation_notes": "<general notes on pronunciation patterns from transcription>"
}}"""


class ScoringService:
    def __init__(self):
        settings = get_settings()
        self.client = None
        if settings.anthropic_api_key:
            self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def score_objective(self, answer: str, correct_answer: str) -> dict:
        """Score an objective (multiple choice, fill-in-blank) question."""
        is_correct = answer.strip().lower() == correct_answer.strip().lower()
        return {
            "is_correct": is_correct,
            "score": 1.0 if is_correct else 0.0,
        }

    async def score_essay(
        self,
        essay: str,
        test_type: str,
        task_type: str,
        prompt: str,
        criteria: list[str],
        scale: str = "1-6",
    ) -> dict:
        """Score a writing response using Claude."""
        if not self.client:
            return {"error": "AI scoring not configured", "overall_score": 0}

        scoring_prompt = ESSAY_SCORING_PROMPT.format(
            test_type=test_type,
            task_type=task_type,
            prompt=prompt,
            criteria=", ".join(criteria),
            scale=scale,
            essay=essay,
        )

        try:
            response = await self.client.messages.create(
                model="claude-sonnet-4-6-20250131",
                max_tokens=2048,
                messages=[{"role": "user", "content": scoring_prompt}],
            )
            return json.loads(response.content[0].text)
        except Exception as e:
            logger.error(f"Essay scoring error: {e}")
            return {"error": str(e), "overall_score": 0}

    async def score_speaking(
        self,
        audio_path: str,
        test_type: str,
        task_type: str,
        prompt: str,
        criteria: list[str],
        scale: str = "1-6",
    ) -> dict:
        """Score a speaking response: transcribe with Whisper, then evaluate with Claude."""
        # Step 1: Transcribe
        transcription = await speech_service.transcribe(audio_path)
        if not transcription:
            return {"error": "Transcription failed", "overall_score": 0}

        if not self.client:
            return {"error": "AI scoring not configured", "overall_score": 0, "transcription": transcription}

        # Step 2: Score with Claude
        scoring_prompt = SPEAKING_SCORING_PROMPT.format(
            test_type=test_type,
            task_type=task_type,
            prompt=prompt,
            criteria=", ".join(criteria),
            scale=scale,
            transcription=transcription,
        )

        try:
            response = await self.client.messages.create(
                model="claude-sonnet-4-6-20250131",
                max_tokens=2048,
                messages=[{"role": "user", "content": scoring_prompt}],
            )
            result = json.loads(response.content[0].text)
            result["transcription"] = transcription
            return result
        except Exception as e:
            logger.error(f"Speaking scoring error: {e}")
            return {"error": str(e), "overall_score": 0, "transcription": transcription}


scoring_service = ScoringService()
