"""How well the plugsuit's wrapped collar (build_outfit.wrap_collar) fits each race's own neck: the share of the race's
neck points (its player faces, 1-4.5 cm up the neck) outside the collar, and the mean gap between collar and neck per
cell along and round the neck (negative: the neck pokes out).

python -P -E tools/collar_check.py [race ...]     (default every race; each through the fit it wears)
"""
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_outfit as bo  # noqa: E402
import fit  # noqa: E402
import labels  # noqa: E402
import pbd  # noqa: E402

BASE = {r: base for base, races in fit.COVER_RACES.items() for r in races}
BASE.update({r: r for r in bo.EXTRA})          # these wear their own models


def collar_grid(p, F, TB, AB):
    src = p["src"]
    collar = (np.hypot(src[:, 0], src[:, 2] - labels.NECK_Z) < 0.045) & (src[:, 1] > fit.COLLAR_LO)
    t, th, r, _ = fit.neck_polar(p["pos"][collar], F)
    g = np.zeros((len(TB) - 1, len(AB) - 1))
    sel = (t >= TB[0]) & (t < TB[-1])
    np.maximum.at(g, (np.digitize(t[sel], TB) - 1, np.clip(np.digitize(th[sel], AB) - 1, 0, len(AB) - 2)), r[sel])
    return g


def check(race, parts_by_base, D):
    base = BASE[race]
    F, p = parts_by_base[base]
    ks = float(np.linalg.norm(F["j_kao"] - F["j_kubi"])) / fit.NECK_REF
    TB = np.arange(0.0, 0.06 * ks, 0.005 * ks)
    AB = np.radians(np.arange(-180, 181, 30))
    coll = collar_grid(p, F, TB, AB)
    out = tot = 0
    neck = np.zeros_like(coll)
    for f in fit.COVER_FACES:
        s = fit.face_surface(race, f, base, D if race != base else None)
        if s is None:
            continue
        ft, fth, fr, _ = fit.neck_polar(s, F)
        k = (ft >= 0.01 * ks) & (ft < 0.045 * ks) & (fr < 0.09 * ks)
        i, j = np.digitize(ft[k], TB) - 1, np.clip(np.digitize(fth[k], AB) - 1, 0, len(AB) - 2)
        c = coll[i, j]
        out += np.sum((c > 0) & (fr[k] > c))
        tot += np.sum(c > 0)
        np.maximum.at(neck, (i, j), fr[k])
    gap = np.where((neck > 0) & (coll > 0), coll - neck, np.nan)
    print(f"{race} (fit {base}): neck poking out {out / max(tot, 1) * 100:5.1f}%; gap mean {np.nanmean(gap) * 1000:5.1f} mm, "
          f"min {np.nanmin(gap) * 1000:5.1f}, max {np.nanmax(gap) * 1000:5.1f}", flush=True)


def main(races):
    D = pbd.read()
    parts = {}
    for base in {BASE[r] for r in races}:
        fp = (bo.deformed_fit(base, bo.EXTRA[base]) if base in bo.EXTRA else
              pickle.load(open(os.path.join(fit.ROOT, "work", "fit", f"{base}.pkl"), "rb")))
        p = dict(fp["parts"]["body"])
        keep = ~(bo.above_collar(p["src"])[p["faces"]].sum(1) >= 2)
        p = bo.b.sub(p, keep)
        bo.wrap_collar(p, fp["joints"], base)
        parts[base] = (fp["joints"], p)
    for r in races:
        check(r, parts, D)


if __name__ == "__main__":
    main(sys.argv[1:] or [r for rs in fit.COVER_RACES.values() for r in rs])
