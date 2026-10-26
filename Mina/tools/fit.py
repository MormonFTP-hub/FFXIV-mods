"""Fit Mina (Deadlock, Rigify rig "Mina RIG") onto an FFXIV race skeleton.

Positions are retargeted through Mina's own rig (her DEF bones, in their rest pose):
  * one uniform scale (geometric mean of the leg, torso and arm length ratios), hips on the FFXIV hips
  * torso: a height lattice through her ankles, knees, hips, shoulders and neck, scaled in width
  * limbs: one affine per bone, parents first, rotated onto the FFXIV bone and stretched to its length
  * hands: rigid, twisted so the knuckles line up with the FFXIV fingers
  * boots: rigid (her high heels keep their shape), heel tip on the floor under the FFXIV ankle
  * head: rigid, scaled by `head`, eyes on the FFXIV face's eyes; the neck stretches to meet it
Weights:
  * body, legs, garter buckles: hers, renamed onto FFXIV bones; her spine weight is spread over the FFXIV spine
    by height, and the arm weight is shared with the FFXIV twist helpers (n_hkata, n_hhiji, n_hte) the way the
    vanilla body shares it
  * skirt and bat-wing overskirt: the FFXIV skirt chains (j_sk_f/s/b, physics), by angle round the body and
    height, with the waistband on the hips
  * purse and strap: copied from the nearest point of the fitted jacket
  * head, hair, eyes, brows: rigid on j_kao, the neck on j_kubi

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
from islands import components  # noqa: E402

ROOT = rig.ROOT
RIG = "Mina RIG"
SIDES = (("l", "L"), ("r", "R"))
# Per race: head scale (on top of the body scale), boot scale, and how far her eyes sit in front of (eye_dz) and
# above (eye_dy) the FFXIV eyes, or her skull centre from theirs (align="centre", for the Lalafell's big head).
# Checked with tools/poke.py: the wearer's own face should stay inside her head.
# At FFXIV size her full bob reads big (17.5% of her height wide, against 15% in Deadlock).
# small_head: the "Deadlock size" option's head (with every player face hidden, it no longer has to cover one):
# her Deadlock head-to-height ratio, i.e. the height ratio over the body scale (0.69 / 0.76 for the Midlander
# woman); the Lalafell keep a chibi head, just a smaller one.
# The default head keeps her full bob and stays big enough for custom faces too: at 1.00 the user's Abigail - Demon
# face (Midlander face 1, elf ears via atrx_ears / shpx_elf) showed an ear tip and its jaw in GS; 1.08 covers it.
# small_hair: how much of the Deadlock-size head's bob thickness above her scalp is kept (slim_hair()).
PROFILES = {
    "c0201": dict(head=1.08, foot=1.0, eye_dz=0.005, small_head=0.91, small_hair=0.8),
    "c0101": dict(head=1.15, foot=1.0, eye_dz=0.005, small_head=0.90, small_hair=0.8),
    "c1101": dict(head=2.25, foot=1.0, eye_dz=0.018, eye_dy=0.012, align="centre", small_head=1.7, small_hair=1.0),
}
HAIR_GAP = 0.004                # m the slimmed hair keeps off her scalp
HAIR_EAR_CONE = (35.0, 55.0)    # degrees round from the left-right axis where the bob stays full (fading to 55)
HAIR_EAR_ELEV = (22.0, 38.0)    # and degrees up or down from the head centre's horizontal
EAR_START, EAR_KEEP = 0.82, 0.3   # tuck_ears(): where the ears' overhang starts, and how much of it stays
TEXSET = {"mina_upper.004": "upper", "mina_lower.004": "lower", "mina_lower_buckle": "lower", "mina_head.004": "head",
          "mina_hair.004": "hair", "mina_eyes.004": "eyes", "mina_bag.004": "bag", "mina_charm.004": "charm"}
DROP = {"Teeth", "Mouth"}       # inside of the mouth: her mouth is closed and the face is static
HEAD_MESHES = ("head", "Hair", "Eyebrows", "EyeL", "EyesR")
SKIRT_MESHES = ("Skirt", "Dress")
WAIST_BLEND = 0.035             # m either side of a skirt joint where its weight hands over to the next
NOT_BONES = {"Solidfy", "Pin"}  # vertex groups for the outline and cloth modifiers
# The game's idle and /cpose stances hang the hands at the hips, 0.2-0.27 m from the body axis and 70-110 deg round
# from the front (tools/hands.py). There her skirts flare out to 0.4 m and swallow the hands. The "Overskirt"
# option's draped parts (*_draped) hang closer to vertical in that sector (drape()): the angle from vertical is
# scaled by DRAPE_FRACTION, no closer than DRAPE_GAP to the layer beneath.
DRAPE_SECTOR = (65.0, 115.0)    # degrees from the front, each side
DRAPE_FADE = 25.0               # degrees over which the drape fades out on either side of the sector
DRAPE_FRACTION = 0.25
DRAPE_GAP = 0.010
DRAPE_EASE = 0.04               # m below the waist over which the swing fades in


# ----------------------------------------------------------------------------- helpers

def affine(lin, src_point, dst_point):
    m = np.eye(4)
    m[:3, :3] = lin
    m[:3, 3] = dst_point - lin @ src_point
    return m


def deformer_of(bone):
    """Mina RIG bone -> the retarget segment that moves it (None: torso lattice)."""
    side = "L" if ".L" in bone else "R" if ".R" in bone else None
    b = bone.split(".")[0]
    if bone.startswith("ORG-") or bone in ("DEF-spine.006",):
        return "head"
    if bone in ("DEF-spine.004", "DEF-spine.005"):
        return "neck"
    for key, seg in (("DEF-shoulder", "shoulder"), ("DEF-upper_arm", "upper_arm"), ("DEF-forearm", "forearm"),
                     ("DEF-hand", "hand"), ("DEF-palm", "hand"), ("DEF-f_", "hand"), ("DEF-thumb", "hand"),
                     ("DEF-thigh", "thigh"), ("DEF-shin", "shin"), ("DEF-foot", "foot"), ("DEF-toe", "foot")):
        if b.startswith(key) or bone.startswith(key):
            return f"{seg}.{side}"
    return None


def ffxiv_bone(bone):
    """Mina RIG deform bone -> FFXIV bone; "torso" for the spine/pelvis (spread by height)."""
    side = "l" if ".L" in bone else "r" if ".R" in bone else None
    if bone.startswith("ORG-") or bone == "DEF-spine.006":
        return "j_kao"
    if bone in ("DEF-spine.004", "DEF-spine.005"):
        return "j_kubi"
    if bone.startswith("DEF-breast"):
        return f"j_mune_{side}"
    fixed = {"DEF-shoulder": "j_sako", "DEF-upper_arm": "j_ude_a", "DEF-forearm": "j_ude_b", "DEF-hand": "j_te",
             "DEF-palm": "j_te", "DEF-thigh": "j_asi_a", "DEF-shin": "j_asi_c", "DEF-foot": "j_asi_d",
             "DEF-toe": "j_asi_e"}
    for k, v in fixed.items():
        if bone.startswith(k + "."):
            return f"{v}_{side}"
    fingers = {"DEF-thumb": "oya", "DEF-f_index": "hito", "DEF-f_middle": "naka", "DEF-f_ring": "kusu",
               "DEF-f_pinky": "ko"}
    for k, f in fingers.items():
        if bone.startswith(k + "."):
            n = int(bone.split(".")[1])
            return f"j_{f}_{'a' if n == 1 else 'b'}_{side}"
    return "torso"


# ----------------------------------------------------------------------------- retarget

class Retarget:
    """Moves points from Mina's bind pose (game axes) into an FFXIV race's bind pose."""

    def __init__(self, race, prof):
        self.B = B = sd.bones(RIG)
        names, parent, world = rig.load_skeleton(f"skeleton_{race}")
        F = {n: world[n][:3, 3].copy() for n in names}
        for s, _ in SIDES:
            F[f"knee_{s}"] = (F[f"j_asi_b_{s}"] + F[f"j_asi_c_{s}"]) / 2
        self.F, self.prof, self.race = F, prof, race
        H0 = {n: b["head"] for n, b in B.items()}

        def dist(a, b):
            return float(np.linalg.norm(a - b))

        leg = (dist(F["j_asi_a_l"], F["knee_l"]) + dist(F["knee_l"], F["j_asi_d_l"])) / \
              (dist(H0["DEF-thigh.L"], H0["DEF-shin.L"]) + dist(H0["DEF-shin.L"], H0["DEF-foot.L"]))
        torso = (F["j_kubi"][1] - F["j_asi_a_l"][1]) / (H0["DEF-spine.004"][1] - H0["DEF-thigh.L"][1])
        arm = (dist(F["j_ude_a_l"], F["j_ude_b_l"]) + dist(F["j_ude_b_l"], F["j_te_l"])) / \
              (dist(H0["DEF-upper_arm.L"], H0["DEF-forearm.L"]) + dist(H0["DEF-forearm.L"], H0["DEF-hand.L"]))
        self.scale = s = float(np.exp(np.mean(np.log([leg, torso, arm]))))
        print(f"  size ratios FFXIV/Mina: legs {leg:.3f} torso {torso:.3f} arms {arm:.3f} -> scale {s:.3f}")
        hip_m = (H0["DEF-thigh.L"] + H0["DEF-thigh.R"]) / 2
        hip_f = (F["j_asi_a_l"] + F["j_asi_a_r"]) / 2
        self.t = hip_f - s * hip_m
        H = {n: s * p + self.t for n, p in H0.items()}
        self.H = H
        floor = self.t[1]

        # boots: uniform scale about her ankle, heel on the floor, under the FFXIV ankle
        kf = prof["foot"]
        A = {}
        for sd_, S in SIDES:
            a = F[f"j_asi_d_{sd_}"].copy()
            a[1] = kf * (H[f"DEF-foot.{S}"][1] - floor)
            A[sd_] = a
        self.ankle = A

        knots = [("DEF-foot.L", A["l"]), ("DEF-shin.L", F["knee_l"]), ("DEF-thigh.L", F["j_asi_a_l"]),
                 ("DEF-upper_arm.L", F["j_ude_a_l"]), ("DEF-spine.004", F["j_kubi"])]
        self.ky = np.array([H[a][1] for a, _ in knots])
        self.fy = np.array([f[1] for _, f in knots])
        assert np.all(np.diff(self.ky) > 0) and np.all(np.diff(self.fy) > 0)
        self.sx_y = np.array([H["DEF-thigh.L"][1], H["DEF-upper_arm.L"][1]])
        self.sx_v = np.array([F["j_asi_a_l"][0] / H["DEF-thigh.L"][0], F["j_ude_a_l"][0] / H["DEF-upper_arm.L"][0]])
        self.dz = np.array([f[2] - H[a][2] for a, f in knots])
        print("  lattice y", np.round(self.ky, 3), "->", np.round(self.fy, 3), " width", np.round(self.sx_v, 3),
              " dz", np.round(self.dz, 3))

        # head: uniform scale about the head bone, her eyes onto the FFXIV eyes (or, for Lalafell, her skull's
        # centre onto the centre of their much bigger skull); the neck stretches to meet it
        kh = prof["head"]
        if prof.get("align") == "centre":
            eyes_m = self.mina_skull_centre() * s + self.t
            eyes_f = self.ffxiv_face_centre(race)
        else:
            eyes_m = self.mina_eyes() * s + self.t
            eyes_f = self.ffxiv_eyes(race)
        eyes_f = eyes_f + np.array([0, prof.get("eye_dy", 0.0), prof["eye_dz"]])
        head_base = eyes_f - kh * (eyes_m - H["DEF-spine.006"])
        print(f"  eyes: Mina {np.round(eyes_m, 3)} -> FFXIV {np.round(eyes_f, 3)}; head base "
              f"{np.round(H['DEF-spine.006'], 3)} -> {np.round(head_base, 3)} (j_kao {np.round(F['j_kao'], 3)})")

        # segment -> (bone, child bone or None, FFXIV start, FFXIV target, kind, twist)
        D = {"neck": ("DEF-spine.004", "DEF-spine.006", F["j_kubi"], head_base, "stretch", None),
             "head": ("DEF-spine.006", None, head_base, head_base, "head", None)}
        for sd_, S in SIDES:
            D.update({
                f"shoulder.{S}": (f"DEF-shoulder.{S}", f"DEF-upper_arm.{S}", F[f"j_sako_{sd_}"], F[f"j_ude_a_{sd_}"], "stretch", None),
                f"upper_arm.{S}": (f"DEF-upper_arm.{S}", f"DEF-forearm.{S}", F[f"j_ude_a_{sd_}"], F[f"j_ude_b_{sd_}"], "stretch", None),
                f"forearm.{S}": (f"DEF-forearm.{S}", f"DEF-hand.{S}", F[f"j_ude_b_{sd_}"], F[f"j_te_{sd_}"], "stretch", None),
                f"hand.{S}": (f"DEF-hand.{S}", f"DEF-f_middle.01.{S}", F[f"j_te_{sd_}"], F[f"j_naka_a_{sd_}"], "rigid",
                              ((f"DEF-f_index.01.{S}", f"DEF-f_pinky.01.{S}"), (F[f"j_hito_a_{sd_}"], F[f"j_ko_a_{sd_}"]))),
                f"thigh.{S}": (f"DEF-thigh.{S}", f"DEF-shin.{S}", F[f"j_asi_a_{sd_}"], F[f"knee_{sd_}"], "stretch", None),
                f"shin.{S}": (f"DEF-shin.{S}", f"DEF-foot.{S}", F[f"knee_{sd_}"], A[sd_], "stretch", None),
                f"foot.{S}": (f"DEF-foot.{S}", None, A[sd_], A[sd_], "place", None),
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

    def mina_eyes(self):
        pts = [sd.mesh(n)["pos"] for n in ("EyeL", "EyesR")]
        return np.mean([(p.min(0) + p.max(0)) / 2 for p in pts], axis=0)

    def mina_skull_centre(self):
        p = sd.mesh("head")["pos"]
        p = p[p[:, 1] > self.B["DEF-spine.006"]["head"][1]]
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
        """Mesh m (source bind pose, game axes) -> FFXIV positions and normals. Groups that are not Mina RIG bones
        use `default` (a segment name, or None for the torso lattice)."""
        P = m["pos"] * self.scale + self.t
        tp, tsx = self.field(P)
        segs = [deformer_of(g) if (RIG in m["armatures"] and g in self.B and self.B[g]["deform"]) else default
                for g in m["group_names"]]
        W = m["groups"].astype(float).copy()
        for g, name in enumerate(m["group_names"]):
            if name in NOT_BONES:
                W[:, g] = 0
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
            if default in self.M:
                mm = self.M[default]
                out[none] = P[none] @ mm[:3, :3].T + mm[:3, 3]
                lin[none] = mm[:3, :3]
            else:
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


def own_weights(m, pos, F):
    """Mina's weights renamed onto FFXIV bones, torso spread by height, arm weight shared with the twist helpers."""
    chain = [(F["j_kubi"][1] - 0.02, "j_kubi"), (F["j_sebo_c"][1], "j_sebo_c"), (F["j_sebo_b"][1], "j_sebo_b"),
             (F["j_sebo_a"][1], "j_sebo_a"), (F["j_asi_a_l"][1], "j_kosi")]
    hs = np.array([h for h, _ in chain])
    names = [ffxiv_bone(g) if g.startswith(("DEF-", "ORG-")) else None for g in m["group_names"]]
    G = m["groups"]
    out = []
    for i in range(len(pos)):
        d = {}
        torso = 0.0
        for g in np.nonzero(G[i] > 0)[0]:
            n, w = names[g], float(G[i, g])
            if n is None:
                continue
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
            # the hips above the waist joint, then each skirt bone down to the next joint, blending across each
            # joint (a, b, c) over +-WAIST_BLEND
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


