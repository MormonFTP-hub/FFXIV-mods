"""Render the fitted Jak: bind pose over the FFXIV body, and a stress-test pose through his skin weights.
Usage: check_fit.py [region: full|head]"""
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
    out = {}
    for b in names:
        p = parent[b]
        Dp = out[p] if p is not None else np.eye(4)
        out[b] = Dp @ rig.rot_about(R[b], P.pos(b)) if b in R else Dp
    return out


def groups(fitted, deltas=None, skip=(), offset=(0, 0, 0)):
    gs = []
    for name, m in fitted.items():
        if name in skip:
            continue
        pos = m["pos"]
        if deltas is not None:
            pos, _ = rig.skin(pos, m["bones"], m["weights"], deltas)
        gs.append(dict(name=name, pos=pos + np.array(offset), faces=m["faces"], uv=m["uv"],
                       texture=os.path.join("JIIJak", m["texture"])))
    return gs


if __name__ == "__main__":
    region = sys.argv[1] if len(sys.argv) > 1 else "full"
    fitted = pickle.load(open(os.path.join(ROOT, "work", "fit", "fitted.pkl"), "rb"))
    names, parent, world = rig.load_skeleton()
    ident = {n: np.eye(4) for n in names}
    gs = groups(fitted)
    for i, (n, pos, faces) in enumerate(body_meshes(ident)):
        gs.append(dict(name=f"ff_{i}", pos=pos, faces=faces, color=(0.9, 0.2, 0.1), alpha=0.25))
    gs += groups(fitted, offset=(1.2, 0, 0))
    scene = os.path.join(ROOT, "work", "fit_bind.obj")
    preview.write_obj(scene, gs)
    if region == "head":
        print(preview.render(scene, os.path.join(OUT, "fit_head"), "front,side,back", 700,
                             region=((-0.3, 1.35, -0.3), (0.3, 1.95, 0.3))))
        sys.exit()
    print(preview.render(scene, os.path.join(OUT, "fit_bind"), "front,side,back", 900))
    scene = os.path.join(ROOT, "work", "fit_pose.obj")
    preview.write_obj(scene, groups(fitted, test_pose()))
    print(preview.render(scene, os.path.join(OUT, "fit_pose"), "front,side,three", 800))
