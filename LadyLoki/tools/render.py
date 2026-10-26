"""Tiny numpy point-splat renderer for previewing meshes (orthographic)."""
import numpy as np
from PIL import Image


def _tex_lookup(img, uv):
    h, w = img.shape[:2]
    u = np.mod(uv[:, 0], 1.0); v = np.mod(uv[:, 1], 1.0)
    x = np.clip((u * w).astype(np.int64), 0, w - 1)
    y = np.clip(((1.0 - v) * h).astype(np.int64), 0, h - 1)
    return img[y, x]


def render(items, right, up, size=1024, bounds=None, bg=(48, 48, 56), seed=0, alpha_cut=0.3):
    """items: list of dict(pos (V,3), nrm (V,3), uv (V,2), tris (T,3), tex (H,W,4) uint8 or None, color (3,)).
    right/up: view axes (3,) — camera looks along cross(up, right)."""
    rng = np.random.default_rng(seed)
    right = np.asarray(right, float); up = np.asarray(up, float)
    fwd = np.cross(up, right)  # direction from camera into the scene
    allp = np.concatenate([it['pos'] for it in items])
    if bounds is None:
        x = allp @ right; y = allp @ up
        cx, cy = (x.min() + x.max()) / 2, (y.min() + y.max()) / 2
        half = max(x.max() - x.min(), y.max() - y.min()) / 2 * 1.05
        bounds = (cx, cy, half)
    cx, cy, half = bounds
    scale = size / (2 * half)
    zbuf_d = []; zbuf_px = []; zbuf_c = []
    light = -fwd + up * 0.5 + right * 0.3; light /= np.linalg.norm(light)
    for it in items:
        P = it['pos']; T = it['tris']
        a, b, c = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]
        sx = lambda p: (p @ right - cx) * scale + size / 2
        sy = lambda p: size / 2 - (p @ up - cy) * scale
        ax, bx, cxp = sx(a), sx(b), sx(c); ay, by, cyp = sy(a), sy(b), sy(c)
        area = np.abs((bx - ax) * (cyp - ay) - (cxp - ax) * (by - ay)) / 2
        n = np.clip(np.ceil(area * 3).astype(np.int64), 1, 4000)
        tri_id = np.repeat(np.arange(len(T)), n)
        r1 = rng.random(len(tri_id)); r2 = rng.random(len(tri_id))
        s = np.sqrt(r1)
        w0 = 1 - s; w1 = s * (1 - r2); w2 = s * r2
        Tt = T[tri_id]
        p = P[Tt[:, 0]] * w0[:, None] + P[Tt[:, 1]] * w1[:, None] + P[Tt[:, 2]] * w2[:, None]
        if it.get('nrm') is not None:
            N = it['nrm']
            nn = N[Tt[:, 0]] * w0[:, None] + N[Tt[:, 1]] * w1[:, None] + N[Tt[:, 2]] * w2[:, None]
            nn /= np.linalg.norm(nn, axis=1, keepdims=True) + 1e-9
            shade = 0.35 + 0.65 * np.abs(nn @ light)
        else:
            shade = np.ones(len(p))
        if it.get('tex') is not None:
            UV = it['uv']
            uv = UV[Tt[:, 0]] * w0[:, None] + UV[Tt[:, 1]] * w1[:, None] + UV[Tt[:, 2]] * w2[:, None]
            col = _tex_lookup(it['tex'], uv).astype(np.float64)
            keep = col[:, 3] >= alpha_cut * 255 if col.shape[1] == 4 else np.ones(len(col), bool)
            col = col[:, :3]
        else:
            col = np.tile(np.asarray(it.get('color', (200, 200, 200)), float), (len(p), 1))
            keep = np.ones(len(p), bool)
        col = col * shade[:, None]
        px = np.floor(sx(p)).astype(np.int64); py = np.floor(sy(p)).astype(np.int64)
        keep &= (px >= 0) & (px < size) & (py >= 0) & (py < size)
        zbuf_d.append((p @ fwd)[keep]); zbuf_px.append((py * size + px)[keep]); zbuf_c.append(col[keep])
    d = np.concatenate(zbuf_d); pxi = np.concatenate(zbuf_px); col = np.concatenate(zbuf_c)
    order = np.lexsort((d, pxi))
    pxi = pxi[order]; col = col[order]
    first = np.ones(len(pxi), bool); first[1:] = pxi[1:] != pxi[:-1]
    img = np.zeros((size * size, 3)); img[:] = bg
    img[pxi[first]] = col[first]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8).reshape(size, size, 3)), bounds
