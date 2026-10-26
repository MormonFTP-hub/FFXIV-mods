"""Fit the Lich King onto the FFXIV Hyur Midlander male (c0101) skeleton.

Positions are retargeted through his own WoW rig, using his skin weights:
  * limbs, hands, fingers, feet and head: one affine per bone, which turns the bone onto the matching FFXIV
    bone and stretches it to that bone's length. Across the bone the armour keeps a fixed size (THICK).
  * torso, pelvis and cape bones: a height lattice through the ankles, knees, hips, shoulders, neck and head.
    His torso is broader than an FFXIV body, so it is narrowed until his shoulder and hip joints land on FFXIV's.
  * pauldrons ride the collarbone affine, centred on the FFXIV shoulder joint, so they keep their full size.
Weights are his own, renamed to FFXIV bones (MAP), except:
  * spine: redistributed over j_sebo_a/b/c by height, so the chest bends like an FFXIV body
  * cape: spine at the shoulders, the back skirt bones (physics) below the waist
  * front tabard: the front skirt bones
  * pauldron plates: n_kataarmor, the bone vanilla shoulder armour uses

Writes work/fit/fitted.pkl: dict(pos, nrm, faces, uv (F,3,2), material, bones (N,4), weights (N,4)).
"""
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig  # noqa: E402

ROOT = rig.ROOT
OUT = os.path.join(ROOT, "work", "fit", "fitted.pkl")


def b(i):
    return f"arthaslichking_bone_{i}"


SIDES = {
    "l": dict(clav=b(9), uarm=b(16), farm=b(27), hand=b(34), thigh=b(6), shin=b(13), foot=b(22), toe=b(32),
              knee=b(23), fingers={"oya": (b(37), b(48)), "hito": (b(38), b(49)), "naka": (b(39), b(50)),
                                   "kusu": (b(36), b(47)), "ko": (b(40), b(51))}),
    "r": dict(clav=b(10), uarm=b(17), farm=b(28), hand=b(35), thigh=b(7), shin=b(14), foot=b(24), toe=b(33),
              knee=b(25), fingers={"oya": (b(42), b(53)), "hito": (b(44), b(54)), "naka": (b(45), b(55)),
                                   "kusu": (b(41), b(52)), "ko": (b(46), b(56))}),
}
PELVIS, SPINE1, SPINE2, NECK, HEAD, JAW = b(3), b(2), b(4), b(8), b(15), b(26)
CAPE = [b(11), b(18), b(19), b(20), b(29), b(30), b(31)]
TABARD = [b(5), b(12), b(21)]
THICK = {"arm": 1.45, "hand": 1.45, "leg": 1.5, "head": 1.62, "clav": 1.55}


# ----------------------------------------------------------------------------- maths

def bone_affine(h0, h1, f0, f1, thick, stretch=True, twist=None):
    """4x4 taking source segment h0->h1 onto target f0->f1: thickness `thick` across the bone, stretched to
    length along it. twist=(src_vec, dst_vec) fixes the roll about the bone."""
    u = (h1 - h0) / np.linalg.norm(h1 - h0)
    along = np.linalg.norm(f1 - f0) / np.linalg.norm(h1 - h0) if stretch else thick
    S = thick * np.eye(3) + (along - thick) * np.outer(u, u)
    R = rig.rot_between(h1 - h0, f1 - f0)
    if twist is not None:
        d = (f1 - f0) / np.linalg.norm(f1 - f0)
        a = R @ twist[0]
        a -= d * (a @ d)
        c = twist[1] - d * (twist[1] @ d)
        if np.linalg.norm(a) > 1e-9 and np.linalg.norm(c) > 1e-9:
            R = rig.rot_between(a, c) @ R if abs(np.dot(a / np.linalg.norm(a), c / np.linalg.norm(c))) < 0.999999 else R
    M = np.eye(4)
    M[:3, :3] = R @ S
    M[:3, 3] = f0 - M[:3, :3] @ h0
    return M


