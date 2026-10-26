"""Fit Peni Parker (Marvel Rivals, Floral Frights; Unreal skeleton) onto an FFXIV race skeleton.

Positions are retargeted through her own skeleton (bind pose, joint positions):
  * one uniform scale (geometric mean of the leg, torso and arm length ratios), hips on the FFXIV hips
  * torso: a height lattice through her ankles, knees, hips, shoulders and neck, scaled in width
  * limbs: one affine per bone, parents first, rotated onto the FFXIV bone and stretched to its length
  * hands: rigid across the palm, stretched along it to the FFXIV knuckles and twisted so they line up with the FFXIV
    fingers; each finger keeps its shape, its base on the FFXIV knuckle (j_*_a), aimed along the FFXIV finger
  * shoes: rigid, sole on the floor under the FFXIV ankle
  * head: rigid, scaled by `head`, eyes on the FFXIV face's eyes; the neck stretches to meet it
Every source bone takes the segment and FFXIV bone of its nearest "key" ancestor (twist, volume and physics bones
follow the limb they hang from; facial, hair and flower-crown bones the head).
Weights:
  * fingers: split between j_*_a and j_*_b by position along the FFXIV finger, blending across j_*_b, so they bend where
    the game's fingers bend (from the Mantis port: her finger joints sat ~3 cm off FFXIV's and bent fingers stuck out)
  * hers, renamed onto FFXIV bones; her pelvis and spine weight is spread over the FFXIV spine by height, and the arm
    weight is shared with the FFXIV twist helpers (n_hkata, n_hhiji, n_hte) the way the vanilla body shares it
  * the dress (top and wrap skirt in one mesh): where it hangs from her pelvis and thighs, the FFXIV skirt chains
    (j_sk_f/s/b, physics) by angle round the body and height; where it hangs from her spine, her own weights
  * head, face, hair, eyes, flower crown: j_kao (no hair physics)

python -P -E tools/fit.py [race ...]   ->  work/fit/<race>.pkl
  {"parts": {name: dict(pos, nrm, uv, faces, vid, bones (N,4), weights (N,4), texset, slot)}, "joints": {...}}
"""
import math
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pbd  # noqa: E402
import rig  # noqa: E402
import srcdata as sd  # noqa: E402
import xivdata as xd  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

ROOT = rig.ROOT
SIDES = (("l", "L"), ("r", "R"))
# Per race: head scale (on top of the body scale), shoe scale, and how far her eyes sit in front of (eye_dz) and
# above (eye_dy) the FFXIV eyes, or her skull centre from theirs (align="centre", for the Lalafell's big head).
# Checked with tools/showthrough.py: the wearer's own face should stay inside her head.
PROFILES = {
    "c0201": dict(head=1.08, foot=1.0, eye_dz=0.010),
    "c0101": dict(head=1.15, foot=1.0, eye_dz=0.005),
    # Roegadyn men get their own fit: the game's deformer from the Midlander man doesn't reproduce their skeleton
    # (vanilla gear always ships Roegadyn models), and Hrothgar men fall back to this one
    # and their necks are 8.5-11 cm round the axis against her 5-7: her choker thickens to match (neck_far/neck_cap)
    "c0901": dict(head=1.15, foot=1.0, eye_dz=0.010, neck_far=0.125, neck_cap=0.05),
    "c1101": dict(head=2.25, foot=1.0, eye_dz=0.018, eye_dy=0.012, align="centre"),
}
# source mesh -> texture set; meshes not listed are dropped: the eye-highlight domes (5, 6), the inside of the mouth
# (13, her face is static), the fake eye shadow (14) and the rim-light shell (16)
TEXSET = {0: "gen", 1: "equip", 2: "gen", 3: "gen", 4: "head", 7: "equip", 8: "hair", 9: "strokes", 10: "body",
          11: "dress", 12: "eyes", 15: "strokes"}
NAMES = {0: "ankle_ruffles", 1: "sleeves_crown", 2: "stockings_shoes", 3: "pearls", 4: "head", 7: "ruffles",
         8: "hair", 9: "hair_strokes", 10: "body", 11: "dress", 12: "eyes", 15: "lashes"}
DRESS = 11
EYES = 12
HEAD = 4
HAIR = 8                        # textured through its second UV set (see tools/bake.py)
WAIST_BLEND = 0.035             # m either side of a skirt joint where its weight hands over to the next
FINGER_BLEND = 0.006            # m either side of j_*_b where a finger's weight hands over from j_*_a
FINGERS = (("thumb", "oya"), ("index", "hito"), ("middle", "naka"), ("ring", "kusu"), ("pinky", "ko"))

