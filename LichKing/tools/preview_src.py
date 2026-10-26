"""Render the extracted source meshes (work/src/src.pkl) with their WoW textures: front / side / back sheets
in work/preview/. Usage: preview_src.py [lichking|frostmourne|both]"""
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402

ROOT = preview.ROOT
OUT = os.path.join(ROOT, "work", "preview")
T01, T02 = "lichking/arthaslichking_01.png", "lichking/arthaslichking_02.png"
BEAM, SWORD = "lichking/beam_smokegrey.png", "lichking/sword_2h_frostmourne_arthas2.png"
TEXTURE = {"helm": T01, "shoulders": T01, "shoulders2": T01, "cape": T01, "cape1": T01, "cloth": T01, "head": T01,
           "hair": T01, "metal": T02, "leather": T02, "fur": T02, "aiStandardSurface51SG": T02, "eyes_glow": BEAM}
ALPHA = {"cape", "cape1", "fur", "hair", "eyes_glow"}


def groups_of(m, tag, offset=(0, 0, 0), texture=None, skip=()):
    out = []
    for mat in np.unique(m["material"]):
        if mat in skip:
            continue
        sel = m["material"] == mat
        f = m["faces"][sel]
        out.append(dict(name=f"{tag}_{mat}", pos=m["pos"][f.ravel()] + np.array(offset),
                        faces=np.arange(3 * len(f)).reshape(-1, 3), uv=m["uv"][sel].reshape(-1, 2),
                        texture=texture or TEXTURE.get(mat), alpha_map=mat in ALPHA))
    return out


def write_obj(path, groups):
    """preview.write_obj plus map_d (texture alpha) for alpha-tested groups."""
    preview.write_obj(path, groups)
    mtl = os.path.splitext(path)[0] + ".mtl"
    lines = open(mtl).read().splitlines()
    out = []
    for line in lines:
        out.append(line)
        if line.startswith("map_Kd"):
            name = cur
            if any(g["name"] + "_mat" == name and g.get("alpha_map") for g in groups):
                out.append("map_d " + line.split(" ", 1)[1])
        if line.startswith("newmtl"):
            cur = line.split()[1]
    open(mtl, "w").write("\n".join(out) + "\n")


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "both"
    src = pickle.load(open(os.path.join(ROOT, "work", "src", "src.pkl"), "rb"))
    os.makedirs(OUT, exist_ok=True)
    gs = []
    if which in ("lichking", "both"):
        gs += groups_of(src["lichking"], "lk")
    if which in ("frostmourne", "both"):
        gs += groups_of(src["frostmourne"], "fm", offset=(0.0, 0, 0.6) if which == "both" else (0, 0, 0),
                        texture=SWORD)
    scene = os.path.join(ROOT, "work", f"src_{which}.obj")
    write_obj(scene, gs)
    print(preview.render(scene, os.path.join(OUT, f"src_{which}"), "front,side,back", 900))
