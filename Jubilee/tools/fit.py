"""Fit Jubilee (Marvel Rivals, Vampy Jammies; Unreal-style skeleton) onto an FFXIV race skeleton.

Positions are retargeted through her own skeleton (bind pose from the glTF's inverse bind matrices):
  * one uniform scale (geometric mean of the leg, torso and arm length ratios), hips on the FFXIV hips
  * torso: a height lattice through her ankles, knees, hips, shoulders and neck, scaled in width
  * limbs: one affine per bone, parents first, rotated onto the FFXIV bone and stretched to its length
  * hands: rigid, twisted so the knuckles line up with the FFXIV fingers
  * slippers: rigid, turned so the toes point the FFXIV foot's way, sole on the floor under the FFXIV ankle
  * head: rigid, scaled by `head`, eyes on the FFXIV face's eyes; the neck stretches to meet it
Every helper bone (twist, volume, cloth, hair, face, ornament ...) moves with its nearest core ancestor.

Weights are hers, renamed onto FFXIV bones: helpers go to their core ancestor's FFXIV bone, the pelvis and spine
are spread over the FFXIV spine by height, the chest volume bones become the breast bones, and the arm weight is
shared with the FFXIV twist helpers (n_hkata, n_hhiji, n_hte) the way the vanilla body shares it. Everything on
her head (face, hair, hat, eyes) ends up rigid on j_kao.

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
SIDES = ("l", "r")
# Per race: head scale (on top of the body scale), slipper scale, and how far her eyes sit in front of (eye_dz) and
# above (eye_dy) the FFXIV eyes, or her skull centre from theirs (align="centre", for the Lalafell's big head).
# Checked with tools/poke.py: the wearer's own face should stay inside her head.
PROFILES = {
    "c0201": dict(head=1.08, foot=1.0, eye_dz=0.004),
    "c0101": dict(head=1.15, foot=1.05, eye_dz=0.004),
    "c1101": dict(head=2.25, foot=1.0, eye_dz=0.018, eye_dy=0.012, align="centre"),
}
# source mesh -> (texture set, slot or None to split by skin weight, may the split put pieces on the head)
MESHES = {
    "Body": ("skin", None, False),
    "Head": ("face", "met", True),
    "Equip_01": ("pink", None, True),
    "Equip_04": ("pink", None, True),
    "Equip_02": ("fluff", None, True),
    "Equip_03": ("fluff", None, True),
    "Hair_01": ("hair", "met", True),
    "Hair_02": ("cards", None, True),
    "Sprinkles": ("cards", None, True),
    "Eyes_01": ("eyes", "met", True),
}
# not ported: the rim-light shell, the translucent fake eye shadow; inside Eyes_01 only the eyeballs are kept
# (teeth and tongue: her mouth is closed and the face is static)
EYEBALLS = ("L_Eyeball_A_jnt", "R_Eyeball_A_jnt")
# Hair_02 also carries the outfit's candy sprinkles: tiny cards floating round her, cut from the small dashes in its
# opacity mask. They become their own part so pack.py can offer the outfit without them.
SPRINKLE_MAX_VERTS = 8

# core bones of her skeleton -> retarget segment; every other bone uses its nearest core ancestor's
CORE = {"head": "head", "neck_01": "neck", "neck_02": "neck"}
for _s in SIDES:
    CORE.update({f"clavicle_{_s}": f"shoulder_{_s}", f"upperarm_{_s}": f"upper_arm_{_s}",
                 f"lowerarm_{_s}": f"forearm_{_s}", f"hand_{_s}": f"hand_{_s}", f"thigh_{_s}": f"thigh_{_s}",
                 f"calf_{_s}": f"shin_{_s}", f"foot_{_s}": f"foot_{_s}"})
FINGERS = {"thumb": "oya", "index": "hito", "middle": "naka", "ring": "kusu", "pinky": "ko"}


# ----------------------------------------------------------------------------- bone maps

def core_of(bone, B):
    b = bone
    while b is not None and b not in CORE and b not in ("pelvis", "root"):
        b = B[b]["parent"]
    return b if b in CORE else None


def segment_of(bone, B):
    """Her bone -> the retarget segment that moves it (None: the torso lattice)."""
    c = core_of(bone, B)
    return CORE[c] if c else None


def ffxiv_bone(bone, B):
    """Her bone -> FFXIV bone; "torso" for the pelvis, spine and their helpers (spread by height)."""
    if bone in ("L_Chest_vol_A01", "L_Chest_vol_A02"):
        return "j_mune_l"
    if bone in ("R_Chest_vol_A01", "R_Chest_vol_A02"):
        return "j_mune_r"
    parts = bone.split("_")
    if parts[0] in FINGERS and parts[-1] in SIDES:
        if parts[1] == "metacarpal":
            return f"j_te_{parts[-1]}"
        return f"j_{FINGERS[parts[0]]}_{'a' if parts[1] == '01' else 'b'}_{parts[-1]}"
    b = bone
    while b is not None and b not in CORE and b not in ("pelvis", "root"):
        if b in ("ball_l", "ball_r"):
            return f"j_asi_e_{b[-1]}"
        b = B[b]["parent"]
    if b not in CORE:
        return "torso"
    if b == "head":
        return "j_kao"
    if b.startswith("neck"):
        return "j_kubi"
    return {"clavicle": "j_sako", "upperarm": "j_ude_a", "lowerarm": "j_ude_b", "hand": "j_te", "thigh": "j_asi_a",
            "calf": "j_asi_c", "foot": "j_asi_d"}[b[:-2]] + b[-2:]


# ----------------------------------------------------------------------------- retarget

def affine(lin, src_point, dst_point):
    m = np.eye(4)
    m[:3, :3] = lin
    m[:3, 3] = dst_point - lin @ src_point
    return m


class Retarget:
    """Moves points from Jubilee's bind pose into an FFXIV race's bind pose."""

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
        print(f"  size ratios FFXIV/Jubilee: legs {leg:.3f} torso {torso:.3f} arms {arm:.3f} -> scale {s:.3f}")
        hip_m = (H0["thigh_l"] + H0["thigh_r"]) / 2
        hip_f = (F["j_asi_a_l"] + F["j_asi_a_r"]) / 2
        self.t = hip_f - s * hip_m
        H = {n: s * p + self.t for n, p in H0.items()}
        self.H = H
        floor = self.t[1]

        # slippers: uniform scale about her ankle, sole on the floor, under the FFXIV ankle
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
        print(f"  eyes: Jubilee {np.round(eyes_m, 3)} -> FFXIV {np.round(eyes_f, 3)}; head base "
              f"{np.round(H['head'], 3)} -> {np.round(head_base, 3)} (j_kao {np.round(F['j_kao'], 3)})")

        # segment -> (bone, child bone or None, FFXIV start, FFXIV target, kind, twist)
        D = {"neck": ("neck_01", "head", F["j_kubi"], head_base, "stretch", None),
             "head": ("head", None, head_base, head_base, "head", None)}
        for sd_ in SIDES:
            D.update({
                f"shoulder_{sd_}": (f"clavicle_{sd_}", f"upperarm_{sd_}", F[f"j_sako_{sd_}"], F[f"j_ude_a_{sd_}"], "stretch", None),
                f"upper_arm_{sd_}": (f"upperarm_{sd_}", f"lowerarm_{sd_}", F[f"j_ude_a_{sd_}"], F[f"j_ude_b_{sd_}"], "stretch", None),
                f"forearm_{sd_}": (f"lowerarm_{sd_}", f"hand_{sd_}", F[f"j_ude_b_{sd_}"], F[f"j_te_{sd_}"], "stretch", None),
                f"hand_{sd_}": (f"hand_{sd_}", f"middle_01_{sd_}", F[f"j_te_{sd_}"], F[f"j_naka_a_{sd_}"], "rigid",
                                ((f"index_01_{sd_}", f"pinky_01_{sd_}"), (F[f"j_hito_a_{sd_}"], F[f"j_ko_a_{sd_}"]))),
                f"thigh_{sd_}": (f"thigh_{sd_}", f"calf_{sd_}", F[f"j_asi_a_{sd_}"], F[f"knee_{sd_}"], "stretch", None),
                f"shin_{sd_}": (f"calf_{sd_}", f"foot_{sd_}", F[f"knee_{sd_}"], A[sd_], "stretch", None),
                f"foot_{sd_}": (f"foot_{sd_}", f"ball_{sd_}", A[sd_], A[sd_], "place",
                                F[f"j_asi_e_{sd_}"] - F[f"j_asi_d_{sd_}"]),
            })
        parent_seg = {"head": "neck", "neck": None}
        for sd_ in SIDES:
            parent_seg.update({f"shoulder_{sd_}": None, f"upper_arm_{sd_}": f"shoulder_{sd_}",
                               f"forearm_{sd_}": f"upper_arm_{sd_}", f"hand_{sd_}": f"forearm_{sd_}",
                               f"thigh_{sd_}": None, f"shin_{sd_}": f"thigh_{sd_}", f"foot_{sd_}": f"shin_{sd_}"})
        order = ["neck", "head"] + [f"{seg}_{sd_}" for sd_ in SIDES for seg in
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
                # turn about the vertical so her toes point along the FFXIV foot, then scale about the ankle
                d_s = H[child] - H[b]
                ang = math.atan2(twist[0], twist[2]) - math.atan2(d_s[0], d_s[2])
                M[seg] = affine(rig.axis_angle([0, 1, 0], ang) * kf, H[b], f1)
                if seg.endswith("l"):
                    print(f"  {seg:12s} turned {math.degrees(ang):5.1f} deg about the vertical")
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
            if seg.endswith("l") or seg == "neck":
                print(f"  {seg:12s} turned {ang:5.1f} deg" + (f", stretched x{np.linalg.norm(d_f) / np.linalg.norm(d_s):.2f}"
                                                          if kind == "stretch" else ""))
        self.M = M

    def her_eyes(self):
        m = sd.mesh("Eyes_01")
        p = m["pos"][eyeball_mask(m)]
        return np.array([0.0, *((p.min(0) + p.max(0)) / 2)[1:]])

    def her_skull_centre(self):
        p = sd.mesh("Head")["pos"]
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
        """Mesh m (her bind pose) -> FFXIV positions and normals, blending each bone's segment by skin weight."""
        P = m["pos"] * self.scale + self.t
        tp, tsx = self.field(P)
        out = np.zeros_like(P)
        lin = np.zeros((len(P), 3, 3))
        tot = np.zeros(len(P))
        seg_cache = {}
        for k in range(m["joints"].shape[1]):
            for b in np.unique(m["joints"][:, k]):
                if not b:
                    continue
                sel = (m["joints"][:, k] == b) & (m["weights"][:, k] > 0)
                if not sel.any():
                    continue
                if b not in seg_cache:
                    seg_cache[b] = segment_of(b, self.B)
                sg = seg_cache[b]
                w = m["weights"][sel, k]
                if sg is None:
                    out[sel] += w[:, None] * tp[sel]
                    lin[sel] += w[:, None, None] * np.array([np.diag([sx, 1, 1]) for sx in tsx[sel]])
                else:
                    mm = self.M[sg]
                    out[sel] += w[:, None] * (P[sel] @ mm[:3, :3].T + mm[:3, 3])
                    lin[sel] += w[:, None, None] * mm[:3, :3]
                tot[sel] += w
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


