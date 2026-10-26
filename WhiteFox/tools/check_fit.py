"""Render the fit: bind pose over the FFXIV body, the head over the FFXIV face, and test poses through the new skin
weights (work/preview/fit_<race>_*.png). Other female races are shown through the game's racial deformer.

python -P -E tools/check_fit.py [race] [deform race ...]
"""
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pbd  # noqa: E402
import preview  # noqa: E402
import rig  # noqa: E402
import srcdata as sd  # noqa: E402
import xivdata as xd  # noqa: E402

ROOT = rig.ROOT
OUT = os.path.join(ROOT, "work", "preview")
SLOT_COLOR = {"met": (0.9, 0.3, 0.3), "top": (0.3, 0.5, 0.95), "glv": (0.95, 0.85, 0.2), "dwn": (0.3, 0.8, 0.4),
              "sho": (0.7, 0.4, 0.9), None: (0.6, 0.6, 0.6)}


def body_paths(race):
    if race == "c0101":
        return [f"chara/human/{race}/obj/body/b0001/model/{race}b0001_{s}.mdl" for s in ("top", "glv", "dwn", "sho")]
    return [f"chara/equipment/e0000/model/{race}e0000_{s}.mdl" for s in ("top", "glv", "dwn", "sho")]


def posed(race, rot):
    """Deltas for a pose given as {bone: 3x3 local rotation about the bone's own joint}, parents first."""
    names, parent, world = rig.load_skeleton(f"skeleton_{race}")
    P = rig.Pose(names, parent, world)
    out = {}
    for b in names:
        p = parent[b]
        Dp = out[p] if p is not None else np.eye(4)
        out[b] = Dp @ rig.rot_about(rot[b], P.pos(b)) if b in rot else Dp
    return out


def R(axis, deg):
    return rig.axis_angle(axis, np.radians(deg))


def idle_pose(race):
    return posed(race, {"j_ude_a_l": R([0, 0, 1], -35), "j_ude_a_r": R([0, 0, 1], 35),
                        "j_ude_b_l": R([1, 0, 0], -15), "j_ude_b_r": R([1, 0, 0], -15),
                        "j_kao": R([1, 0, 0], 10)})


def run_pose(race):
    return posed(race, {"j_ude_a_l": R([1, 0, 0], -40) @ R([0, 0, 1], -30), "j_ude_a_r": R([1, 0, 0], 40) @ R([0, 0, 1], 30),
                        "j_ude_b_l": R([1, 0, 0], -70), "j_ude_b_r": R([1, 0, 0], -70),
                        "n_hte_l": R([0, 1, 0], 30), "n_hte_r": R([0, 1, 0], -30),
                        "j_asi_a_l": R([1, 0, 0], -50), "j_asi_c_l": R([1, 0, 0], 70), "j_asi_d_l": R([1, 0, 0], 20),
                        "j_asi_a_r": R([1, 0, 0], 25), "j_asi_c_r": R([1, 0, 0], 40), "j_asi_d_r": R([1, 0, 0], -25),
                        "j_sk_f_a_l": R([1, 0, 0], -35), "j_sk_f_a_r": R([1, 0, 0], -20),
                        "j_sk_s_a_l": R([0, 0, 1], -10), "j_sk_b_a_l": R([1, 0, 0], 15), "j_sk_b_a_r": R([1, 0, 0], 15),
                        "j_sebo_b": R([1, 0, 0], 12), "j_kao": R([0, 1, 0], 25),
                        "j_naka_a_l": R([0, 0, 1], -60), "j_naka_b_l": R([0, 0, 1], -60),
                        "j_hito_a_l": R([0, 0, 1], -60), "j_hito_b_l": R([0, 0, 1], -60),
                        "j_kusu_a_l": R([0, 0, 1], -60), "j_kusu_b_l": R([0, 0, 1], -60),
                        "j_ko_a_l": R([0, 0, 1], -60), "j_ko_b_l": R([0, 0, 1], -60)})


