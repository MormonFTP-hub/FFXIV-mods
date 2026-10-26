"""Build the FFXIV textures (Dawntrail character.shpk layout) for each material in MATERIALS, from the texture sets
in fit.TEXSET.

Per material:     _base  RGB colour (the viewer's colour logic baked by shade.py)               BC7
                  _norm  RG normal (the rip's maps are DirectX-style, so G is flipped to FFXIV's green-up),
                         B opacity (alpha test at 0.5)                                            BC7
                  _mask  R specular, G roughness (the rip's ORM green), B occlusion (ORM red)     BC7
Sets that share one source atlas (gear: Equip_01/08/09/10, suit: Equip_03/Body_01) are composited per UV
island: each material's own colour wherever its triangles land. The procedural shaders the viewer runs live
(galaxy hair, eyes, jelly and crystal) are approximated here:
  hair  the rip's grey strands tinted violet at the roots to magenta at the tips (colours picked from the viewer)
  eyes  iris + sclera from the eye shader's own maps and parameters, both irises side by side
  orb   flat colour patches for the collar gem and the black-hole belt orb
A model may use at most 4 materials (Penumbra's MdlMaterialMaximum, the most vanilla gear uses), so the gear,
skirt and glass sets (the same plain shading, about the same texel density) share one 2x2 "outfit" atlas
(MATERIALS; the fourth tile is empty). The skin-and-suit set and the two glowing sets (stars, orb) keep their own
materials. build.py moves each part's UVs into its tile.
"""
import json
import os
import pickle
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shade  # noqa: E402
import srcdata as sd  # noqa: E402
import xivdata as xd  # noqa: E402
from fit import ORB_UV, TEXSET  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "tex")
PNG = os.path.join(ROOT, "work", "build", "texpng")
GAME_DIR = "chara/equipment/e6252/texture/luna"
SIZE = 1024
# texset -> (specular 0-255, roughness when the rip has no ORM 0-255)
SURFACE = {"gear": (150, 110), "suit": (90, 120), "skirt": (60, 170), "glass": (160, 70), "stars": (170, 80),
           "orb": (220, 30), "head": (50, 175), "eyes": (200, 40), "hair": (100, 120)}
# hair tint, sRGB, along the strands (UV v: 0 roots .. 1 tips)
HAIR_GRADIENT = [(0.0, (112, 70, 214)), (0.35, (138, 62, 212)), (0.7, (180, 58, 196)), (1.0, (226, 72, 176))]
ORB_COLOR = {"Equip_06": (196, 226, 255), "Equip_07": (24, 10, 40)}
# material -> its texture sets as rows of tiles (top row first, None = an empty tile); every tile is SIZE square
MATERIALS = {"outfit": [["gear", "skirt"], ["glass", None]], "suit": [["suit"]], "stars": [["stars"]],
             "orb": [["orb"]], "head": [["head"]], "eyes": [["eyes"]], "hair": [["hair"]]}
# Colour lift (1.1.0, Neon's 1.2.0 lift; the user on Neon: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like
# color intensity is what im looking for"): texset -> (luminance gamma, saturation) on the _base RGB; alpha untouched
LIFT = {ts: (1.4, 1.2) for ts in ("gear", "skirt", "glass", "suit", "stars", "orb", "head", "eyes", "hair")}
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


def tile_of(texset):
    """(material, column, row, columns, rows) of a texture set."""
    for material, grid in MATERIALS.items():
        for r, row in enumerate(grid):
            if texset in row:
                return material, row.index(texset), r, len(row), len(grid)
    raise KeyError(texset)


def tex(name, size=SIZE, mode="RGBA"):
    im = Image.open(os.path.join(sd.TEX, name + ".png")).convert(mode)
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).copy()


def albedo(mat, size=SIZE):
    im = Image.open(os.path.join(sd.ALBEDO, mat + ".png")).convert("RGBA")
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).copy()


