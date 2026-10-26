"""Source stats: size, axes, connected parts. Writes work/look/src.npz and work/look/parts.txt."""
import os

import numpy as np

import stl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
v, f = stl.read(os.path.join(ROOT, "source", "sailor_moon.stl"))
print("verts", len(v), "faces", len(f))
lo, hi = v.min(0), v.max(0)
print("bbox lo", lo, "hi", hi, "size", hi - lo)
lab = stl.components(len(v), f)
ids, cnt = np.unique(lab[f[:, 0]], return_counts=True)
order = np.argsort(-cnt)
lines = []
for i in order:
    fv = np.unique(f[lab[f[:, 0]] == ids[i]])
    p = v[fv]
    lines.append(f"part {ids[i]}: {cnt[i]} faces  lo {p.min(0).round(1)} hi {p.max(0).round(1)}")
print(len(ids), "parts")
print("\n".join(lines[:40]))
os.makedirs(os.path.join(ROOT, "work", "look"), exist_ok=True)
np.savez(os.path.join(ROOT, "work", "look", "src.npz"), v=v, f=f, lab=lab)
open(os.path.join(ROOT, "work", "look", "parts.txt"), "w").write("\n".join(lines))
