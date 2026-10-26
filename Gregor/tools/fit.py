"""Fit Gregor's AEDD outfit onto the FFXIV Midlander male (c0101) skeleton, which Viera males also wear
(the game reshapes c0101 gear for them with human.pbd).

Positions: retargeted through Gregor's own rig. Limb bones get one affine each (rotate onto the FFXIV bone,
stretch to its length), parents first; torso bones use a height lattice through the ankles, knees, hips,
shoulders and neck (Gregor's spine bones sit at different anatomical spots from FFXIV's, so they are not used).
Weights are FFXIV-native rather than Gregor's:
  * suit, shoes, leg armour, bolts: copied from the nearest point of the FFXIV naked body, then smoothed;
    small rigid pieces (badge, buttons, laces, bolts, spikes) share one weight
  * coat: copied from the nearest point of the vanilla Wake Doctor's White Coat, so the tails ride the
    skirt (physics) bones the same way the vanilla coat does
  * centipede arms: upper arm, blending into the forearm at the elbow; everything past it follows the forearm
  * glasses, halo: head, placed on the Viera male face
Skin: the FFXIV naked body's own left hand, right arm (human-arm option) and the neck/chest skin the shirt
leaves open, so they take the wearer's skin.

Writes work/fit/fitted.pkl: {part: dict(pos, nrm, uv, faces, vid, bones (N,4), weights (N,4), texset)}
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
from islands import islands  # noqa: E402

ROOT = rig.ROOT
OUT = os.path.join(ROOT, "work", "fit", "fitted.pkl")
BODY = [f"chara/human/c0101/obj/body/b0001/model/c0101b0001_{s}.mdl" for s in ("top", "glv", "dwn", "sho")]
COAT_REF = "chara/equipment/e6148/model/c0101e6148_top.mdl"
VIERA_FACE = "chara/human/c1701/obj/face/f0001/model/c1701f0001_fac.mdl"
SIDES = (("l", "Left", "L"), ("r", "Right", "R"))
RIGID_ISLAND = 0.09     # pieces smaller than this (bbox diagonal, m) move as one
CENTI_FLOOR = 0.03      # the centipede is scaled about the shoulder so a straight-down arm leaves its tip this high
CENTI_BLEND = 0.05      # m either side of the elbow where the centipede blends from upper arm to forearm


# ----------------------------------------------------------------------------- maths helpers

def affine(lin, src_point, dst_point):
    m = np.eye(4)
    m[:3, :3] = lin
    m[:3, 3] = dst_point - lin @ src_point
    return m


def nearest(query, ref, chunk=512):
    ref = ref.astype(np.float32)
    rr = (ref ** 2).sum(1)
    idx = np.empty(len(query), np.int64)
    d2 = np.empty(len(query))
    for i in range(0, len(query), chunk):
        q = query[i:i + chunk].astype(np.float32)
        dd = rr[None, :] - 2 * q @ ref.T
        j = dd.argmin(1)
        idx[i:i + chunk] = j
        d2[i:i + chunk] = dd[np.arange(len(j)), j] + (q ** 2).sum(1)
    return idx, np.sqrt(np.maximum(d2, 0))


def welded(m):
    """(unique position index per split vertex, faces on unique positions, number of unique positions)."""
    ids, inv = np.unique(m["vid"], return_inverse=True)
    return inv, inv[m["faces"]], len(ids)


def edges_of(faces):
    e = np.vstack([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    return np.unique(np.vstack([e, e[:, ::-1]]), axis=0)


def smooth(W, edges, n, iters=10, lam=0.5):
    deg = np.bincount(edges[:, 0], minlength=n).astype(float)
    has = deg > 0
    for _ in range(iters):
        acc = np.zeros_like(W)
        np.add.at(acc, edges[:, 0], W[edges[:, 1]])
        W[has] = (1 - lam) * W[has] + lam * acc[has] / deg[has, None]
    return W


def to_arrays(W, names, k=4):
    """Dense weights (N,B) -> top-k bone names / normalised weights (always k columns)."""
    if W.shape[1] < k:
        W = np.hstack([W, np.zeros((len(W), k - W.shape[1]))])
        names = list(names) + [""] * (k - len(names))
    order = np.argsort(-W, axis=1)[:, :k]
    w = np.take_along_axis(W, order, 1)
    w[w < 1e-3] = 0
    w /= np.maximum(w.sum(1, keepdims=True), 1e-9)
    bones = np.where(w > 0, np.array(names, object)[order], "")
    return bones.astype(object), w


def dense(bones, weights, names):
    idx = {b: i for i, b in enumerate(names)}
    W = np.zeros((len(bones), len(names)))
    for k in range(bones.shape[1]):
        for i, b in enumerate(bones[:, k]):
            if b:
                W[i, idx[b]] += weights[i, k]
    return W


# ----------------------------------------------------------------------------- retarget

class Retarget:
    """Moves points from Gregor's bind pose (game axes) into the FFXIV c0101 bind pose."""

    def __init__(self):
        self.B = sd.bones("Gregor_Rig")
        names, parent, world = rig.load_skeleton()
        F = {n: world[n][:3, 3].copy() for n in names}
        for s, _, _ in SIDES:
            F[f"knee_{s}"] = (F[f"j_asi_b_{s}"] + F[f"j_asi_c_{s}"]) / 2
        self.F = F
        B = self.B
        H0 = {n: b["head"] for n, b in B.items()}

        def dist(a, b):
            return float(np.linalg.norm(a - b))

        leg = (dist(F["j_asi_a_l"], F["knee_l"]) + dist(F["knee_l"], F["j_asi_d_l"])) / \
              (dist(H0["Left leg"], H0["Left knee"]) + dist(H0["Left knee"], H0["Left ankle"]))
        torso = (F["j_kubi"][1] - F["j_asi_a_l"][1]) / (H0["Neck"][1] - H0["Left leg"][1])
        arm = (dist(F["j_ude_a_l"], F["j_ude_b_l"]) + dist(F["j_ude_b_l"], F["j_te_l"])) / \
              (dist(H0["Left arm"], H0["Left elbow"]) + dist(H0["Left elbow"], H0["Left wrist"]))
        self.scale = s = float(np.exp(np.mean(np.log([leg, torso, arm]))))
        print(f"size ratios FFXIV/Gregor: legs {leg:.3f} torso {torso:.3f} arms {arm:.3f} -> scale {s:.3f}")
        hip_g = (H0["Left leg"] + H0["Right leg"]) / 2
        hip_f = (F["j_asi_a_l"] + F["j_asi_a_r"]) / 2
        self.G = np.eye(4)
        self.G[:3, :3] *= s
        self.G[:3, 3] = hip_f - s * hip_g
        H = {n: s * p + self.G[:3, 3] for n, p in H0.items()}
        self.H = H

        knots = [("Left ankle", "j_asi_d_l"), ("Left knee", "knee_l"), ("Left leg", "j_asi_a_l"),
                 ("Left arm", "j_ude_a_l"), ("Neck", "j_kubi")]
        self.ky = np.array([H[a][1] for a, _ in knots])
        self.fy = np.array([F[b][1] for _, b in knots])
        self.dz = np.array([F[b][2] - H[a][2] for a, b in knots])
        assert np.all(np.diff(self.ky) > 0)
        self.sx_y = np.array([H["Left leg"][1], H["Left arm"][1]])
        self.sx_v = np.array([F["j_asi_a_l"][0] / H["Left leg"][0], F["j_ude_a_l"][0] / H["Left arm"][0]])
        print("lattice y", np.round(self.ky, 3), "->", np.round(self.fy, 3), " width", np.round(self.sx_v, 3),
              " dz", np.round(self.dz, 3))

        # per-bone affines for limbs and head: name -> (child, ffxiv bone, ffxiv child, stretch, twist)
        D = {"Neck": ("Head", "j_kubi", "j_kao", True, None), "Head": (None, "j_kao", None, False, None)}
        for s_, S, X in SIDES:
            D.update({
                f"{S} Shoulder": (f"{S} arm", f"j_sako_{s_}", f"j_ude_a_{s_}", True, None),
                f"{S} arm": (f"{S} elbow", f"j_ude_a_{s_}", f"j_ude_b_{s_}", True, None),
                f"{S} elbow": (f"{S} wrist", f"j_ude_b_{s_}", f"j_te_{s_}", True, None),
                f"{S} wrist": (f"MiddleFinger0_{X}", f"j_te_{s_}", f"j_naka_a_{s_}", False,
                               ((f"IndexFinger0_{X}", f"LittleFinger0_{X}"), (f"j_hito_a_{s_}", f"j_ko_a_{s_}"))),
                f"{S} leg": (f"{S} knee", f"j_asi_a_{s_}", f"knee_{s_}", True, None),
                f"{S} knee": (f"{S} ankle", f"knee_{s_}", f"j_asi_d_{s_}", True, None),
                f"{S} ankle": (f"{S} toe", f"j_asi_d_{s_}", f"j_asi_e_{s_}", True, None),
                f"{S} toe": (None, f"j_asi_e_{s_}", None, False, None),
            })
        self.D = D
        torso_roots = {"Hips", "Spine", "Chest"}
        parents = {n: b["parent"] for n, b in B.items()}

        def up(b, table):
            while b is not None and b not in table:
                b = parents.get(b)
            return b

        def depth(b):
            d = 0
            while b is not None:
                b, d = parents.get(b), d + 1
            return d

        M, R_of = {}, {}
        for b in sorted(D, key=depth):
            child, fb, fc, stretch, twist = D[b]
            par = up(parents.get(b), set(D) | torso_roots)
            anchor = self.field_point(H[b]) if (par is None or par in torso_roots) else (M[par] @ np.append(H[b], 1))[:3]
            if child is None:
                lin = np.eye(3) if b == "Head" else R_of[par]
                R_of[b] = lin
                M[b] = affine(lin, H[b], anchor)
                continue
            d_g = H[child] - H[b]
            d_f = (F[fc] - anchor) if stretch else (F[fc] - F[fb])
            R = rig.rot_between(d_g, d_f)
            if twist:
                (ga, gb), (fa, fb2) = twist
                u = R @ (H[gb] - H[ga])
                w = F[fb2] - F[fa]
                axis = d_f / np.linalg.norm(d_f)
                u -= axis * np.dot(u, axis)
                w -= axis * np.dot(w, axis)
                R = rig.axis_angle(axis, math.atan2(np.dot(np.cross(u, w), axis), np.dot(u, w))) @ R
            lin = R
            if stretch:
                k = np.linalg.norm(d_f) / np.linalg.norm(d_g)
                u = d_g / np.linalg.norm(d_g)
                lin = R @ (np.eye(3) + (k - 1) * np.outer(u, u))
            R_of[b] = R
            M[b] = affine(lin, H[b], anchor)
        self.M = M
        self.deformer_of = {}
        for b in B:
            d = up(b, set(D) | torso_roots)
            self.deformer_of[b] = d if d in D else None

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

    def apply(self, pos, nrm, W, group_names):
        """pos/nrm in Gregor's bind pose (game axes); W (N,G) Gregor weights over group_names."""
        P = pos * self.scale + self.G[:3, 3]
        tp, tsx = self.field(P)
        out = np.zeros_like(P)
        lin = np.zeros((len(P), 3, 3))
        tot = np.zeros(len(P))
        for g, name in enumerate(group_names):
            w = W[:, g]
            sel = w > 0
            if not sel.any():
                continue
            d = self.deformer_of.get(name)
            if d is None:
                out[sel] += w[sel, None] * tp[sel]
                lin[sel] += w[sel, None, None] * np.array([np.diag([sx, 1, 1]) for sx in tsx[sel]])
            else:
                m = self.M[d]
                out[sel] += w[sel, None] * (P[sel] @ m[:3, :3].T + m[:3, 3])
                lin[sel] += w[sel, None, None] * m[:3, :3]
            tot[sel] += w[sel]
        none = tot < 1e-6
        out[none], tot[none] = tp[none], 1
        lin[none] = np.eye(3)
        out /= tot[:, None]
        lin /= tot[:, None, None]
        n = np.einsum("nij,nj->ni", np.linalg.inv(lin).transpose(0, 2, 1), nrm)
        return out, n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)


