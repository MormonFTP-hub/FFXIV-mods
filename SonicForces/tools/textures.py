"""Build the FFXIV textures (Dawntrail character.shpk layout) from the Sonic Forces PNGs.

Per texture set:  _base  RGB colour (the rip's _abd albedo)                         BC7
                  _norm  RG normal, B = opacity. The rip's _nrm is DirectX style (green down: its
                         cross-derivatives only agree with the green channel flipped), FFXIV's are green up  BC7
                  _mask  R specular, G roughness (255 - _prm G gloss), B occlusion (_prm B)                     BC7
                  _id    R = colour-table row pair * 17, G picks within the pair: 255 = the first row (plain),
                         0 = the second (the shoe buckles). G = 255 - metal, where metal is _prm R with the
                         faint 0.1-0.25 the rest of the rip carries cut away (METAL_RAMP). Eyes: flat G = 255.  BC5
                         (1.0.x-1.1.0 wrote G = _prm R, which put 98% of every body material on the second row:
                         metal, near-black in GS, with only the buckles plain)
Super Sonic has his own albedo and _prm maps but shares Sonic's normal map (same UVs).
Colour lift (1.1.0, Neon 1.2.0's, after the user saw Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this
like color intensity is what im looking for"): every _base gets its luminance raised by a gamma (dark and mid tones
most), hue kept, then saturation scaled in linear light. Alpha is untouched (the _base alpha is written opaque).
"""
import os
import pickle
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402

ROOT = xd.ROOT
IMG = os.path.join(ROOT, "source", "Sonic Forces", "Sonic", "images")
OUT = os.path.join(ROOT, "work", "build", "tex")
GAME_DIR = "chara/equipment/e6047/texture/sonicforces"
PAIRS = {"body": 0, "eye": 1}
METAL_RAMP = (120, 190)         # _prm R: fur, skin, gloves and shoes sit at 1-63, the gold buckles at 192-255
BODY, EYE = 1024, 512
TEXSETS = {   # texset -> (albedo, prm prefix)
    "sonic_body": ("chr_sonic_body_abd.png", "chr_sonic_body_prm"),
    "super_body": ("chr_supersonic_body_abd.png", "chr_supersonic_body_prm"),
    "sonic_eye": ("chr_sonic_eye_abd_noalpha.png", "chr_sonic_eye_prm"),
    "super_eye": ("chr_supersonic_eye_abd_noalpha.png", "chr_sonic_eye_prm"),
}
# The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for"
LIFT = {"sonic_body": (1.4, 1.2), "super_body": (1.4, 1.2),     # texset -> (luminance gamma, saturation)
        "sonic_eye": (1.4, 1.2), "super_eye": (1.4, 1.2)}
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


def png(name, size, mode="RGBA"):
    im = Image.open(os.path.join(IMG, name)).convert(mode)
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
    return np.stack([np.broadcast_to(np.asarray(c, np.uint8), chans[0].shape) for c in chans], -1)


def build():
    out = {}
    nrm = png("chr_sonic_body_nrm.png", BODY, "RGB")
    for texset, (abd, prm) in TEXSETS.items():
        print(texset)
        size = BODY if texset.endswith("body") else EYE
        base = png(abd, size, "RGB")
        if texset in LIFT:
            base = lift(base, *LIFT[texset])
        out[f"{texset}_base"] = write(f"{texset}_base", np.dstack([base, np.full(base.shape[:2], 255, np.uint8)]), "bc7")
        R, G, B = (png(f"{prm}_{c}.png", size, "L") for c in "RGB")
        full = np.full((size, size), 255, np.uint8)
        if texset.endswith("body"):
            n = stack(nrm[..., 0], 255 - nrm[..., 1], full, full)
            spec = np.full((size, size), 110, np.uint8)
        else:
            n = stack(np.full((size, size), 128, np.uint8), np.full((size, size), 128, np.uint8), full, full)
            spec = np.full((size, size), 170, np.uint8)
        out[f"{texset}_norm"] = write(f"{texset}_norm", n, "bc7")
        out[f"{texset}_mask"] = write(f"{texset}_mask", stack(spec, 255 - G, B, full), "bc7")
        pair = PAIRS["body" if texset.endswith("body") else "eye"]
        lo, hi = METAL_RAMP
        metal = np.clip((R.astype(float) - lo) / (hi - lo) * 255, 0, 255) if texset.endswith("body") else np.zeros(R.shape)
        out[f"{texset}_id"] = write(f"{texset}_id", stack(np.full((size, size), pair * 17, np.uint8), 255 - metal,
                                                          np.zeros_like(R), full), "bc5")
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


if __name__ == "__main__":
    build()
