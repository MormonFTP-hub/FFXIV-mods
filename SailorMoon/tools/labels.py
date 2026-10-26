"""Paint-by-region for the untextured sculpt: one label per high-poly vertex (work/src/labels.npy).

The sculpt carves a groove along nearly every colour boundary (collar edge, bow, cuffs, boot tops, the hair
over the face), so the labels come from a marker watershed over the mesh: each region grows from a few seed
points (SEEDS, game axes, figure metres) through the lowest ground first, and two regions meet where the
ground is highest, i.e. along the grooves. "Ground" is how far a vertex sits below its smoothed surface.

python -P -E tools/labels.py [render]   (render: label renders to work/look/labels_*.png)
"""
import heapq
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import src  # noqa: E402

ROOT = src.ROOT
OUT = os.path.join(ROOT, "work", "src", "labels.npy")

# Seeds are picked the way the renders show them: (view, a, b) is the first surface a ray hits looking from
# that side. f/b (front/back): a = x, b = y; l/r (her left/right side): a = z, b = y; u (from below): a = x, b = z.
REGIONS = {}


def region(i, name, colour, *seeds):
    REGIONS[i] = (name, colour, list(seeds))


region(0, "skin", (0.98, 0.84, 0.74),
       ("f", 0.0, 1.67), ("f", 0.0, 1.625), ("f", 0.06, 1.66), ("f", -0.06, 1.66), ("f", 0.0, 1.80),
       ("l", 0.085, 1.72), ("r", 0.085, 1.72), ("f", -0.205, 1.39), ("f", 0.18, 1.39),
       ("f", 0.07, 0.80), ("f", -0.12, 0.80), ("f", 0.06, 0.65), ("f", -0.15, 0.65), ("b", 0.07, 0.80),
       ("b", -0.12, 0.80), ("f", 0.05, 0.62), ("f", -0.15, 0.62), ("b", 0.07, 0.62), ("b", -0.15, 0.62),
       ("f", 0.11, 0.87), ("b", 0.11, 0.93), ("b", -0.10, 0.93))
region(1, "hair", (0.98, 0.86, 0.38),
       ("f", 0.0, 1.93), ("b", 0.0, 1.80), ("b", 0.0, 1.90), ("f", -0.15, 1.985), ("f", 0.15, 1.985),
       ("b", -0.17, 1.95), ("b", 0.17, 1.95), ("f", -0.32, 1.40), ("f", 0.32, 1.40), ("f", -0.46, 1.0),
       ("f", 0.47, 1.0), ("b", -0.42, 0.95), ("b", 0.45, 0.95), ("b", -0.35, 1.30), ("b", 0.35, 1.30),
       ("f", -0.05, 1.86), ("f", 0.05, 1.86), ("f", -0.14, 1.80), ("f", 0.14, 1.80), ("f", -0.105, 1.80),
       ("f", 0.105, 1.80), ("l", 0.10, 1.80), ("l", 0.105, 1.84))
region(2, "barrette", (0.85, 0.12, 0.25), ("f", -0.134, 1.934), ("f", 0.131, 1.934))
region(3, "clip", (0.95, 0.35, 0.55), ("f", -0.13, 1.875), ("f", 0.13, 1.875))
region(4, "earring", (0.95, 0.75, 0.25), ("f", -0.119, 1.644), ("f", 0.125, 1.644))
region(5, "choker", (0.80, 0.08, 0.15), ("f", 0.0, 1.58), ("b", 0.0, 1.58), ("f", 0.035, 1.58), ("f", -0.035, 1.58), ("b", 0.035, 1.58), ("b", -0.035, 1.58))
region(6, "bodysuit", (0.97, 0.97, 0.99),
       ("f", 0.0, 1.29), ("f", 0.015, 1.54), ("f", -0.09, 1.40), ("f", 0.13, 1.37), ("f", 0.125, 1.39),
       ("b", 0.0, 1.30), ("b", 0.0, 1.345))
region(7, "collar", (0.12, 0.25, 0.75),
       ("f", -0.15, 1.53), ("f", 0.15, 1.53), ("f", 0.10, 1.51), ("f", -0.09, 1.51), ("f", -0.075, 1.565),
       ("f", 0.075, 1.57), ("b", 0.0, 1.375), ("b", 0.0, 1.45), ("b", 0.10, 1.50), ("b", -0.10, 1.50), ("b", 0.05, 1.39),
       ("b", -0.05, 1.39), ("b", 0.08, 1.42), ("b", -0.08, 1.42))
