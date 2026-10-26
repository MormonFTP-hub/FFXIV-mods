"""Bake the Pink Paws colours into plain albedo textures (work/src/albedo/<material>.png, sRGB).

The rip's outfit textures are the base summer skin (1060301); Pink Paws is a dye pass the game runs in its shader. This
reproduces psylocke.gg's port of that pass (Marvel Rivals "UseDyeing"), in linear light:
  * the dye texture's alpha picks one of 7 regions (tent weights around k/7; region 0 = undyed)
  * per region: colour = lerp(ColorA, ColorB, dye.r), then (with useDyeingGBChannel) lerp towards ColorGChannel by
    dye.g and ColorBChannel by dye.b
  * the base colour gets the region's HSV shift (hue add, saturation multiply, value add) and is multiplied by it
  * CutoutHsv / CutoutRange only touch texels darker than ~10% luminance (a second HSV shift there)
Hair: overlay(base * baseTint, shadowColorMap) as the site does; the base is a flat grey on the strands, so the
result is baked onto the shadow map's own layout (UV1), which the hair then uses.
Eyes: iris map inside the iris circle, sclera tint outside (see eyes()), darkened under the upper lids by the
"fake eye shadow" card the source draws over the eyeballs (eye_shadow(), from the Loki port; FFXIV eyes don't move,
so it bakes).
Skin: the head and body textures are brightened after the dye pass (SKIN_GAIN).

python -P -E tools/bake_src.py
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "work", "src")
TEX = os.path.join(SRC, "tex")
OUT = os.path.join(SRC, "albedo")
LUMA = np.array([0.3, 0.59, 0.11])
# Skin brightness, linear gain on the skin textures (after the dye pass). The source lights skin with toon bands that
# never drop far into shade; the game's daylight does, so at the source's colours skin reads dark in game (found on
# the Loki port, fixed there with 1.4). At 1.4, 0.33% of these texels end above 0.95 (the chest's pale highlights).
SKIN_GAIN = {"MI_10600_1060301_Head": 1.4, "MI_10600_1060301_body_01": 1.4, "MI_10600_1060301_body_02": 1.4}
IRIS_GAIN = 1.0      # the source's irisBrightness (1.6) is for its own eye shader; baked into the albedo it glows


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def load(name, size=None):
    im = Image.open(os.path.join(TEX, name + ".png")).convert("RGBA")
    if size and im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return np.asarray(im).astype(np.float64) / 255


def save(name, lin_rgb, alpha=None):
    os.makedirs(OUT, exist_ok=True)
    rgb = (lin_to_srgb(lin_rgb) * 255 + 0.5).astype(np.uint8)
    a = np.full(rgb.shape[:2], 255, np.uint8) if alpha is None else (np.clip(alpha, 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(np.dstack([rgb, a])).save(os.path.join(OUT, name + ".png"))


def rgb2hsv(c):
    """The shader's branchless rgb->hsv (hue 0..1)."""
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    step_gb = (g >= b)[..., None]   # step(l, a) with l = b, a = g
    o = np.where(step_gb, np.stack([g, b, np.zeros_like(r), -np.ones_like(r) / 3], -1),
                 np.stack([b, g, -np.ones_like(r), np.full_like(r, 2 / 3)], -1))
    step_r = (r >= o[..., 0])[..., None]
    n = np.where(step_r, np.stack([r, o[..., 1], o[..., 2], o[..., 0]], -1),
                 np.stack([o[..., 0], o[..., 1], o[..., 3], r], -1))
    d = n[..., 0] - np.minimum(n[..., 3], n[..., 1])
    e = 1e-10
    h = np.abs(n[..., 2] + (n[..., 3] - n[..., 1]) / (6 * d + e))
    return np.stack([h, d / (n[..., 0] + e), n[..., 0]], -1)


