"""List the connected pieces of each kept source material with their size and dominant source bones."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import srcdata as sd  # noqa: E402


def components(faces, n):
    parent = np.arange(n)

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for a, b, c in faces:
        for u, v in ((a, b), (b, c)):
            ru, rv = find(u), find(v)
            if ru != rv:
                parent[ru] = rv
    return np.array([find(i) for i in range(n)])


def islands(m, tri_sel):
    """Triangle islands (welded by source vertex id) among the selected triangles: list of triangle index arrays."""
    tris = np.nonzero(tri_sel)[0]
    vid = m["vid"]
    ids, inv = np.unique(vid, return_inverse=True)
    uf = inv[m["faces"][tris]]
    comp = components(uf, len(ids))[uf[:, 0]]
    return [tris[comp == c] for c in np.unique(comp)]


if __name__ == "__main__":
    m = sd.mesh("LCB Gregor")
    moved = {k: np.linalg.norm(d, axis=1) > 1e-4 for k, d in m["keys"].items()}
    for mat in ("LCB Gregor main", "AEDD Gregor"):
        mi = m["materials"].index(mat)
        sel = m["mat"] == mi
        for k in ("Glasses_off", "Cig_hide", "AEDD_Mask_Hide"):
            sel &= ~moved[k][m["faces"]].any(1)
        isl = sorted(islands(m, sel), key=len, reverse=True)
        print(f"\n== {mat}: {len(isl)} islands")
        for t in isl:
            vs = np.unique(m["faces"][t])
            p = m["pos"][vs]
            w = m["groups"][vs].sum(0)
            top = np.argsort(-w)[:4]
            print(f"  {len(t):6d} tris  x {p[:, 0].min():+.3f}..{p[:, 0].max():+.3f} y {p[:, 1].min():.3f}..{p[:, 1].max():.3f}"
                  f" z {p[:, 2].min():+.3f}..{p[:, 2].max():+.3f}  " + ", ".join(f"{m['group_names'][g]}:{w[g] / len(vs):.2f}" for g in top if w[g] > 0))
