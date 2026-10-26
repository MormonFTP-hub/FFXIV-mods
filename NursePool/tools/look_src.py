"""Render the unpacked source (work/src) textured, bind pose: work/preview/src_sheet.png"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402

ROOT = preview.ROOT
SRC = os.path.join(ROOT, "work", "src")
SKIP = {"MI_1057801_Rim_HeroDetails", "MI_1057801_Glass"}

if __name__ == "__main__":
    sc = json.load(open(os.path.join(SRC, "scene.json")))
    meshes = sys.argv[2:] or ["SK_1057_1057801_Lobby"]
    groups = []
    for name in meshes:
        z = np.load(os.path.join(SRC, f"mesh_{name}.npz"))
        for mi in np.unique(z["mat"]):
            mat = sc["materials"][mi]
            if mat["name"] in SKIP:
                continue
            f = z["faces"][z["mat"] == mi]
            used, remap = np.unique(f, return_inverse=True)
            tex = mat["textures"].get("pbrMetallicRoughness.baseColorTexture")
            groups.append(dict(name=f"{name}_{mi}", pos=z["pos"][used], faces=remap.reshape(-1, 3),
                               uv=np.c_[z["uv0"][used, 0], 1 - z["uv0"][used, 1]],
                               texture=os.path.join(SRC, "tex", tex) if tex else None))
    os.makedirs(os.path.join(ROOT, "work", "preview"), exist_ok=True)
    obj = os.path.join(ROOT, "work", "preview", "src.obj")
    preview.write_obj(obj, groups)
    views = sys.argv[1] if len(sys.argv) > 1 else "front,side,back"
    print(preview.render(obj, os.path.join(ROOT, "work", "preview", "src"), views, 1000))
