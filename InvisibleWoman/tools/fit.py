"""Fit Invisible Woman (Marvel Rivals, Unseen Weaver; Unreal-style skeleton) onto an FFXIV race skeleton.

Positions are retargeted through her own skeleton at bind pose (an A-pose):
  * one uniform scale (geometric mean of the leg, torso and arm length ratios), hips on the FFXIV hips
  * torso: a height lattice through her ankles, knees, hips, shoulders and neck, scaled in width
  * limbs: one affine per bone, parents first, rotated onto the FFXIV bone and stretched to its length
  * hands: rigid, twisted so the knuckles line up with the FFXIV fingers
  * boots: rigid (her high heels keep their shape), heel tip on the floor under the FFXIV ankle
  * head: rigid, scaled by `head`, eyes on the FFXIV face's eyes; the neck stretches to meet it
A bone moves with the first of its ancestors that has a segment (twist, volume and cloth bones follow their limb).
Weights:
  * hers, renamed onto FFXIV bones by the same ancestry; her spine weight is spread over the FFXIV spine by height,
    and the arm weight is shared with the FFXIV twist helpers (n_hkata, n_hhiji, n_hte) the way the vanilla body does
  * skirt bones: the FFXIV skirt chains (j_sk_f/s/b, physics), by angle round the body and height
  * capelet bones: copied from the nearest point of her fitted body, so it rides the shoulders and upper arms
  * head, face, hair, hat, earrings: rigid on j_kao, the neck on j_kubi
Dropped: teeth and tongue (her mouth is closed and the face is static), the eye film and the rim-light shell.

python -P -E tools/fit.py [race ...]   ->  work/fit/<race>.pkl
  {"parts": {name: dict(pos, nrm, uv, faces, vid, bones (N,4), weights (N,4), texset, slot)}, "joints": {...}}
"""
import math
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig  # noqa: E402
import srcdata as sd  # noqa: E402
import xivdata as xd  # noqa: E402

ROOT = rig.ROOT
SIDES = (("l", "L"), ("r", "R"))
# Per race: head scale (on top of the body scale), boot scale, and how far her eyes sit in front of (eye_dz) and
# above (eye_dy) the FFXIV eyes, or her skull centre from theirs (align="centre", for the Lalafell's big head).
# Picked with tools/tune_head.py and checked with tools/poke.py: the wearer's own face should stay inside her head.
PROFILES = {
    "c0201": dict(head=1.08, foot=1.0, eye_dz=0.020),
    "c0101": dict(head=1.15, foot=1.0, eye_dz=0.020),
    "c1101": dict(head=2.40, foot=1.0, eye_dz=0.018, align="centre"),
}
# source primitive -> texture set (None: dropped)
TEXSET = {"Eyes_02": None, "Head": "head", "Eyes_01": "eyes", "Body": "body", "Body_02": "body", "Equip_05": "dress",
          "Equip_04": "trim", "Equip_02": "dress", "Equip_03": "trim", "Equip_01": "thorns", "Hair_02": "lashes",
          "Hair_01": "hair", "Rim_HeroDetails": None}
HEAD_PRIMS = ("Eyes_01", "Hair_01", "Hair_02")    # rigid on the head; the head mesh itself has its neck
DROP_BONES = ("upper_teeth", "lower_teeth", "tongue", "tongue_02", "tongue_03")
WAIST_BLEND = 0.035             # m either side of a skirt joint where its weight hands over to the next

# her bones that start a retarget segment, and the FFXIV bone each of her bones' weight goes to (by ancestry)
SEGMENT = {"head": "head", "neck_01": "neck", "neck_02": "neck"}
FFX = {"head": "j_kao", "neck_01": "j_kubi", "neck_02": "j_kubi", "Breast_vol_ft_L": "j_mune_l",
       "Breast_vol_ft_R": "j_mune_r"}
