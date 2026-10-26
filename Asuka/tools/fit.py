"""Fit Asuka (the baked game mesh, work/bake) onto an FFXIV race skeleton, with FFXIV skin weights.

The Tripo mesh has no rig, so every game-mesh vertex first gets weights on her own segments, from its region label
(labels.py) and her measured joints (joints.py), in her T-pose:
  * arms (|x| past the shoulder, above the armpit): clavicle / upper arm / forearm / hand, blended across each joint
    by the distance along the arm; the torso round the shoulder shares with the clavicle and the upper arm
  * legs (below the hips): thigh / shin / foot, blended across knee and ankle; the top of the thigh shares with
    the torso, and the two legs share across the crotch's midline
  * collar: skinned torso -> neck -> head up the collar, its top edge (labels.py) all head, so it stays on the neck
    skin; placed by a smooth blend from the torso lattice at its foot to the head at its top edge, at each angle
    (the edge is 1 cm higher at the back). Face, neck skin, ears, eyes and the A10 clips: head
  * hair: the head's down to the shoulders, the upper back below (it hangs to her waist)
  * everything else: torso (a height lattice)
Positions are then retargeted as in the NursePool port:
  * one uniform scale (geometric mean of the leg and torso length ratios: her arms are far shorter than FFXIV's,
    and letting them in would squash her legs), hips on the FFXIV hips
  * torso: a height lattice through her ankles, knees, hips, shoulders and neck; width scaled toward the FFXIV
    hips and, by `shoulder` (0 = onto the FFXIV joints, 1 = her own breadth), toward the FFXIV shoulders
  * limbs: one affine per segment, parents first, rotated onto the FFXIV bone and stretched to its length. Her
    arms come down from the T-pose to the FFXIV bind pose's 45 degrees here. The clavicle is measured along the
    FFXIV clavicle's own direction, so it only stretches
  * hands: rotated so her knuckles line up with the FFXIV knuckles (index to little finger across), scaled so her
    middle knuckle meets theirs; each finger and the thumb is then its own rigid segment, its root on the FFXIV
    knuckle (j_*_a) and aimed along the FFXIV finger, so it bends where the game's finger bends (from the Mantis and
    Peni Parker ports: a thumb 18 mm and 31 degrees off crumpled in the game's idle pose)
  * heels: rigid (scaled by `foot`), sole and heel on the floor under the FFXIV ankle, toes turned to point forward
  * head: rigid, scaled by `head`, her eyes `eye_dz` in front of the FFXIV eyes (Lalafell: skull centre on skull
    centre); the collar follows (above)
FFXIV weights:
  * segments renamed onto FFXIV bones; torso spread over the spine by height; upper arm and forearm shared with
    the twist helpers as on the vanilla body
  * fingers: each of her fingers (lanes measured in joints.py; soft across the lanes where her fingers are fused)
    split between its FFXIV finger's two bones by position along the FFXIV finger, blending across j_*_b
  * hair below the head: j_sebo_c (upper back), so it follows the body, not every turn of the head
Neck cover (cover_neck, from the Peni Parker port): her neck skin and collar are pushed out to clear the wearer's own
neck, which the face model carries down to the collar and which showed behind her jaw in the game's shaders.
Parts: head and hair go to the head slot (Magitek Ear Guards); the suit is split into the other four slots by
build.py from these weights.

python -P -E tools/fit.py [race ...]   ->  work/fit/<race>.pkl
  {"parts": {name: dict(pos, nrm, uv (v up), faces, vid, bones (N,4), weights (N,4), texset, slot, src)}, ...}
"""
import math
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bake  # noqa: E402
import joints as jt  # noqa: E402
import labels  # noqa: E402
import pbd  # noqa: E402
import rig  # noqa: E402
import xivdata as xd  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

ROOT = rig.ROOT
BAKE = os.path.join(ROOT, "work", "bake")
SIDES = ("l", "r")
# Per race: shoulder breadth kept (0..1), head scale (on top of the body scale), heel scale, how far her eyes sit
# in front of (eye_dz) / above (eye_dy) the FFXIV eyes, or her skull centre on theirs (align="centre").
PROFILES = {                    # head, eye_dz, eye_dy from tools/tune_head.py (share of the face showing: 0.3-1%)
    "c0201": dict(shoulder=0.5, head=1.0, foot=1.0, eye_dz=0.028, eye_dy=-0.016),
    "c0101": dict(shoulder=0.5, head=1.05, foot=1.0, eye_dz=0.02, eye_dy=-0.01),
    "c0901": dict(shoulder=0.5, head=1.25, foot=0.9, eye_dz=0.025, eye_dy=-0.012),
    "c1101": dict(shoulder=0.6, head=2.1, foot=0.8, eye_dz=0.03, eye_dy=-0.015, align="centre"),
}
DIGITS = ("thumb", "index", "middle", "ring", "pinky")
SEGS = ["torso", "neck", "head"] + [f"{seg}.{s}" for s in SIDES for seg in
                                    ("shoulder", "upper_arm", "forearm", "hand", "thigh", "shin", "foot") + DIGITS]
