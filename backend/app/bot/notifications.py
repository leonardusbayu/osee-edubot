import logging

from telegram import Bot

from app.config import get_settings

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self):
        settings = get_settings()
        self.bot = Bot(token=settings.telegram_bot_token) if settings.telegram_bot_token else None

    async def send_to_user(self, telegram_id: int, text: str, parse_mode: str = "HTML"):
        if not self.bot:
            logger.warning("Bot not configured, skipping notification")
            return
        try:
            await self.bot.send_message(chat_id=telegram_id, text=text, parse_mode=parse_mode)
        except Exception as e:
            logger.error(f"Failed to send notification to {telegram_id}: {e}")

    async def send_study_reminder(self, telegram_id: int, student_name: str):
        text = (
            f"📚 <b>Time to study, {student_name}!</b>\n\n"
            "Your daily practice is waiting. Even 15 minutes of focused study "
            "makes a big difference.\n\n"
            "Type /study to start a quick session, or /test to take a practice test."
        )
        await self.send_to_user(telegram_id, text)

    async def send_test_result_notification(
        self, telegram_id: int, test_type: str, score: float, band: float | None
    ):
        score_display = f"Band {band}" if band else f"Score: {score}"
        text = (
            f"📊 <b>Test Results Ready!</b>\n\n"
            f"Your {test_type} practice test has been scored.\n"
            f"📈 {score_display}\n\n"
            "Open your progress dashboard to see detailed feedback."
        )
        await self.send_to_user(telegram_id, text)

    async def broadcast_to_class(self, student_telegram_ids: list[int], message: str):
        for tid in student_telegram_ids:
            await self.send_to_user(tid, message)


notification_service = NotificationService()