def apply(M, p):
    return p @ M[:3, :3].T + M[:3, 3]


class Lattice:
    """Piecewise-linear height map with per-height width / depth scale and depth offset."""

    def __init__(self, knots):
        knots = sorted(knots)
        self.hy = np.array([k[0] for k in knots])
        self.fy = np.array([k[1] for k in knots])
        self.sx = np.array([k[2] for k in knots])
        self.sz = np.array([k[3] for k in knots])
        self.dz = np.array([k[4] for k in knots])
        assert np.all(np.diff(self.hy) > 0), self.hy

    def __call__(self, p):
        y = p[:, 1]
        slope0 = (self.fy[1] - self.fy[0]) / (self.hy[1] - self.hy[0])
        slope1 = (self.fy[-1] - self.fy[-2]) / (self.hy[-1] - self.hy[-2])
        fy = np.interp(y, self.hy, self.fy)
        fy = np.where(y < self.hy[0], self.fy[0] + (y - self.hy[0]) * slope0, fy)
        fy = np.where(y > self.hy[-1], self.fy[-1] + (y - self.hy[-1]) * slope1, fy)
        sx = np.interp(y, self.hy, self.sx)
        sz = np.interp(y, self.hy, self.sz)
        dz = np.interp(y, self.hy, self.dz)
        return np.stack([p[:, 0] * sx, fy, p[:, 2] * sz + dz], 1)


# ----------------------------------------------------------------------------- retarget