SI = {n: i for i, n in enumerate(SEGS)}
L = labels.LABEL
ARM_X = 0.072           # her arms (and the shoulder they hang from) start here, above ARMPIT_Y
ARMPIT_Y = 0.78
COLLAR_LO = 0.832       # the collar's bottom, where it meets the shoulders
LEG_TOP = 0.625
HAIR_HEAD = (0.80, 0.87)    # hair below the first height follows the upper back, above the second the head
FINGER_BONE = {"thumb": "oya", "index": "hito", "middle": "naka", "ring": "kusu", "pinky": "ko"}
FINGER_BLEND = 0.006            # m either side of j_*_b where a finger's weight hands over from j_*_a
LANE_SIGMA = 0.002              # her fingers' lanes blend over this (figure metres) where they're fused
# Neck cover (from the Peni Parker port): the wearer's own face model carries the neck down to the collar, and her
# anime neck is far slimmer than FFXIV's, so it showed behind her jaw. Every race that wears a fit:
COVER_RACES = {"c0201": ("c0201", "c0401", "c0601", "c0801", "c1001", "c1401", "c1601", "c1801"),
               "c0101": ("c0101", "c0301", "c0501", "c0701", "c1301", "c1701"),
               "c0901": ("c0901", "c1501"),
               "c1101": ("c1101", "c1201")}
COVER_FACES = [f"f{i:04d}" for i in list(range(1, 9)) + list(range(101, 109))]     # player faces (f02xx are NPCs')
HIDDEN_EARS = {"atr_mim", "atr_top", "atr_hrn"}          # the head piece's EQP (the Moogle Head's) hides these
# Lengths for the Midlander woman, whose neck (j_kubi to j_kao) is NECK_REF long; each fit scales them by its own
NECK_REF = 0.1072
NECK_MARGIN = 0.0025            # m her neck keeps outside the wearer's (not scaled)
NECK_TOP = 0.075                # m along the neck from j_kubi: above this (her jaw and head) nothing moves
NECK_BOTTOM = -0.015            # below this (her shoulders) nothing moves; Elezen necks reach below j_kubi
NECK_RAMP = 0.015
NECK_FAR = 0.09                 # m from the neck axis: face parts further out are horns, manes and fangs, not neck
NECK_SIDES = 30                 # deg either side of the front left out: her chin covers the throat from the front, and
                                # pushing it out for the big-jawed races made a neck as wide as her jaw
NECK_CAP = 0.03
NECK_SHELL = ("head", "body")   # what covers: neck skin and collar (the hair hangs clear of the neck at the sides)
NECK_SKIP = ("hair",)           # solid: a neck pushed into it is hidden inside


def ramp(v, a, b):
    return np.clip((v - a) / (b - a), 0, 1)


def unit(v):
    return v / np.linalg.norm(v)


# ----------------------------------------------------------------------------- her segments

def kinds(pos, lab):
    """Boolean masks of the body parts, by region label and place (T-pose)."""
    suit = lab == L["suit"]
    y = pos[:, 1]
    r = np.hypot(pos[:, 0], pos[:, 2] - labels.NECK_Z)
    # suit above the collar's top edge: the few chin triangles the bake gave the body's texture set
    head = np.isin(lab, [L["face"], L["clip"]]) | (suit & (r < 0.07) & (y > labels.collar_top_at(pos)))
    suit = suit & ~head
    hair = lab == L["hair"]
    neck = suit & (y > COLLAR_LO) & (r < 0.045)
    arm = suit & ~neck & (np.abs(pos[:, 0]) > ARM_X) & (y > ARMPIT_Y)
    leg = suit & (y < LEG_TOP)
    torso = suit & ~(neck | arm | leg)
    return dict(arm=arm, leg=leg, head=head, hair=hair, neck=neck, torso=torso)


def polyline_dist(p, pts):
    d = np.full(len(p), np.inf)
    for a, b in zip(pts[:-1], pts[1:]):
        ab = b - a
        t = np.clip((p - a) @ ab / (ab @ ab), 0, 1)
        d = np.minimum(d, np.linalg.norm(p - (a + t[:, None] * ab), axis=1))
    return d


def leg_side(pos, J):
    dl, dr = (polyline_dist(pos, [J[f"{k}_{s}"] for k in ("hip", "knee", "ankle", "toe")]) for s in SIDES)
    return np.where(dl <= dr, "l", "r")


