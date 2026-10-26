"""Re-bake a texture from one UV layout into another (per-triangle rasterization in destination UV space)."""
import numpy as np


def _sample(img, uv):
    h, w = img.shape[:2]
    x = np.mod(uv[:, 0], 1.0) * w - 0.5
    y = (1.0 - np.mod(uv[:, 1], 1.0)) * h - 0.5
    x0 = np.floor(x).astype(np.int64); y0 = np.floor(y).astype(np.int64)
    fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    x0 %= w; y0 %= h; x1 = (x0 + 1) % w; y1 = (y0 + 1) % h
    f = img.astype(np.float32)
    return (f[y0, x0] * (1 - fx) * (1 - fy) + f[y0, x1] * fx * (1 - fy) +
            f[y1, x0] * (1 - fx) * fy + f[y1, x1] * fx * fy)


def rebake(img, src_uv, dst_uv, tris, size, pad=4):
    """img: (H,W,C) uint8 sampled with src_uv; output (size,size,C) laid out by dst_uv."""
    C = img.shape[2]
    out = np.zeros((size, size, C), np.float32)
    filled = np.zeros((size, size), bool)
    du = np.mod(dst_uv, 1.0)
    # keep each triangle's dst UVs in one tile
    for t in tris:
        d = dst_uv[t]
        base = np.floor(d.mean(0))
        dt = d - base
        px = dt[:, 0] * size; py = (1.0 - dt[:, 1]) * size
        x0, x1 = int(np.floor(px.min())), int(np.ceil(px.max()))
        y0, y1 = int(np.floor(py.min())), int(np.ceil(py.max()))
        if x1 - x0 > size or y1 - y0 > size:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        cx = xs.ravel() + 0.5; cy = ys.ravel() + 0.5
        (ax, bx, cxp), (ay, by, cyp) = px, py
        den = (by - cyp) * (ax - cxp) + (cxp - bx) * (ay - cyp)
        if abs(den) < 1e-12:
            continue
        w0 = ((by - cyp) * (cx - cxp) + (cxp - bx) * (cy - cyp)) / den
        w1 = ((cyp - ay) * (cx - cxp) + (ax - cxp) * (cy - cyp)) / den
        w2 = 1 - w0 - w1
        eps = -0.02
        m = (w0 >= eps) & (w1 >= eps) & (w2 >= eps)
        if not m.any():
            continue
        s = src_uv[t]
        suv = s[0] * w0[m, None] + s[1] * w1[m, None] + s[2] * w2[m, None]
        X = np.mod(xs.ravel()[m], size); Y = np.mod(ys.ravel()[m], size)
        out[Y, X] = _sample(img, suv)
        filled[Y, X] = True
    # dilate into empty texels so mip-mapping/bilinear filtering doesn't bleed background
    for _ in range(pad):
        acc = np.zeros_like(out); cnt = np.zeros((size, size), np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sf = np.roll(filled, (dy, dx), (0, 1)); so = np.roll(out, (dy, dx), (0, 1))
            acc += so * sf[..., None]; cnt += sf
        grow = (~filled) & (cnt > 0)
        out[grow] = acc[grow] / cnt[grow, None]
        filled |= grow
    return np.clip(out, 0, 255).astype(np.uint8), filled
