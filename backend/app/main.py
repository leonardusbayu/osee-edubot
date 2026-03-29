import logging

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from telegram import Update

from app.config import get_settings
from app.db.database import init_db
from app.bot.handlers import create_bot_application

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Bot application (initialized at startup)
bot_app = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global bot_app

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    # Initialize bot
    settings = get_settings()
    if settings.telegram_bot_token:
        bot_app = create_bot_application()
        await bot_app.initialize()
        await bot_app.start()
        logger.info("Telegram bot started")

        # Set webhook if WEBAPP_URL is configured and not localhost
        if settings.webapp_url and "localhost" not in settings.webapp_url:
            webhook_url = f"{settings.webapp_url}/api/bot/webhook"
            await bot_app.bot.set_webhook(
                url=webhook_url,
                secret_token=settings.telegram_bot_secret,
            )
            logger.info(f"Webhook set to {webhook_url}")

    yield

    # Shutdown
    if bot_app:
        await bot_app.stop()
        await bot_app.shutdown()
        logger.info("Bot shutdown complete")


app = FastAPI(
    title="EduBot API",
    description="Telegram Classroom & AI Tutor Platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.webapp_url,
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
from app.api.auth import router as auth_router
from app.api.tests import router as tests_router
from app.api.progress import router as progress_router
from app.api.content import router as content_router
from app.api.media import router as media_router

app.include_router(auth_router)
app.include_router(tests_router)
app.include_router(progress_router)
app.include_router(content_router)
app.include_router(media_router)


# Bot webhook endpoint
@app.post("/api/bot/webhook")
async def bot_webhook(request: Request):
    if not bot_app:
        return {"error": "Bot not initialized"}

    # Verify secret token
    settings = get_settings()
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
    if settings.telegram_bot_secret and secret != settings.telegram_bot_secret:
        return {"error": "Unauthorized"}

    data = await request.json()
    update = Update.de_json(data, bot_app.bot)
    await bot_app.process_update(update)
    return {"ok": True}


# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}


# Dev: polling mode for local development
if __name__ == "__main__":
    import asyncio

    async def run_polling():
        await init_db()
        application = create_bot_application()
        logger.info("Starting bot in polling mode...")
        await application.run_polling(drop_pending_updates=True)

    asyncio.run(run_polling())
