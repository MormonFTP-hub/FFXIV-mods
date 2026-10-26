"""Fit Sailor Moon (the baked game mesh, work/bake) onto an FFXIV race skeleton, with FFXIV skin weights.

The figure has no rig, so every game-mesh vertex first gets weights on her own segments, from its paint region
(labels.py) and her measured joints (joints.py):
  * arms (puff sleeves, upper-arm skin, gloves, cuffs): clavicle / upper arm / forearm / hand, blended across
    each joint by the distance along the limb
  * legs (leg skin, boots): thigh / shin / foot, blended across knee and ankle; the top of the thigh and the
    leotard under the skirt share with the torso
  * neck (choker): between torso and head; face, ears, eyes, earrings: head
  * hair: the head's, down to the shoulders; the pigtails below hand over to the torso
  * everything else: torso (a height lattice)
Positions are then retargeted as in the Mina port:
  * one uniform scale (geometric mean of the leg, torso and arm length ratios), hips on the FFXIV hips
  * torso: a height lattice through her ankles, knees, hips, shoulders and neck, scaled in width
  * limbs: one affine per segment, parents first, rotated onto the FFXIV bone and stretched to its length
  * hands: rigid, turned so the palm lies as the FFXIV hand's; boots: rigid, turned to point straight ahead,
    heel on the floor under the FFXIV ankle
  * head: rigid, scaled by `head`, eyes on the FFXIV face's eyes (Lalafell: skull centre on skull centre)
FFXIV weights:
  * segments renamed onto FFXIV bones; torso spread over the spine by height; upper arm and forearm shared with
    the twist helpers as on the vanilla body
  * pigtails below the head: j_sebo_c (upper back), so they follow the body, not every turn of the head
  * skirt and the back bow's tails: the FFXIV skirt chains (physics), by angle round the body and height
Slots: Neo Queen's Tiara (met) gets head and hair; the Educand's sailor top gets torso, arms and gloves (the hands
slot is hidden); the skirt gets skirt, leotard bottom and legs; the loafers get the boots.

python -P -E tools/fit.py [race ...]   ->  work/fit/<race>.pkl
"""
import math
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import joints as jt  # noqa: E402
import labels  # noqa: E402
import paint  # noqa: E402
import pbd  # noqa: E402
import rig  # noqa: E402
import src  # noqa: E402
import xivdata as xd  # noqa: E402
from islands import components  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

ROOT = rig.ROOT
BAKE = os.path.join(ROOT, "work", "bake")
SIDES = ("l", "r")
# Per race: head scale (on top of the body scale), boot scale, how far her eyes sit in front of (eye_dz) and
# above (eye_dy) the FFXIV eyes, or her skull centre on theirs (align="centre", for the Lalafell's big head).
# Checked with tools/poke.py: the wearer's own face should stay inside her head.
PROFILES = {
    "c0201": dict(head=1.0, foot=1.0, eye_dz=0.012),
    "c0101": dict(head=1.08, foot=1.0, eye_dz=0.012),
    "c0901": dict(head=1.18, foot=1.0, eye_dz=0.02),
    "c1101": dict(head=1.82, foot=1.0, eye_dz=0.02, eye_dy=-0.02, align="centre"),
}
SEGS = ["torso", "neck", "head"] + [f"{seg}.{s}" for s in SIDES for seg in
                                    ("shoulder", "upper_arm", "forearm", "hand", "thigh", "shin", "foot")]
SI = {n: i for i, n in enumerate(SEGS)}
CLAVICLE = (0.04, 1.50, 0.08)       # her clavicle's inner end (x mirrored per side), figure metres
WAIST_BLEND = 0.035                 # m either side of a skirt joint where its weight hands over to the next
L = labels.LABEL
# Neck cover (from the Asuka / Peni Parker ports): the wearer's own face model carries the neck down to the collar,
# and her slim anime neck let it show at the nape and under the ears in GS. Every race that wears a fit:
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
NECK_BOTTOM = -0.015            # below this (her shoulders) nothing moves
NECK_RAMP = 0.015
NECK_FAR = 0.09                 # m from the neck axis: face parts further out are horns, manes and fangs, not neck
NECK_SIDES = 30                 # deg either side of the front left out: her chin covers the throat from the front
NECK_CAP = 0.02                 # Asuka's 3 cm made her bare nape a thick column in GS; Peni's slim neck took 8 mm
NECK_SHELL = ("head", "body")   # what covers: neck skin, choker and collar
NECK_SKIP = ("hair",)           # solid: a neck pushed into it is hidden inside
NECK_Z, NECK_R = 0.065, 0.075   # her neck's axis (figure z, at x 0) and the radius of her neck skin and choker


