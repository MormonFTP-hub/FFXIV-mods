"""The Hero Chaos Chao (SA2B, source/HeroChaos/HeroChaosChao.obj) as per-node meshes.

The OBJ keeps SA2's node split ("001_object_0021F18C", ...): each object is one rigid piece of
the Chao (body, head, an arm, a foot, an eye, ...). Units are SA2 units, +Y up, +Z forward.
"""
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "source", "HeroChaos")


def _mtl(path):
    mats, cur = {}, None
    for line in open(path, encoding="utf-8"):
        p = line.split()
        if not p:
            continue
        if p[0] == "newmtl":
            cur = mats[p[1]] = {"tex": None, "kd": (1.0, 1.0, 1.0)}
        elif p[0] == "map_Kd":
            cur["tex"] = os.path.join(SRC, " ".join(p[1:]))
        elif p[0] == "Kd":
            cur["kd"] = tuple(map(float, p[1:4]))
    return mats


def load(path=os.path.join(SRC, "HeroChaosChao.obj")):
    """List of pieces: {"object", "material", "texture", "positions", "normals", "uvs", "indices"}.
    One piece per (object, material); corners with distinct position/uv/normal become separate vertices."""
    mats = _mtl(os.path.splitext(path)[0] + ".mtl")
    V, VT, VN = [], [], []
    faces = {}  # (object, material) -> list of corner triples
    obj = mat = None
    for line in open(path, encoding="utf-8"):
        p = line.split()
        if not p:
            continue
        if p[0] == "v":
            V.append(list(map(float, p[1:4])))
        elif p[0] == "vt":
            VT.append(list(map(float, p[1:3])))
        elif p[0] == "vn":
            VN.append(list(map(float, p[1:4])))
        elif p[0] == "o":
            obj = p[1]
        elif p[0] == "usemtl":
            mat = p[1]
        elif p[0] == "f":
            corners = [tuple(int(x) - 1 for x in c.split("/")) for c in p[1:]]
            for i in range(1, len(corners) - 1):  # fan-triangulate
                faces.setdefault((obj, mat), []).extend([corners[0], corners[i], corners[i + 1]])
    V, VT, VN = np.array(V), np.array(VT), np.array(VN)
    pieces = []
    for (o, m), corners in faces.items():
        uniq, inv = np.unique(np.array(corners), axis=0, return_inverse=True)
        pieces.append({
            "object": o, "material": m, "texture": mats[m]["tex"], "kd": mats[m]["kd"],
            "positions": V[uniq[:, 0]], "uvs": VT[uniq[:, 1]], "normals": VN[uniq[:, 2]],
            "indices": inv.reshape(-1),
        })
    return pieces


if __name__ == "__main__":
    for pc in load():
        p = pc["positions"]
        print(f"{pc['object']:22} {pc['material']:20} {os.path.basename(pc['texture'] or '-'):26} "
              f"verts={len(p):3} tris={len(pc['indices']) // 3:3} "
              f"min={np.round(p.min(0), 2)} max={np.round(p.max(0), 2)} "
              f"uv[{pc['uvs'].min(0).round(2)}..{pc['uvs'].max(0).round(2)}]")
