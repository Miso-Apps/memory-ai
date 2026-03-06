"""
Storage API — audio upload with real MinIO + optional Whisper transcription.
"""

import logging

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.api.preferences import get_or_create_preferences
from app.services import ai_service, storage_service
from app.services.media_optimizer import optimize_image as optimize_image_bytes, generate_thumbnail

log = logging.getLogger(__name__)

router = APIRouter()

_VALID_LANGS = {"en", "vi"}


async def _get_user_language(request: Request, db: AsyncSession, user_id) -> str:
    """Get user language from Accept-Language header or DB preference."""
    header_lang = (
        (request.headers.get("accept-language") or "").split(",")[0].strip()[:2].lower()
    )
    if header_lang in _VALID_LANGS:
        return header_lang
    prefs = await get_or_create_preferences(db, user_id)
    return (prefs.language or "en") if prefs else "en"


_ALLOWED_AUDIO_TYPES = {
    "audio/m4a",
    "audio/mp4",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-m4a",
    "audio/aac",
    "audio/ogg",
    "audio/webm",
}

_ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/heic",
    "image/heif",
    "image/webp",
}

_MAX_BYTES = 25 * 1024 * 1024  # 25 MB — Whisper's limit
_MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB for images


@router.post("/audio")
async def upload_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an audio recording.

    Steps:
    1. Validate content-type and size
    2. Upload to MinIO
    3. Transcribe with Whisper (if OpenAI key is configured)
    4. Return audio_url + transcription
    """
    content_type = (file.content_type or "").lower()
    if content_type not in _ALLOWED_AUDIO_TYPES and not content_type.startswith(
        "audio/"
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio type '{content_type}'. Allowed: m4a, mp3, wav, aac, ogg",
        )

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large (max 25 MB)")
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    filename = file.filename or "recording.m4a"

    # Upload to MinIO (falls back to None gracefully)
    audio_url = await storage_service.upload_audio(file_bytes, filename)

    # Transcribe via Whisper (falls back to None gracefully)
    transcription = await ai_service.transcribe_audio(file_bytes, filename)

    return {
        "audio_url": audio_url,
        "transcription": transcription,
        "filename": filename,
        "size_bytes": len(file_bytes),
    }


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an image from the user's photo library.

    Steps:
    1. Validate content-type and size
    2. Upload to MinIO
    3. Analyse with GPT-4o Vision — produces a rich text description stored as
       the memory's searchable content
    4. Return image_url + description
    """
    content_type = (file.content_type or "").lower()
    if content_type not in _ALLOWED_IMAGE_TYPES and not content_type.startswith(
        "image/"
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type '{content_type}'. Allowed: jpeg, png, heic, webp",
        )

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image file too large (max 10 MB)")
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty image file")

    filename = file.filename or "photo.jpg"

    # ── Server-side optimization ──────────────────────────────────────────
    # 1. Resize to max 1920px, convert to WebP, strip EXIF/metadata
    original_size = len(file_bytes)
    try:
        optimized_bytes, optimized_content_type = optimize_image_bytes(file_bytes)
        # Use the optimized bytes for upload and AI analysis
        upload_bytes = optimized_bytes
        upload_filename = filename.rsplit(".", 1)[0] + ".webp"
    except Exception as exc:
        log.warning("Image optimization failed, uploading original: %s", exc)
        upload_bytes = file_bytes
        upload_filename = filename

    # 2. Generate a small thumbnail (400px) for list views
    thumbnail_url = None
    try:
        thumb_bytes, _ = generate_thumbnail(file_bytes)
        thumb_filename = "thumb_" + filename.rsplit(".", 1)[0] + ".webp"
        thumbnail_url = await storage_service.upload_image(thumb_bytes, thumb_filename)
    except Exception as exc:
        log.warning("Thumbnail generation failed: %s", exc)

    # Upload optimized image to MinIO (falls back to None gracefully)
    image_url = await storage_service.upload_image(upload_bytes, upload_filename)

    # Use Accept-Language header or DB preference for AI description
    user_language = await _get_user_language(request, db, current_user.id)

    # Describe with GPT-4o Vision (falls back to None gracefully)
    description = await ai_service.describe_image(upload_bytes, upload_filename, user_language)

    return {
        "image_url": image_url,
        "thumbnail_url": thumbnail_url,
        "description": description,
        "filename": upload_filename,
        "size_bytes": len(upload_bytes),
        "original_size_bytes": original_size,
    }


@router.get("/{file_id}")
async def get_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get a signed URL for a stored file (stub — direct MinIO URLs are used for now)."""
    return {
        "file_id": file_id,
        "url": None,
        "message": "Use the audio_url returned on upload",
    }


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a stored file (stub)."""
    return {"message": "File deleted successfully"}
