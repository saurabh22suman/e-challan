#!/usr/bin/env python3
"""Rebuild the transparent marshal-character WebP derivatives.

Originals in assets/ are never modified. The welcome asset keeps the full body;
the five compact states are waist-up crops that preserve the face, hands and the
identifying prop. Requires Pillow (PIL) only. Run from the repository root:

    python3 tools/prepare-character-assets.py
"""

from pathlib import Path

from PIL import Image

SRC = Path("assets")
OUT = Path("apps/tablet/public/characters")

STATES = {
    "welcome-full": ("Friendly Hi-Vis Safety Worker Mascot.png", (100, 0, 1066, 1254), 640),
    "check-details": ("Friendly Safety Inspector with Checklist.png", (330, 0, 1060, 830), 480),
    "processing": ("Safety Inspector with Clipboard.png", (300, 0, 1020, 830), 480),
    "success": ("Cheerful Construction Worker Thumbs Up.png", (300, 0, 1010, 810), 480),
    "error": ("Concerned Safety Inspector Explaining.png", (280, 0, 1140, 830), 480),
    "connection": ("Confused Technician with Tablet.png", (250, 0, 1080, 830), 480),
}

MARGIN = 0.94
WELCOME_MARGIN = 0.96


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (filename, box, size) in STATES.items():
        crop = Image.open(SRC / filename).convert("RGBA").crop(box)
        margin = WELCOME_MARGIN if name == "welcome-full" else MARGIN
        scale = (size * margin) / max(crop.width, crop.height)
        resized = crop.resize(
            (round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS
        )
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        canvas.alpha_composite(
            resized, ((size - resized.width) // 2, (size - resized.height) // 2)
        )
        target = OUT / f"{name}.webp"
        canvas.save(target, "WEBP", quality=82, alpha_quality=92, method=6)
        print(f"{target}: {canvas.width}x{canvas.height} {target.stat().st_size} B")


if __name__ == "__main__":
    main()
