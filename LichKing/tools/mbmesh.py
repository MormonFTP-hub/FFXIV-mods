"""Read the Lich King scene out of lichking.mb and replay its polygon history.

The final meshes in the scene (lichkingShape, frostmourneShape) have no stored geometry: Maya rebuilds them
from the intermediate shapes through ~55 history nodes. This module decodes the stored data
(MESH blobs, skinCluster weights, joint bind matrices, component lists) and re-evaluates the history
at the bind pose, tracking for every face its source face, UVs and shading groups.

Coordinates stay in Maya mesh-local space (cm, Y up) until src.py converts them.
"""
import struct
from collections import defaultdict

import numpy as np

import mb

SCENE = None


def load(path):
    global SCENE
    buf, root = mb.load(path)
    SCENE = dict(buf=buf, root=root, nodes=mb.nodes(buf, root), cons=mb.connections(buf, root))
    return SCENE


def node_attrs(name):
    t, n = SCENE["nodes"][name]
    return {a[1]: a for a in mb.attrs(SCENE["buf"], n)}


def upstream(plug_dst):
    for a, b in SCENE["cons"]:
        if b == plug_dst:
            return a
    return None


# ----------------------------------------------------------------------------- decoders

def read_mesh_blob(data):
    """Maya 'MESH' attribute payload -> dict(P (V,3), faces [[v...]], fuv [[uv...]], uv (U,2), soft (E,))."""
    p = 0

    def u32():
        nonlocal p
        v = struct.unpack_from(">I", data, p)[0]
        p += 4
        return v

    nv = u32()
    P = np.frombuffer(data, ">f4", nv, p).reshape(-1, 3).astype(float)
    p += 4 * nv
    ne = u32()
    E = np.frombuffer(data, ">u4", ne, p).reshape(-1, 2).astype(np.int64)
    p += 4 * ne
    nfe = u32()
    FE = np.frombuffer(data, ">u4", nfe, p).astype(np.int64)
    p += 4 * nfe
    nn = u32()
    p += 4 * nn
    if nn:
        extra = u32()  # (not "p += 4 * u32()": the old p would be read before u32 moves it)
        p += 4 * extra
    nsets = u32()
    uvsets = []
    for _ in range(nsets):
        u32()
        e = data.index(b"\0", p)
        name = data[p:e].decode()
        p = e + 1
        c = u32()
        uv = np.frombuffer(data, ">f4", c, p).reshape(-1, 2).astype(float)
        p += 4 * c
        c = u32()
        idx = np.frombuffer(data, ">u4", c, p).astype(np.int64)
        p += 4 * c
        uvsets.append((name, uv, idx))
    soft = (E[:, 0] >> 31) & 1
    ev = E & 0x7FFFFFFF
    faces, cur = [], []
    for w in FE:
        ei = w & 0x1FFFFFFF
        a, b = ev[ei]
        cur.append(b if (w >> 31) & 1 else a)
        if (w >> 29) & 3:
            faces.append(cur)
            cur = []
    assert not cur
    name, uv, idx = uvsets[0]
    fuv, k = [], 0
    for f in faces:
        fuv.append(list(idx[k:k + len(f)]))
        k += len(f)
    assert k == len(idx)
    return dict(P=P, faces=faces, fuv=fuv, uv=uv, edges=ev, soft=soft)


def components(attr):
    """CMP# payload -> {'f'|'v'|'e': sorted int array}. A range starting at -1 means 'all N'."""
    tag, name, flag, data = attr
    p = 0
    n = struct.unpack_from(">I", data, p)[0]
    p += 4
    out = {}
    for _ in range(n):
        kind = {b"CMDF": "f", b"CMDV": "v", b"CMDE": "e", b"CMDU": "uv"}[data[p:p + 4]]
        cnt = struct.unpack_from(">I", data, p + 4)[0]
        p += 8
        ids = []
        for i in range(cnt):
            a, b = struct.unpack_from(">ii", data, p)
            p += 8
            ids.append(("all", b) if a == -1 else np.arange(a, b + 1))
        if len(ids) == 1 and isinstance(ids[0], tuple):
            out[kind] = ids[0]
        else:
            out[kind] = np.concatenate(ids) if ids else np.zeros(0, np.int64)
    return out


def dbl(name, attr, default=None):
    a = node_attrs(name).get(attr)
    if a is None:
        return default
    return struct.unpack(">d", a[3][:8])[0]


def matr(attr):
    return np.frombuffer(attr[3][:128], ">f8").reshape(4, 4).copy()


