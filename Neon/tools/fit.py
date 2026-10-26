"""Fit Neon (Valorant, Kingdom Archives viewer glb) onto an FFXIV race skeleton.

Positions are retargeted through Neon's own skeleton (bind pose):
  * one uniform scale (geometric mean of the leg, torso and arm length ratios), hips on the FFXIV hips
  * torso: a height lattice through her ankles, knees, hips, shoulders and neck; width scaled toward the FFXIV
    hips and, by `shoulder` (0 = onto the FFXIV joints, 1 = her own breadth), toward the FFXIV shoulders
  * limbs: one affine per bone, parents first, rotated onto the FFXIV bone and stretched to its length
  * hands: rotated so the knuckles line up with the FFXIV fingers, scaled so her middle knuckle meets theirs
  * fingers: rigid, each based on the FFXIV knuckle and aimed along the FFXIV finger; weight split between j_*_a and
    j_*_b where the FFXIV finger bends (FINGER_BLEND)
  * sneakers: rigid (scaled by `foot`), sole on the floor under the FFXIV ankle, toes turned to point forward
  * head: rigid, scaled by `head`, her eyes `eye_dz` in front of the FFXIV eyes; the neck stretches to meet it
Weights (her own, renamed onto FFXIV bones):
  * every joint goes to its nearest mapped ancestor: twist and sleeve joints to their limb, shirt flaps, chest
    plates, backpack, belt and hip pouch to the spine, face and hair joints to the head
  * her pelvis and spine weight is spread over the FFXIV spine by height; arm weight is shared with the FFXIV twist
    helpers (n_hkata, n_hhiji, n_hte) the way the vanilla body shares it
  * hair: the head, handing over to the neck below the jaw

python -P -E tools/fit.py [race ...]   ->  work/fit/<race>.pkl
  {"parts": {name: dict(pos, nrm, uv (v up), faces, vid, bones (N,4), weights (N,4), texset, slot)}, "joints": {...}}
"""
import math
import os
import pickle
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pbd  # noqa: E402
import rig  # noqa: E402
import srcdata as sd  # noqa: E402
import xivdata as xd  # noqa: E402
from islands import components  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

ROOT = rig.ROOT
SIDES = ("l", "r")
# Per race: shoulder breadth kept (0..1), head scale (on top of the body scale), sneaker scale, how far her eyes sit in
# front of (eye_dz) / above (eye_dy) the FFXIV eyes, or her skull centre from theirs (align="centre").
PROFILES = {
    "c0201": dict(shoulder=0.4, head=1.0, foot=0.9, eye_dz=0.012, eye_dy=0.0),
    "c0101": dict(shoulder=0.6, head=1.0, foot=0.95, eye_dz=0.012, eye_dy=0.0),
    "c0901": dict(shoulder=0.6, head=1.1, foot=0.85, eye_dz=0.025, eye_dy=0.0),
    "c1101": dict(shoulder=0.6, head=2.25, foot=0.7, eye_dz=0.02, eye_dy=0.0, align="centre"),
}
BODY_MAT, HAIR_MAT, EYE_MAT = "CS_Sprinter_S0_MI", "CS_Sprinter_S0_Hair_MI", "TP_Core_Eye_MI"
TEXSET = {BODY_MAT: "body", HAIR_MAT: "hair", EYE_MAT: "eye"}     # material -> texture set
HAIR_SETS = ("hair",)
FINGERS = {"Thumb": "oya", "Index": "hito", "Middle": "naka", "Ring": "kusu", "Pinky": "ko"}
# Her fingers have three joints and sat off FFXIV's two-bone fingers: in 1.0.x they bent where her joints were, and in
# GS the game's idle curl folded them back into the palm. Each finger (Thumb1-3, Index1-3, ...) is now its own rigid
# segment with its base on the FFXIV knuckle (j_*_a), aimed along the FFXIV finger, and its weight splits between
# j_*_a and j_*_b by position along the FFXIV finger (as in the Gekko and Mantis ports).
FINGER_BLEND = 0.006            # m either side of j_*_b where a finger's weight hands over from j_*_a
# Her eyes sit on the FFXIV eyes, and her skull is shallower front to back than theirs, so in GS (1.0.x) the back of
# the wearer's own head showed through her hair between the buns. cover_skull (after Gekko's cover_neck) pushes the
# back and sides of her head and hair out until they clear every player face of the races that wear each fit,
# through the racial deformer.
COVER_RACES = {"c0201": ("c0201", "c0401", "c0601", "c0801", "c1001", "c1401", "c1601", "c1801"),
               "c0101": ("c0101", "c0301", "c0501", "c0701", "c1301", "c1701"),
               "c0901": ("c0901", "c1501"),
               "c1101": ("c1101", "c1201")}
