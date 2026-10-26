"""Bake Marvel Rivals' material colour logic into plain albedo textures (sRGB PNG), as the psylocke.gg viewer does it.

  hair  (M_Common_Hair) the strand texture (UV0, tiled and overlapping) overlay-blended with the shadow colour map
        (UV1), baked into UV1 space where every strand has its own texels; alpha = opacity mask (UV0)
  lines (unlitHair) colour x baseTint, alpha = opacity mask
  eyes  the procedural eye (viewer: iris remapped inside irisUvRadius, limbus darkening, sclera scaled about the
        centre), the iris at its texture colour; the teeth (UV x >= 1) are dropped by the fit
  skin  the head and body textures x SKIN_GAIN (linear)
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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "work", "src")
OUT = os.path.join(SRC, "albedo")
LUMA = np.array([0.3, 0.59, 0.11])
# Skin brightness, linear gain on the skin textures (not the outfit). The source lights skin with toon bands that never
# drop far into shade; the game's daylight does, so at the source's colours she reads dark (the Loki port uses 1.4).
# Here 1.4 would push 1.6% of the skin texels over 0.95 (linear, brightest channel); 1.3 keeps the 99.5th percentile
# at 0.95.
SKIN_GAIN = {"Head": 1.3, "Body": 1.3}


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


def overlay(a, b):
    """The hair shader's blend (function on): 2ab below 0.5, screen-like above."""
    return np.where(a < 0.5, 2 * a * b, 1 - 2 * (1 - a) * (1 - b))


def bake_hair(mat, m, size=2048):
    """Colour and opacity in UV1 space (the only non-overlapping layout of the hair cards)."""
    import raster
    z = np.load(os.path.join(SRC, m["mesh"]))
    P = m["params"].get("inputs", {})
    base = srgb_to_lin(load(m["baseColor"])[..., :3])
    shadow = srgb_to_lin(load(m["extra"]["shadowColorMap"])[..., :3])
    opac = load(m["extra"]["opacityMask"])[..., 0]
    tri, bary = raster.rasterize(z["uv1"], z["faces"], size, pad=2)
    hit = tri >= 0
    f = z["faces"][tri[hit]]
    b = bary[hit]
    uv0 = np.einsum("nk,nkj->nj", b, z["uv0"][f])
    texel = (np.stack(np.nonzero(hit)[::-1], -1) + 0.5) / size
    col = raster.sample(base, uv0) * np.array(P.get("baseTint", [1, 1, 1]))
    col = np.clip(col, 0, 1)
    col = overlay(col, raster.sample(shadow, texel))
    out = np.zeros((size, size, 4))
    out[hit, :3] = lin_to_srgb(col)
    out[hit, 3] = raster.sample(opac[..., None], uv0)[:, 0]
    # bleed colour one ring outward so mip/BC edges don't pick up black
    rgb = out[..., :3].copy()
    for _ in range(4):
        empty = ~hit
        acc = np.zeros_like(rgb); cnt = np.zeros((size, size, 1))
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sh = np.roll(np.roll(rgb, dy, 0), dx, 1); hs = np.roll(np.roll(hit, dy, 0), dx, 1)
            acc += sh * hs[..., None]; cnt += hs[..., None]
        grow = empty & (cnt[..., 0] > 0)
        rgb[grow] = acc[grow] / cnt[grow]
        hit = hit | grow
    out[..., :3] = rgb
    print(f"  {mat}: UV1 bake, {np.mean(tri >= 0):.2f} of the texture covered")
    return np.round(np.clip(out, 0, 1) * 255).astype(np.uint8)


def bake_lines(mat, m):
    P = m["params"].get("inputs", {})
    base = load(m["baseColor"])
    lin = srgb_to_lin(base[..., :3]) * np.array(P.get("baseTint", [1, 1, 1]))
    a = load(m["extra"]["opacityMask"], base.shape[1::-1])[..., 0] * float(P.get("opacityMultiplier", 1))
    return np.round(np.dstack([lin_to_srgb(lin), a]) * 255).astype(np.uint8)


