import logging
from pathlib import Path

import openai

from app.config import get_settings

logger = logging.getLogger(__name__)


class SpeechService:
    def __init__(self):
        settings = get_settings()
        self.client = None
        if settings.openai_api_key:
            self.client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

    async def transcribe(self, audio_path: str) -> str | None:
        """Transcribe audio file using OpenAI Whisper API."""
        if not self.client:
            logger.warning("OpenAI API key not configured, skipping transcription")
            return None

        try:
            with open(audio_path, "rb") as audio_file:
                response = await self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text",
                )
            return response
        except Exception as e:
            logger.error(f"Whisper transcription error: {e}")
            return None

    async def transcribe_bytes(self, audio_bytes: bytes, filename: str = "audio.webm") -> str | None:
        """Transcribe audio from bytes using OpenAI Whisper API."""
        if not self.client:
            logger.warning("OpenAI API key not configured, skipping transcription")
            return None

        try:
            response = await self.client.audio.transcriptions.create(
                model="whisper-1",
                file=(filename, audio_bytes),
                response_format="text",
            )
            return response
        except Exception as e:
            logger.error(f"Whisper transcription error: {e}")
            return None


speech_service = SpeechService()