# nearest key ancestor -> retarget segment (None: torso lattice) and FFXIV bone ("torso": spread by height)
KEYS = {"root": (None, "torso"), "pelvis": (None, "torso"), "head": ("head", "j_kao"),
        "neck_01": ("neck", "j_kubi"), "neck_02": ("neck", "j_kubi")}
for _i in range(1, 6):
    KEYS[f"spine_0{_i}"] = (None, "torso")
for _s, _S in SIDES:
    KEYS.update({f"clavicle_{_s}": (f"shoulder.{_S}", f"j_sako_{_s}"),
                 f"upperarm_{_s}": (f"upper_arm.{_S}", f"j_ude_a_{_s}"),
                 f"lowerarm_{_s}": (f"forearm.{_S}", f"j_ude_b_{_s}"),
                 f"hand_{_s}": (f"hand.{_S}", f"j_te_{_s}"),
                 f"thigh_{_s}": (f"thigh.{_S}", f"j_asi_a_{_s}"),
                 f"calf_{_s}": (f"shin.{_S}", f"j_asi_c_{_s}"),
                 f"foot_{_s}": (f"foot.{_S}", f"j_asi_d_{_s}"),
                 f"ball_{_s}": (f"foot.{_S}", f"j_asi_e_{_s}")})
    # her fingers have three joints and sit ~3 cm off FFXIV's two-bone fingers: each finger is its own segment, and its
    # weight splits between j_*_a and j_*_b by position along the FFXIV finger (own_weights)
    for _f, _ff in FINGERS:
        for _n in ("01", "02", "03"):
            KEYS[f"{_f}_{_n}_{_s}"] = (f"{_f}.{_S}", f"finger:{_ff}:{_s}")
SKIRTISH = ("pelvis", "thigh_l", "thigh_r", "root")   # dress weight on these (and below) rides the skirt chains
# The wearer's own face model (it carries the neck down to the collar) must stay inside her neck and choker: the races
# that wear each fit through the racial deformer, every player face of theirs (tools/showthrough.py checks it)
COVER_RACES = {"c0201": ("c0201", "c0401", "c0601", "c0801", "c1001", "c1401", "c1601", "c1801"),
               "c0101": ("c0101", "c0301", "c0501", "c0701", "c1301", "c1701"),
               "c0901": ("c0901", "c1501"),
               "c1101": ("c1101", "c1201")}
# player faces (f02xx are NPC-only: e.g. Au Ra f0202 carries horns ~11 cm from the neck)
HIDDEN_EARS = {"atr_mim", "atr_top", "atr_hrn"}   # the head EQP shows no ears (human, Miqo'te) or Au Ra horns
FACE_IDS = [f"f{i:04d}" for i in list(range(1, 9)) + list(range(101, 109))]
# Lengths below are for the Midlander woman, whose neck (j_kubi to j_kao) is NECK_REF long; each fit scales them by
# its own neck (a Roegadyn man's is half as long again)
NECK_REF = 0.1072
NECK_MARGIN = 0.0025            # m her outer neck surface keeps outside the wearer's (not scaled)
NECK_TOP = 0.065                # m along the neck from j_kubi: above this (her jaw and head) nothing moves
NECK_BOTTOM = 0.0               # below this (her collar and shoulders) nothing moves; the vanilla necks end ~0.02 up
NECK_RAMP = 0.015
NECK_SIDES = 0                  # deg from the front left out of the cover (none: the throat shows between the choker bands)
NECK_FAR = 0.07                 # m from the neck axis: face parts further out are horns, manes and fangs, not neck
NECK_CAP = 0.015
NECK_SKIP = ("hair", "hair_strokes", "lashes", "eyes")          # hair cards: see-through, not a cover
NECK_SHELL = ("sleeves_crown", "head", "body", "dress")         # closed surfaces: what really covers (beads have gaps)


def key_of(bones):
    """Source bone -> its nearest key ancestor (itself included)."""
    out = {}
    for n in bones:
        b = n
        while b is not None and b not in KEYS:
            b = bones[b]["parent"]
        out[n] = b or "root"
    return out


# ----------------------------------------------------------------------------- helpers

def affine(lin, src_point, dst_point):
    m = np.eye(4)
    m[:3, :3] = lin
    m[:3, 3] = dst_point - lin @ src_point
    return m


# ----------------------------------------------------------------------------- retarget