def groups(fit, deltas=None, deform=None, parents=None, offset=(0, 0, 0), by_slot=False, only=None):
    gs = []
    for n, m in fit["parts"].items():
        if only and not any(n.startswith(o) for o in only):
            continue
        pos = m["pos"]
        if deltas is not None:
            pos, _ = rig.skin(pos, m["bones"], m["weights"], deltas)
        if deform is not None:
            pos = pbd.deform(pos, m["bones"], m["weights"], deform, parents)
        g = dict(name=n, pos=pos + np.array(offset), faces=m["faces"], uv=m["uv"])
        if by_slot:
            g["color"] = SLOT_COLOR[m.get("slot")]
        else:
            g["texture"] = os.path.join(sd.ALBEDO, f"set_{m['texset']}.png")
        gs.append(g)
    return gs


def ghost(paths, color=(0.9, 0.25, 0.15), alpha=0.25, deltas=None, offset=(0, 0, 0), only=None, deform=None, parents=None):
    gs = []
    for p in paths:
        for me in xd.model(p)["meshes"]:
            if only and not any(o in me["material"] for o in only):
                continue
            pos = me["pos"]
            if deltas is not None:
                pos, _ = rig.skin(pos, me["bones"], me["weights"], deltas)
            if deform is not None:
                pos = pbd.deform(pos, me["bones"], me["weights"], deform, parents)
            gs.append(dict(name=f"ff_{len(gs)}_{os.path.basename(p)[:5]}", pos=pos + np.array(offset), faces=me["faces"],
                           color=color, alpha=alpha))
    return gs


if __name__ == "__main__":
    race = sys.argv[1] if len(sys.argv) > 1 else "c0201"
    others = sys.argv[2:]
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit", f"{race}.pkl"), "rb"))
    face = f"chara/human/{race}/obj/face/f0001/model/{race}f0001_fac.mdl"
    tag = f"fit_{race}"
    jk = fit["joints"]["j_kao"]
    head_region = ((-0.2, jk[1] - 0.15, -0.2), (0.2, jk[1] + 0.2, 0.2))

    scene = os.path.join(ROOT, "work", f"{tag}_bind.obj")
    preview.write_obj(scene, groups(fit) + ghost(body_paths(race)) + ghost([face], alpha=0.35))
    print(preview.render(scene, os.path.join(OUT, f"{tag}_bind"), "front,side,back", 800))
    scene = os.path.join(ROOT, "work", f"{tag}_slots.obj")
    preview.write_obj(scene, groups(fit, by_slot=True))
    print(preview.render(scene, os.path.join(OUT, f"{tag}_slots"), "front,side,back", 700))
    scene = os.path.join(ROOT, "work", f"{tag}_face.obj")
    preview.write_obj(scene, groups(fit, only=("face", "eyes")) +
                      ghost([face], color=(0.2, 0.9, 0.3), alpha=1.0))
    print(preview.render(scene, os.path.join(OUT, f"{tag}_poke"), "front,side,three", 600, region=head_region))

    _, parents, _ = rig.load_skeleton(f"skeleton_{race}")
    for other in others:     # other races wear this race's models through the racial deformer
        d = pbd.chain(pbd.read(), int(race[1:]), int(other[1:]))
        oface = f"chara/human/{other}/obj/face/f0001/model/{other}f0001_fac.mdl"
        scene = os.path.join(ROOT, "work", f"{tag}_{other}.obj")
        preview.write_obj(scene, groups(fit, deform=d, parents=parents) + ghost([oface], color=(0.2, 0.9, 0.3), alpha=1.0))
        print(preview.render(scene, os.path.join(OUT, f"{tag}_as_{other}"), "front,side,three", 800))

    for name, pose in (("idle", idle_pose(race)), ("run", run_pose(race))):
        scene = os.path.join(ROOT, "work", f"{tag}_{name}.obj")
        preview.write_obj(scene, groups(fit, deltas=pose))
        print(preview.render(scene, os.path.join(OUT, f"{tag}_{name}"), "front,side,three", 800))