def nearest(query, ref, chunk=512):
    ref = ref.astype(np.float32)
    rr = (ref ** 2).sum(1)
    idx = np.empty(len(query), np.int64)
    for i in range(0, len(query), chunk):
        q = query[i:i + chunk].astype(np.float32)
        idx[i:i + chunk] = (rr[None, :] - 2 * q @ ref.T).argmin(1)
    return idx


def copy_weights(pos, ref_pos, ref_bones, ref_weights):
    i = nearest(pos, ref_pos)
    return ref_bones[i].copy(), ref_weights[i].copy()


def rigid_islands(part, max_size):
    """Pieces smaller than max_size (bbox diagonal, m) move as one: their weights are averaged."""
    ids, inv = np.unique(part["vid"], return_inverse=True)
    uf = inv[part["faces"]]
    comp = components(uf, len(ids))[inv]
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


def single(n, bone):
    return np.array([[bone, "", "", ""]] * n, object), np.tile([1.0, 0, 0, 0], (n, 1))


# ----------------------------------------------------------------------------- hair

def ray_last_hit(orig, dirs, tris):
    """Distance along each ray (from orig, unit dirs) to the farthest triangle it meets; -inf where none."""
    best = np.full(len(dirs), -np.inf)
    v0, e1, e2 = tris[:, 0], tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0]
    for i in range(0, len(tris), 2000):
        a0, a1, a2 = v0[i:i + 2000], e1[i:i + 2000], e2[i:i + 2000]
        for j in range(0, len(dirs), 256):
            d = dirs[j:j + 256, None]
            p = np.cross(d, a2[None])
            det = np.einsum("rtk,tk->rt", p, a1)
            ok = np.abs(det) > 1e-12
            inv = np.where(ok, 1 / np.where(ok, det, 1), 0)
            tv = orig[None, None] - a0[None]
            u = np.einsum("rtk,rtk->rt", np.broadcast_to(tv, p.shape), p) * inv
            q = np.cross(np.broadcast_to(tv, p.shape), a1[None])
            v = np.einsum("rk,rtk->rt", d[:, 0], q) * inv
            t = np.einsum("rtk,tk->rt", q, a2) * inv
            h = ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 1e-5)
            t = np.where(h, t, -np.inf).max(1)
            best[j:j + 256] = np.maximum(best[j:j + 256], t)
    return best


