"""The wow.export glTF of the dragonhawk, converted to FFXIV space.

wow.export writes every M2 bone as a pivot node (static translation from the parent
pivot) with an animated joint node under it, and inverse bind matrices that are just
T(-pivot). A bone's local transform in FFXIV terms is therefore
    t = pivot - parent pivot + anim translation,  r = anim rotation,  s = anim scale.

FFXIV is Y-up and faces +Z; the WoW model is Y-up and faces +X, so C rotates -90
degrees about Y: (x, y, z) -> (-z, y, x). SCALE shrinks it to FFXIV mount size.
"""
from pathlib import Path

import numpy as np

from inspect_src import Gltf

SCALE = 0.65
C = np.array([[0, 0, -1], [0, 1, 0], [1, 0, 0]], float)   # glTF -> FFXIV
Q_C = np.array([0, -np.sqrt(0.5), 0, np.sqrt(0.5)])          # same rotation as a quaternion (xyzw)
FPS = 30


def qmul(a, b):
    ax, ay, az, aw = np.moveaxis(a, -1, 0)
    bx, by, bz, bw = np.moveaxis(b, -1, 0)
    return np.stack([aw * bx + ax * bw + ay * bz - az * by,
                     aw * by - ax * bz + ay * bw + az * bx,
                     aw * bz + ax * by - ay * bx + az * bw,
                     aw * bw - ax * bx - ay * by - az * bz], -1)


def qconj(q):
    return q * np.array([-1, -1, -1, 1])


def qrot(q, v):
    """Rotate vectors v (...,3) by quaternions q (...,4)."""
    u = q[..., :3]
    w = q[..., 3:]
    t = 2 * np.cross(u, v)
    return v + w * t + np.cross(u, t)


def qmat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def slerp(q0, q1, t):
    d = np.sum(q0 * q1, -1, keepdims=True)
    q1 = np.where(d < 0, -q1, q1)
    d = np.abs(d)
    lin = d > 0.9995
    th = np.arccos(np.clip(d, -1, 1))
    s = np.sin(th)
    s = np.where(lin, 1, s)
    a = np.where(lin, 1 - t, np.sin((1 - t) * th) / s)
    b = np.where(lin, t, np.sin(t * th) / s)
    q = a * q0 + b * q1
    return q / np.linalg.norm(q, axis=-1, keepdims=True)


def to_xiv_vec(v):
    return np.asarray(v) @ C.T


def to_xiv_quat(q):
    return qmul(qmul(np.broadcast_to(Q_C, np.shape(q)), q), qconj(np.broadcast_to(Q_C, np.shape(q))))


def to_xiv_scale(s):
    s = np.asarray(s)
    return s[..., [2, 1, 0]]


class Source:
    def __init__(self, path=None):
        self.g = Gltf(path) if path else Gltf()
        j = self.g.j
        skin = j["skins"][0]
        self.joint_nodes = skin["joints"]
        self.node_parent = {}
        for ni, n in enumerate(j["nodes"]):
            for c in n.get("children", []):
                self.node_parent[c] = ni
        jidx = {n: i for i, n in enumerate(self.joint_nodes)}
        self.names = [j["nodes"][n]["name"] for n in self.joint_nodes]
        self.parent = []
        self.pivot_rel = []
        for k, n in enumerate(self.joint_nodes):
            pnode = self.node_parent[n]                       # bone_X_p
            self.pivot_rel.append(np.array(j["nodes"][pnode].get("translation", [0, 0, 0]), float))
            q = self.node_parent.get(pnode)
            self.parent.append(jidx[q] if q in jidx else -1)
        self.pivot_rel = np.array(self.pivot_rel)
        ibm = self.g.accessor(skin["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
        self.pivot = np.array([np.linalg.inv(m)[:3, 3] for m in ibm])
        self.anim_names = [a["name"] for a in j.get("animations", [])]

    def anim_index(self, name):
        for i, n in enumerate(self.anim_names):
            if n.startswith(name):
                return i
        raise KeyError(name)

    def duration(self, ai):
        a = self.g.j["animations"][ai]
        return max(self.g.j["accessors"][s["input"]]["max"][0] for s in a["samplers"])

    def sample(self, ai, times):
        """Local (pivot-relative) joint TRS for every joint at the given times, glTF space.
        Returns t (F,J,3), r (F,J,4 xyzw), s (F,J,3)."""
        F, J = len(times), len(self.joint_nodes)
        t = np.zeros((F, J, 3))
        r = np.zeros((F, J, 4))
        r[..., 3] = 1
        s = np.ones((F, J, 3))
        jidx = {n: i for i, n in enumerate(self.joint_nodes)}
        a = self.g.j["animations"][ai]
        for ch in a["channels"]:
            node = ch["target"]["node"]
            if node not in jidx:
                continue
            k = jidx[node]
            smp = a["samplers"][ch["sampler"]]
            inp = self.g.accessor(smp["input"]).ravel().astype(float)
            out = self.g.accessor(smp["output"]).astype(float)
            path = ch["target"]["path"]
            interp = smp.get("interpolation", "LINEAR")
            if interp == "CUBICSPLINE":
                out = out[1::3]
            vals = _interp(inp, out, np.asarray(times, float), interp, path == "rotation")
            {"translation": t, "rotation": r, "scale": s}[path][:, k] = vals
        return t, r, s


def _interp(inp, out, times, interp, is_rot):
    if len(inp) == 1:
        return np.repeat(out[:1], len(times), 0)
    times = np.clip(times, inp[0], inp[-1])
    i = np.clip(np.searchsorted(inp, times, side="right") - 1, 0, len(inp) - 2)
    if interp == "STEP":
        return out[i]
    span = inp[i + 1] - inp[i]
    f = np.where(span > 0, (times - inp[i]) / np.where(span > 0, span, 1), 0)[:, None]
    if is_rot:
        q0 = out[i] / np.linalg.norm(out[i], axis=-1, keepdims=True)
        q1 = out[i + 1] / np.linalg.norm(out[i + 1], axis=-1, keepdims=True)
        return slerp(q0, q1, f)
    return out[i] * (1 - f) + out[i + 1] * f


def fk(parent, t, r, s):
    """Havok-style forward kinematics on qs transforms. t (F,B,3) r (F,B,4) s (F,B,3).
    Returns world t, r, s with the same shapes."""
    wt, wr, ws = np.zeros_like(t), np.zeros_like(r), np.zeros_like(s)
    for b, p in enumerate(parent):
        if p < 0:
            wt[:, b], wr[:, b], ws[:, b] = t[:, b], r[:, b], s[:, b]
        else:
            wt[:, b] = wt[:, p] + qrot(wr[:, p], ws[:, p] * t[:, b])
            wr[:, b] = qmul(wr[:, p], r[:, b])
            ws[:, b] = ws[:, p] * s[:, b]
    return wt, wr, ws


ROOT = Path(__file__).resolve().parents[1]