def hsv2rgb(h, s, v):
    k = np.abs((h[..., None] + np.array([0, 2 / 3, 1 / 3])) % 1.0 * 6 - 3)
    return np.clip(v[..., None] * (1 + (np.clip(k - 1, 0, 1) - 1) * s[..., None]), 0, 1)


def hsv_shift(c, dh, sm, dv):
    hsv = rgb2hsv(c)
    return hsv2rgb(hsv[..., 0] + dh, hsv[..., 1] * sm, hsv[..., 2] + dv)


def dye(base_lin, dye_tex, P):
    """psylocke.gg's W(): base colour (linear) x region dye."""
    a = dye_tex[..., 3]
    w = [np.clip(1.0813953876495361 - np.abs(a - k / 7) * 8.139533996582031, 0, 1) for k in range(8)]
    u = w[0]

    def mix_col(key):
        out = np.repeat(u[..., None], 3, -1)
        for k in range(1, 8):
            c = P.get(f"region{k}{key}")
            out = out + np.array(c[:3] if c else [1, 1, 1]) * w[k][..., None]
        return out

    def comp(key, i, with_u):
        out = u.copy() if with_u else np.zeros_like(u)
        for k in range(1, 8):
            c = P.get(f"region{k}{key}")
            out = out + (c[i] if c else 0.0) * w[k]
        return out

    def scal(key):
        out = np.zeros_like(u)
        for k in range(1, 8):
            out = out + P.get(f"region{k}{key}", 0.0) * w[k]
        return out

    r, g, b = dye_tex[..., 0:1], dye_tex[..., 1:2], dye_tex[..., 2:3]
    ca, cb = mix_col("ColorA"), mix_col("ColorB")
    cg, cbc = mix_col("ColorGChannel"), mix_col("ColorBChannel")
    base = ca + (cb - ca) * r
    gb = base + (cg - base) * g
    gb = gb + (cbc - gb) * b
    f = base + (gb - base) * float(P.get("useDyeingGBChannel", 0))
    g_adj = hsv_shift(base_lin, comp("Hsv", 0, False), comp("Hsv", 1, True), comp("Hsv", 2, False))
    h = f * g_adj
    x = hsv_shift(h, comp("CutoutHsv", 0, False), comp("CutoutHsv", 1, True), comp("CutoutHsv", 2, False))
    lum = h @ LUMA
    S = scal("UseHighlight") * (1 - 2 * lum)
    A = S + lum
    hi, lo = scal("CutoutRangeHigh"), scal("CutoutRangeLow")
    n = np.maximum(hi + 0.01, lo)
    t = np.clip((A - hi) / (n - hi + 1e-10), 0, 1)
    t = t * t * (3 - 2 * t)
    return x + (h - x) * t[..., None]


def overlay(a, b):
    return np.where(a < 0.5, 2 * a * b, 1 - 2 * (1 - a) * (1 - b))


def hair_prim(sc, name):
    """The first primitive using a material."""
    return next(p["index"] for p in sc["primitives"] if p["material"] == name)


