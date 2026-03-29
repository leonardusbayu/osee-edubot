import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from app.auth.middleware import get_current_user
from app.config import get_settings
from app.models.models import User

router = APIRouter(prefix="/api/media", tags=["media"])


def get_media_path() -> Path:
    settings = get_settings()
    media_path = Path(settings.media_local_path)
    media_path.mkdir(parents=True, exist_ok=True)
    return media_path


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    settings = get_settings()

    if settings.media_storage != "local":
        raise HTTPException(status_code=501, detail="Only local storage implemented for now")

    # Generate unique filename
    ext = Path(file.filename or "file").suffix
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = get_media_path() / filename

    # Save file
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    return {
        "key": filename,
        "url": f"/api/media/{filename}",
        "size": len(content),
    }


@router.post("/recording")
async def upload_recording(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """Upload a speaking recording (audio file)."""
    settings = get_settings()

    ext = Path(file.filename or "recording.webm").suffix
    if ext not in (".webm", ".mp4", ".ogg", ".wav", ".m4a"):
        ext = ".webm"

    filename = f"recording_{user.id}_{uuid.uuid4().hex}{ext}"
    file_path = get_media_path() / filename

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    return {
        "key": filename,
        "url": f"/api/media/{filename}",
        "audio_path": str(file_path),
        "size": len(content),
    }


@router.get("/{key}")
async def get_media(key: str):
    file_path = get_media_path() / key
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path)