class Retarget:
    def __init__(self, skel):
        self.H = {n: M[:3, 3].copy() for n, (_, M) in skel.items()}
        self.HR = {n: M[:3, :3].copy() for n, (_, M) in skel.items()}
        names, parent, world = rig.load_skeleton()
        self.F = F = {n: world[n][:3, 3].copy() for n in names}
        for s in "lr":
            F[f"knee_{s}"] = (F[f"j_asi_b_{s}"] + F[f"j_asi_c_{s}"]) / 2
        H = self.H
        L, R = SIDES["l"], SIDES["r"]

        def mid(a, c):
            return (H[a] + H[c]) / 2

        # torso lattice knots: source height -> FFXIV height, width scale, depth scale, depth offset
        hip_h, hip_f = mid(L["thigh"], R["thigh"]), (F["j_asi_a_l"] + F["j_asi_a_r"]) / 2
        sh_h, sh_f = mid(L["uarm"], R["uarm"]), (F["j_ude_a_l"] + F["j_ude_a_r"]) / 2
        sx_hip = F["j_asi_a_l"][0] / H[L["thigh"]][0]
        sx_sh = F["j_ude_a_l"][0] / H[L["uarm"]][0]
        self.scale = s = (F["j_kubi"][1] - hip_f[1]) / (H[NECK][1] - hip_h[1])
        sz = 0.5 * (s + 0.5 * (sx_hip + sx_sh))
        print(f"torso height scale {s:.3f}, width at hips {sx_hip:.3f}, at shoulders {sx_sh:.3f}, depth {sz:.3f}")

        def knot(hp, fp, sx):
            return (hp[1], fp[1], sx, sz, fp[2] - sz * hp[2])

        knee_h, knee_f = mid(L["shin"], R["shin"]), (F["knee_l"] + F["knee_r"]) / 2
        ank_h, ank_f = mid(L["foot"], R["foot"]), (F["j_asi_d_l"] + F["j_asi_d_r"]) / 2
        self.lattice = Lattice([
            knot(ank_h, ank_f, sx_hip), knot(knee_h, knee_f, sx_hip), knot(hip_h, hip_f, sx_hip),
            knot(sh_h, sh_f, sx_sh), knot(H[NECK], F["j_kubi"], sx_sh),
        ])

        # per-bone affines (limbs, collarbones, head)
        M = {}
        for sd, S in SIDES.items():
            t = f"_{sd}"
            M[S["clav"]] = self._clav(S, t)
            M[S["uarm"]] = bone_affine(H[S["uarm"]], H[S["farm"]], F["j_ude_a" + t], F["j_ude_b" + t], THICK["arm"])
            M[S["farm"]] = bone_affine(H[S["farm"]], H[S["hand"]], F["j_ude_b" + t], F["j_te" + t], THICK["arm"])
            M[S["hand"]] = self._hand(S, t)
            for ff, (b1, b2) in S["fingers"].items():
                a, c = F[f"j_{ff}_a{t}"], F[f"j_{ff}_b{t}"]
                M[b1] = bone_affine(H[b1], H[b2], a, c, THICK["hand"])
                # finger tip: carry on along the FFXIV finger with the same stretch
                tip_h = H[b2] + (H[b2] - H[b1])
                M[b2] = bone_affine(H[b2], tip_h, c, c + (c - a), THICK["hand"])
            M[S["thigh"]] = bone_affine(H[S["thigh"]], H[S["shin"]], F["j_asi_a" + t], F["knee" + t], THICK["leg"])
            M[S["shin"]] = bone_affine(H[S["shin"]], H[S["foot"]], F["knee" + t], F["j_asi_d" + t], THICK["leg"])
            M[S["knee"]] = M[S["shin"]]
            M[S["foot"]] = bone_affine(H[S["foot"]], H[S["toe"]], F["j_asi_d" + t], F["j_asi_e" + t], THICK["leg"],
                                       stretch=False)
            M[S["toe"]] = M[S["foot"]]
        # head: rigid and upright, his head joint on FFXIV's, then moved back and scaled about j_kao so the
        # helmet goes round the FFXIV head (his skull sits further forward than the FFXIV one)
        Mh = np.eye(4)
        Mh[:3, :3] = THICK["head"] * HEAD_SCALE * np.eye(3)
        Mh[:3, 3] = F["j_kao"] + HEAD_SCALE * (HEAD_OFFSET - THICK["head"] * H[HEAD])
        M[HEAD] = M[JAW] = Mh
        self.M = M

    def _clav(self, S, t):
        """Collarbone (pauldron) affine: no stretch, his shoulder joint onto FFXIV's."""
        H, F = self.H, self.F
        k = THICK["clav"]
        R = rig.rot_between(H[S["uarm"]] - H[S["clav"]], F["j_ude_a" + t] - F["j_sako" + t])
        # only keep the rotation's roll-free part in the frontal plane: tilt, no forward swing
        M = np.eye(4)
        M[:3, :3] = R * k
        M[:3, 3] = F["j_ude_a" + t] + PAULDRON_OFFSET * np.array([1 if t == "_l" else -1, 1, 1]) \
            - M[:3, :3] @ H[S["uarm"]]
        return M

    def _hand(self, S, t):
        """Hand: wrist -> middle-finger base onto FFXIV's, with the palm across index -> little finger."""
        H, F = self.H, self.F
        fi = S["fingers"]
        return bone_affine(H[S["hand"]], H[fi["naka"][0]], F["j_te" + t], F["j_naka_a" + t], THICK["hand"],
                           twist=(H[fi["hito"][0]] - H[fi["ko"][0]], F["j_hito_a" + t] - F["j_ko_a" + t]))

    def transform(self, pos, W, joints):
        """Blend: affine bones use their matrix, everything else the torso lattice."""
        out = np.zeros_like(pos)
        lat = self.lattice(pos)
        wsum = np.zeros(len(pos))
        for j, name in enumerate(joints):
            w = W[:, j]
            sel = w > 0
            if not sel.any():
                continue
            if name in self.M:
                out[sel] += w[sel, None] * apply(self.M[name], pos[sel])
            else:
                out[sel] += w[sel, None] * lat[sel]
            wsum[sel] += w[sel]
        assert np.allclose(wsum, 1, atol=1e-3), wsum.min()
        return out


HEAD_OFFSET = np.array([0.0, 0.0, -0.055])
HEAD_SCALE = 1.08
FACES = [f"chara/human/c0101/obj/face/f{i:04d}/model/c0101f{i:04d}_fac.mdl" for i in range(1, 8)]
HEAD_CENTRE = np.array([0.0, 1.635, 0.025])
HEAD_MARGIN = 0.008  # m of helmet / his face kept outside every Midlander male face


