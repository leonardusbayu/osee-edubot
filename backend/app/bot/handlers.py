import logging

from telegram import Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)
from sqlalchemy import select

from app.config import get_settings
from app.db.database import async_session
from app.models.models import User, UserRole, TestType
from app.bot.keyboards import (
    get_admin_keyboard,
    get_main_menu_keyboard,
    get_proficiency_keyboard,
    get_study_topic_keyboard,
    get_test_type_keyboard,
)
from app.services.ai_tutor import tutor_service

logger = logging.getLogger(__name__)


async def get_or_create_user(telegram_id: int, name: str, username: str | None = None) -> User:
    async with async_session() as db:
        result = await db.execute(select(User).where(User.telegram_id == telegram_id))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                telegram_id=telegram_id,
                name=name,
                username=username,
                role=UserRole.student,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        return user


# --- Command Handlers ---

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user = update.effective_user
    user = await get_or_create_user(tg_user.id, tg_user.full_name, tg_user.username)

    if user.onboarding_complete:
        await update.message.reply_text(
            f"Welcome back, {user.name}! 🎓\n\n"
            "What would you like to do?",
            reply_markup=get_main_menu_keyboard(),
        )
        return

    await update.message.reply_text(
        f"Welcome to EduBot, {tg_user.first_name}! 🎓\n\n"
        "I'm your AI-powered English test preparation tutor. "
        "I'll help you prepare for TOEFL iBT, IELTS, and more.\n\n"
        "First, which test are you preparing for?",
        reply_markup=get_test_type_keyboard(),
    )


async def study_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📖 Let's study! What would you like to practice?",
        reply_markup=get_study_topic_keyboard(),
    )


async def test_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    settings = get_settings()
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

    await update.message.reply_text(
        "📝 Ready to take a practice test?\n\n"
        "Open the test menu to browse available tests and start practicing.",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("📝 Open Test Menu", web_app=WebAppInfo(url=f"{settings.webapp_url}/test"))]
        ]),
    )


async def progress_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    settings = get_settings()
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

    await update.message.reply_text(
        "📊 View your progress and score history in the dashboard.",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("📊 Open Dashboard", web_app=WebAppInfo(url=f"{settings.webapp_url}/progress"))]
        ]),
    )


async def schedule_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📅 Your class schedule will appear here once you join a class.\n\n"
        "Ask your teacher for the class invite code to get started."
    )


async def admin_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user = update.effective_user
    user = await get_or_create_user(tg_user.id, tg_user.full_name, tg_user.username)

    if user.role not in (UserRole.teacher, UserRole.admin):
        await update.message.reply_text("⛔ This command is for teachers and admins only.")
        return

    await update.message.reply_text(
        "🏫 Teacher Admin Panel",
        reply_markup=get_admin_keyboard(),
    )


async def broadcast_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user = update.effective_user
    user = await get_or_create_user(tg_user.id, tg_user.full_name, tg_user.username)

    if user.role not in (UserRole.teacher, UserRole.admin):
        await update.message.reply_text("⛔ This command is for teachers and admins only.")
        return

    if not context.args:
        await update.message.reply_text(
            "Usage: /broadcast <message>\n\n"
            "This will send the message to all students in your classes."
        )
        return

    message = " ".join(context.args)
    await update.message.reply_text(f"📢 Broadcast sent: {message}")


# --- Callback Query Handlers ---

async def onboarding_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data

    tg_user = update.effective_user

    if data.startswith("target_"):
        target = data.replace("target_", "")

        async with async_session() as db:
            result = await db.execute(select(User).where(User.telegram_id == tg_user.id))
            user = result.scalar_one_or_none()
            if user and target != "skip":
                user.target_test = TestType(target)
                await db.commit()

        await query.edit_message_text(
            "Great choice! Now, how would you rate your current English level?",
            reply_markup=get_proficiency_keyboard(),
        )

    elif data.startswith("level_"):
        level = data.replace("level_", "")

        async with async_session() as db:
            result = await db.execute(select(User).where(User.telegram_id == tg_user.id))
            user = result.scalar_one_or_none()
            if user:
                user.proficiency_level = level
                user.onboarding_complete = True
                await db.commit()

        await query.edit_message_text(
            "🎉 You're all set! Here's what you can do:\n\n"
            "📝 Take practice tests to simulate real exam conditions\n"
            "📖 Study with me — I can help with grammar, vocabulary, and more\n"
            "📊 Track your progress and get personalized study plans\n\n"
            "What would you like to start with?",
            reply_markup=get_main_menu_keyboard(),
        )


async def study_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data

    tg_user = update.effective_user
    user = await get_or_create_user(tg_user.id, tg_user.full_name, tg_user.username)

    topic_prompts = {
        "study_start": "I'd like to start a study session.",
        "study_grammar": "Help me practice English grammar. Give me a grammar topic to study with examples.",
        "study_vocab": "Help me expand my vocabulary. Teach me some useful words for the test.",
        "study_writing": "Give me tips for writing better essays on English proficiency tests.",
        "study_speaking": "Give me tips for the speaking section of English proficiency tests.",
        "study_ask": "I have a question about English. I'll type it next.",
    }

    prompt = topic_prompts.get(data, "I'd like to study English.")

    if data == "study_ask":
        await query.edit_message_text(
            "❓ Sure! Type your question and I'll help you out."
        )
        context.user_data["awaiting_question"] = True
        return

    await query.edit_message_text("🤔 Let me think...")
    response = await tutor_service.get_response(user, prompt)
    await query.edit_message_text(response)


# --- Free-text Message Handler ---

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user = update.effective_user
    user = await get_or_create_user(tg_user.id, tg_user.full_name, tg_user.username)

    if not user.onboarding_complete:
        await update.message.reply_text(
            "Please complete your setup first! Use /start to begin."
        )
        return

    message_text = update.message.text
    await update.message.reply_text("🤔 Thinking...")

    response = await tutor_service.get_response(user, message_text)

    # Delete "Thinking..." message and send actual response
    await update.message.reply_text(response)


# --- Bot Application Setup ---

def create_bot_application() -> Application:
    settings = get_settings()
    application = Application.builder().token(settings.telegram_bot_token).build()

    # Command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("study", study_command))
    application.add_handler(CommandHandler("test", test_command))
    application.add_handler(CommandHandler("progress", progress_command))
    application.add_handler(CommandHandler("schedule", schedule_command))
    application.add_handler(CommandHandler("admin", admin_command))
    application.add_handler(CommandHandler("broadcast", broadcast_command))

    # Callback query handlers
    application.add_handler(CallbackQueryHandler(onboarding_callback, pattern="^(target_|level_)"))
    application.add_handler(CallbackQueryHandler(study_callback, pattern="^study_"))

    # Free-text message handler
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    return application
