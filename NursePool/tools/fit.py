"""Fit Nurse-Pool (Marvel Rivals, UE5-style skeleton) onto an FFXIV race skeleton.

Positions are retargeted through Deadpool's own skeleton (bind pose):
  * one uniform scale (geometric mean of the leg, torso and arm length ratios), hips on the FFXIV hips
  * torso: a height lattice through his ankles, knees, hips, shoulders and neck; width scaled toward the FFXIV
    hips and, by `shoulder` (0 = onto the FFXIV joints, 1 = his own breadth), toward the FFXIV shoulders
  * limbs: one affine per bone, parents first, rotated onto the FFXIV bone and stretched to its length
  * hands: rotated so the knuckles line up with the FFXIV fingers, scaled so his middle knuckle meets theirs; each
    finger keeps its shape with its base on the FFXIV knuckle (j_*_a), aimed along the FFXIV finger
  * heels: rigid (scaled by `foot`), sole on the floor under the FFXIV ankle, toes turned to point forward
  * head: rigid, scaled by `head`, his eyes `eye_dz` in front of the FFXIV eyes; the neck stretches to meet it
Weights (his own, renamed onto FFXIV bones):
  * every joint goes to its nearest mapped ancestor: twist and corrective ("Fix") joints to their limb (the knee
    volume joints to the FFXIV knee, j_asi_b), belt, collar, stethoscope and back plate to the spine, face joints to
    the head
  * fingers: split between j_*_a and j_*_b by position along the FFXIV finger, blending across j_*_b, so they bend
    where the game's fingers bend
  * his pelvis and spine weight is spread over the FFXIV spine by height; arm weight is shared with the FFXIV twist
    helpers (n_hkata, n_hhiji, n_hte) the way the vanilla body shares it
  * skirt joints: the FFXIV skirt chains (j_sk_f/s/b, physics), by angle round the body and height
  * wig: the head, handing over to the neck and upper back toward the shoulders
Neck: the mask's neck is pushed out radially (at most `neck_cap`) until it covers the neck of every player face that
wears the fit (`cover_neck`, from the PeniParker port).

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
# Per race: shoulder breadth kept (0..1), head scale (on top of the body scale), heel scale, how far his eyes sit in
# front of (eye_dz) / above (eye_dy) the FFXIV eyes, or his skull centre from theirs (align="centre").
PROFILES = {
    "c0101": dict(shoulder=0.5, head=1.0, foot=0.9, eye_dz=0.012, eye_dy=0.0, neck_cap=0.014),
    "c0201": dict(shoulder=0.45, head=0.97, foot=0.85, eye_dz=0.012, eye_dy=0.0),
    "c0901": dict(shoulder=0.45, head=1.12, foot=0.8, eye_dz=0.025, eye_dy=0.0, neck_cap=0.03),
    "c1101": dict(shoulder=0.6, head=2.1, foot=0.7, eye_dz=0.015, eye_dy=0.0, align="centre"),
}
# material -> texture set (None: dropped). Equip_03 is drawn with the Equip_04 textures.
TEXSET = {"MI_1057801_Equip_01": "dress", "MI_1057801_Equip_02": "gear", "MI_1057801_Equip_03": "legs",
          "MI_1057801_Equip_04": "legs", "MI_1057801_Body_01": "skin", "MI_1057801_Hair_01": "hair",
          "MI_1057801_Hair_02": "hairfx", "MI_1057801_Glass": None, "MI_1057801_Rim_HeroDetails": None}
HAIR_SETS = ("hair", "hairfx")
# Neck cover (from the PeniParker port, via Loki): the wearer's own face model carries the neck down to the collar, and
# it showed at the sides of his neck under the wig, seen from a little below (0.45% of a Midlander man's face;
# tools/showthrough.py). Every face of the races that wear each fit is checked.
COVER_RACES = {"c0201": ("c0201", "c0401", "c0601", "c0801", "c1001", "c1401", "c1601", "c1801"),
               "c0101": ("c0101", "c0301", "c0501", "c0701", "c1301", "c1701"),
               "c0901": ("c0901", "c1501"),
               "c1101": ("c1101", "c1201")}
HIDDEN_EARS = {"atr_mim", "atr_top", "atr_hrn"}   # the head EQP shows no ears (human, Miqo'te) or Au Ra horns
FACE_IDS = [f"f{i:04d}" for i in list(range(1, 9)) + list(range(101, 109))]     # player faces (f02xx are NPC)
# lengths for a neck (j_kubi to j_kao) NECK_REF long; each fit scales them by its own neck
NECK_REF = 0.1072
NECK_MARGIN = 0.0025            # m his outer neck surface keeps outside the wearer's (not scaled)
NECK_TOP = 0.065                # m along the neck from j_kubi: above this (his jaw and head) nothing moves
NECK_BOTTOM = 0.0               # below this (his collar and shoulders) nothing moves
NECK_RAMP = 0.015
NECK_FAR = 0.07                 # m from the neck axis: face parts further out are horns, manes and fangs, not neck
NECK_CAP = 0.008                # most a neck point moves out (per fit: `neck_cap`)
NECK_SKIP = ("hair_01", "hair_02")      # the wig moves with the head, not the neck
WAIST_BLEND = 0.035             # m either side of a skirt joint where its weight hands over to the next
FINGERS = {"thumb": "oya", "index": "hito", "middle": "naka", "ring": "kusu", "pinky": "ko"}
FINGER_BLEND = 0.006            # m either side of j_*_b where a finger's weight hands over from j_*_a


# ----------------------------------------------------------------------------- joint maps

def _ancestors(j, B):
    while j is not None:
        yield j
        j = B[j]["parent"] if j in B else None


def segment_of(j, B):
    """Source joint -> the retarget segment that moves it (None: the torso lattice)."""
    for a in _ancestors(j, B):
        if a == "head":
            return "head"
        if a in ("neck_01", "neck_02"):
            return "neck"
        m = re.fullmatch(r"(thumb|index|middle|ring|pinky)_0\d_([lr])", a)
        if m:
            return f"{m.group(1)}.{m.group(2)}"
        m = re.fullmatch(r"(clavicle|upperarm|lowerarm|hand|thigh|calf|foot)_([lr])", a)
        if m:
            seg = {"clavicle": "shoulder", "upperarm": "upper_arm", "lowerarm": "forearm", "hand": "hand",
                   "thigh": "thigh", "calf": "shin", "foot": "foot"}[m.group(1)]
            return f"{seg}.{m.group(2)}"
    return None


def ffxiv_of(j, B):
    """Source joint -> FFXIV bone, or "torso" (spread by height) / "skirt" (FFXIV skirt chains by position) /
    "finger:<ffxiv finger>:<side>" (split between j_*_a and j_*_b by position along the FFXIV finger)."""
    m = re.fullmatch(r"([LR])_Knee_Fix_\d+(_sec)?_Jnt", j)
    if m:                                   # his knee volume joints: the FFXIV knee bone, as the vanilla body has it
        return f"j_asi_b_{m.group(1).lower()}"
    for a in _ancestors(j, B):
        if "Skirt_801" in a:
            return "skirt"
        if a in ("pelvis", "spine_01", "spine_02", "spine_03", "spine_04", "spine_05", "root"):
            return "torso"
        if a in ("neck_01", "neck_02"):
            return "j_kubi"
        if a == "head":
            return "j_kao"
        m = re.fullmatch(r"(thumb|index|middle|ring|pinky)_(metacarpal|01|02|03)_([lr])", a)
        if m:
            f, k, s = m.groups()
            if k == "metacarpal":
                return f"j_te_{s}"
            return f"finger:{FINGERS[f]}:{s}"
        m = re.fullmatch(r"(clavicle|upperarm|lowerarm|hand|thigh|calf|foot|ball)_([lr])", a)
        if m:
            return {"clavicle": "j_sako", "upperarm": "j_ude_a", "lowerarm": "j_ude_b", "hand": "j_te",
                    "thigh": "j_asi_a", "calf": "j_asi_c", "foot": "j_asi_d", "ball": "j_asi_e"}[m.group(1)] + \
                f"_{m.group(2)}"
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
    """Moves points from Deadpool's bind pose into an FFXIV race's bind pose."""

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
              (dist(H0["thigh_l"], H0["calf_l"]) + dist(H0["calf_l"], H0["foot_l"]))
        torso = (F["j_kubi"][1] - F["j_asi_a_l"][1]) / (H0["neck_01"][1] - H0["thigh_l"][1])
        arm = (dist(F["j_ude_a_l"], F["j_ude_b_l"]) + dist(F["j_ude_b_l"], F["j_te_l"])) / \
              (dist(H0["upperarm_l"], H0["lowerarm_l"]) + dist(H0["lowerarm_l"], H0["hand_l"]))
        self.scale = s = float(np.exp(np.mean(np.log([leg, torso, arm]))))
        print(f"  size ratios FFXIV/Deadpool: legs {leg:.3f} torso {torso:.3f} arms {arm:.3f} -> scale {s:.3f}")
        hip_m = (H0["thigh_l"] + H0["thigh_r"]) / 2
        hip_f = (F["j_asi_a_l"] + F["j_asi_a_r"]) / 2
        self.t = hip_f - s * hip_m
        H = {n: s * p + self.t for n, p in H0.items()}
        self.H = H
        floor = self.t[1]

        # heels: uniform scale about his ankle, sole on the floor, ankle over the FFXIV ankle
        kf = prof["foot"]
        A = {}
        for sd_ in SIDES:
            a = F[f"j_asi_d_{sd_}"].copy()
            a[1] = kf * (H[f"foot_{sd_}"][1] - floor)
            A[sd_] = a
        self.ankle = A

        knots = [("foot_l", A["l"]), ("calf_l", F["knee_l"]), ("thigh_l", F["j_asi_a_l"]),
                 ("upperarm_l", F["j_ude_a_l"]), ("neck_01", F["j_kubi"])]
        self.ky = np.array([H[a][1] for a, _ in knots])
        self.fy = np.array([f[1] for _, f in knots])
        assert np.all(np.diff(self.ky) > 0) and np.all(np.diff(self.fy) > 0)
        sh = F["j_ude_a_l"][0] / H["upperarm_l"][0]
        sh = sh + prof["shoulder"] * (1 - sh)
        self.sx_y = np.array([H["thigh_l"][1], H["upperarm_l"][1]])
        self.sx_v = np.array([F["j_asi_a_l"][0] / H["thigh_l"][0], sh])
        self.dz = np.array([f[2] - H[a][2] for a, f in knots])
        print("  lattice y", np.round(self.ky, 3), "->", np.round(self.fy, 3), " width", np.round(self.sx_v, 3),
              " dz", np.round(self.dz, 3))

        # head: uniform scale about the head joint, his eyes onto the FFXIV eyes (Lalafell: skull centre onto skull
        # centre); the neck stretches to meet it
        kh = prof["head"]
        if prof.get("align") == "centre":
            eyes_m = self.src_skull_centre() * s + self.t
            eyes_f = self.ffxiv_face_centre(race)
        else:
            eyes_m = self.src_eyes() * s + self.t
            eyes_f = self.ffxiv_eyes(race)
        eyes_f = eyes_f + np.array([0, prof.get("eye_dy", 0.0), prof["eye_dz"]])
        head_base = eyes_f - kh * (eyes_m - H["head"])
        self.head_base = head_base
        print(f"  eyes: Deadpool {np.round(eyes_m, 3)} -> FFXIV {np.round(eyes_f, 3)}; head joint "
              f"{np.round(H['head'], 3)} -> {np.round(head_base, 3)} (j_kao {np.round(F['j_kao'], 3)})")

        # segment -> (joint, child joint or None, FFXIV start, FFXIV target, kind, twist)
        D = {"neck": ("neck_01", "head", F["j_kubi"], head_base, "stretch", None),
             "head": ("head", None, head_base, head_base, "head", None)}
        for sd_ in SIDES:
            D.update({
                f"shoulder.{sd_}": (f"clavicle_{sd_}", f"upperarm_{sd_}", F[f"j_sako_{sd_}"], F[f"j_ude_a_{sd_}"],
                                    "stretch", None),
                f"upper_arm.{sd_}": (f"upperarm_{sd_}", f"lowerarm_{sd_}", F[f"j_ude_a_{sd_}"], F[f"j_ude_b_{sd_}"],
                                     "stretch", None),
                f"forearm.{sd_}": (f"lowerarm_{sd_}", f"hand_{sd_}", F[f"j_ude_b_{sd_}"], F[f"j_te_{sd_}"], "stretch",
                                   None),
                f"hand.{sd_}": (f"hand_{sd_}", f"middle_01_{sd_}", F[f"j_te_{sd_}"], F[f"j_naka_a_{sd_}"], "hand",
                                ((f"index_01_{sd_}", f"pinky_01_{sd_}"), (F[f"j_hito_a_{sd_}"], F[f"j_ko_a_{sd_}"]))),
                f"thigh.{sd_}": (f"thigh_{sd_}", f"calf_{sd_}", F[f"j_asi_a_{sd_}"], F[f"knee_{sd_}"], "stretch", None),
                f"shin.{sd_}": (f"calf_{sd_}", f"foot_{sd_}", F[f"knee_{sd_}"], A[sd_], "stretch", None),
                f"foot.{sd_}": (f"foot_{sd_}", f"ball_{sd_}", A[sd_], F[f"j_asi_e_{sd_}"], "place", None),
            })
            for ue, ff in FINGERS.items():
                D[f"{ue}.{sd_}"] = (f"{ue}_01_{sd_}", f"{ue}_02_{sd_}", F[f"j_{ff}_a_{sd_}"], F[f"j_{ff}_b_{sd_}"],
                                    "finger", None)
        parent_seg = {"head": "neck", "neck": None}
        for sd_ in SIDES:
            parent_seg.update({f"shoulder.{sd_}": None, f"upper_arm.{sd_}": f"shoulder.{sd_}",
                               f"forearm.{sd_}": f"upper_arm.{sd_}", f"hand.{sd_}": f"forearm.{sd_}",
                               f"thigh.{sd_}": None, f"shin.{sd_}": f"thigh.{sd_}", f"foot.{sd_}": f"shin.{sd_}"})
            parent_seg.update({f"{ue}.{sd_}": f"hand.{sd_}" for ue in FINGERS})
        order = ["neck", "head"] + [f"{seg}.{sd_}" for sd_ in SIDES for seg in
                                    ("shoulder", "upper_arm", "forearm", "hand", "thigh", "shin", "foot")]
        order += [f"{ue}.{sd_}" for sd_ in SIDES for ue in FINGERS]
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
                # his finger as it is, carried on from the hand's turn and scale, its base on the FFXIV knuckle and
                # aimed along the FFXIV finger (j_*_a -> j_*_b): his three-joint fingers don't line up with FFXIV's
                # two-bone fingers, and bent by the game's idle they turned into claws (the Mantis and Peni ports)
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
                # uniform: the glove keeps its shape, the middle knuckle lands on the FFXIV one
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
        print("  finger bases moved onto the FFXIV knuckles (left, mm): " +
              ", ".join(f"{k} {d * 1000:.1f}" for k, d in knuckles.items()))

    def src_eyes(self):
        P = {n: b["head"] for n, b in self.B.items()}
        return np.mean([P[n] for n in ("L_LidIn", "L_LidOut", "R_LidIn", "R_LidOut")], axis=0)

    def src_skull_centre(self):
        m = sd.mesh()
        sel = np.isin(m["mat"], [m["materials"].index("MI_1057801_Equip_02")])
        p = m["pos"][np.unique(m["faces"][sel])]
        p = p[(p[:, 1] > self.B["head"]["head"][1]) & (np.abs(p[:, 0]) < 0.12)]
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
        """Mesh m (source bind pose) -> FFXIV positions and normals, blended by his own skin weights."""
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


def skirt_dict(p, F, chains, joints, ang):
    """FFXIV skirt chains by angle round the body and height; above the waist joints, the hips."""
    n = len(chains)
    th = math.atan2(p[0], p[2])
    j = np.searchsorted(ang, th) % n
    a0, a1 = ang[j - 1], ang[j]
    span = (a1 - a0) % (2 * math.pi)
    f = ((th - a0) % (2 * math.pi)) / span if span > 0 else 0.0
    d = {}
    for c, wc in ((chains[j - 1], 1 - f), (chains[j], f)):
        if wc <= 1e-4:
            continue
        bones_ = ["j_kosi"] + [f"j_sk_{c[0]}_{lv}_{c[2]}" for lv in "abc"]
        wb = np.zeros(4)
        wb[0] = 1.0
        for k, q in enumerate(joints[c]):
            t = np.clip((q[1] + WAIST_BLEND - p[1]) / (2 * WAIST_BLEND), 0, 1)
            wb[k + 1] = t * wb[k]
            wb[k] *= 1 - t
        for b, w in zip(bones_, wb):
            if w > 1e-4:
                d[b] = d.get(b, 0) + wc * w
    return d


def own_weights(m, pos, F, B):
    """His weights renamed onto FFXIV bones: torso spread by height, skirt onto the skirt chains, arm weight shared
    with the twist helpers."""
    chain = [(F["j_kubi"][1] - 0.02, "j_kubi"), (F["j_sebo_c"][1], "j_sebo_c"), (F["j_sebo_b"][1], "j_sebo_b"),
             (F["j_sebo_a"][1], "j_sebo_a"), (F["j_asi_a_l"][1], "j_kosi")]
    hs = np.array([h for h, _ in chain])
    names = [ffxiv_of(n, B) for n in m["joint_names"]]
    chains = [f"{c}_{s}" for c, s in (("f", "l"), ("s", "l"), ("b", "l"), ("b", "r"), ("s", "r"), ("f", "r"))]
    sk_joints = {c: [F[f"j_sk_{c[0]}_{lv}_{c[2]}"] for lv in "abc"] for c in chains}
    ang = np.array([math.atan2(sk_joints[c][0][0], sk_joints[c][0][2]) for c in chains])
    order = np.argsort(ang)
    chains = [chains[i] for i in order]
    ang = ang[order]
    J, W = m["joints"], m["weights"]
    out = []
    for i in range(len(pos)):
        d = {}
        torso = skirt = 0.0
        for j, w in zip(J[i], W[i]):
            if w <= 0:
                continue
            n = names[j]
            if n == "torso":
                torso += w
            elif n == "skirt":
                skirt += w
            elif n.startswith("finger:"):
                _, f, side = n.split(":")
                a, b = F[f"j_{f}_a_{side}"], F[f"j_{f}_b_{side}"]
                ax = (b - a) / np.linalg.norm(b - a)
                t = np.clip((np.dot(pos[i] - b, ax) + FINGER_BLEND) / (2 * FINGER_BLEND), 0, 1)
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
        if skirt > 0:
            for b, w in skirt_dict(pos[i], F, chains, sk_joints, ang).items():
                d[b] = d.get(b, 0) + skirt * w
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
    """The wig: on the head down to the jaw, then handing over to the neck and the upper back at the shoulders."""
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

def race_parents(race):
    sk = Skeleton(xd.extract(f"chara/human/{race}/skeleton/base/b0001/skl_{race}b0001.sklb")[0])
    return {n: (sk.names[p] if p >= 0 else None) for n, p in zip(sk.names, sk.parents)}


def face_surface(race, face, fit_race, D, step=0.002):
    """Points over a vanilla face model's surface (ears and horns left out: the head piece hides them), taken into the
    fit race's bind space through the racial deformer. None if the face doesn't exist."""
    p = f"chara/human/{race}/obj/face/{face}/model/{race}{face}_fac.mdl"
    if not xd.exists(p):
        return None
    deform = None if race == fit_race else pbd.chain(D, int(race[1:]), int(fit_race[1:]))
    parents = race_parents(race) if deform else None
    out = []
    for me in xd.model(p)["meshes"]:
        keep = np.array([s < 0 or not set(me["sub_attrs"][s]) & HIDDEN_EARS for s in me["tri_sub"]], bool)
        pos = me["pos"] if deform is None else pbd.deform(me["pos"], me["bones"], me["weights"], deform, parents)
        tri = pos[me["faces"][keep]]
        n = np.clip(np.ceil(np.linalg.norm(tri - np.roll(tri, 1, 1), axis=2).max(1) / step).astype(int), 1, 12)
        for k in np.unique(n):
            t = tri[n == k]
            u, v = np.meshgrid(np.arange(k + 1), np.arange(k + 1))
            m = (u + v) <= k
            a, b = u[m] / k, v[m] / k
            out.append((t[:, None, 0] * (1 - a - b)[None, :, None] + t[:, None, 1] * a[None, :, None]
                        + t[:, None, 2] * b[None, :, None]).reshape(-1, 3))
    return np.vstack(out)


def neck_polar(p, F):
    a = F["j_kubi"]
    ax = (F["j_kao"] - a) / np.linalg.norm(F["j_kao"] - a)
    t = (p - a) @ ax
    r = p - a - np.outer(t, ax)
    return t, np.arctan2(r[:, 0], r[:, 2]), np.linalg.norm(r, axis=1), r


def neck_shell(parts):
    """What really covers the wearer's neck: the mask's head and neck (gear atlas vertices on j_kao / j_kubi). Not the
    stethoscope tubes and collar round it, which would count as cover over the gaps between them."""
    p = parts["equip_02"]
    return p["pos"][np.isin(p["bones"][:, 0], ("j_kao", "j_kubi"))]


def cover_neck(parts, F, fit_race, prof):
    """Push his neck layers (mask, collar) out radially about the j_kubi -> j_kao axis until the mask clears the necks
    of every face that wears this fit by NECK_MARGIN. Inner and outer layers move by the same amount, so the collar
    stays on the neck. From the PeniParker port (Loki's copy)."""
    D = pbd.read()
    ks = float(np.linalg.norm(F["j_kao"] - F["j_kubi"])) / NECK_REF
    top, ramp = NECK_TOP * ks, NECK_RAMP * ks
    far, cap = prof.get("neck_far", NECK_FAR * ks), prof.get("neck_cap", NECK_CAP * ks)
    TB = np.arange(-0.02 * ks, top + ramp + 0.003, 0.003)
    AB = np.radians(np.arange(-180, 180.1, 7.5))
    env = np.zeros((len(TB) - 1, len(AB) - 1))
    used = []
    for race in COVER_RACES[fit_race]:
        for face in FACE_IDS:
            s = face_surface(race, face, fit_race, D)
            if s is None:
                continue
            t, th, r, _ = neck_polar(s, F)
            sel = (t > TB[0]) & (t < TB[-1]) & (r < far)
            i, j = np.digitize(t[sel], TB) - 1, np.clip(np.digitize(th[sel], AB) - 1, 0, len(AB) - 2)
            np.maximum.at(env, (i, j), r[sel])
            used.append(f"{race}{face}")
    print(f"  neck cover: {len(used)} faces of {', '.join(COVER_RACES[fit_race])}; neck x{ks:.2f} the reference")
    # his outermost covering surface per cell (cells he leaves empty borrow their neighbours round the neck)
    shell = np.zeros_like(env)
    t, th, r, _ = neck_polar(neck_shell(parts), F)
    sel = (t > TB[0]) & (t < TB[-1]) & (r < 0.12)
    i, j = np.digitize(t[sel], TB) - 1, np.clip(np.digitize(th[sel], AB) - 1, 0, len(AB) - 2)
    np.maximum.at(shell, (i, j), r[sel])
    for i in range(len(shell)):
        row = shell[i]
        if (row > 0).any() and (row == 0).any():
            k = np.nonzero(row > 0)[0]
            row[row == 0] = np.interp(np.nonzero(row == 0)[0], k, row[k], period=len(row))
    # conservative: each cell needs what its neighbours need, then a soft blur round and along the neck
    env = np.maximum.reduce([np.roll(np.roll(env, di, 0), dj, 1) for di in (-1, 0, 1) for dj in (-1, 0, 1)])
    need = np.where((env > 0) & (shell > 0), np.clip(env + NECK_MARGIN - shell, 0, cap), 0)
    need = np.maximum.reduce([np.roll(need, dj, 1) for dj in (-1, 0, 1)] + [np.roll(need, d, 0) for d in (-1, 1)])
    k = np.array([1, 2, 1]) / 4
    for _ in range(2):
        need = np.apply_along_axis(lambda c: np.convolve(np.r_[c[:1], c, c[-1:]], k, "valid"), 0, need)
        need = (np.roll(need, 1, 1) + 2 * need + np.roll(need, -1, 1)) / 4
    tc, ac = (TB[:-1] + TB[1:]) / 2, (AB[:-1] + AB[1:]) / 2
    moved = {}
    for name, p in parts.items():
        if name in NECK_SKIP:
            continue
        t, th, r, rv = neck_polar(p["pos"], F)
        zone = (t > NECK_BOTTOM * ks) & (t < top + ramp) & (r < far)
        if not zone.any():
            continue
        fi = np.clip(np.interp(t[zone], tc, np.arange(len(tc))), 0, len(tc) - 1)
        fj = np.interp(th[zone], ac, np.arange(len(ac)), period=2 * np.pi)
        i0, j0 = np.floor(fi).astype(int), np.floor(fj).astype(int) % len(ac)
        i1, j1 = np.minimum(i0 + 1, len(tc) - 1), (j0 + 1) % len(ac)
        wi, wj = fi - np.floor(fi), fj - np.floor(fj)
        d = (need[i0, j0] * (1 - wi) * (1 - wj) + need[i1, j0] * wi * (1 - wj) + need[i0, j1] * (1 - wi) * wj
             + need[i1, j1] * wi * wj)
        d *= np.clip((top + ramp - t[zone]) / ramp, 0, 1)
        d *= np.clip((t[zone] - NECK_BOTTOM * ks) / ramp, 0, 1)      # fade in above his collar and shoulders
        dirs = rv[zone] / np.maximum(r[zone, None], 1e-6)
        p["pos"][zone] += dirs * d[:, None]
        if d.max() > 1e-4:
            moved[name] = (int((d > 1e-4).sum()), float(d.max()))
    print(f"  neck cover: needed up to {need.max() * 1000:.1f} mm; moved "
          + ", ".join(f"{n} {c} verts (max {m * 1000:.1f} mm)" for n, (c, m) in moved.items()))


def wrap_uv(uv, faces):
    """UV islands drawn wholly past u = 1 (the rip tiles its atlases) are moved back into 0..1. Islands that cross
    u = 1 keep their coordinates (the texture repeats)."""
    uv = uv.copy()
    comp = components(faces, len(uv))
    lo = np.full(comp.max() + 1, np.inf)
    np.minimum.at(lo, comp, uv[:, 0])
    uv[:, 0] -= np.floor(lo)[comp]
    return uv


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
        if texset == "hair":
            uv = m["uv1"][used]                 # the wig's colour comes from its shadow-colour map (2nd UV set)
        else:
            uv = wrap_uv(m["uv0"][used], faces)
        dl = [hairW[i] for i in used] if texset in HAIR_SETS else [W[i] for i in used]
        Bn, Wt = to_arrays(dl)
        name = mat.replace("MI_1057801_", "").lower()
        parts[name] = dict(pos=pos[used], nrm=nrm[used], uv=np.c_[uv[:, 0], 1 - uv[:, 1]], uv2=m["uv0"][used],
                           faces=faces, vid=m["vid"][used], bones=Bn, weights=Wt, texset=texset,
                           slot="met" if texset in HAIR_SETS else None)
    cover_neck(parts, F, race, prof)
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