def bake_eyes(mat, m, size=512):
    """The viewer's eye shader (no pupil oval, no view-dependent highlight) evaluated over UV 0..1. irisBrightness and
    irisBaseColorMulti are left out: they're for the viewer's own eye lighting, and baked in they made the Loki
    port's irises glow."""
    import raster
    P = m["params"].get("inputs", {})
    ex = m["extra"]
    iris = srgb_to_lin(load(ex["irisBaseColorMap"])[..., :3])
    sclera = srgb_to_lin(load(ex.get("scleraBaseColorMap") or ex["scleraBaseColorStatic"])[..., :3])
    ao = load(ex["irisAoMap"])[..., 0] if ex.get("irisAoMap") else None
    v, u = np.mgrid[0:size, 0:size]
    Z = np.stack([(u + 0.5) / size - 0.5, (v + 0.5) / size - 0.5], -1)
    q = P["irisUvRadius"]
    j = 0.5 / max(q, 1e-4)
    L = np.linalg.norm(Z, axis=-1)
    t = np.clip((L - q) * -(1 / max(P["irisBorderWidth"], 1e-4)), 0, 1)
    ee = t * t * (3 - 2 * t)
    uu = Z * j
    O = np.clip((np.linalg.norm(uu, axis=-1) - 0.45) * -4, 0, 1) ** 0.7
    H = np.stack([uu[..., 0] + O * (-0.1 * P["pupilShiftX"]), uu[..., 1] + O * (0.1 * P["pupilShiftY"])], -1)
    Hl = np.maximum(np.linalg.norm(H, axis=-1), 1e-4)
    G = H * (0.5 / Hl)[..., None]
    zz = np.clip((1 - Hl * 2) * P.get("pupilScale", 1), 0, 1)
    ea = G * (1 - zz)[..., None] + 0.5
    el = ea - 0.5
    eo = raster.sample(iris, ea)
    en = np.ones(Z.shape[:2])
    if ao is not None:
        a = raster.sample(ao[..., None], ea)[..., 0]
        en = np.where(a <= 1e-4, 0.0, a ** P.get("aoPower", 0))
    er = Z / max(P.get("scleraScale", 1), 1e-4) + 0.5
    es = raster.sample(sclera, er) * np.array(P.get("scleraTint", [1, 1, 1]))
    eu = np.clip(1 - np.linalg.norm(el * P["limbusDarkScale"], axis=-1) ** P["limbusDarkPower"], 0, 1)
    eg = eo * en[..., None] * eu[..., None]
    eh = es + (eg - es) * ee[..., None]
    return np.round(np.dstack([lin_to_srgb(eh), np.ones(Z.shape[:2])]) * 255).astype(np.uint8)


SPECIAL = {"hair": bake_hair, "unlitHair": bake_lines, "eye": bake_eyes}


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
    out = np.dstack([lin_to_srgb(lin * SKIN_GAIN.get(mat, 1.0)), base[..., 3]])
    return np.round(out * 255).astype(np.uint8)


def main(only=None):
    os.makedirs(OUT, exist_ok=True)
    sc = json.load(open(os.path.join(SRC, "scene.json")))
    for mat, m in sc["materials"].items():
        if only and mat not in only:
            continue
        if m["recipe"] in SPECIAL:
            a = SPECIAL[m["recipe"]](mat, m)
        elif not m.get("baseColor"):
            continue
        else:
            a = bake(mat, m)
        Image.fromarray(a).save(os.path.join(OUT, f"{mat}.png"))
        skin = f" (skin x {SKIN_GAIN[mat]})" if mat in SKIN_GAIN else ""
        print(f"  {mat:16s} {m['recipe']:14s} dye={'yes' if m['extra'].get('dyeingTexMap') else 'no '} "
              f"mean sRGB {a[..., :3].reshape(-1, 3).mean(0).round(0)}{skin}")


if __name__ == "__main__":
    main(sys.argv[1:])
