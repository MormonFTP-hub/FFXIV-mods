"""Load the dump of the Unseen Weaver glTF (work/src, from export_src.py). Already in FFXIV axes: metres, Y up,
+Z forward, +X = character's left."""
import json
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "work", "src")
TEX = os.path.join(SRC, "tex")
_scene = None


def scene():
    global _scene
    if _scene is None:
        _scene = json.load(open(os.path.join(SRC, "scene.json")))
    return _scene


def prim_names():
    return [p["name"] for p in scene()["prims"]]


def mesh(name):
    """One glTF primitive: pos, nrm, uv0, uv1, col, faces, groups (N, G) weights over group_names, vid."""
    z = np.load(os.path.join(SRC, f"mesh_{name}.npz"))
    pr = next(p for p in scene()["prims"] if p["name"] == name)
    m = {k: z[k] for k in z.files}
    m["group_names"] = pr["groups"]
    m["material"] = pr["material"]
    m["name"] = name
    return m


def bones():
    """{bone: dict(parent, head, matrix)} at bind pose."""
    out = {}
    for n, b in scene()["bones"].items():
        w = np.array(b["world"])
        out[n] = {"parent": b["parent"], "head": w[:3, 3].copy(), "matrix": w}
    return out


def submesh(m, sel_faces):
    """Restrict a mesh to some triangles (bool mask or indices), dropping unused vertices."""
    f = m["faces"][sel_faces]
    used, remap = np.unique(f, return_inverse=True)
    out = {k: (v[used] if isinstance(v, np.ndarray) and v.ndim and len(v) == len(m["pos"]) else v) for k, v in m.items()}
    out["faces"] = remap.reshape(-1, 3)
    out["idx"] = used
    return out
