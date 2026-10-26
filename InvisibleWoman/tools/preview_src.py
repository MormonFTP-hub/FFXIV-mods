"""Render the source model at bind pose with its base colours (work/preview/src_*), one colour-coded sheet per
primitive, and print the bind-pose skeleton's main joints.

python -P -E tools/preview_src.py
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402
import srcdata as sd  # noqa: E402

ROOT = sd.ROOT
OUT = os.path.join(ROOT, "work", "preview")
BASE = {"MI_1050508_Head": "Head", "MI_1050508_Body": "Body_02", "MI_1050508_Body_02": "Body_02",
        "MI_1050508_Equip_05": "Equip_02", "MI_1050508_Equip_02": "Equip_02", "MI_1050508_Equip_04": "Equip_03",
        "MI_1050508_Equip_03": "Equip_03", "MI_1050508_Equip_01": "Equip_01", "MI_1050508_Hair_01": "Hair_01",
        "MI_1050508_Hair_02": "Hair_01"}
COLORS = [(0.9, 0.3, 0.3), (0.3, 0.5, 0.95), (0.95, 0.85, 0.2), (0.3, 0.8, 0.4), (0.7, 0.4, 0.9), (0.9, 0.6, 0.3),
          (0.3, 0.85, 0.85), (0.85, 0.85, 0.85), (0.5, 0.3, 0.2), (0.95, 0.5, 0.8), (0.2, 0.3, 0.4), (0.6, 0.9, 0.3),
          (0.4, 0.4, 0.4)]
SKIP = ("Rim_HeroDetails",)


def groups(textured=True, skip=SKIP):
    gs = []
    for i, n in enumerate(sd.prim_names()):
        if any(s in n for s in skip):
            continue
        m = sd.mesh(n)
        g = dict(name=n, pos=m["pos"], faces=m["faces"], uv=np.c_[m["uv0"][:, 0], 1 - m["uv0"][:, 1]])
        base = BASE.get(m["material"])
        if textured and base:
            g["texture"] = os.path.join(sd.TEX, f"MI_1050508_{base}_gltf_baseColor.png")
        else:
            g["color"] = COLORS[i % len(COLORS)]
        gs.append(g)
    return gs


if __name__ == "__main__":
    B = sd.bones()
    for b in ("pelvis", "spine_01", "spine_03", "spine_05", "neck_01", "head", "clavicle_l", "upperarm_l", "lowerarm_l",
              "hand_l", "middle_01_l", "thigh_l", "calf_l", "foot_l", "ball_l"):
        if b in B:
            print(f"{b:12s} {np.round(B[b]['head'], 3)}")
    os.makedirs(OUT, exist_ok=True)
    scene = os.path.join(ROOT, "work", "src_tex.obj")
    preview.write_obj(scene, groups())
    print(preview.render(scene, os.path.join(OUT, "src_tex"), "front,side,back,three", 900))
    scene = os.path.join(ROOT, "work", "src_prims.obj")
    preview.write_obj(scene, groups(textured=False))
    print(preview.render(scene, os.path.join(OUT, "src_prims"), "front,side,back", 800))