def smoothstep(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def hand_split(p, s):
    """Her hand's share per segment (palm, thumb, index, middle, ring, pinky) for hand vertices p (figure metres):
    the thumb in front of the thumb line (joints.THUMB_Z) from its root on, the fingers past the knuckles, each
    finger by its lane (Gaussian over the lanes, so the fused webbing between them blends)."""
    sign = 1 if s == "l" else -1
    x, z = sign * p[:, 0], p[:, 2]
    (x0, z0), (x1, z1) = jt.THUMB_Z
    # her thumb lies fused along her index; FFXIV's points away from the hand, so the seam between them becomes a
    # web: 5 mm wide on the palm, narrowing to the index finger's edge
    web = np.interp(x, [0.30, 0.335, 0.35], [0.005, 0.005, 0.0015])
    side = ramp(z - (z0 + (z1 - z0) * (x - x0) / (x1 - x0)), -web, 0.0015) * (x > x0)
    thumb = side * ramp(x, 0.302, 0.316)
    fingers = (1 - side) * ramp(x, jt.KNUCKLE_X - 0.006, jt.KNUCKLE_X + 0.002)
    lanes = np.stack([np.exp(-0.5 * ((z - jt.FINGERS[f][0]) / LANE_SIGMA) ** 2) for f in DIGITS[1:]], 1)
    lanes /= np.maximum(lanes.sum(1, keepdims=True), 1e-12)
    return np.c_[1 - thumb - fingers, thumb, fingers[:, None] * lanes]


def segment_weights(pos, lab, J):
    """(W, Wp, K): skinning weights on her segments, the same for placing the vertices (they differ on the collar:
    placed by a smooth blend from the torso to the head, skinned torso -> neck -> head), and the part masks."""
    K = kinds(pos, lab)
    y = pos[:, 1]
    W = np.zeros((len(pos), len(SEGS)))
    W[K["torso"], SI["torso"]] = 1
    W[K["head"], SI["head"]] = 1
    # collar: skinned torso -> neck -> head, its top edge all head
    n = K["neck"]
    top = labels.collar_top_at(pos[n])
    up = ramp(y[n], top - 0.012, top - 0.002)
    lo = ramp(y[n], COLLAR_LO, 0.848)
    W[n, SI["head"]] = up
    W[n, SI["neck"]] = lo * (1 - up)
    W[n, SI["torso"]] = (1 - lo) * (1 - up)
    # hair
    h = K["hair"]
    f = ramp(y[h], *HAIR_HEAD)
    W[h, SI["head"]] = f
    W[h, SI["torso"]] = 1 - f
    # legs: each side's weights, blended across the crotch's midline by which leg is nearer
    dl, dr = (polyline_dist(pos, [J[f"{k}_{s}"] for k in ("hip", "knee", "ankle", "toe")]) for s in SIDES)
    share = {"l": ramp(dr - dl, -0.025, 0.025)}
    share["r"] = 1 - share["l"]
    g = K["leg"]
    W[g] = 0
    for s, sign in (("l", 1), ("r", -1)):
        # arms
        a = K["arm"] & (sign * pos[:, 0] > 0)
        sh, el, wr = J[f"shoulder_{s}"], J[f"elbow_{s}"], J[f"wrist_{s}"]
        uu, ul = unit(el - sh), unit(wr - el)
        p = pos[a]
        w_up = ramp((p - sh) @ uu, -0.012, 0.012)
        w_fo = ramp((p - el) @ ul, -0.015, 0.015)
        w_ha = ramp((p - wr) @ ul, -0.006, 0.006)
        W[a] = 0
        digits = hand_split(p, s)
        for k, seg in enumerate(("hand",) + DIGITS):
            W[a, SI[f"{seg}.{s}"]] = w_ha * digits[:, k]
        W[a, SI[f"forearm.{s}"]] = w_fo * (1 - w_ha)
        W[a, SI[f"upper_arm.{s}"]] = (1 - w_fo) * (1 - w_ha) * w_up
        # the shoulder's share fades into the torso toward the armpit, as on the torso next to it (below)
        w_cl = ramp(p[:, 1], ARMPIT_Y - 0.02, ARMPIT_Y + 0.01)
        W[a, SI[f"shoulder.{s}"]] = (1 - w_fo) * (1 - w_ha) * (1 - w_up) * w_cl
        W[a, SI["torso"]] = (1 - w_fo) * (1 - w_ha) * (1 - w_up) * (1 - w_cl)
        # torso round the shoulder: upper chest and back share with the clavicle, and next to the shoulder joint
        # with the upper arm
        t = K["torso"] & (sign * pos[:, 0] > 0.035) & (y > ARMPIT_Y - 0.02)
        p = pos[t]
        w_cl = ramp(sign * p[:, 0], 0.04, 0.07) * ramp(p[:, 1], ARMPIT_Y - 0.02, ARMPIT_Y + 0.01)
        w_ar = 0.5 * ramp((p - sh) @ uu, -0.012, 0.01) * (np.linalg.norm(p - sh, axis=1) < 0.04)
        W[t, SI["torso"]] = 1 - w_cl
        W[t, SI[f"shoulder.{s}"]] = w_cl * (1 - w_ar)
        W[t, SI[f"upper_arm.{s}"]] = w_cl * w_ar
        # legs
        hp, kn, an = J[f"hip_{s}"], J[f"knee_{s}"], J[f"ankle_{s}"]
        us = unit(an - kn)
        p = pos[g]
        k = share[s][g]
        w_sh = ramp((p - kn) @ us, -0.018, 0.018)
        w_ft = ramp((p - an) @ us, -0.005, 0.01)
        w_top = ramp(hp[1] + 0.015 - p[:, 1], 0.0, 0.045)        # top of the thigh shares with the hips
        W[g, SI[f"foot.{s}"]] += k * w_ft
        W[g, SI[f"shin.{s}"]] += k * w_sh * (1 - w_ft)
        W[g, SI[f"thigh.{s}"]] += k * (1 - w_sh) * (1 - w_ft) * w_top
        W[g, SI["torso"]] += k * (1 - w_sh) * (1 - w_ft) * (1 - w_top)
    assert np.allclose(W.sum(1), 1), "segment weights must add up to 1"
    Wp = W.copy()
    t = smoothstep((y[n] - COLLAR_LO) / (top - COLLAR_LO))
    Wp[n] = 0
    Wp[n, SI["torso"]] = 1 - t
    Wp[n, SI["head"]] = t
    return W, Wp, K


# ----------------------------------------------------------------------------- retarget

def affine(lin, src_point, dst_point):
    m = np.eye(4)
    m[:3, :3] = lin
    m[:3, 3] = dst_point - lin @ src_point
    return m


def yaw_between(a, b):
    """Rotation about Y taking a's horizontal direction to b's."""
    ang = math.atan2(b[0], b[2]) - math.atan2(a[0], a[2])
    return rig.axis_angle([0, 1, 0], ang)


class Retarget:
    """Moves points from her figure (game axes, figure metres) into an FFXIV race's bind pose."""

    def __init__(self, race, prof, J, pos, lab):
        names, parent, world = rig.load_skeleton(f"skeleton_{race}")
        F = {n: world[n][:3, 3].copy() for n in names}
        for s in SIDES:
            F[f"knee_{s}"] = (F[f"j_asi_b_{s}"] + F[f"j_asi_c_{s}"]) / 2
        self.F, self.prof, self.race = F, prof, race

        def dist(a, b):
            return float(np.linalg.norm(a - b))

        leg = (dist(F["j_asi_a_l"], F["knee_l"]) + dist(F["knee_l"], F["j_asi_d_l"])) / \
              (dist(J["hip_l"], J["knee_l"]) + dist(J["knee_l"], J["ankle_l"]))
        torso = (F["j_kubi"][1] - F["j_asi_a_l"][1]) / (J["neck"][1] - J["hip_l"][1])
        arm = (dist(F["j_ude_a_l"], F["j_ude_b_l"]) + dist(F["j_ude_b_l"], F["j_te_l"])) / \
              (dist(J["shoulder_l"], J["elbow_l"]) + dist(J["elbow_l"], J["wrist_l"]))
        self.scale = s = float(np.exp(np.mean(np.log([leg, torso]))))
        print(f"  size ratios FFXIV/figure: legs {leg:.3f} torso {torso:.3f} arms {arm:.3f} -> scale {s:.3f}")
        hip_m = (J["hip_l"] + J["hip_r"]) / 2
        hip_f = (F["j_asi_a_l"] + F["j_asi_a_r"]) / 2
        self.t = hip_f - s * hip_m
        H = {k: s * v + self.t for k, v in J.items()}
        for sd, sign in (("l", 1), ("r", -1)):
            # her clavicle along the FFXIV clavicle's direction, as long as hers is wide (neck to shoulder joint)
            d = unit(F[f"j_ude_a_{sd}"] - F[f"j_sako_{sd}"])
            H[f"clavicle_{sd}"] = H[f"shoulder_{sd}"] - d * abs(H[f"shoulder_{sd}"][0] - self.t[0]) / abs(d[0])
        self.H = H
        floor = self.t[1]

        # heels: uniform scale about her ankle, sole on the floor, ankle over the FFXIV ankle
        kf = prof["foot"]
        A = {}
        for sd in SIDES:
            a = F[f"j_asi_d_{sd}"].copy()
            a[1] = kf * (H[f"ankle_{sd}"][1] - floor)
            A[sd] = a
        self.ankle = A

        def mid(k):
            return (H[f"{k}_l"] + H[f"{k}_r"]) / 2

        def fmid(k):
            return (F[f"{k}_l"] + F[f"{k}_r"]) / 2

        knots = [(mid("ankle"), (A["l"] + A["r"]) / 2), (mid("knee"), fmid("knee")), (mid("hip"), fmid("j_asi_a")),
                 (mid("shoulder"), fmid("j_ude_a")), (H["neck"], F["j_kubi"])]
        self.ky = np.array([h[1] for h, _ in knots])
        self.fy = np.array([f[1] for _, f in knots])
        assert np.all(np.diff(self.ky) > 0) and np.all(np.diff(self.fy) > 0)
        self.dz = np.array([f[2] - h[2] for h, f in knots])
        self.cx = np.array([h[0] for h, _ in knots])
        half = lambda k: (H[f"{k}_l"][0] - H[f"{k}_r"][0]) / 2  # noqa: E731
        sh = F["j_ude_a_l"][0] / half("shoulder")
        sh = sh + prof["shoulder"] * (1 - sh)
        self.sx_y = np.array([mid("hip")[1], mid("shoulder")[1]])
        self.sx_v = np.array([F["j_asi_a_l"][0] / half("hip"), sh])
        print("  lattice y", np.round(self.ky, 3), "->", np.round(self.fy, 3), " width", np.round(self.sx_v, 3),
              " dz", np.round(self.dz, 3))

        # head: uniform scale about her head joint, her eyes onto the FFXIV eyes (Lalafell: skull centre onto the
        # centre of their much bigger skull); the neck stretches to meet it
        kh = prof["head"]
        if prof.get("align") == "centre":
            eyes_m = self.skull_centre(pos, lab) * s + self.t
            eyes_f = self.ffxiv_face_centre(race)
        else:
            eyes_m = H["eyes"]
            eyes_f = self.ffxiv_eyes(race)
        eyes_f = eyes_f + np.array([0, prof.get("eye_dy", 0.0), prof["eye_dz"]])
        head_base = eyes_f - kh * (eyes_m - H["head"])
        self.head_base = head_base
        print(f"  eyes: hers {np.round(eyes_m, 3)} -> FFXIV {np.round(eyes_f, 3)}; head joint "
              f"{np.round(H['head'], 3)} -> {np.round(head_base, 3)} (j_kao {np.round(F['j_kao'], 3)})")

        # segment -> (her joint, her child joint, FFXIV start, FFXIV target, kind, extra)
        # the neck reaches the head's own move at the collar's top edge (neck_top), where the head takes over
        D = {"neck": ("neck", "neck_top", F["j_kubi"], head_base + kh * (H["neck_top"] - H["head"]), "stretch", None),
             "head": ("head", None, head_base, head_base, "head", None)}
        for sd in SIDES:
            D.update({
                f"shoulder.{sd}": (f"clavicle_{sd}", f"shoulder_{sd}", F[f"j_sako_{sd}"], F[f"j_ude_a_{sd}"], "stretch",
                                   None),
                f"upper_arm.{sd}": (f"shoulder_{sd}", f"elbow_{sd}", F[f"j_ude_a_{sd}"], F[f"j_ude_b_{sd}"], "stretch",
                                    None),
                f"forearm.{sd}": (f"elbow_{sd}", f"wrist_{sd}", F[f"j_ude_b_{sd}"], F[f"j_te_{sd}"], "stretch", None),
                f"hand.{sd}": (f"wrist_{sd}", f"hand_{sd}", F[f"j_te_{sd}"], F[f"j_naka_a_{sd}"], "hand",
                               ((f"knuckle_pinky_{sd}", f"knuckle_index_{sd}"), (F[f"j_ko_a_{sd}"], F[f"j_hito_a_{sd}"]))),
                f"thigh.{sd}": (f"hip_{sd}", f"knee_{sd}", F[f"j_asi_a_{sd}"], F[f"knee_{sd}"], "stretch", None),
                f"shin.{sd}": (f"knee_{sd}", f"ankle_{sd}", F[f"knee_{sd}"], A[sd], "stretch", None),
                f"foot.{sd}": (f"ankle_{sd}", f"toe_{sd}", A[sd], F[f"j_asi_e_{sd}"], "place", None),
            })
            for dg in DIGITS:
                b_ = FINGER_BONE[dg]
                D[f"{dg}.{sd}"] = (f"knuckle_{dg}_{sd}", f"tip_{dg}_{sd}", F[f"j_{b_}_a_{sd}"], F[f"j_{b_}_b_{sd}"],
                                   "finger", None)
        parent_seg = {"head": "neck", "neck": None}
        for sd in SIDES:
            parent_seg.update({f"shoulder.{sd}": None, f"upper_arm.{sd}": f"shoulder.{sd}",
                               f"forearm.{sd}": f"upper_arm.{sd}", f"hand.{sd}": f"forearm.{sd}",
                               f"thigh.{sd}": None, f"shin.{sd}": f"thigh.{sd}", f"foot.{sd}": f"shin.{sd}"})
            parent_seg.update({f"{dg}.{sd}": f"hand.{sd}" for dg in DIGITS})
        order = ["neck", "head"] + [f"{seg}.{sd}" for sd in SIDES for seg in
                                    ("shoulder", "upper_arm", "forearm", "hand", "thigh", "shin", "foot") + DIGITS]
        M = {}
        moved = {}
        for seg in order:
            b, child, f0, f1, kind, extra = D[seg]
            p = parent_seg[seg]
            anchor = self.field_point(H[b]) if p is None else (M[p] @ np.append(H[b], 1))[:3]
            if kind == "head":
                M[seg] = affine(np.eye(3) * kh, H[b], head_base)
                continue
            if kind == "finger":
                # her finger as it is, carried on from the hand's turn and scale, its root on the FFXIV knuckle and
                # aimed along the FFXIV finger
                Lp = M[p][:3, :3]
                M[seg] = affine(rig.rot_between(Lp @ (H[child] - H[b]), f1 - f0) @ Lp, H[b], f0)
                if seg.endswith("l"):
                    turn = math.degrees(math.acos(np.clip(unit(Lp @ (H[child] - H[b])) @ unit(f1 - f0), -1, 1)))
                    moved[seg[:-2]] = (np.linalg.norm(f0 - anchor) * 1000, turn)
                continue
            if kind == "place":
                # toes turned to point where the FFXIV toes point (about the vertical only), heel kept as modelled
                Ry = yaw_between(H[child] - H[b], f1 - f0)
                M[seg] = affine(Ry * kf, H[b], f0)
                if seg.endswith("l"):
                    print(f"  {seg:12s} turned {math.degrees(math.acos(np.clip(Ry[0, 0], -1, 1))):5.1f} deg about Y")
                continue
            d_s = H[child] - H[b]
            d_f = f1 - anchor if kind == "stretch" else f1 - f0
            if seg == "neck":
                # sheared, not swung: her neck's axis onto the FFXIV one, every level of the collar moved as a whole
                if d_f[1] < 0.25 * d_s[1]:          # a big head (Lalafell) sits almost on the shoulders
                    d_f = d_f * [1, 0, 1] + [0, 0.25 * d_s[1], 0]
                u = d_s / np.linalg.norm(d_s)
                M[seg] = affine(np.eye(3) + np.outer(d_f - d_s, u) / np.linalg.norm(d_s), H[b], anchor)
                continue
            R = rig.rot_between(d_s, d_f)
            k = np.linalg.norm(d_f) / np.linalg.norm(d_s)
            if kind == "hand":
                (ga, gb), (fa, fb) = extra
                u = R @ (H[gb] - H[ga])
                w = fb - fa
                ax = unit(d_f)
                u -= ax * np.dot(u, ax)
                w -= ax * np.dot(w, ax)
                R = rig.axis_angle(ax, math.atan2(np.dot(np.cross(u, w), ax), np.dot(u, w))) @ R
                kk = float(np.clip(k, 0.7, 1.25))
                M[seg] = affine(R * kk, H[b], f0)
                if seg.endswith("l"):
                    print(f"  {seg:12s} scaled x{kk:.2f} (wanted x{k:.2f})")
                continue
            u = d_s / np.linalg.norm(d_s)
            lin = R @ (np.eye(3) + (k - 1) * np.outer(u, u))
            M[seg] = affine(lin, H[b], anchor)
            ang = math.degrees(math.acos(np.clip(unit(d_s) @ unit(d_f), -1, 1)))
            if seg.endswith("l") or seg == "neck":
                print(f"  {seg:12s} turned {ang:5.1f} deg, stretched x{k:.2f}")
        self.M = M
        print("  fingers moved onto the FFXIV knuckles (left): "
              + ", ".join(f"{k} {mm:.0f} mm / {deg:.0f} deg" for k, (mm, deg) in moved.items()))

    @staticmethod
    def skull_centre(pos, lab):
        p = pos[lab == L["face"]]
        p = p[p[:, 1] > 0.875]
        c = (p.min(0) + p.max(0)) / 2
        c[0] = 0.0
        return c

    @staticmethod
    def ffxiv_face_centre(race):
        m = xd.model(f"chara/human/{race}/obj/face/f0001/model/{race}f0001_fac.mdl")
        me = next(x for x in m["meshes"] if "_fac_" in x["material"])
        keep = np.array([s < 0 or "atr_mim" not in me["sub_attrs"][s] for s in me["tri_sub"]])     # no ears
        p = me["pos"][np.unique(me["faces"][keep])]
        c = (p.min(0) + p.max(0)) / 2
        c[0] = 0.0
        return c

    @staticmethod
    def ffxiv_eyes(race):
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
        cx = np.interp(y, self.ky, self.cx)
        return np.stack([(p[:, 0] - cx) * sx, y2, p[:, 2] + np.interp(y, self.ky, self.dz)], 1), sx

    def field_point(self, p):
        return self.field(p[None, :])[0][0]

    def apply(self, pos, nrm, W):
        """Figure positions and normals with segment weights -> FFXIV bind pose."""
        P = pos * self.scale + self.t
        tp, tsx = self.field(P)
        out = np.zeros_like(P)
        lin = np.zeros((len(P), 3, 3))
        for g, seg in enumerate(SEGS):
            w = W[:, g]
            sel = w > 0
            if not sel.any():
                continue
            if seg == "torso":
                out[sel] += w[sel, None] * tp[sel]
                lin[sel] += w[sel, None, None] * np.array([np.diag([sx, 1, 1]) for sx in tsx[sel]])
            else:
                mm = self.M[seg]
                out[sel] += w[sel, None] * (P[sel] @ mm[:3, :3].T + mm[:3, 3])
                lin[sel] += w[sel, None, None] * mm[:3, :3]
        n = np.einsum("nij,nj->ni", np.linalg.inv(lin).transpose(0, 2, 1), nrm)
        return out, n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)