def raster(uv, faces, size, pad=2):
    """Pixel mask of a mesh's UV triangles (glTF UV, v down), grown by `pad` pixels to cover mip bleed."""
    mask = np.zeros((size, size), bool)
    P = uv[faces] * size - 0.5
    for t in P:
        x0, y0 = np.floor(t.min(0)).astype(int) - 1
        x1, y1 = np.ceil(t.max(0)).astype(int) + 1
        x0, y0 = max(x0, 0), max(y0, 0)
        x1, y1 = min(x1, size - 1), min(y1, size - 1)
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        a, b, c = t
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-12:
            continue
        l1 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / d
        l2 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / d
        e = 0.5 / max(abs(d), 1.0) ** 0.5 + 0.02
        inside = (l1 >= -e) & (l2 >= -e) & (1 - l1 - l2 >= -e)
        mask[ys[inside], xs[inside]] = True
    for _ in range(pad):
        m = mask.copy()
        m[1:] |= mask[:-1]
        m[:-1] |= mask[1:]
        m[:, 1:] |= mask[:, :-1]
        m[:, :-1] |= mask[:, 1:]
        mask = m
    return mask


def normal_rgb(name, size=SIZE):
    if not name:
        return None
    n = tex(name, size, "RGB").astype(np.int32)
    n[..., 1] = 255 - n[..., 1]          # DirectX (green-down) -> FFXIV green-up
    return n.astype(np.uint8)


def composite(texset, mats):
    """Base colour, normal RG and ORM (or None) for a texture set, composited by each material's UV islands."""
    sc = sd.scene()["materials"]
    base = np.zeros((SIZE, SIZE, 3), np.uint8)
    nrm = np.full((SIZE, SIZE, 2), 128, np.uint8)
    orm = np.zeros((SIZE, SIZE, 3), np.uint8)
    have_orm = np.zeros((SIZE, SIZE), bool)
    islands = [np.ones((SIZE, SIZE), bool)]      # everything outside the islands takes the first material
    for mat in mats[1:]:
        mesh = sd.mesh(mat)
        islands.append(raster(mesh["uv0"], mesh["faces"], SIZE))
    if len(mats) > 1:
        own = [raster(sd.mesh(mats[0])["uv0"], sd.mesh(mats[0])["faces"], SIZE, pad=0)] + islands[1:]
        for i in range(len(mats)):
            for j in range(i + 1, len(mats)):
                c = (own[i] & own[j]).sum()
                if c:
                    print(f"    {mats[i]} / {mats[j]}: {c} px of UV shared ({c / own[j].sum():.1%} of {mats[j]})")
    for i, mat in enumerate(mats):
        m = sc[mat]
        a = albedo(mat)[..., :3]
        n = normal_rgb(m["normal"]) if m["normal"] and "Equip_07" not in m["normal"] else None
        o = tex(m["orm"], SIZE, "RGB") if m["orm"] and "Equip_07" not in m["orm"] else None
        sel = islands[i]
        base[sel] = a[sel]
        if n is not None:
            nrm[sel] = n[sel][:, :2]
        else:
            nrm[sel] = 128
        if o is not None:
            orm[sel] = o[sel]
            have_orm[sel] = True
        else:
            have_orm[sel] = False
    return base, nrm, (orm if have_orm.any() else None), have_orm


def hair_base():
    g = tex("MI_1031502_Hair_01_gltf_baseColor", SIZE, "RGB").astype(float) / 255
    lum = g @ np.array([0.3, 0.59, 0.11])
    sat = g.max(-1) - g.min(-1)
    v = (np.arange(SIZE) + 0.5) / SIZE
    stops = np.array([s for s, _ in HAIR_GRADIENT])
    cols = np.array([c for _, c in HAIR_GRADIENT], float) / 255
    grad = np.stack([np.interp(v, stops, cols[:, k]) for k in range(3)], -1)[:, None, :]
    ref = np.median(lum[lum > 0.15])
    shade_ = np.clip(lum / ref, 0, 1.6) ** 0.8
    tinted = np.clip(grad * shade_[..., None], 0, 1)
    keep = (sat > 0.12)[..., None]                       # the blue ribbon and other coloured bits stay as they are
    out = np.where(keep, g, tinted)
    alpha = tex("MI_1031502_Hair_01_opacityMask", SIZE, "L")
    out = bleed(out, alpha >= 128)                      # no dark fringe where the alpha test cuts between strands
    return np.round(out * 255).astype(np.uint8), alpha


