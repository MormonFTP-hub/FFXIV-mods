"""Search the head profile (scale, eye offsets) for a race: how much of the FFXIV face shows through her head,
for each candidate, using only the head-slot meshes (fast; tools/poke.py checks the full fit afterwards).
After the InvisibleWoman port's tool.

python -P -E tools/tune_head.py <race> [face ...] [--head 2.2,2.4] [--dz 0.01,0.02] [--dy 0,0.005]
  (absolute values; by default a grid round the race's PROFILES entry)
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

HEAD = {16: None, 11: None, 15: "head", 19: "head", 23: "head", 20: "head"}   # face, hair, eyes, hat, hat flowers, lenses


def face_points(race, face):
    m = xd.model(f"chara/human/{race}/obj/face/{face}/model/{race}{face}_fac.mdl")
    pts = []
    for me in m["meshes"]:
        if "_fac_" in me["material"] or "_iri_" in me["material"]:
            keep = np.array([s < 0 or "atr_mim" not in me["sub_attrs"][s] for s in me["tri_sub"]])
            pts.append(me["pos"][np.unique(me["faces"][keep])])
    return np.vstack(pts)


def showing(race, prof, faces, meshes):
    rt = fit.Retarget(race, prof)
    tris = np.vstack([rt.apply(m, HEAD[i])[0][m["faces"]] for i, m in meshes.items()])
    out = []
    for face in faces:
        pts = face_points(race, face)
        centre = (pts.min(0) + pts.max(0)) / 2
        centre[2] -= 0.02
        d = pts - centre
        d /= np.linalg.norm(d, axis=1, keepdims=True)
        out.append((~ray_hits(pts + d * 0.0005, d, tris)).mean() * 100)
    return out


if __name__ == "__main__":
    args = sys.argv[1:]
    opts = {}
    for k in ("--head", "--dz", "--dy"):
        if k in args:
            i = args.index(k)
            opts[k] = [float(v) for v in args[i + 1].split(",")]
            del args[i:i + 2]
    race = args[0]
    faces = args[1:] or ["f0001"]
    meshes = {}
    for i in HEAD:
        m = sd.prim(i)
        meshes[i] = sd.submesh(m, fit.eyeball_faces(m)) if i == 15 else m
    base = dict(fit.PROFILES[race])
    heads = opts.get("--head", [base["head"] * k for k in (1.0, 1.06, 1.12, 1.18, 1.24)])
    dzs = opts.get("--dz", [base["eye_dz"] + d for d in (0.0, 0.006, 0.012)])
    dys = opts.get("--dy", [base.get("eye_dy", 0.0) + d for d in (-0.006, 0.0, 0.006)])
    sys.stdout = open(os.devnull, "w")       # Retarget prints its plan every time
    rows = []
    for h, dz, dy in itertools.product(heads, dzs, dys):
        prof = dict(base, head=h, eye_dz=dz, eye_dy=dy)
        rows.append((showing(race, prof, faces, meshes), h, dz, dy))
    sys.stdout = sys.__stdout__
    for s, h, dz, dy in sorted(rows, key=lambda r: np.mean(r[0]))[:15]:
        print(f"head {h:.3f} eye_dz {dz:.3f} eye_dy {dy:+.3f}: " + " ".join(f"{v:5.1f}%" for v in s))
