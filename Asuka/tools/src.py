"""The Tripo GLB as an indexed mesh in game axes: work/src/high.npz.

high.npz:
  pos, nrm   welded vertices (the GLB splits them along UV seams; welded here so the mesh is one surface)
  faces      triangles on the welded vertices
  cuv        per-corner UVs (faces x 3 x 2) for sampling the source textures. Tripo writes them v-up (Blender's
             convention, v=1 the image's top row) even though glTF wants v-down: sample with image row (1 - v)
  colour     per welded vertex: the colour texture averaged over its corners (display RGB 0..1)

Units: "figure metres", the GLB node's 0.5 scale applied, then scaled so she stands FIGURE_H tall, feet on y=0.
Axes as FFXIV: Y up, +Z forward (her face), +X her left. The GLB is Y up with her arms along Z, facing +X.
"""
import json
import os
import struct
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "source", "asuka.glb")
TEX = os.path.join(ROOT, "source", "textures")
OUT = os.path.join(ROOT, "work", "src", "high.npz")
FIGURE_H = 1.0
COLOUR = "Color_f4c13d47-8345-4cfa-aa4c-163b8c876573_0.png"


def read_glb(path):
    b = open(path, "rb").read()
    n = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + n])
    binary = b[20 + n + 8:]
    types = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}
    sizes = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

    def acc(i):
        a = j["accessors"][i]
        bv = j["bufferViews"][a["bufferView"]]
        dt = np.dtype(types[a["componentType"]])
        k = sizes[a["type"]]
        stride = bv.get("byteStride", dt.itemsize * k)
        start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        raw = np.frombuffer(binary, np.uint8, count=stride * (a["count"] - 1) + dt.itemsize * k, offset=start)
        rows = np.lib.stride_tricks.as_strided(raw, (a["count"], dt.itemsize * k), (stride, 1))
        return np.ascontiguousarray(rows).view(dt).reshape(a["count"], k) if k > 1 else \
            np.ascontiguousarray(rows).view(dt).ravel()

    prim = j["meshes"][0]["primitives"][0]
    scale = np.array(j["nodes"][0].get("scale", [1, 1, 1]), float)
    return (acc(prim["attributes"]["POSITION"]).astype(np.float64) * scale,
            acc(prim["attributes"]["NORMAL"]).astype(np.float64),
            acc(prim["attributes"]["TEXCOORD_0"]).astype(np.float64),
            acc(prim["indices"]).astype(np.int64).reshape(-1, 3))


def vertex_normals(pos, faces):
    fn = np.cross(pos[faces[:, 1]] - pos[faces[:, 0]], pos[faces[:, 2]] - pos[faces[:, 0]])
    n = np.zeros_like(pos)
    for k in range(3):
        np.add.at(n, faces[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def sample(img, uv):
    """Bilinear sample of an (H, W, C) float image at v-up UVs."""
    h, w = img.shape[:2]
    x = np.clip(uv[:, 0] % 1.0 * w - 0.5, 0, w - 1)
    y = np.clip((1.0 - uv[:, 1] % 1.0) * h - 0.5, 0, h - 1)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    x1, y1 = np.minimum(x0 + 1, w - 1), np.minimum(y0 + 1, h - 1)
    fx, fy = (x - x0)[:, None], (y - y0)[:, None]
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x1] * fx * (1 - fy) +
            img[y1, x0] * (1 - fx) * fy + img[y1, x1] * fx * fy)


def load():
    d = np.load(OUT)
    return d["pos"], d["faces"], d["nrm"]


def main():
    p, n, uv, f = read_glb(SRC)
    # GLB: +Y up, she faces +X, her left arm towards -Z  ->  game: x = -z_glb (her left), y, z = x_glb (forward)
    pos = np.stack([-p[:, 2], p[:, 1], p[:, 0]], 1)
    key = np.round(pos * 1e6).astype(np.int64)
    _, weld, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.ravel()
    wf = inv[f]
    ok = (wf[:, 0] != wf[:, 1]) & (wf[:, 1] != wf[:, 2]) & (wf[:, 2] != wf[:, 0])
    f, wf = f[ok], wf[ok]
    pos = pos[weld]
    pos[:, 1] -= pos[:, 1].min()
    k = FIGURE_H / pos[:, 1].max()
    pos *= k
    img = np.asarray(Image.open(os.path.join(TEX, COLOUR)).convert("RGB"), np.float32) / 255.0
    corner_col = sample(img, uv[f.ravel()]).reshape(-1, 3, 3)
    col = np.zeros((len(pos), 3))
    cnt = np.zeros(len(pos))
    np.add.at(col, wf.ravel(), corner_col.reshape(-1, 3))
    np.add.at(cnt, wf.ravel(), 1)
    col /= np.maximum(cnt, 1)[:, None]
    nrm = vertex_normals(pos, wf)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    np.savez(OUT, pos=pos, faces=wf.astype(np.int32), nrm=nrm, cuv=uv[f].astype(np.float32), colour=col)
    e = np.linalg.norm(pos[wf[:, [1, 2, 0]]] - pos[wf], axis=2)
    print(f"{len(p)} GLB verts -> {len(pos)} welded, {len(wf)} tris (dropped {np.sum(~ok)} degenerate); "
          f"bbox {pos.min(0).round(3)} .. {pos.max(0).round(3)}; edge median {np.median(e) * 1000:.2f} mm")


if __name__ == "__main__":
    main()
