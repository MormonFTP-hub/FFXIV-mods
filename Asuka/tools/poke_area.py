"""Area of the wearer's own face showing through her head, split front (face) / back (nape and neck sides).

A face triangle shows when the ray from the head centre through its centroid, carried on outward, meets none of
her head, hair or collar triangles.  python -P -E tools/poke_area.py <fit race> [races ...]
"""
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pbd  # noqa: E402
import poke  # noqa: E402
import rig  # noqa: E402
import xivdata as xd  # noqa: E402

ROOT = rig.ROOT


def face_tris(race):
    """The race's first face (Highlanders number theirs from f0101), ears left out."""
    path = next(p for p in (f"chara/human/{race}/obj/face/{f}/model/{race}{f}_fac.mdl" for f in ("f0001", "f0101", "f0201"))
                if xd.exists(p))
    m = xd.model(path)
    out = []
    for me in m["meshes"]:
        if "_fac_" in me["material"]:
            keep = np.array([s < 0 or "atr_mim" not in me["sub_attrs"][s] for s in me["tri_sub"]])
            out.append(me["pos"][me["faces"][keep]])
    return np.vstack(out)


def exposure(tris_face, occ):
    c = tris_face.mean(1)
    area = 0.5 * np.linalg.norm(np.cross(tris_face[:, 1] - tris_face[:, 0], tris_face[:, 2] - tris_face[:, 0]), axis=1)
    lo, hi = tris_face.reshape(-1, 3).min(0), tris_face.reshape(-1, 3).max(0)
    centre = (lo + hi) / 2
    centre[2] -= 0.02
    d = (c - centre) / np.linalg.norm(c - centre, axis=1, keepdims=True)
    show = ~poke.ray_hits(c + d * 0.0005, d, occ)
    back = c[:, 2] < centre[2] + 0.02
    tot = area.sum()
    return area[show & ~back].sum() / tot * 100, area[show & back].sum() / tot * 100


def main(fit_race, *races):
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit", f"{fit_race}.pkl"), "rb"))
    _, parents, _ = rig.load_skeleton(f"skeleton_{fit_race}")
    D = pbd.read()
    for race in races or (fit_race,):
        deform = None if race == fit_race else pbd.chain(D, int(fit_race[1:]), int(race[1:]))
        occ = poke.occluders(fit, deform, parents)
        front, back = exposure(face_tris(race), occ)
        print(f"{race}: face area showing {front:4.1f}% at the front, {back:4.1f}% at the nape and neck sides")


if __name__ == "__main__":
    main(*sys.argv[1:])
