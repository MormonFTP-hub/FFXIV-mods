"""Skinning matrices that put White Fox's three tails into the first frame of the viewer's idle animation
(Lobby_Stand_Idle), with the pelvis held at its bind pose. In the bind pose the tails stick straight out sideways;
in the idle they hang and sweep out behind her.

    pose(names, pos) -> posed positions (and normals) of a tail mesh, by linear blend skinning
"""
import os
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glb  # noqa: E402
import srcdata as sd  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ANIM = "3991a22c114d517c65422674f5e8b731a5becadb66214e739014e94be282f402"   # Lobby_Stand_Idle
TAIL = re.compile(r"[LMR]_Tail_A\d+")
_skin = None


def quat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def skin_matrices():
    """{tail joint: 4x4} = posed world @ inverse bind world (source bind space)."""
    global _skin
    if _skin is not None:
        return _skin
    g = glb.Glb(next((ROOT / "source" / "cdn").glob(ANIM + ".*")))
    G = g.g
    nodes = G["nodes"]
    trs = {i: [np.array(n.get("translation", [0, 0, 0]), float), np.array(n.get("rotation", [0, 0, 0, 1]), float),
               np.array(n.get("scale", [1, 1, 1]), float)] for i, n in enumerate(nodes)}
    an = G["animations"][0]
    for ch in an["channels"]:
        path = ch["target"]["path"]
        if path not in ("translation", "rotation", "scale"):
            continue
        v = g.accessor(an["samplers"][ch["sampler"]]["output"])[0].astype(float)
        trs[ch["target"]["node"]][("translation", "rotation", "scale").index(path)] = v
    parent = {c: i for i, n in enumerate(nodes) for c in n.get("children", [])}
    world = {}

    def wm(i):
        if i not in world:
            t, r, s = trs[i]
            m = np.eye(4)
            m[:3, :3] = quat(r) * s
            m[:3, 3] = t
            world[i] = m if i not in parent else wm(parent[i]) @ m
        return world[i]

    by_name = {n.get("name"): i for i, n in enumerate(nodes)}
    J = sd.joints()
    pelvis_anim = wm(by_name["pelvis"])
    pelvis_bind = J["pelvis"]["matrix"]
    _skin = {}
    for name, i in by_name.items():
        if name and TAIL.fullmatch(name) and name in J:
            posed = pelvis_bind @ np.linalg.inv(pelvis_anim) @ wm(i)
            _skin[name] = posed @ np.linalg.inv(J[name]["matrix"])
    return _skin


def pose(m):
    """Mesh m (srcdata prim) with its tail joints posed: (pos, nrm)."""
    S = skin_matrices()
    P = np.c_[m["pos"], np.ones(len(m["pos"]))]
    pos = np.zeros((len(P), 3))
    lin = np.zeros((len(P), 3, 3))
    for k in range(m["jnames"].shape[1]):
        w = m["weights"][:, k]
        for j in np.unique(m["jnames"][:, k]):
            sel = (m["jnames"][:, k] == j) & (w > 0)
            if not sel.any():
                continue
            M = S.get(j, np.eye(4))
            pos[sel] += w[sel, None] * (P[sel] @ M.T)[:, :3]
            lin[sel] += w[sel, None, None] * M[:3, :3]
    tot = m["weights"].sum(1)
    pos /= np.maximum(tot, 1e-9)[:, None]
    n = np.einsum("nij,nj->ni", np.linalg.inv(lin + np.eye(3) * 1e-9).transpose(0, 2, 1), m["nrm"])
    return pos, n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)


if __name__ == "__main__":
    S = skin_matrices()
    print(len(S), "tail joints posed")
    for pi in (3, 5, 7):
        m = sd.prim(pi)
        p, _ = pose(m)
        print(f"p{pi:02d}: bind {m['pos'].min(0).round(2)}..{m['pos'].max(0).round(2)} -> posed {p.min(0).round(2)}..{p.max(0).round(2)}")
