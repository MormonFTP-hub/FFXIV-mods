"""Pose the fitted Lich King with his FFXIV weights (arms raised and forward, a stride, knee bent, head turned)
and render it, to check how the armour deforms."""
import math
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402
import rig  # noqa: E402
from preview_src import groups_of, write_obj  # noqa: E402

ROOT = rig.ROOT


def test_pose():
    names, parent, world = rig.load_skeleton()
    P = rig.Pose(names, parent, world)

    def turn(bone, axis, deg, pivot_bone=None):
        par = parent[bone]
        base = P.own.get(par) if par in P.own else None
        piv = P.pos(pivot_bone or bone)
        D = rig.rot_about(rig.axis_angle(axis, math.radians(deg)), piv)
        if base is None:
            # inherit the nearest posed ancestor
            a = par
            while a is not None and a not in P.own:
                a = parent[a]
            base = P.own.get(a, np.eye(4)) if a else np.eye(4)
        pv = (base @ np.append(piv, 1))[:3]
        P.set(bone, rig.rot_about(rig.axis_angle(axis, math.radians(deg)), pv) @ base)
        return D

    turn("j_ude_a_l", [0, 0, 1], 55)      # left arm up to the side
    turn("j_ude_a_r", [1, 0, 0], -70)     # right arm forward
    turn("j_ude_b_r", [0, 1, 0], 60)      # right elbow bent
    turn("j_asi_a_l", [1, 0, 0], -35)     # left thigh forward
    turn("j_asi_b_l", [1, 0, 0], 50)      # left knee bent
    turn("j_asi_a_r", [1, 0, 0], 20)      # right thigh back
    turn("j_kubi", [0, 1, 0], 35)         # head turned
    for s, ang in (("l", 25), ("r", 10)):
        for f in ("hito", "naka", "kusu", "ko"):
            turn(f"j_{f}_a_{s}", [0, 0, 1], -ang if s == "l" else ang)
    return P.deltas()


if __name__ == "__main__":
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit", "fitted.pkl"), "rb"))
    D = test_pose()
    posed, _ = rig.skin(fit["pos"], fit["bones"], fit["weights"], D)
    m = dict(fit, pos=posed)
    scene = os.path.join(ROOT, "work", "check_pose.obj")
    write_obj(scene, groups_of(m, "pz"))
    print(preview.render(scene, os.path.join(ROOT, "work", "preview", "pose"), "front,side,back", 900))
