import hashlib
import hmac
import json
import time
from urllib.parse import parse_qs, unquote

from app.config import get_settings


def validate_init_data(init_data: str, bot_token: str | None = None) -> dict | None:
    """Validate Telegram WebApp initData HMAC signature.

    Returns parsed user data if valid, None if invalid.
    See: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    """
    if not bot_token:
        bot_token = get_settings().telegram_bot_token

    parsed = parse_qs(init_data)

    # Extract hash
    received_hash = parsed.get("hash", [None])[0]
    if not received_hash:
        return None

    # Build data-check-string (sorted key=value pairs, excluding hash)
    data_pairs = []
    for key, values in parsed.items():
        if key == "hash":
            continue
        data_pairs.append(f"{key}={unquote(values[0])}")

    data_check_string = "\n".join(sorted(data_pairs))

    # Compute HMAC-SHA256
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        return None

    # Check auth_date freshness (allow up to 1 hour)
    auth_date = parsed.get("auth_date", [None])[0]
    if auth_date and (time.time() - int(auth_date)) > 3600:
        return None

    # Parse user data
    user_data_str = parsed.get("user", [None])[0]
    if not user_data_str:
        return None

    try:
        user_data = json.loads(unquote(user_data_str))
    except (json.JSONDecodeError, TypeError):
        return None

    return user_data
