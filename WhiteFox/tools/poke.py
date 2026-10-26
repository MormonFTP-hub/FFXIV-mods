"""How much of each feminine race's own face shows through White Fox's head (bind pose, racial deformer applied).

A face vertex counts as showing when a ray from the head centre through it, carried on outward, meets none of
her head-slot triangles (face, hair, eyes, ears, bow, hat with its flowers and sunglasses).

python -P -E tools/poke.py [fit race [races ...]]   (fit race default c0201; races default: every feminine race)
"""
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pbd  # noqa: E402
import rig  # noqa: E402
import xivdata as xd  # noqa: E402

ROOT = rig.ROOT
RACES = ("c0201", "c0401", "c0601", "c0801", "c1001", "c1401", "c1601", "c1801")
FACES = ("f0001", "f0002", "f0003", "f0101", "f0102", "f0201", "f0202")


def ray_hits(orig, dirs, tris, max_t=1.0):
    hit = np.zeros(len(orig), bool)
    v0, e1, e2 = tris[:, 0], tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0]
    for i in range(0, len(tris), 3000):
        a0, a1, a2 = v0[i:i + 3000], e1[i:i + 3000], e2[i:i + 3000]
        for j in range(0, len(orig), 200):
            o, d = orig[j:j + 200, None], dirs[j:j + 200, None]
            p = np.cross(d, a2[None])
            det = np.einsum("rtk,tk->rt", p, a1)
            ok = np.abs(det) > 1e-12
            inv = np.where(ok, 1 / np.where(ok, det, 1), 0)
            tv = o - a0[None]
            u = np.einsum("rtk,rtk->rt", tv, p) * inv
            q = np.cross(tv, a1[None])
            v = np.einsum("rk,rtk->rt", d[:, 0], q) * inv
            t = np.einsum("rtk,tk->rt", q, a2) * inv
            h = ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 0) & (t < max_t)
            hit[j:j + 200] |= h.any(1)
    return hit


NECK = ()


def occluders(fit, deform, parents):
    tris = []
    for n, m in fit["parts"].items():
        if m["slot"] == "met" or n in NECK:
            pos = m["pos"]
            if deform is not None:
                pos = pbd.deform(pos, m["bones"], m["weights"], deform, parents)
            tris.append(pos[m["faces"]])
    return np.vstack(tris)


def main(fit_race="c0201", *races):
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit", f"{fit_race}.pkl"), "rb"))
    _, parents, _ = rig.load_skeleton(f"skeleton_{fit_race}")
    D = pbd.read()
    for race in (races or RACES):
        deform = None if race == fit_race else pbd.chain(D, int(fit_race[1:]), int(race[1:]))
        tris = occluders(fit, deform, parents)
        names, _, world = rig.load_skeleton(f"skeleton_{race}") if os.path.exists(
            os.path.join(ROOT, "work", "refs", f"skeleton_{race}.json")) else (None, None, None)
        for face in FACES:
            p = f"chara/human/{race}/obj/face/{face}/model/{race}{face}_fac.mdl"
            if not xd.exists(p):
                continue
            m = xd.model(p)
            pts = []
            for me in m["meshes"]:
                if "_fac_" in me["material"] or "_iri_" in me["material"]:
                    # ears (atr_mim) are hidden under the head piece, which shows no ears
                    keep = np.array([s < 0 or "atr_mim" not in me["sub_attrs"][s] for s in me["tri_sub"]])
                    pts.append(me["pos"][np.unique(me["faces"][keep])])
            pts = np.vstack(pts)
            centre = (pts.min(0) + pts.max(0)) / 2
            centre[2] -= 0.02
            d = pts - centre
            d /= np.linalg.norm(d, axis=1, keepdims=True)
            covered = ray_hits(pts + d * 0.0005, d, tris)
            bad = pts[~covered]
            where = ""
            if len(bad):
                lo, hi = bad.min(0), bad.max(0)
                where = f" showing y {lo[1]:.3f}..{hi[1]:.3f} z {lo[2]:.3f}..{hi[2]:.3f}"
            print(f"{race} {face}: {(~covered).mean() * 100:5.1f}% of {len(pts)} face verts show{where}")


if __name__ == "__main__":
    main(*sys.argv[1:])
