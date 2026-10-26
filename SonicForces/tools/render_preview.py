"""out/preview.png: the built models (read back from the .mdl / .tex files) in an arms-down idle pose:
Sonic as a Viera man, Super Sonic as a Midlander man, Sonic as a Lalafell, Sonic as a Midlander woman."""
import os
import pickle
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pbd  # noqa: E402
import preview  # noqa: E402
import rig  # noqa: E402
import xivdata as xd  # noqa: E402
from check_fit import idle_pose  # noqa: E402
from check_mdl import mdl_groups, tex_png  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
FIGURES = [("c0101", "sonic", "r", 1701, -1.5), ("c0101", "super", "r", None, -0.5),
           ("c1101", "sonic", "r", None, 0.4), ("c0201", "sonic", "l", None, 1.2)]

if __name__ == "__main__":
    tex_index = pickle.load(open(os.path.join(B, "tex", "index.pkl"), "rb"))
    bases = {k[:-5]: tex_png(v[0], k) for k, v in tex_index.items() if k.endswith("_base")}
    gs = []
    for race, look, mouth, deform_to, x in FIGURES:
        _, parents, _ = rig.load_skeleton(f"skeleton_{race}")
        deform = pbd.chain(pbd.read(), int(race[1:]), deform_to) if deform_to else None
        pose = idle_pose(race)
        for slot in ("top", "glv", "dwn", "sho", f"met_{look}_{mouth}"):
            gs += mdl_groups(os.path.join(B, "mdl", f"{race}_{slot}.mdl"), f"{race}{look}_{slot}", look, bases,
                             (x, 0, 0), pose, deform, parents)
    scene = os.path.join(ROOT, "work", "final_preview.obj")
    preview.write_obj(scene, gs)
    sheet = preview.render(scene, os.path.join(ROOT, "work", "preview", "final"), "three,front", 1100)
    shutil.copy(sheet, os.path.join(ROOT, "out", "preview.png"))
    print("wrote out/preview.png")
