"""Skin the converted .mdl files (work/mdl/*.json from `xivtool mdlexport`) to a test pose on the
FFXIV skeleton and render it, to catch badly weighted vertices.

usage: python preview_pose.py <out.png>
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render  # noqa: E402
from xivskel import Skeleton  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX = os.path.join(ROOT, "source", "Jotaro Kujo (Part 4)", "Textures")

# bone -> (axis in world space, degrees): a walking/waving test pose
POSE = {"j_ude_a_l": ([0, 0, 1], -35), "j_ude_b_l": ([0, 1, 0], 60), "j_ude_a_r": ([1, 0, 0], -70),
        "j_asi_a_r": ([1, 0, 0], -50), "j_asi_b_r": ([1, 0, 0], 60), "j_asi_a_l": ([1, 0, 0], 20),
        "j_sk_f_a_r": ([1, 0, 0], -35), "j_sk_s_a_r": ([1, 0, 0], -20), "j_kao": ([0, 1, 0], 35),
        "j_sebo_b": ([0, 1, 0], 15)}


def axis_angle(axis, ang):
    axis = np.asarray(axis, float) / np.linalg.norm(axis)
    x, y, z = axis
    c, s, t = math.cos(ang), math.sin(ang), 1 - math.cos(ang)
    return np.array([[t * x * x + c, t * x * y - s * z, t * x * z + s * y],
                     [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
                     [t * x * z - s * y, t * y * z + s * x, t * z * z + c]])


def skinning_matrices(sk):
    """World-space deltas (posed world @ inverse bind) for every bone, applying POSE parents first."""
    delta = {}
    for i, name in enumerate(sk.names):
        p = sk.parents[i]
        parent = delta[sk.names[p]] if p >= 0 else np.eye(4)
        d = parent.copy()
        if name in POSE:
            axis, deg = POSE[name]
            j = sk.world[i][:3, 3]
            r = np.eye(4)
            r[:3, :3] = axis_angle(axis, math.radians(deg))
            jp = (parent @ np.append(j, 1))[:3]  # joint position after the parent's motion
            t1, t2 = np.eye(4), np.eye(4)
            t1[:3, 3], t2[:3, 3] = -jp, jp
            d = t2 @ r @ t1 @ parent
        delta[name] = d
    return delta


def main():
    sk = Skeleton()
    delta = skinning_matrices(sk)
    body = np.array(Image.open(os.path.join(TEX, "t_4jtr01_body01_d.png")).convert("RGBA"))
    iris = np.roll(np.array(Image.open(os.path.join(TEX, "t_4jtr01_iris.png")).convert("RGBA")), (256, 256), (0, 1))
    lash = np.array(Image.open(os.path.join(TEX, "t_4jtr01_eyelash.png")).convert("RGBA"))
    items = []
    for s in ("top", "glv", "dwn", "sho", "fac"):
        d = json.load(open(os.path.join(ROOT, "work", "mdl", f"{s}.json")))
        for m in d["meshes"]:
            P = np.array(m["positions"], float)
            N = np.array(m["normals"], float)
            W = np.array(m["weights"], float)
            W /= W.sum(1, keepdims=True)
            out_p = np.zeros_like(P)
            out_n = np.zeros_like(N)
            for k in range(4):
                for v in range(len(P)):
                    b = m["bones"][v][k]
                    if W[v, k] <= 0 or not b:
                        continue
                    M = delta[b]
                    out_p[v] += W[v, k] * (M[:3, :3] @ P[v] + M[:3, 3])
                    out_n[v] += W[v, k] * (M[:3, :3] @ N[v])
            idx = np.array(m["indices"]).reshape(-1, 3)
            uv = np.array(m["uvs"], float)
            tex = iris if "iri" in m["material"] else lash if "etc_b" in m["material"] else body
            items.append(dict(pos=out_p, tris=idx, uv=uv[idx], nrm=out_n[idx], tex=tex))
    ims = [render.render(items, v, bounds=(0, 0.88, 0.95)) for v in ("front", "side", "back")]
    sheet = Image.new("RGB", (2700, 900))
    for i, im in enumerate(ims):
        sheet.paste(im, (i * 900, 0))
    sheet.save(sys.argv[1])
    print("saved", sys.argv[1])


main()
