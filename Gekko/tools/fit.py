"""Fit Gekko (Valorant, Kingdom Archives rip) onto an FFXIV race skeleton.

His skeleton uses Riot's names (Pelvis, Spine1-4, Neck, Head, L_Clavicle, L_Shoulder = upper arm, L_Elbow = forearm,
L_Hand, L_Hip = thigh, L_Knee = shin, L_Foot, L_Toe); ALIAS gives them the generic names the retarget below uses.
Positions are retargeted through his own skeleton (bind pose):
  * one uniform scale (geometric mean of the leg, torso and arm length ratios), hips on the FFXIV hips
  * torso: a height lattice through his ankles, knees, hips, shoulders and neck; width scaled toward the FFXIV
    hips and, by `shoulder` (0 = onto the FFXIV joints, 1 = his own breadth), toward the FFXIV shoulders
  * limbs: one affine per bone, parents first, rotated onto the FFXIV bone and stretched to its length
  * palms: rotated so the knuckles line up with the FFXIV fingers, stretched so his middle knuckle meets theirs
  * fingers: rigid, each based on the FFXIV knuckle and aimed along the FFXIV finger; weight split between j_*_a and
    j_*_b where the FFXIV finger bends (FINGER_BLEND)
  * sneakers: rigid (scaled by `foot`), sole on the floor under the FFXIV ankle, toes turned to point forward
  * head: rigid, scaled by `head`, his eyes `eye_dz` in front of the FFXIV eyes; the neck stretches to meet it
Weights (his own, renamed onto FFXIV bones):
  * every joint goes to its nearest mapped ancestor: twist, "Ndl" and sleeve helpers to their limb, the front bag
    and its straps to the spine, face joints and the hair to the head
  * his pelvis and spine weight is spread over the FFXIV spine by height; arm weight is shared with the FFXIV twist
    helpers (n_hkata, n_hhiji, n_hte) the way the vanilla body shares it

Primitives (export_src.py order): 0 gloved hands, 1 vest, shirt, trousers and socks, 3 T-shirt sleeves, bag, thigh
pouch, sneakers and hair, 5 face, 6 teeth and tongue, 8 + 9 tattooed arms and neck (drawn with their second UV set,
where textures.py bakes the tattoo decal). Dropped: 2 eyelid shadow card (alpha blended in the viewer), 4 bag glass
(20% black), 7 tattoo decal sheet (a copy of 8 + 9).

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
from xiv_skeleton import Skeleton  # noqa: E402
from islands import components  # noqa: E402

ROOT = rig.ROOT
# Per race: shoulder breadth kept (0..1), head scale (on top of the body scale), sneaker scale, how far his eyes sit in
# front of (eye_dz) / above (eye_dy) the FFXIV eyes, or his skull centre from theirs (align="centre").
PROFILES = {
    "c0101": dict(shoulder=0.5, head=1.05, foot=0.9, eye_dz=0.012, eye_dy=0.0),
    "c0301": dict(shoulder=0.5, head=1.05, foot=0.9, eye_dz=0.018, eye_dy=0.0),
    "c0201": dict(shoulder=0.45, head=1.04, foot=0.85, eye_dz=0.015, eye_dy=0.0),
    # Roegadyn and Hrothgar men's necks are 8.5-11 cm round the axis (Peni Parker port): let the cover reach further
    "c0901": dict(shoulder=0.45, head=1.12, foot=0.8, eye_dz=0.025, eye_dy=0.0, neck_far=0.125, neck_cap=0.05),
    "c1101": dict(shoulder=0.6, head=2.4, foot=0.7, eye_dz=0.01, eye_dy=0.0, align="centre"),
}
# primitive -> (part name, texture set, UV set); missing: dropped
PRIMS = {0: ("hands", "main", "uv0"), 1: ("outfit", "main", "uv0"), 3: ("gear", "main", "uv0"),
         5: ("face", "main", "uv0"), 6: ("mouth", "main", "uv0"), 8: ("arms", "tattoo", "uv1"),
         9: ("neck", "tattoo", "uv1")}
EYE_PRIM = 2                    # the eyelid shadow card: only used to find his eyes
CHIN_BELOW_EYES = 0.12          # m, his chin under his eyes
SIDES = ("l", "r")
ALIAS = {"pelvis": "Pelvis", "neck_01": "Neck", "head": "Head"}
for _s, _S in (("l", "L"), ("r", "R")):
    ALIAS.update({f"clavicle_{_s}": f"{_S}_Clavicle", f"upperarm_{_s}": f"{_S}_Shoulder",
                  f"lowerarm_{_s}": f"{_S}_Elbow", f"hand_{_s}": f"{_S}_Hand", f"index_01_{_s}": f"{_S}_Index1",
                  f"middle_01_{_s}": f"{_S}_Middle1", f"pinky_01_{_s}": f"{_S}_Pinky1", f"thigh_{_s}": f"{_S}_Hip",
                  f"calf_{_s}": f"{_S}_Knee", f"foot_{_s}": f"{_S}_Foot", f"ball_{_s}": f"{_S}_Toe"})
TORSO = re.compile(r"Skeleton|Root|Splitter|Pelvis|Spine\d(_.*)?|FrontBag|Bag_Strap_.*")
FINGERS = {"Thumb": "oya", "Index": "hito", "Middle": "naka", "Ring": "kusu", "Pinky": "ko"}
# His fingers have three joints and sit off FFXIV's two-bone fingers: in 1.0.x they bent where his joints were, and the
# game's idle curl crumpled them. Each finger (Thumb1-3, Index1-3, ...) is now its own rigid segment with its base on
# the FFXIV knuckle (j_*_a), aimed along the FFXIV finger, and its weight splits between j_*_a and j_*_b by position
# along the FFXIV finger (from the Mantis and Peni Parker ports).
FINGER_BLEND = 0.006            # m either side of j_*_b where a finger's weight hands over from j_*_a
# The wearer's own face model carries the neck down to the collar, and in GS (1.0.x) it showed behind his ear and under
# his jaw. cover_neck (from the Peni Parker / Asuka ports) pushes his neck out until it clears every player face of the
# races that wear each fit, through the racial deformer.
COVER_RACES = {"c0201": ("c0201", "c0401", "c0601", "c0801", "c1001", "c1401", "c1601", "c1801"),
               "c0101": ("c0101", "c0501", "c0701", "c1301", "c1701"),
               "c0301": ("c0301",),
               "c0901": ("c0901", "c1501"),
               "c1101": ("c1101", "c1201")}
COVER_FACES = [f"f{i:04d}" for i in list(range(1, 9)) + list(range(101, 109))]     # player faces (f02xx are NPCs')
HIDDEN_EARS = {"atr_mim", "atr_top", "atr_hrn"}          # the head piece's EQP (the Moogle Head's) hides these
# Lengths for the Midlander woman, whose neck (j_kubi to j_kao) is NECK_REF long; each fit scales them by its own
NECK_REF = 0.1072
NECK_MARGIN = 0.0025            # m his neck keeps outside the wearer's (not scaled)
NECK_TOP = 0.075                # m along the neck from j_kubi: above this (his jaw and head) nothing moves
NECK_BOTTOM = -0.015            # below this (his shoulders) nothing moves; Elezen necks reach below j_kubi
NECK_RAMP = 0.015
NECK_FAR = 0.09                 # m from the neck axis: face parts further out are horns, manes and fangs, not neck
NECK_SIDES = 30                 # deg either side of the front left out: his chin covers the throat from the front
NECK_CAP = 0.03
# Races whose necks are thicker than the rest of their fit's: covering them pushed everyone's nape out to theirs
# (Roegadyn women 26 mm, Au Ra women 23, against Midlander women's 19) and flared the back of his neck (seen in game on
# 1.1.1). They keep a strip at the nape; the face hider option covers it (Au Ra need it for their horns anyway).
# Highlander men (32 mm against Midlander men's 17) showed their whole nape that way, so they have their own fit.
NECK_SKIP = ("c1001", "c1401")
NECK_SHELL = ("face", "neck", "outfit")     # what covers: neck skin (face and tattooed side) and the T-shirt collar
# The face model also carries the wearer's whole skull (the head piece's flags only hide the hair, scalp and ears), and
# in GS the crown of the Midlander woman, Highlander and Roegadyn women showed between the spikes of his short hair.
# cover_skull pushes his head out, by ray from the wearer's skull centre, until it clears them; his face (the front)
# stays as fitted.
SKULL_DIRS = 3000               # ray directions spread over the sphere (about 3.7 deg apart)
SKULL_BLUR = 10.0               # deg: neighbours whose need a direction takes on, and the blur
SKULL_EL = (-30.0, 90.0)        # elevations covered: from about the ear lobes (below: cover_neck) to the crown
SKULL_NAPE = 20.0               # deg lower at the back (|azimuth| 120 -> 150): the racial deformer lengthens Elezen
                                # necks, so their nape continues above the neck cover's top (a patch under his hair)
SKULL_FRONT = 75.0              # deg either side of straight ahead left alone (his face covers it)
SKULL_FADE = 15.0               # deg over which the push fades in at the bottom and toward the front
SKULL_MARGIN = 0.002            # m his head keeps outside the wearer's skull
SKULL_CAP = 0.025               # m at most (per profile: skull_cap)
SKULL_SKIP = ("c1501", "c1601")  # Hrothgar skulls (feline, 4-5 cm past his) would swell his head for every woman and
                                # Roegadyn man: they keep their show-through (the face hider option covers it)


# ----------------------------------------------------------------------------- joint maps

def _ancestors(j, B):
    while j is not None:
        yield j
        j = B[j]["parent"] if j in B else None


def segment_of(j, B):
    """Source joint -> the retarget segment that moves it (None: the torso lattice)."""
    for a in _ancestors(j, B):
        if TORSO.fullmatch(a):
            return None
        if a == "Head":
            return "head"
        if a in ("Neck", "Collar"):
            return "neck"
        m = re.fullmatch(r"([LR])_(Thumb|Index|Middle|Ring|Pinky)[1-3]", a)
        if m:
            return f"{m.group(2).lower()}.{m.group(1).lower()}"
        m = re.fullmatch(r"([LR])_(Clavicle|Shoulder|Elbow|Hand|Hip|Knee|Foot)", a)
        if m:
            seg = {"Clavicle": "shoulder", "Shoulder": "upper_arm", "Elbow": "forearm", "Hand": "hand",
                   "Hip": "thigh", "Knee": "shin", "Foot": "foot"}[m.group(2)]
            return f"{seg}.{m.group(1).lower()}"
    return None


def ffxiv_of(j, B):
    """Source joint -> FFXIV bone, "torso" (spread by height) or "finger:<ffxiv finger>:<side>" (split along the
    FFXIV finger)."""
    for a in _ancestors(j, B):
        if TORSO.fullmatch(a):
            return "torso"
        if a in ("Neck", "Collar"):
            return "j_kubi"
        if a == "Head":
            return "j_kao"
        m = re.fullmatch(r"([LR])_(Thumb|Index|Middle|Ring|Pinky)([0-3])", a)
        if m:
            s, f, k = m.group(1).lower(), m.group(2), int(m.group(3))
            if k == 0:              # metacarpal: the palm
                return f"j_te_{s}"
            return f"finger:{FINGERS[f]}:{s}"
        m = re.fullmatch(r"([LR])_(Clavicle|Shoulder|Elbow|Hand|Hip|Knee|Foot|Toe)", a)
        if m:
            return {"Clavicle": "j_sako", "Shoulder": "j_ude_a", "Elbow": "j_ude_b", "Hand": "j_te",
                    "Hip": "j_asi_a", "Knee": "j_asi_c", "Foot": "j_asi_d", "Toe": "j_asi_e"}[m.group(2)] + \
                f"_{m.group(1).lower()}"
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


def first_face(race):
    """The race's first player face model (Highlander, Elezen... number theirs from f0101)."""
    for f in ("f0001", "f0101", "f0201"):
        p = f"chara/human/{race}/obj/face/{f}/model/{race}{f}_fac.mdl"
        if xd.exists(p):
            return p
    raise FileNotFoundError(race)