def skin_weights(cluster, nverts):
    """(nverts, nmat) dense weights and the joint name for every matrix slot."""
    at = node_attrs(cluster)
    key = next(k for k in at if k.startswith("wl[0:") and k.endswith("].w"))
    data = at[key][3]
    joints = {}
    for a, b in SCENE["cons"]:
        if b.startswith(cluster + ".ma["):
            joints[int(b[len(cluster) + 4:-1])] = a.split(".")[0]
    W = np.zeros((nverts, max(joints) + 1))
    p = 0
    for v in range(nverts):
        c = struct.unpack_from(">I", data, p)[0]
        p += 4
        for _ in range(c):
            j, w = struct.unpack_from(">Id", data, p)
            p += 12
            W[v, j] = w
    assert p == len(data), (p, len(data))
    pm = {int(k[3:-1]): matr(a) for k, a in at.items() if k.startswith("pm[")}
    return W, [joints[i] for i in range(len(joints))], pm, matr(at["gm"])


def joints():
    """{name: (parent, bind world matrix (Maya row-vector convention))} for every joint."""
    out = {}
    for name, (t, n) in SCENE["nodes"].items():
        if t != b"JOIN":
            continue
        _, _, parent = mb.crea(SCENE["buf"], n)
        bps = node_attrs(name).get("bps")
        out[name] = (parent, matr(bps) if bps else None)
    return out


# ----------------------------------------------------------------------------- mesh state

