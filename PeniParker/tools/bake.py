"""Bake the two stylised-shader colours FFXIV can't compute into plain colour textures (work/src/tex/baked_*.png).

  hair  Marvel Rivals' hair shader colours the grey strand texture with a shadow-colour map looked up through a second
        UV set (near-black with teal streaks in this skin). Baked in that second set's layout (the FFXIV hair is
        mapped with it): the shadow colour times the strand texture's light and dark, and the opacity mask as
        alpha (baked_hair_alpha), both carried over from the first set by rasterising its coordinates.
  eyes  The eye shader is procedural: an iris disc of radius irisUvRadius round the UV centre, over a sclera map,
        with a dark limbus ring. Painted from its own maps and parameters.

python -P -E tools/bake.py
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import srcdata as sd  # noqa: E402

P = "MI_1042302_"
HAIR_MESH = 8
HAIR_SIZE = 2048


def img(name, mode="RGBA"):
    return np.asarray(Image.open(os.path.join(sd.TEX, P + name + ".png")).convert(mode)).astype(np.float64) / 255


def sample(im, uv):
    """Bilinear lookup; uv (..., 2) with v up (as the dump stores it)."""
    h, w = im.shape[:2]
    x = np.clip(uv[..., 0] * w - 0.5, 0, w - 1)
    y = np.clip((1 - uv[..., 1]) * h - 0.5, 0, h - 1)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    x1, y1 = np.minimum(x0 + 1, w - 1), np.minimum(y0 + 1, h - 1)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    return (im[y0, x0] * (1 - fx) * (1 - fy) + im[y0, x1] * fx * (1 - fy) + im[y1, x0] * (1 - fx) * fy
            + im[y1, x1] * fx * fy)


def rasterise(uv_t, attr, faces, size):
    """Interpolate a per-vertex attribute over the triangles laid out by uv_t (v up), into a size x size image.
    Returns (image, filled mask)."""
    out = np.zeros((size, size, attr.shape[1]))
    filled = np.zeros((size, size), bool)
    px = np.c_[uv_t[:, 0] * size - 0.5, (1 - uv_t[:, 1]) * size - 0.5]
    for f in faces:
        a, b, c = px[f]
        lo = np.floor(np.minimum(np.minimum(a, b), c)).astype(int)
        hi = np.ceil(np.maximum(np.maximum(a, b), c)).astype(int)
        lo, hi = np.maximum(lo, 0), np.minimum(hi, size - 1)
        if (hi < lo).any():
            continue
        ys, xs = np.mgrid[lo[1]:hi[1] + 1, lo[0]:hi[0] + 1]
        q = np.stack([xs.ravel(), ys.ravel()], 1).astype(float)
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-12:
            continue
        l0 = ((b[1] - c[1]) * (q[:, 0] - c[0]) + (c[0] - b[0]) * (q[:, 1] - c[1])) / d
        l1 = ((c[1] - a[1]) * (q[:, 0] - c[0]) + (a[0] - c[0]) * (q[:, 1] - c[1])) / d
        l2 = 1 - l0 - l1
        e = -0.6 / max(abs(d), 1) ** 0.5           # a little over half a pixel of conservative coverage
        inside = (l0 >= e) & (l1 >= e) & (l2 >= e)
        if not inside.any():
            continue
        q, l0, l1, l2 = q[inside].astype(int), l0[inside], l1[inside], l2[inside]
        val = l0[:, None] * attr[f[0]] + l1[:, None] * attr[f[1]] + l2[:, None] * attr[f[2]]
        out[q[:, 1], q[:, 0]] = val
        filled[q[:, 1], q[:, 0]] = True
    return out, filled


def dilate(im, filled, steps=12):
    """Grow filled texels outwards so filtering and mips don't pull in the empty background."""
    im, filled = im.copy(), filled.copy()
    for _ in range(steps):
        acc = np.zeros_like(im)
        cnt = np.zeros(filled.shape)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            f = np.roll(np.roll(filled, dy, 0), dx, 1)
            acc += np.roll(np.roll(im, dy, 0), dx, 1) * f[..., None]
            cnt += f
        grow = ~filled & (cnt > 0)
        im[grow] = acc[grow] / cnt[grow, None]
        filled |= grow
    return im, filled