# ----------------------------------------------------------------------------- FFXIV reference surfaces

def surface_samples(paths, n_sub=4):
    """Points on vanilla meshes (bind pose) with interpolated dense weights and normals."""
    meshes = [me for p in paths for me in xd.model(p)["meshes"]]
    names = sorted({b for me in meshes for row in me["bones"] for b in row if b})
    bary = np.array([(i, j, n_sub - i - j) for i in range(n_sub + 1) for j in range(n_sub + 1 - i)], float) / n_sub
    pts, wts, nrm = [], [], []
    for me in meshes:
        W = dense(me["bones"], me["weights"], names)
        f = me["faces"]
        pts.append(np.einsum("sk,fkd->fsd", bary, me["pos"][f]).reshape(-1, 3))
        nrm.append(np.einsum("sk,fkd->fsd", bary, me["nrm"][f]).reshape(-1, 3))
        wts.append(np.einsum("sk,fkb->fsb", bary, W[f]).reshape(-1, len(names)))
    n = np.vstack(nrm)
    return np.vstack(pts), np.vstack(wts), n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9), names


def transfer(part, ref, rigid=True, iters=10):
    """Weights for a fitted part from the nearest reference point, smoothed over the welded mesh."""
    pts, wts, _, names = ref
    inv, uf, n = welded(part)
    upos = np.zeros((n, 3))
    upos[inv] = part["pos"]
    idx, dist = nearest(upos, pts)
    W = smooth(wts[idx].copy(), edges_of(uf), n, iters=iters)
    if rigid:
        from islands import components
        comp = components(uf, n)
        for c in np.unique(comp):
            sel = comp == c
            if np.linalg.norm(upos[sel].max(0) - upos[sel].min(0)) < RIGID_ISLAND:
                W[sel] = W[sel].mean(0)
    bones, weights = to_arrays(W, names)
    part["bones"], part["weights"] = bones[inv], weights[inv]
    return dist.max()


