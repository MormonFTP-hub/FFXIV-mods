"""Load the psylocke.gg Mantis dump (work/src, from extract_src.py). The GLB already uses FFXIV axes:
metres, Y up, +Z forward, +X = character's left. Joints keep the game's Unreal names."""
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
    return list(scene()["joints"])


def joints():
    """{name: dict(parent, pos (3,), matrix (4,4))} in the bind pose."""
    out = {}
    for n, j in scene()["joints"].items():
        m = np.array(j["world"])
        out[n] = {"parent": j["parent"], "pos": m[:3, 3].copy(), "matrix": m}
    return out


def material(name):
    return scene()["materials"][name]


def mesh(name):
    """One material's primitive: pos, nrm, uv (the UV set its texture uses), faces, vid, joints (N,4) indices into
    joint_names(), weights (N,4)."""
    z = np.load(os.path.join(SRC, f"mesh_{name}.npz"))
    m = {k: z[k] for k in z.files}
    m["uv"] = m["uv1"] if material(name)["recipe"] == "hair" else m["uv0"]
    m["uv"] = np.mod(m["uv"], 1.0) if name == "Body" else m["uv"]     # the body sits in UDIM tile 1001-1002
    w = m["weights"]
    m["weights"] = w / np.maximum(w.sum(1, keepdims=True), 1e-9)
    m["name"] = name
    return m


def submesh(m, sel_faces):
    """Restrict a mesh to some triangles (bool mask or indices), dropping unused vertices."""
    f = m["faces"][sel_faces]
    used, remap = np.unique(f, return_inverse=True)
    out = {k: (v[used] if isinstance(v, np.ndarray) and v.ndim and len(v) == len(m["pos"]) else v) for k, v in m.items()}
    out["faces"] = remap.reshape(-1, 3)
    out["idx"] = used
    return out