# ----------------------------------------------------------------------------- FFXIV weights

def to_arrays(d_list, k=4):
    B = np.full((len(d_list), k), "", object)
    Wt = np.zeros((len(d_list), k))
    for i, d in enumerate(d_list):
        top = sorted(((w, b) for b, w in d.items() if w > 1e-3), reverse=True)[:k]
        s = sum(w for w, _ in top)
        for j, (w, b) in enumerate(top):
            B[i, j], Wt[i, j] = b, w / s
    return B, Wt


def along(p, a, b):
    ax = b - a
    return (p - a) @ ax / np.dot(ax, ax)


FFXIV_BONE = {"neck": "j_kubi", "head": "j_kao"}
for _s in SIDES:
    FFXIV_BONE.update({f"shoulder.{_s}": f"j_sako_{_s}", f"upper_arm.{_s}": f"j_ude_a_{_s}",
                       f"forearm.{_s}": f"j_ude_b_{_s}", f"hand.{_s}": f"j_te_{_s}", f"thigh.{_s}": f"j_asi_a_{_s}",
                       f"shin.{_s}": f"j_asi_c_{_s}", f"foot.{_s}": f"j_asi_d_{_s}"})


def finger_bones(p, F, digit, s):
    """A finger vertex (FFXIV space) -> {bone: share}: j_*_a up to the FFXIV finger's middle joint, j_*_b past it,
    blended over FINGER_BLEND either side."""
    bn = FINGER_BONE[digit]
    a, b = F[f"j_{bn}_a_{s}"], F[f"j_{bn}_b_{s}"]
    t = smoothstep((np.dot(p - b, unit(b - a)) + FINGER_BLEND) / (2 * FINGER_BLEND))
    return {f"j_{bn}_a_{s}": 1 - t, f"j_{bn}_b_{s}": t}


