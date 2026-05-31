import os
from PIL import Image, ImageDraw, ImageFont


def load_brand_fonts():
    title_candidates = [
        "Inter-Bold.ttf",
        "Montserrat-Bold.ttf",
        os.path.join("fonts", "Inter-Bold.ttf"),
        os.path.join("fonts", "Montserrat-Bold.ttf"),
    ]
    sub_candidates = [
        "Inter-Regular.ttf",
        "Montserrat-Regular.ttf",
        os.path.join("fonts", "Inter-Regular.ttf"),
        os.path.join("fonts", "Montserrat-Regular.ttf"),
    ]

    def load_first_existing(candidates, size):
        for path in candidates:
            if os.path.exists(path):
                return ImageFont.truetype(path, size), path
        return ImageFont.load_default(), None

    font_title, title_path = load_first_existing(title_candidates, 64)
    font_sub, sub_path = load_first_existing(sub_candidates, 24)
    return font_title, font_sub, title_path, sub_path


def create_zonex_assets():
    print("Initiating ZoneX Bot asset generation...")

    # Design system tokens
    color_bg = (5, 5, 5)          # Deep Obsidian (#050505)
    color_accent = (0, 255, 127)  # Emerald Green (#00FF7F)
    color_text = (255, 255, 255)  # Pure White
    color_muted = (150, 150, 150) # Slate Gray

    # Ensure output directory exists
    os.makedirs("dist", exist_ok=True)

    # 1) Telegram avatar (512x512)
    avatar = Image.new("RGB", (512, 512), color_bg)
    draw_av = ImageDraw.Draw(avatar)
    draw_av.line([(160, 160), (352, 352)], fill=color_accent, width=24)
    draw_av.line([(352, 160), (160, 352)], fill=color_text, width=12)
    draw_av.ellipse([(244, 244), (268, 268)], fill=color_accent)
    avatar.save("dist/avatar.png", "PNG")
    print("Created: dist/avatar.png")

    # 2) Channel banner (1280x720)
    banner = Image.new("RGB", (1280, 720), color_bg)
    draw_ba = ImageDraw.Draw(banner)

    for x in range(0, 1280, 80):
        draw_ba.line([(x, 0), (x, 720)], fill=(15, 15, 15), width=1)
    for y in range(0, 720, 80):
        draw_ba.line([(0, y), (1280, y)], fill=(15, 15, 15), width=1)

    draw_ba.line([(180, 310), (280, 410)], fill=color_accent, width=14)
    draw_ba.line([(280, 310), (180, 410)], fill=color_text, width=7)
    draw_ba.ellipse([(223, 353), (237, 367)], fill=color_accent)

    font_title, font_sub, title_path, sub_path = load_brand_fonts()
    if title_path and sub_path:
        print(f"Using custom fonts: {title_path}, {sub_path}")
    else:
        print(
            "Custom fonts not found. Add Inter/Montserrat .ttf files in project root "
            "or ./fonts to use premium typography."
        )

    draw_ba.text((340, 315), "ZONEX BOT", fill=color_text, font=font_title)
    draw_ba.text(
        (345, 395),
        "QUANT DESIGNED. ALGORITHMIC EXECUTION.",
        fill=color_muted,
        font=font_sub,
    )
    banner.save("dist/banner.png", "PNG")
    print("Created: dist/banner.png")

    # 3) Favicon (32x32)
    favicon = Image.new("RGB", (32, 32), color_bg)
    draw_fa = ImageDraw.Draw(favicon)
    draw_fa.line([(8, 8), (24, 24)], fill=color_accent, width=3)
    draw_fa.line([(24, 8), (8, 24)], fill=color_text, width=2)
    favicon.save("dist/favicon.png", "PNG")
    print("Created: dist/favicon.png")

    print("Branding package compiled successfully in ./dist.")


if __name__ == "__main__":
    create_zonex_assets()