def bake_hair():
    """In the second UV set's layout, which the hair is mapped with in FFXIV: the cards share one strand atlas in the
    first set (about 22 cards deep), but each has its own place in the second."""
    m = sd.mesh(HAIR_MESH)
    shadow = img("Girl_Hair_01_shadowColorMap")[..., :3]
    uv0, filled = rasterise(m["uv1"], m["uv0"], m["faces"], HAIR_SIZE)
    covered = filled.copy()
    uv0, filled = dilate(uv0, filled, 4)
    ys, xs = np.mgrid[0:HAIR_SIZE, 0:HAIR_SIZE]
    col = sample(shadow, np.stack([(xs + 0.5) / HAIR_SIZE, 1 - (ys + 0.5) / HAIR_SIZE], -1))
    strand = sample(img("Girl_Hair_01_baseColor", "L")[..., None], uv0)[..., 0]
    # the strand texture is mid grey with lighter and darker strands: keep that contrast round the shadow colour
    lit = np.clip(strand / 0.56, 0.55, 1.6)[..., None]
    col = np.clip(col * lit, 0, 1)
    alpha = np.where(filled, sample(img("Girl_Hair_01_opacityMask", "L")[..., None], uv0)[..., 0], 0)
    col, _ = dilate(np.where(filled[..., None], col, 0), filled, 12)
    Image.fromarray((col * 255 + 0.5).astype(np.uint8), "RGB").save(os.path.join(sd.TEX, "baked_hair.png"))
    Image.fromarray((alpha * 255 + 0.5).astype(np.uint8), "L").save(os.path.join(sd.TEX, "baked_hair_alpha.png"))
    print(f"hair: {covered.mean() * 100:.0f}% of the second UV set covered, mean colour "
          f"{np.round(col[covered].mean(0) * 255)}, mean opacity {alpha[covered].mean():.2f}")


def bake_eyes(size=512):
    inp = json.load(open(os.path.join(sd.SRC, "scene.json")))["materials"][P + "Girl_Eyes_01"]["extras"]
    r_iris = 0.17
    border = 0.012
    sclera_tint = 0.6
    if "inputs" in inp:
        r_iris = inp["inputs"].get("irisUvRadius", r_iris)
        border = inp["inputs"].get("irisBorderWidth", border)
        sclera_tint = inp["inputs"].get("scleraTint", [sclera_tint])[0]
    iris = img("Girl_Eyes_01_irisBaseColorMap")[..., :3]
    sclera = img("Girl_Eyes_01_scleraBaseColorMap")[..., :3]
    ys, xs = np.mgrid[0:size, 0:size]
    uv = np.stack([(xs + 0.5) / size, 1 - (ys + 0.5) / size], -1)
    d = uv - 0.5
    r = np.linalg.norm(d, axis=-1)
    iuv = d / (2 * r_iris) + 0.5
    ic = sample(iris, iuv)
    sc = sample(sclera, uv) * sclera_tint
    t = np.clip((r - r_iris) / border + 0.5, 0, 1)[..., None]          # soft iris edge
    col = ic * (1 - t) + sc * t
    limbus = np.exp(-((r - r_iris) / (border * 1.5)) ** 2)[..., None]   # dark ring round the iris
    col *= 1 - 0.6 * limbus
    out = np.dstack([np.clip(col, 0, 1), np.ones((size, size))])
    Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA").save(os.path.join(sd.TEX, "baked_eyes.png"))
    print(f"eyes: iris radius {r_iris} uv, sclera tint {sclera_tint}")


if __name__ == "__main__":
    bake_eyes()
    bake_hair()
