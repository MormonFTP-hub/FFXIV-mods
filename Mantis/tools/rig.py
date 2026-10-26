"""FFXIV skeleton and pose maths.

All maths in FFXIV model space (metres, Y up, +Z forward, +X = character's left). A pose is a dict
bone -> 4x4 "delta" matrix taking bind-pose world space to posed world space; skinning a bind-pose
vertex is sum(w_b * D_b @ v).
"""
import json
import math
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_skeleton(name="skeleton"):
    d = json.load(open(os.path.join(ROOT, "work", "refs", f"{name}.json")))
    names = list(d)
    parent = {n: d[n]["parent"] for n in names}
    world = {n: np.array(d[n]["world"]) for n in names}
    return names, parent, world


def rot_between(a, b):
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if c < -0.999999:
        axis = np.cross(a, [1, 0, 0])
        if np.linalg.norm(axis) < 1e-6:
            axis = np.cross(a, [0, 1, 0])
        return axis_angle(axis, math.pi)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx / (1 + c)


def axis_angle(axis, ang):
    axis = np.asarray(axis, float) / np.linalg.norm(axis)
    x, y, z = axis
    c, s, t = math.cos(ang), math.sin(ang), 1 - math.cos(ang)
    return np.array([[t * x * x + c, t * x * y - s * z, t * x * z + s * y],
                     [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
                     [t * x * z - s * y, t * y * z + s * x, t * z * z + c]])


def rot_about(R, pivot_from, pivot_to=None):
    """4x4: rotate by R about pivot_from, then move the pivot to pivot_to."""
    m = np.eye(4)
    m[:3, :3] = R
    m[:3, 3] = (pivot_from if pivot_to is None else pivot_to) - R @ pivot_from
    return m


def frame(u, v):
    """Orthonormal frame (columns) from a primary direction u and a secondary hint v."""
    u = u / np.linalg.norm(u)
    v = v - u * np.dot(u, v)
    v /= np.linalg.norm(v)
    return np.stack([u, v, np.cross(u, v)], 1)


class Pose:
    """Builds per-bone deltas parent-first; bones without their own delta follow their parent."""

    def __init__(self, names, parent, world):
        self.names, self.parent, self.world = names, parent, world
        self.own = {}

    def pos(self, b):
        return self.world[b][:3, 3]

    def set(self, bone, delta):
        self.own[bone] = delta

    def deltas(self):
        out = {}
        for b in self.names:  # skeleton.json lists parents before children
            if b in self.own:
                out[b] = self.own[b]
            else:
                p = self.parent[b]
                out[b] = out[p] if p is not None else np.eye(4)
        return out

    def posed(self, b, deltas):
        return (deltas[b] @ np.append(self.pos(b), 1))[:3]


def skin(pos, bones, weights, deltas, inverse=False):
    """Linear blend skinning. bones: (N,K) names ('' unused); weights (N,K)."""
    out = np.zeros((len(pos), 3))
    lin = np.zeros((len(pos), 3, 3))
    hom = np.c_[pos, np.ones(len(pos))]
    cache = {}
    for k in range(bones.shape[1]):
        for b in np.unique(bones[:, k]):
            if not b:
                continue
            sel = (bones[:, k] == b) & (weights[:, k] > 0)
            if not sel.any():
                continue
            if b not in cache:
                cache[b] = np.linalg.inv(deltas[b]) if inverse else deltas[b]
            D = cache[b]
            w = weights[sel, k][:, None]
            out[sel] += w * (hom[sel] @ D.T)[:, :3]
            lin[sel] += w[:, :, None] * D[:3, :3][None]
    return out, lin