def own_weights(W, pos, src, F, hair):
    """Segments renamed onto FFXIV bones, torso spread over the spine by height (the hair's torso share on the
    upper back), hands onto the fingers, arm weight shared with the twist helpers."""
    chain = [(F["j_kubi"][1] - 0.02, "j_kubi"), (F["j_sebo_c"][1], "j_sebo_c"), (F["j_sebo_b"][1], "j_sebo_b"),
             (F["j_sebo_a"][1], "j_sebo_a"), (F["j_asi_a_l"][1], "j_kosi")]
    hs = np.array([h for h, _ in chain])
    out = []
    for i in range(len(pos)):
        d = {}
        for g in np.nonzero(W[i] > 0)[0]:
            seg, w = SEGS[g], float(W[i, g])
            if seg.split(".")[0] in DIGITS:
                for b, k in finger_bones(pos[i], F, seg.split(".")[0], seg[-1]).items():
                    d[b] = d.get(b, 0) + w * k
                continue
            if seg != "torso":
                d[FFXIV_BONE[seg]] = d.get(FFXIV_BONE[seg], 0) + w
                continue
            if hair[i]:
                d["j_sebo_c"] = d.get("j_sebo_c", 0) + w
                continue
            y = pos[i, 1]
            if y >= hs[0]:
                d["j_kubi"] = d.get("j_kubi", 0) + w
            elif y <= hs[-1]:
                d["j_kosi"] = d.get("j_kosi", 0) + w
            else:
                j = np.nonzero(hs > y)[0][-1]
                t = (hs[j] - y) / (hs[j] - hs[j + 1])
                d[chain[j][1]] = d.get(chain[j][1], 0) + w * (1 - t)
                d[chain[j + 1][1]] = d.get(chain[j + 1][1], 0) + w * t
        out.append(d)
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
    return to_arrays(out)