class Mesh:
    """Polygon soup with shared vertex ids, per-corner UV ids, per-vertex skin weights,
    and per-face source id + shading-group bitmask."""

    def __init__(self, blob, W=None):
        self.P = [np.array(p) for p in blob["P"]]
        self.W = [w for w in W] if W is not None else None
        self.faces = [list(f) for f in blob["faces"]]
        self.fuv = [list(f) for f in blob["fuv"]]
        self.uv = blob["uv"]
        self.src = list(range(len(self.faces)))
        self.groups = [0] * len(self.faces)
        self.log = []
        # Maya's edge numbering is only known for the stored mesh, and its vertex numbering only until
        # the first op that removes vertices; ops that need either become no-ops after that.
        self.edges = blob["edges"]
        self.vertex_ids_exact = True

    smooth = None  # polySmoothFace settings, applied after the history (see unsmooth)

    # -- helpers
    def unsmooth(self, comp):
        """After a deferred one-level smooth, map sub-face ids (n per n-gon, in face order) back to faces.
        Only whole faces may be selected."""
        if self.smooth is None or isinstance(comp.get("f"), tuple) or "f" not in comp:
            return comp
        assert self.smooth["dv"] == 1
        sizes = np.array([len(f) for f in self.faces])
        start = np.concatenate([[0], np.cumsum(sizes)])
        owner = np.repeat(np.arange(len(sizes)), sizes)
        sub = comp["f"]
        faces = np.unique(owner[sub])
        whole = sizes[faces].sum()
        assert whole == len(np.unique(sub)), f"partial faces selected: {len(sub)} sub-faces vs {whole}"
        return {"f": faces}

    def face_ids(self, comp):
        f = comp["f"]
        if isinstance(f, tuple):
            assert f[1] == len(self.faces), (f, len(self.faces))
            return np.arange(len(self.faces))
        assert f.max() < len(self.faces), (f.max(), len(self.faces))
        return f

    def new_vertex(self, p, w):
        self.P.append(np.array(p, float))
        if self.W is not None:
            self.W.append(np.array(w))
        return len(self.P) - 1

    def keep_faces(self, keep):
        keep = np.asarray(keep, bool)
        self.edges = None
        if not keep.all():
            self.vertex_ids_exact = False
        for name in ("faces", "fuv", "src", "groups"):
            setattr(self, name, [x for x, k in zip(getattr(self, name), keep) if k])
        self.compact_vertices()

    def compact_vertices(self):
        used = sorted({v for f in self.faces for v in f})
        remap = {v: i for i, v in enumerate(used)}
        self.P = [self.P[v] for v in used]
        if self.W is not None:
            self.W = [self.W[v] for v in used]
        self.faces = [[remap[v] for v in f] for f in self.faces]

    def drop_degenerate(self):
        """Remove repeated corners; faces left with < 3 distinct corners go."""
        keep = []
        for i, f in enumerate(self.faces):
            nf, nu = [], []
            for k, v in enumerate(f):
                if not nf or nf[-1] != v:
                    nf.append(v)
                    nu.append(self.fuv[i][k])
            if len(nf) > 1 and nf[0] == nf[-1]:
                nf.pop()
                nu.pop()
            self.faces[i], self.fuv[i] = nf, nu
            keep.append(len(set(nf)) >= 3)
        n = len(keep) - sum(keep)
        self.keep_faces(keep)
        return n

    # -- Maya nodes
    def group_parts(self, gid, add=None, remove=None):
        """Face-set membership (shading groups). Vertex sets (deformer membership) are ignored."""
        add = add if add is not None and "f" in add else None
        remove = remove if remove is not None and "f" in remove else None
        if add is not None:
            for f in self.face_ids(add):
                self.groups[f] |= 1 << gid
        if remove is not None:
            for f in self.face_ids(remove):
                self.groups[f] &= ~(1 << gid)

    def corners_of(self, v):
        """(face, corner) pairs that use vertex v."""
        return [(i, k) for i, f in enumerate(self.faces) for k, x in enumerate(f) if x == v]

    def vertex_users(self):
        users = defaultdict(list)
        for i, f in enumerate(self.faces):
            for k, x in enumerate(f):
                users[x].append((i, k))
        return users

    def split_vertices(self, vids):
        """polySplitVert: every face using the vertex gets its own copy (the first one keeps the id)."""
        users = self.vertex_users()
        for v in vids:
            for i, k in users.get(int(v), [])[1:]:
                self.faces[i][k] = self.new_vertex(self.P[v], self.W[v] if self.W is not None else None)

    def split_edges(self, pairs):
        """polySplitEdge: the listed edges (vertex pairs) become borders. Around each touched vertex the
        faces fall into fans separated by split or border edges; every fan after the first gets a copy."""
        cut = {(min(a, b), max(a, b)) for a, b in pairs}
        users = self.vertex_users()
        touched = sorted({v for e in cut for v in e})
        for v in touched:
            corners = users.get(v, [])
            if len(corners) < 2:
                continue
            # union faces around v that share a non-cut edge at v
            parent = {c: c for c in corners}

            def find(a):
                while parent[a] != a:
                    parent[a] = parent[parent[a]]
                    a = parent[a]
                return a

            by_edge = defaultdict(list)
            for i, k in corners:
                f = self.faces[i]
                for o in (f[(k + 1) % len(f)], f[k - 1]):
                    by_edge[o].append((i, k))
            for o, cs in by_edge.items():
                if (min(v, o), max(v, o)) in cut:
                    continue
                for c in cs[1:]:
                    parent[find(c)] = find(cs[0])
            fans = defaultdict(list)
            for c in corners:
                fans[find(c)].append(c)
            for fan in sorted(fans.values())[1:]:
                nv = self.new_vertex(self.P[v], self.W[v] if self.W is not None else None)
                for i, k in fan:
                    self.faces[i][k] = nv

    def chip_off(self, comp):
        """polyChipOff, keepFacesTogether off, no duplicate: every listed face gets its own corners."""
        for f in self.face_ids(comp):
            self.faces[f] = [self.new_vertex(self.P[v], self.W[v] if self.W is not None else None)
                             for v in self.faces[f]]
        self.edges = None

    def collapse(self, comp):
        """polyCollapseFacet: one face at a time in index order, each shrinks to its centroid; neighbours
        left degenerate are removed, and a listed face that already went is skipped (this reproduces the
        face counts Maya stored downstream)."""
        dead = set()
        for c in sorted(self.face_ids(comp).tolist()):
            if c in dead:
                continue
            vs = set(self.faces[c])
            nv = self.new_vertex(np.mean([self.P[v] for v in vs], 0),
                                 np.mean([self.W[v] for v in vs], 0) if self.W is not None else None)
            dead.add(c)
            for i, f in enumerate(self.faces):
                if i in dead or not vs.intersection(f):
                    continue
                self.faces[i] = [nv if v in vs else v for v in f]
                if len(set(self.faces[i])) < 3:
                    dead.add(i)
        self.keep_faces([i not in dead for i in range(len(self.faces))])
        self.drop_degenerate()
        return len(dead)

    def delete(self, comp):
        ids = set(self.face_ids(comp).tolist())
        self.keep_faces([i not in ids for i in range(len(self.faces))])

    def merge(self, dist):
        """polyMergeVertex over all vertices: weld everything closer than dist (single-link)."""
        P = np.array(self.P)
        d = max(dist, 1e-6)
        key = np.floor(P / d).astype(np.int64)
        cells = defaultdict(list)
        for i, k in enumerate(map(tuple, key)):
            cells[k].append(i)
        parent = list(range(len(P)))

        def find(a):
            while parent[a] != a:
                parent[a] = parent[parent[a]]
                a = parent[a]
            return a

        offs = [(i, j, k) for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1)]
        for c, vs in cells.items():
            cand = [w for o in offs for w in cells.get((c[0] + o[0], c[1] + o[1], c[2] + o[2]), ())]
            for v in vs:
                for w in cand:
                    if w > v and np.linalg.norm(P[v] - P[w]) <= dist:
                        parent[find(w)] = find(v)
        roots = [find(i) for i in range(len(P))]
        self.faces = [[roots[v] for v in f] for f in self.faces]
        return self.drop_degenerate()

    def conform(self):
        """polyNormal conform: orient each edge-connected shell consistently, keeping the majority winding."""
        edge_faces = defaultdict(list)
        for i, f in enumerate(self.faces):
            for k in range(len(f)):
                a, b = f[k], f[(k + 1) % len(f)]
                edge_faces[(min(a, b), max(a, b))].append((i, a < b))
        seen = [False] * len(self.faces)
        flipped = 0
        for s in range(len(self.faces)):
            if seen[s]:
                continue
            seen[s] = True
            flip = {s: False}
            stack = [s]
            while stack:
                i = stack.pop()
                f = self.faces[i]
                for k in range(len(f)):
                    a, b = f[k], f[(k + 1) % len(f)]
                    e = edge_faces[(min(a, b), max(a, b))]
                    if len(e) != 2:
                        continue
                    (j, dj) = e[0] if e[1][0] == i else e[1]
                    if j == i or seen[j]:
                        continue
                    di = (a < b)
                    # consistent neighbours traverse the shared edge in opposite directions
                    flip[j] = flip[i] ^ (di == dj)
                    seen[j] = True
                    stack.append(j)
            if sum(flip.values()) * 2 > len(flip):
                flip = {k: not v for k, v in flip.items()}
            for i, fl in flip.items():
                if fl:
                    self.faces[i].reverse()
                    self.fuv[i].reverse()
                    flipped += 1
        return flipped

    def summary(self):
        return f"{len(self.faces)} faces, {len(self.P)} verts"