COVER_FACES = [f"f{i:04d}" for i in list(range(1, 9)) + list(range(101, 109))]     # player faces (f02xx are NPCs')
HIDDEN_EARS = {"atr_mim", "atr_top", "atr_hrn"}          # the headset's EQP (the Moogle Head's) hides these
SKULL_MARGIN = 0.005            # m her head keeps outside the wearer's (3 mm left a speck at her parting in GS)
SKULL_CAP = 0.02                # m at most
SKULL_FAR = 0.15                # m from the head centre: face points further out are manes and fangs, not skull
SKULL_FRONT = 55                # deg either side of straight ahead left alone: her face covers the wearer's
SKULL_LOW = -30                 # deg below the head centre left alone: jaw, neck and collar
SKULL_RAMP = 15                 # deg over which the push fades in from those edges
SKULL_BIN = 3.75                # deg per cell round and up (7.5 let a bun hide the parting between the buns)
LIMBS = {"Clavicle": "shoulder", "Shoulder": "upper_arm", "Elbow": "forearm", "Hand": "hand", "Hip": "thigh",
         "Knee": "shin", "Foot": "foot"}
FFX_LIMBS = {"Clavicle": "j_sako", "Shoulder": "j_ude_a", "Elbow": "j_ude_b", "Hand": "j_te", "Hip": "j_asi_a",
             "Knee": "j_asi_c", "Foot": "j_asi_d", "Toe": "j_asi_e"}


def J(side, part):
    """Neon's joint name for a side ("l"/"r") and part, e.g. J("l", "Hip") -> "L_Hip"."""
    return f"{side.upper()}_{part}"


# ----------------------------------------------------------------------------- joint maps

def _ancestors(j, B):
    while j is not None:
        yield j
        j = B[j]["parent"] if j in B else None


def segment_of(j, B):
    """Source joint -> the retarget segment that moves it (None: the torso lattice)."""
    for a in _ancestors(j, B):
        if a == "Head":
            return "head"
        if a == "Neck":
            return "neck"
        m = re.fullmatch(r"([LR])_(Thumb|Index|Middle|Ring|Pinky)[1-3]", a)
        if m:
            return f"{m.group(2).lower()}.{m.group(1).lower()}"
        m = re.fullmatch(r"([LR])_(Clavicle|Shoulder|Elbow|Hand|Hip|Knee|Foot)", a)
        if m:
            return f"{LIMBS[m.group(2)]}.{m.group(1).lower()}"
    return None


def ffxiv_of(j, B):
    """Source joint -> FFXIV bone, "torso" (spread over the spine by height) or "finger:<ffxiv finger>:<side>" (split
    along the FFXIV finger)."""
    for a in _ancestors(j, B):
        if a in ("Pelvis", "Spine1", "Spine2", "Spine3", "Spine4", "Splitter", "Root", "Skeleton"):
            return "torso"
        if a == "Neck":
            return "j_kubi"
        if a == "Head":
            return "j_kao"
        m = re.fullmatch(r"([LR])_(Thumb|Index|Middle|Ring|Pinky)([0-3])", a)
        if m:
            s, f, k = m.groups()
            if k == "0":                                    # metacarpal: the palm
                return f"j_te_{s.lower()}"
            return f"finger:{FINGERS[f]}:{s.lower()}"
        m = re.fullmatch(r"([LR])_(Clavicle|Shoulder|Elbow|Hand|Hip|Knee|Foot|Toe)", a)
        if m:
            return f"{FFX_LIMBS[m.group(2)]}_{m.group(1).lower()}"
    raise KeyError(j)


# ----------------------------------------------------------------------------- retarget

def affine(lin, src_point, dst_point):
    m = np.eye(4)
    m[:3, :3] = lin
    m[:3, 3] = dst_point - lin @ src_point
    return m


def yaw_between(a, b):
    """Rotation about +Y turning the horizontal part of a onto that of b."""
    ang = math.atan2(b[0], b[2]) - math.atan2(a[0], a[2])
    return rig.axis_angle([0, 1, 0], ang)