class Retarget:
    """Moves points from Gekko's bind pose into an FFXIV race's bind pose."""

    def __init__(self, race, prof):
        self.B = B = sd.bones()
        names, parent, world = rig.load_skeleton(f"skeleton_{race}")
        F = {n: world[n][:3, 3].copy() for n in names}
        for s in SIDES:
            F[f"knee_{s}"] = (F[f"j_asi_b_{s}"] + F[f"j_asi_c_{s}"]) / 2
        self.F, self.prof, self.race = F, prof, race
        H0 = {n: b["head"] for n, b in B.items()}
        H0.update({k: H0[v] for k, v in ALIAS.items()})

        def dist(a, b):
            return float(np.linalg.norm(a - b))

        leg = (dist(F["j_asi_a_l"], F["knee_l"]) + dist(F["knee_l"], F["j_asi_d_l"])) / \
              (dist(H0["thigh_l"], H0["calf_l"]) + dist(H0["calf_l"], H0["foot_l"]))
        torso = (F["j_kubi"][1] - F["j_asi_a_l"][1]) / (H0["neck_01"][1] - H0["thigh_l"][1])
        arm = (dist(F["j_ude_a_l"], F["j_ude_b_l"]) + dist(F["j_ude_b_l"], F["j_te_l"])) / \
              (dist(H0["upperarm_l"], H0["lowerarm_l"]) + dist(H0["lowerarm_l"], H0["hand_l"]))
        self.scale = s = float(np.exp(np.mean(np.log([leg, torso, arm]))))
        print(f"  size ratios FFXIV/Gekko: legs {leg:.3f} torso {torso:.3f} arms {arm:.3f} -> scale {s:.3f}")
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
        print(f"  eyes: Gekko {np.round(eyes_m, 3)} -> FFXIV {np.round(eyes_f, 3)}; head joint "
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
                f"hand.{sd_}": (f"hand_{sd_}", f"middle_01_{sd_}", F[f"j_te_{sd_}"], F[f"j_naka_a_{sd_}"], "palm",
                                ((f"index_01_{sd_}", f"pinky_01_{sd_}"), (F[f"j_hito_a_{sd_}"], F[f"j_ko_a_{sd_}"]))),
                f"thigh.{sd_}": (f"thigh_{sd_}", f"calf_{sd_}", F[f"j_asi_a_{sd_}"], F[f"knee_{sd_}"], "stretch", None),
                f"shin.{sd_}": (f"calf_{sd_}", f"foot_{sd_}", F[f"knee_{sd_}"], A[sd_], "stretch", None),
                f"foot.{sd_}": (f"foot_{sd_}", f"ball_{sd_}", A[sd_], F[f"j_asi_e_{sd_}"], "place", None),
            })
            S = sd_.upper()
            for f, ff in FINGERS.items():
                D[f"{f.lower()}.{sd_}"] = (f"{S}_{f}1", f"{S}_{f}2", F[f"j_{ff}_a_{sd_}"], F[f"j_{ff}_b_{sd_}"],
                                           "finger", None)
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
                # his finger as it is, carried on from the palm's turn, its base on the FFXIV knuckle and aimed along
                # the FFXIV finger
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
            u = d_s / np.linalg.norm(d_s)
            lin = R @ (np.eye(3) + (k - 1) * np.outer(u, u))
            # the palm sits on the FFXIV wrist, rigid across and stretched along to the FFXIV middle knuckle
            M[seg] = affine(lin, H[b], f0 if kind == "palm" else anchor)
            ang = math.degrees(math.acos(np.clip(np.dot(d_s, d_f) / np.linalg.norm(d_s) / np.linalg.norm(d_f), -1, 1)))
            if seg.endswith("l") or seg == "neck":
                print(f"  {seg:12s} turned {ang:5.1f} deg, stretched x{k:.2f}")
        self.M = M
        print("  finger bases moved onto the FFXIV knuckles (left, mm): "
              + ", ".join(f"{k} {d * 1000:.1f}" for k, d in knuckles.items()))

    def src_eyes(self):
        """Centre of his eyelid shadow cards, which sit on the front of his eyeballs."""
        m = sd.mesh()
        p = m["pos"][np.unique(m["faces"][m["prim"] == EYE_PRIM])]
        c = (p.min(0) + p.max(0)) / 2
        c[0] = 0.0
        return c

    def src_skull_centre(self):
        """Centre of his head (face, ears and hair) from the chin up."""
        m = sd.mesh()
        p = m["pos"][np.unique(m["faces"][np.isin(m["prim"], [p for p, v in PRIMS.items() if v[0] in ("face", "gear")])])]
        p = p[(p[:, 1] > self.src_eyes()[1] - CHIN_BELOW_EYES) & (np.abs(p[:, 0]) < 0.12)]
        c = (p.min(0) + p.max(0)) / 2
        c[0] = 0.0
        return c

    def ffxiv_face_centre(self, race):
        m = xd.model(first_face(race))
        me = next(x for x in m["meshes"] if "_fac_" in x["material"])
        keep = np.array([s < 0 or "atr_mim" not in me["sub_attrs"][s] for s in me["tri_sub"]])     # no ears
        p = me["pos"][np.unique(me["faces"][keep])]
        c = (p.min(0) + p.max(0)) / 2
        c[0] = 0.0
        return c

    def ffxiv_eyes(self, race):
        m = xd.model(first_face(race))
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


