"""
Media optimizer — production-grade server-side image processing.

Responsibilities:
  * Resize images to a max dimension (default 1920 px)
  * Convert to WebP for ~30-50 % smaller files vs JPEG at equal quality
  * Strip EXIF / metadata for user privacy
  * Generate thumbnails for list views (default 400 px)
  * Enforce size limits

Audio files are NOT re-encoded server-side — the mobile client already
records in AAC 64 kbps mono, and Whisper accepts them as-is.
"""

from __future__ import annotations

import io
import logging
from typing import Optional

log = logging.getLogger(__name__)

# ─── Defaults ─────────────────────────────────────────────────────────────────

IMAGE_MAX_DIMENSION = 1920
IMAGE_QUALITY = 80          # 0-100, WebP scale
THUMBNAIL_MAX_DIMENSION = 400
THUMBNAIL_QUALITY = 70


def optimize_image(
    file_bytes: bytes,
    *,
    max_dimension: int = IMAGE_MAX_DIMENSION,
    quality: int = IMAGE_QUALITY,
    output_format: str = "WEBP",
) -> tuple[bytes, str]:
    """
    Resize, strip metadata, and convert an image to WebP.

    Returns
    -------
    (optimized_bytes, content_type)
    """
    from PIL import Image, ExifTags  # noqa: F811

    img = Image.open(io.BytesIO(file_bytes))

    # Convert palette / RGBA → RGB for WebP compat (drop alpha for photos)
    if img.mode in ("RGBA", "P", "LA"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        background.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
        img = background
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Auto-rotate based on EXIF orientation, then strip all EXIF
    try:
        img = _apply_exif_orientation(img)
    except Exception:
        pass  # best-effort

    # Resize (aspect-ratio preserved) only if larger than max_dimension
    img.thumbnail((max_dimension, max_dimension), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format=output_format, quality=quality, method=4)
    optimized = buf.getvalue()

    content_type = f"image/{output_format.lower()}"
    log.info(
        "Image optimized: %d → %d bytes (%.0f%% reduction), %dx%d, %s",
        len(file_bytes),
        len(optimized),
        (1 - len(optimized) / max(len(file_bytes), 1)) * 100,
        img.width,
        img.height,
        content_type,
    )
    return optimized, content_type


def generate_thumbnail(
    file_bytes: bytes,
    *,
    max_dimension: int = THUMBNAIL_MAX_DIMENSION,
    quality: int = THUMBNAIL_QUALITY,
    output_format: str = "WEBP",
) -> tuple[bytes, str]:
    """
    Generate a small thumbnail from image bytes.

    Returns
    -------
    (thumb_bytes, content_type)
    """
    return optimize_image(
        file_bytes,
        max_dimension=max_dimension,
        quality=quality,
        output_format=output_format,
    )


def strip_exif(file_bytes: bytes) -> bytes:
    """
    Remove all EXIF / metadata from image bytes and return clean JPEG.

    Useful as a standalone privacy step when full optimisation isn't needed.
    """
    from PIL import Image

    img = Image.open(io.BytesIO(file_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")
    try:
        img = _apply_exif_orientation(img)
    except Exception:
        pass
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def _apply_exif_orientation(img: "Image.Image") -> "Image.Image":
    """Auto-rotate based on EXIF orientation tag, then drop EXIF."""
    from PIL import ExifTags

    try:
        exif = img.getexif()
        orientation_key = next(
            k for k, v in ExifTags.TAGS.items() if v == "Orientation"
        )
        orientation = exif.get(orientation_key)
        rotations = {
            3: Image.Transpose.ROTATE_180,
            6: Image.Transpose.ROTATE_270,
            8: Image.Transpose.ROTATE_90,
        }
        if orientation in rotations:
            img = img.transpose(rotations[orientation])
    except (StopIteration, KeyError, AttributeError):
        pass
    return img