def single(part, bone):
    n = len(part["pos"])
    part["bones"] = np.array([[bone, "", "", ""]] * n, object)
    part["weights"] = np.tile([1.0, 0, 0, 0], (n, 1))


# ----------------------------------------------------------------------------- source parts

def take(m, tri, texset, rt=None, pos=None, nrm=None):
    """Sub-mesh of a source mesh, moved into FFXIV space by the retarget (or given positions)."""
    s = sd.submesh(m, tri)
    if pos is None:
        pos, nrm = rt.apply(s["pos"], s["nrm"], s["groups"], m["group_names"])
    return dict(pos=pos, nrm=nrm, uv=s["uv0"], faces=s["faces"], vid=s["vid"], texset=texset,
                src_groups=s["groups"], keys=s["keys"], src_idx=s["idx"])


def split_parts(rt):
    m = sd.mesh("LCB Gregor")
    moved = {k: np.linalg.norm(d, axis=1) > 1e-4 for k, d in m["keys"].items()}
    tri_moved = {k: v[m["faces"]].any(1) for k, v in moved.items()}
    mat = {n: m["mat"] == i for i, n in enumerate(m["materials"])}
    gi = {n: i for i, n in enumerate(m["group_names"])}

    def dom(tris, names):
        """Fraction of a triangle set's vertex weight on the given Gregor bones."""
        vs = np.unique(m["faces"][tris])
        g = m["groups"][vs]
        return g[:, [gi[n] for n in names if n in gi]].sum() / max(g.sum(), 1e-9)

    parts = {}
    # --- suit material: shirt / vest / pants mesh, tie, collar, badge, ring, belt bits, right shoe; glasses
    main = mat["LCB Gregor main"] & ~tri_moved["Cig_hide"]
    glasses = (main & tri_moved["Glasses_off"]) | mat["Glasses Transparent"]
    main &= ~tri_moved["Glasses_off"]
    feet = ["Right ankle", "Right toe", "Left ankle", "Left toe"]
    shoe, suit_bits = [], []
    for t in islands(m, main):
        (shoe if dom(t, feet) > 0.5 else suit_bits).append(t)
    shoe = np.concatenate(shoe)
    suit_bits = sorted(suit_bits, key=len, reverse=True)
    parts["suit"] = take(m, suit_bits[0], "suit", rt)
    parts["suit_bits"] = take(m, np.concatenate(suit_bits[1:]), "suit", rt)
    parts["shoe_r"] = take(m, shoe, "suit", rt)
    parts["glasses_frame"] = take(m, glasses & mat["LCB Gregor main"], "suit", rt)
    parts["glasses_lens"] = take(m, glasses & mat["Glasses Transparent"], "lens", rt)

    # --- AEDD material: coat (+ right cuff, buttons), bolts, halo, left leg armour + shoe. The face mask stays hidden.
    aedd = mat["AEDD Gregor"] & ~tri_moved["AEDD_Mask_Hide"]
    legs = ["Left knee", "Left ankle", "Left toe"]
    coat, bolts, halo, leg = [], [], [], []
    for t in islands(m, aedd):
        vs = np.unique(m["faces"][t])
        y = m["pos"][vs, 1]
        if dom(t, legs) > 0.5:
            leg.append(t)
        elif dom(t, ["Head"]) > 0.5 and y.min() > 1.48:
            halo.append(t)
        elif len(t) > 1000 or dom(t, ["Twist4Elbow.R", "SideHip.R", "Leg Skirt.R"]) > 0.4:
            coat.append(t)
        else:
            bolts.append(t)
    coat = np.concatenate(coat)
    parts["coat"] = take(m, coat, "aedd", rt)
    s = sd.submesh(m, coat)
    pos, nrm = rt.apply(s["pos"] + s["keys"]["AEDD"], s["nrm"], s["groups"], m["group_names"])
    parts["coat_left_rolled"] = take(m, coat, "aedd", pos=pos, nrm=nrm)  # sleeve shape for the left centipede
    parts["bolts"] = take(m, np.concatenate(bolts), "aedd", rt)
    parts["halo"] = take(m, np.concatenate(halo), "aedd", rt)
    parts["leg_armor"] = take(m, np.concatenate(leg), "aedd", rt)
    for n, p in parts.items():
        print(f"  part {n}: {len(p['pos'])} verts, {len(p['faces'])} tris, y {p['pos'][:, 1].min():.3f}..{p['pos'][:, 1].max():.3f}")
    return parts


