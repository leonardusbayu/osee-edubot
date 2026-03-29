import logging

import anthropic
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db.database import async_session
from app.models.models import ConversationMessage, User

logger = logging.getLogger(__name__)

TUTOR_SYSTEM_PROMPT = """You are EduBot, an expert English language tutor specializing in test preparation for TOEFL iBT and IELTS. You are friendly, encouraging, and adaptive to each student's level.

Student Profile:
- Name: {name}
- Target Test: {target_test}
- Proficiency Level: {proficiency_level}

Guidelines:
- Adapt explanations to the student's proficiency level
- Give concrete examples with every grammar or vocabulary explanation
- When correcting errors, explain WHY something is wrong, not just what's correct
- Keep responses concise but thorough (aim for 100-300 words)
- Use encouraging language and celebrate progress
- If the student asks about test strategy, give specific, actionable tips
- Format responses with clear structure using line breaks and bullet points
- If unsure about the student's question, ask for clarification
"""


class TutorService:
    def __init__(self):
        settings = get_settings()
        self.client = None
        if settings.anthropic_api_key:
            self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def get_response(self, user: User, message: str) -> str:
        if not self.client:
            return (
                "AI tutoring is not configured yet. "
                "Please set your ANTHROPIC_API_KEY in the environment."
            )

        # Load recent conversation history
        history = await self._load_history(user.id)

        # Build system prompt with student context
        system_prompt = TUTOR_SYSTEM_PROMPT.format(
            name=user.name,
            target_test=user.target_test or "Not specified",
            proficiency_level=user.proficiency_level or "Unknown",
        )

        # Build messages list
        messages = []
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": message})

        try:
            # Use Haiku for simple lookups, Sonnet for complex tutoring
            model = self._select_model(message)

            response = await self.client.messages.create(
                model=model,
                max_tokens=1024,
                system=system_prompt,
                messages=messages,
            )

            assistant_text = response.content[0].text

            # Save conversation to DB
            await self._save_messages(user.id, message, assistant_text)

            return assistant_text

        except Exception as e:
            logger.error(f"Claude API error: {e}")
            return "Sorry, I'm having trouble thinking right now. Please try again in a moment."

    def _select_model(self, message: str) -> str:
        simple_keywords = ["define", "meaning of", "what does", "translate", "synonym", "antonym"]
        if any(kw in message.lower() for kw in simple_keywords):
            return "claude-haiku-4-5-20251001"
        return "claude-sonnet-4-6-20250131"

    async def _load_history(self, user_id: int, limit: int = 10) -> list[ConversationMessage]:
        async with async_session() as db:
            result = await db.execute(
                select(ConversationMessage)
                .where(ConversationMessage.user_id == user_id)
                .order_by(ConversationMessage.created_at.desc())
                .limit(limit)
            )
            messages = list(result.scalars().all())
            messages.reverse()  # Chronological order
            return messages

    async def _save_messages(self, user_id: int, user_msg: str, assistant_msg: str):
        async with async_session() as db:
            db.add(ConversationMessage(user_id=user_id, role="user", content=user_msg))
            db.add(ConversationMessage(user_id=user_id, role="assistant", content=assistant_msg))
            await db.commit()


tutor_service = TutorService()
