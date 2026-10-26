"""Skin weights for the reshaped WoW tiger on the FFXIV tiger skeleton (m0464).

Body, legs, paws and tail copy the weights of the nearest point on the vanilla FFXIV tiger
mesh, searching only the part of that mesh that belongs to the same limb as the WoW vertex
(by its WoW weights), so a leg never picks up weights from the belly or another leg.
The head keeps the WoW weights (renamed to FFXIV bones), which keeps the sabre fangs on the
skull instead of the jaw; the neck blends from copied weights into the WoW head weights.
"""
import re

import numpy as np

import xivdata as xd

VANILLA = "chara/monster/m0464/obj/body/b0001/model/m0464b0001.mdl"

WOW_GROUP = {}
for g, ks in {"body": [1, 2, 3, 4, 5, 9], "head": [8, 12, 13, 14, 15, 16], "tail": [17, 22, 27, 30],
              "Lf": [6, 10, 20, 25], "Rf": [7, 11, 21, 26], "Lh": [18, 23, 28, 31, 33], "Rh": [19, 24, 29, 32, 34]}.items():
    for k in ks:
        WOW_GROUP[k] = g
# WoW head bones -> FFXIV bones
WOW_HEAD_BONE = {8: "j_head", 14: "j_jaw", 12: "j_ear_l", 13: "j_ear_r", 15: "j_brow_r", 16: "j_brow_l"}


def xiv_group(bone):
    side = bone[-1] if bone[-2:] in ("_l", "_r") else ""
    if re.match(r"j_(arm|hand|handend|hhito|hko|hnaka|hoya)_", bone):
        return ("L" if side == "l" else "R") + "f"
    if re.match(r"j_(leg|foot|fhito|fko|fnaka|foya)_", bone):
        return ("L" if side == "l" else "R") + "h"
    if bone.startswith("j_tail"):
        return "tail"
    if re.match(r"j_(head|jaw|cheek|ear|brow|nose)", bone):
        return "head"
    return "body"


def closest_on_triangles(p, a, b, c):
    """Closest point on each triangle (a,b,c: (T,3)) to point p; returns (dist2 (T,), barycentric (T,3))."""
    ab, ac, ap = b - a, c - a, p - a
    d1, d2 = (ab * ap).sum(1), (ac * ap).sum(1)
    bp = p - b
    d3, d4 = (ab * bp).sum(1), (ac * bp).sum(1)
    cp = p - c
    d5, d6 = (ab * cp).sum(1), (ac * cp).sum(1)
    va = d3 * d6 - d5 * d4
    vb = d5 * d2 - d1 * d6
    vc = d1 * d4 - d3 * d2
    denom = np.where(np.abs(va + vb + vc) < 1e-20, 1e-20, va + vb + vc)
    v = vb / denom
    w = vc / denom
    bary = np.stack([1 - v - w, v, w], 1)
    # regions (Ericson, Real-Time Collision Detection 5.1.5)
    r_a = (d1 <= 0) & (d2 <= 0)
    r_b = (d3 >= 0) & (d4 <= d3)
    r_c = (d6 >= 0) & (d5 <= d6)
    r_ab = (vc <= 0) & (d1 >= 0) & (d3 <= 0)
    r_ac = (vb <= 0) & (d2 >= 0) & (d6 <= 0)
    r_bc = (va <= 0) & ((d4 - d3) >= 0) & ((d5 - d6) >= 0)
    t_ab = d1 / np.where(np.abs(d1 - d3) < 1e-20, 1e-20, d1 - d3)
    t_ac = d2 / np.where(np.abs(d2 - d6) < 1e-20, 1e-20, d2 - d6)
    t_bc = (d4 - d3) / np.where(np.abs((d4 - d3) + (d5 - d6)) < 1e-20, 1e-20, (d4 - d3) + (d5 - d6))
    bary = np.where(r_bc[:, None], np.stack([np.zeros_like(t_bc), 1 - t_bc, t_bc], 1), bary)
    bary = np.where(r_ac[:, None], np.stack([1 - t_ac, np.zeros_like(t_ac), t_ac], 1), bary)
    bary = np.where(r_ab[:, None], np.stack([1 - t_ab, t_ab, np.zeros_like(t_ab)], 1), bary)
    bary = np.where(r_c[:, None], [[0, 0, 1]], bary)
    bary = np.where(r_b[:, None], [[0, 1, 0]], bary)
    bary = np.where(r_a[:, None], [[1, 0, 0]], bary)
    q = bary[:, :1] * a + bary[:, 1:2] * b + bary[:, 2:] * c
    return ((q - p) ** 2).sum(1), bary