for s, S in SIDES:
    SEGMENT.update({f"clavicle_{s}": f"shoulder.{S}", f"upperarm_{s}": f"upper_arm.{S}", f"lowerarm_{s}": f"forearm.{S}",
                    f"hand_{s}": f"hand.{S}", f"thigh_{s}": f"thigh.{S}", f"calf_{s}": f"shin.{S}",
                    f"foot_{s}": f"foot.{S}"})
    FFX.update({f"clavicle_{s}": f"j_sako_{s}", f"upperarm_{s}": f"j_ude_a_{s}", f"lowerarm_{s}": f"j_ude_b_{s}",
                f"hand_{s}": f"j_te_{s}", f"thigh_{s}": f"j_asi_a_{s}", f"calf_{s}": f"j_asi_c_{s}",
                f"foot_{s}": f"j_asi_d_{s}", f"ball_{s}": f"j_asi_e_{s}"})
    for her, ff in (("thumb", "oya"), ("index", "hito"), ("middle", "naka"), ("ring", "kusu"), ("pinky", "ko")):
        FFX[f"{her}_01_{s}"] = f"j_{ff}_a_{s}"
        FFX[f"{her}_02_{s}"] = f"j_{ff}_b_{s}"
        FFX[f"{her}_03_{s}"] = f"j_{ff}_b_{s}"
TORSO = {"root", "pelvis", "spine_01", "spine_02", "spine_03", "spine_04", "spine_05"}


def ancestry(B, bone):
    out = []
    while bone is not None:
        out.append(bone)
        bone = B[bone]["parent"]
    return out


def deformer_of(B, bone):
    """Her bone -> the retarget segment that moves it (None: torso lattice)."""
    for b in ancestry(B, bone):
        if b in SEGMENT:
            return SEGMENT[b]
        if b in TORSO:
            return None
    return None


def ffxiv_bone(B, bone):
    """Her bone -> FFXIV bone; "torso" for the spine/pelvis (spread by height), "skirt" and "cape" for her cloth."""
    if bone.startswith("Skirt_"):
        return "skirt"
    if bone.startswith("Cloak_"):
        return "cape"
    for b in ancestry(B, bone):
        if b in FFX:
            return FFX[b]
        if b in TORSO:
            return "torso"
    return "torso"


# ----------------------------------------------------------------------------- retarget

def affine(lin, src_point, dst_point):
    m = np.eye(4)
    m[:3, :3] = lin
    m[:3, 3] = dst_point - lin @ src_point
    return m


