"""Surface helpers: dense sampling, blocked nearest-neighbour search, displacement transfer, collision push-out."""
import numpy as np


def knn(query, ref, k=1, cell=0.08, margin=0.08):
    """k nearest ref points for each query point. Returns (dist (Q,k), idx (Q,k)).
    Blocked brute force: queries are bucketed into cubes, each cube searches refs within cube+margin."""
    query = np.asarray(query, np.float64); ref = np.asarray(ref, np.float64)
    Q = len(query)
    out_d = np.full((Q, k), np.inf); out_i = np.zeros((Q, k), np.int64)
    lo = np.minimum(query.min(0), ref.min(0)) - 1e-6
    qc = np.floor((query - lo) / cell).astype(np.int64)
    keys = qc[:, 0] * 1_000_000 + qc[:, 1] * 1_000 + qc[:, 2]
    order = np.argsort(keys)
    ks = keys[order]
    bounds = np.flatnonzero(np.diff(ks)) + 1
    starts = np.concatenate([[0], bounds]); ends = np.concatenate([bounds, [Q]])
    ref32 = ref.astype(np.float32); rn = (ref32 ** 2).sum(1)
    for s, e in zip(starts, ends):
        qi = order[s:e]
        c = qc[qi[0]]
        bmin = lo + c * cell - margin; bmax = lo + (c + 1) * cell + margin
        m = np.all((ref >= bmin) & (ref <= bmax), axis=1)
        cand = np.flatnonzero(m)
        if len(cand) < k:
            continue
        q32 = query[qi].astype(np.float32)
        d2 = (q32 ** 2).sum(1)[:, None] + rn[cand][None, :] - 2 * q32 @ ref32[cand].T
        kk = min(k, len(cand))
        part = np.argpartition(d2, kk - 1, axis=1)[:, :kk]
        pd = np.take_along_axis(d2, part, 1)
        o = np.argsort(pd, 1)
        part = np.take_along_axis(part, o, 1); pd = np.take_along_axis(pd, o, 1)
        out_d[qi, :kk] = np.sqrt(np.maximum(pd, 0)); out_i[qi, :kk] = cand[part]
    # anything whose k-th neighbour may lie outside the searched block: brute force
    bad = np.flatnonzero(out_d[:, -1] > margin)
    for s in range(0, len(bad), 256):
        qi = bad[s:s + 256]
        q32 = query[qi].astype(np.float32)
        d2 = (q32 ** 2).sum(1)[:, None] + rn[None, :] - 2 * q32 @ ref32.T
        part = np.argpartition(d2, k - 1, axis=1)[:, :k]
        pd = np.take_along_axis(d2, part, 1)
        o = np.argsort(pd, 1)
        out_i[qi] = np.take_along_axis(part, o, 1); out_d[qi] = np.sqrt(np.maximum(np.take_along_axis(pd, o, 1), 0))
    return out_d, out_i


class Surface:
    """Densely sampled triangle surface with interpolated normals and (optionally) dense bone weights."""
    def __init__(self, parts, spacing=0.003, bone_list=None, seed=1):
        rng = np.random.default_rng(seed)
        P = []; N = []; FN = []; TRI = []; WTS = []
        self.bone_list = bone_list
        bidx = {b: i for i, b in enumerate(bone_list or [])}
        for pos, nrm, tris, bones, weights in parts:
            a, b, c = pos[tris[:, 0]], pos[tris[:, 1]], pos[tris[:, 2]]
            cr = np.cross(b - a, c - a)
            area = np.linalg.norm(cr, axis=1) / 2
            fn = cr / (np.linalg.norm(cr, axis=1, keepdims=True) + 1e-15)
            # orient face normals like the vertex normals
            vn = nrm[tris].sum(1)
            fn *= np.where((fn * vn).sum(1) < 0, -1.0, 1.0)[:, None]
            n = np.maximum(1, np.round(area / spacing ** 2)).astype(np.int64)
            tid = np.repeat(np.arange(len(tris)), n)
            r1 = rng.random(len(tid)); r2 = rng.random(len(tid)); s = np.sqrt(r1)
            w = np.stack([1 - s, s * (1 - r2), s * r2], 1)
            # always include the vertices themselves too
            T = tris[tid]
            P.append((pos[T] * w[:, :, None]).sum(1))
            nn = (nrm[T] * w[:, :, None]).sum(1)
            N.append(nn / (np.linalg.norm(nn, axis=1, keepdims=True) + 1e-12))
            FN.append(fn[tid])
            if bone_list is not None:
                dense = np.zeros((len(pos), len(bone_list)), np.float32)
                for kk in range(bones.shape[1]):
                    for vi in np.flatnonzero(weights[:, kk] > 0):
                        dense[vi, bidx[bones[vi, kk]]] += weights[vi, kk]
                WTS.append((dense[T] * w[:, :, None].astype(np.float32)).sum(1))
        self.P = np.concatenate(P); self.N = np.concatenate(N); self.FN = np.concatenate(FN)
        self.W = np.concatenate(WTS) if WTS else None

    def closest(self, q, k=1):
        d, i = knn(q, self.P, k)
        return d, i

    def signed_distance(self, q):
        d, i = knn(q, self.P, 1)
        i = i[:, 0]
        s = ((q - self.P[i]) * self.FN[i]).sum(1)
        # far points: use plain distance with the sign of the normal test
        return s, i


def mesh_neighbors(tris, n):
    """Vertex adjacency as (rows, cols) arrays."""
    e = np.concatenate([tris[:, [0, 1]], tris[:, [1, 2]], tris[:, [2, 0]]])
    e = np.concatenate([e, e[:, ::-1]])
    e = np.unique(e, axis=0)
    return e[:, 0], e[:, 1]


def smooth_field(field, tris, n, iters=10, alpha=0.5, weld_pos=None):
    """Laplacian smoothing of a per-vertex field over a mesh (optionally welding vertices that share a position)."""
    r, c = mesh_neighbors(tris, n)
    if weld_pos is not None:
        key = np.round(weld_pos, 5)
        _, inv = np.unique(key, axis=0, return_inverse=True)
        inv = inv.reshape(-1)
        r = inv[r]; c = inv[c]; m = inv.max() + 1
        f = np.zeros((m, field.shape[1])); cnt = np.zeros(m)
        np.add.at(f, inv, field); np.add.at(cnt, inv, 1); f /= cnt[:, None]
    else:
        inv = None; m = n; f = field.copy()
    deg = np.bincount(r, minlength=m).astype(float)
    for _ in range(iters):
        acc = np.zeros_like(f); np.add.at(acc, r, f[c])
        avg = np.where(deg[:, None] > 0, acc / np.maximum(deg, 1)[:, None], f)
        f = (1 - alpha) * f + alpha * avg
    return f[inv] if inv is not None else f
