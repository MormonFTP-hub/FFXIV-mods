"""Render the fitted Lich King (work/fit/fitted.pkl) over the FFXIV c0101 naked body and face 1.
Usage: check_fit.py [name] [region: full|head|hands|feet]"""
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402
import xivdata as xd  # noqa: E402
from preview_src import groups_of, write_obj  # noqa: E402

ROOT = preview.ROOT
OUT = os.path.join(ROOT, "work", "preview")
BODY = [f"chara/human/c0101/obj/body/b0001/model/c0101b0001_{s}.mdl" for s in ("top", "glv", "dwn", "sho")]
FACE = "chara/human/c0101/obj/face/f0001/model/c0101f0001_fac.mdl"
REGIONS = {"full": None, "head": ((-0.25, 1.35, -0.3), (0.25, 1.95, 0.3)),
           "hands": ((0.35, 0.8, -0.25), (0.8, 1.35, 0.2)), "feet": ((-0.3, -0.02, -0.3), (0.3, 0.45, 0.3))}


def ffxiv_groups(tag="ff", color=(0.85, 0.2, 0.15), alpha=0.35, offset=(0, 0, 0)):
    gs = []
    for p in BODY + [FACE]:
        for i, me in enumerate(xd.model(p)["meshes"]):
            gs.append(dict(name=f"{tag}_{p.split('_')[-1][:3]}_{i}", pos=me["pos"] + np.array(offset), faces=me["faces"],
                           color=color, alpha=alpha))
    return gs


if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else "fit"
    region = sys.argv[2] if len(sys.argv) > 2 else "full"
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit", "fitted.pkl"), "rb"))
    gs = groups_of(fit, "lk") + ffxiv_groups(alpha=1.0 if region == "head" else 0.35)
    if region == "full":
        gs += groups_of(fit, "lk2", offset=(-1.0, 0, 0))
    scene = os.path.join(ROOT, "work", f"check_{name}.obj")
    write_obj(scene, gs)
    os.makedirs(OUT, exist_ok=True)
    reg = REGIONS[region]
    print(preview.render(scene, os.path.join(OUT, f"{name}_{region}"), "front,side,back" if region in ("full", "head") else "front,side",
                         1000 if reg else 900, region=reg))
