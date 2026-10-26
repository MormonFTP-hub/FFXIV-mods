"""Pose the FFXIV naked c0101 body into Griffith's T-pose and render the two overlaid."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402
import rig  # noqa: E402
import xivdata as xd  # noqa: E402
from objload import load_obj  # noqa: E402

ROOT = rig.ROOT
OUT = os.path.join(ROOT, "work", "preview")
BODY = [f"chara/human/c0101/obj/body/b0001/model/c0101b0001_{s}.mdl" for s in ("top", "glv", "dwn", "sho")]
FACE = "chara/human/c0101/obj/face/f0001/model/c0101f0001_fac.mdl"


def hand_frames(src):
    """Griffith's hand frames from the glove mesh: (finger direction, across palm to index, palm normal)."""
    hands = src["model_1_submesh_2"]["pos"]
    out = {}
    for s, sx in (("l", 1), ("r", -1)):
        h = hands[(hands[:, 0] * sx) > 0.70]
        c = h - h.mean(0)
        _, _, vt = np.linalg.svd(c, full_matrices=False)
        n = vt[2]                                # flattest axis: the palm normal
        x = h[:, 0] * sx
        tips = h[x > np.percentile(x, 92)].mean(0)
        wrist = h[x < np.percentile(x, 8)].mean(0)
        u = tips - wrist
        u -= n * np.dot(u, n)                    # towards the fingertips, in the palm plane
        across = np.cross(n, u)
        across *= np.sign(across[2])             # index finger / thumb side is the front (+z)
        out[s] = rig.frame(u, across)
        print(f"hand {s}: centre {np.round(h.mean(0), 3)} fingers {np.round(u, 3)} across {np.round(out[s][:, 1], 3)} normal {np.round(out[s][:, 2], 3)}")
    return out


def body_meshes(deltas, with_face=True):
    out = []
    for p in BODY + ([FACE] if with_face else []):
        for me in xd.model(p)["meshes"]:
            bones = np.array([[("j_kao" if b.startswith("j_f_") else b) for b in row] for row in me["bones"]], object)
            posed, _ = rig.skin(me["pos"], bones, me["weights"], deltas)
            out.append((p.split("_")[-1][:3] + "_" + me["material"].split("_")[-1][:5], posed, me["faces"]))
    return out


if __name__ == "__main__":
    src = load_obj(os.path.join(ROOT, "source", "Griffith.obj"))
    names, parent, world = rig.load_skeleton()
    hf = hand_frames(src)
    P, D = rig.tpose(names, parent, world, hf)
    for b in ("j_ude_b_l", "j_te_l", "j_naka_a_l", "j_naka_b_l", "j_oya_b_l", "j_ko_b_l"):
        print(b, "posed", np.round(P.posed(b, D), 3))
    groups = []
    for i, (n, pos, faces) in enumerate(body_meshes(D)):
        groups.append(dict(name=f"ff_{i}_{n}", pos=pos, faces=faces, color=(0.85, 0.2, 0.15)))
    for n, m in src.items():
        if n.startswith("driver") or n in ("model_1_submesh_0", "model_1_submesh_6"):
            continue
        groups.append(dict(name=n, pos=m["pos"], faces=m["faces"], color=(0.7, 0.75, 0.8), alpha=0.35))
    scene = os.path.join(ROOT, "work", "tpose_overlay.obj")
    preview.write_obj(scene, groups)
    print(preview.render(scene, os.path.join(OUT, "tpose"), "front,side", 900))
    print(preview.render(scene, os.path.join(OUT, "tpose_hand"), "front,side", 700,
                         region=((0.55, 1.30, -0.2), (0.95, 1.60, 0.1))))
    print(preview.render(scene, os.path.join(OUT, "tpose_head"), "front,side", 700,
                         region=((-0.2, 1.40, -0.2), (0.2, 1.85, 0.2))))