def own_weights(m, pos, F, B):
    """His weights renamed onto FFXIV bones: torso spread by height, arm weight shared with the twist helpers."""
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
            elif n.startswith("finger:"):     # where the FFXIV finger bends, not where his did
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
        if "_etc_" in me["material"]:   # lash, brow and beard cards (Viera and Miqo'te men's face 2 beards hang 7 cm
            continue                    # out at the jaw): alpha cards, not a neck to cover
        if parents is not None:
            # the face's own expression bones (j_f_*) are in neither human.pbd nor the base skeleton: without a parent
            # they kept the source race's shape while the rest of the face was deformed, and in 1.1.0 Miqo'te and Au
            # Ra cheeks, jaws and irises landed 4 cm out at the sides of the neck (found by the Neon port too)
            parents = dict(parents)
            for b in {b for row in me["bones"] for b in row if b}:
                parents.setdefault(b, "j_kao")
        keep = np.array([s < 0 or not set(me["sub_attrs"][s]) & HIDDEN_EARS for s in me["tri_sub"]], bool)
        pos = me["pos"] if deform is None else pbd.deform(me["pos"], me["bones"], me["weights"], deform, parents)
        out.append(surface_points(pos[me["faces"][keep]], step))
    return np.vstack(out)


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


def neck_polar(p, F):
    a = F["j_kubi"]
    ax = (F["j_kao"] - a) / np.linalg.norm(F["j_kao"] - a)
    t = (p - a) @ ax
    r = p - a - np.outer(t, ax)
    return t, np.arctan2(r[:, 0], r[:, 2]), np.linalg.norm(r, axis=1), r


