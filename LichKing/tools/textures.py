"""Build the FFXIV textures (Dawntrail character.shpk layout) from the WoW textures in source/lichking.

Per texture set:  _base  RGB albedo, A = opacity                      (BC7)
                  _norm  RG normal (green up) from the painted detail, B = opacity  (BC7)
                  _mask  R specular, G roughness factor, B occlusion   (BC7)
                  _id    R = colour-table row pair * 17, G = blend to the pair's glowing odd row  (BC5)

WoW keeps a reflection mask in the alpha of opaque surfaces; it is opacity only on the cape, hair and fur.
So each texel's surface kind comes from the shading groups whose UVs cover it (rasterised), and bright
ice-blue paint (eyes, gems, runes) is made to glow through the colour table.

Sets: lk_a (arthaslichking_01), lk_b (arthaslichking_02), lk_mist (eye glow), fm (Frostmourne).
Colour lift (1.1.0, Neon's): the painted sets' _base luminance is raised by a gamma (dark and mid tones most), hue kept,
then saturation scaled in linear light. Only _base changes: bumps, occlusion and the glow mask still come from the
unlifted paint, and the alpha stays as it was. The eye mist (a glowing, alpha-only card) is not lifted.
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
SRC = os.path.join(ROOT, "source", "lichking")
OUT = os.path.join(ROOT, "work", "build", "tex")
GEAR_DIR = "chara/equipment/e0757/texture/lichking"
WEAPON_DIR = "chara/weapon/w1501/obj/body/b0037/texture/frostmourne"
SIZE = 1024

PAIRS = {"metal": 0, "leather": 1, "cloth": 2, "cape": 3, "fur": 4, "skin": 5, "hair": 6, "steel": 7, "hilt": 8,
         "mist": 9}
SURFACE = {  # shading group -> (texture set, surface kind, alpha is opacity)
    "helm": ("lk_a", "metal", False), "shoulders": ("lk_a", "metal", False), "shoulders2": ("lk_a", "metal", False),
    "cape": ("lk_a", "cape", True), "cape1": ("lk_a", "cape", True), "cloth": ("lk_a", "cloth", False),
    "head": ("lk_a", "skin", False), "hair": ("lk_a", "hair", True),
    "metal": ("lk_b", "metal", False), "aiStandardSurface51SG": ("lk_b", "metal", False),
    "leather": ("lk_b", "leather", False), "fur": ("lk_b", "fur", True),
    "eyes_glow": ("lk_mist", "mist", True),
    "sword1": ("fm", "steel", False), "sword_runes": ("fm", "steel", False), "rune": ("fm", "steel", False),
    "sword_hilt": ("fm", "hilt", False), "sword_hilt2": ("fm", "hilt", False), "sword_eyes": ("fm", "hilt", False),
}
# The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for"
LIFT = {"lk_a": (1.4, 1.2), "lk_b": (1.4, 1.2), "fm": (1.4, 1.2)}   # texset -> (luminance gamma, saturation)
LUMA = np.array([0.2126, 0.7152, 0.0722])
SOURCE = {"lk_a": "arthaslichking_01.png", "lk_b": "arthaslichking_02.png", "fm": "sword_2h_frostmourne_arthas2.png"}


# ----------------------------------------------------------------------------- helpers

def load(name, size=None):
    im = Image.open(os.path.join(SRC, name)).convert("RGBA")
    if size and im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255


def write(name, rgba, fmt):
    os.makedirs(OUT, exist_ok=True)
    rgba = np.ascontiguousarray(np.clip(rgba * 255 + 0.5, 0, 255).astype(np.uint8))
    Image.fromarray(rgba).save(os.path.join(OUT, name + ".png"))
    raw = os.path.join(OUT, name + ".raw")
    rgba.tofile(raw)
    dst = os.path.join(OUT, name + ".tex")
    r = subprocess.run(xd.XIVTOOL + ["rgba2tex", raw, str(rgba.shape[1]), str(rgba.shape[0]), dst, fmt],
                       capture_output=True, text=True)
    os.remove(raw)
    if r.returncode != 0 or "wrote" not in r.stdout:
        raise RuntimeError(r.stdout + r.stderr)
    print("  ", r.stdout.strip())
    return dst


def to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def lift(rgb, gamma, sat):
    """Brighter colours: luminance (sRGB-encoded) to the power 1/gamma with the hue kept, then saturation x sat.
    rgb: 0..1 floats, as the rest of this file uses (quantised to 8 bits first, as Neon's)."""
    lin = to_linear(np.round(np.clip(rgb, 0, 1) * 255) / 255)
    y = lin @ LUMA
    lin *= (to_linear(to_srgb(y) ** (1 / gamma)) / np.maximum(y, 1e-6))[..., None]
    y = lin @ LUMA
    lin = np.maximum(y[..., None] + (lin - y[..., None]) * sat, 0)
    peak = np.maximum(lin.max(-1, keepdims=True), 1.0)         # a channel past white scales the pixel, keeping hue
    return np.round(to_srgb(lin / peak) * 255) / 255


def luma(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def blur(a, sigma):
    r = max(1, int(sigma * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    out = a.astype(np.float32)
    for axis in (0, 1):
        p = np.pad(out, [(r, r) if i == axis else (0, 0) for i in range(out.ndim)], mode="edge")
        out = sum(k[i] * np.take(p, np.arange(i, i + out.shape[axis]), axis=axis) for i in range(2 * r + 1))
    return out


def normal_from_height(h, strength):
    gy, gx = np.gradient(h)
    n = np.stack([-gx * strength, gy * strength, np.ones_like(h)], -1)  # green up
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def hsv(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, (g - b) / np.maximum(d, 1e-6) % 6,
                 np.where(mx == g, (b - r) / np.maximum(d, 1e-6) + 2, (r - g) / np.maximum(d, 1e-6) + 4)) * 60
    return h, s, mx


def rasterize(size, tris_uv, labels):
    """Label map (size x size, -1 empty): UV triangles (T,3,2, OBJ v-up) painted with their label."""
    lab = np.full((size, size), -1, np.int16)
    px = np.stack([tris_uv[..., 0] * size - 0.5, (1 - tris_uv[..., 1]) * size - 0.5], -1)
    for (a, b_, c), label in zip(px, labels):
        lo = np.clip(np.floor(np.minimum(np.minimum(a, b_), c)).astype(int), 0, size - 1)
        hi = np.clip(np.ceil(np.maximum(np.maximum(a, b_), c)).astype(int), 0, size - 1)
        xs, ys = np.meshgrid(np.arange(lo[0], hi[0] + 1), np.arange(lo[1], hi[1] + 1))
        p = np.stack([xs.ravel(), ys.ravel()], 1).astype(float)
        v0, v1 = b_ - a, c - a
        den = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(den) < 1e-12:
            continue
        d = p - a
        s = (d[:, 0] * v1[1] - v1[0] * d[:, 1]) / den
        t = (v0[0] * d[:, 1] - d[:, 0] * v0[1]) / den
        inside = (s >= -0.02) & (t >= -0.02) & (s + t <= 1.02)
        q = p[inside].astype(int)
        lab[q[:, 1], q[:, 0]] = label
    return lab


def dilate(lab, iters=16):
    lab = lab.copy()
    for _ in range(iters):
        empty = lab < 0
        if not empty.any():
            break
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sh = np.roll(lab, (dy, dx), (0, 1))
            fill = empty & (sh >= 0) & (lab < 0)
            lab[fill] = sh[fill]
    return lab


def surface_maps(texset, meshes, size):
    """(kind label map, opacity-from-alpha mask) for a texture set from the meshes' shading groups."""
    kinds = list(PAIRS)
    tris, labs, alpha_tris, alpha_labs = [], [], [], []
    for m in meshes:
        for mat in np.unique(m["material"]):
            ts, kind, opaque_alpha = SURFACE[mat]
            if ts != texset:
                continue
            sel = m["material"] == mat
            tris.append(m["uv"][sel])
            labs.append(np.full(sel.sum(), kinds.index(kind)))
            alpha_tris.append(m["uv"][sel])
            alpha_labs.append(np.full(sel.sum(), int(opaque_alpha)))
    lab = dilate(rasterize(size, np.concatenate(tris), np.concatenate(labs)))
    lab[lab < 0] = kinds.index("metal")
    use_alpha = dilate(rasterize(size, np.concatenate(alpha_tris), np.concatenate(alpha_labs)))
    return lab, use_alpha == 1


def glow_mask(rgb):
    """Bright, saturated ice blue -> 0..1 glow strength."""
    h, s, v = hsv(rgb)
    blue = np.clip(1 - np.abs(h - 195) / 30, 0, 1)
    return np.clip(blue * np.clip((s - 0.35) / 0.3, 0, 1) * np.clip((v - 0.45) / 0.3, 0, 1) * 1.6, 0, 1)


# ----------------------------------------------------------------------------- sets

def painted_set(texset, meshes, out):
    """lk_a, lk_b, fm: WoW diffuse -> base / norm / mask / id."""
    src = load(SOURCE[texset], (SIZE, SIZE))
    rgb, a = src[..., :3], src[..., 3]
    lab, use_alpha = surface_maps(texset, meshes, SIZE)
    kinds = list(PAIRS)
    opacity = np.where(use_alpha, a, 1.0)
    color = lift(rgb, *LIFT[texset]) if texset in LIFT else rgb
    out[f"{texset}_base"] = write(f"{texset}_base", np.dstack([color, opacity]), "bc7")
    h = blur(luma(rgb), 1.0)
    n = normal_from_height(h, 4.0)
    out[f"{texset}_norm"] = write(f"{texset}_norm", np.dstack([n[..., 0], n[..., 1], opacity, np.ones_like(a)]), "bc7")
    shiny = np.isin(lab, [kinds.index(k) for k in ("metal", "steel", "hilt")])
    spec = np.where(shiny & ~use_alpha, 0.35 + 0.65 * (1 - a), 0.35)  # WoW reflection mask
    occl = np.clip(0.55 + 0.45 * blur(luma(rgb), 6.0) / max(luma(rgb).mean(), 1e-3), 0, 1)
    out[f"{texset}_mask"] = write(f"{texset}_mask", np.dstack([spec, np.ones_like(a), occl, np.ones_like(a)]), "bc7")
    glow = glow_mask(rgb)
    if texset == "fm":  # the whole sword is painted ice blue: only its brightest runes and eyes glow
        glow = np.clip((glow - 0.45) / 0.4, 0, 1)
    pair = np.array([PAIRS[k] for k in kinds])[lab]
    out[f"{texset}_id"] = write(f"{texset}_id", np.dstack([pair * 17 / 255, glow, np.zeros_like(a), np.ones_like(a)]), "bc5")
    for k in kinds:
        frac = np.mean(lab == kinds.index(k))
        if frac:
            print(f"     {k}: {frac * 100:.1f}% of texels")
    print(f"     glowing texels: {np.mean(glow > 0.5) * 100:.2f}%")


def mist_set(out):
    """The eye glow: the smoke strip tinted ice blue, opacity from its brightness."""
    src = load("beam_smokegrey.png")
    l = luma(src[..., :3])
    l = np.clip((l - l.min()) / max(l.max() - l.min(), 1e-6), 0, 1)
    tint = np.array([0.55, 0.85, 1.0])
    rgb = l[..., None] * tint
    out["lk_mist_base"] = write("lk_mist_base", np.dstack([rgb, l]), "bc7")
    flat = np.dstack([np.full_like(l, 0.5), np.full_like(l, 0.5), l, np.ones_like(l)])
    out["lk_mist_norm"] = write("lk_mist_norm", flat, "bc7")
    out["lk_mist_mask"] = write("lk_mist_mask", np.dstack([np.full_like(l, 0.2), np.ones_like(l), np.ones_like(l), np.ones_like(l)]), "bc7")
    out["lk_mist_id"] = write("lk_mist_id", np.dstack([np.full_like(l, PAIRS["mist"] * 17 / 255), l, np.zeros_like(l), np.ones_like(l)]), "bc5")


def build():
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit", "fitted.pkl"), "rb"))
    fm = pickle.load(open(os.path.join(ROOT, "work", "src", "src.pkl"), "rb"))["frostmourne"]
    out = {}
    for ts in ("lk_a", "lk_b"):
        print(ts)
        painted_set(ts, [fit], out)
    print("fm")
    painted_set("fm", [fm], out)
    print("lk_mist")
    mist_set(out)
    index = {k: (v, f"{WEAPON_DIR if k.startswith('fm') else GEAR_DIR}_{k}.tex") for k, v in out.items()}
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump(index, f)
    return index


if __name__ == "__main__":
    build()
