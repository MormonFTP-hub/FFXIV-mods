"""Load the work/src dump of Jubilee's model (tools/extract_src.py).

The glTF already uses FFXIV's axes (metres, Y up, +Z forward, +X = character's left), so nothing is converted.
Meshes are named by their material without the "MI_1064300_" prefix: Body, Head, Equip_01..04, Hair_01, Hair_02,
Eyes_01, Eyes_02, Rim_HeroDetails.
"""
import json
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "work", "src")
TEX = os.path.join(SRC, "tex")
PREFIX = "MI_1064300_"
_scene = None


def scene():
    global _scene
    if _scene is None:
        _scene = json.load(open(os.path.join(SRC, "scene.json")))
    return _scene


def names():
    return [scene()["materials"][p["material"]]["name"][len(PREFIX):] for p in scene()["prims"]]


def material(name):
    return next(m for m in scene()["materials"] if m["name"] == PREFIX + name)


def mesh(name):
    """One primitive: pos, nrm, uv (uv0), uv1, col, faces, vid (welded vertex id), joints (N,K bone names, '' unused),
    weights (N,K), plus its name and material dict."""
    i = names().index(name)
    z = np.load(os.path.join(SRC, f"mesh_{i}.npz"))
    m = {k: z[k] for k in z.files}
    m["joints"] = m["joints"].astype(object)
    m["uv"] = m.pop("uv0")
    m["name"] = name
    m["material"] = material(name)
    return m


def bones():
    """{bone: dict(parent, head (bind-pose position), matrix (4x4 bind-pose world matrix))}"""
    out = {}
    for n, b in scene()["bones"].items():
        mtx = np.array(b["bind"])
        out[n] = {"parent": b["parent"], "head": mtx[:3, 3].copy(), "matrix": mtx}
    return out


def texture_path(name, slot="baseColor"):
    t = material(name)["textures"].get(slot)
    return os.path.join(TEX, t + ".png") if t else None


def submesh(m, sel_faces):
    """Restrict a mesh to some triangles (bool mask or indices), dropping unused vertices."""
    f = m["faces"][sel_faces]
    used, remap = np.unique(f, return_inverse=True)
    out = {k: (v[used] if isinstance(v, np.ndarray) and v.ndim and len(v) == len(m["pos"]) else v) for k, v in m.items()}
    out["faces"] = remap.reshape(-1, 3)
    out["idx"] = used
    return out
