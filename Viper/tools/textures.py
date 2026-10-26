"""Build the FFXIV textures (Dawntrail character.shpk layout) from the Kingdom Archives viewer's Viper textures
(work/src/tex).

Per texture set:  _base  RGB colour (props: the emissive map added, so the vials and gauntlet lights stay bright)  BC7
                  _norm  RG tangent normal (the viewer's maps are green-down, FFXIV's green-up: G flipped,
                         checked by curl_test), B opacity (the eye overlay only)                              BC7
                  _mask  R specular, G roughness (ORM green), B occlusion (ORM red)                           BC7
                  _id    R colour-table row pair (always 0), G picks within the pair: 255 = the first row
                         (plain), 0 = the second (glossy), so G = 255 - the ORM blue (metalness), with the
                         faint values below METAL_RAMP cut away first. Sets without an ORM get a flat G = 255  BC5
                         (1.1.0 and before wrote G = metal and a flat G = 0, which put 64-100% of every
                         material on the second row, then metal: near-black in GS; Neon 1.1.0's fix)
The body's and hair's emissive maps are plain white placeholders and are ignored. The eye set is the viewer's
eye overlay (lash-line shadow and catchlight), alpha-tested through _norm blue.
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
GAME_DIR = "chara/equipment/e9233/texture/viper"
# texset -> (colour, normal, ORM, emissive, size (w, h), specular 0-255, roughness override 0-255 or None)
TEXSETS = {
    "body": ("df", "nm", "orm", None, (2048, 2048), 80, None),
    "props": ("props_df", "props_nm", "props_orm", "props_em", (1024, 512), 90, None),
    "hair": ("hair_df", "hair_nm", "hair_orm", None, (1024, 1024), 110, None),
    "eye": ("eye_df", None, None, None, (512, 256), 60, 60),
}
FLAT = 64
METAL_RAMP = (120, 190)         # ORM blue: faint values (a few % of the body at 80-100) aren't metal, plates are ~255
# Colour lift (1.1.0, Neon's 1.2.0 lift; the user on Neon: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like
# color intensity is what im looking for"): texset -> (luminance gamma, saturation) on the colour map, before the
# props' emissive is added; the eye overlay (lash-line shadow and catchlight) stays as it is
LIFT = {"body": (1.4, 1.2), "props": (1.4, 1.2), "hair": (1.4, 1.2)}
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


def png(name, size, mode="RGB"):
    im = Image.open(os.path.join(sd.TEX, name + ".png")).convert(mode)
    if im.size != tuple(size):
        im = im.resize(tuple(size), Image.LANCZOS)
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


def curl_test(name):
    """Median curl / gradient of the slope field read green-up and green-down: a real normal map comes from a height
    field, so the right reading is (nearly) curl-free."""
    a = png(name, (1024, 1024)).astype(float) / 127.5 - 1
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


def build():
    out = {}
    for texset, (_, normal, *_rest) in TEXSETS.items():
        if normal:
            c = curl_test(normal)
            print("  curl", normal, {k: round(v, 3) for k, v in c.items()})
            assert c["green down"] < c["green up"], normal
    flat = np.full((FLAT, FLAT), 255, np.uint8)
    zero = np.zeros((FLAT, FLAT), np.uint8)
    out["flat_norm"] = write("flat_norm", stack(np.full((FLAT, FLAT), 128), np.full((FLAT, FLAT), 128), flat, flat), "bc7")
    out["flat_id"] = write("flat_id", stack(zero, flat, zero, flat), "bc5")
    for texset, (color, normal, orm, emissive, size, spec, rough) in TEXSETS.items():
        print(texset)
        w, h = size
        rgba = png(color, size, "RGBA")
        base = (lift(rgba[..., :3], *LIFT[texset]) if texset in LIFT else rgba[..., :3]).astype(np.float32)
        if emissive:
            base = base + png(emissive, size).astype(np.float32)
        base = np.clip(base, 0, 255).astype(np.uint8)
        out[f"{texset}_base"] = write(f"{texset}_base", np.dstack([base, np.full((h, w), 255, np.uint8)]), "bc7")
        one = np.full((h, w), 255)
        if normal:
            n = png(normal, size)
            out[f"{texset}_norm"] = write(f"{texset}_norm", stack(n[..., 0], 255 - n[..., 1], one, one), "bc7")
        elif texset == "eye":
            out[f"{texset}_norm"] = write(f"{texset}_norm", stack(np.full((h, w), 128), np.full((h, w), 128),
                                                                  rgba[..., 3], one), "bc7")
        if orm:
            ms = (min(w, 1024), min(h, 1024))
            o = png(orm, ms)
            g = o[..., 1] if rough is None else np.full(o.shape[:2], rough)
            out[f"{texset}_mask"] = write(f"{texset}_mask", stack(np.full(o.shape[:2], spec), g, o[..., 0],
                                                                  np.full(o.shape[:2], 255)), "bc7")
            lo, hi = METAL_RAMP
            metal = np.clip((o[..., 2].astype(float) - lo) / (hi - lo) * 255, 0, 255)
            if metal.max() > 40:
                zz = np.zeros(o.shape[:2])
                out[f"{texset}_id"] = write(f"{texset}_id", stack(zz, 255 - metal, zz, np.full(o.shape[:2], 255)),
                                            "bc5")
        else:
            out[f"{texset}_mask"] = write(f"{texset}_mask", stack(np.full((FLAT, FLAT), spec),
                                                                  np.full((FLAT, FLAT), rough), flat, flat), "bc7")
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


def has(texset, kind):
    return os.path.exists(os.path.join(OUT, f"{texset}_{kind}.tex"))


if __name__ == "__main__":
    build()
