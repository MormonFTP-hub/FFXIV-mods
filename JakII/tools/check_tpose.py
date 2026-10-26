"""Pose the FFXIV naked c0101 body (and face 1) into Jak's T-pose (rig.jak_pose) and render the two overlaid."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402
import rig  # noqa: E402
import xivdata as xd  # noqa: E402
from objload import load_obj  # noqa: E402

ROOT = rig.ROOT
OUT = os.path.join(ROOT, "work", "preview")
SRC_OBJ = os.path.join(ROOT, "source", "JIIJak", "Jak.obj")
BODY = [f"chara/human/c0101/obj/body/b0001/model/c0101b0001_{s}.mdl" for s in ("top", "glv", "dwn", "sho")]
FACE = "chara/human/c0101/obj/face/f0001/model/c0101f0001_fac.mdl"


def body_meshes(deltas, with_face=True):
    out = []
    for p in BODY + ([FACE] if with_face else []):
        for me in xd.model(p)["meshes"]:
            bones = np.array([[("j_kao" if b.startswith("j_f_") else b) for b in row] for row in me["bones"]], object)
            posed, _ = rig.skin(me["pos"], bones, me["weights"], deltas)
            out.append((p.split("_")[-1][:3] + "_" + me["material"].split("_")[-1][:5], posed, me["faces"]))
    return out


def src_groups(src, alpha=0.35):
    return [dict(name=n, pos=m["pos"] * rig.S, faces=m["faces"], color=(0.7, 0.75, 0.8), alpha=alpha) for n, m in src.items()]


if __name__ == "__main__":
    src = load_obj(SRC_OBJ)
    names, parent, world = rig.load_skeleton()
    P, D = rig.jak_pose(names, parent, world)
    for b in ("j_ude_a_l", "j_ude_b_l", "j_te_l", "j_asi_a_l", "j_asi_c_l", "j_asi_d_l", "j_kubi", "j_kao"):
        print(f"{b:10s} posed {np.round(P.posed(b, D) / rig.S, 2)} (rip units)")
    groups = [dict(name=f"ff_{i}_{n}", pos=pos, faces=faces, color=(0.85, 0.2, 0.15))
              for i, (n, pos, faces) in enumerate(body_meshes(D))]
    groups += src_groups(src)
    scene = os.path.join(ROOT, "work", "tpose_overlay.obj")
    preview.write_obj(scene, groups)
    print(preview.render(scene, os.path.join(OUT, "tpose"), "front,side", 900))
    print(preview.render(scene, os.path.join(OUT, "tpose_head"), "front,side", 700,
                         region=((-0.25, 1.05, -0.3), (0.25, 1.55, 0.3))))
