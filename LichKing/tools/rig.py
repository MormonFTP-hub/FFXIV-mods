"""FFXIV skeleton + the pose that maps its A-pose bind pose onto Griffith's T-pose rip.

All maths in FFXIV model space (metres, Y up, +Z forward, +X = character's left), which the
OBJ already uses. A pose is a dict bone -> 4x4 "delta" matrix taking bind-pose world space to
posed world space; skinning a bind-pose vertex is sum(w_b * D_b @ v).
"""
import json
import math
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_skeleton():
    d = json.load(open(os.path.join(ROOT, "work", "refs", "skeleton.json")))
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


# Griffith's T-pose joints, measured from the rip (left side; the right mirrors x).
# Shoulder stays on the FFXIV joint; his arm runs level, about 4 cm behind FFXIV's.
G_ELBOW = np.array([0.443, 1.445, -0.065])
G_WRIST = np.array([0.700, 1.443, -0.058])


def tpose(names, parent, world, hand_frames=None):
    """Deltas taking the FFXIV bind pose to Griffith's T-pose.

    hand_frames: {"l": 3x3, "r": 3x3} Griffith hand frames (columns: finger direction,
    across the palm towards the index finger, palm normal); defaults to a level hand.
    """
    P = Pose(names, parent, world)
    for s, sx in (("l", 1.0), ("r", -1.0)):
        m = np.array([sx, 1.0, 1.0])
        sh, el, wr = P.pos(f"j_ude_a_{s}"), P.pos(f"j_ude_b_{s}"), P.pos(f"j_te_{s}")
        g_el, g_wr = G_ELBOW * m, G_WRIST * m
        # upper arm: rotate about the shoulder so the elbow lands on Griffith's elbow line
        R1 = rot_between(el - sh, g_el - sh)
        D1 = rot_about(R1, sh)
        P.set(f"j_ude_a_{s}", D1)
        P.set(f"n_hkata_{s}", D1)
        el1 = (D1 @ np.append(el, 1))[:3]
        wr1 = (D1 @ np.append(wr, 1))[:3]
        R2 = rot_between(wr1 - el1, g_wr - el1)
        D2 = rot_about(R2, el1) @ D1
        for b in (f"j_ude_b_{s}", f"n_hhiji_{s}", f"n_hijisoubi_{s}", f"n_buki_tate_{s}", f"n_hte_{s}"):
            P.set(b, D2)
        wr2 = (D2 @ np.append(wr, 1))[:3]
        # hand: map the FFXIV hand frame onto Griffith's
        fd = P.pos(f"j_naka_a_{s}") - wr
        across = P.pos(f"j_hito_a_{s}") - P.pos(f"j_ko_a_{s}")
        F_ff = frame(fd, across)
        if hand_frames and s in hand_frames:
            F_g = hand_frames[s]
        else:
            F_g = frame(np.array([sx, 0, 0]), np.array([0, 0, 1.0]))
        R3 = F_g @ F_ff.T
        D3 = rot_about(R3, wr, wr2)
        P.set(f"j_te_{s}", D3)
    return P, P.deltas()


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
