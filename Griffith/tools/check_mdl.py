"""Round-trip check: read the built .mdl files back and render them with the built .tex textures,
next to a vanilla face rendered the same way (proves the UV convention)."""
import os
import pickle
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402
import xivdata as xd  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
PNG = os.path.join(B, "texprev")
TEXSET = {"_top_a": "armor", "_glv_a": "armor", "_dwn_a": "armor", "_sho_a": "armor", "_met_a": "armor",
          "_top_b": "cape", "_met_b": "hair", "_hir_a": "hair", "_etc_a": "hair", "_fac_a": "face"}


def tex_png(src, name):
    os.makedirs(PNG, exist_ok=True)
    dst = os.path.join(PNG, name + ".png")
    Image.fromarray(xd.texture(src)).save(dst)
    return dst


def mdl_groups(path, tag, offset=(0, 0, 0), texture_for=None):
    gs = []
    for i, me in enumerate(xd.model(path)["meshes"]):
        tex = texture_for(me["material"]) if texture_for else None
        gs.append(dict(name=f"{tag}_{i}", pos=me["pos"] + np.array(offset), faces=me["faces"],
                       uv=np.c_[me["uv"][:, 0], 1 - me["uv"][:, 1]], texture=tex))
    return gs


if __name__ == "__main__":
    tex_index = pickle.load(open(os.path.join(B, "tex", "index.pkl"), "rb"))
    bases = {k[:-5]: tex_png(v[0], k) for k, v in tex_index.items() if k.endswith("_base")}

    def ours(material):
        return next(bases[ts] for suf, ts in TEXSET.items() if material.endswith(suf + ".mtrl"))

    gs = []
    for model in ("top", "glv", "dwn", "sho", "fac", "hir"):
        gs += mdl_groups(os.path.join(B, "mdl", f"{model}.mdl"), model, texture_for=ours)
    gs += mdl_groups(os.path.join(B, "mdl", "met.mdl"), "met", offset=(0.7, 0, 0), texture_for=ours)
    gs += mdl_groups(os.path.join(B, "mdl", "fac.mdl"), "fac2", offset=(0.7, 0, 0), texture_for=ours)
    gs += mdl_groups(os.path.join(B, "mdl", "top.mdl"), "top2", offset=(0.7, 0, 0), texture_for=ours)
    # vanilla face with its own diffuse, mapped exactly like ours
    vface = xd.material("chara/human/c0101/obj/face/f0001/material/mt_c0101f0001_fac_a.mtrl")
    vtex = tex_png(xd.extract(vface["textures"][0])[0], "vanilla_face_base")
    vm = xd.model("chara/human/c0101/obj/face/f0001/model/c0101f0001_fac.mdl")["meshes"][0]
    gs.append(dict(name="vanilla_face", pos=vm["pos"] + np.array([-0.5, 0, 0]), faces=vm["faces"],
                   uv=np.c_[vm["uv"][:, 0], 1 - vm["uv"][:, 1]], texture=vtex))
    scene = os.path.join(ROOT, "work", "mdl_roundtrip.obj")
    preview.write_obj(scene, gs)
    print(preview.render(scene, os.path.join(ROOT, "work", "preview", "mdl_roundtrip"), "front,back", 900))
    print(preview.render(scene, os.path.join(ROOT, "work", "preview", "mdl_heads"), "front,side", 700,
                         region=((-0.65, 1.45, -0.3), (0.85, 1.85, 0.3))))