def hair_alpha(m, shape, prim):
    """The strands' opacity mask lives on UV0, their colour on UV1: rasterise every hair triangle in UV1 space,
    interpolate its UV0 at each texel centre and sample the mask there. Texels next to the covered ones take their
    neighbours' value (so filtering at the seams does not eat the strands); the rest stay opaque."""
    H, W = shape
    z = np.load(os.path.join(SRC, f"mesh_p{prim:02d}.npz"))
    uv0, faces = z["uv0"], z["faces"]
    mask = load(m["extra"]["opacityMask"])[..., 0]
    mh, mw = mask.shape
    out = np.full((H, W), -1.0)
    P = z["uv1"] * [W, H] - 0.5
    for f in faces:
        a, b, c = P[f]
        lo = np.clip(np.floor(np.minimum(np.minimum(a, b), c)).astype(int), 0, [W - 1, H - 1])
        hi = np.clip(np.ceil(np.maximum(np.maximum(a, b), c)).astype(int), 0, [W - 1, H - 1])
        xs, ys = np.meshgrid(np.arange(lo[0], hi[0] + 1), np.arange(lo[1], hi[1] + 1))
        xs, ys = xs.ravel(), ys.ravel()
        v0, v1 = b - a, c - a
        d = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(d) < 1e-12:
            continue
        qx, qy = xs - a[0], ys - a[1]
        l1 = (qx * v1[1] - v1[0] * qy) / d
        l2 = (v0[0] * qy - qx * v0[1]) / d
        l0 = 1 - l1 - l2
        ins = (l0 >= 0) & (l1 >= 0) & (l2 >= 0)
        if not ins.any():
            continue
        t = uv0[f]
        u = l0[ins, None] * t[0] + l1[ins, None] * t[1] + l2[ins, None] * t[2]
        px = (u[:, 0] % 1 * mw).astype(int).clip(0, mw - 1)
        py = (u[:, 1] % 1 * mh).astype(int).clip(0, mh - 1)
        yy, xx = ys[ins], xs[ins]
        out[yy, xx] = np.maximum(out[yy, xx], mask[py, px])
    for _ in range(4):
        grown = out.copy()
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            grown = np.maximum(grown, np.roll(np.roll(out, dy, 0), dx, 1))
        out = np.where(out < 0, grown, out)
    return np.where(out < 0, 1.0, out)


def eyes(m):
    """Eyeball albedo on the eyeball UVs: the iris map (its own 0..1 square scaled into the iris circle of radius
    irisUvRadius round the UV centre), sclera map tinted outside, a soft limbus ring between."""
    P = m["inputs"]
    size = 512
    v, u = np.mgrid[0:size, 0:size] / (size - 1)
    r_iris = P["irisUvRadius"] * P.get("scleraScale", 1.0)
    du, dv = u - 0.5, v - 0.5
    rad = np.hypot(du, dv)
    iris = load(m["extra"]["irisBaseColorMap"])
    H, W = iris.shape[:2]
    iu = np.clip((du / (2 * r_iris) + 0.5) * (W - 1), 0, W - 1).astype(int)
    iv = np.clip((dv / (2 * r_iris) + 0.5) * (H - 1), 0, H - 1).astype(int)
    ic = srgb_to_lin(iris[iv, iu, :3]) * IRIS_GAIN
    sclera = srgb_to_lin(load(m["extra"]["scleraBaseColorMap"], (size, size))[..., :3]) * np.array(P["scleraTint"])
    edge = np.clip((rad - r_iris) / max(P.get("irisBorderWidth", 0.02), 1e-3) + 0.5, 0, 1)[..., None]
    limbus = 1 - 0.6 * np.exp(-((rad - r_iris) / 0.012) ** 2)[..., None]
    return (ic * (1 - edge) + sclera * edge) * limbus


