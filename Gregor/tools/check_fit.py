"""Render the fitted outfit: bind pose over the FFXIV body, the same deformed into the Viera male shape
(as the game does) with the Viera face, and an arms-down idle pose through the new skin weights.

python -P -E tools/check_fit.py [parts to leave out, comma separated]
"""
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pbd  # noqa: E402
import preview  # noqa: E402
import rig  # noqa: E402
import xivdata as xd  # noqa: E402

ROOT = rig.ROOT
OUT = os.path.join(ROOT, "work", "preview")
S, U = os.path.join(ROOT, "source"), os.path.join(ROOT, "source", "unity")
TEX = {"suit": os.path.join(U, "GregorMain_ACopy.png"), "aedd": os.path.join(S, "AEDD Greg Main Color.png"),
       "centi": os.path.join(U, "Tex_AEDD.png")}
COLOR = {"lens": (0.05, 0.06, 0.08), "skin": (0.85, 0.66, 0.55)}
BODY = [f"chara/human/c0101/obj/body/b0001/model/c0101b0001_{s}.mdl" for s in ("top", "glv", "dwn", "sho")]
FACE = "chara/human/c1701/obj/face/f0001/model/c1701f0001_fac.mdl"
DEFAULT_SET = ["suit", "suit_bits", "shoe_r", "coat", "bolts", "leg_armor", "glasses_frame", "glasses_lens", "halo",
               "centi_r", "skin_hand_l", "skin_neck"]


def idle_pose():
    names, parent, world = rig.load_skeleton()
    P = rig.Pose(names, parent, world)
    R = {"j_ude_a_l": rig.axis_angle([0, 0, 1], np.radians(-38)), "j_ude_a_r": rig.axis_angle([0, 0, 1], np.radians(38)),
         "j_ude_b_l": rig.axis_angle([1, 0, 0], np.radians(-12)), "j_ude_b_r": rig.axis_angle([1, 0, 0], np.radians(-12))}
    out = {}
    for b in names:
        p = parent[b]
        Dp = out[p] if p is not None else np.eye(4)
        out[b] = Dp @ rig.rot_about(R[b], P.pos(b)) if b in R else Dp
    return out


def walk_pose():
    names, parent, world = rig.load_skeleton()
    P = rig.Pose(names, parent, world)
    R = {"j_ude_a_l": rig.axis_angle([1, 0, 0], np.radians(-25)) @ rig.axis_angle([0, 0, 1], np.radians(-35)),
         "j_ude_a_r": rig.axis_angle([1, 0, 0], np.radians(30)) @ rig.axis_angle([0, 0, 1], np.radians(35)),
         "j_ude_b_r": rig.axis_angle([1, 0, 0], np.radians(-30)),
         "j_asi_a_l": rig.axis_angle([1, 0, 0], np.radians(-30)), "j_asi_c_l": rig.axis_angle([1, 0, 0], np.radians(35)),
         "j_asi_a_r": rig.axis_angle([1, 0, 0], np.radians(20)),
         "j_sk_f_a_l": rig.axis_angle([1, 0, 0], np.radians(-20)), "j_sk_s_a_l": rig.axis_angle([1, 0, 0], np.radians(-10))}
    out = {}
    for b in names:
        p = parent[b]
        Dp = out[p] if p is not None else np.eye(4)
        out[b] = Dp @ rig.rot_about(R[b], P.pos(b)) if b in R else Dp
    return out


def groups(parts, names, deform=None, deltas=None):
    gs = []
    for n in names:
        m = parts[n]
        pos = m["pos"]
        if deltas is not None:
            pos, _ = rig.skin(pos, m["bones"], m["weights"], deltas)
        if deform is not None:
            pos = pbd.deform(pos, m["bones"], m["weights"], deform, PARENTS)
        g = dict(name=n, pos=pos, faces=m["faces"])
        if m["texset"] in TEX:
            g.update(uv=m["uv"], texture=TEX[m["texset"]])
        else:
            g.update(color=COLOR[m["texset"]])
        gs.append(g)
    return gs


def ghost_body(deform=None, deltas=None, face=False):
    gs = []
    for p in BODY:
        for me in xd.model(p)["meshes"]:
            pos = me["pos"]
            if deltas is not None:
                pos, _ = rig.skin(pos, me["bones"], me["weights"], deltas)
            if deform is not None:
                pos = pbd.deform(pos, me["bones"], me["weights"], deform, PARENTS)
            gs.append(dict(name=f"ff_{len(gs)}", pos=pos, faces=me["faces"], color=(0.9, 0.25, 0.15), alpha=0.25))
    if face:
        for me in xd.model(FACE)["meshes"]:
            if "_fac_" in me["material"] or "_iri_" in me["material"]:
                gs.append(dict(name=f"face_{len(gs)}", pos=me["pos"], faces=me["faces"], color=(0.85, 0.66, 0.55)))
    return gs


_, PARENTS, _ = rig.load_skeleton()

if __name__ == "__main__":
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit", "fitted.pkl"), "rb"))
    parts = fit["parts"]
    skip = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else set()
    show = [n for n in DEFAULT_SET if n not in skip]
    viera = pbd.chain(pbd.read(), 101, 1701)

    scene = os.path.join(ROOT, "work", "fit_bind.obj")
    preview.write_obj(scene, groups(parts, show) + ghost_body())
    print(preview.render(scene, os.path.join(OUT, "fit_bind"), "front,side,back", 800))

    scene = os.path.join(ROOT, "work", "fit_viera.obj")
    preview.write_obj(scene, groups(parts, show, deform=viera) + ghost_body(face=True)[-2:])
    print(preview.render(scene, os.path.join(OUT, "fit_viera"), "front,side,back,three", 800))
    print(preview.render(scene, os.path.join(OUT, "fit_viera_head"), "front,side,three", 700,
                         region=((-0.25, 1.35, -0.2), (0.25, 1.95, 0.2))))

    for name, pose in (("idle", idle_pose()), ("walk", walk_pose())):
        scene = os.path.join(ROOT, "work", f"fit_{name}.obj")
        preview.write_obj(scene, groups(parts, show, deltas=pose))
        print(preview.render(scene, os.path.join(OUT, f"fit_{name}"), "front,side,three", 800))