def tuck_ears(head):
    """Her pointed ears stick out past the skull (0.089 m from the centre line against the skull's 0.077 m for
    the Midlander woman). They are always under the bob, but the slimmed bob's surface cut through their tips, so
    everything beyond EAR_START of the head's half-width keeps only EAR_KEEP of its overhang."""
    x0 = EAR_START * np.abs(head[:, 0]).max()
    out = head.copy()
    over = np.abs(head[:, 0]) > x0
    out[over, 0] = np.sign(head[over, 0]) * (x0 + (np.abs(head[over, 0]) - x0) * EAR_KEEP)
    return out


def slim_hair(hair, skull_pos, skull_faces, keep, protect_ears=True):
    """Pull the bob in toward her head: along the line from the skull's centre, the hair's distance beyond the
    head's outermost surface in that direction (so her ears stay covered) is scaled by `keep`, never closer than
    HAIR_GAP. Points with no head behind them don't move. With protect_ears, the sides at ear height stay full."""
    if keep >= 1:
        return hair
    c = (skull_pos.min(0) + skull_pos.max(0)) / 2
    d = hair - c
    dist = np.linalg.norm(d, axis=1)
    u = d / np.maximum(dist, 1e-9)[:, None]
    scalp = ray_last_hit(c, u, skull_pos[skull_faces])
    out = hair.copy()
    over = np.isfinite(scalp) & (dist > scalp + HAIR_GAP)
    # the sides at ear height keep their full thickness: custom faces' ears (e.g. a face mod's atrx_ears, which
    # the head's EQP can't hide) sit there, inside her full bob
    def fade(a, lim):
        t = np.clip((lim[1] - a) / (lim[1] - lim[0]), 0, 1)
        return t * t * (3 - 2 * t)

    side = np.degrees(np.arctan2(np.abs(u[:, 2]), np.abs(u[:, 0])))      # round from the left-right axis
    elev = np.degrees(np.abs(np.arcsin(np.clip(u[:, 1], -1, 1))))        # up or down from horizontal
    ear = fade(side, HAIR_EAR_CONE) * fade(elev, HAIR_EAR_ELEV) * protect_ears
    k = keep + (1 - keep) * ear
    new = scalp + HAIR_GAP + (dist - scalp - HAIR_GAP) * k
    out[over] = c + u[over] * new[over, None]
    print(f"    hair: {over.sum()} of {len(hair)} points pulled in, width {np.ptp(hair[:, 0]):.3f} -> {np.ptp(out[:, 0]):.3f} m")
    return out