region(8, "bow", (0.88, 0.10, 0.18),
       ("f", -0.05, 1.45), ("f", 0.11, 1.43), ("f", 0.09, 1.43), ("f", 0.12, 1.415), ("f", 0.135, 1.43),
       ("f", 0.075, 1.36), ("f", -0.03, 1.37),
       ("b", 0.10, 1.27), ("b", -0.10, 1.27), ("b", 0.0, 1.20), ("b", -0.10, 1.15), ("b", 0.09, 1.16),
       ("b", 0.045, 1.02), ("b", -0.025, 1.02), ("b", 0.035, 1.08), ("b", -0.02, 1.08))
region(9, "brooch", (0.98, 0.80, 0.30), ("f", 0.045, 1.428))
region(10, "shoulder", (0.86, 0.90, 0.98), ("f", -0.17, 1.48), ("f", 0.17, 1.47))
region(11, "glove", (0.99, 0.99, 0.99), ("f", -0.25, 1.15), ("f", 0.21, 1.15), ("f", -0.33, 0.98), ("f", 0.35, 0.97))
region(12, "cuff", (0.86, 0.10, 0.18), ("f", -0.235, 1.25), ("f", 0.19, 1.235))
region(13, "skirt", (0.14, 0.30, 0.85),
       ("f", -0.15, 1.05), ("f", 0.15, 1.05), ("f", 0.0, 1.0), ("b", -0.18, 1.05), ("b", 0.13, 1.03),
       ("b", -0.13, 1.03), ("b", 0.20, 1.0), ("b", 0.12, 1.08), ("b", -0.15, 1.08), ("b", 0.165, 1.11), ("f", 0.05, 0.95),
       ("u", 0.23, 0.08))
region(14, "waistband", (0.95, 0.95, 0.98), ("f", 0.0, 1.17), ("f", -0.12, 1.22), ("f", 0.12, 1.22))
region(15, "boot", (0.85, 0.10, 0.17),
       ("f", 0.065, 0.30), ("f", -0.19, 0.30), ("f", 0.03, 0.10), ("f", -0.27, 0.10), ("b", 0.07, 0.30),
       ("b", -0.19, 0.30), ("b", 0.07, 0.45), ("b", -0.19, 0.45))
region(16, "crescent", (0.98, 0.80, 0.30), ("f", 0.068, 0.487), ("f", -0.192, 0.498))
region(17, "stripe", (0.99, 0.99, 0.97), ("f", -0.048, 1.536), ("f", -0.058, 1.56), ("f", 0.085, 1.536),
       ("f", 0.08, 1.52))

region(18, "eye", (0.30, 0.45, 0.95), ("f", -0.064, 1.72), ("f", 0.063, 1.72))

RAY = {"f": (0, 1, 2, 1), "b": (0, 1, 2, -1), "l": (2, 1, 0, 1), "r": (2, 1, 0, -1), "u": (0, 2, 1, -1)}
LABEL = {name: i for i, (name, _, _) in REGIONS.items()}
# small ornaments reach no farther than this from their seeds (figure metres): their grooves have gaps
REACH = {"barrette": 0.035, "clip": 0.045, "earring": 0.035, "brooch": 0.032, "crescent": 0.035, "bow": 0.08, "eye": 0.05, "shoulder": 0.06,
         "choker": 0.055}
# The leotard's leg openings aren't sculpted (they're under the skirt): skin above this line through the crotch
# becomes bodysuit. y > CROTCH_Y + slope * |x - crotch x|, below the waist.
CROTCH = (-0.015, 0.915, 0.9)
FOREARMS = (((0.168, 1.228, 0.031), (0.265, 1.018, 0.017)), ((-0.226, 1.23, 0.107), (-0.309, 1.022, 0.159)))
# Rules for what the grooves can't settle (each checked on the sculpt in GS comparison renders, 1.1.0):
# puff sleeves: the ridged rolls capping each upper arm, outboard of the collar's edge; (centre x, z) per side
PUFFS = ((0.165, 0.055), (-0.17, 0.07))
PUFF_R, PUFF_Y, PUFF_X = 0.085, (1.40, 1.58), 0.135
PUFF_BACK = 0.07                    # the rolls reach this far behind their centre; the back collar flap is further back
# ...except at her right shoulder, where the flap's edge wraps forward past z 0: the flap faces backwards (normal z
# about -0.9), so back-facing surface stays collar unless it's within PUFF_CORE of the puff's centre
FLAP_NZ, PUFF_CORE = -0.6, 0.06
CHOKER_TOP = 1.600
# thighs (hip -> knee, from joints.py): skirt inside a thigh's radius below the hem is leg
THIGHS = (((0.105, 0.955, 0.126), (0.067, 0.54, -0.001)), ((-0.083, 0.955, 0.13), (-0.164, 0.54, 0.151)))
THIGH_R, HEM_Y = 0.11, 0.955
# boot tops: at the back the rim's top edge sits at y RIM_Y over the back of the leg (x RIM_X) and rises by RIM_SLOPE
# per metre towards the leg's outer side (the V crest is at the front); boot above that line, well behind the knee's z,
# is calf (boot red had run up the back of her right calf)
KNEE_Z, BOOT_BACK_Y = (-0.001, 0.151), (0.48, 0.472)
# the rim's top edge stays near BOOT_BACK_Y round the back and outer side, then climbs into the front crest: by
# RIM_RISE per metre forward of RIM_Z0, per leg (her right leg, side renders: ~0.48 up to z 0.10, ~0.52 at 0.14).
# A line along x, an x limit, or a depth test against the calf each left the patch or bit into the rim.
RIM_Z0, RIM_RISE = (0.0, 0.10), (0.55, 1.1)
TAIL_X = 0.066                      # the back bow's two tails lie within |x| < this over the skirt