class Retarget:
    """Moves points from Neon's bind pose into an FFXIV race's bind pose."""

    def __init__(self, race, prof):
        self.B = B = sd.bones()
        names, parent, world = rig.load_skeleton(f"skeleton_{race}")
        F = {n: world[n][:3, 3].copy() for n in names}
        for s in SIDES:
            F[f"knee_{s}"] = (F[f"j_asi_b_{s}"] + F[f"j_asi_c_{s}"]) / 2
        self.F, self.prof, self.race = F, prof, race
        H0 = {n: b["head"] for n, b in B.items()}

        def dist(a, b):
            return float(np.linalg.norm(a - b))

        leg = (dist(F["j_asi_a_l"], F["knee_l"]) + dist(F["knee_l"], F["j_asi_d_l"])) / \
              (dist(H0["L_Hip"], H0["L_Knee"]) + dist(H0["L_Knee"], H0["L_Foot"]))
        torso = (F["j_kubi"][1] - F["j_asi_a_l"][1]) / (H0["Neck"][1] - H0["L_Hip"][1])
        arm = (dist(F["j_ude_a_l"], F["j_ude_b_l"]) + dist(F["j_ude_b_l"], F["j_te_l"])) / \
              (dist(H0["L_Shoulder"], H0["L_Elbow"]) + dist(H0["L_Elbow"], H0["L_Hand"]))
        self.scale = s = float(np.exp(np.mean(np.log([leg, torso, arm]))))
        print(f"  size ratios FFXIV/Neon: legs {leg:.3f} torso {torso:.3f} arms {arm:.3f} -> scale {s:.3f}")
        hip_m = (H0["L_Hip"] + H0["R_Hip"]) / 2
        hip_f = (F["j_asi_a_l"] + F["j_asi_a_r"]) / 2
        self.t = hip_f - s * hip_m
        H = {n: s * p + self.t for n, p in H0.items()}
        self.H = H
        floor = self.t[1]

        # sneakers: uniform scale about her ankle, sole on the floor, ankle over the FFXIV ankle
        kf = prof["foot"]
        A = {}
        for sd_ in SIDES:
            a = F[f"j_asi_d_{sd_}"].copy()
            a[1] = kf * (H[J(sd_, "Foot")][1] - floor)
            A[sd_] = a
        self.ankle = A

        knots = [("L_Foot", A["l"]), ("L_Knee", F["knee_l"]), ("L_Hip", F["j_asi_a_l"]),
                 ("L_Shoulder", F["j_ude_a_l"]), ("Neck", F["j_kubi"])]
        self.ky = np.array([H[a][1] for a, _ in knots])
        self.fy = np.array([f[1] for _, f in knots])
        assert np.all(np.diff(self.ky) > 0) and np.all(np.diff(self.fy) > 0)
        sh = F["j_ude_a_l"][0] / H["L_Shoulder"][0]
        sh = sh + prof["shoulder"] * (1 - sh)
        self.sx_y = np.array([H["L_Hip"][1], H["L_Shoulder"][1]])
        self.sx_v = np.array([F["j_asi_a_l"][0] / H["L_Hip"][0], sh])
        self.dz = np.array([f[2] - H[a][2] for a, f in knots])
        print("  lattice y", np.round(self.ky, 3), "->", np.round(self.fy, 3), " width", np.round(self.sx_v, 3),
              " dz", np.round(self.dz, 3))

        # head: uniform scale about the head joint, her eyes onto the FFXIV eyes (Lalafell: skull centre onto skull
        # centre); the neck stretches to meet it
        kh = prof["head"]
        if prof.get("align") == "centre":
            eyes_m = self.src_skull_centre() * s + self.t
            eyes_f = self.ffxiv_face_centre(race)
        else:
            eyes_m = self.src_eyes() * s + self.t
            eyes_f = self.ffxiv_eyes(race)
        eyes_f = eyes_f + np.array([0, prof.get("eye_dy", 0.0), prof["eye_dz"]])
        head_base = eyes_f - kh * (eyes_m - H["Head"])
        self.head_base = head_base
        print(f"  eyes: Neon {np.round(eyes_m, 3)} -> FFXIV {np.round(eyes_f, 3)}; head joint "
              f"{np.round(H['Head'], 3)} -> {np.round(head_base, 3)} (j_kao {np.round(F['j_kao'], 3)})")

        # segment -> (joint, child joint or None, FFXIV start, FFXIV target, kind, twist)
        D = {"neck": ("Neck", "Head", F["j_kubi"], head_base, "stretch", None),
             "head": ("Head", None, head_base, head_base, "head", None)}
        for sd_ in SIDES:
            def j(part):
                return J(sd_, part)
            D.update({
                f"shoulder.{sd_}": (j("Clavicle"), j("Shoulder"), F[f"j_sako_{sd_}"], F[f"j_ude_a_{sd_}"], "stretch",
                                    None),
                f"upper_arm.{sd_}": (j("Shoulder"), j("Elbow"), F[f"j_ude_a_{sd_}"], F[f"j_ude_b_{sd_}"], "stretch",
                                     None),
                f"forearm.{sd_}": (j("Elbow"), j("Hand"), F[f"j_ude_b_{sd_}"], F[f"j_te_{sd_}"], "stretch", None),
                f"hand.{sd_}": (j("Hand"), j("Middle1"), F[f"j_te_{sd_}"], F[f"j_naka_a_{sd_}"], "hand",
                                ((j("Index1"), j("Pinky1")), (F[f"j_hito_a_{sd_}"], F[f"j_ko_a_{sd_}"]))),
                f"thigh.{sd_}": (j("Hip"), j("Knee"), F[f"j_asi_a_{sd_}"], F[f"knee_{sd_}"], "stretch", None),
                f"shin.{sd_}": (j("Knee"), j("Foot"), F[f"knee_{sd_}"], A[sd_], "stretch", None),
                f"foot.{sd_}": (j("Foot"), j("Toe"), A[sd_], F[f"j_asi_e_{sd_}"], "place", None),
            })
            for f, ff in FINGERS.items():
                D[f"{f.lower()}.{sd_}"] = (j(f"{f}1"), j(f"{f}2"), F[f"j_{ff}_a_{sd_}"], F[f"j_{ff}_b_{sd_}"], "finger",
                                           None)
        parent_seg = {"head": "neck", "neck": None}
        for sd_ in SIDES:
            parent_seg.update({f"shoulder.{sd_}": None, f"upper_arm.{sd_}": f"shoulder.{sd_}",
                               f"forearm.{sd_}": f"upper_arm.{sd_}", f"hand.{sd_}": f"forearm.{sd_}",
                               f"thigh.{sd_}": None, f"shin.{sd_}": f"thigh.{sd_}", f"foot.{sd_}": f"shin.{sd_}"})
            parent_seg.update({f"{f.lower()}.{sd_}": f"hand.{sd_}" for f in FINGERS})
        order = ["neck", "head"] + [f"{seg}.{sd_}" for sd_ in SIDES for seg in
                                    ("shoulder", "upper_arm", "forearm", "hand", "thigh", "shin", "foot")]
        order += [f"{f.lower()}.{sd_}" for sd_ in SIDES for f in FINGERS]
        M = {}
        knuckles = {}
        for seg in order:
            b, child, f0, f1, kind, twist = D[seg]
            p = parent_seg[seg]
            anchor = self.field_point(H[b]) if p is None else (M[p] @ np.append(H[b], 1))[:3]
            if kind == "head":
                M[seg] = affine(np.eye(3) * kh, H[b], head_base)
                continue
            if kind == "place":
                # toes turned to point where the FFXIV toes point (about the vertical only), heel kept as modelled
                Ry = yaw_between(H[child] - H[b], f1 - f0)
                M[seg] = affine(Ry * kf, H[b], f0)
                print(f"  {seg:12s} turned {math.degrees(math.acos(np.clip(Ry[0, 0], -1, 1))):5.1f} deg about Y")
                continue
            if kind == "finger":
                # her finger as it is, carried on from the hand's turn and scale, its base on the FFXIV knuckle and
                # aimed along the FFXIV finger
                Lp = M[p][:3, :3]
                M[seg] = affine(rig.rot_between(Lp @ (H[child] - H[b]), f1 - f0) @ Lp, H[b], f0)
                if seg.endswith(".l"):
                    knuckles[seg[:-2]] = np.linalg.norm(f0 - anchor)
                continue
            d_s = H[child] - H[b]
            d_f = f1 - anchor if kind == "stretch" else f1 - f0
            if seg == "neck" and np.linalg.norm(d_f) < 0.5 * np.linalg.norm(d_s):
                # a big head (Lalafell) sits almost on the shoulders: squash the neck straight down, don't swing it
                d_f = d_s / np.linalg.norm(d_s) * max(np.linalg.norm(d_f), 0.25 * np.linalg.norm(d_s))
            R = rig.rot_between(d_s, d_f)
            if twist:
                (ga, gb), (fa, fb) = twist
                u = R @ (H[gb] - H[ga])
                w = fb - fa
                ax = d_f / np.linalg.norm(d_f)
                u -= ax * np.dot(u, ax)
                w -= ax * np.dot(w, ax)
                R = rig.axis_angle(ax, math.atan2(np.dot(np.cross(u, w), ax), np.dot(u, w))) @ R
            k = np.linalg.norm(d_f) / np.linalg.norm(d_s)
            if kind == "hand":
                # uniform: the hand keeps its shape, the middle knuckle lands on the FFXIV one
                lin = R * float(np.clip(k, 0.85, 1.25))
                M[seg] = affine(lin, H[b], f0)
                print(f"  {seg:12s} scaled x{np.clip(k, 0.85, 1.25):.2f} (wanted x{k:.2f})")
                continue
            u = d_s / np.linalg.norm(d_s)
            lin = R @ (np.eye(3) + (k - 1) * np.outer(u, u))
            M[seg] = affine(lin, H[b], anchor)
            ang = math.degrees(math.acos(np.clip(np.dot(d_s, d_f) / np.linalg.norm(d_s) / np.linalg.norm(d_f), -1, 1)))
            if seg.endswith("l") or seg == "neck":
                print(f"  {seg:12s} turned {ang:5.1f} deg, stretched x{k:.2f}")
        self.M = M
        print("  finger bases moved onto the FFXIV knuckles (left, mm): "
              + ", ".join(f"{k} {d * 1000:.1f}" for k, d in knuckles.items()))

    def src_eyes(self):
        return (self.B["L_Eyeball"]["head"] + self.B["R_Eyeball"]["head"]) / 2

    def src_skull_centre(self):
        m = sd.mesh()
        sel = m["mat"] == m["materials"].index(BODY_MAT)
        p = m["pos"][np.unique(m["faces"][sel])]
        p = p[(p[:, 1] > self.B["Neck"]["head"][1] + 0.05) & (np.abs(p[:, 0]) < 0.12)]
        c = (p.min(0) + p.max(0)) / 2
        c[0] = 0.0
        return c

    def ffxiv_face_centre(self, race):
        m = xd.model(f"chara/human/{race}/obj/face/f0001/model/{race}f0001_fac.mdl")
        me = next(x for x in m["meshes"] if "_fac_" in x["material"])
        keep = np.array([s < 0 or "atr_mim" not in me["sub_attrs"][s] for s in me["tri_sub"]])     # no ears
        p = me["pos"][np.unique(me["faces"][keep])]
        c = (p.min(0) + p.max(0)) / 2
        c[0] = 0.0
        return c

    def ffxiv_eyes(self, race):
        m = xd.model(f"chara/human/{race}/obj/face/f0001/model/{race}f0001_fac.mdl")
        iris = next(me for me in m["meshes"] if "_iri_" in me["material"])
        p = iris["pos"]
        c = (p.min(0) + p.max(0)) / 2
        c[0] = 0.0
        return c

    def field(self, p):
        y = p[:, 1]
        y2 = np.interp(y, self.ky, self.fy)
        lo, hi = y < self.ky[0], y > self.ky[-1]
        y2[lo] = self.fy[0] + (y[lo] - self.ky[0])
        y2[hi] = self.fy[-1] + (y[hi] - self.ky[-1])
        sx = np.interp(y, self.sx_y, self.sx_v)
        return np.stack([p[:, 0] * sx, y2, p[:, 2] + np.interp(y, self.ky, self.dz)], 1), sx

    def field_point(self, p):
        return self.field(p[None, :])[0][0]

    def apply(self, m):
        """Mesh m (source bind pose) -> FFXIV positions and normals, blended by her own skin weights."""
        names = m["joint_names"]
        segs = [segment_of(n, self.B) for n in names]
        P = m["pos"] * self.scale + self.t
        tp, tsx = self.field(P)
        J, W = m["joints"], m["weights"].astype(float)
        out = np.zeros_like(P)
        lin = np.zeros((len(P), 3, 3))
        tot = np.zeros(len(P))
        cache = {}
        for k in range(J.shape[1]):
            for j in np.unique(J[:, k]):
                sel = (J[:, k] == j) & (W[:, k] > 0)
                if not sel.any():
                    continue
                w = W[sel, k]
                sg = segs[j]
                if sg is None:
                    out[sel] += w[:, None] * tp[sel]
                    lin[sel] += w[:, None, None] * np.array([np.diag([sx, 1, 1]) for sx in tsx[sel]])
                else:
                    mm = self.M[sg]
                    out[sel] += w[:, None] * (P[sel] @ mm[:3, :3].T + mm[:3, 3])
                    lin[sel] += w[:, None, None] * mm[:3, :3]
                tot[sel] += w
        none = tot < 1e-6
        out[none] = tp[none]
        lin[none] = np.eye(3)
        tot[none] = 1
        out /= tot[:, None]
        lin /= tot[:, None, None]
        n = np.einsum("nij,nj->ni", np.linalg.inv(lin).transpose(0, 2, 1), m["nrm"])
        del cache
        return out, n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)