# ----------------------------------------------------------------------------- drape

def _grid_max(pos, th_bins, y_bins):
    """Largest distance from the body axis per (angle, height) cell; -1 where empty."""
    th = np.degrees(np.arctan2(pos[:, 0], pos[:, 2]))
    r = np.hypot(pos[:, 0], pos[:, 2])
    i = np.clip(np.digitize(th, th_bins) - 1, 0, len(th_bins) - 2)
    j = np.clip(np.digitize(pos[:, 1], y_bins) - 1, 0, len(y_bins) - 2)
    g = np.full((len(th_bins) - 1, len(y_bins) - 1), -1.0)
    np.maximum.at(g, (i, j), r)
    # an empty cell takes its fullest neighbour (thin garments leave gaps between their vertices)
    for _ in range(2):
        pad = np.pad(g, 1, mode="edge")
        nb = np.max([pad[1 + a:pad.shape[0] - 1 + a, 1 + b:pad.shape[1] - 1 + b]
                     for a in (-1, 0, 1) for b in (-1, 0, 1)], axis=0)
        g = np.where(g < 0, nb, g)
    return g


def _circ_smooth(v, sigma):
    """Gaussian smoothing of a value per angle bin, wrapping round the body."""
    k = np.exp(-0.5 * (np.arange(-3 * sigma, 3 * sigma + 1) / sigma) ** 2)
    k /= k.sum()
    n = len(k) // 2
    return np.convolve(np.concatenate([v[-n:], v, v[:n]]), k, mode="valid")


