"""Skin Jak to the FFXIV c0101 skeleton and move him from his T-pose rip into the FFXIV bind pose.

* clothes, boots, gloves and hands: skin weights copied from the nearest point of the FFXIV naked body,
  posed into Jak's T-pose (rig.jak_pose), then smoothed over all of them at once (layers that touch, like the
  straps on the shirt, are linked so they bend together). Small islands (fingers, buckles) and the
  back holster and hip pouch move as one piece. Finger weights go to the hand: his fists stay closed.
* head (face, eyes, teeth, goatee, ears) and hair (with the goggles): head, blending into the neck.
Un-posing through the same deltas stretches his short limbs onto the FFXIV joints and scales his head
and boots (rig.HEAD_SCALE, rig.FOOT_SCALE).

Writes work/fit/fitted.pkl: {part: {material, texture, pos, nrm, uv, faces, pos_id, bones (N,4) names,
weights (N,4)}} in FFXIV bind-pose model space. "face" is split into "face" (head) and "hands" (fist skin).
"""
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig  # noqa: E402
import xivdata as xd  # noqa: E402
from check_tpose import BODY, SRC_OBJ  # noqa: E402
from objload import load_obj  # noqa: E402

ROOT = rig.ROOT
OUT = os.path.join(ROOT, "work", "fit", "fitted.pkl")
FACE_PARTS = ["face", "teeth", "eyel", "eyer", "facialhair", "ears"]
HAIR_PARTS = ["hair", "gogglemetal", "gogglelens"]
RIGID_PARTS = ["gunholster", "pouch"]   # each island of these moves as one piece
RIGID_ISLAND = 0.08    # islands smaller than this (bbox diagonal, m) move as one piece
LINK = 0.6 * rig.S     # vertices of different parts closer than this share their weights while smoothing
FINGERS = ("j_oya_", "j_hito_", "j_naka_", "j_kusu_", "j_ko_")
HAND_SPLIT_X = 12.0    # rip units: the "face" group's skin beyond this |x| is his fists

# head weights by height (rip units), top to bottom
FACE_CHAIN = [(46.3, "j_kao"), (45.0, "j_kubi"), (43.8, "j_sebo_c")]
RIGID_HEAD = ["facialhair", "ears", "eyel", "eyer", "teeth"]   # goatee, brows, eyes: head only
HAIR_CHAIN = [(48.5, "j_kao"), (45.5, "j_kubi")]


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
    return np.unique(e, axis=0)


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


def smooth(W, edges, n, iters=10, lam=0.5):
    deg = np.bincount(edges[:, 0], minlength=n).astype(float)
    for _ in range(iters):
        acc = np.zeros_like(W)
        np.add.at(acc, edges[:, 0], W[edges[:, 1]])
        has = deg > 0
        W[has] = (1 - lam) * W[has] + lam * acc[has] / deg[has, None]
    return W


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
            out.append({nodes[i][1]: 1 - t, nodes[i + 1][1]: t})
    return out


def to_arrays(dicts, k=4):
    bones = np.full((len(dicts), k), "", object)
    weights = np.zeros((len(dicts), k))
    for i, d in enumerate(dicts):
        top = sorted(((w, b) for b, w in d.items() if w > 1e-3), reverse=True)[:k]
        s = sum(w for w, _ in top) or 1
        for j, (w, b) in enumerate(top):
            bones[i, j], weights[i, j] = b, w / s
    return bones, weights


def submesh(m, tri):
    """Part of a mesh dict: the triangles `tri` (bool mask) and the vertices they use."""
    f = m["faces"][tri]
    used, remap = np.unique(f, return_inverse=True)
    out = {k: (v[used] if isinstance(v, np.ndarray) and len(v) == len(m["pos"]) else v) for k, v in m.items()}
    out["faces"] = remap.reshape(-1, 3)
    return out


def textures():
    tex, cur = {}, None
    for line in open(os.path.join(os.path.dirname(SRC_OBJ), "Jak.mtl")):
        line = line.strip()
        if line.startswith("newmtl"):
            cur = line.split()[1]
        elif line.startswith("map_Kd"):
            tex[cur] = line.split()[1]
    return tex


def weld(m):
    """The rip stores a normal per triangle corner: merge corners with the same position, UV and normal."""
    key = np.c_[m["pos_id"], np.round(m["uv"] * 1e5), np.round(m["nrm"] * 1e3)]
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    out = {k: (v[first] if isinstance(v, np.ndarray) and len(v) == len(m["pos"]) else v) for k, v in m.items()}
    out["faces"] = inv.ravel()[m["faces"]]
    return out


