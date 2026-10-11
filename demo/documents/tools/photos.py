"""Turn each 300 dpi page PNG into a synthetic phone photo of the printed page lying on a desk.

    <imaging-python> -I tools/photos.py out/png out/photos

For every out/png/<doc>-p<N>.png this writes out/photos/<doc>-p<N>.jpg, 3000 x 4000 px (portrait, 4:3 like a
phone camera): the page with toner and paper tint, faint tri-fold creases, slight rotation and perspective,
a contact shadow on a wood (statement) or laminate (EOB) desk, uneven window light with a soft shadow from the
phone, lens vignetting, focus falloff toward the corners, phone-style sharpening, sensor noise and JPEG
compression. Each page gets its own deterministic random parameters, so rebuilding gives identical files.
Everything stays legible: the page fills about 87% of the frame height at roughly 310 px per inch.

Needs Pillow and numpy (in the imaging environment, not in the repo).
"""
import hashlib
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

W, H = 3000, 4000
PAGE_H = 3440            # page height in the frame, before perspective


def rng_for(name: str) -> np.random.Generator:
    return np.random.default_rng(int(hashlib.sha256(name.encode()).hexdigest()[:12], 16))


def upscale(arr: np.ndarray, w: int, h: int, resample=Image.BICUBIC) -> np.ndarray:
    lo, hi = float(arr.min()), float(arr.max())
    norm = (arr - lo) / (hi - lo + 1e-9)
    img = Image.fromarray(np.uint8(norm * 255), "L").resize((w, h), resample)
    return np.asarray(img, np.float32) / 255.0


