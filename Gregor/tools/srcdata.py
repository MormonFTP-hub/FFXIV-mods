"""Load the Blender dump of the Gregor FBX (work/src) in FFXIV axes: metres, Y up, +Z forward, +X = character's left."""
import json
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "work", "src")
TO_GAME = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)  # Blender (Z up, -Y forward) -> game


def scene():
    return json.load(open(os.path.join(SRC, "scene.json")))


def mesh(name):
    """One object's split-vertex mesh, converted to game axes. Shape keys come back as offsets in 'keys'."""
    z = np.load(os.path.join(SRC, f"mesh_{name}.npz"))
    sc = scene()["objects"][name]
    m = {k: z[k] for k in z.files if not k.startswith("key_")}
    m["pos"] = m["pos"] @ TO_GAME.T
    m["nrm"] = m["nrm"] @ TO_GAME.T
    m["keys"] = {k[4:]: z[k] @ TO_GAME.T for k in z.files if k.startswith("key_")}
    m["materials"] = sc["materials"]
    m["group_names"] = sc["groups"]
    m["armature"] = sc["armature"]
    return m


def bones(armature):
    """{bone: dict(parent, head, tail, matrix)} with positions and matrices in game axes."""
    out = {}
    R = np.eye(4)
    R[:3, :3] = TO_GAME
    for n, b in scene()["armatures"][armature].items():
        out[n] = {"parent": b["parent"], "head": TO_GAME @ np.array(b["head"]), "tail": TO_GAME @ np.array(b["tail"]),
                  "matrix": R @ np.array(b["matrix"])}
    return out


def submesh(m, sel_faces):
    """Restrict a mesh to some triangles (bool mask or indices), dropping unused vertices."""
    f = m["faces"][sel_faces]
    used, remap = np.unique(f, return_inverse=True)
    out = {k: (v[used] if isinstance(v, np.ndarray) and len(v) == len(m["pos"]) else v) for k, v in m.items()}
    out["faces"] = remap.reshape(-1, 3)
    out["mat"] = m["mat"][sel_faces]
    out["keys"] = {k: v[used] for k, v in m["keys"].items()}
    out["idx"] = used
    return out
