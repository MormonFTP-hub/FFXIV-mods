"""Render the unpacked source with the baked albedo (work/preview/src_*), whole and part by part.

python -P -E tools/look_src.py [parts]     parts: render each primitive on its own too
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
SKIP = ("rim", "fakeEyeShadow", "unlitHair")


def groups(only=None):
    sc = json.load(open(os.path.join(SRC, "scene.json")))
    gs = []
    for p in sc["primitives"]:
        m = sc["materials"][p["material"]]
        if m["recipe"] in SKIP or (only is not None and p["index"] not in only):
            continue
        z = np.load(os.path.join(SRC, p["mesh"]))
        uv = z["uv1"] if m["recipe"] == "hair" else z["uv0"]
        tex = os.path.join(SRC, "albedo", p["material"] + ".png")
        g = dict(name=f"p{p['index']:02d}", pos=z["pos"], faces=z["faces"], uv=np.c_[uv[:, 0], 1 - uv[:, 1]])
        if os.path.exists(tex):
            g["texture"] = tex
        else:
            g["color"] = (0.9, 0.6, 0.8)
        gs.append(g)
    return gs


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    scene = os.path.join(ROOT, "work", "src_all.obj")
    preview.write_obj(scene, groups())
    print(preview.render(scene, os.path.join(OUT, "src_all"), "front,side,back", 900))
    if "parts" in sys.argv:
        sc = json.load(open(os.path.join(SRC, "scene.json")))
        for p in sc["primitives"]:
            if sc["materials"][p["material"]]["recipe"] in SKIP:
                continue
            scene = os.path.join(ROOT, "work", f"src_p{p['index']:02d}.obj")
            preview.write_obj(scene, groups({p["index"]}))
            print(preview.render(scene, os.path.join(OUT, f"src_p{p['index']:02d}"), "front,back", 400))