def adjacency(n, faces):
    e = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    e = np.unique(np.sort(e, 1), axis=0)
    a = np.concatenate([e[:, 0], e[:, 1]])
    b = np.concatenate([e[:, 1], e[:, 0]])
    order = np.argsort(a, kind="stable")
    a, b = a[order], b[order]
    start = np.searchsorted(a, np.arange(n + 1))
    return e, start, b


def smooth(pos, e, n, iters):
    deg = np.bincount(e[:, 0], minlength=n) + np.bincount(e[:, 1], minlength=n)
    p = pos.copy()
    for _ in range(iters):
        s = np.zeros_like(p)
        for c in range(3):
            s[:, c] = np.bincount(e[:, 0], p[e[:, 1], c], n) + np.bincount(e[:, 1], p[e[:, 0], c], n)
        p = s / np.maximum(deg, 1)[:, None]
    return p


def ground(pos, nrm, e):
    """How deep each vertex sits in a groove (metres below its smoothed surface, along the normal), at two
    scales; ridges are negative."""
    n = len(pos)
    g = np.zeros(n)
    for iters, w in ((4, 1.0), (16, 0.5)):
        g = np.maximum(g, w * np.sum((smooth(pos, e, n, iters) - pos) * nrm, 1))
    return g


def watershed(pos, height, start, nbr, seeds, reach, step=0.00035):
    """seeds: {label: [vertex ids]} -> label per vertex (-1 where nothing reached). Ground is flooded in
    `step` levels; within a level, regions grow by distance (Dijkstra), so flat ground splits half-way between
    seeds. A label with a reach claims nothing farther than that from its nearest seed."""
    level = np.floor(np.maximum(height, 0) / step).astype(np.int64)
    lab = np.full(len(height), -1, np.int32)
    heap = []
    for l, vs in seeds.items():
        for v in vs:
            lab[v] = l
            heapq.heappush(heap, (0, 0.0, int(v)))     # a seed in a groove still starts at the bottom
    centre = {l: pos[vs] for l, vs in seeds.items() if l in reach}
    while heap:
        h, d, v = heapq.heappop(heap)
        l = lab[v]
        for u in nbr[start[v]:start[v + 1]]:
            if lab[u] >= 0:
                continue
            if l in reach and np.min(np.sum((centre[l] - pos[u]) ** 2, 1)) > reach[l] ** 2:
                continue
            lab[u] = l
            hu = max(level[u], h)
            heapq.heappush(heap, (hu, (d if hu == h else 0.0) + float(np.linalg.norm(pos[u] - pos[v])), int(u)))
    return lab


