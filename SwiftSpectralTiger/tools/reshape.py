"""Fit the WoW Swift Spectral Tiger mesh onto the FFXIV tiger skeleton (m0464).

Each weighted WoW bone gets a transform that carries its joint onto the matching FFXIV
joint and turns/stretches its segment onto the matching FFXIV segment. Girth is scaled by
one global factor, so long FFXIV segments (the tail) stretch the mesh instead of fattening
it. Vertices are moved with the WoW skin weights (linear blend), which puts the mesh into
the FFXIV tiger's bind pose.
"""
import numpy as np

from wowsrc import WowModel
from xiv_skeleton import Skeleton

SKEL = "../work/game/chara/monster/m0464/skeleton/base/b0001/skl_m0464b0001.sklb"
GIRTH = 1.7  # WoW -> FFXIV size ratio across the body

# WoW joint -> FFXIV joint its position should land on (None: use the joint named in RIGID/SAME)
TARGET = {
    9: "j_hip", 5: "j_spine_b", 3: "j_neck_a", 8: "j_head",
    17: "j_tail_a", 22: "j_tail_b", 27: "j_tail_c", 30: "j_tail_d",
    18: "j_leg_a_l", 23: "j_leg_b_l", 28: "j_leg_c_l", 31: "j_foot_l",
    19: "j_leg_a_r", 24: "j_leg_b_r", 29: "j_leg_c_r", 32: "j_foot_r",
    6: "j_arm_a_l", 10: "j_arm_c_l", 20: "j_handend_l",
    7: "j_arm_a_r", 11: "j_arm_c_r", 21: "j_handend_r",
}
# segment end used to aim each bone (WoW child joint); bones not listed are leaves
CHILD = {9: 5, 5: 3, 3: 8, 17: 22, 22: 27, 27: 30,
         18: 23, 23: 28, 28: 31, 19: 24, 24: 29, 29: 32,
         6: 10, 10: 20, 7: 11, 11: 21}
# leaves that keep the WoW orientation and only scale by GIRTH (head, paws)
RIGID = {8, 20, 21, 31, 32}
# leaf with the parent's rotation/stretch (tail tip)
FOLLOW = {30: 27}
# bones that move exactly like another bone
SAME = {1: 3, 2: 3, 4: 5, 12: 8, 13: 8, 14: 8, 15: 8, 16: 8, 25: 20, 26: 21, 33: 31, 34: 32}


def rotation_between(a, b):
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if np.linalg.norm(v) < 1e-9:
        return np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx * (1 / (1 + c))


def bone_transforms(wow: WowModel, skel: Skeleton):
    """{wow joint: (M 3x3, src point, dst point)}: x' = dst + M (x - src)."""
    P = wow.joint_pos
    out = {}
    for k, tgt in TARGET.items():
        dst = skel.pos(tgt)
        if k in CHILD:
            c = CHILD[k]
            dw = P[c] - P[k]
            df = skel.pos(TARGET[c]) - dst
            u = dw / np.linalg.norm(dw)
            A = GIRTH * np.eye(3) + (np.linalg.norm(df) / np.linalg.norm(dw) - GIRTH) * np.outer(u, u)
            out[k] = (rotation_between(dw, df) @ A, P[k], dst)
        elif k in RIGID:
            out[k] = (GIRTH * np.eye(3), P[k], dst)
    for k, p in FOLLOW.items():
        out[k] = (out[p][0], P[k], skel.pos(TARGET[k]))
    for k, s in SAME.items():
        out[k] = out[s]
    return out


SEAT_DROP = 0.15  # metres the top of the back comes down around the rider


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def lower_seat(p):
    """The WoW saddle sits higher above the spine than the FFXIV tiger's back, which would sink the
    rider (attached at n_mount, ~2.23 m) into it. Pull the top of the back down around the saddle,
    fading out towards the shoulders, hips and belly."""
    along = 1 - smoothstep(0.5, 0.95, np.abs(p[:, 2] + 0.05))
    up = smoothstep(1.55, 2.05, p[:, 1])
    out = p.copy()
    out[:, 1] -= SEAT_DROP * along * up
    return out


def reshape(wow: WowModel, skel: Skeleton):
    T = bone_transforms(wow, skel)
    result = []
    for m in wow.meshes:
        pos, nrm, J, W = m["positions"], m["normals"], m["joints"], m["weights"]
        newp = np.zeros_like(pos)
        newn = np.zeros_like(nrm)
        for slot in range(4):
            for k in np.unique(J[:, slot]):
                sel = (J[:, slot] == k) & (W[:, slot] > 0)
                if not sel.any():
                    continue
                if k not in T:
                    raise KeyError(f"WoW joint {k} ({wow.names[k]}) has weights but no transform")
                M, src, dst = T[k]
                w = W[sel, slot][:, None]
                newp[sel] += w * (dst + (pos[sel] - src) @ M.T)
                newn[sel] += w * (nrm[sel] @ np.linalg.inv(M))  # inverse transpose of M
        wsum = W.sum(1, keepdims=True)
        newp /= np.maximum(wsum, 1e-9)
        newn /= np.maximum(np.linalg.norm(newn, axis=1, keepdims=True), 1e-9)
        result.append({**m, "positions": lower_seat(newp), "normals": newn})
    return result


if __name__ == "__main__":
    wow = WowModel()
    skel = Skeleton(SKEL)
    meshes = reshape(wow, skel)
    allp = np.concatenate([m["positions"][np.unique(m["indices"])] for m in meshes])
    print("reshaped bbox", allp.min(0).round(3), allp.max(0).round(3))