# ----------------------------------------------------------------------------- centipede arms

def centipede(rt, side):
    """The AEDD centipede arm for one side. Gregor's own rig drives it with constraints that aim it at a target
    on his wrist, so it always extends the arm's line; here it rides the upper arm and then the forearm."""
    s, S, _ = next(x for x in SIDES if x[0] == side)
    m = sd.mesh("AEDD MEsh Right" if side == "r" else "AEDD Mesh Left")
    H0 = {n: b["head"] for n, b in rt.B.items()}
    sh, el, wr = H0[f"{S} arm"], H0[f"{S} elbow"], H0[f"{S} wrist"]
    axis = (wr - sh) / np.linalg.norm(wr - sh)
    d = (m["pos"] - sh) @ axis
    d_el = (el - sh) @ axis
    names = [f"{S} Shoulder", f"{S} arm", f"{S} elbow"]
    G = np.zeros((len(d), 3))
    t = np.clip((d - (d_el - CENTI_BLEND)) / (2 * CENTI_BLEND), 0, 1)
    base = np.clip(-d / 0.04, 0, 1)              # inside the shoulder: follow the collarbone
    G[:, 0] = base
    G[:, 1] = (1 - base) * (1 - t)
    G[:, 2] = (1 - base) * t
    pos, nrm = rt.apply(m["pos"], m["nrm"], G, names)

    F = rt.F
    fsh, fel, fwr = F[f"j_ude_a_{s}"], F[f"j_ude_b_{s}"], F[f"j_te_{s}"]
    # Full size it reaches ~1.9 m from a shoulder 1.44 m up, so any lowered arm would sink it into the floor.
    reach = np.linalg.norm(pos - fsh, axis=1).max()
    k = (fsh[1] - CENTI_FLOOR) / reach
    pos = fsh + (pos - fsh) * k
    print(f"  centipede {side}: scaled {k:.2f} so it just clears the floor")
    fax = (fwr - fsh) / np.linalg.norm(fwr - fsh)
    fd = (pos - fsh) @ fax
    fd_el = (fel - fsh) @ fax
    t = np.clip((fd - (fd_el - CENTI_BLEND)) / (2 * CENTI_BLEND), 0, 1)
    base = np.clip(-fd / 0.04, 0, 1)
    W = np.stack([base * 0.5, (1 - base) * (1 - t) + base * 0.5, (1 - base) * t], 1)
    bones, weights = to_arrays(W, [f"j_sako_{s}", f"j_ude_a_{s}", f"j_ude_b_{s}"])
    reach = np.linalg.norm(pos - fsh, axis=1).max()
    print(f"  centipede {side}: {len(pos)} verts, reach {reach:.2f} m from the shoulder (shoulder height {fsh[1]:.2f} m)")
    return dict(pos=pos, nrm=nrm, uv=m["uv0"], faces=m["faces"], vid=m["vid"], texset="centi", bones=bones,
                weights=weights)


