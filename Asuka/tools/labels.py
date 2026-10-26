"""Region labels for the Tripo mesh, one per high-poly vertex (work/src/labels.npy), from the texture colour.

  hair  her orange-brown hair: hue 17-50 deg, saturation > 0.35 (the suit is red, hue < 17 or > 340; its orange
        chest plates are red-orange, hue < 17), above the waist; smoothed over the mesh, and only pieces big enough
        to be hair kept (the suit's small orange-brown flecks go back to the suit)
  clip  the red A10 nerve clips on her head: not hair, above CLIP_Y
  face  skin above the collar: face, ears, eyes, the neck between collar and jaw. The collar's top is its navy
        band's highest point, per 15 degrees round the neck (0.859 at the front, 0.868 at the back); everything
        that isn't hair above it, within NECK_R of the neck's axis, and everything above NECK_TOP
  suit  the rest: the plugsuit, gloves and boots

python -P -E tools/labels.py [render]   (render: work/look/labels_*.png)
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import src  # noqa: E402
import stl  # noqa: E402

ROOT = src.ROOT
OUT = os.path.join(ROOT, "work", "src", "labels.npy")
COLLAR = os.path.join(ROOT, "work", "src", "collar.npy")      # (angle centre deg, collar top y) rows
NAMES = ["suit", "hair", "clip", "face"]
LABEL = {n: i for i, n in enumerate(NAMES)}
COLOURS = {0: (0.75, 0.12, 0.12), 1: (0.95, 0.65, 0.2), 2: (0.2, 0.3, 0.9), 3: (0.98, 0.85, 0.75)}
HAIR_MIN_Y = 0.66           # her hair ends at y 0.69
HAIR_MIN_PIECE = 2000       # vertices
CLIP_Y = 0.945
NECK_Z = 0.012              # the neck's axis (x = 0)
NECK_R = 0.07
COLLAR_MARGIN = 0.0015      # above the navy band's top
NECK_TOP = 0.885            # above this, nothing is collar
SMOOTH = 3


def hsv(c):
    mx, mn = c.max(1), c.min(1)
    d = np.maximum(mx - mn, 1e-6)
    r, g, b = c.T
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, (mx - mn) / np.maximum(mx, 1e-6), mx


def edges(faces):
    e = np.sort(np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]]), 1)
    return np.unique(e, axis=0)


def smooth(mask, e, n, iters):
    """Majority vote over the one-ring, a few times: tidies speckled colour borders."""
    deg = np.bincount(e.ravel(), minlength=n).astype(float)
    m = mask.astype(float)
    for _ in range(iters):
        s = np.bincount(e[:, 0], m[e[:, 1]], n) + np.bincount(e[:, 1], m[e[:, 0]], n)
        m = ((s + m) / (deg + 1) > 0.5).astype(float)
    return m > 0.5


def keep_big(mask, faces, n, min_size):
    """Only the connected pieces of `mask` (over triangles all inside it) with at least min_size vertices."""
    f = faces[mask[faces].all(1)]
    comp = stl.components(n, f)
    ids, cnt = np.unique(comp[np.unique(f)], return_counts=True)
    big = np.isin(comp, ids[cnt >= min_size]) & mask
    return big, sorted(cnt[cnt >= min_size].tolist(), reverse=True)


def collar_top(pos, h, s, hair):
    """Per vertex: the collar's top edge at its angle round the neck (navy band, 15-degree bins, interpolated)."""
    th = np.degrees(np.arctan2(pos[:, 0], pos[:, 2] - NECK_Z))
    r = np.hypot(pos[:, 0], pos[:, 2] - NECK_Z)
    navy = (h > 195) & (h < 265) & (s > 0.3) & (pos[:, 1] > 0.845) & (pos[:, 1] < 0.885) & ~hair & (r < 0.06)
    centres = np.arange(-180, 180, 15) + 7.5
    tops = np.array([pos[navy & (np.abs((th - c + 180) % 360 - 180) < 7.5), 1].max() for c in centres])
    print("collar top by angle:", np.round(tops, 4))
    np.save(COLLAR, np.c_[centres, tops])
    return collar_top_at(pos)


def collar_top_at(pos):
    """The collar's top edge (labels.py measured it) at each point's angle round the neck."""
    centres, tops = np.load(COLLAR).T
    th = np.degrees(np.arctan2(pos[:, 0], pos[:, 2] - NECK_Z))
    return np.interp(th, np.r_[centres - 360, centres, centres + 360], np.tile(tops, 3))


def label():
    d = np.load(src.OUT)
    pos, faces, col = d["pos"], d["faces"], d["colour"]
    n = len(pos)
    e = edges(faces)
    h, s, v = hsv(col)
    y = pos[:, 1]
    hair = (h > 17) & (h < 50) & (s > 0.35) & (y > HAIR_MIN_Y)
    hair = smooth(hair, e, n, SMOOTH)
    hair, pieces = keep_big(hair, faces, n, HAIR_MIN_PIECE)
    print(f"hair: {hair.sum()} verts in {len(pieces)} pieces {pieces[:8]}")
    lab = np.zeros(n, np.int8)
    lab[hair] = LABEL["hair"]
    top = collar_top(pos, h, s, hair)
    head = ~hair & (((y > top + COLLAR_MARGIN) & (np.hypot(pos[:, 0], pos[:, 2] - NECK_Z) < NECK_R)) |
                    (y > NECK_TOP))
    head, pieces = keep_big(head, faces, n, 500)
    print(f"head: {head.sum()} verts in pieces {pieces[:8]}")
    lab[head] = LABEL["face"]
    lab[head & (y > CLIP_Y)] = LABEL["clip"]
    for k, name in enumerate(NAMES):
        print(f"  {name:5s} {np.sum(lab == k):7d}")
    np.save(OUT, lab)
    return pos, faces, lab


def colours(lab):
    out = np.zeros((len(lab), 3))
    for k, c in COLOURS.items():
        out[lab == k] = c
    return out


if __name__ == "__main__":
    pos, faces, lab = label()
    if "render" in sys.argv:
        import look
        look.render("labels", pos, faces, colours(lab), "front,back,left", 1000, grid=0.05)
        look.render("labels_head", pos, faces, colours(lab) * 0.6 + 0.4 * np.load(src.OUT)["colour"],
                    "front,left,back", 900, ((0, 0.9, 0), 0.24), grid=0.02)
