"""Render the fitted Griffith: bind pose over the FFXIV body, and a stress-test pose through his skin weights."""
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402
import rig  # noqa: E402
from check_tpose import body_meshes  # noqa: E402

ROOT = rig.ROOT
OUT = os.path.join(ROOT, "work", "preview")


def textures():
    tex, cur = {}, None
    for line in open(os.path.join(ROOT, "source", "Griffith.mtl")):
        if line.startswith("newmtl"):
            cur = line.split()[1]
        elif line.startswith("map_Kd"):
            tex[cur] = line.split()[1]
    return tex


def test_pose():
    names, parent, world = rig.load_skeleton()
    P = rig.Pose(names, parent, world)
    R = {
        "j_sebo_b": rig.axis_angle([0, 1, 0], np.radians(20)),
        "j_kao": rig.axis_angle([0, 1, 0], np.radians(35)) @ rig.axis_angle([1, 0, 0], np.radians(15)),
        "j_ude_a_l": rig.axis_angle([0, 0, 1], np.radians(35)) @ rig.axis_angle([0, 1, 0], np.radians(-50)),
        "j_ude_b_r": rig.axis_angle([0.7, 0.7, 0], np.radians(-95)),
        "j_ude_a_r": rig.axis_angle([0, 0, 1], np.radians(30)),
        "j_asi_a_l": rig.axis_angle([1, 0, 0], np.radians(-55)),
        "j_asi_c_l": rig.axis_angle([1, 0, 0], np.radians(75)),
        "j_asi_a_r": rig.axis_angle([1, 0, 0], np.radians(15)),
        "j_te_l": rig.axis_angle([0, 0, 1], np.radians(-25)),
    }
    for f in ("hito", "naka", "kusu", "ko"):
        for seg in "ab":
            R[f"j_{f}_{seg}_l"] = rig.axis_angle([0, 0, 1], np.radians(-55))
    out = {}
    for b in names:
        p = parent[b]
        Dp = out[p] if p is not None else np.eye(4)
        out[b] = Dp @ rig.rot_about(R[b], P.pos(b)) if b in R else Dp
    return out


def groups(fitted, deltas=None, skip=()):
    tex = textures()
    gs = []
    for name, m in fitted.items():
        if name in skip:
            continue
        pos = m["pos"]
        if deltas is not None:
            pos, _ = rig.skin(pos, m["bones"], m["weights"], deltas)
        gs.append(dict(name=name, pos=pos, faces=m["faces"], uv=m["uv"], texture=tex.get(m["material"])))
    return gs


if __name__ == "__main__":
    fitted = pickle.load(open(os.path.join(ROOT, "work", "fit", "fitted.pkl"), "rb"))
    names, parent, world = rig.load_skeleton()
    ident = {n: np.eye(4) for n in names}
    helmet_off = ("model_3_submesh_0", "model_3_submesh_1")
    gs = groups(fitted, skip=helmet_off)
    for i, (n, pos, faces) in enumerate(body_meshes(ident, with_face=False)):
        gs.append(dict(name=f"ff_{i}", pos=pos, faces=faces, color=(0.9, 0.2, 0.1), alpha=0.25))
    scene = os.path.join(ROOT, "work", "fit_bind.obj")
    preview.write_obj(scene, gs)
    print(preview.render(scene, os.path.join(OUT, "fit_bind"), "front,side,back", 800))

    scene = os.path.join(ROOT, "work", "fit_pose.obj")
    preview.write_obj(scene, groups(fitted, test_pose(), skip=("model_2_submesh_0", "model_2_submesh_1", "model_2_submesh_2")))
    print(preview.render(scene, os.path.join(OUT, "fit_pose"), "front,side,three", 800))