def sphere_dirs(n):
    """n unit vectors spread evenly over the sphere (Fibonacci lattice)."""
    i = np.arange(n) + 0.5
    y = 1 - 2 * i / n
    r = np.sqrt(1 - y * y)
    t = np.pi * (1 + 5 ** 0.5) * i
    return np.stack([r * np.sin(t), y, r * np.cos(t)], 1)


def nearest_dir(u, dirs):
    out = np.empty(len(u), int)
    for i in range(0, len(u), 20000):
        out[i:i + 20000] = np.argmax(u[i:i + 20000] @ dirs.T, 1)
    return out


def furthest_hits(c, dirs, tri):
    """For rays from c along dirs: the distance to the furthest triangle each one crosses (0 where it misses)."""
    out = np.zeros(len(dirs))
    if not len(tri):
        return out
    v0, e1, e2 = tri[:, 0], tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]
    rel = tri - c
    cd = rel.mean(1)
    cd /= np.linalg.norm(cd, axis=1, keepdims=True)
    vd = rel / np.linalg.norm(rel, axis=2, keepdims=True)
    reach = np.cos(np.minimum(np.arccos(np.clip(np.einsum("tk,tvk->tv", cd, vd).min(1), -1, 1)) + 0.02, np.pi))
    for i in range(0, len(dirs), 64):
        D = dirs[i:i + 64]
        cand = (D @ cd.T) >= reach[None, :]
        for k, row in enumerate(cand):
            idx = np.nonzero(row)[0]
            if not len(idx):
                continue
            d = D[k]
            p = np.cross(d, e2[idx])
            det = np.sum(e1[idx] * p, 1)
            ok = np.abs(det) > 1e-12
            inv = 1 / np.where(ok, det, 1)
            sv = c - v0[idx]
            u = np.sum(sv * p, 1) * inv
            q = np.cross(sv, e1[idx])
            v = (q @ d) * inv
            t = np.sum(e2[idx] * q, 1) * inv
            hit = ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 0)
            if hit.any():
                out[i + k] = t[hit].max()
    return out


