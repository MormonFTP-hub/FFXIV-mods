"""Render the extracted source (work/src) with its colour textures: whole model and one sheet per part.

python -P -E tools/look_src.py [part ...]   ->  work/preview/src_sheet.png, work/preview/part_<name>_sheet.png
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402

ROOT = preview.ROOT
SRC = os.path.join(ROOT, "work", "src")
PREV = os.path.join(ROOT, "work", "preview")
SKIP = {"Rim_HeroDetails", "Eyes_02"}


def group(name, mat):
    z = np.load(os.path.join(SRC, mat["mesh"]))
    albedo = os.path.join(SRC, "albedo", name + ".png")
    uv = z["uv1" if mat["recipe"] == "hair" else "uv0"].copy()
    uv[:, 1] = 1 - uv[:, 1]
    cut = mat["recipe"] in ("hair", "unlitHair")
    return dict(name=name, pos=z["pos"], faces=z["faces"], uv=uv, texture=albedo, alpha_texture=albedo if cut else None)


def main(parts):
    os.makedirs(PREV, exist_ok=True)
    mats = json.load(open(os.path.join(SRC, "scene.json")))["materials"]
    groups = [group(n, m) for n, m in mats.items() if n not in SKIP]
    if not parts:
        obj = os.path.join(PREV, "src.obj")
        preview.write_obj(obj, groups)
        print(preview.render(obj, os.path.join(PREV, "src"), "front,side,back", 1100))
    for g in groups:
        if parts and g["name"] not in parts:
            continue
        obj = os.path.join(PREV, f"part_{g['name']}.obj")
        preview.write_obj(obj, [g])
        print(preview.render(obj, os.path.join(PREV, f"part_{g['name']}"), "front,back", 600))


if __name__ == "__main__":
    main(sys.argv[1:])
