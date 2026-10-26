"""List what each source primitive is weighted to (summed weight per bone) and the bind-pose skeleton tree.

python -P -E tools/analyze_src.py [prim-substring ...] [--tree]
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import srcdata as sd  # noqa: E402

if __name__ == "__main__":
    want = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--tree" in sys.argv:
        B = sd.bones()
        depth = {}
        for n, b in B.items():
            depth[n] = 0 if b["parent"] is None else depth[b["parent"]] + 1
            print("  " * depth[n] + f"{n} {np.round(b['head'], 3)}")
    for n in sd.prim_names():
        if want and not any(w in n for w in want):
            continue
        m = sd.mesh(n)
        tot = m["groups"].sum(0)
        order = np.argsort(-tot)
        print(f"{n}: {len(m['pos'])} verts")
        print("   " + ", ".join(f"{m['group_names'][i]} {tot[i]:.0f}" for i in order if tot[i] > 0.5))
