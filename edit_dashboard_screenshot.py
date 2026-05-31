#!/usr/bin/env python3
"""Redraw ZoneX MT5 dashboard overlay with profitable English metrics."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SRC = Path(
    "/Users/eimantas/.cursor/projects/Users-eimantas-Downloads/assets/"
    "Screenshot_2026-05-28_at_20.48.56-034fc785-b598-4fa1-a3f7-43cac25a5045.png"
)
OUT = Path(__file__).resolve().parent / "assets" / "ZoneX-dashboard-profit-en.png"
CURSOR_COPY = SRC


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in ("/System/Library/Fonts/Menlo.ttc", "/Library/Fonts/Courier New.ttf"):
        try:
            return ImageFont.truetype(path, size, index=1 if bold else 0)
        except OSError:
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def draw_panel(draw: ImageDraw.ImageDraw, lx: int, rx: int) -> None:
    accent = (0, 255, 127)
    row = (200, 200, 200)
    muted = (140, 140, 140)

    f12b = load_font(12, True)
    f9 = load_font(9)

    draw.text((lx, 18), "ZoneX Bot", fill=accent, font=f12b)
    draw.text((lx, 40), "by @zonexowner  #25356015", fill=muted, font=f9)

    rows_left = [
        ("Daily P/L: ", "+1,247.83", accent),
        ("Session: ", "+892.45", accent),
        ("Floating: ", "+312.68", accent),
        ("Win: ", "12/18 (66.7%)", row),
        ("DD: ", "0.42%  Max: 1.20%  [#.........]", muted),
        ("Signals: ", "8 / 8 (BUY READY)", accent),
        ("Regime: ", "UPTREND/BULLISH  MTF: 90.2%", muted),
    ]
    rows_right = [
        ("Balance: ", "10,240.00", row),
        ("Equity: ", "11,552.68", row),
        ("Positions: ", "2", row),
        ("Risk: ", "0.27%  0.00/3.00%", row),
    ]

    y = 74
    for label, val, val_color in rows_left:
        draw.text((lx, y), label, fill=row, font=f9)
        bbox = draw.textbbox((0, 0), label, font=f9)
        draw.text((lx + bbox[2] - bbox[0], y), val, fill=val_color, font=f9)
        y += 22

    y = 74
    for label, val, val_color in rows_right:
        draw.text((rx, y), label, fill=row, font=f9)
        bbox = draw.textbbox((0, 0), label, font=f9)
        draw.text((rx + bbox[2] - bbox[0], y), val, fill=val_color, font=f9)
        y += 22

    bar_y = 248
    draw.rectangle((lx, bar_y, lx + 310, bar_y + 5), fill=(40, 40, 40))
    draw.rectangle((lx, bar_y, lx + 52, bar_y + 5), fill=accent)


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Source screenshot not found: {SRC}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(SRC).convert("RGBA")
    draw = ImageDraw.Draw(img)

    panel = (14, 10, 401, 281)
    border = (0, 200, 100)
    draw.rectangle(panel, fill=(15, 15, 15, 255))
    draw.rectangle(panel, outline=border, width=2)
    draw.line([(28, 64), (385, 64)], fill=(40, 40, 40), width=1)

    draw_panel(draw, lx=28, rx=220)

    result = img.convert("RGB")
    result.save(OUT, quality=95)
    result.save(CURSOR_COPY, quality=95)
    print(f"Saved {OUT}")
    print(f"Updated {CURSOR_COPY}")


if __name__ == "__main__":
    main()
