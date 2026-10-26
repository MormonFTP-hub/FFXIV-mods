"""Rasterise triangles in texture space: for every covered texel, which triangle and its barycentric weights."""
import numpy as np


def rasterize(uv, faces, size, pad=0):
    """uv (N,2) in 0..1 (glTF: v down), faces (M,3) -> tri (H,W) int (-1 empty), bary (H,W,3).
    Texel centres are tested; with pad > 0, triangles are grown by that many texels (seam padding)."""
    H = W = size
    tri = np.full((H, W), -1, np.int64)
    bary = np.zeros((H, W, 3))
    P = uv * [W, H] - 0.5
    for t, (a, b, c) in enumerate(faces):
        pa, pb, pc = P[a], P[b], P[c]
        lo = np.floor(np.minimum(np.minimum(pa, pb), pc) - pad).astype(int)
        hi = np.ceil(np.maximum(np.maximum(pa, pb), pc) + pad).astype(int)
        lo = np.maximum(lo, 0)
        hi = np.minimum(hi, [W - 1, H - 1])
        if (hi < lo).any():
            continue
        xs, ys = np.meshgrid(np.arange(lo[0], hi[0] + 1), np.arange(lo[1], hi[1] + 1))
        d = (pb[1] - pc[1]) * (pa[0] - pc[0]) + (pc[0] - pb[0]) * (pa[1] - pc[1])
        if abs(d) < 1e-12:
            continue
        w0 = ((pb[1] - pc[1]) * (xs - pc[0]) + (pc[0] - pb[0]) * (ys - pc[1])) / d
        w1 = ((pc[1] - pa[1]) * (xs - pc[0]) + (pa[0] - pc[0]) * (ys - pc[1])) / d
        w2 = 1 - w0 - w1
        if pad:
            # distance-ish tolerance in barycentric units: pad texels over the triangle's size
            tol = pad / max(np.linalg.norm(pb - pa), np.linalg.norm(pc - pb), np.linalg.norm(pa - pc), 1e-6)
            inside = (w0 >= -tol) & (w1 >= -tol) & (w2 >= -tol)
            free = tri[ys, xs] < 0
            inside &= free
        else:
            inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        tri[ys[inside], xs[inside]] = t
        bary[ys[inside], xs[inside]] = np.stack([w0[inside], w1[inside], w2[inside]], -1)
    return tri, bary


def sample(img, uv):
    """Bilinear lookup of img (H,W,C) float at uv (...,2) (glTF: v down), wrapping."""
    H, W = img.shape[:2]
    x = np.mod(uv[..., 0], 1.0) * W - 0.5
    y = np.mod(uv[..., 1], 1.0) * H - 0.5
    x0 = np.floor(x).astype(int)
    y0 = np.floor(y).astype(int)
    fx = (x - x0)[..., None]
    fy = (y - y0)[..., None]
    x0 %= W
    y0 %= H
    x1 = (x0 + 1) % W
    y1 = (y0 + 1) % H
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x1] * fx * (1 - fy) +
            img[y1, x0] * (1 - fx) * fy + img[y1, x1] * fx * fy)
