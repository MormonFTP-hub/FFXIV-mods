"""out/preview.png: the built models (read back from the .mdl / .tex files) in an arms-down idle pose:
Lady Loki as a Midlander woman, a Viera woman, an Au Ra woman, a Midlander man, a Roegadyn man and a Lalafell."""
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
FIGURES = [("c0201", None, -1.75), ("c0201", 1801, -1.05), ("c0201", 1401, -0.35), ("c0101", None, 0.4),
           ("c0901", None, 1.25), ("c1101", None, 1.95)]

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
