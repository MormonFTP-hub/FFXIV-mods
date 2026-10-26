"""Fit Sonic (Sonic Forces rip) onto an FFXIV race skeleton.

Sonic is a cartoon: big head, hands and shoes on a tiny torso and thin limbs. So the fit works per region,
driven by Sonic's own rig (the SMD skin weights):
  * torso: a height lattice through his ankles, knees, hips, shoulders and neck, scaled in width and depth
  * arms and legs: one affine per bone, rotated onto the FFXIV bone and stretched to its length, with
    their thickness scaled by `thick` (so the limbs stay thin, as on Sonic)
  * hands, shoes, head: rigid, uniformly scaled by their own factors (`hand`, `foot`, `head`)
Weights: Sonic's own, renamed onto FFXIV bones (BONE_MAP); his two spine bones are spread over the FFXIV
spine by height. The head (with the mouth piece and eyes) is rigid on j_kao.

python -P -E tools/fit.py [race ...]   ->  work/fit/<race>.pkl
  {variant: {part: dict(pos, nrm, uv, faces, vid, bones (N,4), weights (N,4), texset)}, "joints": {...}}
"""
import math
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig  # noqa: E402
import smd  # noqa: E402

ROOT = rig.ROOT
SRC = os.path.join(ROOT, "source", "Sonic Forces", "Sonic")
SIDES = (("l", "L"), ("r", "R"))

# Per race: uniform scales for the rigid extremities, limb thickness, and where the head centre goes.
PROFILES = {
    "c0101": dict(head=1.45, hand=0.95, foot=1.2, arm_thick=1.9, leg_thick=2.1, spikes=1.7, head_lift=0.0),
    "c0201": dict(head=1.35, hand=0.85, foot=1.08, arm_thick=1.7, leg_thick=1.9, spikes=1.55, head_lift=0.0),
    "c1101": dict(head=1.0, hand=0.72, foot=0.78, arm_thick=1.0, leg_thick=1.1, spikes=1.0, head_lift=0.0),
}
# Sonic's head centre (between the eyes, inside the skull), in rip space
SONIC_HEAD_CENTRE = np.array([0.0, 0.83, 0.0])
VARIANTS = {"sonic": "Sonic", "super": "SuperSonic"}


def bone_map(name):
    """Sonic bone -> FFXIV bone; None for torso bones (spread by height)."""
    s = {"L": "l", "R": "r"}.get(name[-1]) if name[-2:] in ("_L", "_R") else None
    base = name[:-2] if s else name
    if base in ("Reference", "Sonic", "HipsTranslation", "Hips", "Spine", "Spine1", "Neck"):
        return None
    if base == "Tail":
        return "j_kosi"
    if base == "Wing":
        return "j_sebo_b"
    fixed = {"Shoulder": "j_sako", "UpperArm": "j_ude_a", "ForeArm": "j_ude_b", "Elbow": "n_hhiji", "Hand": "j_te",
             "Wrist": "n_hte", "Thigh": "j_asi_a", "Knee": "j_asi_b", "Calf": "j_asi_c", "Socks": "j_asi_c",
             "Foot": "j_asi_d", "Toe": "j_asi_e"}
    if s and base in fixed:
        return f"{fixed[base]}_{s}"
    fingers = {"Thumb": "oya", "Index": "hito", "Middle": "naka", "Ring": "kusu", "Pinky": "ko"}
    for k, f in fingers.items():
        if s and base.startswith(k):
            n = int(base[len(k):])
            if k != "Thumb" and n == 0:
                return f"j_te_{s}"
            a = "a" if (n == 1) else "b"
            return f"j_{f}_{a}_{s}"
    return "j_kao"   # head, quills, ears, brows, eyelids, mouth rigs


# ----------------------------------------------------------------------------- retarget

def affine(lin, src_point, dst_point):
    m = np.eye(4)
    m[:3, :3] = lin
    m[:3, 3] = dst_point - lin @ src_point
    return m


