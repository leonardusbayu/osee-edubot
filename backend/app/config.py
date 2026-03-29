from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Telegram
    telegram_bot_token: str = ""
    telegram_bot_secret: str = ""
    webapp_url: str = "http://localhost:5173"

    # AI APIs
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Database
    database_url: str = "sqlite+aiosqlite:///./edubot.db"

    # Auth
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    jwt_refresh_expire_days: int = 7

    # Media Storage
    media_storage: str = "local"  # "local" or "r2"
    media_local_path: str = "./media"
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "edubot-media"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