def drape(pos, nrm, inner, f=DRAPE_FRACTION):
    """Let a skirt hang closer to vertical where the arms hang (the sides), as cloth would under gravity.

    Each point swings about the waist in the vertical plane through the body axis, keeping its distance from the
    waist: its angle from vertical is multiplied by one factor per angle round the body. The factor is `f` in
    the arm sector, fading back to 1 over DRAPE_FADE degrees on either side, but no smaller than keeps the
    garment DRAPE_GAP outside the layer beneath (`inner`: points of the skirt / legs under it). Waist line and
    factor are both smoothed round the body, and the swing fades in over the first DRAPE_EASE m below the waist,
    so the result is continuous and a lined panel's two sides move together."""
    th = np.degrees(np.arctan2(pos[:, 0], pos[:, 2]))
    a = np.abs(th)
    lo, hi = DRAPE_SECTOR
    w = np.clip(np.minimum(a - (lo - DRAPE_FADE), (hi + DRAPE_FADE) - a) / DRAPE_FADE, 0, 1)
    w = 0.5 - 0.5 * np.cos(np.pi * w)
    rad = np.hypot(pos[:, 0], pos[:, 2])
    tb = np.arange(-180, 181, 3.0)
    tc = (tb[:-1] + tb[1:]) / 2
    ti = np.clip(np.digitize(th, tb) - 1, 0, len(tb) - 2)
    # waist line: the garment's highest point per angle, smoothed round the body
    yw = np.full(len(tc), -1e9)
    np.maximum.at(yw, ti, pos[:, 1])
    rw = np.zeros(len(tc))
    top = pos[:, 1] >= yw[ti] - 1e-6
    rw[ti[top]] = rad[top]
    empty = yw < -1e8
    yw[empty], rw[empty] = np.interp(tc[empty], tc[~empty], yw[~empty], period=360), \
        np.interp(tc[empty], tc[~empty], rw[~empty], period=360)
    yw, rw = _circ_smooth(yw, 3), _circ_smooth(rw, 3)
    ywv, rwv = np.interp(th, tc, yw, period=360), np.interp(th, tc, rw, period=360)
    d_r, d_y = rad - rwv, ywv - pos[:, 1]
    L = np.hypot(d_r, d_y)
    phi = np.arctan2(d_r, d_y)
    ease = np.clip(L / DRAPE_EASE, 0, 1) * (d_y > 0)
    yb = np.arange(min(pos[:, 1].min(), inner[:, 1].min()) - 0.3, pos[:, 1].max() + 0.05, 0.01)
    floor = _grid_max(inner, tb, yb)

    def swung(m):
        mm = 1 - ease * (1 - m)
        p = phi * mm
        return p, rwv + L * np.sin(p), ywv - L * np.cos(p)

    # per point: the smallest factor (>= f) that keeps it clear of the layer beneath (points already touching it
    # as modelled don't count)
    _, r0, y0 = swung(np.ones(len(pos)))
    j0 = np.clip(np.digitize(y0, yb) - 1, 0, len(yb) - 2)
    clear0 = (floor[ti, j0] < 0) | (r0 >= floor[ti, j0] + DRAPE_GAP)
    need = np.ones(len(pos))
    alive = np.ones(len(pos), bool)
    for kk in np.linspace(1, f, 31)[1:]:
        _, r2, y2 = swung(1 - w * (1 - kk))
        j = np.clip(np.digitize(y2, yb) - 1, 0, len(yb) - 2)
        ok = (floor[ti, j] < 0) | (r2 >= floor[ti, j] + DRAPE_GAP) | ~clear0
        alive &= ok
        need = np.where(alive, kk, need)        # a point stops at the last factor that still kept it clear
    # the factor as a smooth field over (angle, distance from the waist): the most cautious point per cell, empty
    # cells filled, spread one cell and blurred, then read back bilinearly so neighbouring points (and a lined
    # panel's two sides) swing alike
    lb = np.arange(0, L.max() + 0.03, 0.01)
    li = np.clip(np.digitize(L, lb) - 1, 0, len(lb) - 2)
    grid = np.full((len(tc), len(lb) - 1), np.nan)
    tmp = np.full(grid.shape, -np.inf)
    np.maximum.at(tmp, (ti, li), need)
    grid[np.isfinite(tmp)] = tmp[np.isfinite(tmp)]
    for _ in range(60):
        if not np.isnan(grid).any():
            break
        pad = np.pad(grid, ((0, 0), (1, 1)), mode="edge")
        nb = np.nanmax(np.stack([np.roll(grid, 1, 0), np.roll(grid, -1, 0), pad[:, :-2], pad[:, 2:]]), axis=0)
        grid = np.where(np.isnan(grid), nb, grid)
    grid = np.nan_to_num(grid, nan=1.0)
    pad = np.pad(grid, ((0, 0), (1, 1)), mode="edge")
    grid = np.maximum.reduce([grid, np.roll(grid, 1, 0), np.roll(grid, -1, 0), pad[:, :-2], pad[:, 2:]])
    for _ in range(3):
        pad = np.pad(grid, ((0, 0), (1, 1)), mode="edge")
        grid = (2 * grid + np.roll(grid, 1, 0) + np.roll(grid, -1, 0)) / 4
        grid = (2 * grid + pad[:, :-2] + pad[:, 2:]) / 4
    u = (th - tc[0]) / 3.0
    v = np.clip((L - 0.005) / 0.01, 0, grid.shape[1] - 1.001)
    u0, v0 = np.floor(u).astype(int), np.floor(v).astype(int)
    fu, fv = u - u0, v - v0
    g = lambda a, b: grid[a % len(tc), b]  # noqa: E731
    k = ((1 - fu) * (1 - fv) * g(u0, v0) + fu * (1 - fv) * g(u0 + 1, v0) + (1 - fu) * fv * g(u0, v0 + 1)
         + fu * fv * g(u0 + 1, v0 + 1))
    m = 1 - w * (1 - k)
    p_new, r2, y2 = swung(m)
    moved = (w > 0) & (ease > 0)
    out = pos.copy()
    scale = np.where(rad > 1e-6, r2 / np.maximum(rad, 1e-6), 1.0)
    out[moved, 0] = pos[moved, 0] * scale[moved]
    out[moved, 2] = pos[moved, 2] * scale[moved]
    out[moved, 1] = y2[moved]
    # rotate the normals with the swing, in the vertical plane through the axis
    dl = p_new - phi
    rhat = np.stack([np.sin(np.radians(th)), np.zeros(len(th)), np.cos(np.radians(th))], 1)
    nr = np.sum(nrm * rhat, 1)
    ny = nrm[:, 1]
    rest = nrm - rhat * nr[:, None] - np.array([0, 1, 0]) * ny[:, None]
    c, s = np.cos(dl), np.sin(dl)
    nr2, ny2 = c * nr - s * ny, s * nr + c * ny
    n2 = rest + rhat * nr2[:, None] + np.array([0, 1.0, 0]) * ny2[:, None]
    n_out = np.where(moved[:, None], n2, nrm)
    print(f"    drape: {moved.sum()} points in the arm sector, mean swing {np.degrees(np.abs(dl[moved])).mean():.1f} deg, "
          f"max {np.degrees(np.abs(dl[moved])).max():.1f} deg")
    return out, n_out / np.maximum(np.linalg.norm(n_out, axis=1, keepdims=True), 1e-9)