def el_low(az):
    """Lowest elevation the skull cover reaches, by azimuth (deg): the ear lobes, SKULL_NAPE lower at the back."""
    return SKULL_EL[0] - SKULL_NAPE * np.clip((np.abs(az) - 120) / 30, 0, 1)


def cover_skull(parts, rt, fit_race, prof):
    """Push his head (hair, scalp, ears and the skin behind them) out radially until it clears the skull of every
    player face that wears this fit by SKULL_MARGIN. Per race, his fitted head goes through the racial deformer into
    that race (as the game does), and rays from the race's skull centre compare the furthest point of his head with the
    furthest point of each face; the per-ray shortfall (the most over races and faces) is blurred over SKULL_BLUR
    degrees and pushes his head out along the same directions in the fit. His hair is spiky, so a per-direction
    maximum of his surface counted the spike tips as cover; rays don't. The front SKULL_FRONT degrees (his face) and
    everything below SKULL_EL (the neck, see cover_neck) stay."""
    D = pbd.read()
    dirs = sphere_dirs(SKULL_DIRS)
    az_d = np.degrees(np.arctan2(dirs[:, 0], dirs[:, 2]))
    el_d = np.degrees(np.arcsin(np.clip(dirs[:, 1], -1, 1)))
    rays = (el_d > el_low(az_d) - SKULL_FADE) & (np.abs(az_d) > SKULL_FRONT - SKULL_FADE)
    fparents = race_parents(fit_race)
    head = {}
    for name, p in parts.items():      # his head and everything near it (the collar can shade the nape rays)
        near = np.linalg.norm(p["pos"] - rt.F["j_kao"], axis=1) < 0.35
        tri = p["faces"][near[p["faces"]].all(1)]
        if len(tri):
            head[name] = tri
    need = np.zeros(len(dirs))
    used = []
    per_race = {}
    for race in COVER_RACES[fit_race]:
        if race in SKULL_SKIP:
            continue
        deform = None if race == fit_race else pbd.chain(D, int(fit_race[1:]), int(race[1:]))
        his = []
        for name, tri in head.items():
            p = parts[name]
            pos = p["pos"] if deform is None else pbd.deform(p["pos"], p["bones"], p["weights"], deform, fparents)
            his.append(pos[tri])
        his = np.vstack(his)
        for face in COVER_FACES:
            path = f"chara/human/{race}/obj/face/{face}/model/{race}{face}_fac.mdl"
            if not xd.exists(path):
                continue
            ftri = []
            for me in xd.model(path)["meshes"]:
                if "_etc_" in me["material"]:
                    continue
                keep = np.array([s < 0 or not set(me["sub_attrs"][s]) & HIDDEN_EARS for s in me["tri_sub"]], bool)
                ftri.append(me["pos"][me["faces"][keep]])
            ftri = np.vstack(ftri)
            pts = ftri.reshape(-1, 3)
            c = (pts.min(0) + pts.max(0)) / 2
            c[0] = 0.0
            env = furthest_hits(c, dirs[rays], ftri)
            shell = furthest_hits(c, dirs[rays], his)
            short = np.where((env > 0) & (shell > 0), env + SKULL_MARGIN - shell, 0)
            need[rays] = np.maximum(need[rays], short)
            used.append(f"{race}{face}")
            per_race[race] = max(per_race.get(race, 0.0), float(short.max()))
    cap = prof.get("skull_cap", SKULL_CAP)
    raw = float(need.max())
    need = np.clip(need, 0, cap)
    # conservative: each direction needs what its neighbours need, then a soft blur
    cosd = dirs @ dirs.T
    near = cosd > np.cos(np.radians(SKULL_BLUR / 2))
    need = np.array([need[row].max() for row in near])
    wgt = np.exp(-(np.degrees(np.arccos(np.clip(cosd, -1, 1))) / SKULL_BLUR) ** 2)
    need = wgt @ need / wgt.sum(1)
    c = rt.ffxiv_face_centre(fit_race)
    moved = {}
    for name, p in parts.items():
        on_head = np.where(p["bones"] == "j_kao", p["weights"], 0).sum(1)
        v = p["pos"] - c
        r = np.linalg.norm(v, axis=1)
        u = v / np.maximum(r[:, None], 1e-9)
        az = np.degrees(np.arctan2(u[:, 0], u[:, 2]))
        el = np.degrees(np.arcsin(np.clip(u[:, 1], -1, 1)))
        zone = (on_head > 0.3) & (el > el_low(az) - SKULL_FADE) & (np.abs(az) > SKULL_FRONT - SKULL_FADE)
        if not zone.any():
            continue
        w = np.exp(-(np.degrees(np.arccos(np.clip(u[zone] @ dirs.T, -1, 1))) / (SKULL_BLUR / 2)) ** 2)
        d = w @ need / np.maximum(w.sum(1), 1e-9)
        d *= np.clip((el[zone] - el_low(az[zone]) + SKULL_FADE) / SKULL_FADE, 0, 1)   # fade in above the ear lobes
        d *= np.clip((np.abs(az[zone]) - SKULL_FRONT + SKULL_FADE) / SKULL_FADE, 0, 1)   # and away from his face
        d *= np.clip((on_head[zone] - 0.3) / 0.4, 0, 1)                                  # and off the neck
        p["pos"][zone] += u[zone] * d[:, None]
        if d.max() > 1e-4:
            moved[name] = (int((d > 1e-4).sum()), float(d.max()))
    print("  skull cover, shortfall per race (mm): " + ", ".join(f"{r} {v * 1000:.0f}" for r, v in per_race.items()))
    print(f"  skull cover: {len(used)} faces; needed up to {raw * 1000:.1f} mm (cap {cap * 1000:.0f}); moved "
          + ", ".join(f"{n} {c} verts (max {m * 1000:.1f} mm)" for n, (c, m) in moved.items()))