# ----------------------------------------------------------------------------- weights

def to_arrays(d_list, k=4):
    B = np.full((len(d_list), k), "", object)
    W = np.zeros((len(d_list), k))
    for i, d in enumerate(d_list):
        top = sorted(((w, b) for b, w in d.items() if w > 1e-3), reverse=True)[:k]
        s = sum(w for w, _ in top)
        for j, (w, b) in enumerate(top):
            B[i, j], W[i, j] = b, w / s
    return B, W


def along(p, a, b):
    ax = b - a
    return (p - a) @ ax / np.dot(ax, ax)


def own_weights(m, pos, F, B):
    """Her weights renamed onto FFXIV bones: torso spread by height, arm weight shared with the twist helpers."""
    chain = [(F["j_kubi"][1] - 0.02, "j_kubi"), (F["j_sebo_c"][1], "j_sebo_c"), (F["j_sebo_b"][1], "j_sebo_b"),
             (F["j_sebo_a"][1], "j_sebo_a"), (F["j_asi_a_l"][1], "j_kosi")]
    hs = np.array([h for h, _ in chain])
    names = [ffxiv_of(n, B) for n in m["joint_names"]]
    J, W = m["joints"], m["weights"]
    out = []
    for i in range(len(pos)):
        d = {}
        torso = 0.0
        for j, w in zip(J[i], W[i]):
            if w <= 0:
                continue
            n = names[j]
            if n == "torso":
                torso += w
            elif n.startswith("finger:"):     # where the FFXIV finger bends, not where hers did
                _, f, side = n.split(":")
                a, bb = F[f"j_{f}_a_{side}"], F[f"j_{f}_b_{side}"]
                ax = (bb - a) / np.linalg.norm(bb - a)
                t = np.clip((np.dot(pos[i] - bb, ax) + FINGER_BLEND) / (2 * FINGER_BLEND), 0, 1)
                t = t * t * (3 - 2 * t)
                d[f"j_{f}_a_{side}"] = d.get(f"j_{f}_a_{side}", 0) + float(w) * (1 - t)
                d[f"j_{f}_b_{side}"] = d.get(f"j_{f}_b_{side}", 0) + float(w) * t
            else:
                d[n] = d.get(n, 0) + float(w)
        if torso > 0:
            y = pos[i, 1]
            if y >= hs[0]:
                d["j_kubi"] = d.get("j_kubi", 0) + torso
            elif y <= hs[-1]:
                d["j_kosi"] = d.get("j_kosi", 0) + torso
            else:
                k = np.nonzero(hs > y)[0][-1]
                t = (hs[k] - y) / (hs[k] - hs[k + 1])
                d[chain[k][1]] = d.get(chain[k][1], 0) + torso * (1 - t)
                d[chain[k + 1][1]] = d.get(chain[k + 1][1], 0) + torso * t
        out.append(d)
    # twist helpers, as on the vanilla body
    for s in SIDES:
        t_up = along(pos, F[f"j_ude_a_{s}"], F[f"j_ude_b_{s}"])
        t_fo = along(pos, F[f"j_ude_b_{s}"], F[f"j_te_{s}"])
        hk = np.interp(t_up, [0.0, 0.25, 0.45, 0.6, 0.75], [0.6, 0.6, 0.45, 0.2, 0.0])
        hj = np.interp(t_up, [0.75, 0.9, 1.0], [0.0, 0.35, 0.25])
        hj = np.where(t_up > 1.0, np.interp(t_fo, [0.0, 0.1, 0.2], [0.25, 0.08, 0.0]), hj)
        ht = np.interp(t_fo, [0.1, 0.3, 0.45, 0.6, 0.85, 1.0], [0.08, 0.15, 0.4, 0.55, 0.8, 0.8])
        for i, d in enumerate(out):
            ua, fa = d.get(f"j_ude_a_{s}", 0), d.get(f"j_ude_b_{s}", 0)
            if ua > 0:
                d[f"n_hkata_{s}"] = ua * hk[i]
                d[f"j_ude_a_{s}"] = ua * (1 - hk[i])
            if fa > 0:
                d[f"n_hte_{s}"] = fa * ht[i]
                d[f"j_ude_b_{s}"] = fa * (1 - ht[i])
            if (ua + fa) > 0 and hj[i] > 0:
                for b in (f"j_ude_a_{s}", f"j_ude_b_{s}"):
                    if b in d:
                        d[f"n_hhiji_{s}"] = d.get(f"n_hhiji_{s}", 0) + d[b] * hj[i]
                        d[b] *= 1 - hj[i]
    return out


