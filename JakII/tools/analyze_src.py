"""Measure the Jak rip to locate his joints (no skeleton ships with the OBJ). Units are the rip's own."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from objload import load_obj  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = load_obj(os.path.join(ROOT, "source", "JIIJak", "Jak.obj"))


def pts(*names):
    return np.vstack([M[n]["pos"] for n in names])


legs = pts("pants", "legs", "strapslegs", "shoes", "shoebottom")
print("--- legs: left-side x extent / z extent per height")
for y in np.arange(0.0, 32, 1.0):
    s = legs[(legs[:, 1] > y - 0.4) & (legs[:, 1] < y + 0.4) & (legs[:, 0] > 0)]
    if len(s):
        print(f"y={y:5.1f} n={len(s):4d} x {s[:, 0].min():6.2f}..{s[:, 0].max():6.2f} (c {s[:, 0].mean():5.2f})"
              f"  z {s[:, 2].min():6.2f}..{s[:, 2].max():6.2f}")

arm = pts("arms", "gloves", "face", "shirt", "armor", "strapsblue")
print("\n--- arms: y / z extent per x (left arm, y > 34)")
for x in np.arange(6, 34, 1.0):
    s = arm[(arm[:, 0] > x - 0.3) & (arm[:, 0] < x + 0.3) & (arm[:, 1] > 34)]
    if len(s):
        print(f"x={x:5.1f} n={len(s):4d} y {s[:, 1].min():6.2f}..{s[:, 1].max():6.2f} (c {(s[:, 1].min() + s[:, 1].max()) / 2:5.2f})"
              f"  z {s[:, 2].min():6.2f}..{s[:, 2].max():6.2f} (c {(s[:, 2].min() + s[:, 2].max()) / 2:5.2f})")

torso = pts("shirt", "strapschest", "scarf", "belt", "pants")
print("\n--- torso: x / z extent per height")
for y in np.arange(20, 50, 1.0):
    s = torso[(torso[:, 1] > y - 0.4) & (torso[:, 1] < y + 0.4)]
    if len(s):
        print(f"y={y:5.1f} n={len(s):4d} x {s[:, 0].min():6.2f}..{s[:, 0].max():6.2f}  z {s[:, 2].min():6.2f}..{s[:, 2].max():6.2f}")

f = M["face"]["pos"]
head = f[np.abs(f[:, 0]) < 12]
print("\n--- head skin (face group, |x| < 12)  bbox", head.min(0).round(2), head.max(0).round(2))
for y in np.arange(38, 58, 1.0):
    s = head[(head[:, 1] > y - 0.4) & (head[:, 1] < y + 0.4)]
    if len(s):
        print(f"y={y:5.1f} n={len(s):4d} x {s[:, 0].min():6.2f}..{s[:, 0].max():6.2f}  z {s[:, 2].min():6.2f}..{s[:, 2].max():6.2f}")
for n in ("eyel", "eyer", "teeth", "ears", "hair", "facialhair", "gogglemetal"):
    p = M[n]["pos"]
    print(f"{n:12s} centre {p.mean(0).round(2)} bbox {p.min(0).round(2)}..{p.max(0).round(2)}")
hand = f[f[:, 0] > 12]
print("\nleft hand skin bbox", hand.min(0).round(2), hand.max(0).round(2), "n", len(hand))
g = M["gloves"]["pos"]
g = g[g[:, 0] > 0]
print("left glove bbox", g.min(0).round(2), g.max(0).round(2))
for n, m in M.items():
    print(f"{n:12s} uv {m['uv'].min(0).round(2)}..{m['uv'].max(0).round(2)}")
