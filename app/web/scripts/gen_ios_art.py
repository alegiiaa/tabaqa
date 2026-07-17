# Tabaqa iOS art: 1024 app icon + 2732 splash (light-burst, echoing tabaqa.gif)
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

MARK = "/Users/ilyasmalghamdi/Documents/amd_hackathon/tabaqa/app/web/public/tabaqa-mark-white.png"
OUT_ICON = "/Users/ilyasmalghamdi/Documents/amd_hackathon/tabaqa/app/web/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
SPLASH_DIR = "/Users/ilyasmalghamdi/Documents/amd_hackathon/tabaqa/app/web/ios/App/App/Assets.xcassets/Splash.imageset"

mark = Image.open(MARK).convert("RGBA")


def radial(size, center_rgb, edge_rgb, cx=0.5, cy=0.5, power=1.35):
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    dx, dy = xx - size * cx, yy - size * cy
    r = np.sqrt(dx * dx + dy * dy) / (size * 0.72)
    r = np.clip(r, 0, 1) ** power
    c = np.array(center_rgb, np.float32)
    e = np.array(edge_rgb, np.float32)
    img = (c[None, None, :] * (1 - r[..., None]) + e[None, None, :] * r[..., None])
    return Image.fromarray(img.astype(np.uint8), "RGB")


def paste_mark(base, width, cy_offset=0, shadow=True):
    m = mark.resize((width, int(width * mark.height / mark.width)), Image.LANCZOS)
    x = (base.width - m.width) // 2
    y = (base.height - m.height) // 2 + cy_offset
    if shadow:
        sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
        alpha = m.split()[3].point(lambda a: int(a * 0.35))
        black = Image.new("RGBA", m.size, (3, 10, 32, 255))
        black.putalpha(alpha)
        sh.paste(black, (x, y + max(6, width // 60)), black)
        base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(width // 34)))
    base.alpha_composite(m, (x, y))
    return base


# ── app icon — 1024, royal-blue radial, white mark, no alpha ─────────────────
icon = radial(1024, (41, 98, 245), (16, 45, 150), cx=0.38, cy=0.30, power=1.15).convert("RGBA")
glow = Image.new("RGBA", icon.size, (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([512 - 430, 512 - 430, 512 + 430, 512 + 430], fill=(120, 175, 255, 42))
icon.alpha_composite(glow.filter(ImageFilter.GaussianBlur(130)))
icon = paste_mark(icon, 560)
icon.convert("RGB").save(OUT_ICON, "PNG")
print("icon →", OUT_ICON)

# ── splash — 2732², deep-blue burst + mark + wordmark ────────────────────────
S = 2732
sp = radial(S, (25, 68, 205), (6, 16, 46), power=1.5).convert("RGBA")

# the light burst — radial rays converging on the mark (the gif's energy, stilled)
rays = Image.new("RGBA", (S, S), (0, 0, 0, 0))
rd = ImageDraw.Draw(rays)
rng = np.random.default_rng(7)
for i in range(190):
    a = rng.uniform(0, 2 * math.pi)
    r0 = rng.uniform(430, 640)
    r1 = rng.uniform(1250, 2050)
    w = int(rng.uniform(3, 10))
    al = int(rng.uniform(26, 74))
    x0, y0 = S / 2 + r0 * math.cos(a), S / 2 + r0 * math.sin(a) - 140
    x1, y1 = S / 2 + r1 * math.cos(a), S / 2 + r1 * math.sin(a) - 140
    rd.line([x0, y0, x1, y1], fill=(150, 200, 255, al), width=w)
# a handful of hero streaks, brighter and longer
for i in range(16):
    a = rng.uniform(0, 2 * math.pi)
    x0, y0 = S / 2 + 500 * math.cos(a), S / 2 + 500 * math.sin(a) - 140
    x1, y1 = S / 2 + 2350 * math.cos(a), S / 2 + 2350 * math.sin(a) - 140
    rd.line([x0, y0, x1, y1], fill=(190, 225, 255, 88), width=5)
sp.alpha_composite(rays.filter(ImageFilter.GaussianBlur(6)))

# a faint halo ring around the mark
ring = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(ring).ellipse([S/2-560, S/2-560, S/2+560, S/2+560], outline=(150, 200, 255, 34), width=4)
sp.alpha_composite(ring.filter(ImageFilter.GaussianBlur(6)))

# center glow behind the mark
cg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(cg).ellipse([S/2-620, S/2-620, S/2+620, S/2+620], fill=(90, 150, 255, 46))
sp.alpha_composite(cg.filter(ImageFilter.GaussianBlur(220)))

sp = paste_mark(sp, 520, cy_offset=-140)

# wordmark — system Helvetica Neue Bold; skipped gracefully if unavailable
def bold_font(size):
    for path in ("/System/Library/Fonts/HelveticaNeue.ttc",):
        for idx in range(16):
            try:
                f = ImageFont.truetype(path, size, index=idx)
                if "bold" in (f.getname()[1] or "").lower() and "italic" not in f.getname()[1].lower():
                    return f
            except Exception:
                break
    return None

f = bold_font(190)
if f:
    d = ImageDraw.Draw(sp)
    txt = "Tabaqa"
    tw = d.textlength(txt, font=f)
    d.text(((S - tw) / 2, S / 2 + 330), txt, font=f, fill=(255, 255, 255, 255))
    sub = "كل عروض التمويل — بملف واحد صادق"
    print("wordmark set (latin only — PIL cannot shape Arabic; skipped the Arabic line)")
else:
    print("no bold font — mark only")

sp = sp.convert("RGB")
for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
    sp.save(f"{SPLASH_DIR}/{name}", "PNG")
    print("splash →", name)
