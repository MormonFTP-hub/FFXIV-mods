"""The STL as an indexed mesh in game axes: work/src/high.npz {pos, faces, nrm}.

Units: the STL's millimetres / 1000, so the figure stands 2.0 tall ("figure metres"), feet on y=0.
Axes as FFXIV: Y up, +Z forward (her face), +X her left. The STL is Z up, facing -Y, +X her left.
Specks under 200 triangles (stray bits of the print: hair-tip flecks by the hands) are dropped; her
earrings (separate shells of ~1000 triangles each) stay.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stl  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "source", "sailor_moon.stl")
OUT = os.path.join(ROOT, "work", "src", "high.npz")
MIN_SHELL = 200


def vertex_normals(pos, faces):
    fn = np.cross(pos[faces[:, 1]] - pos[faces[:, 0]], pos[faces[:, 2]] - pos[faces[:, 0]])
    n = np.zeros_like(pos)
    for k in range(3):
        np.add.at(n, faces[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def load():
    d = np.load(OUT)
    return d["pos"], d["faces"], d["nrm"]


def main():
    v, f = stl.read(SRC)
    lab = stl.components(len(v), f)
    flab = lab[f[:, 0]]
    ids, cnt = np.unique(flab, return_counts=True)
    keep = np.isin(flab, ids[cnt >= MIN_SHELL])
    print(f"{len(ids)} shells; keeping {np.sum(cnt >= MIN_SHELL)} ({keep.sum()} of {len(f)} triangles)")
    f = f[keep]
    used, remap = np.unique(f, return_inverse=True)
    f = remap.reshape(-1, 3).astype(np.int32)
    v = v[used].astype(np.float64) / 1000.0
    pos = np.stack([v[:, 0], v[:, 2], -v[:, 1]], 1)
    pos[:, 1] -= pos[:, 1].min()
    nrm = vertex_normals(pos, f)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    np.savez(OUT, pos=pos, faces=f, nrm=nrm)
    e = np.linalg.norm(pos[f[:, [1, 2, 0]]] - pos[f], axis=2)
    print(f"{len(pos)} verts, {len(f)} tris; bbox {pos.min(0).round(3)} .. {pos.max(0).round(3)}; "
          f"edge median {np.median(e) * 1000:.2f} mm (figure), max {e.max() * 1000:.1f}")


if __name__ == "__main__":
    main()
