"""FFXIV skeleton + the pose that maps its A-pose bind pose onto Jak's T-pose rip.

All maths in FFXIV model space (metres, Y up, +Z forward, +X = character's left). The rip uses the
same axes in its own units; J space is the rip scaled by S (rip units -> metres).
A pose is a dict bone -> 4x4 "delta" matrix taking bind-pose world space to posed (J) space;
skinning a bind-pose vertex is sum(w_b * D_b @ v). The deltas here are affine, not rigid: limbs are
stretched along the bone so each FFXIV joint lands on Jak's, the head and feet are scaled.
"""
import json
import math
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 0.025  # metres per rip unit (makes his torso, shoulder to hip, FFXIV-sized)

# Jak's joints in rip units, measured from the mesh (tools/analyze_src.py); left side, the right mirrors x.
JAK = {
    "hip": (4.0, 23.0, -0.3),        # just above the crotch
    "knee": (4.6, 15.3, -1.0),       # centre of the knee pad
    "ankle": (4.6, 4.0, -1.6),       # top of the shoe
    "shoulder": (7.0, 41.8, -1.5),
    "elbow": (17.0, 41.6, -1.6),     # under the elbow guard
    "wrist": (27.0, 40.9, -1.7),     # where the glove cuff meets the fist
    "neck": (0.0, 45.0, -1.0),
    "head": (0.0, 48.5, 2.4),        # mouth level: his neck keeps its length on the FFXIV neck bone
}
HEAD_SCALE = 0.72   # Jak's head ends up this size relative to his S-scaled rip (1.0 = full cartoon head)
FOOT_SCALE = 0.85   # his boots' length and width, same idea (height is kept so the soles stay on the floor)
THICK = {"arm": 1.0, "leg": 1.0, "neck": 1.0}  # across-the-bone scale of the posed FFXIV limbs


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


def bone_affine(f0, f1, j0, j1, thick=1.0):
    """4x4 taking segment f0->f1 onto j0->j1: stretched to length along the bone, `thick` across it."""
    u = (f1 - f0) / np.linalg.norm(f1 - f0)
    along = np.linalg.norm(j1 - j0) / np.linalg.norm(f1 - f0)
    A = rot_between(f1 - f0, j1 - j0) @ (thick * np.eye(3) + (along - thick) * np.outer(u, u))
    M = np.eye(4)
    M[:3, :3] = A
    M[:3, 3] = j0 - A @ f0
    return M


def scaled_about(A, pivot_from, pivot_to):
    M = np.eye(4)
    M[:3, :3] = A
    M[:3, 3] = pivot_to - A @ pivot_from
    return M


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


def jak_joints():
    """Jak's joints in J space (metres), both sides."""
    out = {}
    for k, v in JAK.items():
        p = np.array(v, float) * S
        if k in ("neck", "head"):
            out[k] = p
        else:
            out[k + "_l"] = p
            out[k + "_r"] = p * [-1, 1, 1]
    return out


def torso_affine(P, J):
    """Torso: one scale + offset taking the FFXIV hip and shoulder heights and widths onto Jak's."""
    f_hip = (P.pos("j_asi_a_l") + P.pos("j_asi_a_r")) / 2
    f_sh = (P.pos("j_ude_a_l") + P.pos("j_ude_a_r")) / 2
    j_hip = (J["hip_l"] + J["hip_r"]) / 2
    j_sh = (J["shoulder_l"] + J["shoulder_r"]) / 2
    sy = (j_sh[1] - j_hip[1]) / (f_sh[1] - f_hip[1])
    sx = 0.5 * (J["shoulder_l"][0] / P.pos("j_ude_a_l")[0] + J["hip_l"][0] / P.pos("j_asi_a_l")[0])
    A = np.diag([sx, sy, 1.0])
    return scaled_about(A, f_hip, j_hip)


def jak_pose(names, parent, world):
    """Deltas taking the FFXIV bind pose onto Jak's T-pose rip (J space)."""
    P = Pose(names, parent, world)
    J = jak_joints()
    P.set("n_root", torso_affine(P, J))
    # neck and head: the head is rigid, scaled so Jak's (big) head comes out HEAD_SCALE of its rip size
    P.set("j_kubi", bone_affine(P.pos("j_kubi"), P.pos("j_kao"), J["neck"], J["head"], THICK["neck"]))
    P.set("j_kao", scaled_about(np.eye(3) / HEAD_SCALE, P.pos("j_kao"), J["head"]))
    for s in "lr":
        sh, el, wr = P.pos(f"j_ude_a_{s}"), P.pos(f"j_ude_b_{s}"), P.pos(f"j_te_{s}")
        P.set(f"j_ude_a_{s}", bone_affine(sh, el, J[f"shoulder_{s}"], J[f"elbow_{s}"], THICK["arm"]))
        P.set(f"j_ude_b_{s}", bone_affine(el, wr, J[f"elbow_{s}"], J[f"wrist_{s}"], THICK["arm"]))
        # hand (Jak's fist): turned like the forearm, unscaled
        R = rot_between(wr - el, J[f"wrist_{s}"] - J[f"elbow_{s}"])
        P.set(f"j_te_{s}", rot_about(R, wr, J[f"wrist_{s}"]))
        hip, kb, kc, ank = (P.pos(f"j_asi_{x}_{s}") for x in "abcd")
        half = (kb - kc) / 2
        jb, jc = J[f"knee_{s}"] + half, J[f"knee_{s}"] - half
        P.set(f"j_asi_a_{s}", bone_affine(hip, kb, J[f"hip_{s}"], jb, THICK["leg"]))
        P.set(f"j_asi_b_{s}", bone_affine(kb, kc, jb, jc, THICK["leg"]))
        P.set(f"j_asi_c_{s}", bone_affine(kc, ank, jc, J[f"ankle_{s}"], THICK["leg"]))
        # foot: Jak's boots are big; length and width scaled, height kept
        P.set(f"j_asi_d_{s}", scaled_about(np.diag([1 / FOOT_SCALE, 1.0, 1 / FOOT_SCALE]), ank, J[f"ankle_{s}"]))
    return P, P.deltas()


def skin(pos, bones, weights, deltas, inverse=False):
    """Linear blend skinning. bones: (N,K) names ('' unused); weights (N,K). Returns positions and the
    blended linear part (N,3,3) for transforming normals."""
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