# ----------------------------------------------------------------------------- helmet vs FFXIV face

def ffxiv_heads():
    import xivdata as xd
    return np.vstack([me["pos"] for p in FACES for me in xd.model(p)["meshes"]])


def radial_extent(pts, centre, nt=60, nphi=120, dilate=1):
    """Max radius of pts per (polar, azimuth) bin around centre, dilated by `dilate` bins."""
    d = pts - centre
    r = np.linalg.norm(d, axis=1)
    th = np.arccos(np.clip(d[:, 1] / r, -1, 1))
    ph = np.arctan2(d[:, 0], d[:, 2]) % (2 * np.pi)
    ti = np.minimum((th / np.pi * nt).astype(int), nt - 1)
    pi = np.minimum((ph / (2 * np.pi) * nphi).astype(int), nphi - 1)
    R = np.zeros((nt, nphi))
    np.maximum.at(R, (ti, pi), r)
    for _ in range(dilate):
        R = np.maximum.reduce([R, np.roll(R, 1, 1), np.roll(R, -1, 1),
                               np.vstack([R[:1], R[:-1]]), np.vstack([R[1:], R[-1:]])])
    return R


def lookup(R, dirs):
    nt, nphi = R.shape
    th = np.arccos(np.clip(dirs[:, 1], -1, 1))
    ph = np.arctan2(dirs[:, 0], dirs[:, 2]) % (2 * np.pi)
    return R[np.minimum((th / np.pi * nt).astype(int), nt - 1), np.minimum((ph / (2 * np.pi) * nphi).astype(int), nphi - 1)]


