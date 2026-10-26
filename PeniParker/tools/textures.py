"""Build the FFXIV textures (Dawntrail character.shpk layout) from the Marvel Rivals textures (work/src/tex).

Per texture set:  _base  RGB colour (hair and eyes from tools/bake.py), then Neon's colour lift (LIFT)   BC7
                  _norm  RG normal (the rip's are DirectX style, green down: flipped to FFXIV's green up),
                         B = opacity (hair, hair strokes and lashes are cut out), A 255                 BC7
                  _mask  R specular, G roughness (the rip's ORM green, kept matte for the toon look),
                         B occlusion (the rip's ORM red)                                                BC7
A model may use at most 4 materials (Penumbra's MdlMaterialMaximum, the most vanilla gear uses), and the head piece
carries six sets, so sets are packed into one material's atlas (MATERIALS): the two gear sets (sleeves and crown,
stockings and shoes) into a 2:1 "gear" atlas, the hair strokes and lashes with the eyes into a 2:1 "detail" atlas.
build.py moves each part's UVs into its tile.
Every material shares one empty _id (no glow, one colour-table row pair).
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
GAME_DIR = "chara/equipment/e6191/texture/peni"
P = "MI_1042302_"
# texset -> (colour, normal or None, ORM or None, opacity or None, size, specular 0-255, roughness range 0-255)
TEXSETS = {
    "head": (P + "Girl_Head_baseColor", P + "Girl_Head_normal", P + "Girl_Head_orm", None, 1024, 50, (150, 230)),
    "body": (P + "Girl_Body_baseColor", P + "Girl_Body_normal", P + "Girl_Body_orm", None, 1024, 50, (150, 230)),
    "dress": (P + "Skirt_baseColor", P + "Skirt_normal", P + "Skirt_orm", None, 1024, 80, (110, 220)),
    "equip": (P + "Equip_01_baseColor", P + "Equip_01_normal", P + "Sleeves_orm", None, 1024, 70, (120, 225)),
    "gen": (P + "Equip_Gen_baseColor", P + "Equip_Gen_normal", P + "Pants_orm", None, 1024, 70, (120, 225)),
    # mapped with the source's second UV set (tools/bake.py), so its first-set normal map no longer lines up: flat
    "hair": ("baked_hair", None, None, "baked_hair_alpha", 2048, 110, (120, 120)),
    "strokes": (P + "Girl_Hair_02_baseColor", None, None, P + "Girl_Hair_02_opacityMask", 1024, 30, (230, 230)),
    "eyes": ("baked_eyes", None, None, None, 512, 200, (40, 40)),
}
# material -> its texture sets as rows of tiles (top row first). Atlased sets share a shader setup and about the same
# texel density: equip and gen are both gear with normal and ORM maps (~1000 texels/m); strokes and eyes are both
# flat (no normal or ORM map) and fine (2500-7600 texels/m). The eyes are opaque, so the strokes' cut-off leaves
# them whole. The skin (head, body) keeps its own materials.
MATERIALS = {
    "head": [["head"]],
    "hair": [["hair"]],
    "detail": [["strokes", "eyes"]],
    "body": [["body"]],
    "dress": [["dress"]],
    "gear": [["equip", "gen"]],
}
# Colour lift (1.0.3, Neon 1.2.0's): the user on Neon 1.2.0, "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like
# color intensity is what im looking for". texset -> (luminance gamma, saturation). The strokes set is the hair's
# strand cards (with its teal and pink streaks), lifted to keep matching the lifted hair.
LIFT = {t: (1.4, 1.2) for t in ("head", "body", "dress", "equip", "gen", "hair", "strokes", "eyes")}
LUMA = np.array([0.2126, 0.7152, 0.0722])
TILE = 1024         # tile size in an atlas
MASK_MAX = 1024     # shine and occlusion are soft: no need for the colour's resolution
FLAT = 64


def tile_of(texset):
    """(material, column, row, columns, rows) of a texture set."""
    for mat, grid in MATERIALS.items():
        for r, row in enumerate(grid):
            if texset in row:
                return mat, row.index(texset), r, len(row), len(grid)
    raise KeyError(texset)


def to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def lift(rgb, gamma, sat):
    """Brighter colours (Neon's): luminance (sRGB-encoded) to the power 1/gamma with the hue kept, then saturation x sat
    in linear light; a channel past white scales the whole pixel down, keeping the hue."""
    lin = to_linear(rgb.astype(np.float64) / 255)
    y = lin @ LUMA
    lin *= (to_linear(to_srgb(y) ** (1 / gamma)) / np.maximum(y, 1e-6))[..., None]
    y = lin @ LUMA
    lin = np.maximum(y[..., None] + (lin - y[..., None]) * sat, 0)
    peak = np.maximum(lin.max(-1, keepdims=True), 1.0)
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


def maps(texset, size):
    """base, norm and mask (RGBA) of one texture set, the colour and normal at size, the mask at most MASK_MAX."""
    color, normal, orm, opacity, _, spec, (r_lo, r_hi) = TEXSETS[texset]
    base = png(color, size)
    if texset in LIFT:
        base = lift(base, *LIFT[texset])
    ns = size
    if normal:
        n = png(normal, ns).astype(np.int32)
        r, g = n[..., 0], 255 - n[..., 1]
    else:
        r = g = np.full((ns, ns), 128)
    a = png(opacity, ns, "L") if opacity else np.full((ns, ns), 255)
    ms = min(size, MASK_MAX)
    if orm:
        o = png(orm, ms)
        ao, rough = o[..., 0], r_lo + o[..., 1].astype(np.float64) / 255 * (r_hi - r_lo)
    else:
        ao, rough = np.full((ms, ms), 255), np.full((ms, ms), r_lo)
    return (np.dstack([base, np.full(base.shape[:2], 255, np.uint8)]), stack(r, g, a, np.full((ns, ns), 255)),
            stack(np.full((ms, ms), spec), rough, ao, np.full((ms, ms), 255)))


def build():
    out = {}
    zero = np.zeros((FLAT, FLAT), np.uint8)
    full = np.full((FLAT, FLAT), 255, np.uint8)
    out["flat_id"] = write("flat_id", stack(zero, zero, zero, full), "bc5")
    for mat, grid in MATERIALS.items():
        print(mat, grid)
        size = TEXSETS[grid[0][0]][4] if len(grid) == 1 and len(grid[0]) == 1 else TILE
        tiles = [[maps(t, size) for t in row] for row in grid]
        for k, kind in enumerate(("base", "norm", "mask")):
            img = np.vstack([np.hstack([t[k] for t in row]) for row in tiles])
            out[f"{mat}_{kind}"] = write(f"{mat}_{kind}", img, "bc7")
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


if __name__ == "__main__":
    build()