# ----------------------------------------------------------------------------- head pieces

def eye_fronts(pos, sel_l, sel_r):
    out = []
    for sel in (sel_l, sel_r):
        p = pos[sel]
        out.append(p[p[:, 2] > p[:, 2].max() - 0.003].mean(0))
    return np.array(out)


def place_on_viera_face(rt, parts):
    """Glasses and halo: scale/move them from Gregor's eyes onto the Viera male (face 1) eyes, in c0101 space."""
    m = sd.mesh("LCB Gregor")
    gi = {n: i for i, n in enumerate(m["group_names"])}
    eyes_g = eye_fronts(m["pos"], m["groups"][:, gi["Eye.L"]] > 0.5, m["groups"][:, gi["Eye.R"]] > 0.5)
    face = xd.model(VIERA_FACE)
    iris = next(me for me in face["meshes"] if "_iri_" in me["material"])
    eyes_v = eye_fronts(iris["pos"], iris["pos"][:, 0] > 0, iris["pos"][:, 0] < 0)
    kao = pbd.chain(pbd.read(), 101, 1701)["j_kao"]
    eyes_v = (np.c_[eyes_v, np.ones(2)] @ np.linalg.inv(kao).T)[:, :3]        # into c0101 space
    k = np.linalg.norm(eyes_v[0] - eyes_v[1]) / np.linalg.norm(eyes_g[0] - eyes_g[1])
    cg, cv = eyes_g.mean(0), eyes_v.mean(0)
    print(f"  eyes: Gregor {np.round(eyes_g, 3).tolist()} -> Viera {np.round(eyes_v, 3).tolist()}, scale {k:.3f}")
    for name in ("glasses_frame", "glasses_lens", "halo"):
        p = parts[name]
        p["pos"] = cv + k * (p["src_pos"] - cg)   # from Gregor's own (unretargeted) head
        p["nrm"] = p["src_nrm"]
        single(p, "j_kao")


