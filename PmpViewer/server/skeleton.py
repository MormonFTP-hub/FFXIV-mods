"""Skeletons (.sklb through the Havok tagfile reader), partial skeletons merged onto the base one, and the racial
bone deformer (human.pbd) the game uses when a race wears another race's model."""
import json
import os
import struct

import numpy as np

import game
from havok_tagfile import read_sklb
from xiv_skeleton import quat_to_mat

PBD = "chara/xls/boneDeformer/human.pbd"
_sklb = {}


def load_sklb(local):
    """[(name, parent name or None, 4x4 world bind matrix)] in file order (parents first)."""
    h = game.file_hash(local)
    disk = os.path.join(game.CACHE, h + ".sklb.json")
    cached = game.read_json(disk) if h not in _sklb else None
    if cached is not None:
        _sklb[h] = [(n, p, np.array(w)) for n, p, w in cached]
    if h not in _sklb:
        bones = read_sklb(local)
        world, out = [], []
        for name, parent, t, r, s in bones:
            m = np.eye(4)
            m[:3, :3] = quat_to_mat(r) * np.array(s)
            m[:3, 3] = t
            m = m if parent < 0 else world[parent] @ m
            world.append(m)
            out.append((name, bones[parent][0] if parent >= 0 else None, m))
        _sklb[h] = out
        os.makedirs(game.CACHE, exist_ok=True)
        game.write_json(disk, [(n, p, w.tolist()) for n, p, w in out])
    return _sklb[h]


class Skeleton:
    """Union of the base skeleton and partial ones (face, hair, hat, top). A partial skeleton's root bone shares its
    name with a base bone; the partial is re-rooted onto that bone's bind pose."""

    def __init__(self):
        self.names, self.parent, self.world, self.source = [], {}, {}, {}

    def add(self, bones, label):
        if not bones:
            return
        own = {n: w for n, _, w in bones}
        # anchor: the first bone of the partial that the skeleton already has
        anchor = next((n for n, _, _ in bones if n in self.world), None)
        fix = np.eye(4) if anchor is None else self.world[anchor] @ np.linalg.inv(own[anchor])
        for n, p, w in bones:
            if n in self.world:
                continue
            self.names.append(n)
            self.parent[n] = p
            self.world[n] = fix @ w
            self.source[n] = label

    def to_json(self):
        return {"names": self.names, "parents": [self.names.index(self.parent[n]) if self.parent[n] in self.world else -1
                                                 for n in self.names],
                "world": [self.world[n].T.reshape(-1).round(6).tolist() for n in self.names],   # column-major
                "source": [self.source[n] for n in self.names]}


_pbd = None


def deformers():
    """{race id: {"parent": race id | None, "bones": {name: 4x4}}} with the deform parents verified against the game's
    skeletons (women from c0201, men from c0101, Hrothgar man from c0901, Lalafell woman from c1101)."""
    global _pbd
    if _pbd is not None:
        return _pbd
    d = open(game.game_file(PBD), "rb").read()
    n = struct.unpack_from("<i", d, 0)[0]
    heads = [struct.unpack_from("<HHif", d, 4 + 12 * i) for i in range(n)]
    links = [struct.unpack_from("<HHHH", d, 4 + 12 * n + 8 * i) for i in range(n)]
    out = {}
    for i, (race, dix, off, scale) in enumerate(heads):
        bones = {}
        if off > 0:
            count = struct.unpack_from("<i", d, off)[0]
            name_offs = struct.unpack_from(f"<{count}H", d, off + 4)
            mat_off = off + 4 + 2 * count
            mat_off += (-mat_off) % 4
            for k in range(count):
                s = off + name_offs[k]
                name = d[s:d.index(b"\0", s)].decode()
                m = np.eye(4)
                m[:3, :] = np.array(struct.unpack_from("<12f", d, mat_off + 48 * k)).reshape(3, 4)
                bones[name] = m
        out[race] = {"index": i, "bones": bones, "link": links[i]}
    by_index = {v["index"]: r for r, v in out.items()}
    for r, v in out.items():
        p = v["link"][0]
        v["parent"] = by_index.get(p) if p != 0xFFFF and by_index.get(p) != r else None
        if r % 100 == 1 and r not in (101, 201):
            v["parent"] = {1501: 901, 1201: 1101}.get(r, 201 if (r // 100) % 2 == 0 else 101)
    _pbd = out
    return out


def chain(src, dst):
    """Per-bone 4x4 matrices taking race `src` (e.g. "c0101") bind space to race `dst`."""
    D = deformers()
    src, dst = int(src[1:]), int(dst[1:])
    up, r = [], src
    while r is not None:
        up.append(r)
        r = D[r]["parent"]
    r = dst
    while r is not None and r not in up:
        r = D[r]["parent"]
    if r is None:
        raise ValueError(f"{src} and {dst} share no ancestor")
    if r != src:
        down, back = _chain(D, r, dst), _chain(D, r, src)
        return {b: down.get(b, np.eye(4)) @ np.linalg.inv(back.get(b, np.eye(4))) for b in set(down) | set(back)}
    return _chain(D, src, dst)


def _chain(D, src, dst):
    path, r = [], dst
    while r is not None and r != src:
        path.append(r)
        r = D[r]["parent"]
    names = set().union(*(D[x]["bones"] for x in path)) if path else set()
    out = {}
    for b in names:
        m = np.eye(4)
        for x in reversed(path):
            m = D[x]["bones"].get(b, np.eye(4)) @ m
        out[b] = m
    return out


def deform_matrix(mats, bone, parents):
    """A bone without its own deformer entry uses its nearest ancestor's."""
    name = bone
    while name not in mats and parents.get(name):
        name = parents[name]
    return mats.get(name)
