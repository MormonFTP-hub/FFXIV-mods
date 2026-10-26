"""Measure the Griffith rip to locate his joints (no skeleton ships with the OBJ)."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from objload import load_obj  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = load_obj(os.path.join(ROOT, "source", "Griffith.obj"))
for n, m in M.items():
    print(f"{n:20s} v={len(m['pos']):6d} f={len(m['faces']):6d} uv range {np.round(m['uv'].min(0), 2)}..{np.round(m['uv'].max(0), 2)}")

body = np.vstack([M[n]["pos"] for n in ("model_1_submesh_1", "model_1_submesh_3")])
hands = M["model_1_submesh_2"]["pos"]
gaunt = M["model_1_submesh_4"]["pos"]
head = M["model_4_submesh_1"]["pos"]
eyes = M["model_4_submesh_2"]["pos"]

print("\n--- legs: x-extent of body per height (left side x>0)")
for y in np.arange(0.0, 1.15, 0.05):
    s = body[(body[:, 1] > y - 0.01) & (body[:, 1] < y + 0.01)]
    if len(s) == 0:
        continue
    l = s[s[:, 0] > 0]
    mid = s[np.abs(s[:, 0]) < 0.015]
    print(f"y={y:.2f} n={len(s):5d} xL {l[:, 0].min() if len(l) else 0:.3f}..{l[:, 0].max() if len(l) else 0:.3f}"
          f" z {s[:, 2].min():.3f}..{s[:, 2].max():.3f}  mid-x verts {len(mid)}")

print("\n--- arms: y/z centre per x (left arm)")
arm = np.vstack([body, hands, gaunt])
for x in np.arange(0.15, 0.90, 0.025):
    s = arm[(arm[:, 0] > x - 0.006) & (arm[:, 0] < x + 0.006) & (arm[:, 1] > 1.2)]
    h = hands[(hands[:, 0] > x - 0.006) & (hands[:, 0] < x + 0.006)]
    if len(s):
        print(f"x={x:.3f} n={len(s):4d} y {s[:, 1].min():.3f}..{s[:, 1].max():.3f} z {s[:, 2].min():.3f}..{s[:, 2].max():.3f}"
              f"  hand n={len(h)} {'' if not len(h) else f'y {h[:, 1].min():.3f}..{h[:, 1].max():.3f} z {h[:, 2].min():.3f}..{h[:, 2].max():.3f}'}")
hl = hands[hands[:, 0] > 0]
print("left hand mesh x", hl[:, 0].min(), hl[:, 0].max(), "y", hl[:, 1].min(), hl[:, 1].max(), "z", hl[:, 2].min(), hl[:, 2].max())
gl = gaunt[gaunt[:, 0] > 0]
print("left gauntlet x", gl[:, 0].min(), gl[:, 0].max())

print("\n--- head")
print("head skin bbox", head.min(0).round(3), head.max(0).round(3))
el = eyes[eyes[:, 0] > 0]
print("left eye centre", el.mean(0).round(3))
for y in np.arange(1.48, 1.76, 0.02):
    s = head[(head[:, 1] > y - 0.005) & (head[:, 1] < y + 0.005)]
    if len(s):
        print(f"y={y:.2f} x {s[:, 0].min():.3f}..{s[:, 0].max():.3f} z {s[:, 2].min():.3f}..{s[:, 2].max():.3f}")

print("\n--- feet")
foot = body[(body[:, 1] < 0.2) & (body[:, 0] > 0)]
print("left foot bbox", foot.min(0).round(3), foot.max(0).round(3))
for y in np.arange(0.0, 0.2, 0.02):
    s = foot[(foot[:, 1] > y - 0.005) & (foot[:, 1] < y + 0.005)]
    if len(s):
        print(f"y={y:.2f} x {s[:, 0].min():.3f}..{s[:, 0].max():.3f} z {s[:, 2].min():.3f}..{s[:, 2].max():.3f}")