class Retarget:
    """Moves points from her bind pose into an FFXIV race's bind pose."""

    def __init__(self, race, prof):
        self.B = B = sd.bones()
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
        print(f"  size ratios FFXIV/hers: legs {leg:.3f} torso {torso:.3f} arms {arm:.3f} -> scale {s:.3f}")
        hip_m = (H0["thigh_l"] + H0["thigh_r"]) / 2
        hip_f = (F["j_asi_a_l"] + F["j_asi_a_r"]) / 2
        self.t = hip_f - s * hip_m
        H = {n: s * p + self.t for n, p in H0.items()}
        self.H = H
        floor = self.t[1]

        # boots: uniform scale about her ankle, heel on the floor, under the FFXIV ankle
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
            eyes_m = self.her_skull_centre() * s + self.t
            eyes_f = self.ffxiv_face_centre(race)
        else:
            eyes_m = self.her_eyes() * s + self.t
            eyes_f = self.ffxiv_eyes(race)
        eyes_f = eyes_f + np.array([0, prof.get("eye_dy", 0.0), prof["eye_dz"]])
        head_base = eyes_f - kh * (eyes_m - H["head"])
        self.eyes = (eyes_m, eyes_f)
        print(f"  eyes: hers {np.round(eyes_m, 3)} -> FFXIV {np.round(eyes_f, 3)}; head base "
              f"{np.round(H['head'], 3)} -> {np.round(head_base, 3)} (j_kao {np.round(F['j_kao'], 3)})")

        # segment -> (bone, child bone or None, FFXIV start, FFXIV target, kind, twist)
        D = {"neck": ("neck_01", "head", F["j_kubi"], head_base, "stretch", None),
             "head": ("head", None, head_base, head_base, "head", None)}
        for sd_, S in SIDES:
            D.update({
                f"shoulder.{S}": (f"clavicle_{sd_}", f"upperarm_{sd_}", F[f"j_sako_{sd_}"], F[f"j_ude_a_{sd_}"], "stretch", None),
                f"upper_arm.{S}": (f"upperarm_{sd_}", f"lowerarm_{sd_}", F[f"j_ude_a_{sd_}"], F[f"j_ude_b_{sd_}"], "stretch", None),
                f"forearm.{S}": (f"lowerarm_{sd_}", f"hand_{sd_}", F[f"j_ude_b_{sd_}"], F[f"j_te_{sd_}"], "stretch", None),
                f"hand.{S}": (f"hand_{sd_}", f"middle_01_{sd_}", F[f"j_te_{sd_}"], F[f"j_naka_a_{sd_}"], "rigid",
                              ((f"index_01_{sd_}", f"pinky_01_{sd_}"), (F[f"j_hito_a_{sd_}"], F[f"j_ko_a_{sd_}"]))),
                f"thigh.{S}": (f"thigh_{sd_}", f"calf_{sd_}", F[f"j_asi_a_{sd_}"], F[f"knee_{sd_}"], "stretch", None),
                f"shin.{S}": (f"calf_{sd_}", f"foot_{sd_}", F[f"knee_{sd_}"], A[sd_], "stretch", None),
                f"foot.{S}": (f"foot_{sd_}", None, A[sd_], A[sd_], "place", None),
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

    def her_eyes(self):
        """Centre between the fronts of her eyeballs (the FFXIV iris mesh is the eye's front surface)."""
        m = sd.mesh(prim("Eyes_01"))
        gi = {g: i for i, g in enumerate(m["group_names"])}
        fronts = []
        for b in ("l_eye_ball", "r_eye_ball"):
            p = m["pos"][m["groups"][:, gi[b]] > 0.5]
            c = (p.min(0) + p.max(0)) / 2
            c[2] = p[:, 2].max()
            fronts.append(c)
        c = np.mean(fronts, axis=0)
        c[0] = 0.0
        return c

    def her_skull_centre(self):
        p = sd.mesh(prim("Head"))["pos"]
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

    def apply(self, m, default=None):
        """Mesh m (her bind pose) -> FFXIV positions and normals. With `default` (a segment name), every vertex
        moves with that segment whatever its weights say (the head, hair and eyes)."""
        P = m["pos"] * self.scale + self.t
        tp, tsx = self.field(P)
        segs = [deformer_of(self.B, g) for g in m["group_names"]]
        W = m["groups"].astype(float).copy()
        if default is not None:
            W = np.zeros((len(P), 1))
            segs = [default]
            W[:, 0] = 1.0
        out = np.zeros_like(P)
        lin = np.zeros((len(P), 3, 3))
        tot = W.sum(1)
        for g, sg in enumerate(segs):
            w = W[:, g]
            sel = w > 0
            if not sel.any():
                continue
            if sg is None:
                out[sel] += w[sel, None] * tp[sel]
                lin[sel] += w[sel, None, None] * np.array([np.diag([sx, 1, 1]) for sx in tsx[sel]])
            else:
                mm = self.M[sg]
                out[sel] += w[sel, None] * (P[sel] @ mm[:3, :3].T + mm[:3, 3])
                lin[sel] += w[sel, None, None] * mm[:3, :3]
        none = tot < 1e-6
        if none.any():
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


def from_arrays(B, W):
    out = []
    for rb, rw in zip(B, W):
        d = {}
        for b, w in zip(rb, rw):
            if b:
                d[b] = d.get(b, 0) + w
        out.append(d)
    return out


def along(p, a, b):
    ax = b - a
    return (p - a) @ ax / np.dot(ax, ax)


def own_weights(B, m, pos, F):
    """Her weights renamed onto FFXIV bones (dicts per vertex); torso spread by height. Skirt and cape weight is
    kept under the keys "skirt" and "cape" for skirt_weights / cape_weights to replace."""
    chain = [(F["j_kubi"][1] - 0.02, "j_kubi"), (F["j_sebo_c"][1], "j_sebo_c"), (F["j_sebo_b"][1], "j_sebo_b"),
             (F["j_sebo_a"][1], "j_sebo_a"), (F["j_asi_a_l"][1], "j_kosi")]
    hs = np.array([h for h, _ in chain])
    names = [ffxiv_bone(B, g) for g in m["group_names"]]
    G = m["groups"]
    out = []
    for i in range(len(pos)):
        d = {}
        torso = 0.0
        for g in np.nonzero(G[i] > 0)[0]:
            n, w = names[g], float(G[i, g])
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
                j = np.nonzero(hs > y)[0][-1]
                t = (hs[j] - y) / (hs[j] - hs[j + 1])
                d[chain[j][1]] = d.get(chain[j][1], 0) + torso * (1 - t)
                d[chain[j + 1][1]] = d.get(chain[j + 1][1], 0) + torso * t
        out.append(d)
    return out


def twist_helpers(out, pos, F):
    """Share the arm weight with the twist helpers, as on the vanilla body."""
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
                d[f"n_hkata_{s}"] = d.get(f"n_hkata_{s}", 0) + ua * hk[i]
                d[f"j_ude_a_{s}"] = ua * (1 - hk[i])
            if fa > 0:
                d[f"n_hte_{s}"] = d.get(f"n_hte_{s}", 0) + fa * ht[i]
                d[f"j_ude_b_{s}"] = fa * (1 - ht[i])
            if (ua + fa) > 0 and hj[i] > 0:
                for b in (f"j_ude_a_{s}", f"j_ude_b_{s}"):
                    if b in d:
                        d[f"n_hhiji_{s}"] = d.get(f"n_hhiji_{s}", 0) + d[b] * hj[i]
                        d[b] *= 1 - hj[i]
    return out


def skirt_dicts(pos, F):
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
    return out


def nearest(query, ref, chunk=512):
    ref = ref.astype(np.float32)
    rr = (ref ** 2).sum(1)
    idx = np.empty(len(query), np.int64)
    for i in range(0, len(query), chunk):
        q = query[i:i + chunk].astype(np.float32)
        idx[i:i + chunk] = (rr[None, :] - 2 * q @ ref.T).argmin(1)
    return idx


def replace_key(dicts, key, pos, source):
    """Swap the weight a vertex has under `key` for source(vertex positions) weights, scaled to it."""
    sel = [i for i, d in enumerate(dicts) if d.get(key, 0) > 0]
    if not sel:
        return dicts
    rep = source(pos[sel])
    for i, r in zip(sel, rep):
        w = dicts[i].pop(key)
        for b, v in r.items():
            dicts[i][b] = dicts[i].get(b, 0) + w * v
    return dicts


def single(n, bone):
    return np.array([[bone, "", "", ""]] * n, object), np.tile([1.0, 0, 0, 0], (n, 1))


# ----------------------------------------------------------------------------- parts

def prim(short):
    return next(n for n in sd.prim_names() if n.split("_", 3)[3] == short)


def short_of(name):
    return name.split("_", 3)[3]


def keep_faces(m):
    """Triangles to keep: no teeth or tongue."""
    gi = [i for i, g in enumerate(m["group_names"]) if g in DROP_BONES]
    if not gi:
        return np.ones(len(m["faces"]), bool)
    drop_v = m["groups"][:, gi].sum(1) > 0.5
    return ~drop_v[m["faces"]].any(1)


def make_part(m, keep, pos, nrm, B, W, pi, texset, slot):
    f = m["faces"][keep]
    used, remap = np.unique(f, return_inverse=True)
    uv = m["uv1" if texset == "hair" else "uv0"][used]      # textures.py bakes the hair onto its second UV set
    return dict(pos=pos[used], nrm=nrm[used], uv=np.c_[uv[:, 0], 1 - uv[:, 1]], faces=remap.reshape(-1, 3),
                vid=m["vid"][used] + pi * 1_000_000, bones=B[used], weights=W[used], texset=texset, slot=slot)


def fit_race(race):
    prof = PROFILES[race]
    print(race)
    rt = Retarget(race, prof)
    F, B = rt.F, rt.B
    fitted = {}
    for pi, name in enumerate(sd.prim_names()):
        short = short_of(name)
        if TEXSET[short] is None:
            continue
        m = sd.mesh(name)
        pos, nrm = rt.apply(m, "head" if short in HEAD_PRIMS else None)
        if short == "Head":
            print(f"  head mesh after fit: y {pos[:, 1].min():.3f}..{pos[:, 1].max():.3f}")
        fitted[short] = (pi, m, pos, nrm)

    # her body skin, for the capelet's weights
    _, mb, pb, _ = fitted["Body"]
    body_d = twist_helpers(own_weights(B, mb, pb, F), pb, F)
    upper = pb[:, 1] > F["j_sebo_b"][1]
    body_ref = (pb[upper], [body_d[i] for i in np.nonzero(upper)[0]])

    def cape_source(q):
        idx = nearest(q, body_ref[0])
        return [body_ref[1][i] for i in idx]

    parts = {}
    for short, (pi, m, pos, nrm) in fitted.items():
        if short in HEAD_PRIMS:
            Bn, Wt = single(len(pos), "j_kao")
            slot = "met"
        else:
            d = own_weights(B, m, pos, F)
            d = replace_key(d, "skirt", pos, lambda q: skirt_dicts(q, F))
            d = twist_helpers(d, pos, F)
            d = replace_key(d, "cape", pos, cape_source)
            Bn, Wt = to_arrays(d)
            slot = "met" if short == "Head" else None
        keep = keep_faces(m)
        parts[short.lower()] = make_part(m, keep, pos, nrm, Bn, Wt, pi, TEXSET[short], slot)

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
