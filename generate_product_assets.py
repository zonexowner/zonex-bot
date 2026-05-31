#!/usr/bin/env python3
"""Generate premium ZoneX Bot product images for the marketing site."""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "assets" / "product"
DASHBOARD = ROOT / "assets" / "ZoneX-dashboard-profit-en.png"

BG = (5, 5, 5)
BG_TOP = (8, 10, 9)
ACCENT = (0, 255, 127)
ACCENT_DIM = (0, 200, 100)
WHITE = (255, 255, 255)
WHITE_85 = (217, 217, 217)
WHITE_75 = (191, 191, 191)
WHITE_60 = (153, 153, 153)
WHITE_50 = (128, 128, 128)
MUTED = (156, 163, 175)  # #9ca3af
SUBTLE = (55, 58, 62)
BORDER = (255, 255, 255, 26)  # white/10
GLASS_FILL = (255, 255, 255, 8)  # white/3 on dark
GRID_STEP = 36
GRID_ALPHA = 10  # rgba(255,255,255,0.04)


def load_font(size: int, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if mono:
        candidates = [
            "/System/Library/Fonts/SFNSMono.ttf",
            "/System/Library/Fonts/Menlo.ttc",
            "/Library/Fonts/Courier New.ttf",
        ]
    elif bold:
        candidates = [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/System/Library/Fonts/HelveticaNeue.ttc",
            "/Library/Fonts/Arial Bold.ttf",
        ]
    else:
        candidates = [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/System/Library/Fonts/HelveticaNeue.ttc",
            "/Library/Fonts/Arial.ttf",
        ]
    for path in candidates:
        try:
            idx = 1 if bold and path.endswith(".ttc") else 0
            return ImageFont.truetype(path, size, index=idx)
        except OSError:
            continue
    return ImageFont.load_default()


def premium_canvas(w: int, h: int) -> Image.Image:
    """Obsidian gradient + film grain + soft vignette."""
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        for x in range(w):
            u = x / max(w - 1, 1)
            r = int(BG_TOP[0] + (BG[0] - BG_TOP[0]) * t + 3 * math.sin(u * 6.28) * (1 - t))
            g = int(BG_TOP[1] + (BG[1] - BG_TOP[1]) * t + 2 * math.cos(u * 4.2) * (1 - t))
            b = int(BG_TOP[2] + (BG[2] - BG_TOP[2]) * t)
            px[x, y] = (max(0, min(18, r)), max(0, min(18, g)), max(0, min(18, b)))

    rgba = img.convert("RGBA")
    noise = Image.new("RGBA", (w, h))
    npx = noise.load()
    rng = random.Random(42)
    for y in range(h):
        for x in range(w):
            v = rng.randint(0, 255)
            npx[x, y] = (v, v, v, rng.randint(6, 14))
    rgba = Image.alpha_composite(rgba, noise)

    vignette = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette)
    vd.ellipse([(-w * 0.15, -h * 0.2), (w * 1.15, h * 1.25)], fill=(0, 0, 0, 90))
    rgba = Image.alpha_composite(rgba, vignette)
    return rgba


