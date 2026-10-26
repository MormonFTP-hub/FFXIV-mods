"""Round-trip check: read the built .mdl files back with Penumbra's reader and render them with the built
textures (decoded from the .tex files), Frostmourne beside the vanilla Deathbringer for scale and grip.
Writes work/preview/mdl_roundtrip_sheet.png and out/preview.png."""
import os
import pickle
import shutil
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402
import xivdata as xd  # noqa: E402
from preview_src import write_obj  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
PNG = os.path.join(B, "texprev")
ALPHA_MATERIALS = ("_a.mtrl", "_c.mtrl")  # lk_a (cape, hair) and the eye glow use opacity


def tex_png(src, name):
    os.makedirs(PNG, exist_ok=True)
    dst = os.path.join(PNG, name + ".png")
    Image.fromarray(xd.texture(src)).save(dst)
    return dst


def mdl_groups(path, tag, texture_for, offset=(0, 0, 0)):
    gs = []
    for i, me in enumerate(xd.model(path)["meshes"]):
        gs.append(dict(name=f"{tag}_{i}", pos=me["pos"] + np.array(offset), faces=me["faces"],
                       uv=np.c_[me["uv"][:, 0], 1 - me["uv"][:, 1]], texture=texture_for(me["material"]),
                       alpha_map=me["material"].endswith(ALPHA_MATERIALS) and tag != "wep"))
    return gs


if __name__ == "__main__":
    tex = pickle.load(open(os.path.join(B, "tex", "index.pkl"), "rb"))
    bases = {k[:-5]: tex_png(v[0], k) for k, v in tex.items() if k.endswith("_base")}

    def ours(material):
        if material.startswith("/mt_w"):
            return bases["fm"]
        return bases[{"a": "lk_a", "b": "lk_b", "c": "lk_mist"}[material[-6]]]

    gs = []
    for slot in ("met", "top", "glv", "dwn", "sho"):
        gs += mdl_groups(os.path.join(B, "mdl", f"{slot}.mdl"), slot, ours)
    gs += mdl_groups(os.path.join(B, "mdl", "wep.mdl"), "wep", ours, offset=(-0.9, 0.3, 0))
    van = "chara/weapon/w1501/obj/body/b0037/model/w1501b0037.mdl"
    vmat = xd.material("chara/weapon/w1501/obj/body/b0037/material/v0001/mt_w1501b0037_a.mtrl")
    vtex = tex_png(xd.extract(vmat["textures"][0])[0], "deathbringer_base")
    gs += mdl_groups(van, "van", lambda m: vtex, offset=(-1.5, 0.3, 0))
    scene = os.path.join(ROOT, "work", "mdl_roundtrip.obj")
    write_obj(scene, gs)
    sheet = preview.render(scene, os.path.join(ROOT, "work", "preview", "mdl_roundtrip"), "front,three,back", 1000)
    print(sheet)
    os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
    shutil.copy(sheet, os.path.join(ROOT, "out", "preview.png"))
