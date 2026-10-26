"""Build the FFXIV textures (Dawntrail character.shpk layout) from the rip's PNGs, packed into one atlas.

The rip has 26 small (16-256 px) textures, one per OBJ group, and many of its UVs run outside 0..1: the PS2
repeated them. Each texture gets an atlas cell holding as many repeats as its UVs span (plus a margin that
keeps repeating, so mip-mapping never pulls in the neighbour), upscaled by UPSCALE; the parts' UVs are
remapped into the cell (written back to work/fit/fitted.pkl as "atlas_uv").

Atlas set:  jak_base  RGB colour, A = 255                                     (BC7, full size)
            jak_norm  flat normal, B = opacity 255                            (BC7, 16 px: constant)
            jak_mask  R specular, G roughness factor, B occlusion, per cell   (BC7, 1/4 size)
            jak_id    R = colour-table row pair * 17 per cell                 (BC5, 1/4 size)
Cells are 4-pixel aligned, so the quarter-size maps keep every cell edge on a whole pixel.
Colour lift (1.1.0, Neon's): the atlas colour's luminance is raised by a gamma (dark and mid tones most), hue kept, then
saturation scaled in linear light. Face, hair and eyes are character.shpk with their colour baked in, so they get it too.
"""
import math
import os
import pickle
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402

ROOT = xd.ROOT
SRC = os.path.join(ROOT, "source", "JIIJak")
FIT = os.path.join(ROOT, "work", "fit", "fitted.pkl")
OUT = os.path.join(ROOT, "work", "build", "tex")
GAME_DIR = "chara/equipment/e6027/texture/jak"
ATLAS = 2048
PAD = 8          # margin (atlas pixels) around each cell, filled by continuing the repeat
OVERSHOOT = 0.05  # UVs this far past a whole number are clamped instead of adding another repeat

# The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for"
LIFT = {"jak": (1.4, 1.2)}      # texture set -> (luminance gamma, saturation) for its _base colour
LUMA = np.array([0.2126, 0.7152, 0.0722])

PAIRS = {"cloth": 0, "leather": 1, "metal": 2, "skin": 3, "hair": 4, "eye": 5, "lens": 6}
SURFACE = {  # texture -> (surface kind, specular 0..255)
    "Shirt.png": ("cloth", 90), "Arms.png": ("cloth", 90), "Pants.png": ("cloth", 70), "Scarf.png": ("cloth", 80),
    "StrapsBlue.png": ("cloth", 90),
    "StrapsChest.png": ("leather", 120), "Belt.png": ("leather", 120), "GunHolster.png": ("leather", 120),
    "Pouch.png": ("leather", 120), "Legs.png": ("leather", 130), "Shoes.png": ("leather", 110),
    "ShoeBottom.png": ("leather", 110), "Gloves.png": ("leather", 130), "StrapLegs.png": ("leather", 120),
    "Armor.png": ("metal", 200), "Buckles.png": ("metal", 220), "Goggles.png": ("metal", 210), "ShoeTip.png": ("metal", 200),
    "Face.png": ("skin", 110), "Ears.png": ("skin", 110), "Teeth.png": ("skin", 150),
    "Hair.png": ("hair", 140), "FacialHair.png": ("hair", 110),
    "EyeL.png": ("eye", 230), "EyeR.png": ("eye", 230), "Lens.png": ("lens", 255),
}


def to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def lift(rgb, gamma, sat):
    """Brighter colours: luminance (sRGB-encoded) to the power 1/gamma with the hue kept, then saturation x sat."""
    lin = to_linear(rgb.astype(np.float64) / 255)
    y = lin @ LUMA
    lin *= (to_linear(to_srgb(y) ** (1 / gamma)) / np.maximum(y, 1e-6))[..., None]
    y = lin @ LUMA
    lin = np.maximum(y[..., None] + (lin - y[..., None]) * sat, 0)
    peak = np.maximum(lin.max(-1, keepdims=True), 1.0)         # a channel past white scales the pixel, keeping hue
    return (to_srgb(lin / peak) * 255 + 0.5).astype(np.uint8)


def write(name, rgba, fmt):
    os.makedirs(OUT, exist_ok=True)
    raw = os.path.join(OUT, name + ".raw")
    rgba = np.ascontiguousarray(rgba, np.uint8)
    rgba.tofile(raw)
    dst = os.path.join(OUT, name + ".tex")
    out = subprocess.run(xd.XIVTOOL + ["rgba2tex", raw, str(rgba.shape[1]), str(rgba.shape[0]), dst, fmt],
                         capture_output=True, text=True)
    os.remove(raw)
    if out.returncode != 0 or "wrote" not in out.stdout:
        raise RuntimeError(out.stdout + out.stderr)
    print(" ", out.stdout.strip())
    return dst