def vertex_edges(faces, n):
    e = np.vstack([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    return np.unique(np.vstack([e, e[:, ::-1]]), axis=0)


def wrap_head(pos, faces, head, heads):
    """Push head-region vertices out along rays from HEAD_CENTRE until every FFXIV face point is HEAD_MARGIN
    inside them; the push is spread to neighbours so the helmet bulges instead of tearing."""
    R = radial_extent(heads, HEAD_CENTRE)
    d = pos - HEAD_CENTRE
    r = np.linalg.norm(d, axis=1)
    dirs = d / r[:, None]
    need = np.where(head, np.maximum(0, lookup(R, dirs) + HEAD_MARGIN - r), 0)
    need[lookup(R, dirs) == 0] = 0
    E = vertex_edges(faces, len(pos))
    push = need.copy()
    for _ in range(6):
        nb = np.zeros(len(pos))
        np.maximum.at(nb, E[:, 0], push[E[:, 1]])
        push = np.where(head, np.maximum(push, 0.6 * nb), 0)
    print(f"head wrap: {np.count_nonzero(need)} vertices needed a push (max {need.max() * 1000:.1f} mm), "
          f"{np.count_nonzero(push)} moved")
    return pos + dirs * push[:, None]


def uncovered(pos, faces, head, pts, centre=HEAD_CENTRE):
    """FFXIV points whose ray from the head centre never meets a head triangle beyond them."""
    tri = faces[head[faces].all(1)]
    A, B, C = pos[tri[:, 0]], pos[tri[:, 1]], pos[tri[:, 2]]
    e1, e2 = B - A, C - A
    out = np.zeros(len(pts), bool)
    for i in range(0, len(pts), 256):
        q = pts[i:i + 256]
        D = q - centre
        dist = np.linalg.norm(D, axis=1)
        D = D / dist[:, None]
        h = np.cross(D[:, None, :], e2[None])
        a = (e1[None] * h).sum(-1)
        ok = np.abs(a) > 1e-12
        f = np.where(ok, 1 / np.where(ok, a, 1), 0)
        sv = centre - A
        u = f * (sv[None] * h).sum(-1)
        qv = np.cross(sv, e1)
        v = f * (D[:, None, :] * qv[None]).sum(-1)
        t = f * (e2[None] * qv[None]).sum(-1)
        hit = ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > dist[:, None])
        out[i:i + 256] = ~hit.any(1)
    return out


PAULDRON_OFFSET = np.array([0.0, 0.0, 0.0])


# ----------------------------------------------------------------------------- weights

def bone_map():
    """Source joint -> FFXIV bone, or a rule name (spine / cape / tabard) resolved per vertex."""
    m = {PELVIS: "j_kosi", NECK: "j_kubi", HEAD: "j_kao", JAW: "j_kao", SPINE1: "spine", SPINE2: "spine",
         b(0): "j_kosi", b(1): "j_kosi"}
    for c in CAPE:
        m[c] = "cape"
    for t in TABARD:
        m[t] = "tabard"
    for sd, S in SIDES.items():
        t = f"_{sd}"
        m.update({S["clav"]: "j_sako" + t, S["uarm"]: "j_ude_a" + t, S["farm"]: "j_ude_b" + t, S["hand"]: "j_te" + t,
                  S["thigh"]: "j_asi_a" + t, S["knee"]: "j_asi_b" + t, S["shin"]: "j_asi_c" + t,
                  S["foot"]: "j_asi_d" + t, S["toe"]: "j_asi_e" + t})
        for ff, (b1, b2) in S["fingers"].items():
            m[b1], m[b2] = f"j_{ff}_a{t}", f"j_{ff}_b{t}"
    m[b(43)] = "j_te_r"  # weapon attachment point, unweighted
    return m


def chain(y, nodes):
    """nodes: [(height, bone)] top to bottom -> piecewise-linear weights along height."""
    hs = np.array([h for h, _ in nodes])
    if y >= hs[0]:
        return {nodes[0][1]: 1.0}
    if y <= hs[-1]:
        return {nodes[-1][1]: 1.0}
    i = np.nonzero(hs > y)[0][-1]
    t = (hs[i] - y) / (hs[i] - hs[i + 1])
    out = {nodes[i][1]: 1 - t}
    out[nodes[i + 1][1]] = out.get(nodes[i + 1][1], 0) + t
    return out


def blend(a, c, t):
    out = {k: v * (1 - t) for k, v in a.items()}
    for k, v in c.items():
        out[k] = out.get(k, 0) + v * t
    return out


def mirror_split(x, make, width):
    """Weights for a centre-line piece: the side's chain, shared half and half within `width` of x = 0."""
    s = "l" if x >= 0 else "r"
    w = make(s)
    if abs(x) < width:
        w = blend(w, make("r" if s == "l" else "l"), 0.5 * (1 - abs(x) / width))
    return w


def spine_weights(y):
    return chain(y, [(1.366, "j_sebo_c"), (1.223, "j_sebo_b"), (1.077, "j_sebo_a")])


def cape_weights(p):
    """Back skirt chain (physics) below the waist, side chain towards the edges, spine above."""
    x, y, z = p

    def make(s):
        back = [(1.40, "j_sebo_c"), (1.22, "j_sebo_b"), (1.10, "j_kosi"), (1.00, f"j_sk_b_a_{s}"),
                (0.85, f"j_sk_b_b_{s}"), (0.55, f"j_sk_b_c_{s}")]
        side = [(1.40, "j_sebo_c"), (1.22, "j_sebo_b"), (1.10, "j_kosi"), (1.00, f"j_sk_s_a_{s}"),
                (0.85, f"j_sk_s_b_{s}"), (0.55, f"j_sk_s_c_{s}")]
        return blend(chain(y, back), chain(y, side), float(np.clip((abs(x) - 0.12) / 0.2, 0, 1)))

    return mirror_split(x, make, 0.06)


def tabard_weights(p):
    x, y, z = p

    def make(s):
        return chain(y, [(1.10, "j_kosi"), (1.00, f"j_sk_f_a_{s}"), (0.70, f"j_sk_f_b_{s}"), (0.50, f"j_sk_f_c_{s}")])

    return mirror_split(x, make, 0.08)


def ffxiv_weights(pos, W, joints, material, faces):
    """Per-vertex {ffxiv bone: weight} from his weights, with the rules in the module docstring."""
    bm = bone_map()
    vmat = np.empty(len(pos), object)
    for m in np.unique(material):  # a vertex shared by several materials takes the last; only used for rules
        vmat[np.unique(faces[material == m])] = m
    out = []
    for i, p in enumerate(pos):
        d = {}
        for j in np.nonzero(W[i] > 1e-4)[0]:
            w, tgt = W[i, j], bm[joints[j]]
            if tgt == "spine":
                for k, v in spine_weights(p[1]).items():
                    d[k] = d.get(k, 0) + w * v
            elif tgt == "tabard":
                for k, v in tabard_weights(p).items():
                    d[k] = d.get(k, 0) + w * v
            elif tgt == "cape":
                for k, v in cape_weights(p).items():
                    d[k] = d.get(k, 0) + w * v
            else:
                if vmat[i] in ("shoulders", "shoulders2") and tgt.startswith("j_sako"):
                    tgt = "n_kataarmor" + tgt[-2:]
                d[tgt] = d.get(tgt, 0) + w
        if vmat[i] in ("cape", "cape1"):
            # the cape hangs from the spine and skirt bones; only over the shoulders does it keep his
            # collarbone weights, and nothing of it follows the arms
            keep = {k: v for k, v in d.items() if k.startswith("j_sako")}
            t = float(np.clip((p[1] - 1.30) / 0.12, 0, 1)) * sum(keep.values())
            base = cape_weights(p)
            d = blend(base, {k: v / max(sum(keep.values()), 1e-9) for k, v in keep.items()}, t) if keep else base
        out.append(d)
    return out


def to_arrays(dicts, k=4):
    bones = np.full((len(dicts), k), "", object)
    weights = np.zeros((len(dicts), k))
    for i, d in enumerate(dicts):
        top = sorted(((w, n) for n, w in d.items() if w > 1e-3), reverse=True)[:k]
        s = sum(w for w, _ in top)
        for j, (w, n) in enumerate(top):
            bones[i, j], weights[i, j] = n, w / s
    return bones, weights


def vertex_normals(pos, faces):
    n = np.zeros_like(pos)
    fn = np.cross(pos[faces[:, 1]] - pos[faces[:, 0]], pos[faces[:, 2]] - pos[faces[:, 0]])
    for k in range(3):
        np.add.at(n, faces[:, k], fn)
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    return np.where(ln > 1e-12, n / np.maximum(ln, 1e-12), [0, 1, 0])


def main():
    src = pickle.load(open(os.path.join(ROOT, "work", "src", "src.pkl"), "rb"))
    lk = src["lichking"]
    rt = Retarget(src["skeleton"])
    pos = rt.transform(lk["pos"], lk["weights"], lk["joints"])
    W, J = lk["weights"], lk["joints"]
    head = (W[:, J.index(HEAD)] + W[:, J.index(JAW)]) > 0.5
    heads = ffxiv_heads()
    print(f"FFXIV face points showing through the helmet: {uncovered(pos, lk['faces'], head, heads).sum()} of {len(heads)}")
    pos = wrap_head(pos, lk["faces"], head, heads)
    print(f"  after wrapping: {uncovered(pos, lk['faces'], head, heads).sum()}")
    print("fitted bbox", pos.min(0).round(3), pos.max(0).round(3))
    bones, weights = to_arrays(ffxiv_weights(pos, W, J, lk["material"], lk["faces"]))
    used = sorted({x for x in bones.ravel() if x})
    print(f"FFXIV bones used ({len(used)}): {' '.join(used)}")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    pickle.dump(dict(pos=pos, nrm=vertex_normals(pos, lk["faces"]), faces=lk["faces"], uv=lk["uv"],
                     material=lk["material"], bones=bones, weights=weights), open(OUT, "wb"))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
