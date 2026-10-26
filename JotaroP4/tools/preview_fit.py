"""Render front/side/back previews of work/fit.pkl, with FFXIV joints (red) marked.

usage: python preview_fit.py <out_prefix> [colour_variant 0-3] [colour_by_slot]
"""
import os
import pickle
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX = os.path.join(ROOT, "source", "Jotaro Kujo (Part 4)", "Textures")
prefix = sys.argv[1]
variant = int(sys.argv[2]) if len(sys.argv) > 2 else 0
by_slot = len(sys.argv) > 3

fit = pickle.load(open(os.path.join(ROOT, "work", "fit.pkl"), "rb"))
body = np.array(Image.open(os.path.join(TEX, "t_4jtr01_body01_d" + ("" if variant == 0 else f"_#{variant}") + ".png")).convert("RGBA"))
iris = np.array(Image.open(os.path.join(TEX, "t_4jtr01_iris.png")).convert("RGBA"))
lash = np.array(Image.open(os.path.join(TEX, "t_4jtr01_eyelash.png")).convert("RGBA"))
SLOT_COL = {"top": (220, 80, 80), "glv": (80, 120, 230), "dwn": (80, 200, 90), "sho": (240, 200, 60),
            "fac": (230, 160, 200), "hir": (150, 90, 220)}

items = []
for m in fit["meshes"]:
    tex = iris if m["name"].startswith("eye") else lash if m["name"] == "face_3" else body
    uv = m["c_uv"].copy()
    uv[..., 1] = 1 - uv[..., 1]  # Collada v-up -> image rows
    if by_slot and "slot" in m:
        for slot in np.unique(m["slot"]):
            sel = m["slot"] == slot
            items.append(dict(pos=m["pos"], tris=m["tris"][sel], uv=None, nrm=m["c_nrm"][sel], tex=None,
                              color=SLOT_COL[slot]))
    else:
        items.append(dict(pos=m["pos"], tris=m["tris"], uv=uv, nrm=m["c_nrm"], tex=tex))
joints = [(p, (255, 60, 60)) for n, p in fit["ff_joints"].items() if n.startswith("j_") and "sk_" not in n] + \
         [(p, (60, 220, 255)) for n, p in fit["ff_joints"].items() if "sk_" in n]
bounds = (0.0, 0.88, 0.95)
for view in ("front", "side", "back"):
    render.render(items, view, bounds=bounds, joints=joints).save(f"{prefix}_{view}.png")
head = (0.0, 1.64, 0.16)
render.render(items, "front", bounds=head, size=600).save(f"{prefix}_head.png")
render.render(items, "side", bounds=(0.0, 1.64, 0.16), size=600).save(f"{prefix}_head_side.png")
print("saved", prefix)
