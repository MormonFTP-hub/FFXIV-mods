"""Build the FFXIV textures (Dawntrail character.shpk layout) from Gregor's PNGs.

Per texture set:  _base  RGB colour, A = opacity (alpha-tested at 0.5)           BC7
                  _norm  RG normal (green up, as Unity), B = opacity              BC7
                  _mask  R specular, G roughness, B occlusion                     BC7
                  _id    R = colour-table row pair * 17, G = 255 - blend to the pair's second row   BC5
                         (Dawntrail reads G 255 as the pair's first row and G 0 as its second. 1.0.x-1.1.0 wrote
                         G = blend, which put 96-99% of the suit and coat on the metal row, near-black in GS)
Row pairs (materials.py): each pair's second row is the "special" one: metal for suit/aedd, glowing veins
and glowing eyes for the centipede. The glasses lenses use the vanilla sunglasses' glass material, with
constant textures taken from the middle of the vanilla lens.
Colour lift (1.1.0, Neon's): the _base colour maps' luminance is raised by a gamma (dark and mid tones most), hue kept,
then saturation scaled in linear light. Alpha is untouched; the lens has no colour map.
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
S, U = os.path.join(ROOT, "source"), os.path.join(ROOT, "source", "unity")
OUT = os.path.join(ROOT, "work", "build", "tex")
GAME_DIR = "chara/equipment/e6148/texture/gregor"
PAIRS = {"suit": 0, "aedd": 1, "centi": 2, "eyes": 3}
LENS_REF = ("chara/equipment/e6259/model/c0101e6259_met.mdl", "chara/equipment/e6259/material/v0001/mt_c0101e6259_met_b.mtrl")
Image.MAX_IMAGE_PIXELS = None
# The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for"
LIFT = {"suit": (1.4, 1.2), "aedd": (1.4, 1.2), "centi": (1.4, 1.2)}   # texset -> (luminance gamma, saturation)
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


def lifted(texset, rgba):
    """The _base RGBA with its colour lifted (LIFT); the alpha (opacity) stays exactly as it was."""
    if texset not in LIFT:
        return rgba
    out = rgba.copy()
    out[..., :3] = lift(rgba[..., :3], *LIFT[texset])
    return out


def png(path, size=None, mode="RGBA"):
    im = Image.open(path)
    if im.mode == "I;16" or im.mode == "I":
        im = Image.fromarray((np.asarray(im) / 256).astype(np.uint8))
    im = im.convert(mode)
    if size and im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).copy()


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


def bleed(rgba, iters=24):
    """Spread colour into transparent texels so mip-mapping at cut-out edges does not pull in black."""
    out = rgba.astype(np.float32)
    filled = rgba[..., 3] >= 128
    for _ in range(iters):
        if filled.all():
            break
        acc = np.zeros(out.shape[:2] + (3,), np.float32)
        cnt = np.zeros(out.shape[:2], np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            f = np.roll(filled, (dy, dx), (0, 1))
            acc += np.roll(out[..., :3], (dy, dx), (0, 1)) * f[..., None]
            cnt += f
        grow = ~filled & (cnt > 0)
        out[grow, :3] = acc[grow] / cnt[grow, None]
        filled = filled | grow
    return out.round().astype(np.uint8)


def base(path, size):
    a = png(path, size)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    return bleed(a)


def normal(path, size, alpha):
    n = png(path, size)
    n[..., 2] = alpha
    n[..., 3] = 255
    return n


def flat_normal(size, alpha):
    n = np.zeros((size, size, 4), np.uint8)
    n[..., 0] = n[..., 1] = 128
    n[..., 2] = alpha
    n[..., 3] = 255
    return n


def mask(spec, rough, ao):
    h, w = rough.shape
    m = np.zeros((h, w, 4), np.uint8)
    m[..., 0] = spec
    m[..., 1] = rough
    m[..., 2] = ao
    m[..., 3] = 255
    return m


def id_tex(pair, blend):
    """blend 0..255 = how far toward the pair's second row; written as G = 255 - blend (G 255 = first row)."""
    h, w = blend.shape
    out = np.zeros((h, w, 4), np.uint8)
    out[..., 0] = np.asarray(pair) * 17
    out[..., 1] = 255 - np.asarray(blend, np.int32)
    out[..., 3] = 255
    return out


