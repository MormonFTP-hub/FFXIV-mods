"""Build the FFXIV textures (Dawntrail character.shpk layout) from the rip's PNGs.

Per texture set:  _base  RGB diffuse, A = opacity           (BC7)
                  _norm  RG normal (OpenGL, as the rip), B = opacity  (BC7)
                  _mask  R specular, G roughness factor, B occlusion (BC7)
                  _id    R = colour-table row pair * 17, G = 0       (BC5)
The colour table (materials.py) holds one row pair per surface kind listed in PAIRS.
Colour lift (1.1.0, Neon's): each _base colour's luminance is raised by a gamma (dark and mid tones most), hue kept, then
saturation scaled in linear light; alpha is untouched. The armour's surface kinds (_id) still come from the unlifted rip.
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
SRC = os.path.join(ROOT, "source")
OUT = os.path.join(ROOT, "work", "build", "tex")
GAME_DIR = "chara/equipment/e0110/texture/griffith"

# The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for"
LIFT = {"armor": (1.4, 1.2), "cape": (1.4, 1.2), "hair": (1.4, 1.2), "face": (1.4, 1.2)}  # texset -> (gamma, saturation)
LUMA = np.array([0.2126, 0.7152, 0.0722])

PAIRS = {"metal": 0, "cloth": 1, "gold": 2, "leather": 3, "skin": 4, "hair": 5, "cape": 6, "eye": 7}


def png(name, size=None):
    im = Image.open(os.path.join(SRC, name)).convert("RGBA")
    if size and im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).copy()


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


def lifted(texset, rgba):
    """The _base RGBA with its colour lifted (LIFT); the alpha stays exactly as it was."""
    if texset not in LIFT:
        return rgba
    out = rgba.copy()
    out[..., :3] = lift(rgba[..., :3], *LIFT[texset])
    return out


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


def rasterize(size, parts, labels):
    """Label map (size x size, -1 = empty): each part's UV triangles painted with its label.
    parts: list of mesh dicts (uv in OBJ convention, faces)."""
    lab = np.full((size, size), -1, np.int16)
    for m, label in zip(parts, labels):
        uv = m["uv"].copy()
        px = np.stack([uv[:, 0] * size - 0.5, (1 - uv[:, 1]) * size - 0.5], 1)
        for f in m["faces"]:
            a, b, c = px[f]
            lo = np.floor(np.minimum(np.minimum(a, b), c)).astype(int)
            hi = np.ceil(np.maximum(np.maximum(a, b), c)).astype(int)
            lo = np.clip(lo, 0, size - 1)
            hi = np.clip(hi, 0, size - 1)
            xs, ys = np.meshgrid(np.arange(lo[0], hi[0] + 1), np.arange(lo[1], hi[1] + 1))
            p = np.stack([xs.ravel(), ys.ravel()], 1).astype(float)
            v0, v1 = b - a, c - a
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


def dilate(lab, iters=8):
    """Grow labels into empty pixels so filtering at island edges stays on the right row."""
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


def id_tex(lab, default):
    lab = dilate(lab)
    lab[lab < 0] = default
    out = np.zeros(lab.shape + (4,), np.uint8)
    out[..., 0] = lab * 17
    out[..., 3] = 255
    return out


def const_tex(rgba, size=16):
    return np.tile(np.array(rgba, np.uint8), (size, size, 1))


def normal(name, size, alpha=None):
    n = png(name, size)
    n[..., 2] = 255 if alpha is None else alpha
    n[..., 3] = 255
    return n


def hsv(rgb):
    rgb = rgb.astype(float) / 255
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, (g - b) / np.maximum(d, 1e-6) % 6, np.where(mx == g, (b - r) / np.maximum(d, 1e-6) + 2, (r - g) / np.maximum(d, 1e-6) + 4)) * 60
    return h, s, mx


def box_blur(a, r):
    k = 2 * r + 1
    p = np.pad(a, r, mode="edge")
    c = p.cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)))
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def build():
    src = pickle.load(open(os.path.join(ROOT, "work", "fit", "fitted.pkl"), "rb"))
    out = {}

    # ---- armour (0.png set): metal plates, black undersuit, gold, leather
    print("armour")
    base = png("0.png")
    base[..., 3] = 255
    out["armor_base"] = write("armor_base", lifted("armor", base), "bc7")
    out["armor_norm"] = write("armor_norm", normal("2.png", 2048), "bc7")
    spec = png("3.png")[..., 0].astype(float) / 255
    grime = png("1.png")[..., 0].astype(float) / 255
    mask = np.zeros((2048, 2048, 4), np.uint8)
    mask[..., 0] = np.clip(255 * (0.55 + 0.45 * spec), 0, 255)
    mask[..., 1] = np.clip(255 * (0.75 + 0.25 * grime), 0, 255)
    mask[..., 2] = 255
    mask[..., 3] = 255
    out["armor_mask"] = write("armor_mask", mask, "bc7")
    size = 1024
    parts = [src[n] for n in ("model_1_submesh_1", "model_1_submesh_2", "model_1_submesh_3", "model_1_submesh_4",
                              "model_1_submesh_5", "model_3_submesh_0")]
    lab = rasterize(size, parts, [PAIRS["cloth"], PAIRS["cloth"], PAIRS["metal"], PAIRS["metal"], PAIRS["gold"], PAIRS["metal"]])
    small = np.asarray(Image.fromarray(png("0.png")[..., :3]).resize((size, size), Image.BILINEAR))
    h, s, v = hsv(small)
    vblur = box_blur(v, 4)
    metal = lab == PAIRS["metal"]
    lab[metal & (s > 0.35) & (h > 25) & (h < 60) & (v > 0.35)] = PAIRS["gold"]
    lab[metal & (s > 0.2) & ((h < 25) | (h > 330)) & (v < 0.6)] = PAIRS["leather"]
    lab[metal & (vblur < 0.12)] = PAIRS["cloth"]
    for k, p in PAIRS.items():
        print(f"    {k}: {np.mean(lab == p) * 100:.1f}% of pixels")
    out["armor_id"] = write("armor_id", id_tex(lab, PAIRS["metal"]), "bc5")

    # ---- cape (17.png set)
    print("cape")
    base = png("17.png")
    base[..., 3] = 255
    out["cape_base"] = write("cape_base", lifted("cape", base), "bc7")
    out["cape_norm"] = write("cape_norm", normal("19.png", 1024), "bc7")
    out["cape_mask"] = write("cape_mask", const_tex((200, 255, 255, 255)), "bc7")
    out["cape_id"] = write("cape_id", id_tex(np.full((16, 16), PAIRS["cape"], np.int16), PAIRS["cape"]), "bc5")

    # ---- hair (11.png set; alpha-tested strands). Its 14.png is not a usable normal map: keep it flat.
    print("hair")
    base = png("11.png")
    out["hair_base"] = write("hair_base", lifted("hair", base), "bc7")
    flat = np.zeros_like(base)
    flat[..., 0] = flat[..., 1] = 128
    flat[..., 2] = base[..., 3]
    flat[..., 3] = 255
    out["hair_norm"] = write("hair_norm", flat, "bc7")
    out["hair_mask"] = write("hair_mask", const_tex((220, 255, 255, 255)), "bc7")
    out["hair_id"] = write("hair_id", id_tex(np.full((16, 16), PAIRS["hair"], np.int16), PAIRS["hair"]), "bc5")

    # ---- face (5.png set): skin, with the eyes / teeth glossier
    print("face")
    base = png("5.png")
    out["face_base"] = write("face_base", lifted("face", base), "bc7")
    out["face_norm"] = write("face_norm", normal("8.png", 1024, alpha=base[..., 3]), "bc7")
    out["face_mask"] = write("face_mask", const_tex((180, 255, 255, 255)), "bc7")
    lab = rasterize(1024, [src["model_4_submesh_1"], src["model_4_submesh_0"], src["model_4_submesh_2"]],
                    [PAIRS["skin"], PAIRS["eye"], PAIRS["eye"]])
    out["face_id"] = write("face_id", id_tex(lab, PAIRS["skin"]), "bc5")

    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


if __name__ == "__main__":
    build()
