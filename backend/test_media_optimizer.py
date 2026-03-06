"""
Tests for app.services.media_optimizer.

Run:
    cd backend && python -m pytest test_media_optimizer.py -v
"""

import io
import pytest
from PIL import Image

from app.services.media_optimizer import (
    optimize_image,
    generate_thumbnail,
    strip_exif,
    IMAGE_MAX_DIMENSION,
    THUMBNAIL_MAX_DIMENSION,
)


def _make_test_image(
    width: int = 3000,
    height: int = 2000,
    fmt: str = "JPEG",
    color: tuple = (100, 150, 200),
) -> bytes:
    """Create a synthetic solid-colour image and return as bytes."""
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format=fmt, quality=95)
    return buf.getvalue()


def _make_rgba_image(width: int = 800, height: int = 600) -> bytes:
    """Create an RGBA PNG to test alpha handling."""
    img = Image.new("RGBA", (width, height), (255, 0, 0, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestOptimizeImage:
    def test_reduces_file_size(self):
        original = _make_test_image(3000, 2000)
        optimized, content_type = optimize_image(original)

        assert len(optimized) < len(original), "Optimized should be smaller"
        assert content_type == "image/webp"

    def test_respects_max_dimension(self):
        original = _make_test_image(4000, 3000)
        optimized_bytes, _ = optimize_image(original, max_dimension=IMAGE_MAX_DIMENSION)

        img = Image.open(io.BytesIO(optimized_bytes))
        assert img.width <= IMAGE_MAX_DIMENSION
        assert img.height <= IMAGE_MAX_DIMENSION

    def test_does_not_upscale_small_images(self):
        original = _make_test_image(400, 300)
        optimized_bytes, _ = optimize_image(original)

        img = Image.open(io.BytesIO(optimized_bytes))
        # Should not have been enlarged
        assert img.width <= 400
        assert img.height <= 300

    def test_handles_rgba_png(self):
        original = _make_rgba_image()
        optimized_bytes, content_type = optimize_image(original)

        assert content_type == "image/webp"
        img = Image.open(io.BytesIO(optimized_bytes))
        assert img.mode == "RGB"  # alpha dropped

    def test_custom_quality_and_format(self):
        original = _make_test_image(800, 600)
        optimized_bytes, content_type = optimize_image(
            original, quality=50, output_format="JPEG"
        )
        assert content_type == "image/jpeg"

    def test_produces_valid_image(self):
        original = _make_test_image(2000, 1500)
        optimized_bytes, _ = optimize_image(original)

        img = Image.open(io.BytesIO(optimized_bytes))
        img.verify()  # raises if invalid


class TestGenerateThumbnail:
    def test_thumbnail_is_small(self):
        original = _make_test_image(3000, 2000)
        thumb_bytes, content_type = generate_thumbnail(original)

        img = Image.open(io.BytesIO(thumb_bytes))
        assert img.width <= THUMBNAIL_MAX_DIMENSION
        assert img.height <= THUMBNAIL_MAX_DIMENSION
        assert content_type == "image/webp"

    def test_thumbnail_is_smaller_than_optimized(self):
        original = _make_test_image(3000, 2000)
        optimized, _ = optimize_image(original)
        thumb, _ = generate_thumbnail(original)

        assert len(thumb) < len(optimized)


class TestStripExif:
    def test_strips_metadata(self):
        # Build image with some EXIF data
        img = Image.new("RGB", (200, 200), (50, 100, 150))
        from PIL.ExifTags import Base as ExifBase

        exif = img.getexif()
        exif[ExifBase.Make] = "TestCamera"
        exif[ExifBase.Model] = "TestModel"
        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif.tobytes())
        original = buf.getvalue()

        cleaned = strip_exif(original)
        cleaned_img = Image.open(io.BytesIO(cleaned))
        cleaned_exif = cleaned_img.getexif()

        assert ExifBase.Make not in cleaned_exif
        assert ExifBase.Model not in cleaned_exif

    def test_output_is_valid_jpeg(self):
        original = _make_test_image(200, 200)
        cleaned = strip_exif(original)
        img = Image.open(io.BytesIO(cleaned))
        assert img.format == "JPEG"
