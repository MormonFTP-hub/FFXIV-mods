"""Render the unpacked source (work/src) textured, bind pose: work/preview/src_sheet.png

python -P -E tools/look_src.py [views] [primitive ...]     (default: every primitive fit.py keeps)
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402
import srcdata as sd  # noqa: E402
from fit import PRIMS  # noqa: E402

ROOT = preview.ROOT
TEX = {"main": "df.png", "tattoo": "tattoo_base.png"}

if __name__ == "__main__":
    m = sd.mesh()
    prims = [int(a) for a in sys.argv[2:]] or list(PRIMS)
    groups = []
    for p in prims:
        name, texset, uvk = PRIMS[p]
        f = m["faces"][m["prim"] == p]
        used, remap = np.unique(f, return_inverse=True)
        uv = m[uvk][used]
        groups.append(dict(name=f"p{p}_{name}", pos=m["pos"][used], faces=remap.reshape(-1, 3),
                           uv=np.c_[uv[:, 0], 1 - uv[:, 1]], texture=os.path.join(sd.TEX, TEX[texset])))
    os.makedirs(os.path.join(ROOT, "work", "preview"), exist_ok=True)
    obj = os.path.join(ROOT, "work", "preview", "src.obj")
    preview.write_obj(obj, groups)
    views = sys.argv[1] if len(sys.argv) > 1 else "front,side,back"
    print(preview.render(obj, os.path.join(ROOT, "work", "preview", "src"), views, 1000))
