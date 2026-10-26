"""Fit the EoH Jotaro (Part 4) rip onto the FFXIV Hyur Midlander male (c0101) skeleton.

usage: python fit_jotaro.py            -> work/fit.pkl

Every kept rip mesh is moved from Jotaro's T-pose bind into the FFXIV bind pose (game space:
metres, Y up, +Z forward, +X = character's left) and re-weighted to FFXIV bones:
  * limbs, neck and head: one affine transform per bone (rotate onto the FFXIV bone direction,
    stretch to the FFXIV bone length), parents first so the chain stays connected;
  * torso, coat and collar: a height lattice through matching spine/leg joints, with the width
    scaled from the hips to the shoulders;
  * the coat tails' cloth chains are re-weighted to the FFXIV skirt bones so they sway.
"""
import math
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jotaro_dae as jd  # noqa: E402
from xivskel import Skeleton  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAE = os.path.join(ROOT, "source", "Jotaro Kujo (Part 4)", "Jotaro Kujo (Part 4).dae")
OUT = os.path.join(ROOT, "work", "fit.pkl")

# Rip meshes we keep. The eye_*_1 layers point at a texture the rip lacks (the Layer_2 copies carry
# the iris texture on the same geometry); teeth and tongue sit inside a closed mouth.
KEEP = ["body_1", "body_2", "body_3", "body_4", "face_1", "face_2", "face_3", "face_4",
        "eye_l_Layer_2", "eye_r_Layer_2"]

FINGERS = {"0": "oya", "1": "hito", "2": "naka", "3": "kusu", "4": "ko"}

# ------------------------------------------------------------------ bone maps

SKIN_MAP = {"trall": "j_kosi", "_jtr01t0": "j_kosi", "pelvis": "j_kosi", "body": "j_kosi",
            "spine": "j_sebo_a", "spine1": "j_sebo_b", "spine2": "j_sebo_c", "neck": "j_kubi", "head": "j_kao"}
# Retarget deformers: rip bone -> (rip direction child, ffxiv bone, ffxiv direction child, stretch, twist)
# twist = ((rip_a, rip_b), (ff_a, ff_b)): vectors used to fix the roll around the bone.
DEFORMERS = {"neck": ("head", "j_kubi", "j_kao", True, None),
             "head": (None, "j_kao", None, False, None)}
for s in "lr":
    SKIN_MAP.update({
        f"{s}_clavicle": f"j_sako_{s}", f"{s}_upperarm": f"j_ude_a_{s}", f"{s}_forearm": f"j_ude_b_{s}",
        f"{s}_arm_bone06": f"n_hte_{s}", f"{s}_hand": f"j_te_{s}",
        f"{s}_thigh": f"j_asi_a_{s}", f"{s}_calf": f"j_asi_c_{s}", f"{s}_foot": f"j_asi_d_{s}", f"{s}_toe0": f"j_asi_e_{s}"})
    DEFORMERS.update({
        f"{s}_clavicle": (f"{s}_upperarm", f"j_sako_{s}", f"j_ude_a_{s}", True, None),
        f"{s}_upperarm": (f"{s}_forearm", f"j_ude_a_{s}", f"j_ude_b_{s}", True, None),
        f"{s}_forearm": (f"{s}_hand", f"j_ude_b_{s}", f"j_te_{s}", True, None),
        f"{s}_hand": (f"{s}_finger2", f"j_te_{s}", f"j_naka_a_{s}", False,
                      ((f"{s}_finger1", f"{s}_finger4"), (f"j_hito_a_{s}", f"j_ko_a_{s}"))),
        f"{s}_thigh": (f"{s}_calf", f"j_asi_a_{s}", f"j_asi_b_{s}", True, None),
        f"{s}_calf": (f"{s}_foot", f"j_asi_c_{s}", f"j_asi_d_{s}", True, None),
        f"{s}_foot": (f"{s}_toe0", f"j_asi_d_{s}", f"j_asi_e_{s}", False, None),
        f"{s}_toe0": (None, f"j_asi_e_{s}", None, False, None),
    })
    for k, f in FINGERS.items():
        SKIN_MAP[f"{s}_finger{k}"] = f"j_{f}_a_{s}"
        SKIN_MAP[f"{s}_finger{k}1"] = f"j_{f}_b_{s}"
        DEFORMERS[f"{s}_finger{k}"] = (f"{s}_finger{k}1", f"j_{f}_a_{s}", f"j_{f}_b_{s}", False, None)
        DEFORMERS[f"{s}_finger{k}1"] = (None, f"j_{f}_b_{s}", None, False, None)
