"""Small numpy z-buffer rasteriser for orthographic preview renders of game-space meshes."""
import numpy as np
from PIL import Image, ImageDraw

VIEWS = {  # name: (screen right, screen up); the camera sits on right x up, looking back at the origin
    "front": (np.array([1.0, 0, 0]), np.array([0, 1.0, 0])),
    "back": (np.array([-1.0, 0, 0]), np.array([0, 1.0, 0])),
    "side": (np.array([0, 0, -1.0]), np.array([0, 1.0, 0])),   # character's left side
    "top": (np.array([1.0, 0, 0]), np.array([0, 0, -1.0])),
}


def sample(tex, uv):
    h, w = tex.shape[:2]
    x = np.clip((np.mod(uv[:, 0], 1.0) * w).astype(np.int64), 0, w - 1)
    y = np.clip((np.mod(uv[:, 1], 1.0) * h).astype(np.int64), 0, h - 1)  # uv: glTF convention, v down
    return tex[y, x]


def render(items, view, size=900, bounds=None, bg=(46, 46, 54), joints=None, alpha_cut=0.5):
    """items: dicts with pos (V,3), tris (T,3), uv (T,3,2) per corner (glTF v-down) or None,
    nrm (T,3,3) per corner, tex (H,W,4) uint8 or None, color (3,).
    bounds: (cx, cy, half) in view coordinates. Returns a PIL image."""
    right, up = VIEWS[view]
    fwd = np.cross(right, up)  # towards the camera
    if bounds is None:
        allp = np.concatenate([it["pos"] for it in items])
        a, b = allp @ right, allp @ up
        half = max(a.max() - a.min(), b.max() - b.min()) / 2 * 1.05
        bounds = ((a.max() + a.min()) / 2, (b.max() + b.min()) / 2, half)
    cx, cy, half = bounds
    scale = size / (2 * half)
    img = np.zeros((size, size, 3), np.float32) + np.array(bg, np.float32)
    zbuf = np.full((size, size), -np.inf)
    light = np.array([0.3, 0.5, 0.8])
    light = light / np.linalg.norm(light)
    for it in items:
        P = it["pos"]
        sx = (P @ right - cx) * scale + size / 2
        sy = size / 2 - (P @ up - cy) * scale
        sz = P @ fwd
        for t, tri in enumerate(it["tris"]):
            xs, ys, zs = sx[tri], sy[tri], sz[tri]
            x0, x1 = int(max(np.floor(xs.min()), 0)), int(min(np.ceil(xs.max()), size - 1))
            y0, y1 = int(max(np.floor(ys.min()), 0)), int(min(np.ceil(ys.max()), size - 1))
            if x0 > x1 or y0 > y1:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
            if abs(d) < 1e-9:
                continue
            w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
            w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
            w2 = 1 - w0 - w1
            inside = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
            if not inside.any():
                continue
            z = w0 * zs[0] + w1 * zs[1] + w2 * zs[2]
            py, px = np.nonzero(inside)
            zz = z[inside]
            ay, ax = py + y0, px + x0
            closer = zz > zbuf[ay, ax]
            if not closer.any():
                continue
            ay, ax, zz = ay[closer], ax[closer], zz[closer]
            bw = np.stack([w0[inside][closer], w1[inside][closer], w2[inside][closer]], 1)
            if it.get("tex") is not None:
                uv = bw @ it["uv"][t]
                c = sample(it["tex"], uv).astype(np.float32)
                keep = c[:, 3] >= alpha_cut * 255
                ay, ax, zz, bw, c = ay[keep], ax[keep], zz[keep], bw[keep], c[keep, :3]
            else:
                c = np.tile(np.asarray(it.get("color", (200, 200, 200)), np.float32), (len(ay), 1))
            n = bw @ it["nrm"][t]
            n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
            shade = 0.45 + 0.55 * np.clip(np.abs(n @ (light[0] * right + light[1] * up + light[2] * fwd)), 0, 1)
            img[ay, ax] = c * shade[:, None]
            zbuf[ay, ax] = zz
    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    if joints:
        dr = ImageDraw.Draw(out)
        for p, col in joints:
            x = (p @ right - cx) * scale + size / 2
            y = size / 2 - (p @ up - cy) * scale
            dr.ellipse([x - 3, y - 3, x + 3, y + 3], outline=col, fill=col)
    return out