def cover_neck(parts, F, fit_race, prof):
    """Push his neck skin and collar out radially, about the j_kubi -> j_kao axis, until they clear the necks of every
    face that wears this fit by NECK_MARGIN (per 3 mm along the neck and 7.5 degrees round it, blurred). Above
    NECK_TOP (his jaw) nothing moves. Every layer in the zone moves by the same field, so they stay stacked."""
    D = pbd.read()
    ks = float(np.linalg.norm(F["j_kao"] - F["j_kubi"])) / NECK_REF
    top, ramp = NECK_TOP * ks, NECK_RAMP * ks
    far, cap = prof.get("neck_far", NECK_FAR * ks), prof.get("neck_cap", NECK_CAP * ks)
    TB = np.arange(-0.02 * ks, top + ramp + 0.003, 0.003)
    AB = np.radians(np.arange(-180, 180.1, 7.5))
    env = np.zeros((len(TB) - 1, len(AB) - 1))
    used = []
    for race in COVER_RACES[fit_race]:
        if race in SKULL_SKIP or race in NECK_SKIP:     # Hrothgar necks and manes, as for the skull; see NECK_SKIP
            continue
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
    # his outermost closed surface per cell (cells he leaves empty borrow their neighbours round the neck)
    shell = np.zeros_like(env)
    for name in NECK_SHELL + ("gear",):
        p = parts[name]
        faces = p["faces"]
        if name == "gear":          # only his hair (on the head): it covers the back of the wearer's skull
            on_head = np.where(p["bones"] == "j_kao", p["weights"], 0).sum(1) > 0.5
            faces = faces[on_head[faces].all(1)]
        tn, _, rn, _ = neck_polar(p["pos"], F)
        near = (tn > TB[0] - 0.02) & (tn < TB[-1] + 0.02) & (rn < far + 0.05)
        pos = surface_points(p["pos"][faces[near[faces].any(1)]])    # his surface, as densely as theirs
        t, th, r, _ = neck_polar(pos, F)
        sel = (t > TB[0]) & (t < TB[-1]) & (r < far + 0.03)
        i, j = np.digitize(t[sel], TB) - 1, np.clip(np.digitize(th[sel], AB) - 1, 0, len(AB) - 2)
        np.maximum.at(shell, (i, j), r[sel])
    for i in range(len(shell)):
        row = shell[i]
        if (row > 0).any() and (row == 0).any():
            k = np.nonzero(row > 0)[0]
            row[row == 0] = np.interp(np.nonzero(row == 0)[0], k, row[k], period=len(row))
    # each cell needs what its neighbours round the neck need, then a soft blur round and along the neck. Not spread
    # up and down it: under the skull the wearer's neck widens fast, and in 1.1.x taking the neighbours' need along the
    # neck (twice, and np.roll wrapped the skull row onto the collar row) pushed his nape out 10-14 mm past even a
    # Roegadyn woman's: the back of his neck flared out (seen in game)
    env = np.maximum.reduce([np.roll(env, dj, 1) for dj in (-1, 0, 1)])
    need = np.where((env > 0) & (shell > 0), np.clip(env + NECK_MARGIN - shell, 0, cap), 0)
    raw = float(np.where((env > 0) & (shell > 0), env + NECK_MARGIN - shell, 0).max())
    need = np.maximum.reduce([np.roll(need, dj, 1) for dj in (-1, 0, 1)])
    k = np.array([1, 2, 1]) / 4
    need = np.apply_along_axis(lambda c: np.convolve(np.r_[c[:1], c, c[-1:]], k, "valid"), 0, need)
    for _ in range(2):
        need = (np.roll(need, 1, 1) + 2 * need + np.roll(need, -1, 1)) / 4
    tc, ac = (TB[:-1] + TB[1:]) / 2, (AB[:-1] + AB[1:]) / 2
    moved = {}
    for name, p in parts.items():
        t, th, r, rv = neck_polar(p["pos"], F)
        zone = (t > NECK_BOTTOM * ks) & (t < top + ramp) & (r < far + 0.03)
        if not zone.any():
            continue
        fi = np.clip(np.interp(t[zone], tc, np.arange(len(tc))), 0, len(tc) - 1)
        # cell index round the neck, wrapping at +-180 deg (np.interp with period ran from the last cell back to the
        # first through the middle of the index range, so the nape's centre line read the front's zero push)
        fj = np.mod((th[zone] - ac[0]) / (ac[1] - ac[0]), len(ac))
        i0, j0 = np.floor(fi).astype(int), np.floor(fj).astype(int) % len(ac)
        i1, j1 = np.minimum(i0 + 1, len(tc) - 1), (j0 + 1) % len(ac)
        wi, wj = fi - np.floor(fi), fj - np.floor(fj)
        d = (need[i0, j0] * (1 - wi) * (1 - wj) + need[i1, j0] * wi * (1 - wj) + need[i0, j1] * (1 - wi) * wj
             + need[i1, j1] * wi * wj)
        d *= np.clip((top + ramp - t[zone]) / ramp, 0, 1)
        d *= np.clip((t[zone] - NECK_BOTTOM * ks) / ramp, 0, 1)      # fade in above his collar's foot
        d *= np.clip((far + 0.03 - r[zone]) / 0.03, 0, 1)             # and out toward his shoulders
        # and off his jaw and skull (head weight 0.45 -> 0.85): in 1.1.0 the push reached the underside of his jaw,
        # which stepped out past the jaw line in a dark crease (seen in game)
        # (only toward the front and sides, 100 -> 140 deg round: at the back there's no jaw, and fading there opened
        # a patch at the top of the nape on Elezen women in 1.1.2's checks)
        on_head = np.where(p["bones"] == "j_kao", p["weights"], 0).sum(1)[zone]
        jaw = np.clip((140 - np.abs(np.degrees(th[zone]))) / 40, 0, 1)
        d *= 1 - jaw * (1 - np.clip((0.85 - on_head) / 0.4, 0, 1))
        dirs = rv[zone] / np.maximum(r[zone, None], 1e-6)
        p["pos"][zone] += dirs * d[:, None]
        if d.max() > 1e-4:
            moved[name] = (int((d > 1e-4).sum()), float(d.max()))
    print(f"  neck cover: needed up to {raw * 1000:.1f} mm (cap {cap * 1000:.0f}); moved "
          + ", ".join(f"{n} {c} verts (max {m * 1000:.1f} mm)" for n, (c, m) in moved.items()))


