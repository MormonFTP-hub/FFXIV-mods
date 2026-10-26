"""Skin Griffith to the FFXIV c0101 skeleton and move him from his T-pose into the FFXIV bind pose.

* armour / undersuit / hands: skin weights copied from the nearest point of the FFXIV naked body,
  posed into Griffith's T-pose (rig.tpose), then smoothed; small rigid plates share one weight.
* cape: spine at the shoulders, skirt bones (which have physics) below the waist.
* hair / helmet / face: head, blending into neck and upper back for long hair.
The head is moved forward onto the FFXIV face position so vanilla headwear still fits.

Writes work/fit/fitted.pkl: {part: {pos, nrm, uv, faces, pos_id, bones (N,4) names, weights (N,4)}}
in FFXIV bind-pose model space.
"""
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig  # noqa: E402
import xivdata as xd  # noqa: E402
from check_tpose import BODY, hand_frames  # noqa: E402
from objload import load_obj  # noqa: E402

ROOT = rig.ROOT
HEAD_SHIFT = 0.032  # metres Griffith's face sits behind the FFXIV face

TRANSFER = ["model_1_submesh_1", "model_1_submesh_2", "model_1_submesh_3", "model_1_submesh_4", "model_1_submesh_5"]
CAPE = ["model_1_submesh_0", "model_1_submesh_6"]
HAIR = ["model_1_submesh_7", "model_2_submesh_0", "model_2_submesh_1", "model_2_submesh_2", "model_3_submesh_1"]
RIGID_HEAD = ["model_3_submesh_0", "model_4_submesh_0", "model_4_submesh_2", "model_4_submesh_3"]
FACE_SKIN = ["model_4_submesh_1"]
RIGID_ISLAND = 0.12  # islands smaller than this (bbox diagonal, m) move as one rigid plate


# ----------------------------------------------------------------------------- helpers

def nearest(query, ref, chunk=768):
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


def unique_positions(m):
    """Collapse UV/normal splits: (unique position array, map split vertex -> unique, faces on unique)."""
    ids, inv = np.unique(m["pos_id"], return_inverse=True)
    upos = np.zeros((len(ids), 3))
    upos[inv] = m["pos"]
    return upos, inv, inv[m["faces"]]