def const(rgba, size=16):
    return np.tile(np.array(rgba, np.uint8), (size, size, 1))


def lens_constants():
    """Sample the vanilla sunglasses lens textures at the middle of its lens UVs."""
    me = next(m for m in xd.model(LENS_REF[0])["meshes"] if m["material"].endswith("_met_b.mtrl"))
    uv = np.median(me["uv"], 0)
    mt = xd.material(LENS_REF[1])
    vals = []
    for t in mt["textures"]:
        a = xd.texture(t["path"] if isinstance(t, dict) else t)
        h, w = a.shape[:2]
        vals.append(a[int(np.clip(uv[1], 0, 0.999) * h), int(np.clip(uv[0], 0, 0.999) * w)].tolist())
    return vals


def build():
    out = {}
    print("suit (shirt, vest, tie, pants, shoes, glasses frame)")
    b = base(os.path.join(U, "GregorMain_ACopy.png"), 2048)
    out["suit_base"] = write("suit_base", lifted("suit", b), "bc7")
    out["suit_norm"] = write("suit_norm", normal(os.path.join(U, "GregorMain_N.png"), 2048, b[..., 3]), "bc7")
    mm = png(os.path.join(U, "LCB Gregor main_MochieMetallicMaps.png"), 2048)   # R metallic, G smoothness
    out["suit_mask"] = write("suit_mask", mask(np.full(mm.shape[:2], 128), 255 - mm[..., 1], np.full(mm.shape[:2], 255)), "bc7")
    out["suit_id"] = write("suit_id", id_tex(PAIRS["suit"], mm[..., 0]), "bc5")

    print("aedd (coat, bolts, halo, leg armour)")
    b = base(os.path.join(S, "AEDD Greg Main Color.png"), 2048)
    out["aedd_base"] = write("aedd_base", lifted("aedd", b), "bc7")
    out["aedd_norm"] = write("aedd_norm", normal(os.path.join(S, "AEDD Greg Main Normal.png"), 2048, b[..., 3]), "bc7")
    rough = png(os.path.join(S, "AEDD Greg Main Roughness.png"), 2048, "L")
    ao = png(os.path.join(S, "AEDD Greg Main Ambient Occlusion.001.png"), 2048, "L")
    metal = png(os.path.join(S, "AEDD Greg Main Metallic.png"), 2048, "L")
    out["aedd_mask"] = write("aedd_mask", mask(np.full(rough.shape, 128), rough, ao), "bc7")
    out["aedd_id"] = write("aedd_id", id_tex(PAIRS["aedd"], metal), "bc5")

    print("centipede")
    b = base(os.path.join(U, "Tex_AEDD.png"), 1024)
    out["centi_base"] = write("centi_base", lifted("centi", b), "bc7")
    out["centi_norm"] = write("centi_norm", flat_normal(1024, 255), "bc7")   # the package's "_n" map is a copy of the colour
    mm = png(os.path.join(U, "Mat_AEDD 1_MochieMetallicMaps.png"), 1024)
    out["centi_mask"] = write("centi_mask", mask(np.full(mm.shape[:2], 160), 255 - mm[..., 1], np.full(mm.shape[:2], 255)), "bc7")
    veins = png(os.path.join(S, "Emission Mask.png"), 1024, "L")
    eyes = png(os.path.join(S, "MATAEDD eyes.jpg"), 1024, "L")
    is_eye = eyes > 128
    out["centi_id"] = write("centi_id", id_tex(np.where(is_eye, PAIRS["eyes"], PAIRS["centi"]),
                                               np.where(is_eye, 255, veins)), "bc5")

    print("lens (vanilla sunglasses glass, constant)")
    vals = lens_constants()
    print("   vanilla lens texels:", vals)
    for name, v in zip(("norm", "mask", "id"), vals):
        out[f"lens_{name}"] = write(f"lens_{name}", const(v), "bc5" if name == "id" else "bc7")

    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


if __name__ == "__main__":
    build()
