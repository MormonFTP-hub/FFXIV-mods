"""Bake Marvel Rivals' material colour logic into plain albedo textures (sRGB PNG), as the psylocke.gg viewer does it.

  dye   the "costume colour" layer (viewer function W): the dye map's alpha picks one of 8 regions (k/7 steps), its
        R lerps the region's ColorA -> ColorB, G and B lerp on to ColorGChannel / ColorBChannel (useDyeingGBChannel),
        and the base colour is first HSV-adjusted per region (hue add, saturation multiply, value add).
python -P -E tools/shade.py   ->  work/src/albedo/<material>.png
"""
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "work", "src")
OUT = os.path.join(SRC, "albedo")
LUMA = np.array([0.3, 0.59, 0.11])


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def rgb2hsv(c):
    """The viewer's branchless HSV (function N)."""
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    st = (b <= g)[..., None]           # step(l, a): g >= b
    o = np.where(st, np.stack([g, b, np.zeros_like(r), np.full_like(r, -1 / 3)], -1),
                 np.stack([b, g, np.full_like(r, -1.0), np.full_like(r, 2 / 3)], -1))
    sx = (o[..., 0] <= r)[..., None]   # step(o.x, t)
    n = np.where(sx, np.stack([r, o[..., 1], o[..., 2], o[..., 0]], -1),
                 np.stack([o[..., 0], o[..., 1], o[..., 3], r], -1))
    d = n[..., 0] - np.minimum(n[..., 3], n[..., 1])
    h = np.abs(n[..., 2] + (n[..., 3] - n[..., 1]) / (d * 6 + 1e-10))
    return np.stack([h, d / (n[..., 0] + 1e-10), n[..., 0]], -1)


def hsv2rgb(h, s, v):
    k = np.abs(np.mod(h[..., None] + np.array([0, 2 / 3, 1 / 3]), 1.0) * 6 - 3)
    o = np.clip(k - 1, 0, 1)
    return np.clip(v[..., None] * (1 + (o - 1) * s[..., None]), 0, 1)


def hsv_adjust(c, dh, ds, dv):
    hsv = rgb2hsv(c)
    return hsv2rgb(hsv[..., 0] + dh, hsv[..., 1] * ds, hsv[..., 2] + dv)


def dye(base_lin, dye_map, P):
    """base_lin HxWx3 linear, dye_map HxWx4 0..1 (linear), P recipe inputs."""
    r = dye_map[..., 3]
    w = [np.clip(1.0813953876495361 - np.abs(r - k / 7) * 8.139533996582031, 0, 1) for k in range(8)]
    u = w[0]

    def reg(key):
        return [P.get(f"region{a}{key}") for a in range(1, 8)]

    def mixcol(cols):
        out = np.repeat(u[..., None], 3, -1)
        for a in range(1, 8):
            c = cols[a - 1]
            out = out + np.array(c[:3] if c else [1, 1, 1], float) * w[a][..., None]
        return out

    def chan(vals, idx, with_u):
        out = u.copy() if with_u else np.zeros_like(u)
        for a in range(1, 8):
            v = vals[a - 1]
            out = out + (v[idx] if v else 0.0) * w[a]
        return out

    def scal(vals):
        out = np.zeros_like(u)
        for a in range(1, 8):
            out = out + (vals[a - 1] or 0.0) * w[a]
        return out

    A, B, G, Bc = (mixcol(reg(k)) for k in ("ColorA", "ColorB", "ColorGChannel", "ColorBChannel"))
    x, y, z = (dye_map[..., i][..., None] for i in range(3))
    uu = A + (B - A) * x
    pp = uu + (G - uu) * y
    pp = pp + (Bc - pp) * z
    f = uu + (pp - uu) * float(P.get("useDyeingGBChannel", 0) or 0)
    hs = reg("Hsv")
    g = hsv_adjust(base_lin, chan(hs, 0, False), chan(hs, 1, True), chan(hs, 2, False))
    h = f * g
    cs = reg("CutoutHsv")
    xc = hsv_adjust(h, chan(cs, 0, False), chan(cs, 1, True), chan(cs, 2, False))
    S = scal(reg("UseHighlight")) * (1 - 2 * (h @ LUMA))
    Aa = S + h @ LUMA
    lo, hi = scal(reg("CutoutRangeHigh")), scal(reg("CutoutRangeLow"))
    n = np.maximum(lo + 0.01, hi)
    t = np.clip((Aa - lo) / (n - lo + 1e-10), 0, 1)
    t = t * t * (3 - 2 * t)
    return xc + (h - xc) * t[..., None]


def load(name, size=None):
    im = Image.open(os.path.join(SRC, "tex", name + ".png")).convert("RGBA")
    if size and im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return np.asarray(im, np.float64) / 255.0


def bake(mat, m):
    P = m["params"].get("inputs", {})
    base = load(m["baseColor"])
    lin = srgb_to_lin(base[..., :3]) * np.array((m.get("baseColorFactor") or [1, 1, 1, 1])[:3])
    dm = m["extra"].get("dyeingTexMap")
    if dm:
        lin = dye(lin, load(dm, base.shape[1::-1]), P)
    out = np.dstack([lin_to_srgb(lin), base[..., 3]])
    return np.round(out * 255).astype(np.uint8)


def main(only=None):
    os.makedirs(OUT, exist_ok=True)
    sc = json.load(open(os.path.join(SRC, "scene.json")))
    for mat, m in sc["materials"].items():
        if only and mat not in only:
            continue
        if not m.get("baseColor"):
            continue
        a = bake(mat, m)
        Image.fromarray(a).save(os.path.join(OUT, f"{mat}.png"))
        print(f"  {mat:16s} {m['recipe']:14s} dye={'yes' if m['extra'].get('dyeingTexMap') else 'no '} "
              f"mean sRGB {a[..., :3].reshape(-1, 3).mean(0).round(0)}")


if __name__ == "__main__":
    main(sys.argv[1:])
