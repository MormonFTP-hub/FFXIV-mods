"""Render the fit: bind pose over the FFXIV naked body, the head over the FFXIV face, and test poses
through the new skin weights (work/preview/fit_<race>_*.png).

python -P -E tools/check_fit.py [race] [variant] [mouth side]
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
IMG = os.path.join(ROOT, "source", "Sonic Forces", "Sonic", "images")
TEX = {("sonic", "body"): "chr_sonic_body_abd.png", ("sonic", "eye"): "chr_sonic_eye_abd_noalpha.png",
       ("super", "body"): "chr_supersonic_body_abd.png", ("super", "eye"): "chr_supersonic_eye_abd_noalpha.png"}


def body_paths(race):
    if race != "c0101":   # only c0101 has a b0001 body; the others' bare body is the e0000 smallclothes set
        return [f"chara/equipment/e0000/model/{race}e0000_{s}.mdl" for s in ("top", "glv", "dwn", "sho")]
    return [f"chara/human/{race}/obj/body/b0001/model/{race}b0001_{s}.mdl" for s in ("top", "glv", "dwn", "sho")]


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
                        "j_asi_a_l": R([1, 0, 0], -50), "j_asi_c_l": R([1, 0, 0], 70), "j_asi_d_l": R([1, 0, 0], 20),
                        "j_asi_a_r": R([1, 0, 0], 25), "j_asi_c_r": R([1, 0, 0], 40), "j_asi_d_r": R([1, 0, 0], -25),
                        "j_sebo_b": R([1, 0, 0], 12), "j_kao": R([0, 1, 0], 25),
                        "j_naka_a_l": R([0, 0, 1], -60), "j_naka_b_l": R([0, 0, 1], -60),
                        "j_hito_a_l": R([0, 0, 1], -60), "j_hito_b_l": R([0, 0, 1], -60),
                        "j_kusu_a_l": R([0, 0, 1], -60), "j_kusu_b_l": R([0, 0, 1], -60),
                        "j_ko_a_l": R([0, 0, 1], -60), "j_ko_b_l": R([0, 0, 1], -60)})


def groups(fit, variant, mouth, deltas=None, deform=None, parents=None, offset=(0, 0, 0)):
    gs = []
    for n, m in fit[variant].items():
        if n.startswith("mouth") and not n.startswith(f"mouth_{mouth}"):
            continue
        pos = m["pos"]
        if deltas is not None:
            pos, _ = rig.skin(pos, m["bones"], m["weights"], deltas)
        if deform is not None:
            pos = pbd.deform(pos, m["bones"], m["weights"], deform, parents)
        gs.append(dict(name=f"{variant}_{n}", pos=pos + np.array(offset), faces=m["faces"], uv=m["uv"],
                       texture=os.path.join(IMG, TEX[(variant, m["texset"])])))
    return gs


def ghost(paths, color=(0.9, 0.25, 0.15), alpha=0.25, deltas=None, offset=(0, 0, 0), only=None):
    gs = []
    for p in paths:
        for me in xd.model(p)["meshes"]:
            if only and not any(o in me["material"] for o in only):
                continue
            pos = me["pos"]
            if deltas is not None:
                pos, _ = rig.skin(pos, me["bones"], me["weights"], deltas)
            gs.append(dict(name=f"ff_{len(gs)}_{os.path.basename(p)[:5]}", pos=pos + np.array(offset), faces=me["faces"],
                           color=color, alpha=alpha))
    return gs


if __name__ == "__main__":
    race = sys.argv[1] if len(sys.argv) > 1 else "c0101"
    variant = sys.argv[2] if len(sys.argv) > 2 else "sonic"
    mouth = sys.argv[3] if len(sys.argv) > 3 else "r"
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit", f"{race}.pkl"), "rb"))
    face = f"chara/human/{race}/obj/face/f0001/model/{race}f0001_fac.mdl"
    tag = f"fit_{race}_{variant}"

    scene = os.path.join(ROOT, "work", f"{tag}_bind.obj")
    preview.write_obj(scene, groups(fit, variant, mouth) + ghost(body_paths(race)) + ghost([face], alpha=0.35))
    print(preview.render(scene, os.path.join(OUT, f"{tag}_bind"), "front,side,back", 800))
    top = max(m["pos"][:, 1].max() for m in fit[variant].values())
    jk = fit["joints"]["j_kao"]
    print(preview.render(scene, os.path.join(OUT, f"{tag}_head"), "front,side,three", 700,
                         region=((-0.35, jk[1] - 0.3, -0.35), (0.35, top + 0.02, 0.35))))
    scene = os.path.join(ROOT, "work", f"{tag}_face.obj")
    preview.write_obj(scene, groups(fit, variant, mouth) + ghost([face], color=(0.85, 0.66, 0.55), alpha=1.0))
    print(preview.render(scene, os.path.join(OUT, f"{tag}_poke"), "front,side,three", 600,
                         region=((-0.35, jk[1] - 0.3, -0.35), (0.35, top + 0.02, 0.35))))

    if race == "c0101":   # Viera male: the game reshapes c0101 gear with human.pbd
        viera = pbd.chain(pbd.read(), 101, 1701)
        _, parents, _ = rig.load_skeleton("skeleton_c0101")
        vface = "chara/human/c1701/obj/face/f0001/model/c1701f0001_fac.mdl"
        scene = os.path.join(ROOT, "work", f"{tag}_viera.obj")
        preview.write_obj(scene, groups(fit, variant, mouth, deform=viera, parents=parents)
                          + ghost([vface], color=(0.85, 0.66, 0.55), alpha=1.0))
        print(preview.render(scene, os.path.join(OUT, f"{tag}_viera"), "front,side,three", 800))

    for name, pose in (("idle", idle_pose(race)), ("run", run_pose(race))):
        scene = os.path.join(ROOT, "work", f"{tag}_{name}.obj")
        preview.write_obj(scene, groups(fit, variant, mouth, deltas=pose))
        print(preview.render(scene, os.path.join(OUT, f"{tag}_{name}"), "front,side,three", 800))
