"""Fit Black Cat (Marvel Rivals, Pink Purr; UE-style skeleton) onto an FFXIV race skeleton.

Positions are retargeted through her own skeleton (bind pose), the way the Mina port does it:
  * one uniform scale (geometric mean of the leg, torso and arm length ratios), hips on the FFXIV hips
  * torso: a height lattice through her ankles, knees, hips, shoulders and neck, scaled in width
  * limbs: one affine per bone, parents first, rotated onto the FFXIV bone and stretched to its length
  * hands: rigid, twisted so the knuckles line up with the FFXIV fingers
  * boots: rigid (the wedge heels keep their shape), sole on the floor under the FFXIV ankle
  * head: rigid, scaled by `head`, eyes on the FFXIV face's eyes; the neck stretches to meet it
Every source joint is resolved through its parent chain: limb twist / fix joints follow their limb, face, hair
and goggle joints the head, belt / necklace / ribbon / scarf / tie chains the spine (torso lattice).
Weights:
  * her own weights renamed onto FFXIV bones; spine weight spread over the FFXIV spine by height; arm weight shared
    with the FFXIV twist helpers (n_hkata, n_hhiji, n_hte) the way the vanilla body shares it; knee fix joints on
    the FFXIV knee (j_asi_b)
  * hair: the head, handing over to the upper back (j_sebo_c) from the jaw down, so the long back hair follows the
    torso instead of swinging through it when the head turns
  * eyes, cap, badge, goggles, lenses: rigid on j_kao

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
import rig  # noqa: E402
import srcdata as sd  # noqa: E402
import xivdata as xd  # noqa: E402
from islands import components  # noqa: E402
from texsets import LENS_UV, QUADRANT, TEXSET, atlas_uv, untile  # noqa: E402

ROOT = rig.ROOT
SIDES = (("l", "L"), ("r", "R"))
# Per race: head scale (on top of the body scale), boot scale, and how far her eyes sit in front of (eye_dz) and
# above (eye_dy) the FFXIV eyes, or her skull centre from theirs (align="centre", for the Lalafell's big head).
# Checked with tools/poke.py: the wearer's own face should stay inside her head.
PROFILES = {
    "c0201": dict(head=1.08, foot=1.0, eye_dz=0.005),
    "c0101": dict(head=1.15, foot=1.0, eye_dz=0.005),
    "c0901": dict(head=1.15, foot=1.0, eye_dz=0.005),
    "c1101": dict(head=2.25, foot=1.0, eye_dz=0.018, eye_dy=0.012, align="centre"),
}
# source primitive -> (part name, slot; None = split by skin weight in build.py)
PARTS = {0: ("skin", None), 1: ("face", "met"), 2: ("suit", None), 3: ("legs", None), 4: ("legs2", None),
         6: ("eyes", "met"), 7: ("hair", "met"), 9: ("goggles", "met"), 10: ("lenses", "met"), 11: ("drape", "top"),
         12: ("scarf", "top"), 13: ("belt", "dwn"), 14: ("cap", "met"), 15: ("collar", "top"), 16: ("braid", "dwn"),
         17: ("badge", "met"), 18: ("tie", "top"), 19: ("collar2", "top"), 20: ("ribbons", "dwn"),
         21: ("garter", "dwn")}
RIGID_HEAD = ("eyes", "goggles", "lenses", "cap", "badge")
LIMB = {"shoulder": "clavicle", "upper_arm": "upperarm", "forearm": "lowerarm", "hand": "hand", "thigh": "thigh",
        "shin": "calf", "foot": "foot"}
LIMB_SEG = {"clavicle": "shoulder", "upperarm": "upper_arm", "lowerarm": "forearm", "hand": "hand", "thigh": "thigh",
            "calf": "shin", "foot": "foot", "ball": "foot"}
LIMB_BONE = {"clavicle": "j_sako", "upperarm": "j_ude_a", "lowerarm": "j_ude_b", "hand": "j_te", "thigh": "j_asi_a",
             "calf": "j_asi_c", "foot": "j_asi_d", "ball": "j_asi_e"}
FINGER = {"thumb": "oya", "index": "hito", "middle": "naka", "ring": "kusu", "pinky": "ko"}
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
        m = re.fullmatch(r"(clavicle|upperarm|lowerarm|hand|thigh|calf|foot|ball)_([lr])", a)
        if m:
            return f"{LIMB_SEG[m.group(1)]}.{m.group(2).upper()}"
    return None


def ffxiv_bone(j, J):
    """Source joint -> FFXIV bone; "torso" for the spine, pelvis and the accessory chains hung on them."""
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
            return f"j_{FINGER[m.group(1)]}_{'a' if m.group(2) == '1' else 'b'}_{m.group(3)}"
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
    """Moves points from Black Cat's bind pose into an FFXIV race's bind pose."""

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
        print(f"  size ratios FFXIV/Black Cat: legs {leg:.3f} torso {torso:.3f} arms {arm:.3f} -> scale {s:.3f}")
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
        kh = prof["head"]
        if prof.get("align") == "centre":
            eyes_m = self.skull_centre() * s + self.t
            eyes_f = self.ffxiv_face_centre(race)
        else:
            eyes_m = self.eyes() * s + self.t
            eyes_f = self.ffxiv_eyes(race)
        eyes_f = eyes_f + np.array([0, prof.get("eye_dy", 0.0), prof["eye_dz"]])
        head_base = eyes_f - kh * (eyes_m - H["head"])
        print(f"  eyes: Black Cat {np.round(eyes_m, 3)} -> FFXIV {np.round(eyes_f, 3)}; head base "
              f"{np.round(H['head'], 3)} -> {np.round(head_base, 3)} (j_kao {np.round(F['j_kao'], 3)})")

        # segment -> (joint, child joint or None, FFXIV start, FFXIV target, kind, twist)
        D = {"neck": ("neck_01", "head", F["j_kubi"], head_base, "stretch", None),
             "head": ("head", None, head_base, head_base, "head", None)}
        for sd_, S in SIDES:
            D.update({
                f"shoulder.{S}": (src("shoulder", S), src("upper_arm", S), F[f"j_sako_{sd_}"], F[f"j_ude_a_{sd_}"], "stretch", None),
                f"upper_arm.{S}": (src("upper_arm", S), src("forearm", S), F[f"j_ude_a_{sd_}"], F[f"j_ude_b_{sd_}"], "stretch", None),
                f"forearm.{S}": (src("forearm", S), src("hand", S), F[f"j_ude_b_{sd_}"], F[f"j_te_{sd_}"], "stretch", None),
                f"hand.{S}": (src("hand", S), f"middle_01_{sd_}", F[f"j_te_{sd_}"], F[f"j_naka_a_{sd_}"], "rigid",
                              ((f"index_01_{sd_}", f"pinky_01_{sd_}"), (F[f"j_hito_a_{sd_}"], F[f"j_ko_a_{sd_}"]))),
                f"thigh.{S}": (src("thigh", S), src("shin", S), F[f"j_asi_a_{sd_}"], F[f"knee_{sd_}"], "stretch", None),
                f"shin.{S}": (src("shin", S), src("foot", S), F[f"knee_{sd_}"], A[sd_], "stretch", None),
                f"foot.{S}": (src("foot", S), None, A[sd_], A[sd_], "place", None),
            })
        parent_seg = {"head": "neck", "neck": None}
        for _, S in SIDES:
            parent_seg.update({f"shoulder.{S}": None, f"upper_arm.{S}": f"shoulder.{S}", f"forearm.{S}": f"upper_arm.{S}",
                               f"hand.{S}": f"forearm.{S}", f"thigh.{S}": None, f"shin.{S}": f"thigh.{S}",
                               f"foot.{S}": f"shin.{S}"})
        order = ["neck", "head"] + [f"{seg}.{S}" for _, S in SIDES for seg in
                                    ("shoulder", "upper_arm", "forearm", "hand", "thigh", "shin", "foot")]
        M = {}
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
                lin = R @ (np.eye(3) + (k - 1) * np.outer(u, u))
            M[seg] = affine(lin, H[b], anchor)
            ang = math.degrees(math.acos(np.clip(np.dot(d_s, d_f) / np.linalg.norm(d_s) / np.linalg.norm(d_f), -1, 1)))
            if seg.endswith("L") or seg == "neck":
                print(f"  {seg:12s} turned {ang:5.1f} deg" + (f", stretched x{np.linalg.norm(d_f) / np.linalg.norm(d_s):.2f}"
                                                          if kind == "stretch" else ""))
        self.M = M

    def eyes(self):
        m = sd.prim(6)
        m = sd.submesh(m, eyeball_faces(m))
        p = m["pos"]
        centres = [(q.min(0) + q.max(0)) / 2 for q in (p[p[:, 0] > 0], p[p[:, 0] < 0])]
        return np.mean(centres, axis=0)

    def skull_centre(self):
        p = sd.prim(1)["pos"]
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


# ----------------------------------------------------------------------------- parts

def part_uv(m):
    """Texture coordinates for the FFXIV material (glTF, v down), every triangle moved into the 0..1 tile."""
    mat = m["material"]
    if mat == "MI_1061302_Equip_03":
        return np.tile(LENS_UV, (len(m["pos"]), 1))
    uv = untile(m["uv1"] if TEXSET[mat] == "hair" else m["uv0"], m["faces"])
    return atlas_uv(mat, uv) if mat in QUADRANT else uv


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
        pos, nrm = rt.apply(m, "head" if name in RIGID_HEAD else None)
        if name in RIGID_HEAD:
            B, W = single(len(pos), "j_kao")
        elif name == "hair":
            B, W = hair_weights(pos, F)
        else:
            B, W = own_weights(m, pos, F, J)
        uv = part_uv(m)
        parts[name] = dict(pos=pos, nrm=nrm, uv=np.c_[uv[:, 0], 1 - uv[:, 1]], faces=m["faces"],
                           vid=m["vid"] + pi * 1_000_000, bones=B, weights=W, texset=TEXSET[m["material"]], slot=slot,
                           material=m["material"])
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
