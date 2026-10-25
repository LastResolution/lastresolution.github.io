"""Render the site's own vector/typographic brand assets; no input photos are used.

Optional development helper, requiring Pillow. Fonts come from known system-font
locations with a DejaVu fallback. Deployment uses the committed output directly.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ASSETS = Path(__file__).resolve().parent.parent / "assets"
FOREST, LIME, PAPER = "#153e30", "#d7ee80", "#f6f5ef"


def mark(size):
    """Rasterize the same monogram geometry used by mark.svg at the given size."""
    scale = 6
    image = Image.new("RGBA", (600, 600), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    box = lambda values: tuple(round(value * scale) for value in values)
    draw.rounded_rectangle(box((0, 0, 100, 100)), radius=22 * scale, fill=FOREST)
    draw.polygon([box(p) for p in [(22, 24), (32, 24), (32, 64), (46, 64), (46, 74), (22, 74)]], fill=LIME)
    draw.rectangle(box((51, 24, 61, 74)), fill=LIME)
    draw.polygon([box(p) for p in [(61, 48), (82, 74), (70, 74), (53, 52)]], fill=LIME)
    draw.rounded_rectangle(box((51, 24, 83, 56)), radius=16 * scale, fill=LIME)
    draw.rectangle(box((51, 24, 66, 56)), fill=LIME)
    draw.rounded_rectangle(box((59, 34, 73, 46)), radius=6 * scale, fill=FOREST)
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
    svg = (ASSETS / "mark.svg").read_text(encoding="utf-8")
    (ASSETS / "favicon.svg").write_text(svg, encoding="utf-8", newline="\n")
    mark(96).save(ASSETS / "favicon.png", optimize=True)
    mark(180).save(ASSETS / "apple-touch-icon.png", optimize=True)
    mark(256).save(ASSETS.parent / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    preview = Image.new("RGB", (1280, 640), PAPER)
    draw = ImageDraw.Draw(preview)
    preview.paste(mark(72), (64, 56), mark(72))
    draw.text((156, 68), "LastResolution", font=font(31, bold=True), fill=FOREST)
    draw.line((64, 158, 1216, 158), fill="#cbd1c5", width=2)
    draw.text((64, 195), "Ideas into", font=font(106, bold=True), fill=FOREST)
    draw.text((64, 309), "useful things.", font=font(108, italic=True), fill=FOREST)
    preview.paste(mark(260), (956, 207), mark(260))
    draw.text((64, 524), "Independent software. Room to explore.", font=font(27), fill=FOREST)
    draw.text((64, 576), "lastresolution.github.io", font=font(19), fill="#526257")
    preview.save(ASSETS / "social-preview.png", optimize=True)
    print("Rendered local brand assets and 1280 × 640 social preview.")