# ----------------------------------------------------------------------------- skin from the FFXIV body

def body_part(path, tri_mask=None):
    me = xd.model(path)["meshes"][0]
    f = me["faces"] if tri_mask is None else me["faces"][tri_mask(me)]
    used, remap = np.unique(f, return_inverse=True)
    order = np.argsort(-me["weights"][used], axis=1)[:, :4]
    w = np.take_along_axis(me["weights"][used], order, 1)
    b = np.take_along_axis(me["bones"][used], order, 1)
    w /= w.sum(1, keepdims=True)
    return dict(pos=me["pos"][used], nrm=me["nrm"][used], uv=me["uv"][used], faces=remap.reshape(-1, 3),
                vid=used, texset="skin", bones=b, weights=w, col=me["col"].reshape(-1, 4)[used])


def along(p, a, b):
    ax = (b - a) / np.linalg.norm(b - a)
    return (p - a) @ ax


def hand_and_arm_skin(rt, coat, side, from_bone):
    """Naked-body skin for one arm from `from_bone` (j_ude_a: whole arm below the sleeve, j_ude_b: forearm + hand),
    starting 3 cm inside the sleeve opening of `coat`."""
    F = rt.F
    s = side
    sx = 1 if s == "l" else -1
    a = F[f"j_ude_a_{s}"] if from_bone == "j_ude_a" else F[f"j_ude_b_{s}"]
    b = F[f"j_te_{s}"]
    sleeve = coat["pos"][(coat["pos"][:, 0] * sx > 0.25)]
    cuff = along(sleeve, a, b).max() if from_bone == "j_ude_b" else None
    if from_bone == "j_ude_a":
        # the rolled right sleeve: its lowest point along the upper arm
        ua = sleeve[along(sleeve, F[f"j_ude_a_{s}"], F[f"j_ude_b_{s}"]) > 0]
        cuff = along(ua, a, b).max()

    def mask(me):
        c = me["pos"][me["faces"]].mean(1)
        return (c[:, 0] * sx > 0.1) & (along(c, a, b) > cuff - 0.03)

    parts = [body_part(BODY[1], mask)]
    if from_bone == "j_ude_a":
        parts.append(body_part(BODY[0], mask))
    out = parts[0]
    for p in parts[1:]:
        out = dict(pos=np.vstack([out["pos"], p["pos"]]), nrm=np.vstack([out["nrm"], p["nrm"]]),
                   uv=np.vstack([out["uv"], p["uv"]]), faces=np.vstack([out["faces"], p["faces"] + len(out["pos"])]),
                   vid=np.concatenate([out["vid"], p["vid"] + 100000]), texset="skin", col=np.vstack([out["col"], p["col"]]),
                   bones=np.vstack([out["bones"], p["bones"]]), weights=np.vstack([out["weights"], p["weights"]]))
    print(f"  skin {s} from {from_bone}: sleeve ends {cuff:.3f} m along the arm, {len(out['faces'])} tris")
    return out