class Retarget:
    """Moves points from Peni's bind pose into an FFXIV race's bind pose."""

    def __init__(self, race, prof):
        self.B = B = sd.bones()
        self.key = key_of(B)
        names, parent, world = rig.load_skeleton(f"skeleton_{race}")
        F = {n: world[n][:3, 3].copy() for n in names}
        for s, _ in SIDES:
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
        print(f"  size ratios FFXIV/Peni: legs {leg:.3f} torso {torso:.3f} arms {arm:.3f} -> scale {s:.3f}")
        hip_m = (H0["thigh_l"] + H0["thigh_r"]) / 2
        hip_f = (F["j_asi_a_l"] + F["j_asi_a_r"]) / 2
        self.t = hip_f - s * hip_m
        H = {n: s * p + self.t for n, p in H0.items()}
        self.H = H
        floor = self.t[1]

        # shoes: uniform scale about her ankle, sole on the floor, under the FFXIV ankle
        kf = prof["foot"]
        A = {}
        for sd_, _ in SIDES:
            a = F[f"j_asi_d_{sd_}"].copy()
            a[1] = kf * (H[f"foot_{sd_}"][1] - floor)
            A[sd_] = a
        self.ankle = A

        knots = [("foot_l", A["l"]), ("calf_l", F["knee_l"]), ("thigh_l", F["j_asi_a_l"]),
                 ("upperarm_l", F["j_ude_a_l"]), ("neck_01", F["j_kubi"])]
        self.ky = np.array([H[a][1] for a, _ in knots])
        self.fy = np.array([f[1] for _, f in knots])
        assert np.all(np.diff(self.ky) > 0) and np.all(np.diff(self.fy) > 0)
        self.sx_y = np.array([H["thigh_l"][1], H["upperarm_l"][1]])
        self.sx_v = np.array([F["j_asi_a_l"][0] / H["thigh_l"][0], F["j_ude_a_l"][0] / H["upperarm_l"][0]])
        self.dz = np.array([f[2] - H[a][2] for a, f in knots])
        print("  lattice y", np.round(self.ky, 3), "->", np.round(self.fy, 3), " width", np.round(self.sx_v, 3),
              " dz", np.round(self.dz, 3))

        # head: uniform scale about the head bone, her eyes onto the FFXIV eyes (or, for Lalafell, her skull's
        # centre onto the centre of their much bigger skull); the neck stretches to meet it
        kh = prof["head"]
        if prof.get("align") == "centre":
            eyes_m = self.peni_skull_centre() * s + self.t
            eyes_f = self.ffxiv_face_centre(race)
        else:
            eyes_m = self.peni_eyes() * s + self.t
            eyes_f = self.ffxiv_eyes(race)
        eyes_f = eyes_f + np.array([0, prof.get("eye_dy", 0.0), prof["eye_dz"]])
        head_base = eyes_f - kh * (eyes_m - H["head"])
        print(f"  eyes: Peni {np.round(eyes_m, 3)} -> FFXIV {np.round(eyes_f, 3)}; head base "
              f"{np.round(H['head'], 3)} -> {np.round(head_base, 3)} (j_kao {np.round(F['j_kao'], 3)})")

        # segment -> (bone, child bone or None, FFXIV start, FFXIV target, kind, twist)
        D = {"neck": ("neck_01", "head", F["j_kubi"], head_base, "stretch", None),
             "head": ("head", None, head_base, head_base, "head", None)}
        for sd_, S in SIDES:
            D.update({
                f"shoulder.{S}": (f"clavicle_{sd_}", f"upperarm_{sd_}", F[f"j_sako_{sd_}"], F[f"j_ude_a_{sd_}"], "stretch", None),
                f"upper_arm.{S}": (f"upperarm_{sd_}", f"lowerarm_{sd_}", F[f"j_ude_a_{sd_}"], F[f"j_ude_b_{sd_}"], "stretch", None),
                f"forearm.{S}": (f"lowerarm_{sd_}", f"hand_{sd_}", F[f"j_ude_b_{sd_}"], F[f"j_te_{sd_}"], "stretch", None),
                f"hand.{S}": (f"hand_{sd_}", f"middle_01_{sd_}", F[f"j_te_{sd_}"], F[f"j_naka_a_{sd_}"], "palm",
                              ((f"index_01_{sd_}", f"pinky_01_{sd_}"), (F[f"j_hito_a_{sd_}"], F[f"j_ko_a_{sd_}"]))),
                f"thigh.{S}": (f"thigh_{sd_}", f"calf_{sd_}", F[f"j_asi_a_{sd_}"], F[f"knee_{sd_}"], "stretch", None),
                f"shin.{S}": (f"calf_{sd_}", f"foot_{sd_}", F[f"knee_{sd_}"], A[sd_], "stretch", None),
                f"foot.{S}": (f"foot_{sd_}", None, A[sd_], A[sd_], "place", None),
            })
            for ue, ff in FINGERS:
                D[f"{ue}.{S}"] = (f"{ue}_01_{sd_}", f"{ue}_02_{sd_}", F[f"j_{ff}_a_{sd_}"], F[f"j_{ff}_b_{sd_}"],
                                  "finger", None)
        parent_seg = {"head": "neck", "neck": None}
        for _, S in SIDES:
            parent_seg.update({f"shoulder.{S}": None, f"upper_arm.{S}": f"shoulder.{S}", f"forearm.{S}": f"upper_arm.{S}",
                               f"hand.{S}": f"forearm.{S}", f"thigh.{S}": None, f"shin.{S}": f"thigh.{S}",
                               f"foot.{S}": f"shin.{S}"})
            for ue, _ in FINGERS:
                parent_seg[f"{ue}.{S}"] = f"hand.{S}"
        order = ["neck", "head"] + [f"{seg}.{S}" for _, S in SIDES for seg in
                                    ("shoulder", "upper_arm", "forearm", "hand", "thigh", "shin", "foot")]
        order += [f"{ue}.{S}" for _, S in SIDES for ue, _ in FINGERS]
        M = {}
        knuckles = {}
        for seg in order:
            b, child, f0, f1, kind, twist = D[seg]
            p = parent_seg[seg]
            anchor = self.field_point(H[b]) if p is None else (M[p] @ np.append(H[b], 1))[:3]
            if kind == "head":
                M[seg] = affine(np.eye(3) * kh, H[b], anchor)
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
            else:                   # stretch, and the palm: rigid across, stretched along it to the FFXIV knuckles
                k = np.linalg.norm(d_f) / np.linalg.norm(d_s)
                u = d_s / np.linalg.norm(d_s)
                lin = R @ (np.eye(3) + (k - 1) * np.outer(u, u))
            M[seg] = affine(lin, H[b], anchor)
            ang = math.degrees(math.acos(np.clip(np.dot(d_s, d_f) / np.linalg.norm(d_s) / np.linalg.norm(d_f), -1, 1)))
            if seg.endswith("L") or seg == "neck":
                print(f"  {seg:12s} turned {ang:5.1f} deg" + (f", stretched x{np.linalg.norm(d_f) / np.linalg.norm(d_s):.2f}"
                                                          if kind in ("stretch", "palm") else ""))
        self.M = M
        print("  finger bases moved onto the FFXIV knuckles (left, mm): "
              + ", ".join(f"{k} {d * 1000:.1f}" for k, d in knuckles.items()))

    def peni_eyes(self):
        p = sd.mesh(EYES)["pos"]
        out = []
        for side in (1, -1):
            q = p[p[:, 0] * side > 0]
            out.append((q.min(0) + q.max(0)) / 2)
        c = np.mean(out, axis=0)
        c[0] = 0.0
        return c

    def peni_skull_centre(self):
        p = sd.mesh(HEAD)["pos"]
        p = p[p[:, 1] > self.B["head"]["head"][1]]
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
        """Mesh m (source bind pose) -> FFXIV positions and normals, blending each bone's segment by its weight."""
        P = m["pos"] * self.scale + self.t
        tp, tsx = self.field(P)
        out = np.zeros_like(P)
        lin = np.zeros((len(P), 3, 3))
        tot = np.zeros(len(P))
        for b in np.unique(m["bones"]):
            if not b:
                continue
            sg = KEYS[self.key[b]][0]
            w = np.where(m["bones"] == b, m["weights"], 0).sum(1)
            sel = w > 0
            if sg is None:
                out[sel] += w[sel, None] * tp[sel]
                lin[sel] += w[sel, None, None] * np.array([np.diag([sx, 1, 1]) for sx in tsx[sel]])
            else:
                mm = self.M[sg]
                out[sel] += w[sel, None] * (P[sel] @ mm[:3, :3].T + mm[:3, 3])
                lin[sel] += w[sel, None, None] * mm[:3, :3]
            tot += w
        none = tot < 1e-6
        out[none], lin[none], tot[none] = tp[none], np.eye(3), 1
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


