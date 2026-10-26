"""Read a Valve SMD (the Sonic Forces rip): skeleton bind pose and skinned triangles.

Positions come back in FFXIV axes and metres: the SMD is Z up, -Y forward (Sonic faces -Y), in rip units
(the rip notes say the export is scaled 3600 %, i.e. 36 units per game metre).
"""
import os

import numpy as np

UNITS_PER_M = 36.0
# SMD (x = Sonic's left?, y, z up) -> game (x = character's left, y up, z forward); checked in analyze_src.py
TO_GAME = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)


def euler(rx, ry, rz):
    cx, sx, cy, sy, cz, sz = np.cos(rx), np.sin(rx), np.cos(ry), np.sin(ry), np.cos(rz), np.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def read(path):
    """{names, parents, world (B,4,4) in game axes/metres, tris: dict(pos, nrm, uv, bones (N,4) idx, weights, mat)}"""
    lines = open(path, encoding="latin-1").read().splitlines()
    i = 0
    names, parents, local = [], [], {}
    mats, pos, nrm, uv, bones, weights = [], [], [], [], [], []
    while i < len(lines):
        l = lines[i].strip()
        if l == "nodes":
            i += 1
            while lines[i].strip() != "end":
                a = lines[i].split('"')
                names.append(a[1])
                parents.append(int(a[2]))
                i += 1
        elif l == "skeleton":
            i += 1
            while lines[i].strip() != "end":
                t = lines[i].split()
                if t[0] != "time":
                    v = [float(x) for x in t[1:7]]
                    m = np.eye(4)
                    m[:3, :3] = euler(*v[3:])
                    m[:3, 3] = v[:3]
                    local.setdefault(int(t[0]), m)   # first frame only
                i += 1
        elif l == "triangles":
            i += 1
            while lines[i].strip() != "end":
                mat = lines[i].strip()
                for k in range(3):
                    t = lines[i + 1 + k].split()
                    pos.append([float(x) for x in t[1:4]])
                    nrm.append([float(x) for x in t[4:7]])
                    uv.append([float(x) for x in t[7:9]])
                    n = int(t[9]) if len(t) > 9 else 0
                    b = [int(t[10 + 2 * j]) for j in range(n)]
                    w = [float(t[11 + 2 * j]) for j in range(n)]
                    if not n:
                        b, w = [int(t[0])], [1.0]
                    bones.append(b)
                    weights.append(w)
                mats.append(mat)
                i += 4
            continue
        i += 1

    world = np.zeros((len(names), 4, 4))
    for b in range(len(names)):
        m = local.get(b, np.eye(4))
        world[b] = m if parents[b] < 0 else world[parents[b]] @ m
    G = np.eye(4)
    G[:3, :3] = TO_GAME / UNITS_PER_M
    world = G @ world
    # keep the bone axes orthonormal (the scale lives in the positions)
    world[:, :3, :3] *= UNITS_PER_M

    k = max(len(b) for b in bones)
    B = np.zeros((len(bones), max(k, 4)), int)
    W = np.zeros((len(bones), max(k, 4)))
    for v, (b, w) in enumerate(zip(bones, weights)):
        B[v, :len(b)] = b
        W[v, :len(w)] = w
    W /= W.sum(1, keepdims=True)
    tris = dict(pos=np.array(pos) @ TO_GAME.T / UNITS_PER_M, nrm=np.array(nrm) @ TO_GAME.T, uv=np.array(uv),
                bones=B, weights=W, mat=np.array(mats))
    return dict(names=names, parents=parents, world=world, tris=tris)


def weld(t, tol=1e-6):
    """Index the triangle-soup corners: (split vertex arrays, faces, vid = welded position id)."""
    n = len(t["pos"])
    key = np.c_[np.round(t["pos"] / tol), np.round(t["nrm"] * 1e4), np.round(t["uv"] * 1e5)].astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.ravel()
    out = {k: v[first] for k, v in t.items() if k != "mat"}
    faces = inv.reshape(-1, 3)
    pkey = np.round(out["pos"] / 1e-5).astype(np.int64)
    _, vid = np.unique(pkey, axis=0, return_inverse=True)
    out["faces"] = faces
    out["mat"] = t["mat"]
    out["vid"] = vid.ravel()
    return out


if __name__ == "__main__":
    import sys
    d = read(sys.argv[1])
    t = d["tris"]
    print(len(d["names"]), "bones,", len(t["pos"]) // 3, "tris")
    print("bbox", t["pos"].min(0).round(3), t["pos"].max(0).round(3))
    for b in range(len(d["names"])):
        print(f"{b:3d} {d['names'][b]:20s} parent {d['parents'][b]:3d} at {np.round(d['world'][b][:3, 3], 3)}")
