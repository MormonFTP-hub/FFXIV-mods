"""Build the FFXIV textures (Dawntrail character.shpk layout) from the baked Pink Purr albedo (bake_src.py).

Per texture set (texsets.SETS):
  _base  RGB colour (dye baked in), A = 255                                                        BC7
  _mask  R specular, G roughness (per set), B occlusion (the rip's ORM red x its aoIntensity: 0) BC7
  _norm  flat normal; B = opacity where the set alpha-tests (hair strand tips, the drape's fade)    BC7
Sets without cut-outs share one flat _norm; every set shares one empty _id (no glow).
The rip's normal maps are not used.
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
from texsets import CUTOUT, QUADRANT_SRC, SETS, TEXSET  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "tex")
GAME_DIR = "chara/equipment/e6135/texture/blackcat"
FLAT = 64
ALPHA_SETS = {"hair", "acc"}     # sets whose _norm carries opacity
AO_FLOOR = 0.35
# Colour lift (1.1.0, Neon's 1.2.0 lift; the user on Neon: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like
# color intensity is what im looking for"): texset -> (luminance gamma, saturation) on the _base RGB; alpha untouched
LIFT = {ts: (1.4, 1.2) for ts in ("skin", "head", "suit", "legs", "legs2", "eyes", "hair", "acc")}
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


def stack(*chans):
    shape = next(np.shape(c) for c in chans if np.ndim(c) == 2)
    return np.stack([np.broadcast_to(np.asarray(c, np.uint8), shape) for c in chans], -1)


def img(path, size, mode="RGBA"):
    im = Image.open(path).convert(mode)
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).copy()


def occlusion(material, size):
    """The rip's ORM red for one source material, applied as strongly as the material's aoIntensity (white when
    it has no ORM). Every Pink Purr material has aoIntensity 0: the game never darkens by it, so neither do we."""
    m = sd.scene()["materials"][material]
    k = float(m["inputs"].get("aoIntensity", 0.0))
    if not m["orm"] or k <= 0:
        return np.full((size, size), 255, np.uint8)
    ao = img(os.path.join(sd.TEX, m["orm"] + ".png"), size, "RGB")[..., 0].astype(float) / 255
    ao = 1 - k * (1 - np.maximum(ao, AO_FLOOR))
    return (ao * 255 + 0.5).astype(np.uint8)


def set_occlusion(ts, size):
    if ts == "acc":
        h = size // 2
        ao = np.full((size, size), 255, np.uint8)
        for (qx, qy), mat in QUADRANT_SRC.items():
            ao[qy * h:(qy + 1) * h, qx * h:(qx + 1) * h] = occlusion(mat, h)
        return ao
    mat = next(m for m, t in TEXSET.items() if t == ts)
    return occlusion(mat, size)


def build():
    out = {}
    flat = np.full((FLAT, FLAT), 255, np.uint8)
    out["flat_norm"] = write("flat_norm", stack(np.full((FLAT, FLAT), 128), np.full((FLAT, FLAT), 128), flat, flat), "bc7")
    zero = np.zeros((FLAT, FLAT), np.uint8)
    out["flat_id"] = write("flat_id", stack(zero, zero, zero, flat), "bc5")
    for ts, (size, spec, rough) in SETS.items():
        print(ts)
        rgba = img(os.path.join(sd.ALBEDO, f"set_{ts}.png"), size)
        rgb = lift(rgba[..., :3], *LIFT[ts]) if ts in LIFT else rgba[..., :3]
        out[f"{ts}_base"] = write(f"{ts}_base", np.dstack([rgb, np.full((size, size), 255, np.uint8)]), "bc7")
        ms = min(size, 1024)        # occlusion is soft: the mask does not need the colour's resolution
        out[f"{ts}_mask"] = write(f"{ts}_mask", stack(np.full((ms, ms), spec), np.full((ms, ms), rough),
                                                      set_occlusion(ts, ms), np.full((ms, ms), 255)), "bc7")
        if ts in ALPHA_SETS:
            a = rgba[..., 3]
            if ts == "acc":     # only the cut-out quadrants keep their alpha
                h = size // 2
                keep = np.zeros((size, size), bool)
                for qx, qy in CUTOUT:
                    keep[qy * h:(qy + 1) * h, qx * h:(qx + 1) * h] = True
                a = np.where(keep, a, 255)
            out[f"{ts}_norm"] = write(f"{ts}_norm", stack(np.full((size, size), 128), np.full((size, size), 128), a,
                                                          np.full((size, size), 255)), "bc7")
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


if __name__ == "__main__":
    build()