# ----------------------------------------------------------------------------- neck cover

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


def cover_neck(parts, F, fit_race, prof):
    """Push her neck skin and collar out radially, about the j_kubi -> j_kao axis, until they clear the necks of every
    face that wears this fit by NECK_MARGIN (per 3 mm along the neck and 7.5 degrees round it, blurred). Above
    NECK_TOP (her jaw) nothing moves; the hair stays (solid, so the neck pushed into it is hidden)."""
    D = pbd.read()
    ks = float(np.linalg.norm(F["j_kao"] - F["j_kubi"])) / NECK_REF
    top, ramp = NECK_TOP * ks, NECK_RAMP * ks
    far, cap = prof.get("neck_far", NECK_FAR * ks), prof.get("neck_cap", NECK_CAP * ks)
    TB = np.arange(-0.02 * ks, top + ramp + 0.003, 0.003)
    AB = np.radians(np.arange(-180, 180.1, 7.5))
    env = np.zeros((len(TB) - 1, len(AB) - 1))
    used = []
    for race in COVER_RACES[fit_race]:
        for face in COVER_FACES:
            s = face_surface(race, face, fit_race, D)
            if s is None:
                continue
            t, th, r, _ = neck_polar(s, F)
            sel = (t > TB[0]) & (t < TB[-1]) & (r < far) & (np.abs(th) >= np.radians(NECK_SIDES))
            i, j = np.digitize(t[sel], TB) - 1, np.clip(np.digitize(th[sel], AB) - 1, 0, len(AB) - 2)
            np.maximum.at(env, (i, j), r[sel])
            used.append(f"{race}{face}")
    print(f"  neck cover: {len(used)} faces of {', '.join(COVER_RACES[fit_race])}; neck x{ks:.2f} the Midlander woman's")
    # her outermost closed surface per cell (cells she leaves empty borrow their neighbours round the neck)
    shell = np.zeros_like(env)
    for name in NECK_SHELL:
        t, th, r, _ = neck_polar(parts[name]["pos"], F)
        sel = (t > TB[0]) & (t < TB[-1]) & (r < far + 0.03)
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
    raw = float(np.where((env > 0) & (shell > 0), env + NECK_MARGIN - shell, 0).max())
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
        zone = (t > NECK_BOTTOM * ks) & (t < top + ramp) & (r < far + 0.03)
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
        d *= np.clip((t[zone] - NECK_BOTTOM * ks) / ramp, 0, 1)      # fade in above her collar's foot
        d *= np.clip((far + 0.03 - r[zone]) / 0.03, 0, 1)             # and out toward her shoulders
        dirs = rv[zone] / np.maximum(r[zone, None], 1e-6)
        p["pos"][zone] += dirs * d[:, None]
        if d.max() > 1e-4:
            moved[name] = (int((d > 1e-4).sum()), float(d.max()))
    print(f"  neck cover: needed up to {raw * 1000:.1f} mm (cap {cap * 1000:.0f}); moved "
          + ", ".join(f"{n} {c} verts (max {m * 1000:.1f} mm)" for n, (c, m) in moved.items()))


