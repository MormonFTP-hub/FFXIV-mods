"""Load the unpacked Gekko glb (work/src, from export_src.py). glTF axes are FFXIV axes already: metres, Y up,
+Z forward, +X = character's left."""
import json
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "work", "src")
TEX = os.path.join(SRC, "tex")
BODY = "body"
_scene = None


def scene():
    global _scene
    if _scene is None:
        _scene = json.load(open(os.path.join(SRC, "scene.json")))
    return _scene


def bones(skin=0):
    """{joint: dict(parent, head (bind position), matrix (bind world 4x4))}, parents listed before children."""
    sk = scene()["skins"][skin]
    return {n: {"parent": p, "head": np.array(b)[:3, 3], "matrix": np.array(b)}
            for n, p, b in zip(sk["joints"], sk["parents"], sk["bind"])}


def mesh(name=BODY, skin=0):
    """Split-vertex mesh: pos, nrm, uv0..2 (glTF, v down), col, joints/weights (N,8) as joint indices into the skin,
    faces, mat (per triangle, material index), vid (welded vertex id), plus the joint name list."""
    z = np.load(os.path.join(SRC, f"mesh_{name}.npz"))
    m = {k: z[k] for k in z.files}
    m["joint_names"] = scene()["skins"][skin]["joints"]
    m["materials"] = [x["name"] for x in scene()["materials"]]
    return m


def material(name):
    return next(m for m in scene()["materials"] if m["name"] == name)
