"""Round-trip check: read the built .mdl files back and render them with the built .tex colour maps, as a Viera male
(through human.pbd, like the game) in the bind pose and an arms-down idle pose, plus every arm option side by side."""
import os
import pickle
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pbd  # noqa: E402
import preview  # noqa: E402
import rig  # noqa: E402
import xivdata as xd  # noqa: E402
from check_fit import FACE, idle_pose  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
PNG = os.path.join(B, "texprev")
TEXSET = {"_top_a": "aedd", "_top_b": "suit", "_glv_a": "centi", "_dwn_a": "suit", "_sho_a": "suit", "_sho_b": "aedd",
          "_met_a": "suit", "_met_c": "aedd"}
SKIN = (0.85, 0.66, 0.55)
_, PARENTS, _ = rig.load_skeleton()


def tex_png(src, name):
    os.makedirs(PNG, exist_ok=True)
    dst = os.path.join(PNG, name + ".png")
    Image.fromarray(xd.texture(src)).save(dst)
    return dst


def mdl_groups(path, tag, bases, offset=(0, 0, 0), deltas=None, deform=None):
    gs = []
    for i, me in enumerate(xd.model(path)["meshes"]):
        pos = me["pos"]
        if deltas is not None:
            pos, _ = rig.skin(pos, me["bones"], me["weights"], deltas)
        if deform is not None:
            pos = pbd.deform(pos, me["bones"], me["weights"], deform, PARENTS)
        g = dict(name=f"{tag}_{i}", pos=pos + np.array(offset), faces=me["faces"])
        ts = next((t for suf, t in TEXSET.items() if me["material"].endswith(suf + ".mtrl")), None)
        if ts:
            g.update(uv=np.c_[me["uv"][:, 0], 1 - me["uv"][:, 1]], texture=bases[ts])
        else:
            g.update(color=SKIN if "b0001" in me["material"] else (0.05, 0.06, 0.08))
        gs.append(g)
    return gs


def face(offset=(0, 0, 0)):
    out = []
    for i, me in enumerate(xd.model(FACE)["meshes"]):
        if "_fac_" in me["material"] or "_iri_" in me["material"]:
            out.append(dict(name=f"vface_{i}", pos=me["pos"] + np.array(offset), faces=me["faces"],
                            color=SKIN if "_fac_" in me["material"] else (0.2, 0.3, 0.2)))
    return out


if __name__ == "__main__":
    tex_index = pickle.load(open(os.path.join(B, "tex", "index.pkl"), "rb"))
    bases = {k[:-5]: tex_png(v[0], k) for k, v in tex_index.items() if k.endswith("_base")}
    viera = pbd.chain(pbd.read(), 101, 1701)
    M = lambda n: os.path.join(B, "mdl", f"{n}.mdl")  # noqa: E731
    default = ["top", "glv_right", "dwn", "sho", "met_both"]

    gs = []
    for n in default:
        gs += mdl_groups(M(n), n, bases, deform=viera)
    gs += face()
    scene = os.path.join(ROOT, "work", "mdl_viera.obj")
    preview.write_obj(scene, gs)
    print(preview.render(scene, os.path.join(ROOT, "work", "preview", "mdl_viera"), "front,side,back,three", 900))

    gs = []
    for n in default:
        gs += mdl_groups(M(n), n, bases, deltas=idle_pose(), deform=viera)
    scene = os.path.join(ROOT, "work", "mdl_idle.obj")
    preview.write_obj(scene, gs)
    print(preview.render(scene, os.path.join(ROOT, "work", "preview", "mdl_idle"), "front,three", 900))

    gs = []
    for k, (top, glv) in enumerate((("top", "glv_right"), ("top_rolled", "glv_both"), ("top_rolled", "glv_left"),
                                     ("top", "glv_human"))):
        off = (1.6 * k, 0, 0)
        for n in (top, glv, "dwn", "sho"):
            gs += mdl_groups(M(n), f"{n}{k}", bases, offset=off, deltas=idle_pose())
    scene = os.path.join(ROOT, "work", "mdl_arms.obj")
    preview.write_obj(scene, gs)
    print(preview.render(scene, os.path.join(ROOT, "work", "preview", "mdl_arms"), "front", 1400))