def pick(pos, faces, view, a, b):
    """The vertex nearest to where a ray from `view` through (a, b) first hits the surface."""
    ia, ib, depth, sign = RAY[view]
    P = pos[faces]                                   # (M, 3, 3)
    u, v = P[:, :, ia], P[:, :, ib]
    cand = np.nonzero((u.min(1) <= a) & (u.max(1) >= a) & (v.min(1) <= b) & (v.max(1) >= b))[0]
    u, v, P = u[cand], v[cand], P[cand]
    d = (u[:, 1] - u[:, 0]) * (v[:, 2] - v[:, 0]) - (u[:, 2] - u[:, 0]) * (v[:, 1] - v[:, 0])
    ok = np.abs(d) > 1e-14
    d = np.where(ok, d, 1)
    w1 = ((a - u[:, 0]) * (v[:, 2] - v[:, 0]) - (u[:, 2] - u[:, 0]) * (b - v[:, 0])) / d
    w2 = ((u[:, 1] - u[:, 0]) * (b - v[:, 0]) - (a - u[:, 0]) * (v[:, 1] - v[:, 0])) / d
    w0 = 1 - w1 - w2
    hit = ok & (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
    if not hit.any():
        print(f"  ! seed ray {view} {a} {b} misses the mesh")
        return None
    W = np.stack([w0, w1, w2], 1)
    z = np.sum(W * P[:, :, depth], 1)
    k = np.nonzero(hit)[0][np.argmax(sign * z[hit])]
    return int(faces[cand[k]][np.argmax(W[k])])


def seed_vertices(pos, faces):
    out = {}
    for l, (_, _, seeds) in REGIONS.items():
        out[l] = [pick(pos, faces, *s) for s in seeds]
    bad = [REGIONS[l][2][i] for l, vs in out.items() for i, v in enumerate(vs) if v is None]
    if bad:
        raise ValueError(f"seed rays miss the mesh: {bad}")
    return out


def build():
    pos, faces, nrm = src.load()
    e, start, nbr = adjacency(len(pos), faces)
    gpath = os.path.join(ROOT, "work", "src", "ground.npy")
    if os.path.exists(gpath) and os.path.getmtime(gpath) > os.path.getmtime(src.OUT):
        g = np.load(gpath)
    else:
        g = ground(pos, nrm, e)
    print(f"ground: median {np.median(g) * 1000:.2f} mm, 95% {np.percentile(g, 95) * 1000:.2f}, "
          f"99% {np.percentile(g, 99) * 1000:.2f}")
    seeds = seed_vertices(pos, faces)
    owner = {}
    for l, ids in seeds.items():
        for s, v in zip(REGIONS[l][2], ids):
            if v in owner:
                print(f"  ! seed {s} of {REGIONS[l][0]} is the same vertex as one of {REGIONS[owner[v]][0]}")
            owner[v] = l
    reach = {LABEL[n]: r for n, r in REACH.items()}
    lab = watershed(pos, g, start, nbr, seeds, reach)
    cx, cy, slope = CROTCH
    under = (lab == LABEL["skin"]) & (pos[:, 1] > cy + slope * np.abs(pos[:, 0] - cx)) & (pos[:, 1] < 1.2)
    lab[under] = LABEL["bodysuit"]
    # the choker band's top edge is shallow at the sides: the whole band round the neck is choker
    neck = (lab == LABEL["skin"]) & (pos[:, 1] > 1.552) & (pos[:, 1] < 1.615) & \
           (np.hypot(pos[:, 0], pos[:, 2] - 0.065) < 0.07)
    lab[neck] = LABEL["choker"]
    # ... and nothing outside the neck: choker that crept onto the collar round it is collar
    off = (lab == LABEL["choker"]) & (np.hypot(pos[:, 0], pos[:, 2] - 0.065) > 0.072)
    lab[off] = LABEL["collar"]
    # its top edge straight round the neck at the band's top (the region's vertex steps read as a red fringe at the
    # nape in GS): choker below CHOKER_TOP, neck skin above
    in_neck = np.hypot(pos[:, 0], pos[:, 2] - 0.065) < 0.072
    lab[in_neck & (lab == LABEL["choker"]) & (pos[:, 1] > CHOKER_TOP)] = LABEL["skin"]
    lab[in_neck & (lab == LABEL["skin"]) & (pos[:, 1] > 1.552) & (pos[:, 1] <= CHOKER_TOP)] = LABEL["choker"]
    # puff sleeves: the collar flooded most of their rolls
    whiteish = np.isin(lab, [LABEL["collar"], LABEL["shoulder"], LABEL["stripe"], LABEL["bodysuit"]])
    for cx, cz in PUFFS:
        puff = whiteish & (np.sign(pos[:, 0]) == np.sign(cx)) & (np.abs(pos[:, 0]) > PUFF_X) & \
            (np.hypot(pos[:, 0] - cx, pos[:, 2] - cz) < PUFF_R) & (pos[:, 1] > PUFF_Y[0]) & (pos[:, 1] < PUFF_Y[1]) & \
            (pos[:, 2] > cz - PUFF_BACK) & \
            ((nrm[:, 2] > FLAP_NZ) | (np.hypot(pos[:, 0] - cx, pos[:, 2] - cz) < PUFF_CORE))
        lab[puff] = LABEL["shoulder"]
    # the chest's sides under the puffs (above the leotard's crop seam) are leotard; the collar flooded her left one.
    # The back flap (z < 0) and the lapels (|x| < 0.1, down to the bow) keep their blue.
    lab[(lab == LABEL["collar"]) & (np.abs(pos[:, 0]) > 0.1) & (pos[:, 1] < 1.45) & (pos[:, 2] > 0.0) &
        (nrm[:, 2] > FLAP_NZ)] = LABEL["bodysuit"]
    # skirt that ran down the back of a thigh below the hem
    for h, k in THIGHS:
        h, k = np.array(h), np.array(k)
        ax = k - h
        t = np.clip((pos - h) @ ax / (ax @ ax), 0, 1)
        r = np.linalg.norm(pos - (h + t[:, None] * ax), axis=1)
        lab[(lab == LABEL["skirt"]) & (r < THIGH_R) & (pos[:, 1] < HEM_Y)] = LABEL["skin"]
    # boot red that crept up the back of a calf
    for (h, k), kz, base, z0, rise in zip(THIGHS, KNEE_Z, BOOT_BACK_Y, RIM_Z0, RIM_RISE):
        k = np.array(k)
        near_leg = np.hypot(pos[:, 0] - k[0], pos[:, 2] - kz) < 0.12
        rim = base + rise * np.maximum(0, pos[:, 2] - z0)
        lab[(lab == LABEL["boot"]) & near_leg & (pos[:, 1] > rim + 0.004) & (pos[:, 2] < kz)] = LABEL["skin"]
    # the back bow's tails spilt onto the pleats beside them
    lab[(lab == LABEL["bow"]) & (pos[:, 1] < 1.10) & (pos[:, 2] < 0.05) & (np.abs(pos[:, 0]) > TAIL_X)] = LABEL["skirt"]
    # her forearms touch the skirt (the print fuses them): inside the forearm tube is glove, glove well outside
    # it is skirt (axes from joints.py: elbow to wrist)
    for e, w in FOREARMS:
        e, w = np.array(e), np.array(w)
        ax = w - e
        t = (pos - e) @ ax / (ax @ ax)
        d = np.linalg.norm(pos - (e + np.clip(t, 0, 1)[:, None] * ax), axis=1)
        along = (t > 0.0) & (t < 0.97) & (np.sign(pos[:, 0]) == np.sign(e[0])) & (d < 0.15)
        radial = (pos - (e + np.clip(t, 0, 1)[:, None] * ax)) / np.maximum(d, 1e-9)[:, None]
        facing_out = np.sum(radial * nrm, 1) > 0.5      # the arm's own surface, not skirt buried in it
        lab[along & (d < 0.036) & facing_out & np.isin(lab, [LABEL["skirt"], LABEL["bodysuit"]])] = LABEL["glove"]
        lab[along & (d > 0.05) & (lab == LABEL["glove"]) & (pos[:, 1] > 1.0)] = LABEL["skirt"]
    # shells no seed reached (a stray hair fleck): the label of the nearest labelled vertex
    lost = np.nonzero(lab < 0)[0]
    known = np.nonzero(lab >= 0)[0]
    for i in lost:
        lab[i] = lab[known[np.argmin(np.sum((pos[known] - pos[i]) ** 2, 1))]]
    for l, ids in seeds.items():
        for s, v in zip(REGIONS[l][2], ids):
            print(f"  {REGIONS[l][0]:10s} {s} -> {np.round(pos[v], 3)} ground {g[v] * 1000:.2f} mm")
    for l, (name, _, _) in REGIONS.items():
        print(f"  {name:10s} {np.sum(lab == l):7d} verts")
    print("  unreached", np.sum(lab < 0))
    np.save(OUT, lab)
    np.save(os.path.join(ROOT, "work", "src", "ground.npy"), g)
    return pos, faces, nrm, lab


def colours(lab):
    import look
    return look.palette(lab, {l: c for l, (_, c, _) in REGIONS.items()})


def render(pos, faces, lab, tag="labels", grid=False):
    import look
    col = colours(lab)
    look.render(f"{tag}_full", pos, faces, col, "front,back,left,right", 1200, grid=0.1 if grid else None)
    look.render(f"{tag}_head", pos, faces, col, "front,left,back,right", 1000, region=((0, 1.75, 0.05), 0.5),
                grid=0.02 if grid else None)
    look.render(f"{tag}_torso", pos, faces, col, "front,left,back,right", 1000, region=((0, 1.25, 0.0), 0.7),
                grid=0.02 if grid else None)
    look.render(f"{tag}_legs", pos, faces, col, "front,left,back,right,below", 1000, region=((0, 0.5, 0.05), 1.0),
                grid=0.05 if grid else None)


if __name__ == "__main__":
    pos, faces, nrm, lab = build()
    if "render" in sys.argv:
        render(pos, faces, lab)