def apply_history(mesh, chain, smooth=True):
    """Replay a list of history node names on mesh (bind pose). smooth=False skips polySmoothFace."""
    for name in chain:
        t = SCENE["nodes"][name][0]
        at = node_attrs(name)
        before = len(mesh.faces)
        note = ""
        if t == b"GRPP":
            gid = group_id(upstream(f"{name}.gi").split(".")[0])
            mesh.group_parts(gid, mesh.unsmooth(components(at["ic"])) if "ic" in at else None,
                             mesh.unsmooth(components(at["irc"])) if "irc" in at else None)
        elif t == b"PNOR":
            assert dbl(name, "nm") == 2  # conform
            note = f"flipped {mesh.conform()}"
        elif t == b"PSED" and mesh.edges is not None:
            e = components(at["ics"])["e"]
            mesh.split_edges([mesh.edges[i] for i in e])
            note = f"{len(e)} edges"
        elif t == b"PSVE" and mesh.vertex_ids_exact:
            v = components(at["ics"])["v"]
            mesh.split_vertices(v)
            note = f"{len(v)} verts"
        elif t in (b"PSED", b"PSVE", b"PMAC", b"FMPT", b"PNPV"):
            note = "no-op"  # topology / UV splits that the later welds undo, normals, tweaks
        elif t == b"PCHI":
            assert dbl(name, "dup", 1.0) == 0 and dbl(name, "kft", 1.0) == 0
            mesh.chip_off(components(at["ics"]))
        elif t == b"PCOF":
            note = f"removed {mesh.collapse(components(at['ics']))}"
        elif t == b"DECT":
            mesh.delete(mesh.unsmooth(components(at["dc"])))
        elif t == b"PSMF":
            assert isinstance(components(at["ics"])["f"], tuple)
            c, dv = dbl(name, "c", 1.0), int(dbl(name, "dv", 1.0))
            if smooth:
                assert dv == 1
                subdivide(mesh, c)
                note = f"continuity {c:.3f}"
            else:
                mesh.smooth = dict(c=c, dv=dv)  # later face ids are mapped back by unsmooth()
                note = "skipped"
        elif t == b"PMVE":
            comp = components(at["ics"])["v"]
            d = dbl(name, "d", 0.0)
            note = f"d={d} {'all' if isinstance(comp, tuple) else f'{len(comp)} listed'}, removed {mesh.merge(d)}"
        else:
            raise NotImplementedError(f"{name} {t}")
        mesh.log.append(f"{name:22s} {t.decode():5s} {before:5d} -> {len(mesh.faces):5d} faces  {note}")
    return mesh


