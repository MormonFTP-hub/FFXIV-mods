"""Load the GLB dump of Peni Parker (work/src, tools/export_src.py). Already in FFXIV axes: metres, Y up, +Z forward,
+X = her left."""
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


def bone_names():
    return [b["name"] for b in scene()["bones"]]


def mesh(index):
    """One primitive: pos, nrm, uv0 (v up), uv1.., col, faces, plus 'bones' (N,4) names and 'weights' (N,4)."""
    z = np.load(os.path.join(SRC, f"mesh_{index}.npz"))
    m = {k: z[k] for k in z.files}
    names = np.array(bone_names() + [""], object)
    j = np.where(m["weights"] > 0, m["joints"], len(names) - 1)
    m["bones"] = names[j]
    info = scene()["meshes"][index]
    m["material"] = info["material"]
    m["textures"] = info["textures"]
    m["index"] = index
    return m


def bones():
    """{bone: dict(parent, head (joint position), matrix (bind world 4x4))}."""
    out = {}
    for b in scene()["bones"]:
        w = np.array(b["world"])
        out[b["name"]] = {"parent": b["parent"], "head": w[:3, 3].copy(), "matrix": w}
    return out


def submesh(m, sel_faces):
    """Restrict a mesh to some triangles (bool mask or indices), dropping unused vertices."""
    f = m["faces"][sel_faces]
    used, remap = np.unique(f, return_inverse=True)
    out = {k: (v[used] if isinstance(v, np.ndarray) and v.ndim and len(v) == len(m["pos"]) else v) for k, v in m.items()}
    out["faces"] = remap.reshape(-1, 3)
    out["idx"] = used
    return out
