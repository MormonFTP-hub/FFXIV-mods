"""Load the GLB dump (work/src, from extract_src.py). Already in FFXIV axes: metres, Y up, +Z forward, +X = character's left."""
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


def materials():
    return list(scene()["materials"])


def joints():
    """{name: dict(parent, pos, world)} bind pose."""
    out = {}
    for n, j in scene()["joints"].items():
        w = np.array(j["world"])
        out[n] = {"parent": j["parent"], "pos": w[:3, 3].copy(), "world": w, "index": j["index"]}
    return out


def joint_names():
    js = scene()["joints"]
    names = [None] * len(js)
    for n, j in js.items():
        names[j["index"]] = n
    return names


def mesh(mat):
    """One material's mesh: pos, nrm, uv0..2 (glTF, v down), faces, vid, joints (N,4 names), weights (N,4)."""
    z = np.load(os.path.join(SRC, f"mesh_{mat}.npz"))
    m = {k: z[k] for k in z.files}
    names = np.array(joint_names(), object)
    m["bones"] = np.where(m["weights"] > 0, names[m["joints"]], "")
    m["name"] = mat
    m["material"] = scene()["materials"][mat]
    return m


def submesh(m, sel_faces):
    """Restrict a mesh to some triangles (bool mask or indices), dropping unused vertices."""
    f = m["faces"][sel_faces]
    used, remap = np.unique(f, return_inverse=True)
    out = {k: (v[used] if isinstance(v, np.ndarray) and v.ndim and len(v) == len(m["pos"]) else v) for k, v in m.items()}
    out["faces"] = remap.reshape(-1, 3)
    out["idx"] = used
    return out