def ray_hits(orig, dirs, tris, max_t):
    """For each ray, whether it hits any triangle within max_t (Moller-Trumbore, vectorised in chunks)."""
    hit = np.zeros(len(orig), bool)
    v0, e1, e2 = tris[:, 0], tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0]
    for i in range(0, len(tris), 4000):
        a0, a1, a2 = v0[i:i + 4000], e1[i:i + 4000], e2[i:i + 4000]
        for j in range(0, len(orig), 256):
            o, d = orig[j:j + 256, None], dirs[j:j + 256, None]
            p = np.cross(d, a2[None])
            det = np.einsum("rtk,tk->rt", p, a1)
            ok = np.abs(det) > 1e-12
            inv = np.where(ok, 1 / np.where(ok, det, 1), 0)
            tv = o - a0[None]
            u = np.einsum("rtk,rtk->rt", tv, p) * inv
            q = np.cross(tv, a1[None])
            v = np.einsum("rk,rtk->rt", d[:, 0], q) * inv
            t = np.einsum("rtk,tk->rt", q, a2) * inv
            h = ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > -0.002) & (t < max_t)
            hit[j:j + 256] |= h.any(1)
    return hit


def neck_skin(garments):
    """Body-top skin triangles the clothes leave visible (neck, open collar), plus one ring of overlap."""
    me = xd.model(BODY[0])["meshes"][0]
    tris = np.vstack([g["pos"][g["faces"]] for g in garments])
    cand = (me["pos"][:, 1] > 1.36) & (np.abs(me["pos"][:, 0]) < 0.11)   # neck and open collar only
    vis = np.zeros(len(me["pos"]), bool)
    idx = np.nonzero(cand)[0]
    covered = ray_hits(me["pos"][idx] + me["nrm"][idx] * 0.001, me["nrm"][idx], tris, 0.08)
    vis[idx[~covered]] = True
    tri_vis = vis[me["faces"]].any(1)
    grow = np.zeros(len(me["pos"]), bool)
    grow[me["faces"][tri_vis].ravel()] = True
    keep = grow[me["faces"]].any(1) & cand[me["faces"]].all(1)
    print(f"  neck skin: {vis.sum()} visible body vertices, {keep.sum()} tris kept")
    return body_part(BODY[0], lambda m_: keep)


# ----------------------------------------------------------------------------- main

def main():
    rt = Retarget()
    parts = split_parts(rt)
    # the head pieces are placed from Gregor's own (unretargeted) positions
    m = sd.mesh("LCB Gregor")
    for name in ("glasses_frame", "glasses_lens", "halo"):
        p = parts[name]
        p["src_pos"], p["src_nrm"] = m["pos"][p["src_idx"]], m["nrm"][p["src_idx"]]
    place_on_viera_face(rt, parts)

    print("weights")
    body = surface_samples(BODY)
    coat_ref = surface_samples([COAT_REF])
    for name in ("suit", "suit_bits", "shoe_r", "bolts", "leg_armor"):
        d = transfer(parts[name], body)
        print(f"  {name}: from the naked body (farthest point {d:.3f} m)")
    for name in ("coat", "coat_left_rolled"):
        d = transfer(parts[name], coat_ref, rigid=False)
        print(f"  {name}: from the vanilla coat (farthest point {d:.3f} m)")
    parts["centi_r"] = centipede(rt, "r")
    parts["centi_l"] = centipede(rt, "l")

    print("skin")
    parts["skin_hand_l"] = hand_and_arm_skin(rt, parts["coat"], "l", "j_ude_b")
    parts["skin_arm_r"] = hand_and_arm_skin(rt, parts["coat"], "r", "j_ude_a")
    parts["skin_neck"] = neck_skin([parts[n] for n in ("suit", "suit_bits", "coat", "bolts")])

    for p in parts.values():
        for k in ("src_pos", "src_nrm", "src_groups", "keys", "src_idx"):
            p.pop(k, None)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    pickle.dump(dict(parts=parts, joints=rt.F), open(OUT, "wb"))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