def load_source():
    src = {n: weld(m) for n, m in load_obj(SRC_OBJ).items()}
    face = src.pop("face")
    cx = face["pos"][face["faces"]].mean(1)[:, 0]
    src["face"] = submesh(face, np.abs(cx) < HAND_SPLIT_X)
    src["hands"] = submesh(face, np.abs(cx) >= HAND_SPLIT_X)
    tex = textures()
    for name, m in src.items():
        m["texture"] = tex[m["material"]]
        m["pos"] = m["pos"] * rig.S   # J space
    return src


# ------------------------------------------------------------------------------- main

def posed_body_samples(deltas, n_sub=5):
    """Points on the FFXIV naked body (posed into Jak's T-pose) with interpolated bone weights."""
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
    W = np.vstack(wts)
    # fingers -> hand: his hands are closed fists, keep them rigid
    for j, b in enumerate(bone_names):
        if b.startswith(FINGERS):
            W[:, bidx["j_te_" + b[-1]]] += W[:, j]
            W[:, j] = 0
    return np.vstack(pts), W, bone_names


def transfer_weights(src, names, samples, sample_w, bone_names):
    """Nearest-body weights for all transfer parts, smoothed over one graph that links the parts."""
    parts, offs, allpos, edges = [], [0], [], []
    for name in names:
        upos, inv, uf = unique_positions(src[name])
        parts.append((name, upos, inv, uf))
        edges.append(adjacency(uf, len(upos)) + offs[-1])
        allpos.append(upos)
        offs.append(offs[-1] + len(upos))
    P = np.vstack(allpos)
    owner = np.repeat(np.arange(len(names)), np.diff(offs))
    # proximity links between different parts (seams, layered straps)
    links = []
    for i in range(0, len(P), 1024):
        d = np.linalg.norm(P[i:i + 1024, None] - P[None], axis=2)
        a, b = np.nonzero((d < LINK) & (owner[i:i + 1024, None] != owner[None]))
        links.append(np.c_[a + i, b])
    E = np.vstack(edges + links)
    print(f"transfer: {len(P)} points in {len(names)} parts, {sum(len(l) for l in links) // 2} cross-part links")
    idx, dist = nearest(P, samples)
    W = smooth(sample_w[idx].copy(), E, len(P))
    out = {}
    for k, (name, upos, inv, uf) in enumerate(parts):
        w = W[offs[k]:offs[k + 1]]
        e = adjacency(uf, len(upos))
        comp = components(e, len(upos))
        rigid = 0
        for c in np.unique(comp):
            sel = comp == c
            ext = upos[sel].max(0) - upos[sel].min(0)
            if name in RIGID_PARTS or np.linalg.norm(ext) < RIGID_ISLAND:
                w[sel] = w[sel].mean(0)
                rigid += 1
        dicts = [{bone_names[j]: w[i, j] for j in np.nonzero(w[i] > 1e-3)[0]} for i in range(len(upos))]
        print(f"  {name}: {len(upos)} pts, max dist to body {dist[offs[k]:offs[k + 1]].max():.3f} m, "
              f"{len(np.unique(comp))} islands ({rigid} rigid)")
        out[name] = (upos, inv, dicts)
    return out


def main():
    src = load_source()
    names, parent, world = rig.load_skeleton()
    _, deltas = rig.jak_pose(names, parent, world)
    samples, sample_w, bone_names = posed_body_samples(deltas)
    print(f"body samples: {len(samples)}, bones {len(bone_names)}")
    transfer = [n for n in src if n not in FACE_PARTS + HAIR_PARTS]
    tw = transfer_weights(src, transfer, samples, sample_w, bone_names)

    fitted = {}
    for name, m in src.items():
        if name in tw:
            upos, inv, dicts = tw[name]
        else:
            upos, inv, _ = unique_positions(m)
            if name in RIGID_HEAD:
                dicts = [{"j_kao": 1.0}] * len(upos)
            else:
                dicts = chain_weights(upos[:, 1] / rig.S, FACE_CHAIN if name in FACE_PARTS else HAIR_CHAIN)
        ubones, uweights = to_arrays(dicts)
        bind, lin = rig.skin(upos, ubones, uweights, deltas, inverse=True)
        # normals: inverse transpose of the (affine) un-posing map
        n = np.einsum("nji,nj->ni", np.linalg.inv(lin[inv]), m["nrm"])
        n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
        fitted[name] = dict(material=m["material"], texture=m["texture"], pos=bind[inv], nrm=n, uv=m["uv"],
                            faces=m["faces"], pos_id=m["pos_id"], bones=ubones[inv], weights=uweights[inv])
        used = sorted({b for b in ubones.ravel() if b})
        print(f"  {name}: {len(m['pos'])} verts, {len(m['faces'])} tris, bones: {' '.join(used)}")

    allp = np.vstack([f["pos"] for f in fitted.values()])
    print("fitted bbox", allp.min(0).round(3), allp.max(0).round(3))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "wb") as f:
        pickle.dump(fitted, f)
    print("saved", OUT)


if __name__ == "__main__":
    main()