def own_weights(m, pos, F, B):
    """Her weights renamed onto FFXIV bones, torso spread by height, arm weight shared with the twist helpers."""
    chain = [(F["j_kubi"][1] - 0.02, "j_kubi"), (F["j_sebo_c"][1], "j_sebo_c"), (F["j_sebo_b"][1], "j_sebo_b"),
             (F["j_sebo_a"][1], "j_sebo_a"), (F["j_asi_a_l"][1], "j_kosi")]
    hs = np.array([h for h, _ in chain])
    names = {}
    out = []
    for i in range(len(pos)):
        d = {}
        torso = 0.0
        for b, w in zip(m["joints"][i], m["weights"][i]):
            if not b or w <= 0:
                continue
            if b not in names:
                names[b] = ffxiv_bone(b, B)
            n = names[b]
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


# ----------------------------------------------------------------------------- parts

def eyeball_mask(m):
    return np.array([any(j in EYEBALLS for j in row if j) for row in m["joints"]])


def sprinkle_mask(m):
    """Hair_02 vertices on a sprinkle: a small card cut from a dash row of the mask, or any small card below the head."""
    ids, inv = np.unique(m["vid"], return_inverse=True)
    comp = components(inv[m["faces"]], len(ids))[inv]
    out = np.zeros(len(m["pos"]), bool)
    for c in np.unique(comp):
        sel = comp == c
        u, v = m["uv"][sel].mean(0)
        dash = u > 0.45 and (0.36 < v < 0.46 or 0.83 < v < 0.97)
        if sel.sum() <= SPRINKLE_MAX_VERTS and (dash or m["pos"][sel, 1].mean() < 1.40):
            out |= sel
    return out