def soft_glow(base: Image.Image, cx: int, cy: int, rx: int, ry: int, alpha: int = 18) -> Image.Image:
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([(cx - rx, cy - ry), (cx + rx, cy + ry)], fill=(*ACCENT, alpha))
    return Image.alpha_composite(base, glow.filter(ImageFilter.GaussianBlur(max(rx, ry) // 2)))


def site_canvas(w: int, h: int, grid: bool = True) -> Image.Image:
    """Match index.html: #050505 + 36px technical grid + light noise."""
    img = Image.new("RGBA", (w, h), (*BG, 255))
    if grid:
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        c = (255, 255, 255, GRID_ALPHA)
        for x in range(0, w, GRID_STEP):
            d.line([(x, 0), (x, h)], fill=c)
        for y in range(0, h, GRID_STEP):
            d.line([(0, y), (w, y)], fill=c)
        img = Image.alpha_composite(img, layer)

    noise = Image.new("RGBA", (w, h))
    npx = noise.load()
    rng = random.Random(7)
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            v = rng.randint(0, 255)
            npx[x, y] = (v, v, v, rng.randint(4, 10))
    return Image.alpha_composite(img, noise)


def site_glass_card(base: Image.Image, box, radius: int = 24) -> None:
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    panel = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(panel)
    pd.rounded_rectangle((0, 0, w, h), radius=radius, fill=GLASS_FILL)
    pd.rounded_rectangle((0, 0, w, h), radius=radius, outline=BORDER, width=1)
    base.paste(panel, (x0, y0), panel)


def tracked_upper(draw: ImageDraw.ImageDraw, xy, text: str, fill, size: int = 11) -> None:
    """Approximate Tailwind tracking-[0.25em] uppercase labels."""
    f = load_font(size)
    spaced = "  ".join(text.upper())
    draw.text(xy, spaced, fill=fill, font=f)


def subtle_grid(base: Image.Image, step: int = GRID_STEP, alpha: int = GRID_ALPHA) -> Image.Image:
    w, h = base.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    c = (255, 255, 255, alpha)
    for x in range(0, w, step):
        d.line([(x, 0), (x, h)], fill=c)
    for y in range(0, h, step):
        d.line([(0, y), (w, y)], fill=c)
    return Image.alpha_composite(base, layer)


def draw_site_emblem(base: Image.Image, cx: int, cy: int, box_size: int = 220) -> None:
    """Hero X emblem inside glass box — matches index.html SVG."""
    x0 = cx - box_size // 2
    y0 = cy - box_size // 2
    x1 = x0 + box_size
    y1 = y0 + box_size

    inner = Image.new("RGBA", (box_size, box_size), (0, 0, 0, 0))
    idraw = ImageDraw.Draw(inner)
    idraw.rounded_rectangle((0, 0, box_size, box_size), radius=16, fill=(0, 0, 0, 102))
    idraw.rounded_rectangle((0, 0, box_size, box_size), radius=16, outline=BORDER, width=1)

    grid = Image.new("RGBA", (box_size, box_size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    gc = (255, 255, 255, 8)
    for x in range(0, box_size, GRID_STEP):
        gd.line([(x, 0), (x, box_size)], fill=gc)
    for y in range(0, box_size, GRID_STEP):
        gd.line([(0, y), (box_size, y)], fill=gc)
    inner = Image.alpha_composite(inner, grid)

    pad = int(box_size * 0.25)
    s = (box_size - pad * 2) / 320.0
    ox, oy = pad, pad
    ed = ImageDraw.Draw(inner)
    # SVG: green thick diagonal, white thin diagonal, center dot
    ed.line(
        [(ox + 60 * s, oy + 60 * s), (ox + 260 * s, oy + 260 * s)],
        fill=ACCENT,
        width=max(3, int(24 * s)),
    )
    ed.line(
        [(ox + 260 * s, oy + 60 * s), (ox + 60 * s, oy + 260 * s)],
        fill=WHITE,
        width=max(2, int(10 * s)),
    )
    r = max(2, int(12 * s))
    mx, my = ox + 160 * s, oy + 160 * s
    ed.ellipse([(mx - r, my - r), (mx + r, my + r)], fill=ACCENT)

    base.paste(inner, (x0, y0), inner)


def draw_cta_button(draw: ImageDraw.ImageDraw, box, label: str) -> None:
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=8, fill=(0, 255, 127, 13), outline=(0, 255, 127, 128), width=1)
    f = load_font(13, mono=True)
    bbox = draw.textbbox((0, 0), label, font=f)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((x0 + (x1 - x0 - tw) // 2, y0 + (y1 - y0 - th) // 2 - 1), label, fill=ACCENT, font=f)


def draw_logo(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float = 1.0, accent_only: bool = False) -> None:
    s = scale
    w_main = max(2, int(5 * s))
    w_sub = max(1, int(2.5 * s))
    if not accent_only:
        draw.line([(cx - 22 * s, cy - 22 * s), (cx + 22 * s, cy + 22 * s)], fill=(255, 255, 255, 180), width=w_sub)
    draw.line([(cx + 22 * s, cy - 22 * s), (cx - 22 * s, cy + 22 * s)], fill=ACCENT, width=w_main)
    r = 3 * s
    draw.ellipse([(cx - r, cy - r), (cx + r, cy + r)], fill=ACCENT)


def glass_card(base: Image.Image, box, radius: int = 20, border_alpha: int = 28) -> None:
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    panel = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(panel)
    pd.rounded_rectangle((0, 0, w, h), radius=radius, fill=(255, 255, 255, 8))
    pd.rounded_rectangle((0, 0, w, h), radius=radius, outline=(255, 255, 255, border_alpha), width=1)
    base.paste(panel, (x0, y0), panel)


def caps_label(draw: ImageDraw.ImageDraw, xy, text: str, color=ACCENT_DIM, size: int = 11) -> None:
    f = load_font(size, mono=True)
    draw.text(xy, text.upper(), fill=color, font=f)


def fit_cover(img: Image.Image, w: int, h: int) -> Image.Image:
    iw, ih = img.size
    scale = max(w / iw, h / ih)
    nw, nh = int(iw * scale), int(ih * scale)
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - w) // 2
    top = (nh - h) // 2
    return resized.crop((left, top, left + w, top + h))


def save(img: Image.Image, name: str) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    if img.mode == "RGBA":
        img.convert("RGB").save(path, "PNG", optimize=True)
    else:
        img.save(path, "PNG", optimize=True)
    print(f"  ✓ {path.relative_to(ROOT)} ({img.size[0]}x{img.size[1]})")
    return path


def draw_accent_line(draw: ImageDraw.ImageDraw, x0: int, y0: int, x1: int, y1: int, width: int = 1) -> None:
    draw.line([(x0, y0), (x1, y1)], fill=(255, 255, 255, 35), width=width)


def license_card() -> None:
    """Matches index.html glass-card + checkout typography."""
    w, h = 672, 820
    img = site_canvas(w, h)
    draw = ImageDraw.Draw(img)

    card = (0, 0, w, h)
    site_glass_card(img, card, 24)
    draw = ImageDraw.Draw(img)

    pad = 32
    cx = w // 2

    # Hero emblem block (same as site hero left panel)
    draw_site_emblem(img, cx, pad + 118, 240)
    tracked_upper(draw, (cx - 95, pad + 248), "execution geometry", WHITE_50, 10)

    y = pad + 290
    tracked_upper(draw, (pad, y), "lifetime access package", ACCENT, 11)
    y += 28
    draw.text((pad, y), "LIFETIME TERMINAL ACCESS", fill=WHITE, font=load_font(26, True))
    y += 42
    draw.text((pad, y), "$200 USD equivalent", fill=ACCENT, font=load_font(32, True))

    y += 52
    draw.text((pad, y), "Access provisioning requires a valid partner", fill=WHITE_75, font=load_font(14))
    draw.text((pad, y + 20), "broker account ID for mandatory API bridge sync.", fill=WHITE_75, font=load_font(14))

    y += 58
    site_glass_card(img, (pad, y, w - pad, y + 148), 16)
    draw = ImageDraw.Draw(img)
    perks = [
        "MT5 Expert Advisor · XAUUSD only",
        "AI dashboard + pattern engine",
        "Crypto checkout · instant provisioning",
        "Remote license verify API",
    ]
    py = y + 20
    for p in perks:
        draw.ellipse([(pad + 18, py + 5), (pad + 26, py + 13)], fill=ACCENT)
        draw.text((pad + 36, py), p, fill=WHITE_85, font=load_font(13))
        py += 30

    y += 168
    draw_cta_button(draw, (pad, y, w - pad, y + 48), "INITIALIZE ACCESS TERMINAL")

    y += 64
    tracked_upper(draw, (pad, y), "@zonexowner", ACCENT_DIM, 10)

    save(img, "license-card.png")


def hero_terminal() -> None:
    w, h = 1600, 900
    img = premium_canvas(w, h)
    img = soft_glow(img, 1200, 300, 400, 300, 12)
    img = subtle_grid(img, 72, 4)
    draw = ImageDraw.Draw(img)

    glass_card(img, (64, 64, 580, 836), 28)
    draw = ImageDraw.Draw(img)

    caps_label(draw, (96, 96), "Institutional Release")
    draw.text((96, 118), "ZoneX Bot", fill=WHITE, font=load_font(44, True))
    draw.text((96, 172), "Quantitative XAUUSD execution for MT5.", fill=MUTED, font=load_font(17))

    points = [
        "Single-asset engine — gold order flow only",
        "Multi-timeframe confluence + AI pattern layer",
        "Dynamic risk scaling with drawdown guardrails",
    ]
    y = 230
    for p in points:
        draw.ellipse([(98, y + 7), (106, y + 15)], fill=ACCENT_DIM)
        draw.text((118, y), p, fill=(210, 212, 215), font=load_font(14))
        y += 36

    draw_accent_line(draw, 96, 360, 548, 360)
    draw.text((96, 382), "$200 lifetime license", fill=WHITE, font=load_font(22, True))
    draw.text((96, 414), "Partner broker required · @zonexowner", fill=SUBTLE, font=load_font(13, mono=True))

    # terminal frame
    fx, fy, fw, fh = 640, 72, 896, 828
    glass_card(img, (fx, fy, fx + fw, fy + fh), 16, 40)
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((fx, fy, fx + fw, fy + 36), radius=16, fill=(10, 11, 10))
    caps_label(draw, (fx + 20, fy + 11), "MetaTrader 5 · XAUUSD · M1", SUBTLE, 10)

    if DASHBOARD.exists():
        shot = fit_cover(Image.open(DASHBOARD).convert("RGB"), fw - 32, fh - 52)
        # subtle inner shadow via border
        img.paste(shot, (fx + 16, fy + 44))

    save(img, "hero-terminal.png")


def og_social() -> None:
    w, h = 1200, 630
    img = premium_canvas(w, h)
    img = soft_glow(img, 950, 280, 350, 280, 16)
    img = subtle_grid(img, 80, 4)
    draw = ImageDraw.Draw(img)

    draw_logo(draw, 120, 300, 1.6)
    caps_label(draw, (180, 230), "ZoneX Bot")
    draw.text((180, 252), "Institutional\nXAUUSD Algorithm", fill=WHITE, font=load_font(52, True))
    draw.text((180, 380), "$200 lifetime  ·  MT5 terminal  ·  @zonexowner", fill=MUTED, font=load_font(17))

    if DASHBOARD.exists():
        glass_card(img, (680, 100, 1140, 530), 16)
        shot = fit_cover(Image.open(DASHBOARD), 440, 410)
        img.paste(shot, (690, 110))

    save(img, "og-social.png")


def feature_card(name: str, index: str, title: str, body: str, variant: str) -> None:
    w, h = 800, 480
    img = premium_canvas(w, h)
    img = soft_glow(img, w // 2, h - 80, 320, 120, 10)
    draw = ImageDraw.Draw(img)
    glass_card(img, (32, 32, w - 32, h - 32), 20)
    draw = ImageDraw.Draw(img)

    caps_label(draw, (56, 56), index)
    draw.text((56, 78), title, fill=WHITE, font=load_font(28, True))
    draw.text((56, 118), body, fill=MUTED, font=load_font(14))

    viz = (56, 200, w - 56, h - 56)
    draw.rounded_rectangle(viz, radius=14, fill=(255, 255, 255, 6), outline=(255, 255, 255, 20))

    vx0, vy0, vx1, vy1 = viz
    if variant == "broker":
        labels = ["Broker", "Liquidity", "API Bridge", "ZoneX EA"]
        gap = (vx1 - vx0 - 80) // len(labels)
        for i, lb in enumerate(labels):
            bx = vx0 + 40 + i * gap
            draw.rounded_rectangle((bx, vy0 + 50, bx + gap - 24, vy0 + 130), radius=8, fill=(255, 255, 255, 8), outline=(255, 255, 255, 25))
            draw.text((bx + 14, vy0 + 82), lb, fill=WHITE, font=load_font(11, True))
            if i < len(labels) - 1:
                mx = bx + gap - 12
                draw.line([(mx, vy0 + 90), (mx + 16, vy0 + 90)], fill=ACCENT_DIM, width=1)
    elif variant == "risk":
        pts = []
        for i in range(8):
            px = vx0 + 40 + i * ((vx1 - vx0 - 80) // 7)
            py = vy0 + 140 - int(35 + 25 * math.sin(i * 0.9 + 0.5))
            pts.append((px, py))
        draw.line(pts, fill=ACCENT, width=2)
        draw.line([(vx0 + 40, vy0 + 145), (vx1 - 40, vy0 + 145)], fill=(255, 255, 255, 30))
        caps_label(draw, (vx0 + 40, vy0 + 28), "Drawdown shield active", ACCENT_DIM, 10)
    else:
        for row in range(3):
            y = vy0 + 36 + row * 44
            draw.rounded_rectangle((vx0 + 28, y, vx1 - 28, y + 28), radius=6, fill=(8, 9, 8))
            fill_w = int((vx1 - vx0 - 56) * (0.45 + row * 0.18))
            draw.rounded_rectangle((vx0 + 28, y, vx0 + 28 + fill_w, y + 28), radius=6, fill=(0, 255, 127, 35))
            draw.text((vx0 + 40, y + 6), f"XAUUSD route · 0.{row + 2}ms latency", fill=MUTED, font=load_font(11, mono=True))

    save(img, name)


def xauusd_focus() -> None:
    w, h = 960, 480
    img = premium_canvas(w, h)
    img = soft_glow(img, w // 2, h // 2 + 40, 200, 160, 12)
    draw = ImageDraw.Draw(img)
    glass_card(img, (40, 40, w - 40, h - 40), 20)
    draw = ImageDraw.Draw(img)

    caps_label(draw, (72, 72), "Monotarget Telemetry")
    draw.text((72, 94), "XAUUSD Only", fill=WHITE, font=load_font(36, True))
    draw.text((72, 142), "Gold execution with zero cross-pair drift.", fill=MUTED, font=load_font(15))

    # minimal price line chart
    cx, cy = 520, 280
    pts = []
    for i in range(40):
        px = cx - 180 + i * 9
        py = cy + 30 - int(50 * math.sin(i * 0.22) + i * 1.2)
        pts.append((px, py))
    draw.line(pts, fill=ACCENT, width=2)
    draw.text((cx - 40, cy - 70), "4449.09", fill=WHITE, font=load_font(32, True))
    caps_label(draw, (cx - 36, cy - 38), "XAUUSD spot", SUBTLE, 10)

    draw.rounded_rectangle((72, h - 100, w - 72, h - 56), radius=10, fill=(255, 255, 255, 6), outline=(255, 255, 255, 18))
    draw.text((92, h - 84), "Other symbols blocked at engine level.", fill=SUBTLE, font=load_font(13))
    save(img, "xauusd-focus.png")


def dashboard_closeup() -> None:
    if not DASHBOARD.exists():
        return
    # Use full profit dashboard screenshot (same as site hero source of truth)
    src = Image.open(DASHBOARD).convert("RGB")
    w, h = 1000, 560
    img = premium_canvas(w, h)
    draw = ImageDraw.Draw(img)
    glass_card(img, (32, 32, w - 32, h - 32), 18)
    inner = src.resize((w - 80, h - 96), Image.Resampling.LANCZOS)
    img.paste(inner, (40, 44))
    draw = ImageDraw.Draw(img)
    caps_label(draw, (40, h - 44), "MT5 dashboard · UI preview", SUBTLE, 10)
    save(img, "dashboard-closeup.png")


def architecture_diagram() -> None:
    w, h = 1200, 560
    img = premium_canvas(w, h)
    draw = ImageDraw.Draw(img)
    glass_card(img, (40, 40, w - 40, h - 40), 20)
    draw = ImageDraw.Draw(img)

    caps_label(draw, (72, 68), "Algorithmic Architecture")
    draw.text((72, 88), "Signal path from tick to execution", fill=MUTED, font=load_font(14))

    nodes = [
        (100, 260, "Market Data", "XAUUSD M1"),
        (310, 180, "MTF Layer", "H1 · H4"),
        (310, 340, "AI Patterns", "Memory matrix"),
        (530, 260, "Risk Engine", "Dynamic size"),
        (760, 260, "Execution", "ZoneX Bot"),
    ]
    for i, (x, y, t1, t2) in enumerate(nodes):
        box = (x, y, x + 170, y + 78)
        highlight = i in (2, 4)
        draw.rounded_rectangle(box, radius=12, fill=(255, 255, 255, 10 if highlight else 5), outline=(0, 255, 127, 80 if highlight else 30))
        draw.text((x + 16, y + 16), t1, fill=WHITE, font=load_font(13, True))
        draw.text((x + 16, y + 40), t2, fill=SUBTLE, font=load_font(11, mono=True))

    links = [(270, 299, 310, 219), (270, 299, 310, 379), (480, 219, 530, 299), (480, 379, 530, 299), (700, 299, 760, 299)]
    for x1, y1, x2, y2 in links:
        draw.line([(x1, y1), (x2, y2)], fill=(0, 255, 127, 120), width=1)
    save(img, "architecture-diagram.png")


def checkout_preview() -> None:
    w, h = 900, 540
    img = premium_canvas(w, h)
    draw = ImageDraw.Draw(img)
    glass_card(img, (48, 48, w - 48, h - 48), 22)
    draw = ImageDraw.Draw(img)

    caps_label(draw, (80, 80), "Access Terminal")
    draw.text((80, 102), "Initialize lifetime license", fill=WHITE, font=load_font(26, True))
    draw.text((80, 140), "Secure crypto checkout · instant provisioning", fill=MUTED, font=load_font(14))

    fields = ["Email address", "Partner broker account ID", "MT5 login number"]
    y = 190
    for f in fields:
        draw.rounded_rectangle((80, y, w - 80, y + 46), radius=10, fill=(255, 255, 255, 5), outline=(255, 255, 255, 22))
        draw.text((98, y + 14), f, fill=SUBTLE, font=load_font(13))
        y += 58

    draw.rounded_rectangle((80, y + 8, w - 80, y + 58), radius=12, fill=(0, 255, 127, 18), outline=(0, 255, 127, 90))
    draw.text((280, y + 26), "Confirm $200 lifetime access", fill=WHITE, font=load_font(14, True))
    save(img, "checkout-preview.png")


def main() -> None:
    print("Generating premium ZoneX Bot product images...")
    if not DASHBOARD.exists():
        print(f"  ⚠ Dashboard source missing: {DASHBOARD}")

    license_card()
    hero_terminal()
    og_social()
    feature_card("feature-broker.png", "01 / Sync", "Partner Broker Bridge", "Isolated liquidity routing with mandatory API alignment.", "broker")
    feature_card("feature-risk.png", "02 / Risk", "Drawdown Protection", "Position size scales with volatility and live equity drawdown.", "risk")
    feature_card("feature-execution.png", "03 / Exec", "Low-Latency Routing", "Tick path optimized for XAUUSD microstructure.", "execution")
    xauusd_focus()
    dashboard_closeup()
    architecture_diagram()
    checkout_preview()
    print(f"\nDone — {len(list(OUT.glob('*.png')))} files in assets/product/")


if __name__ == "__main__":
    main()