class Retarget:
    def __init__(self, sk, race, prof):
        self.names, self.parents = sk["names"], sk["parents"]
        H = {n: sk["world"][i][:3, 3].copy() for i, n in enumerate(self.names)}
        self.H = H
        names, parent, world = rig.load_skeleton(f"skeleton_{race}")
        F = {n: world[n][:3, 3].copy() for n in names}
        for s, _ in SIDES:
            F[f"knee_{s}"] = (F[f"j_asi_b_{s}"] + F[f"j_asi_c_{s}"]) / 2
        self.F, self.prof = F, prof

        # shoes: uniform scale about Sonic's ankle, sole on the floor, under the FFXIV ankle
        kf = prof["foot"]
        A = {}
        for s, S in SIDES:
            a = F[f"j_asi_d_{s}"].copy()
            a[1] = kf * H[f"Foot_{S}"][1]
            A[s] = a
        self.ankle = A

        # torso lattice by height (left side knots; Sonic is symmetric)
        knots = [(H["Foot_L"], A["l"]), (H["Calf_L"], F["knee_l"]), (H["Thigh_L"], F["j_asi_a_l"]),
                 (H["UpperArm_L"], F["j_ude_a_l"]), (H["Neck"], F["j_kubi"])]
        self.ky = np.array([h[1] for h, _ in knots])
        self.fy = np.array([f[1] for _, f in knots])
        assert np.all(np.diff(self.ky) > 0) and np.all(np.diff(self.fy) > 0)
        sx_hip = F["j_asi_a_l"][0] / H["Thigh_L"][0]
        sx_sh = F["j_ude_a_l"][0] / H["UpperArm_L"][0]
        self.sx_y = np.array([H["Thigh_L"][1], H["UpperArm_L"][1]])
        self.sx_v = np.array([sx_hip, sx_sh])
        sxk = np.interp(self.ky, self.sx_y, self.sx_v)
        self.dz = np.array([f[2] - h[2] * k for (h, f), k in zip(knots, sxk)])
        print(f"  torso lattice y {np.round(self.ky, 3)} -> {np.round(self.fy, 3)}; width x{sx_hip:.2f} (hips) "
              f"x{sx_sh:.2f} (shoulders)")

        # head: uniform scale, Sonic's head centre onto the FFXIV face centre
        kh = prof["head"]
        self.head_target = self.face_centre(race) + np.array([0, prof["head_lift"], 0])

        # per-bone affines: name -> (child, ffxiv bone, ffxiv child or point, kind, thickness, twist)
        D = {}
        for s, S in SIDES:
            D.update({
                f"Shoulder_{S}": (f"UpperArm_{S}", f"j_sako_{s}", F[f"j_ude_a_{s}"], "stretch", None, None),
                f"UpperArm_{S}": (f"ForeArm_{S}", f"j_ude_a_{s}", F[f"j_ude_b_{s}"], "stretch", prof["arm_thick"], None),
                f"ForeArm_{S}": (f"Hand_{S}", f"j_ude_b_{s}", F[f"j_te_{s}"], "stretch", prof["arm_thick"], None),
                f"Hand_{S}": (f"Middle1_{S}", f"j_te_{s}", F[f"j_naka_a_{s}"], "rigid", prof["hand"],
                              ((f"Index1_{S}", f"Pinky1_{S}"), (F[f"j_hito_a_{s}"], F[f"j_ko_a_{s}"]))),
                f"Thigh_{S}": (f"Calf_{S}", f"j_asi_a_{s}", F[f"knee_{s}"], "stretch", prof["leg_thick"], None),
                f"Calf_{S}": (f"Foot_{S}", f"knee_{s}", A[s], "stretch", prof["leg_thick"], None),
                f"Foot_{S}": (None, f"j_asi_d_{s}", A[s], "place", kf, None),
            })
        D["Head"] = (None, "j_kao", None, "head", kh, None)
        for b in ("Wing_L", "Wing_R", "Tail"):   # back spikes and tail keep their shape
            D[b] = (None, None, None, "spike", prof["spikes"], None)
        self.D = D
        torso_roots = {"Reference", "Sonic", "HipsTranslation", "Hips", "Spine", "Spine1", "Neck"}
        par = {n: (self.names[p] if p >= 0 else None) for n, p in zip(self.names, self.parents)}

        def up(b):
            while b is not None and b not in D and b not in torso_roots:
                b = par[b]
            return b

        def depth(b):
            d = 0
            while b is not None:
                b, d = par[b], d + 1
            return d

        M = {}
        for b in sorted(D, key=depth):
            child, fb, target, kind, k, twist = D[b]
            p = up(par[b])
            anchor = self.field_point(H[b]) if (p is None or p in torso_roots) else (M[p] @ np.append(H[b], 1))[:3]
            if kind == "head":
                M[b] = affine(np.eye(3) * k, SONIC_HEAD_CENTRE, self.head_target)
                continue
            if kind == "place":
                M[b] = affine(np.eye(3) * k, H[b], target)
                continue
            if kind == "spike":
                M[b] = affine(np.eye(3) * k, H[b], anchor)
                continue
            d_s = H[child] - H[b]
            d_f = target - anchor if kind == "stretch" else target - F[fb]
            R = rig.rot_between(d_s, d_f)
            if twist:
                (ga, gb), (fa, fb2) = twist
                u = R @ (H[gb] - H[ga])
                w = fb2 - fa
                ax = d_f / np.linalg.norm(d_f)
                u -= ax * np.dot(u, ax)
                w -= ax * np.dot(w, ax)
                R = rig.axis_angle(ax, math.atan2(np.dot(np.cross(u, w), ax), np.dot(u, w))) @ R
            if kind == "rigid":
                lin = R * k
            else:
                kl = np.linalg.norm(d_f) / np.linalg.norm(d_s)
                kt = k if k is not None else float(np.interp(anchor[1], self.fy[2:4], self.sx_v))
                u = d_s / np.linalg.norm(d_s)
                lin = R @ (kt * np.eye(3) + (kl - kt) * np.outer(u, u))
            M[b] = affine(lin, H[b], anchor)
        self.M = M
        self.deformer = {}
        for i, b in enumerate(self.names):
            d = up(b)
            self.deformer[i] = d if d in D else None

    def face_centre(self, race):
        import xivdata as xd
        m = xd.model(f"chara/human/{race}/obj/face/f0001/model/{race}f0001_fac.mdl")
        me = next(x for x in m["meshes"] if "_fac_" in x["material"])
        main = me["faces"][me["tri_sub"] == 0]
        p = me["pos"][np.unique(main)]
        return (p.min(0) + p.max(0)) / 2

    def field(self, p):
        y = p[:, 1]
        y2 = np.interp(y, self.ky, self.fy)
        lo, hi = y < self.ky[0], y > self.ky[-1]
        y2[lo] = self.fy[0] + (y[lo] - self.ky[0])
        y2[hi] = self.fy[-1] + (y[hi] - self.ky[-1]) * self.sx_v[-1]
        sx = np.interp(y, self.sx_y, self.sx_v)
        dz = np.interp(y, self.ky, self.dz)
        return np.stack([p[:, 0] * sx, y2, p[:, 2] * sx + dz], 1), sx

    def field_point(self, p):
        return self.field(p[None, :])[0][0]

    def apply(self, pos, nrm, bones, weights):
        tp, tsx = self.field(pos)
        out = np.zeros_like(pos)
        lin = np.zeros((len(pos), 3, 3))
        # vertical stretch of the lattice at each point (for normals)
        ky = np.interp(pos[:, 1], self.ky[:-1] + np.diff(self.ky) / 2, np.diff(self.fy) / np.diff(self.ky))
        for k in range(bones.shape[1]):
            w = weights[:, k]
            for b in np.unique(bones[w > 0, k]):
                sel = (bones[:, k] == b) & (w > 0)
                d = self.deformer[b]
                ws = w[sel]
                if d is None:
                    out[sel] += ws[:, None] * tp[sel]
                    lin[sel] += ws[:, None, None] * np.array([np.diag([sx, s2, sx]) for sx, s2 in zip(tsx[sel], ky[sel])])
                else:
                    m = self.M[d]
                    out[sel] += ws[:, None] * (pos[sel] @ m[:3, :3].T + m[:3, 3])
                    lin[sel] += ws[:, None, None] * m[:3, :3]
        n = np.einsum("nij,nj->ni", np.linalg.inv(lin).transpose(0, 2, 1), nrm)
        return out, n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)