def hair_weights(pos, F, head_base):
    """The hair: on the head down to the jaw, then handing over to the neck and the upper back at the shoulders."""
    y = pos[:, 1]
    top = head_base[1] - 0.02
    t = np.clip((top - y) / max(top - F["j_ude_a_l"][1], 1e-3), 0, 1)
    out = []
    for ti in t:
        d = {"j_kao": 1 - 0.7 * ti}
        if ti > 0:
            d["j_kubi"] = 0.45 * ti
            d["j_sebo_c"] = 0.25 * ti
        out.append(d)
    return out


# ----------------------------------------------------------------------------- parts

def wrap_uv(uv, faces):
    """UV islands drawn wholly past u = 1 (the rip tiles its atlases) are moved back into 0..1. Islands that cross
    u = 1 keep their coordinates (the texture repeats)."""
    uv = uv.copy()
    comp = components(faces, len(uv))
    lo = np.full(comp.max() + 1, np.inf)
    np.minimum.at(lo, comp, uv[:, 0])
    uv[:, 0] -= np.floor(lo)[comp]
    return uv


def race_parents(race):
    sk = Skeleton(xd.extract(f"chara/human/{race}/skeleton/base/b0001/skl_{race}b0001.sklb")[0])
    return {n: (sk.names[p] if p >= 0 else None) for n, p in zip(sk.names, sk.parents)}


