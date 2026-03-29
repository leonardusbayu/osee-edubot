from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from app.config import get_settings


def get_main_menu_keyboard() -> InlineKeyboardMarkup:
    settings = get_settings()
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📝 Practice Test", web_app=WebAppInfo(url=f"{settings.webapp_url}/test"))],
        [InlineKeyboardButton("📊 My Progress", web_app=WebAppInfo(url=f"{settings.webapp_url}/progress"))],
        [InlineKeyboardButton("📅 Class Schedule", web_app=WebAppInfo(url=f"{settings.webapp_url}/schedule"))],
        [InlineKeyboardButton("📖 Study Now", callback_data="study_start")],
    ])


def get_admin_keyboard() -> InlineKeyboardMarkup:
    settings = get_settings()
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📋 Manage Content", web_app=WebAppInfo(url=f"{settings.webapp_url}/admin/content"))],
        [InlineKeyboardButton("👥 Student Overview", web_app=WebAppInfo(url=f"{settings.webapp_url}/admin/students"))],
        [InlineKeyboardButton("🏫 Manage Classes", web_app=WebAppInfo(url=f"{settings.webapp_url}/admin/classes"))],
    ])


def get_test_type_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🇺🇸 TOEFL iBT", callback_data="target_TOEFL_IBT")],
        [InlineKeyboardButton("🇬🇧 IELTS", callback_data="target_IELTS")],
        [InlineKeyboardButton("⏭ Skip for now", callback_data="target_skip")],
    ])


def get_proficiency_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🌱 Beginner", callback_data="level_beginner")],
        [InlineKeyboardButton("🌿 Intermediate", callback_data="level_intermediate")],
        [InlineKeyboardButton("🌳 Advanced", callback_data="level_advanced")],
        [InlineKeyboardButton("❓ Not sure", callback_data="level_unknown")],
    ])


def get_study_topic_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📖 Grammar", callback_data="study_grammar"),
            InlineKeyboardButton("📚 Vocabulary", callback_data="study_vocab"),
        ],
        [
            InlineKeyboardButton("✍️ Writing Tips", callback_data="study_writing"),
            InlineKeyboardButton("🗣 Speaking Tips", callback_data="study_speaking"),
        ],
        [InlineKeyboardButton("❓ Ask a Question", callback_data="study_ask")],
    ])
