"""Which bones drive each material of the Gregor meshes, and what the toggle shape keys move."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import srcdata as sd  # noqa: E402

for name in sd.scene()["objects"]:
    m = sd.mesh(name)
    print(f"\n== {name} ({len(m['pos'])} verts, {len(m['faces'])} tris)")
    for mi, mat in enumerate(m["materials"]):
        sel = m["mat"] == mi
        if not sel.any():
            continue
        vs = np.unique(m["faces"][sel])
        p = m["pos"][vs]
        w = m["groups"][vs].sum(0)
        top = np.argsort(-w)[:14]
        print(f"  [{mat}] {sel.sum()} tris  y {p[:, 1].min():.3f}..{p[:, 1].max():.3f}  x {p[:, 0].min():.3f}..{p[:, 0].max():.3f}")
        print("     " + ", ".join(f"{m['group_names'][g]}:{w[g]:.0f}" for g in top if w[g] > 0.5))
    for k, d in m["keys"].items():
        mv = np.linalg.norm(d, axis=1) > 1e-4
        if not mv.any():
            continue
        tri = mv[m["faces"]].any(1)
        mats = np.bincount(m["mat"][tri], minlength=len(m["materials"]))
        p = m["pos"][mv]
        print(f"  key {k!r}: moves {mv.sum()} verts (max {np.linalg.norm(d, axis=1).max():.3f} m), "
              f"bbox {p.min(0).round(3)}..{p.max(0).round(3)}, tris per material "
              + ", ".join(f"{m['materials'][i]}:{c}" for i, c in enumerate(mats) if c))
