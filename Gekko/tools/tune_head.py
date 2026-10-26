"""Grid-search one race's head scale and placement against face show-through (poke.py's measure, faces f0001, f0002
and f0101 of the race itself, bind pose).

python -P -E tools/tune_head.py <race> head=1.0,1.05 eye_dz=0.01,0.015 [align=centre]
"""
import itertools
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fit  # noqa: E402
import poke  # noqa: E402
import xivdata as xd  # noqa: E402

FACES = ("f0001", "f0002", "f0101")


def show_through(race, parts, j_kubi):
    tris = []
    for m in parts.values():
        f = m["faces"]
        tris.append(m["pos"][f[m["pos"][f].mean(1)[:, 1] > j_kubi - 0.08]])
    tris = np.vstack(tris)
    out = []
    for face in FACES:
        p = f"chara/human/{race}/obj/face/{face}/model/{race}{face}_fac.mdl"
        if not xd.exists(p):
            continue
        pts = []
        for me in xd.model(p)["meshes"]:
            if "_fac_" in me["material"] or "_iri_" in me["material"]:
                keep = np.array([s < 0 or "atr_mim" not in me["sub_attrs"][s] for s in me["tri_sub"]])
                pts.append(me["pos"][np.unique(me["faces"][keep])])
        pts = np.vstack(pts)
        c = (pts.min(0) + pts.max(0)) / 2
        c[2] -= 0.02
        d = pts - c
        d /= np.linalg.norm(d, axis=1, keepdims=True)
        out.append((~poke.ray_hits(pts + d * 0.0005, d, tris)).mean() * 100)
    return out


def main(race, *args):
    grid = {}
    fixed = {}
    for a in args:
        k, v = a.split("=")
        if k == "align":
            fixed[k] = v
        else:
            grid[k] = [float(x) for x in v.split(",")]
    m = fit.sd.mesh()
    for combo in itertools.product(*grid.values()):
        prof = dict(fit.PROFILES[race], **fixed, **dict(zip(grid, combo)))
        rt = fit.Retarget(race, prof)
        pos, _ = rt.apply(m)
        parts = {}
        for prim, (name, _, _) in fit.PRIMS.items():
            f = m["faces"][m["prim"] == prim]
            used, remap = np.unique(f, return_inverse=True)
            parts[name] = dict(pos=pos[used], faces=remap.reshape(-1, 3))
        res = show_through(race, parts, rt.F["j_kubi"][1])
        print(f"### {race} {dict(zip(grid, combo))} {fixed}: " + " ".join(f"{r:5.1f}%" for r in res))


if __name__ == "__main__":
    main(*sys.argv[1:])
