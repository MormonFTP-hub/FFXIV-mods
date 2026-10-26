"""Round-trip check: read the built .mdl files back and render them with the built (decoded) atlas,
next to the vanilla face 1 rendered the same way (proves the UV convention). Also renders the models
posed through their own skin weights (check_fit.test_pose)."""
import os
import pickle
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402
import rig  # noqa: E402
import xivdata as xd  # noqa: E402
from check_fit import test_pose  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
PNG = os.path.join(B, "texprev")
MODELS = ("top", "glv", "dwn", "sho", "fac", "hir")


def tex_png(src, name):
    os.makedirs(PNG, exist_ok=True)
    dst = os.path.join(PNG, name + ".png")
    Image.fromarray(xd.texture(src)).save(dst)
    return dst


def mdl_groups(path, tag, texture, offset=(0, 0, 0), deltas=None):
    gs = []
    for i, me in enumerate(xd.model(path)["meshes"]):
        pos = me["pos"]
        if deltas is not None:
            pos, _ = rig.skin(pos, me["bones"], me["weights"], deltas)
        gs.append(dict(name=f"{tag}_{i}", pos=pos + np.array(offset), faces=me["faces"],
                       uv=np.c_[me["uv"][:, 0], 1 - me["uv"][:, 1]], texture=texture))
    return gs


if __name__ == "__main__":
    tex_index = pickle.load(open(os.path.join(B, "tex", "index.pkl"), "rb"))
    atlas = tex_png(tex_index["jak_base"][0], "jak_base")
    gs = []
    for model in MODELS:
        gs += mdl_groups(os.path.join(B, "mdl", f"{model}.mdl"), model, atlas)
    for model in ("fac", "hir"):
        gs += mdl_groups(os.path.join(B, "mdl", f"{model}.mdl"), model + "2", atlas, offset=(0.7, 0, 0))
    vface = xd.material("chara/human/c0101/obj/face/f0001/material/mt_c0101f0001_fac_a.mtrl")
    vtex = tex_png(xd.extract(vface["textures"][0])[0], "vanilla_face_base")
    vm = xd.model("chara/human/c0101/obj/face/f0001/model/c0101f0001_fac.mdl")["meshes"][0]
    gs.append(dict(name="vanilla_face", pos=vm["pos"] + np.array([-0.7, 0, 0]), faces=vm["faces"],
                   uv=np.c_[vm["uv"][:, 0], 1 - vm["uv"][:, 1]], texture=vtex))
    scene = os.path.join(ROOT, "work", "mdl_roundtrip.obj")
    preview.write_obj(scene, gs)
    print(preview.render(scene, os.path.join(ROOT, "work", "preview", "mdl_roundtrip"), "front,back", 900))
    print(preview.render(scene, os.path.join(ROOT, "work", "preview", "mdl_heads"), "front,side", 700,
                         region=((-0.95, 1.45, -0.3), (0.95, 1.9, 0.3))))
    pose = test_pose()
    gs = []
    for model in MODELS:
        gs += mdl_groups(os.path.join(B, "mdl", f"{model}.mdl"), model, atlas, deltas=pose)
    scene = os.path.join(ROOT, "work", "mdl_pose.obj")
    preview.write_obj(scene, gs)
    print(preview.render(scene, os.path.join(ROOT, "work", "preview", "mdl_pose"), "front,three", 800))