TORSO_ROOTS = {"trall", "_jtr01t0", "pelvis", "spine", "spine1", "spine2"}
IDENTITY_ROT = {"head"}  # keep the head upright instead of inheriting the neck tilt
CLOTH_CHAINS = [("l_cloth", (1, 2, 3, 4)), ("r_cloth", (1, 2, 3, 4)), ("l_cloth", (5, 6, 7)), ("r_cloth", (5, 6, 7))]
# The open coat's front flaps hang in front of the thighs, so they go on the front skirt bones
# (which swing clear of the legs) rather than the side ones.
SKIRT_ROOTS = {"j_sk_f_a_l": "f_l", "j_sk_f_a_r": "f_r", "j_sk_b_a_l": "b_l", "j_sk_b_a_r": "b_r"}


def nearest(bone, parents, table):
    b = bone
    while b is not None and b not in table:
        b = parents.get(b)
    return b


# ------------------------------------------------------------------ math helpers

def rot_between(a, b):
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if c < -0.999999:
        axis = np.cross(a, [1, 0, 0])
        if np.linalg.norm(axis) < 1e-6:
            axis = np.cross(a, [0, 1, 0])
        return axis_angle(axis, math.pi)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx / (1 + c)


def axis_angle(axis, ang):
    axis = np.asarray(axis, float) / np.linalg.norm(axis)
    x, y, z = axis
    c, s, t = math.cos(ang), math.sin(ang), 1 - math.cos(ang)
    return np.array([[t * x * x + c, t * x * y - s * z, t * x * z + s * y],
                     [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
                     [t * x * z - s * y, t * y * z + s * x, t * z * z + c]])


def affine(lin, src_point, dst_point):
    m = np.eye(4)
    m[:3, :3] = lin
    m[:3, 3] = dst_point - lin @ src_point
    return m


# ------------------------------------------------------------------ main

def main():
    geoms, skins, parents = jd.parse(DAE)
    bind = jd.bind_pose(skins)
    sk = Skeleton()
    F = {n: sk.pos(n) for n in sk.names}

    # rip (cm, Z up, facing -Y) -> game axes (Y up, facing +Z)
    to_game = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)
    H0 = {n: to_game @ m[:3, 3] for n, m in bind.items()}
    left = H0["l_upperarm"] - H0["r_upperarm"]
    fwd = (H0["eyebone02_l"] + H0["eyebone02_r"]) / 2 - H0["head"]
    print(f"left {np.round(left, 2)}  forward {np.round(fwd, 2)}")
    assert left[0] > 0 and fwd[2] > 0, "Jotaro should face +Z with his left on +X"

    def dist(a, b):
        return float(np.linalg.norm(a - b))

    hip = lambda d, l, r: (d[l] + d[r]) / 2  # noqa: E731
    leg_r = (dist(H0["l_thigh"], H0["l_calf"]) + dist(H0["l_calf"], H0["l_foot"]))
    leg_f = (dist(F["j_asi_a_l"], F["j_asi_b_l"]) + dist(F["j_asi_b_l"], F["j_asi_d_l"]))
    torso_r = H0["neck"][1] - hip(H0, "l_thigh", "r_thigh")[1]
    torso_f = F["j_kubi"][1] - hip(F, "j_asi_a_l", "j_asi_a_r")[1]
    arm_r = dist(H0["l_upperarm"], H0["l_forearm"]) + dist(H0["l_forearm"], H0["l_hand"])
    arm_f = dist(F["j_ude_a_l"], F["j_ude_b_l"]) + dist(F["j_ude_b_l"], F["j_te_l"])
    ratios = dict(legs=leg_f / leg_r, torso=torso_f / torso_r, arms=arm_f / arm_r)
    scale = float(np.exp(np.mean(np.log(list(ratios.values())))))
    print("size ratios FFXIV/rip:", {k: round(v, 5) for k, v in ratios.items()}, "-> uniform scale", round(scale, 5))

    G = np.eye(4)
    G[:3, :3] = scale * to_game
    hips_rip = (G @ np.append(hip(bind, "l_thigh", "r_thigh")[:3, 3], 1))[:3]
    G[:3, 3] = hip(F, "j_asi_a_l", "j_asi_a_r") - hips_rip  # hip joints on the FFXIV hip joints
    H = {n: (G @ np.append(m[:3, 3], 1))[:3] for n, m in bind.items()}

    # ---- torso lattice: piecewise-linear by height through matching joints
    knots = [("l_foot", "j_asi_d_l"), ("l_calf", "j_asi_b_l"), ("l_thigh", "j_asi_a_l"), ("spine", "j_sebo_a"),
             ("spine1", "j_sebo_b"), ("spine2", "j_sebo_c"), ("neck", "j_kubi")]
    kh_y = np.array([H[a][1] for a, _ in knots])
    ff_y = np.array([F[b][1] for _, b in knots])
    print("lattice rip y", np.round(kh_y, 3))
    print("lattice ff  y", np.round(ff_y, 3))
    assert np.all(np.diff(kh_y) > 0) and np.all(np.diff(ff_y) > 0)
    dz = np.array([(F[b][2] - H[a][2]) if not a.startswith("l_") else (F[b][2] - H[a][2]) for a, b in knots])
    sx_y = np.array([H["l_thigh"][1], H["l_upperarm"][1]])
    sx_v = np.array([F["j_asi_a_l"][0] / H["l_thigh"][0], F["j_ude_a_l"][0] / H["l_upperarm"][0]])
    print("torso width scale hip/shoulder", np.round(sx_v, 3), " dz", np.round(dz, 3))

    def field(p):
        y = p[:, 1]
        y2 = np.interp(y, kh_y, ff_y)
        lo, hi = y < kh_y[0], y > kh_y[-1]
        y2[lo] = ff_y[0] + (y[lo] - kh_y[0])
        y2[hi] = ff_y[-1] + (y[hi] - kh_y[-1])
        sx = np.interp(y, sx_y, sx_v)
        z2 = p[:, 2] + np.interp(y, kh_y, dz)
        return np.stack([p[:, 0] * sx, y2, z2], 1), sx

    def field_point(p):
        return field(p[None, :])[0][0]

    # ---- per-bone affine transforms, parents first
    M, R_of = {}, {}

    def deformer_parent(b):
        p = parents.get(b)
        while p is not None and p not in DEFORMERS and p not in TORSO_ROOTS:
            p = parents.get(p)
        return p

    def depth(b):
        d, p = 0, b
        while p is not None:
            p, d = parents.get(p), d + 1
        return d

    for b in sorted(DEFORMERS, key=depth):
        kh_child, ff_bone, ff_child, stretch, twist = DEFORMERS[b]
        par = deformer_parent(b)
        anchor = field_point(H[b]) if (par is None or par in TORSO_ROOTS) else (M[par] @ np.append(H[b], 1))[:3]
        if kh_child is None:
            lin = np.eye(3) * 1.0 if b in IDENTITY_ROT else R_of[par]
            R_of[b] = lin
            M[b] = affine(lin, H[b], anchor)
            continue
        d_kh = H[kh_child] - H[b]
        d_ff = (F[ff_child] - anchor) if stretch else (F[ff_child] - F[ff_bone])
        R = rot_between(d_kh, d_ff)
        if twist:
            (ka, kb), (fa, fb) = twist
            u = R @ (H[kb] - H[ka])
            w = F[fb] - F[fa]
            axis = d_ff / np.linalg.norm(d_ff)
            u -= axis * np.dot(u, axis)
            w -= axis * np.dot(w, axis)
            ang = math.atan2(np.dot(np.cross(u, w), axis), np.dot(u, w))
            print(f"  {b}: twist {math.degrees(ang):.1f} deg")
            R = axis_angle(axis, ang) @ R
        lin = R
        if stretch:
            k = np.linalg.norm(d_ff) / np.linalg.norm(d_kh)
            u = d_kh / np.linalg.norm(d_kh)
            lin = R @ (np.eye(3) + (k - 1) * np.outer(u, u))
            print(f"  {b} -> {ff_bone}: stretch {k:.3f}")
        R_of[b] = R
        M[b] = affine(lin, H[b], anchor)

    # ---- coat tails: cloth chain joints below the hips drive the FFXIV skirt bones
    hip_y = F["j_kosi"][1]
    for prefix, idx in CLOTH_CHAINS:
        pts = {i: field_point(H[f"{prefix}{i:02d}"]) for i in idx}
        mid = pts[idx[len(idx) // 2]]
        ang = math.degrees(math.atan2(mid[0], mid[2]))
        best = min(SKIRT_ROOTS, key=lambda r: abs((math.degrees(math.atan2(F[r][0], F[r][2])) - ang + 180) % 360 - 180))
        col = SKIRT_ROOTS[best]
        column = [f"j_sk_{col[0]}_{lvl}_{col[2]}" for lvl in "abc"]
        for i, p in pts.items():
            if p[1] > hip_y + 0.04:
                target = "j_sebo_a"
            else:
                target = min(column, key=lambda c: abs(F[c][1] - p[1]))
            SKIN_MAP[f"{prefix}{i:02d}"] = target
        print(f"  {prefix}{idx}: angle {ang:.0f} -> {best} heights {[round(p[1], 3) for p in pts.values()]}"
              f" -> {[SKIN_MAP[f'{prefix}{i:02d}'] for i in idx]}")

    # ---- deform every kept mesh
    deformer_of, skin_of = {}, {}
    for b in parents:
        d = nearest(b, parents, set(DEFORMERS) | TORSO_ROOTS)
        deformer_of[b] = d if d in DEFORMERS else None
        skin_of[b] = SKIN_MAP[nearest(b, parents, SKIN_MAP)]
    out = []
    for gid, g in geoms.items():
        part = gid.replace("geom-" + jd.PREFIX, "")
        if part not in KEEP:
            continue
        skn = skins[gid]
        P = (G @ np.c_[g["pos"], np.ones(len(g["pos"]))].T).T[:, :3]
        Nrm = (G[:3, :3] @ g["nrm"].T).T
        n = len(P)
        newP = np.zeros_like(P)
        vert_lin = np.zeros((n, 3, 3))
        tp, tsx = field(P)
        ff_w, src_bone = [], []
        for vi, infl in enumerate(skn["weights"]):
            acc = {}
            for b, w in infl:
                d = deformer_of[b]
                if d is None:
                    newP[vi] += w * tp[vi]
                    vert_lin[vi] += w * np.diag([tsx[vi], 1, 1])
                else:
                    newP[vi] += w * (M[d][:3, :3] @ P[vi] + M[d][:3, 3])
                    vert_lin[vi] += w * M[d][:3, :3]
                acc[skin_of[b]] = acc.get(skin_of[b], 0) + w
            tot = sum(w for _, w in infl)
            if tot > 0 and abs(tot - 1) > 1e-4:
                newP[vi] /= tot
                vert_lin[vi] /= tot
            top4 = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
            s = sum(w for _, w in top4) or 1
            ff_w.append([(b, w / s) for b, w in top4 if w / s > 0.001])
            src_bone.append(max(infl, key=lambda bw: bw[1])[0] if infl else "")
        inv_t = np.linalg.inv(vert_lin).transpose(0, 2, 1)
        c_pos = g["c_pos"].ravel()
        c_n = np.einsum("nij,nj->ni", inv_t[c_pos], Nrm[g["c_nrm"].ravel()])
        c_n /= np.linalg.norm(c_n, axis=1, keepdims=True)
        out.append(dict(name=part, gid=gid, pos=newP, c_nrm=c_n.reshape(-1, 3, 3),
                        c_uv=g["uv"][g["c_uv"].ravel()].reshape(-1, 3, 2), tris=g["c_pos"],
                        weights=ff_w, src_bone=src_bone))
        print(f"deformed {part}: {n} verts, {len(g['c_pos'])} tris,"
              f" y {newP[:, 1].min():.3f}..{newP[:, 1].max():.3f}")
    with open(OUT, "wb") as f:
        pickle.dump(dict(meshes=out, ff_joints={n: F[n] for n in F},
                         rip_joints={n: (M[deformer_of[n]] @ np.append(H[n], 1))[:3] if deformer_of.get(n)
                                     else field_point(H[n]) for n in H}), f)
    print("wrote", OUT)


main()
