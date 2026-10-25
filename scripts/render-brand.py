"""Render favicon and social derivatives of the supplied public profile artwork.

Optional development helper, requiring Pillow. Fonts come from known system-font
locations with a DejaVu fallback. Deployment uses the committed output directly.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ASSETS = Path(__file__).resolve().parent.parent / "assets"
INK, PAPER = "#1c3345", "#f4f6f8"


def mark(size):
    """Resize the public avatar while preserving its aspect ratio and transparency."""
    with Image.open(ASSETS / "avatar.png") as source:
        if source.width != source.height:
            raise ValueError("Profile artwork must be square; cropping is not automatic.")
        image = source.convert("RGBA")
        image.info.clear()
    return image.resize((size, size), Image.Resampling.LANCZOS)


def font(size, bold=False, italic=False):
    """Load a system font for the static social preview, without network access."""
    candidates = (["C:/Windows/Fonts/georgiai.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf"] if italic else
                  ["C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
                   "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"])
    for filename in candidates:
        if Path(filename).is_file():
            return ImageFont.truetype(filename, size)
    raise RuntimeError("A supported system font is required to render the social preview.")


if __name__ == "__main__":
    ASSETS.mkdir(exist_ok=True)
    mark(96).save(ASSETS / "favicon.png", optimize=True)
    mark(180).save(ASSETS / "apple-touch-icon.png", optimize=True)
    mark(256).save(ASSETS.parent / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    preview = Image.new("RGB", (1280, 640), PAPER)
    draw = ImageDraw.Draw(preview)
    preview.paste(mark(72), (64, 56), mark(72))
    draw.text((156, 68), "LastResolution", font=font(31, bold=True), fill=INK)
    draw.line((64, 158, 1216, 158), fill="#ccd6df", width=2)
    draw.text((64, 195), "Ideas into", font=font(106, bold=True), fill=INK)
    draw.text((64, 309), "useful things.", font=font(108, italic=True), fill=INK)
    preview.paste(mark(260), (956, 207), mark(260))
    draw.text((64, 524), "Independent software. Room to explore.", font=font(27), fill=INK)
    draw.text((64, 576), "lastresolution.github.io", font=font(19), fill="#526579")
    preview.save(ASSETS / "social-preview.png", optimize=True)
    print("Rendered local brand assets and 1280 × 640 social preview.")
