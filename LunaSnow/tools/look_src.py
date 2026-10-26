"""Render the source model with its baked albedo textures (work/preview/src_*.png), one material per colour if --flat.

python -P -E tools/look_src.py [--flat] [material ...]
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402
import srcdata as sd  # noqa: E402

FLAT = [(0.9, 0.3, 0.3), (0.3, 0.6, 0.95), (0.95, 0.85, 0.2), (0.3, 0.8, 0.4), (0.7, 0.4, 0.9), (0.95, 0.55, 0.2),
        (0.2, 0.85, 0.85), (0.9, 0.4, 0.7), (0.6, 0.6, 0.6), (0.5, 0.3, 0.1), (0.1, 0.4, 0.2), (0.95, 0.95, 0.95),
        (0.2, 0.2, 0.6), (0.6, 0.2, 0.2), (0.4, 0.6, 0.2), (0.1, 0.1, 0.1), (0.8, 0.8, 0.5)]


def groups(mats, flat=False, offset=(0, 0, 0)):
    gs = []
    for i, mat in enumerate(mats):
        m = sd.mesh(mat)
        g = dict(name=mat, pos=m["pos"] + np.array(offset), faces=m["faces"],
                 uv=np.c_[m["uv0"][:, 0], 1 - m["uv0"][:, 1]])
        tex = os.path.join(sd.ALBEDO, f"{mat}.png")
        if flat or not os.path.exists(tex):
            g["color"] = FLAT[i % len(FLAT)]
        else:
            g["texture"] = tex
        gs.append(g)
    return gs


if __name__ == "__main__":
    args = sys.argv[1:]
    flat = "--flat" in args
    mats = [a for a in args if not a.startswith("--")] or [m for m in sd.materials() if m != "Rim_HeroDetails"]
    tag = "src_flat" if flat else "src"
    if len(mats) == 1:
        tag += "_" + mats[0]
    scene = os.path.join(sd.ROOT, "work", f"{tag}.obj")
    preview.write_obj(scene, groups(mats, flat))
    print(preview.render(scene, os.path.join(sd.ROOT, "work", "preview", tag), "front,side,back", 900))
    if flat:
        for i, m in enumerate(mats):
            print(f"  {m:16s} {FLAT[i % len(FLAT)]}")
