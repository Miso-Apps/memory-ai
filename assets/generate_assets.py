#!/usr/bin/env python3
"""
generate_assets.py — Generate all required PNG / ICO / JPEG assets from SVG sources.

Requirements:
    pip install cairosvg pillow

Usage:
    cd /path/to/memory-ai
    python assets/generate_assets.py
"""

import io
import sys
from pathlib import Path

ASSETS_DIR = Path(__file__).parent.resolve()
ROOT_DIR = ASSETS_DIR.parent


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _require(package: str) -> object:
    try:
        return __import__(package)
    except ImportError:
        print(f"[error] '{package}' is not installed. Run:  pip install cairosvg pillow")
        sys.exit(1)


def _svg_to_png_bytes(svg_path: Path, width: int, height: int) -> bytes:
    import cairosvg
    return cairosvg.svg2png(url=str(svg_path), output_width=width, output_height=height)


def make_png(svg_path: Path, out: Path, w: int, h: int) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    data = _svg_to_png_bytes(svg_path, w, h)
    out.write_bytes(data)
    print(f"  ✓  {out.relative_to(ROOT_DIR)}  ({w}×{h})")


def make_ico(svg_path: Path, out: Path, sizes: list[int] = (16, 32, 48)) -> None:
    from PIL import Image
    out.parent.mkdir(parents=True, exist_ok=True)
    images = [
        Image.open(io.BytesIO(_svg_to_png_bytes(svg_path, s, s))).convert("RGBA")
        for s in sizes
    ]
    images[0].save(
        str(out), format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=images[1:],
    )
    print(f"  ✓  {out.relative_to(ROOT_DIR)}  ({', '.join(f'{s}px' for s in sizes)})")


def make_jpeg(svg_path: Path, out: Path, w: int, h: int, quality: int = 92) -> None:
    from PIL import Image
    out.parent.mkdir(parents=True, exist_ok=True)
    png_data = _svg_to_png_bytes(svg_path, w, h)
    img = Image.open(io.BytesIO(png_data)).convert("RGB")
    img.save(str(out), format="JPEG", quality=quality, optimize=True)
    print(f"  ✓  {out.relative_to(ROOT_DIR)}  ({w}×{h})")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    _require("cairosvg")
    _require("PIL")

    icon_svg   = ASSETS_DIR / "icon.svg"
    og_svg     = ASSETS_DIR / "og-image.svg"
    splash_svg = ASSETS_DIR / "splash.svg"

    for svg in (icon_svg,):
        if not svg.exists():
            print(f"[error] Missing required SVG: {svg}")
            sys.exit(1)

    print("\n📦  Generating DukiAI Memory brand assets ...\n")

    # ── Extension icons ──────────────────────────────────────────────────────
    print("🧩  Extension icons:")
    ext_dir = ROOT_DIR / "extension" / "icons"
    for size in (16, 32, 48, 128):
        make_png(icon_svg, ext_dir / f"icon{size}.png", size, size)

    # ── Landing page ─────────────────────────────────────────────────────────
    print("\n🌐  Landing page assets:")
    landing = ROOT_DIR / "landing"
    make_ico(icon_svg, landing / "favicon.ico")
    make_png(icon_svg, landing / "favicon-16x16.png",  16,  16)
    make_png(icon_svg, landing / "favicon-32x32.png",  32,  32)
    make_png(icon_svg, landing / "apple-touch-icon.png", 180, 180)
    make_png(icon_svg, landing / "logo.png", 512, 512)

    if og_svg.exists():
        landing_ss = landing / "screenshots"
        make_jpeg(og_svg, landing / "og-image.jpg",      1200, 630)
        make_jpeg(og_svg, landing / "twitter-image.jpg", 1200, 630)
        make_jpeg(og_svg, landing_ss / "app-preview.jpg", 1200, 630)
    else:
        print(f"  ⚠  og-image.svg not found — skipping og/twitter/screenshot images")

    # ── Mobile app assets ────────────────────────────────────────────────────
    print("\n📱  Mobile app assets:")
    mobile = ROOT_DIR / "mobile" / "assets"
    make_png(icon_svg, mobile / "icon.png",          1024, 1024)
    make_png(icon_svg, mobile / "adaptive-icon.png", 1024, 1024)
    make_png(icon_svg, mobile / "favicon.png",          48,   48)

    if splash_svg.exists():
        make_png(splash_svg, mobile / "splash.png", 1284, 2778)
    else:
        print(f"  ⚠  splash.svg not found — skipping splash.png")

    print("\n✅  All assets generated.\n")
    print("Next steps:")
    print("  • Verify generated PNGs look correct before deploying")
    print("  • Ensure mobile/app.json sets  splash.image = './assets/splash.png'")
    print("  • Deploy the landing/ folder with the new favicon files")


if __name__ == "__main__":
    main()