# ----------------------------------------------------------------------------- parts

def load_parts():
    """The baked game mesh by texture set, each vertex labelled as its texture set says (seam vertices can sit
    nearest a source vertex of the neighbouring region; that label would tear them off their own part)."""
    near = np.load(os.path.join(BAKE, "low_near.npy"))
    hlab = np.load(labels.OUT)
    parts = {}
    for name in bake.TEXSETS:
        d = dict(np.load(os.path.join(BAKE, f"low_{name}.npz")))
        lab = hlab[near[d["lowid"]]]
        if name == "head":
            lab = np.where(lab == L["clip"], L["clip"], L["face"])
        else:
            lab = np.full(len(lab), L["hair"] if name == "hair" else L["suit"])
        d["lab"] = lab.astype(np.int8)
        parts[name] = d
    return parts


def neck_weights(parts, F, prof):
    """Her neck skin and collar skinned as the vanilla faces skin their necks, by how far up the neck (u = 0 at
    j_kubi, 1 at j_kao) they are: j_kubi with some j_sebo_c below u 0.3, handing over to j_kao by u 0.55. Before, the
    neck skin was all head and stayed with it when a racial deformer stretched the neck (Elezen, Roegadyn women), and
    the wearer's own throat (on j_kubi) showed between her jaw and collar. Her chin and jaw stay rigid on the head:
    only the neck skin near the neck's axis (source radius < 3.2 cm, below her jaw) and the collar change."""
    ks = float(np.linalg.norm(F["j_kao"] - F["j_kubi"])) / NECK_REF
    top, ramp, far = NECK_TOP * ks, NECK_RAMP * ks, prof.get("neck_far", NECK_FAR * ks)
    length = float(np.linalg.norm(F["j_kao"] - F["j_kubi"]))
    changed = 0
    for name in ("head", "body"):
        p = parts[name]
        src = p["src"]
        r_src = np.hypot(src[:, 0], src[:, 2] - labels.NECK_Z)
        if name == "head":
            mine = (r_src < 0.032) & (src[:, 1] < 0.88)
        else:
            mine = (r_src < 0.045) & (src[:, 1] > COLLAR_LO)
        t, _, r, _ = neck_polar(p["pos"], F)
        fade = (np.clip((far + 0.03 - r) / 0.03, 0, 1) * np.clip((top + ramp - t) / ramp, 0, 1)
                * np.clip((t - NECK_BOTTOM * ks) / ramp, 0, 1) * mine)
        u = t / length
        kao = smoothstep((u - 0.3) / 0.25)
        sebo = 0.4 * (1 - smoothstep((u - 0.25) / 0.25))
        dl = []
        for i in range(len(t)):
            d = {b: w for b, w in zip(p["bones"][i], p["weights"][i]) if b and w > 0}
            if fade[i] > 0:
                d = {b: w * (1 - fade[i]) for b, w in d.items()}
                for b, w in (("j_kao", kao[i]), ("j_kubi", (1 - kao[i]) * (1 - sebo[i])),
                             ("j_sebo_c", (1 - kao[i]) * sebo[i])):
                    d[b] = d.get(b, 0) + fade[i] * w
                changed += 1
            dl.append(d)
        p["bones"], p["weights"] = to_arrays(dl)
    print(f"  neck weights: {changed} neck-skin and collar vertices skinned as the vanilla necks")


