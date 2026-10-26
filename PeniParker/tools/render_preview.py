"""out/preview.png: the built models (read back from the .mdl / .tex files) in an arms-down idle pose:
Peni as a Midlander woman, a Viera woman, an Au Ra woman, a Midlander man, a Roegadyn man and a Lalafell."""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pbd  # noqa: E402
import preview  # noqa: E402
import rig  # noqa: E402
from check_fit import idle_pose  # noqa: E402
from check_mdl import bases, figure  # noqa: E402

ROOT = rig.ROOT
FIGURES = [("c0201", None, -1.6), ("c0201", 1801, -0.9), ("c0201", 1401, -0.2), ("c0101", None, 0.55),
           ("c0901", None, 1.45), ("c1101", None, 2.2)]

if __name__ == "__main__":
    bp = bases()
    D = pbd.read()
    gs = []
    for i, (race, deform_to, x) in enumerate(FIGURES):
        _, parents, _ = rig.load_skeleton(f"skeleton_{race}")
        deform = pbd.chain(D, int(race[1:]), deform_to) if deform_to else None
        gs += figure(race, f"f{i}", bp, (x, 0, 0), deltas=idle_pose(race), deform=deform, parents=parents)
    scene = os.path.join(ROOT, "work", "final_preview.obj")
    preview.write_obj(scene, gs)
    sheet = preview.render(scene, os.path.join(ROOT, "work", "preview", "final"), "front,three", 1100)
    shutil.copy(sheet, os.path.join(ROOT, "out", "preview.png"))
    print("wrote out/preview.png")