def source(name):
    """Source mesh with the triangles this port keeps, and the UVs its texture set uses."""
    m = sd.mesh("Hair_02" if name == "Sprinkles" else name)
    if name in ("Hair_02", "Sprinkles"):
        sp = sprinkle_mask(m)[m["faces"]].all(1)
        m = sd.submesh(m, sp if name == "Sprinkles" else ~sp)
    if name == "Eyes_01":
        keep = eyeball_mask(m)[m["faces"]].all(1)
        m = sd.submesh(m, keep)
    if name == "Hair_01":
        m["uv"] = m["uv1"].copy()          # its colour lives in the shadow-colour map on the second UV set
    m["uv"] = m["uv"].copy()
    if name in ("Body", "Head"):
        m["uv"][:, 0] -= np.floor(m["uv"][:, 0].min())    # UDIM tiles 1 and 2 -> 0..1
    return m


def fit_race(race):
    prof = PROFILES[race]
    print(race)
    rt = Retarget(race, prof)
    F = rt.F
    parts = {}
    for name, (texset, slot, head_ok) in MESHES.items():
        m = source(name)
        pos, nrm = rt.apply(m)
        Bn, Wt = own_weights(m, pos, F, rt.B)
        parts[name.lower()] = dict(pos=pos, nrm=nrm, uv=m["uv"], faces=m["faces"],
                                   vid=m["vid"] + (abs(hash(name)) % 1000) * 100000, bones=Bn, weights=Wt,
                                   texset=texset, slot=slot, head_ok=head_ok)
    for n, p in sorted(parts.items()):
        print(f"  part {n:10s} {p['texset']:6s} slot {p['slot']}: {len(p['pos']):6d} verts {len(p['faces']):6d} tris, "
              f"y {p['pos'][:, 1].min():.3f}..{p['pos'][:, 1].max():.3f}, bones {len({b for b in p['bones'].ravel() if b})}")
    os.makedirs(os.path.join(ROOT, "work", "fit"), exist_ok=True)
    pickle.dump(dict(parts=parts, joints=F, ankle=rt.ankle, scale=rt.scale),
                open(os.path.join(ROOT, "work", "fit", f"{race}.pkl"), "wb"))
    print("wrote", race)


if __name__ == "__main__":
    for r in (sys.argv[1:] or list(PROFILES)):
        fit_race(r)