def eye_shadow(sc, size):
    """Multiplier (size, size) for the eyeball texture: psylocke.gg's fakeEyeShadow recipe, opacity =
    totalOpacity x min(width term, height term), height term = 1 - smoothstep((v - heightMin) / (heightMax -
    heightMin)) with reverseHeight (White Fox: 0.85 at the card's top edge, fading out over its height), seen from the front: every
    eyeball texel's 3D point is projected along +Z onto the card and takes the card's opacity there."""
    import fit
    import srcdata as sd
    mats = [(n, m) for n, m in sc["materials"].items() if m["recipe"] == "fakeEyeShadow"]
    if not mats:
        return np.ones((size, size))
    card = sd.prim(hair_prim(sc, mats[0][0]))
    P = mats[0][1]["inputs"]
    eye = sd.prim(hair_prim(sc, next(n for n, m in sc["materials"].items() if m["recipe"] == "eye")))
    eye = sd.submesh(eye, fit.eyeball_faces(eye))
    hmin, hmax = P["heightRangeMin"], max(P["heightRangeMax"] - P["heightRangeMin"], 1e-3)
    tot, n = np.zeros((size, size)), np.zeros((size, size))
    side = eye["pos"][eye["faces"]][:, :, 0].mean(1) > 0
    for one in (side, ~side):          # each eye on its own: both share the UV square
        pts, at = eye_points(eye, one, size)
        op = np.zeros(len(pts))
        for f in card["faces"]:
            a, b, c = card["pos"][f][:, :2]
            v0, v1 = b - a, c - a
            d = v0[0] * v1[1] - v1[0] * v0[1]
            if abs(d) < 1e-12:
                continue
            l1 = ((pts[:, 0] - a[0]) * v1[1] - v1[0] * (pts[:, 1] - a[1])) / d
            l2 = (v0[0] * (pts[:, 1] - a[1]) - (pts[:, 0] - a[0]) * v0[1]) / d
            ins = (l1 >= 0) & (l2 >= 0) & (l1 + l2 <= 1)
            t = card["uv0"][f][:, 1]
            cv = (1 - l1[ins] - l2[ins]) * t[0] + l1[ins] * t[1] + l2[ins] * t[2]
            s_ = np.clip((cv - hmin) / hmax, 0, 1)
            w = s_ * s_ * (3 - 2 * s_)
            h = 1 - w if P.get("reverseHeight", 0) > 0 else w
            op[ins] = np.maximum(op[ins], np.clip(h * P.get("totalOpacity", 1), 0, 1))
        np.add.at(tot, at, op)
        np.add.at(n, at, 1)
    op = np.where(n > 0, tot / np.maximum(n, 1), 0)
    print(f"  eye shadow: {(op > 0.05).sum() / max((n > 0).sum(), 1) * 100:.0f}% of the eyeball texels under the "
          f"card, mean opacity there {op[op > 0.05].mean():.2f}")
    return 1 - op


def eye_points(eye, sel, size):
    """3D point of every texel the selected eyeball triangles cover in UV space: (points, (rows, cols))."""
    acc, cnt = np.zeros((size, size, 3)), np.zeros((size, size))
    uvp = eye["uv0"] * size - 0.5
    for f in eye["faces"][sel]:
        a, b, c = uvp[f]
        lo = np.clip(np.floor(np.minimum(np.minimum(a, b), c)).astype(int), 0, size - 1)
        hi = np.clip(np.ceil(np.maximum(np.maximum(a, b), c)).astype(int), 0, size - 1)
        xs, ys = np.meshgrid(np.arange(lo[0], hi[0] + 1), np.arange(lo[1], hi[1] + 1))
        xs, ys = xs.ravel(), ys.ravel()
        v0, v1 = b - a, c - a
        d = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(d) < 1e-12:
            continue
        l1 = ((xs - a[0]) * v1[1] - v1[0] * (ys - a[1])) / d
        l2 = (v0[0] * (ys - a[1]) - (xs - a[0]) * v0[1]) / d
        ins = (l1 >= 0) & (l2 >= 0) & (l1 + l2 <= 1)
        p = eye["pos"][f]
        q = (1 - l1[ins, None] - l2[ins, None]) * p[0] + l1[ins, None] * p[1] + l2[ins, None] * p[2]
        np.add.at(acc, (ys[ins], xs[ins]), q)
        np.add.at(cnt, (ys[ins], xs[ins]), 1)
    at = np.nonzero(cnt > 0)
    return acc[at] / cnt[at][:, None], at