def own_weights(m, pos, F, key):
    """Her weights renamed onto FFXIV bones (as dicts), torso spread by height, arm weight shared with the twist
    helpers."""
    chain = [(F["j_kubi"][1] - 0.02, "j_kubi"), (F["j_sebo_c"][1], "j_sebo_c"), (F["j_sebo_b"][1], "j_sebo_b"),
             (F["j_sebo_a"][1], "j_sebo_a"), (F["j_asi_a_l"][1], "j_kosi")]
    hs = np.array([h for h, _ in chain])
    out = []
    for i in range(len(pos)):
        d = {}
        torso = 0.0
        for b, w in zip(m["bones"][i], m["weights"][i]):
            if not b or w <= 0:
                continue
            n = KEYS[key[b]][1]
            if n == "torso":
                torso += w
            elif n.startswith("finger:"):     # where the FFXIV finger bends, not where hers did
                _, f, side = n.split(":")
                a, bb = F[f"j_{f}_a_{side}"], F[f"j_{f}_b_{side}"]
                ax = (bb - a) / np.linalg.norm(bb - a)
                t = np.clip((np.dot(pos[i] - bb, ax) + FINGER_BLEND) / (2 * FINGER_BLEND), 0, 1)
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
                j = np.nonzero(hs > y)[0][-1]
                t = (hs[j] - y) / (hs[j] - hs[j + 1])
                d[chain[j][1]] = d.get(chain[j][1], 0) + torso * (1 - t)
                d[chain[j + 1][1]] = d.get(chain[j + 1][1], 0) + torso * t
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
    return out


