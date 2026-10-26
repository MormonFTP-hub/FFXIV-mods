"""Fit Mantis (Marvel Rivals, Dreamy Dew; Unreal skeleton) onto an FFXIV race skeleton.

Positions are retargeted through her own skeleton (bind pose), as in the Mina port:
  * one uniform scale (geometric mean of the leg, torso and arm length ratios), hips on the FFXIV hips
  * torso: a height lattice through her ankles, knees, hips, shoulders and neck, scaled in width
  * limbs: one affine per bone, parents first, rotated onto the FFXIV bone and stretched to its length
  * hands: rigid, stretched along the palm to the FFXIV knuckles and twisted so they line up with the FFXIV
    fingers; each finger keeps its shape, its base on j_*_a, aimed along the FFXIV finger (j_*_a -> j_*_b)
  * feet (slippers): rigid, sole on the floor under the FFXIV ankle
  * head: rigid, scaled by `head`, eyes on the FFXIV face's eyes; the neck stretches to meet it
Every Unreal bone moves with the first of its ancestors that is a body bone (physics chains, twist and volume
helpers, facial bones), so the hood, cuffs, hair ties and flowers ride the body part they hang from.
Weights:
  * hers, renamed onto FFXIV bones the same way; her spine weight is spread over the FFXIV spine by height, and
    the arm weight is shared with the FFXIV twist helpers (n_hkata, n_hhiji, n_hte) the way the vanilla body does
  * weight on her robe-tail / wing chains (Ribbon_308, from the pelvis) and the camisole hem (Skirt_308) goes to
    the FFXIV skirt chains (j_sk_f/s/b, physics), by angle round the body and height
  * fingers: split between j_*_a and j_*_b by position along the FFXIV finger, blending across j_*_b, so they
    bend where the game's fingers bend (her own finger joints don't line up with FFXIV's two-bone fingers)
  * hair, the line-art shell and the eyes: rigid on j_kao
  * small pieces (flowers, stars) move as one

python -P -E tools/fit.py [race ...]   ->  work/fit/<race>.pkl
  {"parts": {name: dict(pos, nrm, uv (v up), faces, vid, bones (N,4), weights (N,4), texset, slot)}, "joints": {...}}
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
from islands import components  # noqa: E402

ROOT = rig.ROOT
SIDES = (("l", "L"), ("r", "R"))
# Per race: head scale (on top of the body scale), foot scale, and how far her eyes sit in front of (eye_dz) and
# above (eye_dy) the FFXIV eyes, or her skull centre from theirs (align="centre", for the Lalafell's big head).
# Checked with tools/poke.py: the wearer's own face should stay inside her head.
PROFILES = {
    "c0201": dict(head=1.06, foot=1.0, eye_dz=0.008),
    "c0101": dict(head=1.08, foot=1.0, eye_dz=0.005),
    "c1101": dict(head=2.1, foot=1.0, eye_dz=0.018, eye_dy=0.012, align="centre"),
}
# material -> (texture set, slot or None to split by weight); dropped: the fake eye shadow and the rim shell
PARTS = {"Head": ("head", "met"), "Hair_01": ("hair", "met"), "Hair_03": ("lines", "met"), "Eyes_01": ("eyes", "met"),
         "Body": ("body", None), "Equip_04": ("cami", None), "Equip_01": ("robe", None), "Equip_03": ("wings", None),
         "Equip_05": ("fluff", None), "Equip_02": ("outfit", None)}
RIGID_HEAD = ("Hair_01", "Hair_03", "Eyes_01")
SKIRT_CHAINS = ("Ribbon_308", "Skirt_308")
ISLAND = {"Equip_05": 0.09, "Equip_02": 0.05}     # pieces smaller than this (m) move as one
WAIST_BLEND = 0.035             # m either side of a skirt joint where its weight hands over to the next
FINGER_BLEND = 0.006            # m either side of j_*_b where a finger's weight hands over from j_*_a

# Unreal body bone -> (retarget segment or None for the torso lattice, FFXIV bone or "torso")
BODY = {"pelvis": (None, "j_kosi"), "neck_01": ("neck", "j_kubi"), "neck_02": ("neck", "j_kubi"),
        "head": ("head", "j_kao")}
for _i in range(1, 6):
    BODY[f"spine_{_i:02d}"] = (None, "torso")
FINGERS = (("thumb", "oya"), ("index", "hito"), ("middle", "naka"), ("ring", "kusu"), ("pinky", "ko"))
for _s, _S in SIDES:
    BODY.update({f"breast_{_s}": (None, f"j_mune_{_s}"), f"clavicle_{_s}": (f"shoulder.{_S}", f"j_sako_{_s}"),
                 f"upperarm_{_s}": (f"upper_arm.{_S}", f"j_ude_a_{_s}"),
                 f"lowerarm_{_s}": (f"forearm.{_S}", f"j_ude_b_{_s}"), f"hand_{_s}": (f"hand.{_S}", f"j_te_{_s}"),
                 f"thigh_{_s}": (f"thigh.{_S}", f"j_asi_a_{_s}"), f"calf_{_s}": (f"shin.{_S}", f"j_asi_c_{_s}"),
                 f"foot_{_s}": (f"foot.{_S}", f"j_asi_d_{_s}"), f"ball_{_s}": (f"foot.{_S}", f"j_asi_e_{_s}")})
    for _ue, _ff in FINGERS:
        BODY[f"{_ue}_metacarpal_{_s}"] = (f"hand.{_S}", f"j_te_{_s}")
        for _n in ("01", "02", "03"):
            BODY[f"{_ue}_{_n}_{_s}"] = (f"{_ue}.{_S}", f"finger:{_ff}:{_s}")


# ----------------------------------------------------------------------------- helpers

def affine(lin, src_point, dst_point):
    m = np.eye(4)
    m[:3, :3] = lin
    m[:3, 3] = dst_point - lin @ src_point
    return m


def body_bone(name, J):
    """First ancestor (or self) that is a body bone; None for the root / ik bones."""
    while name is not None and name not in BODY:
        name = J[name]["parent"]
    return name


def joint_tables():
    """Per source joint index: retarget segment, FFXIV bone, and whether it is a skirt-chain bone."""
    J = sd.joints()
    names = sd.joint_names()
    seg, ff, skirt = [], [], []
    for n in names:
        b = body_bone(n, J)
        s, f = BODY[b] if b else (None, "torso")
        seg.append(s)
        ff.append(f)
        skirt.append(n.startswith(SKIRT_CHAINS))
    return np.array(seg, object), np.array(ff, object), np.array(skirt)


def eyeball_mask(m):
    """Eyes_01 holds the eyeballs (UV 0..1) and the teeth and tongue (UV x >= 1)."""
    return m["uv0"][:, 0] < 1.0


# ----------------------------------------------------------------------------- retarget

class Retarget:
    """Moves points from Mantis's bind pose (game axes) into an FFXIV race's bind pose."""

    def __init__(self, race, prof):
        J = sd.joints()
        H0 = {n: j["pos"] for n, j in J.items()}
        names, parent, world = rig.load_skeleton(f"skeleton_{race}")
        F = {n: world[n][:3, 3].copy() for n in names}
        for s, _ in SIDES:
            F[f"knee_{s}"] = (F[f"j_asi_b_{s}"] + F[f"j_asi_c_{s}"]) / 2
        self.F, self.prof, self.race = F, prof, race

        def dist(a, b):
            return float(np.linalg.norm(a - b))

        leg = (dist(F["j_asi_a_l"], F["knee_l"]) + dist(F["knee_l"], F["j_asi_d_l"])) / \
              (dist(H0["thigh_l"], H0["calf_l"]) + dist(H0["calf_l"], H0["foot_l"]))
        torso = (F["j_kubi"][1] - F["j_asi_a_l"][1]) / (H0["neck_01"][1] - H0["thigh_l"][1])
        arm = (dist(F["j_ude_a_l"], F["j_ude_b_l"]) + dist(F["j_ude_b_l"], F["j_te_l"])) / \
              (dist(H0["upperarm_l"], H0["lowerarm_l"]) + dist(H0["lowerarm_l"], H0["hand_l"]))
        self.scale = s = float(np.exp(np.mean(np.log([leg, torso, arm]))))
        print(f"  size ratios FFXIV/Mantis: legs {leg:.3f} torso {torso:.3f} arms {arm:.3f} -> scale {s:.3f}")
        hip_m = (H0["thigh_l"] + H0["thigh_r"]) / 2
        hip_f = (F["j_asi_a_l"] + F["j_asi_a_r"]) / 2
        self.t = hip_f - s * hip_m
        H = {n: s * p + self.t for n, p in H0.items()}
        self.H = H
        floor = self.t[1]

        # feet: uniform scale about her ankle, sole on the floor, under the FFXIV ankle
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
            eyes_m = self.skull_centre() * s + self.t
            eyes_f = self.ffxiv_face_centre(race)
        else:
            eyes_m = self.eyes() * s + self.t
            eyes_f = self.ffxiv_eyes(race)
        eyes_f = eyes_f + np.array([0, prof.get("eye_dy", 0.0), prof["eye_dz"]])
        head_base = eyes_f - kh * (eyes_m - H["head"])
        print(f"  eyes: Mantis {np.round(eyes_m, 3)} -> FFXIV {np.round(eyes_f, 3)}; head base "
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
        self.knuckles = {}
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
                lin = rig.rot_between(Lp @ (H[child] - H[b]), f1 - f0) @ Lp
                M[seg] = affine(lin, H[b], f0)
                if seg.endswith(".L"):
                    self.knuckles[seg] = np.linalg.norm(f0 - anchor)
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
            if kind == "palm":       # rigid, stretched along the palm to the FFXIV knuckles
                k = np.linalg.norm(d_f) / np.linalg.norm(d_s)
                u = d_s / np.linalg.norm(d_s)
                lin = R @ (np.eye(3) + (k - 1) * np.outer(u, u))
            else:
                k = np.linalg.norm(d_f) / np.linalg.norm(d_s)
                u = d_s / np.linalg.norm(d_s)
                lin = R @ (np.eye(3) + (k - 1) * np.outer(u, u))
            M[seg] = affine(lin, H[b], anchor)
            ang = math.degrees(math.acos(np.clip(np.dot(d_s, d_f) / np.linalg.norm(d_s) / np.linalg.norm(d_f), -1, 1)))
            if seg.endswith("L") or seg == "neck":
                print(f"  {seg:12s} turned {ang:5.1f} deg" + (f", stretched x{np.linalg.norm(d_f) / np.linalg.norm(d_s):.2f}"
                                                          if kind in ("stretch", "palm") else ""))
        self.M = M
        print("  finger bases moved onto the FFXIV knuckles (left, mm): " + ", ".join(
            f"{k[:-2]} {d * 1000:.1f}" for k, d in self.knuckles.items()))

    def eyes(self):
        m = sd.mesh("Eyes_01")
        p = m["pos"][eyeball_mask(m)]
        c = [(q.min(0) + q.max(0)) / 2 for q in (p[p[:, 0] > 0], p[p[:, 0] < 0])]
        return np.mean(c, axis=0)

    def skull_centre(self):
        """Centre of the skull above the head bone, leaving out the antennae and ears."""
        m = sd.mesh("Head")
        side = np.array([n.startswith(("Antenna", "ear")) for n in sd.joint_names()])
        p = m["pos"][(m["pos"][:, 1] > sd.joints()["head"]["pos"][1]) & ((side[m["joints"]] * m["weights"]).sum(1) < 0.05)]
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

    def apply(self, m, seg_of, force=None):
        """Mesh m (source bind pose) -> FFXIV positions and normals. seg_of: segment per source joint index;
        force: one segment for the whole mesh."""
        P = m["pos"] * self.scale + self.t
        tp, tsx = self.field(P)
        if force is not None:
            segs = np.full(m["joints"].shape, force, object)
            W = np.zeros_like(m["weights"])
            W[:, 0] = 1
        else:
            segs = seg_of[m["joints"]]
            W = m["weights"]
        out = np.zeros_like(P)
        lin = np.zeros((len(P), 3, 3))
        tot = np.zeros(len(P))
        for k in range(segs.shape[1]):
            for sg in set(segs[:, k]):
                sel = (segs[:, k] == sg) & (W[:, k] > 0)
                if not sel.any():
                    continue
                w = W[sel, k]
                if sg is None:
                    out[sel] += w[:, None] * tp[sel]
                    lin[sel] += w[:, None, None] * np.array([np.diag([sx, 1, 1]) for sx in tsx[sel]])
                else:
                    mm = self.M[sg]
                    out[sel] += w[:, None] * (P[sel] @ mm[:3, :3].T + mm[:3, 3])
                    lin[sel] += w[:, None, None] * mm[:3, :3]
                tot[sel] += w
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


def along(p, a, b):
    ax = b - a
    return (p - a) @ ax / np.dot(ax, ax)


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


def own_weights(m, pos, F, ff_of, skirt_of):
    """Her weights renamed onto FFXIV bones, torso spread by height, skirt-chain weight onto the FFXIV skirt
    chains, arm weight shared with the twist helpers."""
    chain = [(F["j_kubi"][1] - 0.02, "j_kubi"), (F["j_sebo_c"][1], "j_sebo_c"), (F["j_sebo_b"][1], "j_sebo_b"),
             (F["j_sebo_a"][1], "j_sebo_a"), (F["j_asi_a_l"][1], "j_kosi")]
    hs = np.array([h for h, _ in chain])
    jt, wt = m["joints"], m["weights"]
    sk_frac = (skirt_of[jt] * wt).sum(1)
    sk = skirt_dicts(pos, F) if (sk_frac > 0).any() else None
    out = []
    for i in range(len(pos)):
        d = {}
        torso = 0.0
        for j, w in zip(jt[i], wt[i]):
            if w <= 0 or skirt_of[j]:
                continue
            n = ff_of[j]
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
                j = np.nonzero(hs > y)[0][-1]
                t = (hs[j] - y) / (hs[j] - hs[j + 1])
                d[chain[j][1]] = d.get(chain[j][1], 0) + torso * (1 - t)
                d[chain[j + 1][1]] = d.get(chain[j + 1][1], 0) + torso * t
        if sk_frac[i] > 0:
            for b, w in sk[i].items():
                d[b] = d.get(b, 0) + sk_frac[i] * w
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


def rigid_islands(part, max_size):
    """Pieces smaller than max_size (bbox diagonal, m) move as one: their weights are averaged."""
    ids, inv = np.unique(part["vid"], return_inverse=True)
    uf = inv[part["faces"]]
    comp = components(uf, len(ids))[inv]
    n = 0
    for c in np.unique(comp):
        sel = comp == c
        p = part["pos"][sel]
        if np.linalg.norm(p.max(0) - p.min(0)) >= max_size:
            continue
        d = {}
        for row_b, row_w in zip(part["bones"][sel], part["weights"][sel]):
            for b, w in zip(row_b, row_w):
                if b:
                    d[b] = d.get(b, 0) + w
        B, W = to_arrays([d])
        part["bones"][sel], part["weights"][sel] = B[0], W[0]
        n += 1
    return n


def single(n, bone):
    return np.array([[bone, "", "", ""]] * n, object), np.tile([1.0, 0, 0, 0], (n, 1))


# ----------------------------------------------------------------------------- parts

def fit_race(race):
    prof = PROFILES[race]
    print(race)
    rt = Retarget(race, prof)
    F = rt.F
    seg_of, ff_of, skirt_of = joint_tables()
    parts = {}
    for name, (texset, slot) in PARTS.items():
        m = sd.mesh(name)
        if name == "Eyes_01":
            m = sd.submesh(m, eyeball_mask(m)[m["faces"]].all(1))
        force = "head" if name in RIGID_HEAD else None
        pos, nrm = rt.apply(m, seg_of, force)
        if force:
            B, W = single(len(pos), "j_kao")
        else:
            B, W = own_weights(m, pos, F, ff_of, skirt_of)
        part = dict(pos=pos, nrm=nrm, uv=np.c_[m["uv"][:, 0], 1 - m["uv"][:, 1]], faces=m["faces"], vid=m["vid"] + len(parts) * 1000000,
                    bones=B, weights=W, texset=texset, slot=slot)
        if name in ISLAND:
            print(f"  {name}: {rigid_islands(part, ISLAND[name])} rigid pieces")
        parts[name] = part
    for n, p in sorted(parts.items()):
        print(f"  part {n:10s} {p['texset']:7s} slot {p['slot']}: {len(p['pos']):6d} verts {len(p['faces']):6d} tris, "
              f"y {p['pos'][:, 1].min():.3f}..{p['pos'][:, 1].max():.3f}, bones {len({b for b in p['bones'].ravel() if b})}")
    os.makedirs(os.path.join(ROOT, "work", "fit"), exist_ok=True)
    pickle.dump(dict(parts=parts, joints=F, ankle=rt.ankle, scale=rt.scale),
                open(os.path.join(ROOT, "work", "fit", f"{race}.pkl"), "wb"))
    print("wrote", race)


if __name__ == "__main__":
    for r in (sys.argv[1:] or list(PROFILES)):
        fit_race(r)