# ----------------------------------------------------------------------------- parts

def split_skin(parts):
    """Her bare skin on the shared upper / lower atlases (chest, thighs) gets its own part, texset skin_upper /
    skin_lower, for skin.shpk: a triangle is skin when at least three of its corners and centroid sit on skin texels
    (textures.is_skin)."""
    from PIL import Image
    from textures import SKIN_SETS, is_skin
    images = {}

    def subset(p, sel, texset):
        f = p["faces"][sel]
        used, remap = np.unique(f, return_inverse=True)
        return dict(p, pos=p["pos"][used], nrm=p["nrm"][used], uv=p["uv"][used], faces=remap.reshape(-1, 3),
                    vid=p["vid"][used], bones=p["bones"][used], weights=p["weights"][used], texset=texset)

    for name in [n for n, p in parts.items() if p["texset"] in ("upper", "lower") and not p.get("variant")]:
        p = parts[name]
        skin_set = f"skin_{p['texset']}"
        if skin_set not in images:
            images[skin_set] = np.asarray(Image.open(os.path.join(sd.TEX, SKIN_SETS[skin_set][0] + ".png")).convert("RGB"))
        img = images[skin_set]
        h, w = img.shape[:2]
        uv = p["uv"][p["faces"]]                                      # (T, 3, 2)
        pts = np.concatenate([uv, uv.mean(1, keepdims=True)], 1)      # corners + centroid
        x = np.clip((pts[..., 0] % 1.0) * w, 0, w - 1).astype(int)
        y = np.clip((1 - pts[..., 1] % 1.0) * h, 0, h - 1).astype(int)
        tri = is_skin(img[y, x]).sum(1) >= 3
        if not tri.any():
            continue
        parts[name.replace(p["texset"], skin_set)] = subset(p, tri, skin_set)
        if (~tri).any():
            parts[name] = subset(p, ~tri, p["texset"])
        else:
            del parts[name]
        print(f"  skin: {name} -> {tri.sum()} of {len(tri)} triangles to {skin_set}")