def adjacency(faces, n):
    e = np.vstack([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    e = np.vstack([e, e[:, ::-1]])
    e = np.unique(e, axis=0)
    return e


def smooth(W, edges, n, iters=12, lam=0.5):
    deg = np.bincount(edges[:, 0], minlength=n).astype(float)
    for _ in range(iters):
        acc = np.zeros_like(W)
        np.add.at(acc, edges[:, 0], W[edges[:, 1]])
        has = deg > 0
        W[has] = (1 - lam) * W[has] + lam * acc[has] / deg[has, None]
    return W


def components(edges, n):
    parent = np.arange(n)

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for a, b in edges[edges[:, 0] < edges[:, 1]]:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
    return np.array([find(i) for i in range(n)])


def chain_weights(y, nodes):
    """nodes: [(height, bone)] from top to bottom; piecewise-linear weights along height."""
    hs = np.array([h for h, _ in nodes])
    out = []
    for yy in y:
        if yy >= hs[0]:
            out.append({nodes[0][1]: 1.0})
        elif yy <= hs[-1]:
            out.append({nodes[-1][1]: 1.0})
        else:
            i = np.nonzero(hs > yy)[0][-1]
            t = (hs[i] - yy) / (hs[i] - hs[i + 1])
            d = {}
            d[nodes[i][1]] = d.get(nodes[i][1], 0) + 1 - t
            d[nodes[i + 1][1]] = d.get(nodes[i + 1][1], 0) + t
            out.append(d)
    return out


def blend(a, b, t):
    """(1-t)*a + t*b for weight dicts."""
    d = {k: v * (1 - t) for k, v in a.items()}
    for k, v in b.items():
        d[k] = d.get(k, 0) + v * t
    return d


def to_arrays(dicts, k=4):
    bones = np.full((len(dicts), k), "", object)
    weights = np.zeros((len(dicts), k))
    for i, d in enumerate(dicts):
        top = sorted(((w, b) for b, w in d.items() if w > 1e-4), reverse=True)[:k]
        s = sum(w for w, _ in top) or 1
        for j, (w, b) in enumerate(top):
            bones[i, j], weights[i, j] = b, w / s
    return bones, weights


# ------------------------------------------------------------------------ weight rules

HEAD_CHAIN = [(1.565, "j_kao"), (1.47, "j_kubi"), (1.36, "j_sebo_c")]
FACE_CHAIN = [(1.575, "j_kao"), (1.50, "j_kubi")]


def hair_weights(p):
    return chain_weights(p[:, 1], HEAD_CHAIN)


def face_weights(p):
    return chain_weights(p[:, 1], FACE_CHAIN)


def cape_weights(p):
    """Spine at the top, skirt bones (physics) below the waist; back chain blends into side chain with |x|."""
    out = []
    for x, y, z in p:
        s = "l" if x >= 0 else "r"
        back = [(1.40, "j_sebo_c"), (1.22, "j_sebo_b"), (1.12, "j_kosi"), (1.00, f"j_sk_b_a_{s}"),
                (0.80, f"j_sk_b_b_{s}"), (0.55, f"j_sk_b_c_{s}")]
        side = [(1.40, "j_sebo_c"), (1.22, "j_sebo_b"), (1.12, "j_kosi"), (1.00, f"j_sk_s_a_{s}"),
                (0.80, f"j_sk_s_b_{s}"), (0.55, f"j_sk_s_c_{s}")]
        wb = chain_weights([y], back)[0]
        ws = chain_weights([y], side)[0]
        t = np.clip((abs(x) - 0.10) / 0.18, 0, 1)
        w = blend(wb, ws, t)
        if abs(x) < 0.04:  # centre seam: share left and right so the cape does not split
            o = "r" if s == "l" else "l"
            mirror = {k.replace(f"_{s}", f"_{o}") if k.endswith(f"_{s}") else k: v for k, v in w.items()}
            w = blend(w, mirror, 0.5 * (1 - abs(x) / 0.04))
        if y > 1.30:  # over the shoulders: follow the collarbone
            t = np.clip((abs(x) - 0.08) / 0.12, 0, 1) * 0.5 * np.clip((y - 1.30) / 0.08, 0, 1)
            w = blend(w, {f"j_sako_{s}": 1.0}, t)
        out.append(w)
    return out


# ------------------------------------------------------------------------------- main

def posed_body_samples(deltas, n_sub=5):
    """Points on the FFXIV naked body (posed into the T-pose) with interpolated bone weights."""
    meshes = [me for p in BODY for me in xd.model(p)["meshes"]]
    bone_names = sorted({b for me in meshes for row in me["bones"] for b in row if b})
    bidx = {b: i for i, b in enumerate(bone_names)}
    bary = np.array([(i, j, n_sub - i - j) for i in range(n_sub + 1) for j in range(n_sub + 1 - i)], float) / n_sub
    pts, wts = [], []
    for me in meshes:
        posed, _ = rig.skin(me["pos"], me["bones"], me["weights"], deltas)
        W = np.zeros((len(posed), len(bone_names)))
        for k in range(me["bones"].shape[1]):
            for v, b in enumerate(me["bones"][:, k]):
                if b:
                    W[v, bidx[b]] += me["weights"][v, k]
        f = me["faces"]
        pts.append(np.einsum("sk,fkd->fsd", bary, posed[f]).reshape(-1, 3))
        wts.append(np.einsum("sk,fkb->fsb", bary, W[f]).reshape(-1, len(bone_names)))
    return np.vstack(pts), np.vstack(wts), bone_names


def head_deltas(deltas):
    """Griffith's head sits HEAD_SHIFT behind FFXIV's: express that as posed-space offsets."""
    out = dict(deltas)
    names, parent, _ = rig.load_skeleton()

    def under(b, root):
        while b is not None:
            if b == root:
                return True
            b = parent[b]
        return False

    for b in names:
        if under(b, "j_kao") or b.startswith("j_f_"):
            t = np.eye(4)
            t[2, 3] = -HEAD_SHIFT
            out[b] = t @ deltas[b]
        elif b == "j_kubi":
            t = np.eye(4)
            t[2, 3] = -HEAD_SHIFT * 0.5
            out[b] = t @ deltas[b]
    return out


def main():
    src = load_obj(os.path.join(ROOT, "source", "Griffith.obj"))
    names, parent, world = rig.load_skeleton()
    _, deltas = rig.tpose(names, parent, world, hand_frames(src))
    deltas = head_deltas(deltas)
    samples, sample_w, bone_names = posed_body_samples(deltas)
    print(f"body samples: {len(samples)}, bones {len(bone_names)}")

    fitted = {}
    for name, m in src.items():
        if name.startswith("driver"):
            continue
        upos, inv, ufaces = unique_positions(m)
        edges = adjacency(ufaces, len(upos))
        if name in TRANSFER:
            idx, dist = nearest(upos, samples)
            W = sample_w[idx].copy()
            W = smooth(W, edges, len(upos))
            comp = components(edges, len(upos))
            rigid = 0
            for c in np.unique(comp):
                sel = comp == c
                ext = upos[sel].max(0) - upos[sel].min(0)
                if np.linalg.norm(ext) < RIGID_ISLAND:
                    W[sel] = W[sel].mean(0)
                    rigid += 1
            dicts = [{bone_names[j]: W[i, j] for j in np.nonzero(W[i] > 1e-3)[0]} for i in range(len(upos))]
            print(f"{name}: {len(upos)} pts, max dist to body {dist.max():.3f} m, {len(np.unique(comp))} islands ({rigid} rigid)")
        elif name in CAPE:
            dicts = cape_weights(upos)
        elif name in HAIR:
            dicts = hair_weights(upos)
        elif name in FACE_SKIN:
            dicts = face_weights(upos)
        elif name in RIGID_HEAD:
            dicts = [{"j_kao": 1.0}] * len(upos)
        else:
            raise KeyError(name)
        ubones, uweights = to_arrays(dicts)
        bind, lin = rig.skin(upos, ubones, uweights, deltas, inverse=True)
        n = np.einsum("nij,nj->ni", lin[inv], m["nrm"])
        n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
        fitted[name] = dict(material=m["material"], pos=bind[inv], nrm=n, uv=m["uv"], faces=m["faces"],
                            pos_id=m["pos_id"], bones=ubones[inv], weights=uweights[inv])
        used = sorted({b for b in ubones.ravel() if b})
        print(f"  {name}: {len(m['pos'])} verts, {len(m['faces'])} tris, bones: {' '.join(used)}")

    os.makedirs(os.path.join(ROOT, "work", "fit"), exist_ok=True)
    with open(os.path.join(ROOT, "work", "fit", "fitted.pkl"), "wb") as f:
        pickle.dump(fitted, f)
    print("saved fitted.pkl")


if __name__ == "__main__":
    main()
