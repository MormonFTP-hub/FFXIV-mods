"""Try head profiles for a race: how much of the FFXIV face shows through Viper's head (gas mask and bare states),
for each candidate (head scale, eye_dz, eye_dy). Only the head-region triangles are retargeted.

python -P -E tools/tune_head.py <race> --head 1.0,1.1 [--dz 0.012] [--dy 0] [--faces f0001,f0002]
"""
import itertools
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fit  # noqa: E402
import srcdata as sd  # noqa: E402
import xivdata as xd  # noqa: E402
from poke import ray_hits  # noqa: E402


def face_points(race, face):
    m = xd.model(f"chara/human/{race}/obj/face/{face}/model/{race}{face}_fac.mdl")
    pts = []
    for me in m["meshes"]:
        if "_fac_" in me["material"] or "_iri_" in me["material"]:
            keep = np.array([s < 0 or "atr_mim" not in me["sub_attrs"][s] for s in me["tri_sub"]])
            pts.append(me["pos"][np.unique(me["faces"][keep])])
    return np.vstack(pts)


def main(race, head, dz, dy, faces):
    m = sd.mesh()
    hide = fit.hidden(m)
    B = sd.bones()
    top = B["Neck"]["head"][1] - 0.1
    near = np.zeros(len(m["pos"]), bool)
    near[np.unique(m["faces"][m["pos"][m["faces"]].mean(1)[:, 1] > top])] = True
    used = np.nonzero(near)[0]
    sub = {k: (v[used] if isinstance(v, np.ndarray) and len(v) == len(m["pos"]) else v) for k, v in m.items()}
    remap = np.full(len(m["pos"]), -1)
    remap[used] = np.arange(len(used))
    f = remap[m["faces"]]
    keep = (f >= 0).all(1)
    pts = {face: face_points(race, face) for face in faces}
    base = dict(fit.PROFILES[race])
    for h, z, y in itertools.product(head, dz, dy):
        prof = dict(base, head=h, eye_dz=z, eye_dy=y)
        old = sys.stdout
        sys.stdout = open(os.devnull, "w")
        try:
            pos, _ = fit.Retarget(race, prof).apply(sub)
        finally:
            sys.stdout.close()
            sys.stdout = old
        row = []
        for state in ("gas", "bare"):
            ff = f[keep & ~hide[state][m["faces"]].any(1)]
            tris = pos[ff]
            r = []
            for face, p in pts.items():
                c = (p.min(0) + p.max(0)) / 2
                c[2] -= 0.02
                d = p - c
                d /= np.linalg.norm(d, axis=1, keepdims=True)
                r.append((~ray_hits(p + d * 0.0005, d, tris)).mean() * 100)
            row.append(f"{state} {np.mean(r):4.1f}% (max {np.max(r):4.1f})")
        print(f"head {h:.3f} dz {z:.3f} dy {y:.3f}: " + "  ".join(row), flush=True)


if __name__ == "__main__":
    a = sys.argv[1:]
    race = a[0]

    def opt(k, default):
        return [float(x) for x in a[a.index(k) + 1].split(",")] if k in a else default
    faces = a[a.index("--faces") + 1].split(",") if "--faces" in a else ["f0001", "f0003", "f0202"]
    main(race, opt("--head", [fit.PROFILES[race]["head"]]), opt("--dz", [fit.PROFILES[race]["eye_dz"]]),
         opt("--dy", [fit.PROFILES[race].get("eye_dy", 0.0)]), faces)