GROUP_BITS = {}


def group_id(gid_node):
    """groupId nodes get their ids at load time, so number them in order of first use."""
    if gid_node not in GROUP_BITS:
        GROUP_BITS[gid_node] = len(GROUP_BITS)
    return GROUP_BITS[gid_node]


def history_chain(shape_input_plug, stop):
    """Node names from the first history node after `stop` down to the shape, in evaluation order."""
    chain = []
    plug = upstream(shape_input_plug)
    while plug:
        node = plug.split(".")[0]
        if node == stop:
            break
        chain.append(node)
        t = SCENE["nodes"][node][0]
        nxt = None
        for a, b in SCENE["cons"]:
            if b.split(".")[0] == node and b.split(".", 1)[1] in ("ip", "ig", "ip[0].ig", "inputPolymesh", "inputGeometry"):
                nxt = a
        plug = nxt
    return chain[::-1]


# ----------------------------------------------------------------------------- polySmoothFace

def subdivide(mesh, c):
    """One Catmull-Clark level (Maya polySmoothFace, divisions 1, keep border, continuity c): every n-gon
    becomes n quads in face order. Positions blend between linear (c=0) and full smoothing (c=1);
    UVs and skin weights are interpolated linearly."""
    P = np.array(mesh.P)
    W = np.array(mesh.W) if mesh.W is not None else None
    uv = mesh.uv
    edge_faces = defaultdict(list)
    vert_faces = defaultdict(list)
    vert_edges = defaultdict(set)
    for i, f in enumerate(mesh.faces):
        for k in range(len(f)):
            a, b = f[k], f[(k + 1) % len(f)]
            e = (min(a, b), max(a, b))
            edge_faces[e].append(i)
            vert_faces[a].append(i)
            vert_edges[a].add(e)
            vert_edges[b].add(e)
    fp = np.array([P[f].mean(0) for f in mesh.faces])
    ep = {}
    for e, fs in edge_faces.items():
        mid = (P[e[0]] + P[e[1]]) / 2
        if len(fs) == 2:
            mid = mid + c * ((P[e[0]] + P[e[1]] + fp[fs[0]] + fp[fs[1]]) / 4 - mid)
        ep[e] = mid
    vp = P.copy()
    for v, fs in vert_faces.items():
        es = vert_edges[v]
        if any(len(edge_faces[e]) != 2 for e in es) or len(es) != len(fs):
            continue  # border / non-manifold vertex: keep border
        n = len(fs)
        Q = fp[fs].mean(0)
        R = np.mean([(P[a] + P[b]) / 2 for a, b in es], 0)
        vp[v] = P[v] + c * ((Q + 2 * R + (n - 3) * P[v]) / n - P[v])
    # new vertex table: old vertices, then edge points, then face points
    nP = [vp[i] for i in range(len(P))]
    nW = [W[i] for i in range(len(P))] if W is not None else None
    eid = {}
    for e in edge_faces:
        eid[e] = len(nP)
        nP.append(ep[e])
        if nW is not None:
            nW.append((W[e[0]] + W[e[1]]) / 2)
    nuv = [u for u in uv]
    faces, fuv, src, groups = [], [], [], []
    for i, f in enumerate(mesh.faces):
        fi = len(nP)
        nP.append(fp[i])
        if nW is not None:
            nW.append(W[f].mean(0))
        cu = [uv[u] for u in mesh.fuv[i]]
        fu = len(nuv)
        nuv.append(np.mean(cu, 0))
        n = len(f)
        for k in range(n):
            a, b, z = f[k], f[(k + 1) % n], f[k - 1]
            e1, e0 = (min(a, b), max(a, b)), (min(a, z), max(a, z))
            u1 = len(nuv)
            nuv.append((cu[k] + cu[(k + 1) % n]) / 2)
            u0 = len(nuv)
            nuv.append((cu[k] + cu[k - 1]) / 2)
            faces.append([a, eid[e1], fi, eid[e0]])
            fuv.append([mesh.fuv[i][k], u1, fu, u0])
            src.append(mesh.src[i])
            groups.append(mesh.groups[i])
    mesh.P, mesh.W, mesh.faces, mesh.fuv, mesh.src, mesh.groups = nP, nW, faces, fuv, src, groups
    mesh.uv = np.array(nuv)
    mesh.smooth = None
    return mesh
