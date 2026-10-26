"""Render the dumped source (work/src) in its bind pose: all of Peni, then each mesh alone.

python -P -E tools/look_src.py [mesh index ...]   ->  work/preview/src_*.png
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402

ROOT = preview.ROOT
SRC = os.path.join(ROOT, "work", "src")
OUT = os.path.join(ROOT, "work", "preview")


def groups(only=None):
    sc = json.load(open(os.path.join(SRC, "scene.json")))
    gs = []
    for m in sc["meshes"]:
        if only is not None and m["index"] not in only:
            continue
        z = np.load(os.path.join(SRC, f"mesh_{m['index']}.npz"))
        tex = m["textures"].get("baseColorTexture")
        g = dict(name=f"m{m['index']}_{m['material'][11:]}", pos=z["pos"], faces=z["faces"], uv=z["uv0"])
        if tex:
            g["texture"] = os.path.join(SRC, "tex", tex + ".png")
        else:
            g["color"] = (0.9, 0.2, 0.9)
        gs.append(g)
    return gs


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    only = [int(a) for a in sys.argv[1:]] or None
    tag = "all" if only is None else "_".join(map(str, only))
    obj = os.path.join(OUT, f"src_{tag}.obj")
    preview.write_obj(obj, groups(only))
    print(preview.render(obj, os.path.join(OUT, f"src_{tag}"), "front,side,back", 900))
