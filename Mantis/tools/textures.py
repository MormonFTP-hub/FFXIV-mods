"""Build the FFXIV textures (Dawntrail character.shpk layout) from Mantis's baked albedo (shade.py) and the
Marvel Rivals normal and ORM maps.

Per texture set:  _base  RGB colour: the viewer's dyed colour, baked (work/src/albedo), then Neon's
                         colour lift (LIFT)                                                           BC7
                  _norm  RG tangent-space normal, B opacity. The rip's maps are DirectX-style (green down):
                         read that way their slopes are far closer to curl-free on all four maps
                         (curl_test()), so G is flipped to FFXIV's green-up                          BC7
                  _mask  R specular (per set), G roughness (the ORM green, or per set), B = 255: no baked
                         occlusion. The game adds its own and real shadows; the head's ORM occlusion on top
                         of them darkened the eye sockets and creases twice (Loki port 1.2.0)          BC7
The GLB's ORM slots don't all match their material: the image named Equip_04 ORM is laid out on the robe's UVs
(the robe and wings' own slots hold glass gradient strips), so the robe and wings use it and the camisole, which
shares the outfit's UV layout, uses the outfit's. layout_check() compares each ORM's edges with its colour map's.
A model may use at most 4 materials (Penumbra's MdlMaterialMaximum, the most vanilla gear uses), so texture sets
that share a gear slot are packed into one material's atlas (MATERIALS): the outfit, camisole, flowers and wings
into a 2x2 "cloth" atlas, the head and eyes into a 2:1 "face" atlas. build.py moves each part's UVs into its tile.
Nothing glows, so every material shares one empty _id.
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
GAME_DIR = "chara/equipment/e6211/texture/mantis"
P = "MI_1020309_"
# texset -> (baked albedo, normal map or None, ORM map or None, size, specular 0-255, roughness 0-255 when no ORM,
#            cut-out (opacity from the albedo's alpha))
TEXSETS = {
    "head": ("Head", P + "Head_gltf_normal", P + "Head_gltf_orm", 1024, 60, 170, False),
    "hair": ("Hair_01", None, None, 2048, 90, 110, True),
    "lines": ("Hair_03", None, None, 1024, 0, 255, True),
    "eyes": ("Eyes_01", None, None, 512, 60, 220, False),    # matte, as the source's (scleraRoughness 1)
    "body": ("Body", P + "Body_gltf_normal", P + "Body_gltf_orm", 1024, 60, 170, False),
    "robe": ("Equip_01", P + "Equip_01_gltf_normal", P + "Equip_04_gltf_orm", 1024, 50, 200, False),
    "wings": ("Equip_03", P + "Equip_01_gltf_normal", P + "Equip_04_gltf_orm", 1024, 120, 90, False),
    "cami": ("Equip_04", P + "Equip_02_gltf_normal", P + "Equip_02_gltf_orm", 1024, 50, 200, False),
    "outfit": ("Equip_02", P + "Equip_02_gltf_normal", P + "Equip_02_gltf_orm", 1024, 50, 200, False),
    "fluff": ("Equip_05", P + "Equip_02_gltf_normal", P + "Equip_02_gltf_orm", 1024, 30, 230, False),
}
# material -> its texture sets as rows of tiles (top row first)
MATERIALS = {
    "body": [["body"]],
    "robe": [["robe"]],
    "cloth": [["outfit", "cami"], ["fluff", "wings"]],
    "face": [["head", "eyes"]],
    "hair": [["hair"]],
    "lines": [["lines"]],
}
TILE = 1024         # tile size in an atlas
FLAT = 64
AO_SCALE = 0.0      # x the material's aoIntensity: 0 = the game's own occlusion only (see _mask above)
# Colour lift (1.2.0, Neon 1.2.0's): the user on Neon 1.2.0, "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like
# color intensity is what im looking for". texset -> (luminance gamma, saturation), on the baked albedo. The black
# line-art shell ("lines": brows, lashes, hair outlines) stays as it was.
LIFT = {t: (1.4, 1.2) for t in ("head", "hair", "eyes", "body", "robe", "wings", "cami", "outfit", "fluff")}
LUMA = np.array([0.2126, 0.7152, 0.0722])


def tile_of(texset):
    """(material, column, row, columns, rows) of a texture set."""
    for mat, grid in MATERIALS.items():
        for r, row in enumerate(grid):
            if texset in row:
                return mat, row.index(texset), r, len(row), len(grid)
    raise KeyError(texset)


def cutout(mat):
    return any(TEXSETS[t][6] for row in MATERIALS[mat] for t in row)


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


def png(path, size, mode="RGB"):
    im = Image.open(path).convert(mode)
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).copy()


def tex(name, size, mode="RGB"):
    return png(os.path.join(sd.TEX, name + ".png"), size, mode)


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


def curl_test(name):
    """Median curl / gradient of the slope field read green-up and green-down: a real normal map comes from a height
    field, so the right reading is (nearly) curl-free."""
    a = tex(name, 1024).astype(float) / 127.5 - 1
    nx, ny = a[..., 0], a[..., 1]
    nz = np.sqrt(np.clip(1 - nx ** 2 - ny ** 2, 1e-3, 1))
    res = {}
    for label, sign in (("green up", 1), ("green down", -1)):
        p, q = -nx / nz, -(sign * ny) / nz
        dp = -(p[2:, 1:-1] - p[:-2, 1:-1]) / 2
        dq = (q[1:-1, 2:] - q[1:-1, :-2]) / 2
        g = np.abs(dp) + np.abs(dq) + 1e-6
        m = g > 0.02
        res[label] = float(np.median(np.abs(dp - dq)[m] / g[m]))
    return res


def layout_check(texset, size=512):
    """Correlation of the ORM occlusion's edges with the source colour map's: near 0 means the ORM belongs to
    another UV layout."""
    albedo, _, orm, _, _, _, _ = TEXSETS[texset]
    base_src = sd.material(albedo)["baseColor"]

    def edges(a):
        a = a.astype(float)
        return np.abs(np.diff(a, axis=1))[:-1, :] + np.abs(np.diff(a, axis=0))[:, :-1]
    e1, e2 = edges(tex(orm, size, "RGB")[..., 0]), edges(tex(base_src, size, "L"))
    return float(np.corrcoef(e1.ravel(), e2.ravel())[0, 1])


def maps(texset, size):
    """base RGB, norm (RG normal, B opacity) and mask (R specular, G roughness, B occlusion: 255 at AO_SCALE 0) of
    one set, RGBA."""
    albedo, normal, orm, _, spec, rough, cut = TEXSETS[texset]
    base = png(os.path.join(sd.ALBEDO, albedo + ".png"), size, "RGBA")
    full = np.full((size, size), 255, np.uint8)
    if normal:
        g = tex(normal, size)
        nx, ny = g[..., 0], 255 - g[..., 1]
    else:
        nx = ny = np.full((size, size), 128, np.uint8)
    n = stack(nx, ny, base[..., 3] if cut else full, full)
    if orm:
        o = tex(orm, size)
        k = float(sd.material(albedo)["params"].get("inputs", {}).get("aoIntensity") or 0) * AO_SCALE
        ao = np.round(255 - (255 - o[..., 0].astype(float)) * k).astype(np.uint8)
        rg = np.clip(o[..., 1], 40, 255)
    else:
        ao, rg = full, np.full((size, size), rough)
    rgb = lift(base[..., :3], *LIFT[texset]) if texset in LIFT else base[..., :3]
    return np.dstack([rgb, full]), n, stack(np.full((size, size), spec), rg, ao, full)


def build():
    out = {}
    for nm in sorted({v[1] for v in TEXSETS.values() if v[1]}):
        print("  curl", nm, {k: round(v, 3) for k, v in curl_test(nm).items()})
    for t, v in TEXSETS.items():
        if v[2]:
            c = layout_check(t)
            print(f"  ORM layout {t}: edge correlation {c:.3f}" + ("  <-- WRONG LAYOUT?" if c < 0.05 else ""))
    flat = np.full((FLAT, FLAT), 255, np.uint8)
    zero = np.zeros((FLAT, FLAT), np.uint8)
    out["flat_id"] = write("flat_id", stack(zero, zero, zero, flat), "bc5")
    for mat, grid in MATERIALS.items():
        print(mat, grid)
        size = TEXSETS[grid[0][0]][3] if len(grid) == 1 and len(grid[0]) == 1 else TILE
        tiles = [[maps(t, size) for t in row] for row in grid]
        for k, kind in enumerate(("base", "norm", "mask")):
            img = np.vstack([np.hstack([t[k] for t in row]) for row in tiles])
            if kind == "mask" and size > 1024:      # shine and roughness are soft: no need for the colour's resolution
                img = np.asarray(Image.fromarray(img).resize((img.shape[1] // 2, img.shape[0] // 2), Image.LANCZOS))
            out[f"{mat}_{kind}"] = write(f"{mat}_{kind}", img, "bc7")
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


if __name__ == "__main__":
    build()
