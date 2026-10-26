"""Renders of the source mesh in its texture colours (work/look/src_*.png), with a coordinate grid.

python -P -E tools/look_src.py [views] [cx,cy,cz,size] [grid]
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import look  # noqa: E402
import src  # noqa: E402

d = np.load(src.OUT)
views = sys.argv[1] if len(sys.argv) > 1 else "front,left,back"
region = None
if len(sys.argv) > 2:
    cx, cy, cz, size = map(float, sys.argv[2].split(","))
    region = ((cx, cy, cz), size)
grid = float(sys.argv[3]) if len(sys.argv) > 3 else 0.05
name = "src" if region is None else f"src_{'_'.join(sys.argv[2].split(','))}"
print(look.render(name, d["pos"], d["faces"], d["colour"], views, 1000, region, grid=grid))
