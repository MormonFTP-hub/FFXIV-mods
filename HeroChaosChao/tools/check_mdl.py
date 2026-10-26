"""Render the built .mdl as the game would show each mammet variant, with the built textures: work/preview/mdl_*.png.

Variant 1 (Mammet #001) and variant 2 (a GC mammet) side by side: a submesh shows when all its
attributes are enabled by the variant's IMC attribute mask (atr_bv_a = bit 0, atr_bv_b = bit 1).

python -P tools/check_mdl.py [bind|wave|walk|look] [views] [variants, e.g. 1,2]
"""
import json
import os
import sys

import numpy as np
from PIL import Image

import build
import xivdata as xd
from check_fit import POSES
from preview import write_static_gltf
from render import OUT, render
from skinning import deform, pose_matrices
from xiv_skeleton import Skeleton

# variant -> IMC attribute mask with the mod's default option ("Mammet #001 only")
VARIANTS = {1: 0x3FE, 2: 0x3FD}
GAP = 0.5


def visible(attrs, mask):
    bits = [ord(a[-1]) - ord("a") for a in attrs if a.startswith("atr_bv_")]
    return all(mask >> b & 1 for b in bits)


def texture_png(game_path, files):
    png = OUT / ("tex_" + os.path.basename(game_path).replace(".tex", ".png"))
    src = files.get(game_path) or game_path
    Image.fromarray(xd.texture(src)).save(png)
    return str(png)


def main(pose="bind", views="front,persp", variants="1,2"):
    files = json.load(open(os.path.join(build.B, "index.json")))
    skel = Skeleton(build.fit.SKEL)
    mdl = xd.model(files[build.MDL_PATH])
    D = pose_matrices(skel, POSES[pose]) if pose != "bind" else np.tile(np.eye(4), (len(skel.names), 1, 1))
    out = []
    for k, variant in enumerate(int(v) for v in variants.split(",")):
        mask = VARIANTS[variant]
        for i, m in enumerate(mdl["meshes"]):
            mat = m["material"].lstrip("/")
            mat_path = f"{build.BODY}/material/v{variant:04d}/{mat}"
            diffuse = xd.material(files.get(mat_path) or mat_path)["textures"][0]
            joints = np.array([[skel.index[b] if b else 0 for b in row] for row in m["bones"]])
            p, n = deform(m["pos"], m["nrm"], joints, m["weights"], D)
            for si, attrs in enumerate(m["sub_attrs"]):
                if not visible(attrs, mask):
                    continue
                tri = m["faces"][m["tri_sub"] == si].reshape(-1)
                out.append({"name": f"v{variant}_{i}_{si}", "positions": p[tri] + [k * GAP, 0, 0], "normals": n[tri],
                            "uvs": m["uv"][tri], "indices": np.arange(len(tri)), "texture": texture_png(diffuse, files)})
                print(f"variant {variant}: mesh {i}.{si} {mat} {attrs} -> {os.path.basename(diffuse)}")
    name = f"mdl_{pose}_v{variants.replace(',', '')}"
    write_static_gltf(OUT / f"{name}.gltf", out)
    render(OUT / f"{name}.gltf", OUT / name, views)
    print("rendered", OUT / f"{name}_*.png")


if __name__ == "__main__":
    main(*sys.argv[1:])
