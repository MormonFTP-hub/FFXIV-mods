"""FFXIV textures (Dawntrail character.shpk layout) from the bake (work/bake/<texset>_{base,nrm,ao}.png).

Per texture set (head: face, ears, eyes; hair; body: outfit, arms, legs, boots):
  _base  RGB colour (the paint, with the sculpt's grooves darkened and the eyes drawn in)          BC7
  _norm  RG tangent-space normal from the sculpt (OpenGL green, as FFXIV's), B opacity            BC7
  _mask  R specular, G roughness (per set, SHINE), B occlusion (baked from the sculpt)            BC7
and one empty _id shared by all (no colour-table blending).
Colour lift (1.2.0, Neon 1.2.0's): every painted _base gets its luminance raised by a gamma (dark and mid tones most),
hue kept, then saturation scaled in linear light (LIFT). It is applied here, on the baked colour, so the paint in
paint.py and the bake stay as they are.
"""
import os
import pickle
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paint  # noqa: E402
import xivdata as xd  # noqa: E402

ROOT = xd.ROOT
BAKE = os.path.join(ROOT, "work", "bake")
OUT = os.path.join(ROOT, "work", "build", "tex")
GAME_DIR = "chara/equipment/e6162/texture/sailormoon"
# texset -> (specular 0-255, roughness 0-255): matte skin, satin hair, cloth and patent boots in between
SHINE = {"head": (45, 185), "hair": (110, 115), "body": (70, 150)}
# baked occlusion goes into _mask B at half strength: the game adds its own (GTAO) and shadows, and at full strength
# the hair's crevices read as dirt in GS (the Loki port saw the same with its rip's occlusion)
AO_STRENGTH = 0.5
FLAT = 64
# The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for"
# texset -> (luminance gamma, saturation). The paint is already bright, flat anime colour, so hair and body back off from
# Neon's 1.4 / 1.2: in GS daylight that turned the boots and bow into flat neon red with no shading, washed the skirt
# toward cyan and the hair toward lemon. 1.2 / 1.1 (hair) and 1.15 / 1.1 (body) deepen the colours and keep the shading.
LIFT = {"head": (1.4, 1.2), "hair": (1.2, 1.1), "body": (1.15, 1.1)}
LUMA = np.array([0.2126, 0.7152, 0.0722])


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
    np.ascontiguousarray(rgba, np.uint8).tofile(raw)
    dst = os.path.join(OUT, name + ".tex")
    out = subprocess.run(xd.XIVTOOL + ["rgba2tex", raw, str(rgba.shape[1]), str(rgba.shape[0]), dst, fmt],
                         capture_output=True, text=True)
    os.remove(raw)
    if out.returncode != 0 or "wrote" not in out.stdout:
        raise RuntimeError(out.stdout + out.stderr)
    print(" ", out.stdout.strip())
    return dst


def png(name, mode="RGB"):
    return np.asarray(Image.open(os.path.join(BAKE, name + ".png")).convert(mode)).copy()


def stack(*chans):
    shape = next(np.shape(c) for c in chans if np.ndim(c) == 2)
    return np.stack([np.broadcast_to(np.asarray(c, np.uint8), shape) for c in chans], -1)


def build():
    out = {}
    zero = np.zeros((FLAT, FLAT), np.uint8)
    out["flat_id"] = write("flat_id", stack(zero, zero, zero, np.full((FLAT, FLAT), 255)), "bc5")
    for texset in paint.TEXSETS:
        print(texset)
        base = png(f"{texset}_base")
        if texset in LIFT:
            base = lift(base, *LIFT[texset])
        full = np.full(base.shape[:2], 255, np.uint8)
        out[f"{texset}_base"] = write(f"{texset}_base", np.dstack([base, full]), "bc7")
        n = png(f"{texset}_nrm")
        nf = np.full(n.shape[:2], 255, np.uint8)
        out[f"{texset}_norm"] = write(f"{texset}_norm", stack(n[..., 0], n[..., 1], nf, nf), "bc7")
        ao = png(f"{texset}_ao", "L").astype(float)
        ao = np.round(255 - (255 - ao) * AO_STRENGTH)
        spec, rough = SHINE[texset]
        sz = ao.shape
        out[f"{texset}_mask"] = write(f"{texset}_mask", stack(np.full(sz, spec), np.full(sz, rough), ao,
                                                              np.full(sz, 255)), "bc7")
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


if __name__ == "__main__":
    build()
