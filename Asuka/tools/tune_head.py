"""Grid-search the head profile (head scale, eye_dz, eye_dy) for one fitted race: the share of the wearer's own
face (faces FACES, ears left out) that shows through her head, collar and hair, in the bind pose.

python -P -E tools/tune_head.py <race> [heads] [eye_dz values] [eye_dy values]   (comma lists)
"""
import itertools
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fit  # noqa: E402
import joints as jt  # noqa: E402
import labels  # noqa: E402
import poke  # noqa: E402
import xivdata as xd  # noqa: E402

FACES = ("f0001", "f0002", "f0003")
HEADS = (1.0, 1.05, 1.1, 1.15)
DZ = (0.012, 0.02, 0.028)
DY = (0.0, -0.008, -0.016)


def face_points(race, face):
    m = xd.model(f"chara/human/{race}/obj/face/{face}/model/{race}{face}_fac.mdl")
    pts = []
    for me in m["meshes"]:
        if "_fac_" in me["material"] or "_iri_" in me["material"]:
            keep = np.array([s < 0 or "atr_mim" not in me["sub_attrs"][s] for s in me["tri_sub"]])
            pts.append(me["pos"][np.unique(me["faces"][keep])])
    return np.vstack(pts)


def main(race, heads=None, dzs=None, dys=None):
    def floats(v, default):
        return tuple(float(x) for x in v.split(",")) if v else default
    J = jt.load()
    d = np.load(os.path.join(fit.ROOT, "work", "src", "high.npz"))
    lab = np.load(labels.OUT)
    parts = fit.load_parts()
    weights = {n: fit.segment_weights(p["pos"], p["lab"], J)[1] for n, p in parts.items()}
    faces = [face_points(race, f) for f in FACES if xd.exists(f"chara/human/{race}/obj/face/{f}/model/{race}{f}_fac.mdl")]
    base = dict(fit.PROFILES[race])
    results = []
    for kh, dz, dy in itertools.product(floats(heads, HEADS), floats(dzs, DZ), floats(dys, DY)):
        prof = dict(base, head=kh, eye_dz=dz, eye_dy=dy)
        import contextlib
        import io
        with contextlib.redirect_stdout(io.StringIO()):
            rt = fit.Retarget(race, prof, J, d["pos"], lab)
        y_cut = rt.F["j_kubi"][1] - 0.08
        tris = []
        for n, p in parts.items():
            pos, _ = rt.apply(p["pos"], p["nrm"], weights[n])
            f = p["faces"][pos[p["faces"]].mean(1)[:, 1] > y_cut]
            tris.append(pos[f])
        tris = np.vstack(tris)
        show = []
        for pts in faces:
            c = (pts.min(0) + pts.max(0)) / 2
            c[2] -= 0.02
            dirs = (pts - c) / np.linalg.norm(pts - c, axis=1, keepdims=True)
            show.append((~poke.ray_hits(pts + dirs * 0.0005, dirs, tris)).mean() * 100)
        results.append((np.mean(show), kh, dz, dy, show))
        print(f"head {kh:.2f} dz {dz:.3f} dy {dy:+.3f}: {np.mean(show):5.1f}%  " +
              " ".join(f"{s:4.1f}" for s in show), flush=True)
    best = min(results)
    print(f"best: head {best[1]} eye_dz {best[2]} eye_dy {best[3]} -> {best[0]:.1f}%")


if __name__ == "__main__":
    main(*sys.argv[1:])