def smoothstep(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def neck_weights(parts, F, prof):
    """His neck skin and T-shirt collar skinned as the vanilla faces skin their necks, by how far up the neck (u = 0
    at j_kubi, 1 at j_kao): j_kubi with some j_sebo_c below u 0.3, handing over to j_kao by u 0.55 (from the Asuka
    port). His own nape was mostly head weight, so where a racial deformer lengthens the neck (Elezen) it rode up
    with the head at the game's idle and uncovered the wearer's nape (a patch under his hair in GS). His jaw stays
    on the head (same jaw guard as cover_neck)."""
    ks = float(np.linalg.norm(F["j_kao"] - F["j_kubi"])) / NECK_REF
    top, ramp, far = NECK_TOP * ks, NECK_RAMP * ks, prof.get("neck_far", NECK_FAR * ks)
    length = float(np.linalg.norm(F["j_kao"] - F["j_kubi"]))
    changed = 0
    for name in ("face", "neck", "outfit"):
        p = parts[name]
        t, th, r, _ = neck_polar(p["pos"], F)
        w_kao = np.where(p["bones"] == "j_kao", p["weights"], 0).sum(1)
        jaw = np.clip((140 - np.abs(np.degrees(th))) / 40, 0, 1)
        fade = (np.clip((far + 0.03 - r) / 0.03, 0, 1) * np.clip((top + ramp - t) / ramp, 0, 1)
                * np.clip((t - NECK_BOTTOM * ks) / ramp, 0, 1)
                * (1 - jaw * (1 - np.clip((0.85 - w_kao) / 0.4, 0, 1))))
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


def fit_race(race):
    prof = PROFILES[race]
    print(race)
    rt = Retarget(race, prof)
    F = rt.F
    m = sd.mesh()
    pos, nrm = rt.apply(m)
    W = own_weights(m, pos, F, rt.B)
    parts = {}
    for prim, (name, texset, uvk) in PRIMS.items():
        f = m["faces"][m["prim"] == prim]
        used, remap = np.unique(f, return_inverse=True)
        faces = remap.reshape(-1, 3)
        uv = wrap_uv(m[uvk][used], faces) if uvk == "uv0" else m[uvk][used]
        Bn, Wt = to_arrays([W[i] for i in used])
        parts[name] = dict(pos=pos[used], nrm=nrm[used], uv=np.c_[uv[:, 0], 1 - uv[:, 1]], faces=faces,
                           vid=m["vid"][used], bones=Bn, weights=Wt, texset=texset, slot=None)
    cover_neck(parts, F, race, prof)
    cover_skull(parts, rt, race, prof)          # after the neck: below his ears the neck cover already pushed
    neck_weights(parts, F, prof)
    for n, p in sorted(parts.items()):
        print(f"  part {n:8s} {p['texset']:6s}: {len(p['pos']):5d} verts {len(p['faces']):5d} tris, "
              f"y {p['pos'][:, 1].min():.3f}..{p['pos'][:, 1].max():.3f}, "
              f"bones {len({b for b in p['bones'].ravel() if b})}")
    os.makedirs(os.path.join(ROOT, "work", "fit"), exist_ok=True)
    pickle.dump(dict(parts=parts, joints=F, ankle=rt.ankle, scale=rt.scale),
                open(os.path.join(ROOT, "work", "fit", f"{race}.pkl"), "wb"))
    print("wrote", race)


if __name__ == "__main__":
    for r in (sys.argv[1:] or list(PROFILES)):
        fit_race(r)