# ----------------------------------------------------------------------------- weights

def ffxiv_weights(sk, bones, weights, pos_ffxiv, F):
    """Sonic weights -> (N,4) FFXIV bone names / weights. Torso weight is spread over the spine by height."""
    chain = [(F["j_kubi"][1] - 0.02, "j_kubi"), (F["j_sebo_c"][1], "j_sebo_c"), (F["j_sebo_b"][1], "j_sebo_b"),
             (F["j_sebo_a"][1], "j_sebo_a"), (F["j_asi_a_l"][1], "j_kosi")]
    hs = np.array([h for h, _ in chain])
    names = [bone_map(n) for n in sk["names"]]
    out = []
    for i in range(len(bones)):
        d = {}
        torso = 0.0
        for b, w in zip(bones[i], weights[i]):
            if w <= 0:
                continue
            n = names[b]
            if n is None:
                torso += w
            else:
                d[n] = d.get(n, 0) + w
        if torso > 0:
            y = pos_ffxiv[i, 1]
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
    B = np.full((len(out), 4), "", object)
    W = np.zeros((len(out), 4))
    for i, d in enumerate(out):
        top = sorted(((w, b) for b, w in d.items() if w > 1e-3), reverse=True)[:4]
        s = sum(w for w, _ in top)
        for j, (w, b) in enumerate(top):
            B[i, j], W[i, j] = b, w / s
    return B, W


