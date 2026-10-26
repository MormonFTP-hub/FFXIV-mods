"""Round-trip check: read the built .mdl files back and render them with the built .tex colour maps.

work/preview/mdl_<race>.png        Sonic and Super Sonic side by side (bind pose; Viera male shape for c0101)
work/preview/mdl_<race>_slots.png  the same, one flat colour per gear slot, to check the split
work/preview/mdl_<race>_run.png    a running pose through the built skin weights

python -P -E tools/check_mdl.py [race]
"""
import os
import pickle
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pbd  # noqa: E402
import preview  # noqa: E402
import rig  # noqa: E402
import xivdata as xd  # noqa: E402
from check_fit import run_pose  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
PNG = os.path.join(B, "texprev")
SLOT_COLOR = {"met": (0.9, 0.8, 0.2), "top": (0.2, 0.5, 0.9), "glv": (0.9, 0.3, 0.3), "dwn": (0.3, 0.8, 0.4),
              "sho": (0.7, 0.3, 0.9)}


def tex_png(src, name):
    os.makedirs(PNG, exist_ok=True)
    dst = os.path.join(PNG, name + ".png")
    Image.fromarray(xd.texture(src)).save(dst)
    return dst


def mdl_groups(path, tag, look, bases, offset=(0, 0, 0), deltas=None, deform=None, parents=None, color=None):
    gs = []
    for i, me in enumerate(xd.model(path)["meshes"]):
        pos = me["pos"]
        if deltas is not None:
            pos, _ = rig.skin(pos, me["bones"], me["weights"], deltas)
        if deform is not None:
            pos = pbd.deform(pos, me["bones"], me["weights"], deform, parents)
        g = dict(name=f"{tag}_{i}", pos=pos + np.array(offset), faces=me["faces"])
        if color:
            g["color"] = color
        else:
            kind = "eye" if me["material"].endswith("_b.mtrl") else "body"
            g.update(uv=np.c_[me["uv"][:, 0], 1 - me["uv"][:, 1]], texture=bases[f"{look}_{kind}"])
        gs.append(g)
    return gs


if __name__ == "__main__":
    race = sys.argv[1] if len(sys.argv) > 1 else "c0101"
    tex_index = pickle.load(open(os.path.join(B, "tex", "index.pkl"), "rb"))
    bases = {k[:-5]: tex_png(v[0], k) for k, v in tex_index.items() if k.endswith("_base")}
    M = lambda n: os.path.join(B, "mdl", f"{race}_{n}.mdl")  # noqa: E731
    _, parents, _ = rig.load_skeleton(f"skeleton_{race}")
    deform = pbd.chain(pbd.read(), 101, 1701) if race == "c0101" else None
    looks = [("sonic", "r", (0, 0, 0)), ("super", "l", (1.1, 0, 0))]

    for tag, kw in (("", {}), ("_slots", {"color": True}), ("_run", {"deltas": run_pose(race)})):
        gs = []
        for look, mouth, off in looks:
            for slot in ("top", "glv", "dwn", "sho", f"met_{look}_{mouth}"):
                c = SLOT_COLOR[slot[:3]] if kw.get("color") else None
                gs += mdl_groups(M(slot), f"{look}_{slot}", look, bases, off, kw.get("deltas"),
                                 deform if not tag else None, parents, c)
        scene = os.path.join(ROOT, "work", f"mdl_{race}{tag}.obj")
        preview.write_obj(scene, gs)
        print(preview.render(scene, os.path.join(ROOT, "work", "preview", f"mdl_{race}{tag}"), "front,three,back", 900))