def uv_span(uvs):
    """Whole-number UV range [lo, hi) per axis that covers these UVs, ignoring tiny overshoots."""
    lo = np.floor(uvs.min(0) + OVERSHOOT)
    hi = np.ceil(uvs.max(0) - OVERSHOOT)
    return lo, np.maximum(hi, lo + 1)


def pack(sizes, width):
    """Shelf packing, tallest first. sizes: {key: (w, h)} -> ({key: (x, y)}, used height)."""
    pos, x, y, shelf = {}, 0, 0, 0
    for k in sorted(sizes, key=lambda k: (-sizes[k][1], -sizes[k][0])):
        w, h = sizes[k]
        if x + w > width:
            x, y, shelf = 0, y + shelf, 0
        pos[k] = (x, y)
        x += w
        shelf = max(shelf, h)
    return pos, y + shelf


def layout(fitted):
    """Per texture: its UV span and upscale; pick the largest whole upscale whose cells fit the atlas."""
    span = {}
    for t in sorted({m["texture"] for m in fitted.values()}):
        uvs = np.vstack([m["uv"] for m in fitted.values() if m["texture"] == t])
        span[t] = uv_span(uvs)
    img = {t: Image.open(os.path.join(SRC, t)).convert("RGB") for t in span}
    for up in (4, 3, 2, 1):
        sizes = {}
        for t, (lo, hi) in span.items():
            w, h = img[t].size
            n = (hi - lo).astype(int)
            # cells rounded up to 4-pixel blocks so BC blocks never straddle two cells
            sizes[t] = tuple(int(math.ceil((v + 2 * PAD) / 4) * 4) for v in (w * up * n[0], h * up * n[1]))
        pos, used = pack(sizes, ATLAS)
        if used <= ATLAS:
            return span, img, up, sizes, pos, used
    raise RuntimeError("textures do not fit the atlas")


def build():
    fitted = pickle.load(open(FIT, "rb"))
    span, img, up, sizes, pos, used = layout(fitted)
    height = ATLAS if used > ATLAS // 2 else ATLAS // 2
    print(f"atlas {ATLAS}x{height}, upscale x{up}, {len(span)} textures, {used} px used")
    base = np.zeros((height, ATLAS, 3), np.uint8)
    mask = np.zeros((height, ATLAS, 4), np.uint8)
    ids = np.zeros((height, ATLAS, 4), np.uint8)
    mask[...] = (100, 255, 255, 255)
    ids[..., 3] = 255
    cell_uv = {}
    for t, (lo, hi) in span.items():
        w0, h0 = img[t].size
        tex = np.asarray(img[t].resize((w0 * up, h0 * up), Image.LANCZOS))
        tw, th = w0 * up, h0 * up
        x0, y0 = pos[t]
        cw, ch = sizes[t]
        # cell pixel (cx, cy) shows texel ((cx - PAD) mod tw, (cy - PAD) mod th): the repeat continues into the margin
        xs = (np.arange(cw) - PAD) % tw
        ys = (np.arange(ch) - PAD) % th
        base[y0:y0 + ch, x0:x0 + cw] = tex[ys][:, xs]
        kind, spec = SURFACE[t]
        mask[y0:y0 + ch, x0:x0 + cw] = (spec, 255, 255, 255)
        ids[y0:y0 + ch, x0:x0 + cw, 0] = PAIRS[kind] * 17
        cell_uv[t] = (lo, hi, x0 + PAD, y0 + PAD, tw, th)
        print(f"  {t:16s} {kind:7s} uv {lo.astype(int)}..{hi.astype(int)} cell {cw}x{ch} at {x0},{y0}")

    # remap UVs (OBJ convention, v up) into the atlas
    for name, m in fitted.items():
        lo, hi, px, py, tw, th = cell_uv[m["texture"]]
        uv = np.clip(m["uv"], lo, hi)
        ax = (px + (uv[:, 0] - lo[0]) * tw) / ATLAS
        ay = (py + (hi[1] - uv[:, 1]) * th) / height   # rows from the top of the atlas
        m["atlas_uv"] = np.c_[ax, 1 - ay]
    with open(FIT, "wb") as f:
        pickle.dump(fitted, f)

    out = {}
    if "jak" in LIFT:
        base = lift(base, *LIFT["jak"])
    rgba = np.dstack([base, np.full(base.shape[:2], 255, np.uint8)])
    out["jak_base"] = write("jak_base", rgba, "bc7")
    Image.fromarray(base).save(os.path.join(OUT, "jak_base_preview.png"))
    norm = np.zeros((16, 16, 4), np.uint8)
    norm[..., 0] = norm[..., 1] = 128
    norm[..., 2] = norm[..., 3] = 255
    out["jak_norm"] = write("jak_norm", norm, "bc7")
    out["jak_mask"] = write("jak_mask", mask[2::4, 2::4], "bc7")
    out["jak_id"] = write("jak_id", ids[2::4, 2::4], "bc5")
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k[4:]}.tex") for k, v in out.items()}, f)
    return out


if __name__ == "__main__":
    build()
