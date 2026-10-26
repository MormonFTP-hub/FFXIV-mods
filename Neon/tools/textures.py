"""Build the FFXIV textures (Dawntrail character.shpk layout) from the viewer's Neon textures (work/src/tex).

Per texture set:  _base  RGB colour                                                                BC7
                  _norm  RG tangent normal (the viewer's maps are green-down, FFXIV's green-up: G flipped),
                         B opacity (the eye overlay only)                                            BC7
                  _mask  R specular, G roughness (the ORM green), B occlusion (ORM red)               BC7
                  _id    R colour-table row pair (always 0), G picks within the pair: 255 = the first row
                         (plain), 0 = the second (glossy), so G = 255 - the ORM blue, with the fabrics'
                         faint 0.27 metalness cut away first. Sets without an ORM get a flat G = 255  BC5
                         (1.0.x wrote G = metal and a flat G = 0, which put 86-100% of every material on
                         the second row, then metal: near-black in GS)
The eye set is the viewer's eye overlay (eyeliner and catchlight cards), alpha-tested through _norm blue.
Colour lift (1.2.0, the user on 1.1.0 in game: "really good, i want brighter colors though"): luminance is raised by a
gamma (dark and mid tones most, so the navy suit and blue hair brighten while skin and the gold plates move little),
hue kept, then saturation scaled in linear light.
"""
import os
import pickle
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import srcdata as sd  # noqa: E402
import xivdata as xd  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "tex")
GAME_DIR = "chara/equipment/e6222/texture/neon"
# texset -> (colour, normal, ORM, size, specular 0-255)
TEXSETS = {
    "body": ("df", "nm", "orm", 2048, 70),
    "hair": ("hair_df", "hair_nm", "hair_orm", 1024, 110),
    "eye": ("eye_df", None, None, 512, 60),
}
METAL_RAMP = (120, 190)         # ORM blue: fabrics sit at ~70 (not metal), plates and piercings at ~200
LIFT = {"body": (1.4, 1.2), "hair": (1.4, 1.2)}    # texset -> (luminance gamma, saturation); the eye overlay stays
LUMA = np.array([0.2126, 0.7152, 0.0722])
FLAT = 64


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


def png(name, size, mode="RGB"):
    im = Image.open(os.path.join(sd.TEX, name + ".png")).convert(mode)
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).copy()


def write(name, rgba, fmt):
    os.makedirs(OUT, exist_ok=True)
    raw = os.path.join(OUT, name + ".raw")
    np.ascontiguousarray(rgba, np.uint8).tofile(raw)
    dst = os.path.join(OUT, name + ".tex")
    out = subprocess.run(xd.XIVTOOL + ["rgba2tex", raw, str(rgba.shape[1]), str(rgba.shape[0]), dst, fmt],
                         capture_output=True, text=True)
    os.remove(raw)
    if out.returncode != 0 or "wrote" not in out.stdout:
        raise RuntimeError(out.stdout + out.stderr)
    print(" ", out.stdout.strip())
    return dst


def stack(*chans):
    shape = next(np.shape(c) for c in chans if np.ndim(c) == 2)
    return np.stack([np.broadcast_to(np.asarray(c, np.uint8), shape) for c in chans], -1)


def build():
    out = {}
    flat = np.full((FLAT, FLAT), 255, np.uint8)
    zero = np.zeros((FLAT, FLAT), np.uint8)
    out["flat_id"] = write("flat_id", stack(zero, flat, zero, flat), "bc5")
    for texset, (color, normal, orm, size, spec) in TEXSETS.items():
        print(texset)
        rgba = png(color, size, "RGBA")
        rgb = lift(rgba[..., :3], *LIFT[texset]) if texset in LIFT else rgba[..., :3]
        out[f"{texset}_base"] = write(f"{texset}_base", np.dstack([rgb, np.full((size, size), 255, np.uint8)]), "bc7")
        full = np.full((size, size), 255)
        if normal:
            n = png(normal, size)
            out[f"{texset}_norm"] = write(f"{texset}_norm", stack(n[..., 0], 255 - n[..., 1], full, full), "bc7")
        else:
            half = np.full((size, size), 128)
            out[f"{texset}_norm"] = write(f"{texset}_norm", stack(half, half, rgba[..., 3], full), "bc7")
        ms = min(size, 1024)
        if orm:
            o = png(orm, ms)
            out[f"{texset}_mask"] = write(f"{texset}_mask", stack(np.full((ms, ms), spec), o[..., 1], o[..., 0],
                                                                  np.full((ms, ms), 255)), "bc7")
            lo, hi = METAL_RAMP
            metal = np.clip((o[..., 2].astype(float) - lo) / (hi - lo) * 255, 0, 255)
            if metal.max() > 40:
                out[f"{texset}_id"] = write(f"{texset}_id", stack(np.zeros((ms, ms)), 255 - metal, np.zeros((ms, ms)),
                                                                  np.full((ms, ms), 255)), "bc5")
        else:
            out[f"{texset}_mask"] = write(f"{texset}_mask", stack(np.full((FLAT, FLAT), spec),
                                                                  np.full((FLAT, FLAT), 160), flat, flat), "bc7")
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


def has(texset, kind):
    return os.path.exists(os.path.join(OUT, f"{texset}_{kind}.tex"))


if __name__ == "__main__":
    build()
