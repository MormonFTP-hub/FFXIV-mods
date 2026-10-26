"""Read human.pbd (racial bone deformers) and deform c0101 meshes into another race's shape, the way the game
does for gear that has no model of its own (e.g. Viera male wearing c0101 models)."""
import json
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402

PBD = "chara/xls/boneDeformer/human.pbd"


def read(path=None):
    """{race id (e.g. 1701): {"parent": race id or None, "bones": {name: 4x4}}}"""
    d = open(path or xd.extract(PBD)[0], "rb").read()
    n = struct.unpack_from("<i", d, 0)[0]
    heads = [struct.unpack_from("<HHif", d, 4 + 12 * i) for i in range(n)]
    links = [struct.unpack_from("<HHHH", d, 4 + 12 * n + 8 * i) for i in range(n)]
    out = {}
    for i, (race, dix, off, scale) in enumerate(heads):
        bones = {}
        if off > 0:
            count = struct.unpack_from("<i", d, off)[0]
            name_offs = struct.unpack_from(f"<{count}H", d, off + 4)
            mat_off = off + 4 + 2 * count
            mat_off += (-mat_off) % 4
            for k in range(count):
                s = off + name_offs[k]
                name = d[s:d.index(b"\0", s)].decode()
                m = np.eye(4)
                m[:3, :] = np.array(struct.unpack_from("<12f", d, mat_off + 48 * k)).reshape(3, 4)
                bones[name] = m
        out[race] = {"index": i, "deformer": dix, "scale": scale, "bones": bones, "link": links[i]}
    by_index = {v["index"]: r for r, v in out.items()}
    for r, v in out.items():
        p = v["link"][0]
        v["parent"] = by_index.get(p) if p != 0xFFFF and by_index.get(p) != r else None
    return out


def chain(deformers, src, dst):
    """Per-bone 4x4 matrices taking race `src` bind space to race `dst` (dst must descend from src)."""
    path = []
    r = dst
    while r is not None and r != src:
        path.append(r)
        r = deformers[r]["parent"]
    if r != src:
        raise ValueError(f"{dst} does not derive from {src}")
    names = set().union(*(deformers[x]["bones"] for x in path)) if path else set()
    out = {}
    for b in names:
        m = np.eye(4)
        for x in reversed(path):           # nearest-to-source first
            m = deformers[x]["bones"].get(b, np.eye(4)) @ m
        out[b] = m
    return out


def deform(pos, bones, weights, mats, parents=None):
    """Linear-blend a mesh with per-bone deform matrices (bones missing from the deformer use their parent's)."""
    out = np.zeros_like(pos)
    hom = np.c_[pos, np.ones(len(pos))]
    for k in range(bones.shape[1]):
        for b in np.unique(bones[:, k]):
            if not b:
                continue
            sel = bones[:, k] == b
            name = b
            while name not in mats and parents and parents.get(name):
                name = parents[name]
            m = mats.get(name, np.eye(4))
            out[sel] += weights[sel, k][:, None] * (hom[sel] @ m.T)[:, :3]
    return out


if __name__ == "__main__":
    D = read()
    print("races:", sorted(D))
    for r in (101, 1701, 1801):
        print(r, "parent", D[r]["parent"], "bones", len(D[r]["bones"]), "scale", round(D[r]["scale"], 4))
    root = os.path.join(xd.ROOT, "work", "refs")
    a = json.load(open(os.path.join(root, "skeleton.json")))
    b = json.load(open(os.path.join(root, "skeleton_c1701.json")))
    M = chain(D, 101, 1701)
    errs = []
    for n in a:
        if n in b and n in M:
            pa = np.array(a[n]["world"])[:3, 3]
            pb = np.array(b[n]["world"])[:3, 3]
            errs.append((np.linalg.norm((M[n] @ np.append(pa, 1))[:3] - pb), n, np.linalg.norm(pb - pa)))
    errs.sort(reverse=True)
    print("deformed c0101 joint vs c1701 joint: worst", [(round(e, 4), n, round(m, 4)) for e, n, m in errs[:8]])
    print("median error", round(float(np.median([e for e, _, _ in errs])), 5), "over", len(errs), "bones;",
          "median c0101->c1701 joint move", round(float(np.median([m for _, _, m in errs])), 4))