def main():
    sc = json.load(open(os.path.join(SRC, "scene.json")))
    for name, m in sc["materials"].items():
        if m["recipe"] in ("rim", "fakeEyeShadow", "unlitHair", "flipbookMesh", "foxTail"):
            continue
        if m["recipe"] == "eye":
            save(name, eyes(m) * eye_shadow(sc, 512)[..., None])
            print(f"{name}: eyes, with the fake eye shadow baked in")
            continue
        if m["recipe"] == "hair" and not m["extra"].get("shadowColorMap"):
            # tail strands: colour and cut-outs both on UV0
            base = load(m["baseColor"])
            save(name, srgb_to_lin(base[..., :3]), load(m["extra"]["opacityMask"], base.shape[1::-1])[..., 0])
            print(f"{name}: strands {m['baseColor']} with {m['extra']['opacityMask']}")
            continue
        if m["recipe"] == "hair":
            prim = hair_prim(sc, name)
            shadow = load(m["extra"]["shadowColorMap"])
            pts = np.load(os.path.join(SRC, f"mesh_p{prim:02d}.npz"))["uv0"]
            base = load(m["baseColor"])
            H, W = base.shape[:2]
            grey = srgb_to_lin(base[(pts[:, 1] % 1 * (H - 1)).astype(int), (pts[:, 0] % 1 * (W - 1)).astype(int), :3]).mean(0)
            a = np.clip(grey * np.array(m["inputs"]["baseTint"]), 0, 1)
            alpha = hair_alpha(m, shadow.shape[:2], prim)
            save(name, overlay(a, srgb_to_lin(shadow[..., :3])), alpha)
            print(f"{name}: hair overlay, base {np.round(a, 3)} on {m['extra']['shadowColorMap']} (UV1), "
                  f"strand opacity baked onto UV1 ({(alpha < 0.333).mean() * 100:.0f}% clipped)")
            continue
        if not m["baseColor"]:
            print(f"{name}: no base colour ({m['recipe']})")
            continue
        base = load(m["baseColor"])
        lin = srgb_to_lin(base[..., :3])
        alpha = None
        if m["recipe"] == "glass" and m["extra"].get("glassOpacityMask"):
            op = load(m["extra"]["glassOpacityMask"], base.shape[1::-1])
            alpha = op[..., 0]
        skin = f" x {SKIN_GAIN[name]} (skin)" if name in SKIN_GAIN else ""
        if m["switches"].get("UseDyeing") and m["extra"].get("dyeingTexMap"):
            d = load(m["extra"]["dyeingTexMap"], base.shape[1::-1])
            lin = dye(lin, d, m["inputs"])
            print(f"{name}: dyed ({m['baseColor']} x {m['extra']['dyeingTexMap']}){skin}")
        else:
            print(f"{name}: {m['baseColor']}{skin}")
        save(name, lin * SKIN_GAIN.get(name, 1.0), alpha)
    texture_sets(sc)


def texture_sets(sc):
    """One albedo per FFXIV texture set (work/src/albedo/set_<texset>.png): atlas pieces pasted into their
    rectangles (alpha kept only where the piece cuts out), the eyes with the lens patch."""
    from texsets import CUTOUT, LENS_COLOR, LENS_UV, SETS, members
    for ts, (W, H, _, _) in SETS.items():
        out = np.zeros((H, W, 4), np.uint8)
        for mat, (x, y, w, h) in members(ts):
            pw, ph = round(w * W), round(h * H)
            a = np.asarray(Image.open(os.path.join(OUT, mat + ".png")).convert("RGBA").resize((pw, ph), Image.LANCZOS)).copy()
            if mat not in CUTOUT and ts != "hair":
                a[..., 3] = 255
            x0, y0 = round(x * W), round(y * H)
            out[y0:y0 + ph, x0:x0 + pw] = a
        if ts == "eyes":
            px, py = int(LENS_UV[0] * W), int(LENS_UV[1] * H)
            r = max(4, W // 32)
            out[max(0, py - r):py + r, max(0, px - r):px + r, :3] = LENS_COLOR
        Image.fromarray(out).save(os.path.join(OUT, f"set_{ts}.png"))
    print("texture sets:", ", ".join(SETS))


if __name__ == "__main__":
    if "sets" in sys.argv:
        texture_sets(json.load(open(os.path.join(SRC, "scene.json"))))
    else:
        main()