def fbm(rng, h, w, cells, octaves=4, gain=0.5) -> np.ndarray:
    """Smooth fractal value noise in [0, 1] built from upscaled random grids."""
    total = np.zeros((h, w), np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        cy, cx = max(2, int(cells[0] * 2 ** o)), max(2, int(cells[1] * 2 ** o))
        total += amp * upscale(rng.random((cy, cx)).astype(np.float32), w, h)
        norm += amp
        amp *= gain
    return total / norm


# ------------------------------------------------------------------------------------------ surfaces
def wood_desk(rng) -> np.ndarray:
    """Light oak planks running top to bottom, with a seam or two."""
    x = np.arange(W, dtype=np.float32)[None, :]
    warp = (fbm(rng, H, W, (3, 2), 3) - 0.5) * 260.0
    phase = fbm(rng, H, W, (2, 5), 2) * 5.0
    rings = np.sin((x + warp) / W * 2 * np.pi * 7.5 + phase)
    rings = np.sign(rings) * np.abs(rings) ** 0.6
    streaks = upscale(rng.random((max(2, H // 60), W // 3)).astype(np.float32), W, H, Image.BILINEAR)
    fine = upscale(rng.random((max(2, H // 12), W // 2)).astype(np.float32), W, H, Image.BILINEAR)
    blot = fbm(rng, H, W, (3, 3), 3)
    t = 0.52 + 0.20 * rings + 0.16 * (streaks - 0.5) + 0.08 * (fine - 0.5) + 0.22 * (blot - 0.5)
    t = np.clip(t, 0, 1)[..., None]
    light = np.array([200, 166, 126], np.float32)
    dark = np.array([146, 106, 70], np.float32)
    img = dark + (light - dark) * t
    # plank seams
    for sx in rng.uniform(0.08, 0.92, size=rng.integers(1, 3)) * W:
        d = np.abs(np.arange(W, dtype=np.float32) - sx)[None, :, None]
        img *= 1 - 0.38 * np.exp(-(d / 3.2) ** 2)
        img *= 1 + 0.05 * np.exp(-((d - 7) / 4.0) ** 2)
    return img


def laminate_desk(rng) -> np.ndarray:
    """Warm-gray office laminate with a faint speckle and a broad sheen."""
    base = np.array([158, 158, 152], np.float32)
    blot = fbm(rng, H, W, (3, 4), 4)
    speck = upscale(rng.random((H // 3, W // 3)).astype(np.float32), W, H, Image.BILINEAR)
    t = 1 + 0.07 * (blot - 0.5) + 0.05 * (speck - 0.5)
    return base[None, None, :] * t[..., None]


# ------------------------------------------------------------------------------------------ paper
def prepare_page(png: Path, rng) -> np.ndarray:
    page = np.asarray(Image.open(png).convert("RGB"), np.float32)
    ph, pw = page.shape[:2]
    toner = 24.0                                                  # printed black is never pure black
    page = toner + page * (1 - toner / 255.0)
    tint = np.array([0.975, 0.970, 0.952], np.float32)            # office paper under indoor light
    page *= tint
    grain = fbm(rng, ph, pw, (60, 46), 2)
    page *= (0.988 + 0.024 * grain)[..., None]
    # faint tri-fold creases (mailed statements are folded in thirds) and slightly tilted panels
    yy = np.arange(ph, dtype=np.float32)
    shade = np.ones(ph, np.float32)
    panel = rng.uniform(-0.018, 0.018, size=3)
    shade *= 1 + np.where(yy < ph / 3, panel[0], np.where(yy < 2 * ph / 3, panel[1], panel[2]))
    for fy in (ph / 3, 2 * ph / 3):
        d = yy - fy
        shade *= 1 - 0.045 * np.exp(-(d / 4.0) ** 2) + 0.018 * np.exp(-((d - 10) / 8.0) ** 2)
    page *= shade[:, None, None]
    return np.clip(page, 0, 255)


def homography_coeffs(dst, src):
    """PIL PERSPECTIVE data: maps output (dst) points back to input (src) points."""
    a, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return np.linalg.solve(np.array(a, float), np.array(b, float)).tolist()


def page_corners(rng, pw, ph):
    scale = PAGE_H / ph
    w, h = pw * scale, PAGE_H
    tilt = rng.uniform(0.032, 0.058) * rng.choice([1, -1], p=[0.8, 0.2])   # top narrower (phone held low)
    skew = rng.uniform(-0.018, 0.018)                                        # camera a bit left/right
    top_w, bot_w = w * (1 - tilt), w
    top_h = h * (1 - abs(tilt) * 0.55)                                       # foreshortened
    cx = W / 2 + rng.uniform(-45, 45)
    cy = H / 2 + rng.uniform(-40, 60)
    pts = [(-top_w / 2 + skew * w, -top_h / 2), (top_w / 2 + skew * w, -top_h / 2),
           (bot_w / 2, h / 2 - (h - top_h) * 0.0), (-bot_w / 2, h / 2)]
    ang = math.radians(rng.uniform(1.0, 3.0) * rng.choice([1, -1]))
    ca, sa = math.cos(ang), math.sin(ang)
    out = []
    for x, y in pts:
        x += rng.uniform(-6, 6); y += rng.uniform(-6, 6)
        out.append((cx + x * ca - y * sa, cy + x * sa + y * ca))
    return out


def photograph(png: Path, target: Path) -> None:
    rng = rng_for(png.stem)
    desk = wood_desk(rng) if png.stem.startswith("itemized") else laminate_desk(rng)
    paper = prepare_page(png, rng)
    ph, pw = paper.shape[:2]
    corners = page_corners(rng, pw, ph)
    coeffs = homography_coeffs(corners, [(0, 0), (pw, 0), (pw, ph), (0, ph)])

    warped = Image.fromarray(np.uint8(paper)).transform((W, H), Image.PERSPECTIVE, coeffs, Image.BICUBIC,
                                                       fillcolor=(0, 0, 0))
    mask_img = Image.new("L", (pw, ph), 255).transform((W, H), Image.PERSPECTIVE, coeffs, Image.BILINEAR,
                                                       fillcolor=0)
    mask = np.asarray(mask_img, np.float32)[..., None] / 255.0

    # shadows on the desk: soft cast shadow (light from the upper left) plus a tight contact shadow
    soft = np.asarray(mask_img.filter(ImageFilter.GaussianBlur(30)), np.float32) / 255.0
    soft = np.roll(np.roll(soft, 22, axis=0), 16, axis=1)
    contact = np.asarray(mask_img.filter(ImageFilter.GaussianBlur(5)), np.float32) / 255.0
    desk *= (1 - 0.30 * soft[..., None]) * (1 - 0.22 * contact[..., None])

    img = desk * (1 - mask) + np.asarray(warped, np.float32) * mask
    # thin darker paper edge (sheet thickness)
    edge = np.clip(mask[..., 0] - np.asarray(mask_img.filter(ImageFilter.MinFilter(5)), np.float32) / 255.0, 0, 1)
    img *= (1 - 0.18 * edge)[..., None]
    del desk, warped, soft, contact

    # lighting: window light from the upper left, a soft phone shadow near the bottom, vignetting
    gx = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    gy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    lx, ly = rng.uniform(0.15, 0.4), rng.uniform(-0.1, 0.15)
    light = 1.08 - 0.17 * np.clip(np.sqrt(((gx - lx) / 1.1) ** 2 + ((gy - ly) / 1.25) ** 2), 0, 1.2)
    ox, oy = rng.uniform(0.45, 0.75), rng.uniform(1.0, 1.08)
    occ = np.exp(-(((gx - ox) / 0.42) ** 2 + ((gy - oy) / 0.17) ** 2) * 1.6)
    light *= 1 - rng.uniform(0.10, 0.16) * occ
    r2 = ((gx - 0.5) / 0.6) ** 2 + ((gy - 0.5) / 0.66) ** 2
    light *= 1 - 0.17 * np.clip(r2, 0, 1.8) ** 1.25 / 1.8 ** 1.25
    warm = rng.uniform(0.0, 1.0)
    wb = np.array([1.0 + 0.02 * warm, 1.0, 1.0 - 0.045 * warm], np.float32)
    img *= light[..., None] * wb[None, None, :]
    del light, occ, r2

    # optics: overall softness, focus falloff toward the corners, then phone sharpening
    base = Image.fromarray(np.uint8(np.clip(img, 0, 255))).filter(ImageFilter.GaussianBlur(0.75))
    del img
    blur1 = base.filter(ImageFilter.GaussianBlur(1.5))
    blur2 = base.filter(ImageFilter.GaussianBlur(3.0))
    fx, fy = 0.5 + rng.uniform(-0.05, 0.05), 0.46 + rng.uniform(-0.05, 0.05)
    r = np.sqrt(((gx - fx) / 0.5) ** 2 + ((gy - fy) / 0.5) ** 2)
    w1 = np.clip((r - 0.62) / 0.35, 0, 1)[..., None]
    w2 = np.clip((r - 1.0) / 0.35, 0, 1)[..., None]
    out = np.asarray(base, np.float32)
    out = out * (1 - w1) + np.asarray(blur1, np.float32) * w1
    out = out * (1 - w2) + np.asarray(blur2, np.float32) * w2
    del blur1, blur2, w1, w2, r
    sharp = Image.fromarray(np.uint8(np.clip(out, 0, 255))).filter(
        ImageFilter.UnsharpMask(radius=1.8, percent=65, threshold=2))
    out = np.asarray(sharp, np.float32)

    # sensor noise: luminance noise that grows in the shadows, plus a little chroma noise
    lum = out.mean(axis=2, keepdims=True)
    sigma = 1.8 + 2.6 * (1 - lum / 255.0)
    out = out + rng.normal(0, 1, (H, W, 1)).astype(np.float32) * sigma
    out = out + rng.normal(0, 0.9, (H, W, 3)).astype(np.float32)
    final = Image.fromarray(np.uint8(np.clip(out, 0, 255)))

    exif = Image.Exif()
    exif[0x010E] = "SPECIMEN synthetic phone photo for the Footnote demo. All names and numbers are fictional."
    exif[0x0131] = "Footnote demo documents build (tools/photos.py)"
    target.parent.mkdir(parents=True, exist_ok=True)
    final.save(target, "JPEG", quality=90, subsampling=2, optimize=True, exif=exif.tobytes())
    print(f"    {target.name}  {final.width}x{final.height}  {target.stat().st_size // 1024} KB")


def main() -> int:
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    pngs = sorted(src.glob("*-p*.png"))
    if not pngs:
        print(f"no page PNGs in {src}")
        return 1
    for png in pngs:
        photograph(png, dst / (png.stem + ".jpg"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
