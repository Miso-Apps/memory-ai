"""
Storage service — uploads files to MinIO / S3-compatible storage.
Gracefully degrades if MinIO is unreachable.
"""

from __future__ import annotations

import io
import logging
import uuid
from typing import Optional

log = logging.getLogger(__name__)


def _get_client():
    """Build a synchronous boto3 S3 client pointed at MinIO."""
    import boto3
    from botocore.config import Config
    from app.config import settings

    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
        config=Config(signature_version="s3v4"),
    )


def _ensure_bucket(client, bucket: str) -> None:
    """Create bucket if it doesn't exist yet."""
    try:
        client.head_bucket(Bucket=bucket)
    except Exception:
        try:
            client.create_bucket(Bucket=bucket)
            log.info("Created MinIO bucket: %s", bucket)
        except Exception as exc:
            log.warning("Could not create bucket %s: %s", bucket, exc)


async def upload_audio(file_bytes: bytes, original_filename: str) -> Optional[str]:
    """
    Upload audio bytes to MinIO and return the public URL.

    Returns None if MinIO is unavailable.
    """
    try:
        import asyncio
        from app.config import settings

        ext = (
            original_filename.rsplit(".", 1)[-1] if "." in original_filename else "m4a"
        )
        key = f"audio/{uuid.uuid4()}.{ext}"

        def _upload():
            client = _get_client()
            _ensure_bucket(client, settings.S3_BUCKET)
            client.put_object(
                Bucket=settings.S3_BUCKET,
                Key=key,
                Body=io.BytesIO(file_bytes),
                ContentType=f"audio/{ext}",
            )
            # Build a publicly accessible URL
            endpoint = settings.S3_ENDPOINT.rstrip("/")
            return f"{endpoint}/{settings.S3_BUCKET}/{key}"

        url = await asyncio.get_event_loop().run_in_executor(None, _upload)
        log.info("Uploaded audio to MinIO: %s", url)
        return url
    except Exception as exc:
        log.warning("MinIO upload failed: %s", exc)
        return None


async def upload_image(file_bytes: bytes, original_filename: str) -> Optional[str]:
    """
    Upload image bytes to MinIO and return the public URL.

    Returns None if MinIO is unavailable.
    """
    try:
        import asyncio
        from app.config import settings

        ext = (
            original_filename.rsplit(".", 1)[-1] if "." in original_filename else "jpg"
        )
        content_type_map = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "heic": "image/heic",
            "heif": "image/heif",
            "webp": "image/webp",
        }
        content_type = content_type_map.get(ext.lower(), "image/jpeg")
        key = f"images/{uuid.uuid4()}.{ext}"

        def _upload():
            client = _get_client()
            _ensure_bucket(client, settings.S3_BUCKET)
            client.put_object(
                Bucket=settings.S3_BUCKET,
                Key=key,
                Body=io.BytesIO(file_bytes),
                ContentType=content_type,
            )
            endpoint = settings.S3_ENDPOINT.rstrip("/")
            return f"{endpoint}/{settings.S3_BUCKET}/{key}"

        url = await asyncio.get_event_loop().run_in_executor(None, _upload)
        log.info("Uploaded image to MinIO: %s", url)
        return url
    except Exception as exc:
        log.warning("MinIO image upload failed: %s", exc)
        return None