def surface_points(tri, step=0.002):
    """Points every ~step over triangles (T,3,3)."""
    out = [np.zeros((0, 3))]
    n = np.clip(np.ceil(np.linalg.norm(tri - np.roll(tri, 1, 1), axis=2).max(1) / step).astype(int), 1, 12)
    for k in np.unique(n):
        t = tri[n == k]
        u, v = np.meshgrid(np.arange(k + 1), np.arange(k + 1))
        sel = (u + v) <= k
        a, b = u[sel] / k, v[sel] / k
        out.append((t[:, None, 0] * (1 - a - b)[None, :, None] + t[:, None, 1] * a[None, :, None]
                    + t[:, None, 2] * b[None, :, None]).reshape(-1, 3))
    return np.vstack(out)


def face_surface(race, face, fit_race, D, step=0.002):
    """Points over a vanilla face model's surface (ears and horns left out: the headset hides them, and so are the
    lash, brow and beard cards), taken into the fit race's bind space through the racial deformer. None if the face
    doesn't exist."""
    p = f"chara/human/{race}/obj/face/{face}/model/{race}{face}_fac.mdl"
    if not xd.exists(p):
        return None
    deform = None if race == fit_race else pbd.chain(D, int(race[1:]), int(fit_race[1:]))
    parents = race_parents(race) if deform else None
    out = []
    for me in xd.model(p)["meshes"]:
        if "_etc_" in me["material"]:
            continue
        keep = np.array([s < 0 or not set(me["sub_attrs"][s]) & HIDDEN_EARS for s in me["tri_sub"]], bool)
        if deform is not None:
            # the face's own bones (j_f_*) are in neither the deformer nor the base skeleton, so pbd.deform would
            # leave them in the source race's size and place (Elezen faces came out 20 cm off): they hang off j_kao
            parents.update({b: "j_kao" for b in np.unique(me["bones"]) if b and b not in parents})
        pos = me["pos"] if deform is None else pbd.deform(me["pos"], me["bones"], me["weights"], deform, parents)
        out.append(surface_points(pos[me["faces"][keep]], step))
    return np.vstack(out)


