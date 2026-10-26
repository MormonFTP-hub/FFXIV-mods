"""Dragonhawk mesh -> glTF for Penumbra's importer -> d0001e0001_dwn.mdl, plus empty hider models.

Kept WoW submeshes (wow.export "Geoset" numbers) and their FFXIV materials:
    a  feathers      G1   body texture, alpha-cut, glowing edges
    b  armour        G13  void quadrant of the saddle atlas (UVs remapped to the crop)
    c  void skin     G6, G7, G15  starfield, baked 4x2 tiled so no sampler wrap is needed
    d  eyes          G8
The rest are WoW additive effect cards (energy sheets, glow sprites) and are dropped.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from gltf_writer import write_glb  # noqa: E402
from wowsrc import ROOT, SCALE, Source, to_xiv_vec  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

XIVTOOL = ROOT / "apps/xivtool/xivtool.exe"
SKLB = ROOT / "work/mod/chara/demihuman/d0001/skeleton/base/b0001/skl_d0001b0001.sklb"
MODEL_DIR = "chara/demihuman/d0001/obj/equipment"
GLTF = ROOT / "work/gltf"
MOD = ROOT / "work/mod"

PARTS = {"a": [1], "b": [13], "c": [6, 7, 15], "d": [8]}
VOID_TILES = (4, 2)


def uv_fix(mat, uv):
    uv = uv.copy()
    if mat == "b":
        uv[:, 0] *= 2
        uv[:, 1] = (uv[:, 1] - 0.5) * 2
    elif mat == "c":
        uv -= np.floor(uv.min(0))
        assert uv[:, 0].max() <= VOID_TILES[0] and uv[:, 1].max() <= VOID_TILES[1], uv.max(0)
        uv /= np.array(VOID_TILES, float)
    return uv


def tangents(pos, nrm, uv, tri):
    """Per-vertex tangents from UV gradients (xyz + bitangent sign), for the normal maps."""
    p0, p1, p2 = pos[tri[:, 0]], pos[tri[:, 1]], pos[tri[:, 2]]
    w0, w1, w2 = uv[tri[:, 0]], uv[tri[:, 1]], uv[tri[:, 2]]
    e1, e2 = p1 - p0, p2 - p0
    d1, d2 = w1 - w0, w2 - w0
    r = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
    r = np.where(np.abs(r) < 1e-12, 1e-12, r)
    sdir = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) / r[:, None]
    tdir = (e2 * d1[:, 0:1] - e1 * d2[:, 0:1]) / r[:, None]
    tan = np.zeros_like(pos)
    bit = np.zeros_like(pos)
    for k in range(3):
        np.add.at(tan, tri[:, k], sdir)
        np.add.at(bit, tri[:, k], tdir)
    tan = tan - nrm * np.sum(nrm * tan, 1, keepdims=True)
    bad = np.linalg.norm(tan, axis=1) < 1e-8
    ref = np.where(np.abs(nrm[:, 1:2]) < 0.9, [[0.0, 1.0, 0.0]], [[1.0, 0.0, 0.0]])
    tan[bad] = np.cross(ref[bad], nrm[bad])
    tan /= np.linalg.norm(tan, axis=1, keepdims=True)
    sign = np.where(np.sum(np.cross(nrm, tan) * bit, 1) < 0, -1.0, 1.0)
    return np.hstack([tan, sign[:, None]])


def part_mesh(src, bone_of, mat, geosets):
    g = src.g
    pos_all, nrm_all, uv_all, j_all, w_all, idx_all = [], [], [], [], [], []
    base = 0
    for gi in geosets:
        p = g.j["meshes"][gi]["primitives"][0]
        tri = g.accessor(p["indices"]).ravel().astype(np.int64)
        used, inv = np.unique(tri, return_inverse=True)
        a = p["attributes"]
        pos_all.append(to_xiv_vec(g.accessor(a["POSITION"])[used].astype(float)) * SCALE)
        n = to_xiv_vec(g.accessor(a["NORMAL"])[used].astype(float))
        nrm_all.append(n / np.linalg.norm(n, axis=1, keepdims=True))
        uv_all.append(uv_fix(mat, g.accessor(a["TEXCOORD_0"])[used].astype(float)))
        jj = g.accessor(a["JOINTS_0"])[used].astype(int)
        ww = g.accessor(a["WEIGHTS_0"])[used].astype(float)
        ww[ww < 1e-3] = 0
        ww /= ww.sum(1, keepdims=True)
        j_all.append(np.vectorize(lambda k: bone_of.get(k, 0))(jj) * (ww > 0))
        w_all.append(ww)
        idx_all.append(inv + base)
        base += len(used)
    pos, nrm, uv = np.concatenate(pos_all), np.concatenate(nrm_all), np.concatenate(uv_all)
    tri = np.concatenate(idx_all).reshape(-1, 3)
    return {"positions": pos, "normals": nrm, "uvs": uv, "tangents": tangents(pos, nrm, uv, tri),
            "colors": np.ones((len(pos), 4)), "joints": np.concatenate(j_all), "weights": np.concatenate(w_all),
            "indices": tri.ravel()}


MAX_BONES = 128   # Penumbra's importer limit per mesh


def bone_count(m):
    return len(set(m["joints"][m["weights"] > 0].tolist()))


def submesh(m, tris):
    used, inv = np.unique(tris.ravel(), return_inverse=True)
    out = {k: (v[used] if isinstance(v, np.ndarray) and len(v) == len(m["positions"]) else v) for k, v in m.items()}
    out["indices"] = inv
    return out


def split(m, axis=0):
    """Halve a mesh (by triangle centre along x, then z) until each piece fits MAX_BONES."""
    if bone_count(m) <= MAX_BONES:
        return [m]
    tris = m["indices"].reshape(-1, 3)
    c = m["positions"][tris].mean(1)[:, axis]
    cut = 0.0 if axis == 0 else np.median(c)
    halves = [submesh(m, tris[c >= cut]), submesh(m, tris[c < cut])]
    return [p for h in halves for p in split(h, 2)]


def run(*args):
    out = subprocess.run([str(XIVTOOL), *map(str, args)], capture_output=True, text=True)
    if out.returncode != 0 or "wrote" not in out.stdout:
        raise RuntimeError(out.stdout + out.stderr)
    for line in out.stdout.splitlines():
        print("   ", line)


def empty_mesh(material, bone):
    return {"name": "empty_0.0", "material": material, "positions": np.array([[0, 1.6, 0]] * 3, float),
            "normals": np.array([[0, 1, 0]] * 3, float), "uvs": np.zeros((3, 2)), "colors": np.ones((3, 4)),
            "joints": np.array([[bone, 0, 0, 0]] * 3), "weights": np.array([[1, 0, 0, 0]] * 3, float),
            "indices": np.array([0, 1, 2])}


def main():
    src = Source()
    skel = json.loads((ROOT / "work/skeleton.json").read_text())
    bone_of = {k: skel["names"].index(n) for n, k in skel["source_joint"].items()}
    sk = Skeleton(str(SKLB))
    GLTF.mkdir(parents=True, exist_ok=True)
    meshes = []
    for mat, geosets in PARTS.items():
        for m in split(part_mesh(src, bone_of, mat, geosets)):
            m["name"] = f"dragonhawk_{len(meshes)}.0"
            m["material"] = f"/mt_d0001e0001_dwn_{mat}.mtrl"
            print(f"mesh {len(meshes)} ({mat}): {len(m['positions'])} verts, {len(m['indices']) // 3} tris, {bone_count(m)} bones")
            meshes.append(m)
    write_glb(GLTF / "dwn.glb", sk, meshes)
    out = MOD / MODEL_DIR / "e0001/model/d0001e0001_dwn.mdl"
    out.parent.mkdir(parents=True, exist_ok=True)
    run("import", GLTF / "dwn.glb", out)

    root = skel["names"].index("n_root")
    for slot in ("met", "top", "sho"):
        write_glb(GLTF / f"empty_{slot}.glb", sk, [empty_mesh(f"/mt_d0001e0001_{slot}_a.mtrl", root)])
        run("import", GLTF / f"empty_{slot}.glb", ROOT / f"work/empty_{slot}.mdl")


if __name__ == "__main__":
    main()
