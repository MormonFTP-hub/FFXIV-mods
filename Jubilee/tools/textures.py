"""Build the FFXIV textures (Dawntrail character.shpk layout) from Jubilee's decoded textures (work/src/tex).

Per texture set:  _base  RGB colour, then Neon's colour lift (LIFT)                                BC7
                  _norm  RG normal, B = opacity                                                      BC7
                         The rip's normal maps are DirectX-style (green down): read as green-down their slopes
                         are about half as far from curl-free as read green-up, on every set. G is flipped to
                         FFXIV's green-up.
                  _mask  R specular (the rip's specular map), G roughness, B occlusion (ORM red)       BC7
All four sets share one empty _id (no colour-table rows, no glow).

To keep every model at three materials or fewer, five of her seven source sets are packed side by side into
2:1 atlases (ATLAS: texture set -> (material, half)); tools/build.py moves their UVs into the right half.
  skin   her body                                                    1024 x 1024
  face   her head | her eyes                                         2048 x 1024
  cloth  shorts, crop top, slippers (pink) | jacket, hat, warmers    2048 x 1024
  hair   her hair | eyebrows, lashes, the translucent fringe, sprinkles   2048 x 1024
Baked halves:
  hair   the hair's colour lives in its shadow-colour map on the second UV set (the strand UVs are shared
         between cards), so the hair is laid out on that UV set: colour from the shadow map, opacity from the
         strand mask, carried over triangle by triangle
  cards  the fringe strands are grey in the rip (the shader lights them); they are recoloured to the hair's
         average shadow colour
  eyes   the eye shader's sclera and iris composited into one map in the eyeball's UV space
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
GAME_DIR = "chara/equipment/e6169/texture/jubilee"
S = 1024
ATLAS = {"skin": ("skin", None), "face": ("face", 0), "eyes": ("face", 1), "pink": ("cloth", 0),
         "fluff": ("cloth", 1), "hair": ("hair", 0), "cards": ("hair", 1)}
MATERIALS = ("skin", "face", "cloth", "hair")
# source set -> (prefix of its glTF maps, specular scale on the rip's specular map, roughness 0-255)
PBR = {"skin": ("Body", 1.4, 175), "face": ("Head", 1.4, 175), "pink": ("Equip_04", 1.0, 190),
       "fluff": ("Equip_02", 1.0, 215)}
HAIR_LIFT = 1.15              # the shadow colour is what the game shows most of; a little lighter for FFXIV's light
CARD_GREY = 165               # the rip's grey fringe colour
# Colour lift (1.1.0, Neon 1.2.0's): the user on Neon 1.2.0, "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like
# color intensity is what im looking for". source set -> (luminance gamma, saturation), on each finished colour half.
# The cards half (fringe strands in the hair's colour, brows, lashes, sprinkles) is lifted to keep matching the hair.
LIFT = {k: (1.4, 1.2) for k in ("skin", "face", "eyes", "pink", "fluff", "hair", "cards")}
LUMA = np.array([0.2126, 0.7152, 0.0722])


def to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def lift(rgb, gamma, sat):
    """Brighter colours (Neon's): luminance (sRGB-encoded) to the power 1/gamma with the hue kept, then saturation x sat
    in linear light; a channel past white scales the whole pixel down, keeping the hue."""
    lin = to_linear(np.clip(rgb, 0, 255).astype(np.float64) / 255)
    y = lin @ LUMA
    lin *= (to_linear(to_srgb(y) ** (1 / gamma)) / np.maximum(y, 1e-6))[..., None]
    y = lin @ LUMA
    lin = np.maximum(y[..., None] + (lin - y[..., None]) * sat, 0)
    peak = np.maximum(lin.max(-1, keepdims=True), 1.0)
    return (to_srgb(lin / peak) * 255 + 0.5).astype(np.uint8)


def load(name, size=S, mode="RGBA"):
    im = Image.open(os.path.join(sd.TEX, sd.PREFIX + name + ".png")).convert(mode)
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).astype(np.float64)


def write(name, rgba, fmt):
    os.makedirs(OUT, exist_ok=True)
    raw = os.path.join(OUT, name + ".raw")
    np.ascontiguousarray(np.clip(np.round(rgba), 0, 255), np.uint8).tofile(raw)
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
    return np.stack([np.broadcast_to(np.asarray(c, np.float64), shape) for c in chans], -1)


def flat_norm(opacity):
    return stack(np.full(opacity.shape, 128), np.full(opacity.shape, 128), opacity, np.full(opacity.shape, 255))


# ----------------------------------------------------------------------------- per-set maps

def pbr_set(key):
    """(colour RGB, normal RGBA, mask RGBA) for a set with real glTF maps."""
    prefix, spec_k, rough = PBR[key]
    col = load(prefix + "_gltf_baseColor")[..., :3]
    n = load(prefix + "_gltf_normal")
    orm = load(prefix + "_gltf_orm")
    spec = load(prefix + "_specularMap")[..., :3].mean(-1)
    full = np.full((S, S), 255.0)
    norm = stack(n[..., 0], 255 - n[..., 1], full, full)
    mask = stack(np.clip(spec * spec_k, 0, 255), rough * orm[..., 1] / 255, orm[..., 0], full)
    return col, norm, mask


def raster(tri_dst, tri_src, size):
    """Per destination texel inside some triangle: the source UV through that triangle's barycentrics.
    tri_dst, tri_src: (T, 3, 2) UVs (0..1, v down). Returns (src uv (size, size, 2), covered mask)."""
    src = np.zeros((size, size, 2))
    hit = np.zeros((size, size), bool)
    P = tri_dst * size - 0.5
    lo = np.floor(P.min(1)).astype(int)
    hi = np.ceil(P.max(1)).astype(int)
    for t in range(len(P)):
        x0, y0 = np.maximum(lo[t], 0)
        x1, y1 = np.minimum(hi[t], size - 1)
        if x1 < x0 or y1 < y0:
            continue
        ys, xs = np.mgrid[y0:y1 + 1, x0:x1 + 1]
        a, b, c = P[t]
        den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(den) < 1e-12:
            continue
        w0 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / den
        w1 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / den
        w2 = 1 - w0 - w1
        inside = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
        if not inside.any():
            continue
        uv = w0[..., None] * tri_src[t, 0] + w1[..., None] * tri_src[t, 1] + w2[..., None] * tri_src[t, 2]
        src[ys[inside], xs[inside]] = uv[inside]
        hit[ys[inside], xs[inside]] = True
    return src, hit


def sample(img, uv):
    """Bilinear lookup of img (H, W, C) at uv (..., 2) in 0..1 (v down)."""
    h, w = img.shape[:2]
    x = np.clip(uv[..., 0] * w - 0.5, 0, w - 1)
    y = np.clip(uv[..., 1] * h - 0.5, 0, h - 1)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    x1, y1 = np.minimum(x0 + 1, w - 1), np.minimum(y0 + 1, h - 1)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x1] * fx * (1 - fy) + img[y1, x0] * (1 - fx) * fy +
            img[y1, x1] * fx * fy)


def dilate(img, hit, steps=4):
    """Grow the covered texels' values outward by a few texels (keeps bilinear and mip edges clean)."""
    img, hit = img.copy(), hit.copy()
    for _ in range(steps):
        acc = np.zeros_like(img)
        cnt = np.zeros(hit.shape)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            h = np.roll(hit, (dy, dx), (0, 1))
            acc += np.roll(img, (dy, dx), (0, 1)) * h[..., None]
            cnt += h
        grow = ~hit & (cnt > 0)
        img[grow] = acc[grow] / cnt[grow][:, None]
        hit |= grow
    return img


def hair_set():
    """Her hair laid out on its second UV set: shadow-colour map for colour, strand mask carried over."""
    m = sd.mesh("Hair_01")
    shadow = load("Hair_01_shadowColorMap")[..., :3]
    strands = load("Hair_02_opacityMask")[..., :1]
    src, hit = raster(m["uv1"][m["faces"]], m["uv"][m["faces"]], S)
    alpha = np.where(hit, sample(strands, src)[..., 0], 0.0)
    alpha = dilate(alpha[..., None], hit, 2)[..., 0]
    print(f"  hair: {hit.mean():.2f} of the map covered by strands")
    col = np.clip(shadow * HAIR_LIFT, 0, 255)
    full = np.full((S, S), 255.0)
    mask = stack(np.full((S, S), 90), np.full((S, S), 120), full, full)
    return col, flat_norm(alpha), mask


def card_set():
    """Fringe strands, brows, lashes and sprinkles: the rip's colours, grey strands turned hair-coloured."""
    col = load("Hair_02_gltf_baseColor")[..., :3]
    alpha = load("Hair_02_opacityMask")[..., 0]
    hair = load("Hair_01_shadowColorMap")[..., :3].reshape(-1, 3).mean(0) * HAIR_LIFT
    v, u = (np.mgrid[0:S, 0:S] + 0.5) / S
    strand_area = (u < 0.37) | ((u < 0.56) & (v < 0.84)) | (v < 0.36)
    sat = col.max(-1) - col.min(-1)
    grey = strand_area & (sat < 25) & (col.mean(-1) > 110) & (col.mean(-1) < 215)
    col[grey] = hair * (col[grey].mean(-1, keepdims=True) / CARD_GREY)
    full = np.full((S, S), 255.0)
    mask = stack(np.full((S, S), 60), np.full((S, S), 150), full, full)
    return col, flat_norm(alpha), mask


def eye_set():
    """Sclera map with the iris laid in at the shader's iris radius, a soft limbus and the static highlight."""
    inp = sd.material("Eyes_01")["inputs"]
    R, border = inp["irisUvRadius"], inp["irisBorderWidth"]
    v, u = (np.mgrid[0:S, 0:S] + 0.5) / S
    d = np.stack([u - 0.5, v - 0.5], -1)
    r = np.linalg.norm(d, axis=-1)
    sclera = load("Eyes_01_scleraBaseColorMap")[..., :3] * np.array(inp["scleraTint"])
    iris = sample(load("Eyes_01_irisBaseColorMap")[..., :3], d / (2 * R) + 0.5)
    iris *= np.array(inp["irisBaseColorMulti"]) * inp["irisBrightness"]
    iris *= (1 - 0.45 * np.clip((r - 0.72 * R) / (0.28 * R), 0, 1))[..., None]          # darker limbus
    t = np.clip((R - r) / border + 0.5, 0, 1)[..., None]
    col = sclera * (1 - t) + iris * t
    hl = load("Eyes_01_highlightMaskStatic")[..., :1] / 255
    col = col * (1 - 0.85 * hl) + 255 * 0.85 * hl
    full = np.full((S, S), 255.0)
    mask = stack(np.full((S, S), 200), np.full((S, S), 40), full, full)
    return np.clip(col, 0, 255), flat_norm(full), mask


# ----------------------------------------------------------------------------- build

def build():
    halves = {"skin": pbr_set("skin"), "face": pbr_set("face"), "pink": pbr_set("pink"), "fluff": pbr_set("fluff"),
              "hair": hair_set(), "cards": card_set(), "eyes": eye_set()}
    for key, (gamma, sat) in LIFT.items():
        col, norm, mask = halves[key]
        halves[key] = (lift(col, gamma, sat).astype(np.float64), norm, mask)
    out = {}
    zero = np.zeros((64, 64))
    out["flat_id"] = write("flat_id", stack(zero, zero, zero, np.full((64, 64), 255)), "bc5")
    for mat in MATERIALS:
        parts = sorted((half, key) for key, (m, half) in ATLAS.items() if m == mat)
        maps = [halves[key] for _, key in parts]
        col, norm, mask = (np.concatenate([mp[i] for mp in maps], 1) for i in range(3))
        print(mat, "<-", ", ".join(k for _, k in parts), col.shape[1], "x", col.shape[0])
        out[f"{mat}_base"] = write(f"{mat}_base", np.dstack([col, np.full(col.shape[:2], 255)]), "bc7")
        out[f"{mat}_norm"] = write(f"{mat}_norm", norm, "bc7")
        out[f"{mat}_mask"] = write(f"{mat}_mask", mask, "bc7")
        Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).save(os.path.join(OUT, f"{mat}_base.png"))
        Image.fromarray(np.clip(norm[..., 2], 0, 255).astype(np.uint8)).save(os.path.join(OUT, f"{mat}_alpha.png"))
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


def atlas_uv(texset, uv):
    """A part's UVs (0..1, v down) moved into its half of the material's atlas."""
    _, half = ATLAS[texset]
    if half is None:
        return uv
    return np.c_[(uv[:, 0] + half) / 2, uv[:, 1]]


if __name__ == "__main__":
    build()