def split_by_material(m, pos, nrm, bones, weights, prefix, slot):
    parts = {}
    for mi, mat in enumerate(m["materials"]):
        sel = m["mat"] == mi
        if not sel.any() or mat in DROP:
            continue
        f = m["faces"][sel]
        used, remap = np.unique(f, return_inverse=True)
        texset = TEXSET[mat]
        name = f"{prefix}_{texset}"
        parts[name] = dict(pos=pos[used], nrm=nrm[used], uv=m["uv0"][used], faces=remap.reshape(-1, 3),
                           vid=m["vid"][used] + (hash(prefix) % 1000) * 100000, bones=bones[used], weights=weights[used],
                           texset=texset, slot=slot)
    return parts


def fit_race(race):
    prof = PROFILES[race]
    print(race)
    rt = Retarget(race, prof)
    F = rt.F
    parts = {}
    fitted = {}
    for name in ("Body", "Legs", "buckles", "Skirt", "Dress", "Purse", "head", "Hair", "Eyebrows", "EyeL", "EyesR"):
        m = sd.mesh(name)
        default = "head" if name in HEAD_MESHES else None
        pos, nrm = rt.apply(m, default)
        fitted[name] = (m, pos, nrm)
    mh, hpos, hnrm = fitted["head"]
    if prof.get("hair", 1.0) < 1:
        hpos = tuck_ears(hpos)
        fitted["head"] = (mh, hpos, hnrm)
    skull_tris = mh["faces"][mh["mat"] == mh["materials"].index("mina_head.004")]
    m, pos, nrm = fitted["Hair"]
    fitted["Hair"] = (m, slim_hair(pos, hpos, skull_tris, prof.get("hair", 1.0)), nrm)

    # the "Overskirt" option: both skirts hang clear of the arms; the pleated skirt over the legs, then the
    # overskirt over both. The default keeps her wide Deadlock flare.
    draped = {}
    m, pos, nrm = fitted["Skirt"]
    legs = np.vstack([fitted[n][1] for n in ("Legs", "buckles")])
    draped["Skirt"] = (m, *drape(pos, nrm, legs))
    m, pos, nrm = fitted["Dress"]
    mb = fitted["Body"][0]
    boots = fitted["Body"][1][np.unique(mb["faces"][mb["mat"] == mb["materials"].index("mina_lower.004")])]
    under = np.vstack([draped["Skirt"][1], legs, boots[boots[:, 1] < 0.75 * F["j_asi_a_l"][1]]])
    draped["Dress"] = (m, *drape(pos, nrm, under))

    # weights
    W = {}
    for name in ("Body", "Legs", "buckles", "head"):
        m, pos, _ = fitted[name]
        W[name] = own_weights(m, pos, F)
    for name in SKIRT_MESHES:
        m, pos, _ = fitted[name]
        W[name] = skirt_weights(pos, F)
    for name in ("Hair", "Eyebrows", "EyeL", "EyesR"):
        W[name] = single(len(fitted[name][1]), "j_kao")
    m, pos, _ = fitted["Body"]
    upper = m["mat"] == m["materials"].index("mina_upper.004")
    jv = np.unique(m["faces"][upper])
    W["Purse"] = copy_weights(fitted["Purse"][1], pos[jv], W["Body"][0][jv], W["Body"][1][jv])

    slots = {"Body": None, "Legs": "dwn", "buckles": "dwn", "Skirt": "dwn", "Dress": "dwn", "Purse": "top",
             "head": "met", "Hair": "met", "Eyebrows": "met", "EyeL": "met", "EyesR": "met"}
    for name, (m, pos, nrm) in fitted.items():
        B, Wt = W[name]
        parts.update(split_by_material(m, pos, nrm, B, Wt, name.lower(), slots[name]))
    for name, (m, pos, nrm) in draped.items():
        B, Wt = skirt_weights(pos, F)
        parts.update({f"{k}_draped": dict(v, variant="draped")
                      for k, v in split_by_material(m, pos, nrm, B, Wt, name.lower(), "dwn").items()})

    # the "Head size" option's Deadlock-sized head: every player face is hidden with it, so the head no longer
    # has to cover one, and the bob slims all round
    print("  small head")
    rs = Retarget(race, dict(prof, head=prof["small_head"]))
    small = {name: (sd.mesh(name),) for name in HEAD_MESHES}
    small = {name: (m, *rs.apply(m, "head")) for name, (m,) in small.items()}
    m, pos, nrm = small["head"]
    pos = tuck_ears(pos)
    small["head"] = (m, pos, nrm)
    mh = small["head"][0]
    skull_tris = mh["faces"][mh["mat"] == mh["materials"].index("mina_head.004")]
    m, hp, hn = small["Hair"]
    small["Hair"] = (m, slim_hair(hp, pos, skull_tris, prof["small_hair"], protect_ears=False), hn)
    for name, (m, pos, nrm) in small.items():
        B, Wt = own_weights(m, pos, F) if name == "head" else single(len(pos), "j_kao")
        parts.update({f"{k}_small": dict(v, variant="small")
                      for k, v in split_by_material(m, pos, nrm, B, Wt, name.lower(), "met").items()})
    if "purse_bag" in parts:
        rigid_islands(parts["purse_charm"], 0.06)
    split_skin(parts)
    for n, p in sorted(parts.items()):
        print(f"  part {n:14s} {p['texset']:6s} slot {p['slot']}: {len(p['pos']):5d} verts {len(p['faces']):5d} tris, "
              f"y {p['pos'][:, 1].min():.3f}..{p['pos'][:, 1].max():.3f}, bones {len({b for b in p['bones'].ravel() if b})}")
    os.makedirs(os.path.join(ROOT, "work", "fit"), exist_ok=True)
    pickle.dump(dict(parts=parts, joints=F, ankle=rt.ankle, scale=rt.scale),
                open(os.path.join(ROOT, "work", "fit", f"{race}.pkl"), "wb"))
    print("wrote", race)


if __name__ == "__main__":
    for r in (sys.argv[1:] or list(PROFILES)):
        fit_race(r)