class VanillaWeights:
    def __init__(self, skel):
        van = xd.model(xd.local(VANILLA))["meshes"][0]
        self.skel = skel
        n = len(van["pos"])
        self.dense = np.zeros((n, len(skel.names)))
        for i in range(4):
            idx = np.array([skel.index[b] if b else 0 for b in van["bones"][:, i]])
            np.add.at(self.dense, (np.arange(n), idx), van["weights"][:, i])
        self.dense /= self.dense.sum(1, keepdims=True)
        self.faces = van["faces"]
        self.tri = van["pos"][self.faces]  # (T,3,3)
        groups = [xiv_group(b) for b in skel.names]
        tri_w = self.dense[self.faces].sum(1)  # (T, bones)
        gnames = sorted(set(groups))
        gsum = np.stack([tri_w[:, [i for i, g in enumerate(groups) if g == gn]].sum(1) for gn in gnames], 1)
        self.tri_group = np.array(gnames)[gsum.argmax(1)]

    def sample(self, p, allowed):
        sel = np.isin(self.tri_group, list(allowed))
        tri = self.tri[sel]
        d2, bary = closest_on_triangles(p, tri[:, 0], tri[:, 1], tri[:, 2])
        t = d2.argmin()
        f = self.faces[sel][t]
        return (bary[t][:, None] * self.dense[f]).sum(0), np.sqrt(d2[t])


def skin(meshes, skel, max_influences=4):
    """Add 'xiv_joints'/'xiv_weights' (skeleton bone indices, 4 per vertex) to each reshaped mesh."""
    van = VanillaWeights(skel)
    head_z = skel.pos("j_head")[2]
    nb = len(skel.names)
    stats = []
    for m in meshes:
        P, J, W = m["positions"], m["joints"], m["weights"]
        dense = np.zeros((len(P), nb))
        for v in range(len(P)):
            wow = {}
            for k, w in zip(J[v], W[v]):
                if w > 0:
                    wow[int(k)] = wow.get(int(k), 0) + w
            if not wow:
                continue
            groups = {WOW_GROUP[k] for k, w in wow.items() if w > 0.02}
            head_w = sum(w for k, w in wow.items() if WOW_GROUP[k] == "head")
            mapped = np.zeros(nb)
            for k, w in wow.items():
                if k in WOW_HEAD_BONE:
                    mapped[skel.index[WOW_HEAD_BONE[k]]] += w
            special = sum(w for k, w in wow.items() if k in (12, 13, 14, 15, 16))
            # how much of the vertex follows the WoW head weights: all of it in front of the head
            # joint or on the jaw/ears, fading to none 0.25 behind the head joint
            a = np.clip((P[v][2] - (head_z - 0.25)) / 0.25, 0, 1)
            alpha = head_w * max(a, 1.0 if special > 0 else 0.0)
            copied = np.zeros(nb)
            if alpha < 1:
                allowed = groups | ({"body"} if "head" in groups else set())
                copied, dist = van.sample(P[v], allowed)
                # never let the copied weights open the jaw or move ears
                for b in ("j_jaw", "j_ear_l", "j_ear_r"):
                    copied[skel.index[b]] = 0
                copied /= max(copied.sum(), 1e-9)
                stats.append(dist)
            if alpha > 0:
                mapped /= max(mapped.sum(), 1e-9)
            dense[v] = alpha * mapped + (1 - alpha) * copied
        order = np.argsort(-dense, 1)[:, :max_influences]
        top = np.take_along_axis(dense, order, 1)
        top /= np.maximum(top.sum(1, keepdims=True), 1e-9)
        m["xiv_joints"] = order
        m["xiv_weights"] = top
    stats = np.array(stats)
    print(f"weight copy distance: median {np.median(stats):.3f} m, 95% {np.percentile(stats, 95):.3f} m, max {stats.max():.3f} m")
    return meshes
