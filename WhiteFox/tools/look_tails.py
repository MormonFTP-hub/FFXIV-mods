"""Render the source with the tails in the idle pose (work/preview/src_tails_*)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import look_src  # noqa: E402
import preview  # noqa: E402
import srcdata as sd  # noqa: E402
import tail_pose  # noqa: E402

gs = look_src.groups()
for g in gs:
    if g["name"] in ("p03", "p05", "p07"):
        g["pos"] = tail_pose.pose(sd.prim(int(g["name"][1:])))[0]
scene = os.path.join(look_src.ROOT, "work", "src_tails.obj")
preview.write_obj(scene, gs)
print(preview.render(scene, os.path.join(look_src.OUT, "src_tails"), "front,side,back", 900))