def soften_back_quills(B, W, pos, F):
    """The lowest back quills hang behind the shoulders: let them bend with the neck and upper back instead of
    swinging rigidly with the head into the back."""
    ky, sy = F["j_kubi"][1], F["j_sebo_c"][1]
    behind = pos[:, 2] < F["j_kubi"][2] - 0.06
    for i in np.nonzero(behind & (B[:, 0] == "j_kao") & (W[:, 0] > 0.999) & (pos[:, 1] < ky + 0.06))[0]:
        t = float(np.clip((ky + 0.06 - pos[i, 1]) / (ky + 0.06 - sy), 0, 1))
        d = {"j_kao": 1 - 0.7 * t, "j_kubi": 0.45 * t, "j_sebo_c": 0.25 * t}
        for j, (b, w) in enumerate(sorted(d.items(), key=lambda x: -x[1])):
            B[i, j], W[i, j] = b, w
    return B, W


# ----------------------------------------------------------------------------- main

def load_variant(stem):
    sk = smd.read(os.path.join(SRC, f"{stem}.SMD"))
    meshes = {"main": smd.weld(sk["tris"])}
    for side in ("L", "R"):
        meshes[f"mouth_{side.lower()}"] = smd.weld(smd.read(os.path.join(SRC, f"{stem}_Mouth{side}.SMD"))["tris"])
    return sk, meshes


def fit_race(race):
    prof = PROFILES[race]
    out = {}
    for variant, stem in VARIANTS.items():
        print(f"{race} {variant}")
        sk, meshes = load_variant(stem)
        rt = Retarget(sk, race, prof)
        parts = {}
        for name, m in meshes.items():
            pos, nrm = rt.apply(m["pos"], m["nrm"], m["bones"], m["weights"])
            B, W = ffxiv_weights(sk, m["bones"], m["weights"], pos, rt.F)
            B, W = soften_back_quills(B, W, pos, rt.F)
            for mat in np.unique(m["mat"]):
                sel = m["mat"] == mat
                texset = "eye" if "_eye_" in mat else "body"
                f = m["faces"][sel]
                used, remap = np.unique(f, return_inverse=True)
                pname = name if texset == "body" else f"{name}_eye"
                parts[pname] = dict(pos=pos[used], nrm=nrm[used], uv=m["uv"][used], faces=remap.reshape(-1, 3),
                                    vid=m["vid"][used], bones=B[used], weights=W[used], texset=texset)
                p = parts[pname]
                print(f"  {pname}: {len(p['pos'])} verts {len(p['faces'])} tris, y {p['pos'][:, 1].min():.3f}.."
                      f"{p['pos'][:, 1].max():.3f}, bones {len({b for b in p['bones'].ravel() if b})}")
        out[variant] = parts
    out["joints"] = rt.F
    out["ankle"] = rt.ankle
    os.makedirs(os.path.join(ROOT, "work", "fit"), exist_ok=True)
    pickle.dump(out, open(os.path.join(ROOT, "work", "fit", f"{race}.pkl"), "wb"))
    print("wrote", race)


if __name__ == "__main__":
    for r in (sys.argv[1:] or list(PROFILES)):
        fit_race(r)