def ramp(v, a, b):
    return np.clip((v - a) / (b - a), 0, 1)


def smoothstep(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def unit(v):
    return v / np.linalg.norm(v)


# ----------------------------------------------------------------------------- her segments

def kinds(pos, lab):
    """Boolean masks of the body parts, by paint region and place."""
    skin = lab == L["skin"]
    arm = np.isin(lab, [L["shoulder"], L["glove"], L["cuff"]]) | \
        (skin & (np.abs(pos[:, 0]) > 0.12) & (pos[:, 1] > 1.2) & (pos[:, 1] < 1.5))
    leg = np.isin(lab, [L["boot"], L["crescent"]]) | (skin & (pos[:, 1] < 0.95))
    head = np.isin(lab, [L["eye"], L["earring"]]) | (skin & (pos[:, 1] > 1.6))
    hair = np.isin(lab, [L["hair"], L["barrette"], L["clip"]])
    tails = (lab == L["bow"]) & (pos[:, 1] < 1.16) & (pos[:, 2] < 0.05)
    skirt = (lab == L["skirt"]) | tails
    neck = (lab == L["choker"]) | (skin & (pos[:, 1] >= 1.5) & (pos[:, 1] <= 1.6))
    torso = ~(arm | leg | head | hair | skirt | neck)
    return dict(arm=arm, leg=leg, head=head, hair=hair, skirt=skirt, neck=neck, torso=torso)


def hair_head_fraction(pos):
    """1 where the hair moves with the head: all of it above the neck, and the back of the head down to the nape;
    0 for the pigtails from the shoulders down."""
    near_neck = np.hypot(pos[:, 0], pos[:, 2] - 0.07) < 0.11
    return np.maximum(ramp(pos[:, 1], 1.45, 1.62), near_neck * ramp(pos[:, 1], 1.50, 1.56))


def polyline_dist(p, pts):
    d = np.full(len(p), np.inf)
    for a, b in zip(pts[:-1], pts[1:]):
        ab = b - a
        t = np.clip((p - a) @ ab / (ab @ ab), 0, 1)
        d = np.minimum(d, np.linalg.norm(p - (a + t[:, None] * ab), axis=1))
    return d


def leg_side(pos, J):
    """'l'/'r' per vertex by the nearer leg (her left foot stands on the midline, so x alone won't do)."""
    dl, dr = (polyline_dist(pos, [J[f"{k}_{s}"] for k in ("hip", "knee", "ankle", "toe")]) for s in SIDES)
    return np.where(dl <= dr, "l", "r")


def segment_weights(pos, lab, J):
    K = kinds(pos, lab)
    side = leg_side(pos, J)
    W = np.zeros((len(pos), len(SEGS)))
    W[K["torso"] | K["skirt"], SI["torso"]] = 1
    W[K["head"], SI["head"]] = 1
    # neck: torso -> neck -> head up the choker
    n = K["neck"]
    up = ramp(pos[n, 1], 1.60, 1.625)
    lo = ramp(pos[n, 1], 1.54, 1.57)
    W[n, SI["head"]] = up
    W[n, SI["neck"]] = lo * (1 - up)
    W[n, SI["torso"]] = 1 - lo
    # hair
    h = K["hair"]
    f = hair_head_fraction(pos[h])
    W[h, SI["head"]] = f
    W[h, SI["torso"]] = 1 - f
    for s, sign in (("l", 1), ("r", -1)):
        # arms
        a = K["arm"] & (sign * pos[:, 0] > 0)
        sh, el, wr = J[f"shoulder_{s}"], J[f"elbow_{s}"], J[f"wrist_{s}"]
        uu, ul = unit(el - sh), unit(wr - el)
        p = pos[a]
        w_up = ramp((p - sh) @ uu, -0.03, 0.03)
        w_fo = ramp((p - el) @ ul, -0.03, 0.03)
        w_ha = ramp((p - wr) @ ul, -0.012, 0.012)
        W[a] = 0
        W[a, SI[f"hand.{s}"]] = w_ha
        W[a, SI[f"forearm.{s}"]] = w_fo * (1 - w_ha)
        W[a, SI[f"upper_arm.{s}"]] = (1 - w_fo) * (1 - w_ha) * w_up
        W[a, SI[f"shoulder.{s}"]] = (1 - w_fo) * (1 - w_ha) * (1 - w_up)
        # torso round the shoulder: collar and leotard over the shoulder share with clavicle and upper arm
        t = K["torso"] & (sign * pos[:, 0] > 0.07) & (pos[:, 1] > sh[1] - 0.12)
        p = pos[t]
        w_cl = ramp(sign * p[:, 0], 0.07, 0.13)
        w_ar = 0.5 * ramp((p - sh) @ uu, -0.02, 0.03) * (np.linalg.norm(p - sh, axis=1) < 0.09)
        W[t, SI["torso"]] = 1 - w_cl
        W[t, SI[f"shoulder.{s}"]] = w_cl * (1 - w_ar)
        W[t, SI[f"upper_arm.{s}"]] = w_cl * w_ar
        # legs
        g = K["leg"] & (side == s)
        hp, kn, an = J[f"hip_{s}"], J[f"knee_{s}"], J[f"ankle_{s}"]
        us = unit(an - kn)
        p = pos[g]
        w_sh = ramp((p - kn) @ us, -0.035, 0.035)
        w_ft = ramp((p - an) @ us, -0.01, 0.02)
        w_top = ramp(hp[1] + 0.03 - p[:, 1], 0.0, 0.08)        # top of the thigh shares with the hips
        W[g] = 0
        W[g, SI[f"foot.{s}"]] = w_ft
        W[g, SI[f"shin.{s}"]] = w_sh * (1 - w_ft)
        W[g, SI[f"thigh.{s}"]] = (1 - w_sh) * (1 - w_ft) * w_top
        W[g, SI["torso"]] = (1 - w_sh) * (1 - w_ft) * (1 - w_top)
        # the leotard under the skirt: hips, and the thigh towards the leg opening
        t = K["torso"] & (lab == L["bodysuit"]) & (pos[:, 1] < hp[1] + 0.06) & \
            (sign * (pos[:, 0] - jt.CROTCH_X) > 0)
        w = 0.6 * ramp(hp[1] + 0.06 - pos[t, 1], 0.0, 0.10)
        W[t, SI["torso"]] = 1 - w
        W[t, SI[f"thigh.{s}"]] = w
    assert np.allclose(W.sum(1), 1), "segment weights must add up to 1"
    return W, K


# ----------------------------------------------------------------------------- retarget

def affine(lin, src_point, dst_point):
    m = np.eye(4)
    m[:3, :3] = lin
    m[:3, 3] = dst_point - lin @ src_point
    return m


def palm_frame(pos, lab, J, s):
    """Her hand's finger axis and, across the palm, the axis towards the thumb side (forward)."""
    wr, tip = J[f"wrist_{s}"], J[f"fingertip_{s}"]
    sign = 1 if s == "l" else -1
    g = pos[(lab == L["glove"]) & (sign * pos[:, 0] > 0.12) & (pos[:, 1] < wr[1] - 0.005)]
    u = unit(tip - wr)
    c = g - g.mean(0)
    c -= np.outer(c @ u, u)
    _, _, vt = np.linalg.svd(c, full_matrices=False)
    v = vt[0]                      # widest direction across the hand: index to little finger
    if v[2] < 0:
        v = -v
    return u, v


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
        self.scale = s = float(np.exp(np.mean(np.log([leg, torso, arm]))))
        print(f"  size ratios FFXIV/figure: legs {leg:.3f} torso {torso:.3f} arms {arm:.3f} -> scale {s:.3f}")
        hip_m = (J["hip_l"] + J["hip_r"]) / 2
        hip_f = (F["j_asi_a_l"] + F["j_asi_a_r"]) / 2
        self.t = hip_f - s * hip_m
        H = {k: s * v + self.t for k, v in J.items()}
        for side, sign in (("l", 1), ("r", -1)):
            H[f"clavicle_{side}"] = s * np.array([sign * CLAVICLE[0], CLAVICLE[1], CLAVICLE[2]]) + self.t
        self.H = H
        floor = self.t[1]

        # boots: uniform scale about her ankle, heel on the floor, under the FFXIV ankle
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
        self.sx_y = np.array([mid("hip")[1], mid("shoulder")[1]])
        self.sx_v = np.array([F["j_asi_a_l"][0] / half("hip"), F["j_ude_a_l"][0] / half("shoulder")])
        print("  lattice y", np.round(self.ky, 3), "->", np.round(self.fy, 3), " width", np.round(self.sx_v, 3),
              " dz", np.round(self.dz, 3))

        # head: uniform scale about her head joint, her eyes onto the FFXIV eyes (or, for Lalafell, her skull's
        # centre onto the centre of their much bigger skull); the neck stretches to meet it
        kh = prof["head"]
        if prof.get("align") == "centre":
            eyes_m = self.skull_centre(pos, lab) * s + self.t
            eyes_f = self.ffxiv_face_centre(race)
        else:
            eyes_m = H["eyes"]
            eyes_f = self.ffxiv_eyes(race)
        eyes_f = eyes_f + np.array([0, prof.get("eye_dy", 0.0), prof["eye_dz"]])
        head_base = eyes_f - kh * (eyes_m - H["head"])
        print(f"  eyes: hers {np.round(eyes_m, 3)} -> FFXIV {np.round(eyes_f, 3)}; head joint "
              f"{np.round(H['head'], 3)} -> {np.round(head_base, 3)} (j_kao {np.round(F['j_kao'], 3)})")

        # segment -> (her joint, her child joint, FFXIV start, FFXIV target, kind, hand frames)
        D = {"neck": ("neck", "head", F["j_kubi"], head_base, "stretch", None),
             "head": ("head", None, head_base, head_base, "head", None)}
        for sd in SIDES:
            D.update({
                f"shoulder.{sd}": (f"clavicle_{sd}", f"shoulder_{sd}", F[f"j_sako_{sd}"], F[f"j_ude_a_{sd}"], "stretch",
                                   None),
                f"upper_arm.{sd}": (f"shoulder_{sd}", f"elbow_{sd}", F[f"j_ude_a_{sd}"], F[f"j_ude_b_{sd}"], "stretch",
                                    None),
                f"forearm.{sd}": (f"elbow_{sd}", f"wrist_{sd}", F[f"j_ude_b_{sd}"], F[f"j_te_{sd}"], "stretch", None),
                f"hand.{sd}": (f"wrist_{sd}", f"hand_{sd}", F[f"j_te_{sd}"], F[f"j_naka_a_{sd}"], "hand",
                               (palm_frame(pos, lab, J, sd),
                                (unit(F[f"j_naka_a_{sd}"] - F[f"j_te_{sd}"]), unit(F[f"j_hito_a_{sd}"] - F[f"j_ko_a_{sd}"])))),
                f"thigh.{sd}": (f"hip_{sd}", f"knee_{sd}", F[f"j_asi_a_{sd}"], F[f"knee_{sd}"], "stretch", None),
                f"shin.{sd}": (f"knee_{sd}", f"ankle_{sd}", F[f"knee_{sd}"], A[sd], "stretch", None),
                f"foot.{sd}": (f"ankle_{sd}", None, A[sd], A[sd], "foot",
                               (H[f"heel_{sd}"], H[f"toe_{sd}"], F[f"j_asi_d_{sd}"], F[f"j_asi_e_{sd}"])),
            })
        parent_seg = {"head": "neck", "neck": None}
        for sd in SIDES:
            parent_seg.update({f"shoulder.{sd}": None, f"upper_arm.{sd}": f"shoulder.{sd}",
                               f"forearm.{sd}": f"upper_arm.{sd}", f"hand.{sd}": f"forearm.{sd}",
                               f"thigh.{sd}": None, f"shin.{sd}": f"thigh.{sd}", f"foot.{sd}": f"shin.{sd}"})
        order = ["neck", "head"] + [f"{seg}.{sd}" for sd in SIDES for seg in
                                    ("shoulder", "upper_arm", "forearm", "hand", "thigh", "shin", "foot")]
        M = {}
        for seg in order:
            b, child, f0, f1, kind, extra = D[seg]
            p = parent_seg[seg]
            anchor = self.field_point(H[b]) if p is None else (M[p] @ np.append(H[b], 1))[:3]
            if kind == "head":
                M[seg] = affine(np.eye(3) * kh, H[b], anchor)
                continue
            if kind == "foot":
                heel, toe, fd, fe = extra
                d_s, d_f = (toe - heel) * [1, 0, 1], (fe - fd) * [1, 0, 1]
                M[seg] = affine(rig.rot_between(d_s, d_f) * kf, H[b], f1)
                print(f"  {seg:12s} turned {math.degrees(math.acos(np.clip(unit(d_s) @ unit(d_f), -1, 1))):5.1f} deg")
                continue
            d_s = H[child] - H[b]
            d_f = f1 - anchor if kind == "stretch" else f1 - f0
            if kind == "hand":
                (u_s, v_s), (u_f, v_f) = extra
                R = rig.frame(u_f, v_f) @ rig.frame(u_s, v_s).T
                lin = R
            else:
                R = rig.rot_between(d_s, d_f)
                k = np.linalg.norm(d_f) / np.linalg.norm(d_s)
                u = d_s / np.linalg.norm(d_s)
                lin = R @ (np.eye(3) + (k - 1) * np.outer(u, u))
            M[seg] = affine(lin, H[b], anchor)
            ang = math.degrees(math.acos(np.clip(unit(R @ d_s) @ unit(d_s), -1, 1)))
            print(f"  {seg:12s} turned {ang:5.1f} deg" +
                  (f", stretched x{np.linalg.norm(d_f) / np.linalg.norm(d_s):.2f}" if kind == "stretch" else ""))
        self.M = M

    @staticmethod
    def skull_centre(pos, lab):
        p = pos[(lab == L["skin"]) & (pos[:, 1] > 1.6) | (lab == L["eye"])]
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

    def apply(self, pos, nrm, tan, W):
        """Figure positions, normals, tangents (xyz + sign) with segment weights -> FFXIV bind pose."""
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
        n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
        t = np.einsum("nij,nj->ni", lin, tan[:, :3])
        t -= n * np.sum(t * n, 1, keepdims=True)
        t /= np.maximum(np.linalg.norm(t, axis=1, keepdims=True), 1e-9)
        sign = tan[:, 3] * np.sign(np.linalg.det(lin))
        return out, n, np.c_[t, sign]


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


def own_weights(W, pos, F, pigtail):
    """Segments renamed onto FFXIV bones, torso spread over the spine by height (the pigtails' torso share on the
    upper back), arm weight shared with the twist helpers."""
    chain = [(F["j_kubi"][1] - 0.02, "j_kubi"), (F["j_sebo_c"][1], "j_sebo_c"), (F["j_sebo_b"][1], "j_sebo_b"),
             (F["j_sebo_a"][1], "j_sebo_a"), (F["j_asi_a_l"][1], "j_kosi")]
    hs = np.array([h for h, _ in chain])
    out = []
    for i in range(len(pos)):
        d = {}
        for g in np.nonzero(W[i] > 0)[0]:
            seg, w = SEGS[g], float(W[i, g])
            if seg != "torso":
                d[FFXIV_BONE[seg]] = d.get(FFXIV_BONE[seg], 0) + w
                continue
            if pigtail[i]:
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


def skirt_weights(pos, F):
    """FFXIV skirt chains by angle round the body and height; above the waist joints, the hips."""
    chains = [f"{c}_{s}" for c, s in (("f", "l"), ("s", "l"), ("b", "l"), ("b", "r"), ("s", "r"), ("f", "r"))]
    joints = {c: [F[f"j_sk_{c[0]}_{lv}_{c[2]}"] for lv in "abc"] for c in chains}
    ang = np.array([math.atan2(joints[c][0][0], joints[c][0][2]) for c in chains])
    order = np.argsort(ang)
    chains = [chains[i] for i in order]
    ang = ang[order]
    theta = np.arctan2(pos[:, 0], pos[:, 2])
    out = []
    n = len(chains)
    for i, p in enumerate(pos):
        th = theta[i]
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
        out.append(d)
    return to_arrays(out)


# ----------------------------------------------------------------------------- parts

def body_slot(lab, pos):
    """Slot per vertex of the body texture set, by paint region."""
    slot = np.full(len(lab), "top", object)
    slot[np.isin(lab, [L["boot"], L["crescent"]])] = "sho"
    K = kinds(pos, lab)
    slot[K["skirt"] | K["leg"] & ~np.isin(lab, [L["boot"], L["crescent"]])] = "dwn"
    slot[(lab == L["waistband"]) | ((lab == L["bodysuit"]) & (pos[:, 1] < 1.12))] = "dwn"
    return slot


def load_parts():
    near = np.load(os.path.join(BAKE, "low_near.npy"))
    hlab = np.load(labels.OUT)
    parts = {}
    for name in paint.TEXSETS:
        d = dict(np.load(os.path.join(BAKE, f"low_{name}.npz")))
        d["lab"] = hlab[near[d["lowid"]]]
        parts[name] = d
    return parts


def cut_contacts(p):
    """Drop the few triangles where her fingertips are fused to the hair: hair and hand move apart in game."""
    hairish = np.isin(p["lab"], [L["hair"], L["barrette"], L["clip"]])
    glove = p["lab"] == L["glove"]
    f = p["faces"]
    bad = hairish[f].any(1) & glove[f].any(1)
    p["faces"] = f[~bad]
    return f[bad]


def cut_web(p, limit=0.042):
    """Her left forearm is fused to the skirt in the print, with a web of glove surface running into it (her
    other forearm is never wider than ~4.5 cm from its axis): drop glove triangles beyond `limit` there."""
    e, w = (np.array(v) for v in labels.FOREARMS[0])
    ax = w - e
    t = (p["pos"] - e) @ ax / (ax @ ax)
    d = np.linalg.norm(p["pos"] - (e + np.clip(t, 0, 1)[:, None] * ax), axis=1)
    web = (p["lab"] == L["glove"]) & (t > 0.2) & (t < 0.92) & (d > limit) & (d < 0.15)
    f = p["faces"]
    bad = web[f].any(1)
    p["faces"] = f[~bad]
    return f[bad]


def part_groups(K, pos, J):
    """Pieces that move apart in game: each arm, each leg, the hair, and the rest."""
    g = np.zeros(len(pos), np.int8)
    side = leg_side(pos, J)
    g[K["arm"] & (pos[:, 0] > 0)] = 1
    g[K["arm"] & (pos[:, 0] <= 0)] = 2
    g[K["leg"] & (side == "l")] = 3
    g[K["leg"] & (side == "r")] = 4
    g[K["hair"]] = 5
    return g


def cut_stretched(src_pos, pos, faces, scale, groups, limit=2.5, min_len=0.01):
    """Triangles the fit pulls far longer than the figure had them and that join two pieces that move apart:
    where the print fused them (arm and skirt, fingertips and hair). Stretch inside one piece (the neck under a
    bigger head) is the fit's own and stays."""
    e_src = np.linalg.norm(src_pos[faces[:, [1, 2, 0]]] - src_pos[faces], axis=2) * scale
    e_fit = np.linalg.norm(pos[faces[:, [1, 2, 0]]] - pos[faces], axis=2)
    g = groups[faces]
    mixed = (g != g[:, :1]).any(1)
    bad = ((e_fit > limit * np.maximum(e_src, 1e-6)) & (e_fit > min_len)).any(1) & mixed
    return faces[~bad], faces[bad]


def boundary_loops(faces):
    """Closed loops of edges used by one triangle only (the sculpt is watertight, so these are cut holes and
    the seams between texture sets)."""
    e = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    key = np.sort(e, 1)
    _, inv, cnt = np.unique(key, axis=0, return_inverse=True, return_counts=True)
    open_e = e[cnt[inv.ravel()] == 1]
    nxt = {}
    for a, b in open_e:          # directed as in their triangle: a loop runs a -> b -> ...
        nxt.setdefault(int(a), []).append(int(b))
    loops, seen = [], set()
    for start in list(nxt):
        if start in seen:
            continue
        loop, v = [], start
        while v not in seen and v in nxt:
            seen.add(v)
            loop.append(v)
            v = nxt[v][0]
        if v == start and len(loop) >= 3:
            loops.append(loop)
    return loops


def fill_holes(p, cut, max_perimeter=0.45, majority=0.7):
    """Close the holes the cuts leave (her forearm where it was fused to the skirt, fingertips in the hair) with a
    fan round the loop's centre. The patch is flat-coloured from one texel of the region round it: every new
    corner takes the UV of the nearest inner vertex of that region. Only loops left by the cuts (`cut`: vertices of
    cut triangles) are closed, not the seams between texture sets."""
    loops = boundary_loops(p["faces"])
    on_edge = np.zeros(len(p["pos"]), bool)
    for lp in loops:
        on_edge[lp] = True
    add = {k: [] for k in ("pos", "nrm", "tan", "uv", "lab", "bones", "weights", "src")}
    new_faces = []
    n = len(p["pos"])
    filled = 0
    for lp in loops:
        lp = np.array(lp)
        if cut[lp].mean() < 0.5:
            continue
        ring = p["pos"][lp]
        if np.linalg.norm(ring - np.roll(ring, 1, 0), axis=1).sum() > max_perimeter:
            continue
        labs, cnt = np.unique(p["lab"][lp], return_counts=True)
        if cnt.max() < majority * len(lp):
            continue
        lab = labs[cnt.argmax()]
        inner = np.nonzero((p["lab"] == lab) & ~on_edge)[0]
        if not len(inner):
            continue
        c = ring.mean(0)
        ref = inner[np.argmin(np.linalg.norm(p["pos"][inner] - c, axis=1))]
        k0 = n + sum(len(v) for v in add["pos"])
        for v in list(lp) + [None]:              # duplicates of the ring, then the centre
            src = lp[0] if v is None else v
            add["pos"].append([c] if v is None else [p["pos"][v]])
            add["src"].append([p["src"][lp].mean(0)] if v is None else [p["src"][v]])
            add["nrm"].append([p["nrm"][lp].mean(0)] if v is None else [p["nrm"][v]])
            add["tan"].append([p["tan"][src]])
            add["uv"].append([p["uv"][ref]])
            add["lab"].append([lab])
            add["bones"].append([p["bones"][src]])
            add["weights"].append([p["weights"][src]])
        m = len(lp)
        centre = k0 + m
        for i in range(m):              # the loop runs the way its neighbouring triangles do: reverse it to close
            new_faces.append([k0 + (i + 1) % m, k0 + i, centre])
        filled += 1
    if filled:
        for k, v in add.items():
            p[k] = np.concatenate([p[k], np.concatenate(v).astype(p[k].dtype)])
        p["faces"] = np.concatenate([p["faces"], np.array(new_faces)])
    return filled


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
    """Push her neck skin, choker and collar out radially, about the j_kubi -> j_kao axis, until they clear the necks
    of every face that wears this fit by NECK_MARGIN (per 3 mm along the neck and 7.5 degrees round it, blurred).
    Above NECK_TOP (her jaw) nothing moves; the hair stays (solid, so the neck pushed into it is hidden)."""
    D = pbd.read()
    ks = float(np.linalg.norm(F["j_kao"] - F["j_kubi"])) / NECK_REF
    top, rmp = NECK_TOP * ks, NECK_RAMP * ks
    far, cap = prof.get("neck_far", NECK_FAR * ks), prof.get("neck_cap", NECK_CAP * ks)
    TB = np.arange(-0.02 * ks, top + rmp + 0.003, 0.003)
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
        zone = (t > NECK_BOTTOM * ks) & (t < top + rmp) & (r < far + 0.03)
        if not zone.any():
            continue
        fi = np.clip(np.interp(t[zone], tc, np.arange(len(tc))), 0, len(tc) - 1)
        fj = np.interp(th[zone], ac, np.arange(len(ac)), period=2 * np.pi)
        i0, j0 = np.floor(fi).astype(int), np.floor(fj).astype(int) % len(ac)
        i1, j1 = np.minimum(i0 + 1, len(tc) - 1), (j0 + 1) % len(ac)
        wi, wj = fi - np.floor(fi), fj - np.floor(fj)
        d = (need[i0, j0] * (1 - wi) * (1 - wj) + need[i1, j0] * wi * (1 - wj) + need[i0, j1] * (1 - wi) * wj
             + need[i1, j1] * wi * wj)
        d *= np.clip((top + rmp - t[zone]) / rmp, 0, 1)
        d *= np.clip((t[zone] - NECK_BOTTOM * ks) / rmp, 0, 1)      # fade in above her collar's foot
        d *= np.clip((far + 0.03 - r[zone]) / 0.03, 0, 1)            # and out toward her shoulders
        dirs = rv[zone] / np.maximum(r[zone, None], 1e-6)
        p["pos"][zone] += dirs * d[:, None]
        if d.max() > 1e-4:
            moved[name] = (int((d > 1e-4).sum()), float(d.max()))
    print(f"  neck cover: needed up to {raw * 1000:.1f} mm (cap {cap * 1000:.0f}); moved "
          + ", ".join(f"{n} {c} verts (max {m * 1000:.1f} mm)" for n, (c, m) in moved.items()))


def neck_weights(parts, F, prof):
    """Her neck skin and choker skinned as the vanilla faces skin their necks, by how far up the neck (u = 0 at
    j_kubi, 1 at j_kao) they are: j_kubi with some j_sebo_c below u 0.3, handing over to j_kao by u 0.55. Without
    this the deformer's longer necks (Elezen, Roegadyn women) carried the head's share of her neck up with the head
    and the wearer's own throat (on j_kubi) showed. Her chin and jaw stay rigid on the head: only neck skin and
    choker near the neck's axis (figure radius < NECK_R) change."""
    ks = float(np.linalg.norm(F["j_kao"] - F["j_kubi"])) / NECK_REF
    top, rmp, far = NECK_TOP * ks, NECK_RAMP * ks, prof.get("neck_far", NECK_FAR * ks)
    length = float(np.linalg.norm(F["j_kao"] - F["j_kubi"]))
    changed = 0
    for name in NECK_SHELL:
        p = parts[name]
        src_ = p["src"]
        r_src = np.hypot(src_[:, 0], src_[:, 2] - NECK_Z)
        if name == "head":
            mine = (r_src < NECK_R) & (src_[:, 1] < 1.64) & (p["lab"] == L["skin"])
        else:
            mine = (r_src < NECK_R) & (src_[:, 1] > 1.54) & (p["lab"] == L["choker"])
        t, _, r, _ = neck_polar(p["pos"], F)
        fade = (np.clip((far + 0.03 - r) / 0.03, 0, 1) * np.clip((top + rmp - t) / rmp, 0, 1)
                * np.clip((t - NECK_BOTTOM * ks) / rmp, 0, 1) * mine)
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
    print(f"  neck weights: {changed} neck-skin and choker vertices skinned as the vanilla necks")


def drop_islands(p, cut, min_tris=60):
    """Loose bits the cuts leave behind (scraps of skirt that were fused to the forearm): small connected pieces
    that touch a cut."""
    f = p["faces"]
    comp = components(f, len(p["pos"]))[f[:, 0]]
    ids, cnt = np.unique(comp, return_counts=True)
    small = ids[cnt < min_tris]
    drop = np.isin(comp, small) & cut[f].any(1)
    p["faces"] = f[~drop]
    return int(drop.sum())


def sub(p, tri_sel):
    f = p["faces"][tri_sel]
    used, remap = np.unique(f, return_inverse=True)
    out = {k: (v[used] if isinstance(v, np.ndarray) and v.ndim and len(v) == len(p["pos"]) else v)
           for k, v in p.items()}
    out["faces"] = remap.reshape(-1, 3)
    return out


def fit_race(race):
    prof = PROFILES[race]
    print(race)
    J = jt.load()
    hpos, _, _ = src.load()
    hlab = np.load(labels.OUT)
    rt = Retarget(race, prof, J, hpos, hlab)
    F = rt.F
    parts = {}
    qs = {}
    for name, p in load_parts().items():
        cut = np.zeros(len(p["pos"]), bool)
        gone = np.concatenate([cut_contacts(p), cut_web(p)])
        cut[gone] = True
        W, K = segment_weights(p["pos"], p["lab"], J)
        pos, nrm, tan = rt.apply(p["pos"], p["nrm"], p["tan"], W)
        p["faces"], stretched = cut_stretched(p["pos"], pos, p["faces"], rt.scale, part_groups(K, p["pos"], J))
        cut[stretched] = True
        pigtail = K["hair"] & (W[:, SI["torso"]] > 0)
        B, Wt = own_weights(W, pos, F, pigtail)
        if K["skirt"].any():
            Bs, Ws = skirt_weights(pos[K["skirt"]], F)
            B[K["skirt"]], Wt[K["skirt"]] = Bs, Ws
        q = dict(pos=pos, nrm=nrm, tan=tan, uv=p["uv"], faces=p["faces"], lab=p["lab"], bones=B, weights=Wt,
                 texset=name, src=p["pos"])
        n_drop = drop_islands(q, cut)
        n_fill = fill_holes(q, cut)
        if len(gone) or len(stretched):
            print(f"  {name}: cut {len(gone)} hand/hair contact and {len(stretched)} stretched triangles, "
                  f"dropped {n_drop} triangles of loose scraps, closed {n_fill} holes")
        qs[name] = q
    # after the cuts: the push stretches her nape on purpose
    cover_neck(qs, F, race, prof)
    neck_weights(qs, F, prof)
    for name, q in qs.items():
        if name == "body":
            vslot = body_slot(q["lab"], q["src"])
            order = ["top", "dwn", "sho"]
            score = np.stack([(vslot == s) for s in order], 1).astype(float)
            tri = score[q["faces"]].sum(1).argmax(1)
            for i, s in enumerate(order):
                parts[f"body_{s}"] = dict(sub(q, tri == i), slot=s)
        else:
            parts[name] = dict(q, slot="met")
    for n, p in sorted(parts.items()):
        print(f"  part {n:9s} {p['texset']:5s} slot {p['slot']}: {len(p['pos']):6d} verts {len(p['faces']):6d} tris, "
              f"y {p['pos'][:, 1].min():.3f}..{p['pos'][:, 1].max():.3f}, bones {len({b for b in p['bones'].ravel() if b})}")
    os.makedirs(os.path.join(ROOT, "work", "fit"), exist_ok=True)
    pickle.dump(dict(parts=parts, joints=F, ankle=rt.ankle, scale=rt.scale),
                open(os.path.join(ROOT, "work", "fit", f"{race}.pkl"), "wb"))
    print("wrote", race)


if __name__ == "__main__":
    for r in (sys.argv[1:] or list(PROFILES)):
        fit_race(r)