def skirt_weights(pos, F):
    """FFXIV skirt chains by angle round the body and height (as dicts); above the waist joints, the hips."""
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
    return out


def mix(a, b, t):
    out = []
    for da, db, ti in zip(a, b, t):
        d = {k: v * (1 - ti) for k, v in da.items()}
        for k, v in db.items():
            d[k] = d.get(k, 0) + v * ti
        out.append(d)
    return out


def skirtness(m, key, B):
    """Share of each vertex's weight that hangs from her pelvis or thighs (not her spine)."""
    s = np.zeros(len(m["pos"]))
    for k in range(m["bones"].shape[1]):
        for b in np.unique(m["bones"][:, k]):
            if b and key[b] in SKIRTISH or (b and key[b].startswith(("thigh_", "calf_"))):
                s += np.where(m["bones"][:, k] == b, m["weights"][:, k], 0)
    return np.clip(s, 0, 1)


# ----------------------------------------------------------------------------- the wearer's neck

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
    """Push her neck layers (choker, neck skin, collar, pearls) out radially, about the j_kubi -> j_kao axis, until her
    closed surfaces clear the necks of every face that wears this fit by NECK_MARGIN. Inner and outer layers move by
    the same amount, so the choker stays on her skin."""
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

def fit_race(race):
    prof = PROFILES[race]
    print(race)
    rt = Retarget(race, prof)
    F = rt.F
    parts = {}
    for idx, texset in TEXSET.items():
        m = sd.mesh(idx)
        pos, nrm = rt.apply(m)
        w = own_weights(m, pos, F, rt.key)
        if idx == DRESS:
            t = skirtness(m, rt.key, rt.B)
            w = mix(w, skirt_weights(pos, F), t)
            print(f"  dress: {np.mean(t > 0.5) * 100:.0f}% of its verts ride the skirt chains")
        bones, weights = to_arrays(w)
        name = NAMES[idx]
        # the little spider she wears on her back hangs from the PantsA bones (an option in the mod)
        spider = np.where(np.char.startswith(m["bones"].astype(str), "PantsA"), m["weights"], 0).sum(1) > 0.5
        parts[name] = dict(pos=pos, nrm=nrm, uv=m["uv1" if idx == HAIR else "uv0"], faces=m["faces"],
                           vid=np.arange(len(pos)) + idx * 100000,
                           bones=bones, weights=weights, texset=texset, slot=None, src=idx, spider=spider)
    cover_neck(parts, F, race, prof)
    for n, p in sorted(parts.items()):
        print(f"  part {n:16s} {p['texset']:7s}: {len(p['pos']):5d} verts {len(p['faces']):5d} tris, "
              f"y {p['pos'][:, 1].min():.3f}..{p['pos'][:, 1].max():.3f}, bones {len({b for b in p['bones'].ravel() if b})}")
    os.makedirs(os.path.join(ROOT, "work", "fit"), exist_ok=True)
    pickle.dump(dict(parts=parts, joints=F, ankle=rt.ankle, scale=rt.scale),
                open(os.path.join(ROOT, "work", "fit", f"{race}.pkl"), "wb"))
    print("wrote", race)


if __name__ == "__main__":
    for r in (sys.argv[1:] or list(PROFILES)):
        fit_race(r)
