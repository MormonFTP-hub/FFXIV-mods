"""Per-pixel z-buffered render of the converted Cloud using the baked FFXIV
diffuse textures (alpha cutout included). render.py <out.png>"""
import os
import pickle
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WORK = os.path.join(ROOT, "work")
PNG = os.path.join(WORK, "tex", "png")
MAT = {"Body A": "top_a", "Shirt": "top_a", "Skin": "top_a", "Bandage": "top_a", "Body B": "top_b", "Pants": "top_b",
       "Head": "glv_a", "Eyelashes": "glv_a", "Hair": "glv_b", "Eyebrows": "glv_b", "Eyes": "dwn_a", "Mouth": "dwn_b"}


def rot_y(deg):
    t = np.radians(deg)
    return np.array([[np.cos(t), 0, np.sin(t)], [0, 1, 0], [-np.sin(t), 0, np.cos(t)]])


def render(meshes, yaw, W=520, H=900):
    R = rot_y(yaw)
    color = np.full((H, W, 3), (38, 40, 48), np.float32)
    zbuf = np.full((H, W), -np.inf, np.float32)
    scale = H / 2.0
    light = np.array([0.35, 0.55, 0.75])
    light /= np.linalg.norm(light)
    for name, m in meshes.items():
        tex = np.asarray(Image.open(os.path.join(PNG, f"cloud_{MAT[name]}_d.png")).convert("RGBA")).astype(np.float32) / 255
        th, tw = tex.shape[:2]
        P = m["P"] @ R.T
        N = m["N"] @ R.T
        sx = W / 2 + P[:, 0] * scale
        sy = H - 12 - P[:, 1] * scale
        for tri in m["tris"]:
            x, y = sx[tri], sy[tri]
            x0, x1 = int(max(np.floor(x.min()), 0)), int(min(np.ceil(x.max()), W - 1))
            y0, y1 = int(max(np.floor(y.min()), 0)), int(min(np.ceil(y.max()), H - 1))
            if x0 > x1 or y0 > y1:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            d = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2])
            if abs(d) < 1e-9:
                continue
            l0 = ((y[1] - y[2]) * (gx - x[2]) + (x[2] - x[1]) * (gy - y[2])) / d
            l1 = ((y[2] - y[0]) * (gx - x[2]) + (x[0] - x[2]) * (gy - y[2])) / d
            l2 = 1 - l0 - l1
            inside = (l0 >= -1e-4) & (l1 >= -1e-4) & (l2 >= -1e-4)
            if not inside.any():
                continue
            z = l0 * P[tri[0], 2] + l1 * P[tri[1], 2] + l2 * P[tri[2], 2]
            ys, xs = np.nonzero(inside)
            zz = z[ys, xs]
            py, px = ys + y0, xs + x0
            closer = zz > zbuf[py, px]
            if not closer.any():
                continue
            ys, xs, py, px, zz = ys[closer], xs[closer], py[closer], px[closer], zz[closer]
            b = np.stack([l0[ys, xs], l1[ys, xs], l2[ys, xs]], 1)
            uv = b @ m["uv"][tri]
            tx = ((uv[:, 0] % 1.0) * tw).astype(int).clip(0, tw - 1)
            ty = ((uv[:, 1] % 1.0) * th).astype(int).clip(0, th - 1)
            texel = tex[ty, tx]
            keep = texel[:, 3] >= 0.5
            if not keep.any():
                continue
            n = b[keep] @ N[tri]
            n /= np.linalg.norm(n, axis=1, keepdims=True).clip(1e-9)
            shade = 0.38 + 0.75 * np.clip(n @ light, 0, 1)
            color[py[keep], px[keep]] = np.clip(texel[keep, :3] * 255 * shade[:, None], 0, 255)
            zbuf[py[keep], px[keep]] = zz[keep]
    return color.astype(np.uint8)


def main(out):
    meshes = pickle.load(open(os.path.join(WORK, "cloud_xiv_meshes.pkl"), "rb"))
    views = [render(meshes, a) for a in (0, 35, 180)]
    img = np.concatenate(views, axis=1)
    Image.fromarray(img).save(out)
    print("saved", out)


if __name__ == "__main__":
    main(sys.argv[1])
