"""Print what each dumped source mesh is weighted to, and which armature owns each group.

python -P -E tools/analyze_src.py
"""
import json
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "work", "src")

sc = json.load(open(os.path.join(SRC, "scene.json")))
owner = {}
for arm, bones in sc["armatures"].items():
    for b in bones:
        owner.setdefault(b, []).append(arm)
for name, o in sc["objects"].items():
    z = np.load(os.path.join(SRC, f"mesh_{name}.npz"))
    G = z["groups"]
    used = G.sum(0)
    order = np.argsort(-used)
    p = z["pos"]
    print(f"\n{name} armatures={o['armatures']} verts={len(p)} z {p[:, 2].min():.3f}..{p[:, 2].max():.3f}")
    print("   ", ", ".join(f"{o['groups'][g]}[{'/'.join(a[:4] for a in owner.get(o['groups'][g], ['?']))}]:{used[g]:.0f}"
                         for g in order if used[g] > 0.5))
    tot = G.sum(1)
    print(f"    weight sum {tot.min():.3f}..{tot.max():.3f}, unweighted verts {(tot < 1e-4).sum()}")
    mats = np.bincount(z["mat"], minlength=len(o["materials"]))
    print("    tris per material:", {m: int(c) for m, c in zip(o["materials"], mats) if c})