def skull_polar(p, c):
    v = p - c
    r = np.linalg.norm(v, axis=1)
    return np.arctan2(v[:, 0], v[:, 2]), np.arcsin(np.clip(v[:, 1] / np.maximum(r, 1e-9), -1, 1)), r, v


def cover_skull(parts, fit_race):
    """Push the back and sides of her head and hair out radially, about the fit race's head centre, until they clear
    the heads of every face that wears this fit by SKULL_MARGIN (per SKULL_BIN degrees round and up, blurred). Her face
    (SKULL_FRONT either side of ahead) and everything below SKULL_LOW stay put. Head and hair move by the same field, so
    their layers stay stacked."""
    D = pbd.read()
    own = face_surface(fit_race, "f0001", fit_race, D)
    c = (own.min(0) + own.max(0)) / 2
    c[0] = 0.0
    AB = np.radians(np.arange(-180, 180.1, SKULL_BIN))
    EB = np.radians(np.arange(SKULL_LOW - SKULL_RAMP, 90.1, SKULL_BIN))
    front = np.radians(SKULL_FRONT)

    def cells(p):
        az, el, r, _ = skull_polar(p, c)
        sel = el >= EB[0]
        i = np.clip(np.digitize(el[sel], EB) - 1, 0, len(EB) - 2)
        j = np.clip(np.digitize(az[sel], AB) - 1, 0, len(AB) - 2)
        return i, j, r[sel]

    envs = {}
    used = []
    for race in COVER_RACES[fit_race]:
        env = envs[race] = np.zeros((len(EB) - 1, len(AB) - 1))
        for face in COVER_FACES:
            s = face_surface(race, face, fit_race, D)
            if s is not None:
                i, j, r = cells(s[np.linalg.norm(s - c, axis=1) < SKULL_FAR])
                np.maximum.at(env, (i, j), r)
                used.append(f"{race}{face}")
    # her outermost surface per cell: the head and hair that ride j_kao
    shell = np.zeros((len(EB) - 1, len(AB) - 1))
    on_head = {}
    for name in ("body", "hair"):
        p = parts[name]
        on_head[name] = np.where(p["bones"] == "j_kao", p["weights"], 0).sum(1) > 0.5
        i, j, r = cells(surface_points(p["pos"][p["faces"][on_head[name][p["faces"]].all(1)]]))
        np.maximum.at(shell, (i, j), r)
    ec, ac = (EB[:-1] + EB[1:]) / 2, (AB[:-1] + AB[1:]) / 2
    back = (np.abs(ac) > front)[None, :]                # her face's cells never ask for a push
    need = np.zeros_like(shell)
    skipped = {}
    for race, env in envs.items():
        raw = np.where((env > 0) & (shell > 0) & back, env + SKULL_MARGIN - shell, 0)
        mane = raw > SKULL_CAP          # more than a skull's worth: that race's mane or cheek fur keeps showing there
        if mane.any():
            skipped[race] = (int(mane.sum()), float(raw.max()))
        need = np.maximum(need, np.where(mane, 0, raw))
    raw = need.copy()
    # conservative: each cell needs what its neighbours need, then a soft blur round and up the head
    need = np.maximum.reduce([np.roll(np.roll(need, di, 0), dj, 1) for di in (-1, 0, 1) for dj in (-1, 0, 1)])
    k = np.array([1, 2, 1]) / 4
    for _ in range(round(2 * (7.5 / SKULL_BIN) ** 2)):  # the same blur in degrees whatever the cell size
        need = np.apply_along_axis(lambda col: np.convolve(np.r_[col[:1], col, col[-1:]], k, "valid"), 0, need)
        need = (np.roll(need, 1, 1) + 2 * need + np.roll(need, -1, 1)) / 4
    moved = {}
    for name in ("body", "hair"):
        p = parts[name]
        az, el, r, v = skull_polar(p["pos"], c)
        zone = (el >= EB[0]) & (np.abs(az) > front)
        zone &= on_head[name] | (name == "hair")        # her neck and collar stay; all of her hair moves together
        fi = np.clip(np.interp(el[zone], ec, np.arange(len(ec))), 0, len(ec) - 1)
        fj = np.interp(az[zone], ac, np.arange(len(ac)), period=2 * np.pi)
        i0, j0 = np.floor(fi).astype(int), np.floor(fj).astype(int) % len(ac)
        i1, j1 = np.minimum(i0 + 1, len(ec) - 1), (j0 + 1) % len(ac)
        wi, wj = fi - np.floor(fi), fj - np.floor(fj)
        d = (need[i0, j0] * (1 - wi) * (1 - wj) + need[i1, j0] * wi * (1 - wj) + need[i0, j1] * (1 - wi) * wj
             + need[i1, j1] * wi * wj)
        d *= np.clip((np.abs(az[zone]) - front) / np.radians(SKULL_RAMP), 0, 1)
        d *= np.clip((el[zone] - np.radians(SKULL_LOW - SKULL_RAMP)) / np.radians(SKULL_RAMP), 0, 1)
        p["pos"][zone] += v[zone] / np.maximum(r[zone, None], 1e-9) * d[:, None]
        if d.max() > 1e-4:
            moved[name] = (int((d > 1e-4).sum()), float(d.max()))
    print(f"  skull cover: {len(used)} faces of {', '.join(COVER_RACES[fit_race])}; needed up to "
          f"{raw.max() * 1000:.1f} mm; moved "
          + (", ".join(f"{n} {cnt} verts (max {mx * 1000:.1f} mm)" for n, (cnt, mx) in moved.items()) or "nothing")
          + "".join(f"; {r} left showing in {cnt} cells (needs up to {mx * 1000:.0f} mm)"
                    for r, (cnt, mx) in skipped.items()))


