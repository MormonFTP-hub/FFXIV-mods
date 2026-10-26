"""Round-trip check: read the built .mdl files back and render them with the built .tex colour maps.

work/preview/mdl_<race>.png        bind pose, as a Midlander and (through the racial deformer) a Viera and an Au Ra
work/preview/mdl_<race>_slots.png  one flat colour per gear slot, to check the split
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
from build import LETTERS, SLOTS  # noqa: E402
from check_fit import run_pose  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
PNG = os.path.join(B, "texprev")
SLOT_COLOR = {"met": (0.9, 0.8, 0.2), "top": (0.2, 0.5, 0.9), "glv": (0.9, 0.3, 0.3), "dwn": (0.3, 0.8, 0.4),
              "sho": (0.7, 0.3, 0.9)}


def tex_png(src, name):
    os.makedirs(PNG, exist_ok=True)
    dst = os.path.join(PNG, name + ".png")
    if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
        Image.fromarray(xd.texture(src)).save(dst)
    return dst


def bases():
    idx = pickle.load(open(os.path.join(B, "tex", "index.pkl"), "rb"))
    return {k[:-5]: tex_png(v[0], k) for k, v in idx.items() if k.endswith("_base")}


def mdl_groups(path, slot, tag, base_png, offset=(0, 0, 0), deltas=None, deform=None, parents=None, color=None):
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
            letter = me["material"].rsplit("_", 1)[1][0]
            texset = LETTERS[slot]["abcdefgh".index(letter)]
            g.update(uv=np.c_[me["uv"][:, 0], 1 - me["uv"][:, 1]], texture=base_png[texset])
        gs.append(g)
    return gs


def figure(race, tag, base_png, offset, deltas=None, deform=None, parents=None, slot_colors=False):
    gs = []
    for slot in SLOTS:
        gs += mdl_groups(os.path.join(B, "mdl", f"{race}_{slot}.mdl"), slot, f"{tag}_{slot}", base_png, offset, deltas,
                         deform, parents, SLOT_COLOR[slot] if slot_colors else None)
    return gs


if __name__ == "__main__":
    race = sys.argv[1] if len(sys.argv) > 1 else "c0201"
    bp = bases()
    _, parents, _ = rig.load_skeleton(f"skeleton_{race}")
    D = pbd.read()
    gs = figure(race, "own", bp, (0, 0, 0))
    for i, other in enumerate((1801, 1401)):
        gs += figure(race, f"r{other}", bp, (0.8 * (i + 1), 0, 0), deform=pbd.chain(D, int(race[1:]), other),
                     parents=parents)
    scene = os.path.join(ROOT, "work", f"mdl_{race}.obj")
    preview.write_obj(scene, gs)
    print(preview.render(scene, os.path.join(ROOT, "work", "preview", f"mdl_{race}"), "front,three,back", 900))
    scene = os.path.join(ROOT, "work", f"mdl_{race}_slots.obj")
    preview.write_obj(scene, figure(race, "own", bp, (0, 0, 0), slot_colors=True))
    print(preview.render(scene, os.path.join(ROOT, "work", "preview", f"mdl_{race}_slots"), "front,side,back", 700))
    scene = os.path.join(ROOT, "work", f"mdl_{race}_run.obj")
    preview.write_obj(scene, figure(race, "own", bp, (0, 0, 0), deltas=run_pose(race)))
    print(preview.render(scene, os.path.join(ROOT, "work", "preview", f"mdl_{race}_run"), "front,side,three", 800))
