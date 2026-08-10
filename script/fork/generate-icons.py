#!/usr/bin/env python3
"""Regenerate the app icon assets from a single master PNG.

Fork-owned maintenance utility -- not part of the build. Run it by hand
whenever the master artwork changes:

    python script/fork/generate-icons.py

Inputs
    app/static/logos/app-icon.png   master artwork, square, RGBA

Outputs
    app/static/logos/prod/icon-logo.ico
    app/static/logos/prod/icon-logo-legacy.icns
    app/static/logos/dev/icon-logo.ico
    app/static/logos/dev/icon-logo-legacy.icns
    app/static/logos/win32-installer-splash.gif

The dev variant is the same artwork hue-rotated to amber so a development
build is obvious in the dock/taskbar next to a production one.

Requires Pillow (`pip install Pillow`). Deliberately Python rather than
TypeScript: the repo has no image library in its dependency tree, and adding
one for an asset step that runs a few times a year is not worth the install.

NOT generated here:
  - Assets.car and icon-logo.icon/ are Apple asset-catalog formats produced by
    Xcode's actool on macOS 26. They cannot be built on Windows or Linux. See
    docs/fork/ICONS.md.
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

ROOT = Path(__file__).resolve().parents[2]
LOGOS = ROOT / "app" / "static" / "logos"
SOURCE = LOGOS / "app-icon.png"

# Windows shows the icon everywhere from 16px (taskbar, title bar) to 256px
# (large icons in Explorer). Ship every size rather than letting Windows
# downscale 256 -> 16, which smears thin strokes badly.
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

# Pillow writes the standard ICNS ladder (16..512 at 1x and 2x) from a single
# 1024 master.
ICNS_MASTER = 1024

SPLASH_SIZE = (400, 400)

# Degrees of hue rotation applied to the dev variant. 230 turns the purple
# artwork teal -- unmistakably different from production at 16px, and it stays
# clean at small sizes where the intermediate hues go muddy olive.
DEV_HUE_SHIFT = 230


def hue_rotate(img: "Image.Image", degrees: int) -> "Image.Image":
    """Rotate hue while preserving the alpha channel.

    HSV in Pillow is 8-bit, so a degree offset has to be scaled to 0-255.
    Converting RGBA straight to HSV would discard alpha, hence the split.
    """
    rgb = img.convert("RGB")
    alpha = img.getchannel("A")

    h, s, v = rgb.convert("HSV").split()
    offset = round(degrees * 255 / 360)
    h = h.point(lambda p: (p + offset) % 256)

    out = Image.merge("HSV", (h, s, v)).convert("RGB").convert("RGBA")
    out.putalpha(alpha)
    return out


def write_ico(img: "Image.Image", dest: Path) -> None:
    img.save(dest, format="ICO", sizes=[(s, s) for s in ICO_SIZES])
    print(f"  {dest.relative_to(ROOT)}  ({len(ICO_SIZES)} sizes)")


def write_icns(img: "Image.Image", dest: Path) -> None:
    master = img.resize((ICNS_MASTER, ICNS_MASTER), Image.LANCZOS)
    master.save(dest, format="ICNS")
    print(f"  {dest.relative_to(ROOT)}  (upscaled to {ICNS_MASTER}px)")


def write_splash(img: "Image.Image", dest: Path) -> None:
    """Squirrel's install splash. Flattened onto white: it is displayed as a
    plain image with no compositing, so a transparent background renders as
    whatever garbage is behind it."""
    canvas = Image.new("RGBA", SPLASH_SIZE, (255, 255, 255, 255))
    inset = round(SPLASH_SIZE[0] * 0.72)
    art = img.resize((inset, inset), Image.LANCZOS)
    canvas.alpha_composite(
        art, ((SPLASH_SIZE[0] - inset) // 2, (SPLASH_SIZE[1] - inset) // 2)
    )
    canvas.convert("RGB").convert("P", palette=Image.ADAPTIVE).save(dest, format="GIF")
    print(f"  {dest.relative_to(ROOT)}  {SPLASH_SIZE[0]}x{SPLASH_SIZE[1]}")


def main() -> None:
    if not SOURCE.exists():
        sys.exit(f"Master artwork not found: {SOURCE}")

    src = Image.open(SOURCE).convert("RGBA")

    if src.width != src.height:
        sys.exit(f"Master artwork must be square, got {src.width}x{src.height}")

    if src.width < 512:
        print(
            f"warning: master is only {src.width}px. macOS icons are upscaled to "
            f"{ICNS_MASTER}px and will look soft. Supply a {ICNS_MASTER}px "
            f"master for a clean result.",
            file=sys.stderr,
        )

    variants = {
        "prod": src,
        "dev": hue_rotate(src, DEV_HUE_SHIFT),
    }

    for name, img in variants.items():
        out = LOGOS / name
        out.mkdir(parents=True, exist_ok=True)
        print(f"{name}:")
        write_ico(img, out / "icon-logo.ico")
        write_icns(img, out / "icon-logo-legacy.icns")

    print("shared:")
    write_splash(src, LOGOS / "win32-installer-splash.gif")


if __name__ == "__main__":
    main()