def fit_race(race):
    prof = PROFILES[race]
    print(race)
    rt = Retarget(race, prof)
    F = rt.F
    m = sd.mesh()
    pos, nrm = rt.apply(m)
    W = own_weights(m, pos, F, rt.B)
    hairW = hair_weights(pos, F, rt.head_base)
    parts = {}
    for mi, mat in enumerate(m["materials"]):
        texset = TEXSET.get(mat)
        sel = m["mat"] == mi
        if texset is None or not sel.any():
            continue
        f = m["faces"][sel]
        used, remap = np.unique(f, return_inverse=True)
        faces = remap.reshape(-1, 3)
        uv = wrap_uv(m["uv0"][used], faces)
        dl = [hairW[i] for i in used] if texset in HAIR_SETS else [W[i] for i in used]
        Bn, Wt = to_arrays(dl)
        name = texset
        parts[name] = dict(pos=pos[used], nrm=nrm[used], uv=np.c_[uv[:, 0], 1 - uv[:, 1]], uv2=m["uv0"][used],
                           faces=faces, vid=m["vid"][used], bones=Bn, weights=Wt, texset=texset,
                           slot="met" if texset in HAIR_SETS else None)
    cover_skull(parts, race)
    for n, p in sorted(parts.items()):
        print(f"  part {n:10s} {p['texset']:6s} slot {p['slot']}: {len(p['pos']):5d} verts {len(p['faces']):5d} tris, "
              f"y {p['pos'][:, 1].min():.3f}..{p['pos'][:, 1].max():.3f}, bones {len({b for b in p['bones'].ravel() if b})}")
    os.makedirs(os.path.join(ROOT, "work", "fit"), exist_ok=True)
    pickle.dump(dict(parts=parts, joints=F, ankle=rt.ankle, scale=rt.scale),
                open(os.path.join(ROOT, "work", "fit", f"{race}.pkl"), "wb"))
    print("wrote", race)


if __name__ == "__main__":
    for r in (sys.argv[1:] or list(PROFILES)):
        fit_race(r)
