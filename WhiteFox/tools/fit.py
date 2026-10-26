"""Fit White Fox (Marvel Rivals, Pink Paws; UE-style skeleton) onto an FFXIV race skeleton.

Positions are retargeted through her own skeleton (bind pose), the way the Mina port does it:
  * one uniform scale (geometric mean of the leg, torso and arm length ratios), hips on the FFXIV hips
  * torso: a height lattice through her ankles, knees, hips, shoulders and neck, scaled in width
  * limbs: one affine per bone, parents first, rotated onto the FFXIV bone and stretched to its length
  * hands: stretched along the palm to the FFXIV knuckles and across them to the FFXIV knuckle span, twisted so they line up with the FFXIV
    fingers; each finger keeps its shape, its base on j_*_a, aimed along the FFXIV finger (j_*_a -> j_*_b); the thumb
    keeps its base on her palm and is turned so its last knuckle lands on j_oya_b. After
    the Mantis and Loki ports
  * sandals: rigid (the heels keep their shape), sole on the floor under the FFXIV ankle
  * head: rigid, scaled by `head`, eyes on the FFXIV face's eyes; the neck stretches to meet it
  * tails: first posed as in her idle animation (tail_pose.py), then moved rigidly with the hips (body scale, no
    lattice stretch)
Every source joint is resolved through its parent chain: limb twist / fix joints follow their limb; face, hair,
ear, hat and bow joints the head; the necklace chain the spine (torso lattice); bracelets their forearm.
Weights:
  * her own weights renamed onto FFXIV bones; spine weight spread over the FFXIV spine by height; arm weight shared
    with the FFXIV twist helpers (n_hkata, n_hhiji, n_hte) the way the vanilla body shares it; knee fix joints on
    the FFXIV knee (j_asi_b)
  * fingers: split between j_*_a and j_*_b by position along the FFXIV finger, blending across j_*_b, so they
    bend where the game's fingers bend (her own finger joints don't line up with FFXIV's two-bone fingers)
  * hair and the big bow: the head, handing over to the upper back (j_sebo_c) from the jaw down, so the long back
    hair follows the torso instead of swinging through it when the head turns
  * eyes, hat, its flowers and the sunglasses' lenses: rigid on j_kao
  * tails: rigid on the waist (j_kosi)
Neck: her neck is pushed out just enough to cover the wearer's own face model, which carries the neck down to the
collar (cover_neck, from the PeniParker and Loki ports; tools/showthrough.py checks it).

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
import tail_pose  # noqa: E402
from texsets import LENS_UV, TEXSET, atlas_uv  # noqa: E402

ROOT = rig.ROOT
SIDES = (("l", "L"), ("r", "R"))
# Per race: head scale (on top of the body scale), boot scale, and how far her eyes sit in front of (eye_dz) and
# above (eye_dy) the FFXIV eyes, or her skull centre from theirs (align="centre", for the Lalafell's big head).
# Checked with tools/poke.py and tools/showthrough.py: the wearer's own face should stay inside her head. neck_cap:
# the most cover_neck may push her neck out; the men's necks are thicker, so their fits may go further (as in Loki).
PROFILES = {
    # (width, height, depth): 1.08 before 1.2.0 ("why head big"), 1.0 in 1.2.0, narrower in 1.2.1 ("feel like the head
    # is huge"). Height and depth stay: below them the top and back of the wearer's skull poke out (showthrough.py)
    "c0201": dict(head=(0.95, 1.0, 1.0), foot=1.0, eye_dz=0.010, eye_dy=-0.006),
    "c0101": dict(head=1.15, foot=1.0, eye_dz=0.005, neck_cap=0.014),
    "c0901": dict(head=1.15, foot=1.0, eye_dz=0.005, neck_cap=0.03),
    "c1101": dict(head=2.25, foot=1.0, eye_dz=0.018, eye_dy=0.012, align="centre"),
}
# source primitive -> (part name, slot; None = split by skin weight in build.py)
PARTS = {10: ("skin", None), 13: ("legs", None), 16: ("face", "met"), 15: ("eyes", "met"), 11: ("hair", "met"),
         17: ("ears", None), 19: ("hat", "met"), 20: ("lenses", "met"), 23: ("hatflowers", "met"), 25: ("bow", "met"),
         12: ("suit", None), 22: ("garter", "dwn"), 18: ("jacket", None), 21: ("jewels", None),
         24: ("flowers", None), 26: ("ribbons", None), 3: ("tail_m", "dwn"), 5: ("tail_l", "dwn"),
         7: ("tail_r", "dwn")}
RIGID_HEAD = ("eyes", "hat", "lenses", "hatflowers")
TAILS = ("tail_m", "tail_l", "tail_r")
LIMB = {"shoulder": "clavicle", "upper_arm": "upperarm", "forearm": "lowerarm", "hand": "hand", "thigh": "thigh",
        "shin": "calf", "foot": "foot"}
LIMB_SEG = {"clavicle": "shoulder", "upperarm": "upper_arm", "lowerarm": "forearm", "hand": "hand", "thigh": "thigh",
            "calf": "shin", "foot": "foot", "ball": "foot"}
LIMB_BONE = {"clavicle": "j_sako", "upperarm": "j_ude_a", "lowerarm": "j_ude_b", "hand": "j_te", "thigh": "j_asi_a",
             "calf": "j_asi_c", "foot": "j_asi_d", "ball": "j_asi_e"}
FINGER = {"thumb": "oya", "index": "hito", "middle": "naka", "ring": "kusu", "pinky": "ko"}
FINGER_BLEND = 0.006            # m either side of j_*_b where a finger's weight hands over from j_*_a


# The wearer's own face model (it carries the neck down to the collar) must stay inside her neck: the races that wear
# each fit through the racial deformer, every player face of theirs (tools/showthrough.py checks it). From the
# PeniParker port, via the Loki port: her neck is bare.
COVER_RACES = {"c0201": ("c0201", "c0401", "c0601", "c0801", "c1001", "c1401", "c1601", "c1801"),
               "c0101": ("c0101", "c0301", "c0501", "c0701", "c1301", "c1701"),
               "c0901": ("c0901", "c1501"),
               "c1101": ("c1101", "c1201")}
HIDDEN_EARS = {"atr_mim", "atr_top", "atr_hrn"}   # the head EQP shows no ears (human, Miqo'te) or Au Ra horns
FACE_IDS = [f"f{i:04d}" for i in list(range(1, 9)) + list(range(101, 109))]     # player faces (f02xx are NPC)
# Lengths below are for the Midlander woman, whose neck (j_kubi to j_kao) is NECK_REF long; each fit scales them by
# its own neck
NECK_REF = 0.1072
NECK_MARGIN = 0.0025            # m her outer neck surface keeps outside the wearer's (not scaled)
NECK_TOP = 0.065                # m along the neck from j_kubi: above this (her jaw and head) nothing moves
NECK_BOTTOM = 0.0               # below this (her collar and shoulders) nothing moves; the vanilla necks end ~0.02 up
NECK_RAMP = 0.015
NECK_SIDES = 0                  # deg from the front left out of the cover
NECK_FAR = 0.07                 # m from the neck axis: face parts further out are horns, manes and fangs, not neck
NECK_CAP = 0.008                # most a neck point moves out: 15 mm (Peni) hid 99.9% but thickened her slim neck in GS;
                                # 8 mm keeps its line and leaves ~0.1% (c0201, from below)
NECK_SKIP = ("hair", "bow", "eyes", "hat", "hatflowers", "lenses", "ears", "tail_m", "tail_l",
             "tail_r")   # hair, the bow, the rigid headpieces and the tails
NECK_SHELL = ("face", "skin")   # closed surfaces: what really covers (her head mesh carries the neck)
# The straw hat's brim, pulled in radially (source space, about the hat's axis): the FFXIV body is 0.92x her height
# and 0.88x her shoulder width, so at full size the brim read huge on her ("feel like the head is huge"). Only the
# brim moves (radius > HAT_BRIM_R0); the crown, its flowers and sunglasses and her head and hair stay inside 0.14 m.
HAT_AXIS = np.array([0.015, -0.006])     # x, z
HAT_BRIM_R0 = 0.15
HAT_BRIM = 0.8
HAIR_BAND = (0.03, 0.05)        # hair hands over from j_kao to j_sebo_c between (j_kao - a) and (j_kubi - b)


def src(key, S):
    return f"{LIMB[key]}_{S.lower()}"


# ----------------------------------------------------------------------------- source joints -> FFXIV

def _chain(j, J):
    while j is not None:
        yield j
        j = J[j]["parent"]


def segment_of(j, J):
    """Source joint -> retarget segment (None: torso lattice)."""
    for a in _chain(j, J):
        if a == "head":
            return "head"
        if a in ("neck_01", "neck_02"):
            return "neck"
        m = re.fullmatch(r"(thumb|index|middle|ring|pinky)_0\d_([lr])", a)
        if m:
            return f"{m.group(1)}.{m.group(2).upper()}"
        m = re.fullmatch(r"(clavicle|upperarm|lowerarm|hand|thigh|calf|foot|ball)_([lr])", a)
        if m:
            return f"{LIMB_SEG[m.group(1)]}.{m.group(2).upper()}"
    return None


def ffxiv_bone(j, J):
    """Source joint -> FFXIV bone; "torso" for the spine, pelvis and the accessory chains hung on them;
    "finger:<ffxiv finger>:<side>" for finger joints (split between j_*_a and j_*_b in own_weights)."""
    m = re.fullmatch(r"([LR])_Knee_Fix_\d+_Jnt", j)
    if m:
        return f"j_asi_b_{m.group(1).lower()}"
    for a in _chain(j, J):
        if a == "head":
            return "j_kao"
        if a in ("neck_01", "neck_02"):
            return "j_kubi"
        m = re.fullmatch(r"([LR])_Breast_\d+_Jnt", a)
        if m:
            return f"j_mune_{m.group(1).lower()}"
        m = re.fullmatch(r"(thumb|index|middle|ring|pinky)_0(\d)_([lr])", a)
        if m:
            return f"finger:{FINGER[m.group(1)]}:{m.group(3)}"
        m = re.fullmatch(r"(clavicle|upperarm|lowerarm|hand|thigh|calf|foot|ball)_([lr])", a)
        if m:
            return f"{LIMB_BONE[m.group(1)]}_{m.group(2)}"
    return "torso"


def affine(lin, src_point, dst_point):
    m = np.eye(4)
    m[:3, :3] = lin
    m[:3, 3] = dst_point - lin @ src_point
    return m


def eyeball_faces(m):
    """The eyeballs of the eye primitive (it also holds teeth, gums and tongue): islands above the mouth."""
    ids, inv = np.unique(m["vid"], return_inverse=True)
    uf = inv[m["faces"]]
    comp = components(uf, len(ids))[uf[:, 0]]
    keep = np.zeros(len(m["faces"]), bool)
    for c in np.unique(comp):
        sel = comp == c
        p = m["pos"][np.unique(m["faces"][sel])]
        if (p.min(0)[1] + p.max(0)[1]) / 2 > 1.64:
            keep |= sel
    return keep


# ----------------------------------------------------------------------------- retarget

class Retarget:
    """Moves points from White Fox's bind pose into an FFXIV race's bind pose."""

    def __init__(self, race, prof):
        self.J = J = sd.joints()
        names, parent, world = rig.load_skeleton(f"skeleton_{race}")
        F = {n: world[n][:3, 3].copy() for n in names}
        for s, _ in SIDES:
            F[f"knee_{s}"] = (F[f"j_asi_b_{s}"] + F[f"j_asi_c_{s}"]) / 2
        self.F, self.prof, self.race = F, prof, race
        H0 = {n: j["head"] for n, j in J.items()}

        def dist(a, b):
            return float(np.linalg.norm(a - b))

        leg = (dist(F["j_asi_a_l"], F["knee_l"]) + dist(F["knee_l"], F["j_asi_d_l"])) / \
              (dist(H0["thigh_l"], H0["calf_l"]) + dist(H0["calf_l"], H0["foot_l"]))
        torso = (F["j_kubi"][1] - F["j_asi_a_l"][1]) / (H0["neck_01"][1] - H0["thigh_l"][1])
        arm = (dist(F["j_ude_a_l"], F["j_ude_b_l"]) + dist(F["j_ude_b_l"], F["j_te_l"])) / \
              (dist(H0["upperarm_l"], H0["lowerarm_l"]) + dist(H0["lowerarm_l"], H0["hand_l"]))
        self.scale = s = float(np.exp(np.mean(np.log([leg, torso, arm]))))
        print(f"  size ratios FFXIV/White Fox: legs {leg:.3f} torso {torso:.3f} arms {arm:.3f} -> scale {s:.3f}")
        hip_m = (H0["thigh_l"] + H0["thigh_r"]) / 2
        hip_f = (F["j_asi_a_l"] + F["j_asi_a_r"]) / 2
        self.t = hip_f - s * hip_m
        H = {n: s * p + self.t for n, p in H0.items()}
        self.H = H
        floor = self.t[1]

        # boots: uniform scale about her ankle, sole on the floor, under the FFXIV ankle
        kf = prof["foot"]
        A = {}
        for sd_, S in SIDES:
            a = F[f"j_asi_d_{sd_}"].copy()
            a[1] = kf * (H[f"foot_{sd_}"][1] - floor)
            A[sd_] = a
        self.ankle = A

        knots = [("foot_l", A["l"]), ("calf_l", F["knee_l"]), ("thigh_l", F["j_asi_a_l"]),
                 ("upperarm_l", F["j_ude_a_l"]), ("neck_01", F["j_kubi"])]
        self.ky = np.array([H[a][1] for a, _ in knots])
        self.fy = np.array([f[1] for _, f in knots])
        assert np.all(np.diff(self.ky) > 0) and np.all(np.diff(self.fy) > 0), (self.ky, self.fy)
        self.sx_y = np.array([H["thigh_l"][1], H["upperarm_l"][1]])
        self.sx_v = np.array([F["j_asi_a_l"][0] / H["thigh_l"][0], F["j_ude_a_l"][0] / H["upperarm_l"][0]])
        self.dz = np.array([f[2] - H[a][2] for a, f in knots])
        print("  lattice y", np.round(self.ky, 3), "->", np.round(self.fy, 3), " width", np.round(self.sx_v, 3),
              " dz", np.round(self.dz, 3))

        # head: uniform scale about the head joint, her eyes onto the FFXIV eyes (or, for Lalafell, her skull's
        # centre onto the centre of their much bigger skull); the neck stretches to meet it
        # head: one scale, or (width, height, depth): the front view can shrink while the depth keeps covering the
        # back of the wearer's skull (FFXIV skulls are deeper front to back than hers)
        kh = np.diag(np.broadcast_to(np.asarray(prof["head"], float), (3,)))
        if prof.get("align") == "centre":
            eyes_m = self.skull_centre() * s + self.t
            eyes_f = self.ffxiv_face_centre(race)
        else:
            eyes_m = self.eyes() * s + self.t
            eyes_f = self.ffxiv_eyes(race)
        eyes_f = eyes_f + np.array([0, prof.get("eye_dy", 0.0), prof["eye_dz"]])
        head_base = eyes_f - kh @ (eyes_m - H["head"])
        print(f"  eyes: White Fox {np.round(eyes_m, 3)} -> FFXIV {np.round(eyes_f, 3)}; head base "
              f"{np.round(H['head'], 3)} -> {np.round(head_base, 3)} (j_kao {np.round(F['j_kao'], 3)})")

        # segment -> (joint, child joint or None, FFXIV start, FFXIV target, kind, twist)
        D = {"neck": ("neck_01", "head", F["j_kubi"], head_base, "stretch", None),
             "head": ("head", None, head_base, head_base, "head", None)}
        for sd_, S in SIDES:
            D.update({
                f"shoulder.{S}": (src("shoulder", S), src("upper_arm", S), F[f"j_sako_{sd_}"], F[f"j_ude_a_{sd_}"], "stretch", None),
                f"upper_arm.{S}": (src("upper_arm", S), src("forearm", S), F[f"j_ude_a_{sd_}"], F[f"j_ude_b_{sd_}"], "stretch", None),
                f"forearm.{S}": (src("forearm", S), src("hand", S), F[f"j_ude_b_{sd_}"], F[f"j_te_{sd_}"], "stretch", None),
                f"hand.{S}": (src("hand", S), f"middle_01_{sd_}", F[f"j_te_{sd_}"], F[f"j_naka_a_{sd_}"], "palm",
                              ((f"index_01_{sd_}", f"pinky_01_{sd_}"), (F[f"j_hito_a_{sd_}"], F[f"j_ko_a_{sd_}"]))),
                f"thigh.{S}": (src("thigh", S), src("shin", S), F[f"j_asi_a_{sd_}"], F[f"knee_{sd_}"], "stretch", None),
                f"shin.{S}": (src("shin", S), src("foot", S), F[f"knee_{sd_}"], A[sd_], "stretch", None),
                f"foot.{S}": (src("foot", S), None, A[sd_], A[sd_], "place", None),
            })
            for ue, ff in FINGER.items():
                D[f"{ue}.{S}"] = (f"{ue}_01_{sd_}", f"{ue}_02_{sd_}", F[f"j_{ff}_a_{sd_}"], F[f"j_{ff}_b_{sd_}"],
                                  "finger", None)
            # the thumb: FFXIV's two thumb bones span her three; j_oya_b sits on her last knuckle (thumb_03, within
            # 3 mm on every fitted race) while j_oya_a falls between her thumb_01 and thumb_02
            D[f"thumb.{S}"] = (f"thumb_01_{sd_}", f"thumb_03_{sd_}", F[f"j_oya_a_{sd_}"], F[f"j_oya_b_{sd_}"],
                               "thumb", None)
        parent_seg = {"head": "neck", "neck": None}
        for _, S in SIDES:
            parent_seg.update({f"shoulder.{S}": None, f"upper_arm.{S}": f"shoulder.{S}", f"forearm.{S}": f"upper_arm.{S}",
                               f"hand.{S}": f"forearm.{S}", f"thigh.{S}": None, f"shin.{S}": f"thigh.{S}",
                               f"foot.{S}": f"shin.{S}"})
            parent_seg.update({f"{ue}.{S}": f"hand.{S}" for ue in FINGER})
        order = ["neck", "head"] + [f"{seg}.{S}" for _, S in SIDES for seg in
                                    ("shoulder", "upper_arm", "forearm", "hand", "thigh", "shin", "foot")]
        order += [f"{ue}.{S}" for _, S in SIDES for ue in FINGER]
        M = {}
        knuckles = {}
        for seg in order:
            b, child, f0, f1, kind, twist = D[seg]
            p = parent_seg[seg]
            anchor = self.field_point(H[b]) if p is None else (M[p] @ np.append(H[b], 1))[:3]
            if kind == "head":
                M[seg] = affine(kh, H[b], anchor)
                continue
            if kind == "place":
                M[seg] = affine(np.eye(3) * kf, H[b], f1)
                continue
            if kind == "finger":
                # her finger as it is, carried on from the hand's turn, its base on the FFXIV knuckle and aimed along
                # the FFXIV finger
                Lp = M[p][:3, :3]
                M[seg] = affine(rig.rot_between(Lp @ (H[child] - H[b]), f1 - f0) @ Lp, H[b], f0)
                if seg.endswith(".L"):
                    knuckles[seg[:-2]] = np.linalg.norm(f0 - anchor)
                continue
            if kind == "thumb":
                # her thumb as it is, its base where her palm puts it, turned and scaled so her last knuckle lands on
                # j_oya_b, where the game bends it (pinning its base on j_oya_a pushed the whole thumb out: 18 mm on
                # the women's fit, 56 mm on the Roegadyn's, which stretched the web between thumb and wrist)
                Lp = M[p][:3, :3]
                d = Lp @ (H[child] - H[b])
                k = np.linalg.norm(f1 - anchor) / np.linalg.norm(d)
                M[seg] = affine(k * rig.rot_between(d, f1 - anchor) @ Lp, H[b], anchor)
                if seg.endswith(".L"):
                    print(f"  thumb: base kept on her palm, scaled x{k:.2f} to put her last knuckle on j_oya_b")
                continue
            d_s = H[child] - H[b]
            d_f = f1 - anchor if kind == "stretch" else f1 - f0
            R = rig.rot_between(d_s, d_f)
            if twist:
                (ga, gb), (fa, fb) = twist
                u = R @ (H[gb] - H[ga])
                w = fb - fa
                ax = d_f / np.linalg.norm(d_f)
                u -= ax * np.dot(u, ax)
                w -= ax * np.dot(w, ax)
                R = rig.axis_angle(ax, math.atan2(np.dot(np.cross(u, w), ax), np.dot(u, w))) @ R
            if kind == "rigid":
                lin = R
            else:
                k = np.linalg.norm(d_f) / np.linalg.norm(d_s)
                u = d_s / np.linalg.norm(d_s)
                S = np.eye(3) + (k - 1) * np.outer(u, u)
                if kind == "palm":
                    # across the knuckles too (index -> pinky), so her knuckles land near the FFXIV ones before the
                    # fingers are placed: Roegadyn hands are 1.7x her palm's length but 2.2x its width
                    (ga, gb), (fa, fb) = twist
                    v = H[gb] - H[ga]
                    v -= u * np.dot(v, u)
                    kw = np.linalg.norm(fb - fa) / np.linalg.norm(H[gb] - H[ga])
                    v /= np.linalg.norm(v)
                    n_ = np.cross(u, v)
                    S = S + (kw - 1) * np.outer(v, v) + (np.sqrt(k * kw) - 1) * np.outer(n_, n_)
                lin = R @ S
            M[seg] = affine(lin, H[b], anchor)
            ang = math.degrees(math.acos(np.clip(np.dot(d_s, d_f) / np.linalg.norm(d_s) / np.linalg.norm(d_f), -1, 1)))
            if seg.endswith("L") or seg == "neck":
                print(f"  {seg:12s} turned {ang:5.1f} deg" + (f", stretched x{np.linalg.norm(d_f) / np.linalg.norm(d_s):.2f}"
                                                          if kind in ("stretch", "palm") else ""))
        self.M = M
        print("  finger bases moved onto the FFXIV knuckles (left, mm): " +
              ", ".join(f"{k} {d * 1000:.1f}" for k, d in knuckles.items()))

    def eyes(self):
        m = sd.prim(15)
        m = sd.submesh(m, eyeball_faces(m))
        p = m["pos"]
        centres = [(q.min(0) + q.max(0)) / 2 for q in (p[p[:, 0] > 0], p[p[:, 0] < 0])]
        return np.mean(centres, axis=0)

    def skull_centre(self):
        p = sd.prim(16)["pos"]
        p = p[p[:, 1] > self.J["head"]["head"][1]]
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

    def apply_rigid_torso(self, m):
        """Body scale about the tails' root, moved to where the torso lattice puts that root (no lattice
        stretch: the tails keep their shape)."""
        root = self.J["M_Tail_A01"]["head"] * self.scale + self.t
        dst = self.field_point(root)
        P = m["pos"] * self.scale + self.t
        return P - root + dst, m["nrm"]

    def apply(self, m, rigid=None):
        """Mesh m (source bind pose) -> FFXIV positions and normals; rigid: a segment every vertex follows."""
        P = m["pos"] * self.scale + self.t
        tp, tsx = self.field(P)
        if rigid:
            mm = self.M[rigid]
            n = m["nrm"] @ np.linalg.inv(mm[:3, :3])
            return P @ mm[:3, :3].T + mm[:3, 3], n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
        seg_cache = {}
        out = np.zeros_like(P)
        lin = np.zeros((len(P), 3, 3))
        tot = np.zeros(len(P))
        for k in range(m["jnames"].shape[1]):
            for j in np.unique(m["jnames"][:, k]):
                sel = (m["jnames"][:, k] == j) & (m["weights"][:, k] > 0)
                if not sel.any():
                    continue
                if j not in seg_cache:
                    seg_cache[j] = segment_of(j, self.J)
                sg = seg_cache[j]
                w = m["weights"][sel, k]
                tot[sel] += w
                if sg is None:
                    out[sel] += w[:, None] * tp[sel]
                    lin[sel] += w[:, None, None] * np.array([np.diag([sx, 1, 1]) for sx in tsx[sel]])
                else:
                    mm = self.M[sg]
                    out[sel] += w[:, None] * (P[sel] @ mm[:3, :3].T + mm[:3, 3])
                    lin[sel] += w[:, None, None] * mm[:3, :3]
        none = tot < 1e-6
        out[none] = tp[none]
        lin[none] = np.eye(3)
        tot[none] = 1
        out /= tot[:, None]
        lin /= tot[:, None, None]
        n = np.einsum("nij,nj->ni", np.linalg.inv(lin).transpose(0, 2, 1), m["nrm"])
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


def own_weights(m, pos, F, J):
    """Her weights renamed onto FFXIV bones, torso spread by height, arm weight shared with the twist helpers."""
    chain = [(F["j_kubi"][1] - 0.02, "j_kubi"), (F["j_sebo_c"][1], "j_sebo_c"), (F["j_sebo_b"][1], "j_sebo_b"),
             (F["j_sebo_a"][1], "j_sebo_a"), (F["j_asi_a_l"][1], "j_kosi")]
    hs = np.array([h for h, _ in chain])
    names = {}
    out = []
    for i in range(len(pos)):
        d = {}
        torso = 0.0
        for j, w in zip(m["jnames"][i], m["weights"][i]):
            if w <= 0:
                continue
            if j not in names:
                names[j] = ffxiv_bone(j, J)
            n = names[j]
            if n == "torso":
                torso += w
            elif n.startswith("finger:"):
                _, f, side = n.split(":")
                a, b = F[f"j_{f}_a_{side}"], F[f"j_{f}_b_{side}"]
                ax = (b - a) / np.linalg.norm(b - a)
                t = np.clip((np.dot(pos[i] - b, ax) + FINGER_BLEND) / (2 * FINGER_BLEND), 0, 1)
                t = t * t * (3 - 2 * t)
                d[f"j_{f}_a_{side}"] = d.get(f"j_{f}_a_{side}", 0) + w * (1 - t)
                d[f"j_{f}_b_{side}"] = d.get(f"j_{f}_b_{side}", 0) + w * t
            else:
                d[n] = d.get(n, 0) + w
        if torso > 0:
            y = pos[i, 1]
            if y >= hs[0]:
                d["j_kubi"] = d.get("j_kubi", 0) + torso
            elif y <= hs[-1]:
                d["j_kosi"] = d.get("j_kosi", 0) + torso
            else:
                jj = np.nonzero(hs > y)[0][-1]
                t = (hs[jj] - y) / (hs[jj] - hs[jj + 1])
                d[chain[jj][1]] = d.get(chain[jj][1], 0) + torso * (1 - t)
                d[chain[jj + 1][1]] = d.get(chain[jj + 1][1], 0) + torso * t
        out.append(d)
    # twist helpers, as on the vanilla body
    for s in ("l", "r"):
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


def hair_weights(pos, F):
    """The head down to the jaw, then the upper back by the base of the neck."""
    top, bot = F["j_kao"][1] - HAIR_BAND[0], F["j_kubi"][1] - HAIR_BAND[1]
    t = np.clip((top - pos[:, 1]) / (top - bot), 0, 1)
    t = t * t * (3 - 2 * t)
    B = np.array([["j_kao", "j_sebo_c", "", ""]] * len(pos), object)
    W = np.c_[1 - t, t, np.zeros((len(pos), 2))]
    return B, W


def single(n, bone):
    return np.array([[bone, "", "", ""]] * n, object), np.tile([1.0, 0, 0, 0], (n, 1))


def race_parents(race):
    sk = Skeleton(xd.extract(f"chara/human/{race}/skeleton/base/b0001/skl_{race}b0001.sklb")[0])
    return {n: (sk.names[p] if p >= 0 else None) for n, p in zip(sk.names, sk.parents)}


def face_surface(race, face, fit_race, D, step=0.002):
    """Points over a vanilla face model's surface (ears and horns left out: the head piece hides them), taken into the fit
    race's bind space through the racial deformer. None if the face doesn't exist."""
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
    """Push her neck layers (neck skin, the jacket's collar, the necklaces) out radially, about the j_kubi -> j_kao axis, until her
    closed surfaces clear the necks of every face that wears this fit by NECK_MARGIN. Inner and outer layers move by
    the same amount, so the collar and necklaces stay on her skin. From the PeniParker port."""
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
            sel = (t > TB[0]) & (t < TB[-1]) & (r < far) & (np.abs(th) >= np.radians(NECK_SIDES))
            i, j = np.digitize(t[sel], TB) - 1, np.clip(np.digitize(th[sel], AB) - 1, 0, len(AB) - 2)
            np.maximum.at(env, (i, j), r[sel])
            used.append(f"{race}{face}")
    print(f"  neck cover: {len(used)} faces of {', '.join(COVER_RACES[fit_race])}; neck x{ks:.2f} the Midlander woman's")
    # her outermost closed surface per cell (cells she leaves empty borrow their neighbours round the neck)
    shell = np.zeros_like(env)
    for name in NECK_SHELL:
        t, th, r, _ = neck_polar(parts[name]["pos"], F)
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
        d *= np.clip((t[zone] - NECK_BOTTOM * ks) / ramp, 0, 1)      # fade in above her collar and shoulders
        dirs = rv[zone] / np.maximum(r[zone, None], 1e-6)
        p["pos"][zone] += dirs * d[:, None]
        if d.max() > 1e-4:
            moved[name] = (int((d > 1e-4).sum()), float(d.max()))
    print(f"  neck cover: needed up to {need.max() * 1000:.1f} mm; moved "
          + ", ".join(f"{n} {c} verts (max {m * 1000:.1f} mm)" for n, (c, m) in moved.items()))


# ----------------------------------------------------------------------------- parts

def brim_in(pos):
    """The hat with its brim pulled in radially by HAT_BRIM beyond HAT_BRIM_R0."""
    d = pos[:, [0, 2]] - HAT_AXIS
    r = np.linalg.norm(d, axis=1)
    k = np.where(r > HAT_BRIM_R0, (HAT_BRIM_R0 + (r - HAT_BRIM_R0) * HAT_BRIM) / np.maximum(r, 1e-9), 1.0)
    out = pos.copy()
    out[:, [0, 2]] = HAT_AXIS + d * k[:, None]
    return out


def part_uv(m):
    """Texture coordinates for the FFXIV material (glTF, v down)."""
    mat = m["material"]
    if TEXSET[mat] == "hair":
        return m["uv1"]
    if mat == "MI_10600_1060301_Equip_03_02":
        return np.tile(LENS_UV, (len(m["pos"]), 1))
    return atlas_uv(mat, m["uv0"])


def fit_race(race):
    prof = PROFILES[race]
    print(race)
    rt = Retarget(race, prof)
    F, J = rt.F, rt.J
    parts = {}
    for pi, (name, slot) in PARTS.items():
        m = sd.prim(pi)
        if name == "eyes":
            m = sd.submesh(m, eyeball_faces(m))
        if name == "hat":
            m["pos"] = brim_in(m["pos"])
        if name in TAILS:
            m["pos"], m["nrm"] = tail_pose.pose(m)
            pos, nrm = rt.apply_rigid_torso(m)
        else:
            pos, nrm = rt.apply(m, "head" if name in RIGID_HEAD else None)
        if name in RIGID_HEAD:
            B, W = single(len(pos), "j_kao")
        elif name in TAILS:
            B, W = single(len(pos), "j_kosi")
        elif name in ("hair", "bow"):
            B, W = hair_weights(pos, F)
        else:
            B, W = own_weights(m, pos, F, J)
        uv = part_uv(m)
        parts[name] = dict(pos=pos, nrm=nrm, uv=np.c_[uv[:, 0], 1 - uv[:, 1]], faces=m["faces"],
                           vid=m["vid"] + pi * 1_000_000, bones=B, weights=W, texset=TEXSET[m["material"]], slot=slot,
                           material=m["material"])
    cover_neck(parts, F, race, prof)
    for n, p in sorted(parts.items()):
        print(f"  part {n:9s} {p['texset']:5s} slot {str(p['slot']):4s}: {len(p['pos']):5d} verts {len(p['faces']):5d} tris, "
              f"y {p['pos'][:, 1].min():.3f}..{p['pos'][:, 1].max():.3f}, bones {len({b for b in p['bones'].ravel() if b})}")
    os.makedirs(os.path.join(ROOT, "work", "fit"), exist_ok=True)
    pickle.dump(dict(parts=parts, joints=F, ankle=rt.ankle, scale=rt.scale),
                open(os.path.join(ROOT, "work", "fit", f"{race}.pkl"), "wb"))
    print("wrote", race)


if __name__ == "__main__":
    for r in (sys.argv[1:] or list(PROFILES)):
        fit_race(r)