def bleed(rgb, solid):
    """Push-pull fill: colour every cut-out texel with the average of the nearest solid ones."""
    levels = [(rgb * solid[..., None], solid.astype(float))]
    while levels[-1][1].shape[0] > 1:
        c, w = levels[-1]
        c = (c[0::2, 0::2] + c[1::2, 0::2] + c[0::2, 1::2] + c[1::2, 1::2])
        w = (w[0::2, 0::2] + w[1::2, 0::2] + w[0::2, 1::2] + w[1::2, 1::2])
        levels.append((c, w))
    fill = levels[-1][0] / np.maximum(levels[-1][1], 1e-9)[..., None]
    for c, w in reversed(levels[:-1]):
        fill = np.repeat(np.repeat(fill, 2, 0), 2, 1)
        have = w > 0
        fill = np.where(have[..., None], c / np.maximum(w, 1e-9)[..., None], fill)
    return np.where(solid[..., None], rgb, fill)


def eye_base():
    """Both eyes (left eye left half, right eye right half), as the viewer's eye shader composes them."""
    P = sd.scene()["materials"]["Eyes_01"]["params"]["inputs"]
    X = sd.scene()["materials"]["Eyes_01"]["extra"]
    n = 512
    v, u = np.mgrid[0:n, 0:n]
    Z = np.stack([(u + 0.5) / n - 0.5, (v + 0.5) / n - 0.5], -1)
    r = np.linalg.norm(Z, axis=-1)
    q = P["irisUvRadius"]
    ee = np.clip((r - q) * -(1 / P["irisBorderWidth"]), 0, 1)
    ee = ee * ee * (3 - 2 * ee)
    uu = Z * (0.5 / q)
    O = np.clip((np.linalg.norm(uu, axis=-1) - 0.45) * -4, 0, 1) ** 0.7
    Hh = np.stack([uu[..., 0] + O * (-0.1 * P["pupilShiftX"]), uu[..., 1] + O * (0.1 * P["pupilShiftY"])], -1)
    hl = np.maximum(np.linalg.norm(Hh, axis=-1), 1e-4)
    G = Hh * (0.5 / hl)[..., None]
    z = np.clip((1 - hl * 2) * P["pupilScale"], 0, 1)
    ea = G * (1 - z)[..., None] + 0.5
    el = ea - 0.5

    def sample(name, uvs, lin=True):
        im = np.asarray(Image.open(os.path.join(sd.TEX, name + ".png")).convert("RGB"), float) / 255
        h, w = im.shape[:2]
        x = np.clip(np.round(uvs[..., 0] * w - 0.5), 0, w - 1).astype(int)
        y = np.clip(np.round(uvs[..., 1] * h - 0.5), 0, h - 1).astype(int)
        c = im[y, x]
        return shade.srgb_to_lin(c) if lin else c

    er = Z * (1 / P["scleraScale"]) + 0.5
    es = sample(X["scleraBaseColorStatic"], er) * np.array(P["scleraTint"])
    ei = es + (es * np.array(P["irisBleedTint"]) - es) * ee[..., None]
    eu = np.clip(1 - np.linalg.norm(el * P["limbusDarkScale"], axis=-1) ** P["limbusDarkPower"], 0, 1)
    halves = []
    for key in ("irisBaseColorMap", "irisBaseColorRightMap"):
        eo = sample(X[key], ea)
        eg = eo * np.array(P["irisBaseColorMulti"]) * eu[..., None] * P["irisBrightness"]
        eh = ei + (eg - ei) * ee[..., None]
        halves.append(eh)
    out = np.concatenate(halves, 1)
    return np.round(shade.lin_to_srgb(out) * 255).astype(np.uint8)