def cut_stretched(src_pos, pos, faces, scale, limit=2.5, min_len=0.01):
    """Triangles the fit pulls far longer than the figure had them (parts that move apart but were fused). Not in
    her hands: there the stretch is the web between thumb and index, which should stay closed."""
    e_src = np.linalg.norm(src_pos[faces[:, [1, 2, 0]]] - src_pos[faces], axis=2) * scale
    e_fit = np.linalg.norm(pos[faces[:, [1, 2, 0]]] - pos[faces], axis=2)
    bad = ((e_fit > limit * np.maximum(e_src, 1e-6)) & (e_fit > min_len)).any(1)
    bad &= np.abs(src_pos[faces].mean(1)[:, 0]) < jt.WRIST_X
    return faces[~bad], int(bad.sum())


def fit_race(race):
    prof = PROFILES[race]
    print(race)
    J = jt.load()
    d = np.load(os.path.join(ROOT, "work", "src", "high.npz"))
    rt = Retarget(race, prof, J, d["pos"], np.load(labels.OUT))
    F = rt.F
    parts = {}
    for name, p in load_parts().items():
        W, Wp, K = segment_weights(p["pos"], p["lab"], J)
        pos, nrm = rt.apply(p["pos"], p["nrm"], Wp)
        parts[name] = dict(pos=pos, nrm=nrm, uv=p["uv"], faces=p["faces"], vid=p["lowid"], W=W, hair=K["hair"],
                           texset=name, slot=None if name == "body" else "met", src=p["pos"], lab=p["lab"])
    for name, p in parts.items():
        p["faces"], n_cut = cut_stretched(p["src"], p["pos"], p["faces"], rt.scale)
        if n_cut:
            print(f"  {name}: cut {n_cut} stretched triangles")
    # after the cut: the neck cover stretches her nape on purpose (it fills the hollow down to her upper back)
    cover_neck(parts, F, race, prof)
    for name, p in parts.items():
        p["bones"], p["weights"] = own_weights(p.pop("W"), p["pos"], p["src"], F, p.pop("hair"))
    neck_weights(parts, F, prof)
    for n, p in sorted(parts.items()):
        print(f"  part {n:5s} slot {p['slot']}: {len(p['pos']):6d} verts {len(p['faces']):6d} tris, "
              f"y {p['pos'][:, 1].min():.3f}..{p['pos'][:, 1].max():.3f}, bones {len({b for b in p['bones'].ravel() if b})}")
    os.makedirs(os.path.join(ROOT, "work", "fit"), exist_ok=True)
    pickle.dump(dict(parts=parts, joints=F, ankle=rt.ankle, scale=rt.scale, head_base=rt.head_base),
                open(os.path.join(ROOT, "work", "fit", f"{race}.pkl"), "wb"))
    print("wrote", race)


if __name__ == "__main__":
    for r in (sys.argv[1:] or list(PROFILES)):
        fit_race(r)
