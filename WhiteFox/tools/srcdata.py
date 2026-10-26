"""Load the unpacked psylocke.gg White Fox (work/src, from extract_src.py). Everything is already in FFXIV axes:
metres, Y up, +Z forward, +X = character's left."""
import json
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "work", "src")
TEX = os.path.join(SRC, "tex")
ALBEDO = os.path.join(SRC, "albedo")
_scene = None


def scene():
    global _scene
    if _scene is None:
        _scene = json.load(open(os.path.join(SRC, "scene.json")))
    return _scene


def joint_names():
    J = scene()["joints"]
    return sorted(J, key=lambda n: J[n]["index"])


def joints():
    """{joint: dict(parent, head (3,), matrix (4,4))} in the bind pose."""
    return {n: {"parent": j["parent"], "matrix": np.array(j["world"]), "head": np.array(j["world"])[:3, 3]}
            for n, j in scene()["joints"].items()}


def prim(i):
    """One primitive: pos, nrm, uv0..2, faces, vid, joints (N,4) as names, weights (N,4), material."""
    p = scene()["primitives"][i]
    z = np.load(os.path.join(SRC, p["mesh"]))
    m = {k: z[k] for k in z.files}
    names = np.array(joint_names(), object)
    m["jnames"] = names[m["joints"]]
    m["material"] = p["material"]
    m["index"] = i
    return m


def submesh(m, sel_faces):
    """Restrict a mesh to some triangles (bool mask or indices), dropping unused vertices."""
    f = m["faces"][sel_faces]
    used, remap = np.unique(f, return_inverse=True)
    out = {k: (v[used] if isinstance(v, np.ndarray) and v.ndim and len(v) == len(m["pos"]) else v) for k, v in m.items()}
    out["faces"] = remap.reshape(-1, 3)
    return out