def write(name, rgba, fmt):
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(PNG, exist_ok=True)
    Image.fromarray(rgba).save(os.path.join(PNG, name + ".png"))
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


def maps(ts, mats):
    """base (RGB colour, A opacity), norm (RG normal, B opacity) and mask (R specular, G roughness, B occlusion) of
    one texture set, RGBA."""
    print(ts, mats)
    spec, rough = SURFACE[ts]
    alpha = None
    if ts == "orb":
        base = np.zeros((64, 64, 3), np.uint8)
        for mat, (u, _) in ORB_UV.items():
            base[:, int(u * 64) - 16:int(u * 64) + 16] = ORB_COLOR[mat]
        nrm = np.full((64, 64, 2), 128, np.uint8)
        orm, have_orm = None, None
    elif ts == "eyes":
        base = eye_base()
        nrm = np.full(base.shape[:2] + (2,), 128, np.uint8)
        orm, have_orm = None, None
    else:
        base, nrm, orm, have_orm = composite(ts, mats)
        if ts == "hair":
            base, alpha = hair_base()
    if ts in LIFT:
        base = lift(base[..., :3], *LIFT[ts])
    h, w = base.shape[:2]
    full = np.full((h, w), 255, np.uint8)
    if alpha is None:
        alpha = full
    g = np.full((h, w), rough, np.uint8)
    ao = full
    if orm is not None:
        g = np.where(have_orm, orm[..., 1], rough).astype(np.uint8)
        ao = np.where(have_orm, orm[..., 0], 255).astype(np.uint8)
    return (np.dstack([base, alpha]), stack(nrm[..., 0], nrm[..., 1], alpha, full),
            stack(np.full((h, w), spec), g, ao, full))


def blank(size):
    """An empty atlas tile: mid grey, flat, matte, opaque."""
    full = np.full((size, size), 255, np.uint8)
    grey = np.full((size, size), 128, np.uint8)
    return stack(grey, grey, grey, full), stack(grey, grey, full, full), stack(np.zeros((size, size)), full, full, full)


def build():
    sets = {}
    for mat, ts in TEXSET.items():
        sets.setdefault(ts, []).append(mat)
    tiled = [t for grid in MATERIALS.values() for row in grid for t in row if t]
    assert sorted(tiled) == sorted(sets), (tiled, list(sets))     # every texture set in exactly one material
    os.makedirs(PNG, exist_ok=True)
    out = {}
    for material, grid in MATERIALS.items():
        print(material, grid)
        tiles = [[maps(ts, sets[ts]) if ts else None for ts in row] for row in grid]
        if len(grid) > 1 or len(grid[0]) > 1:      # an atlas: SIZE-square tiles
            for row, names in zip(tiles, grid):
                for t, ts in zip(row, names):
                    if t is not None:
                        assert t[0].shape[:2] == (SIZE, SIZE), (ts, t[0].shape)
                        Image.fromarray(t[0]).save(os.path.join(PNG, f"{ts}_base.png"))  # check_fit.py: fit UVs
            tiles = [[t if t is not None else blank(SIZE) for t in row] for row in tiles]
        for k, kind in enumerate(("base", "norm", "mask")):
            img = np.vstack([np.hstack([t[k] for t in row]) for row in tiles])
            out[f"{material}_{kind}"] = write(f"{material}_{kind}", img, "bc7")
    zero = np.zeros((64, 64), np.uint8)
    out["flat_id"] = write("flat_id", stack(zero, zero, zero, np.full((64, 64), 255)), "bc5")
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


if __name__ == "__main__":
    build()
