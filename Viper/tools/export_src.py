"""Unpack the Kingdom Archives Viper glb (plain glTF, textures beside it as PNG) into numpy / PNG files under work/src.

work/src/scene.json      materials (name, viewer textures), skins (joint names, parents, bind world matrices),
                         poses (joint world matrices at frame 0 of each viewer animation)
work/src/mesh_body.npz   every primitive merged: pos, nrm, uv0..2, col (COLOR_0), joints (N,8), weights (N,8), faces,
                         mat (per tri), prim (per tri, glTF order), vid (welded vertex id)
work/src/tex/<name>.png  the viewer's textures (df/nm/orm/em for body, hair_*, props_*, eye_df)

The viewer draws every material as PBR with its df/nm/orm/em on UV0, plus TP_Core_Eye_MI with the shared eye_df.
Its animations "Idle" (A pose, masked), "Idle_Mask_Off" and "Idle_Ult" only move bones, so each is kept as a pose.
glTF is already in FFXIV axes (metres, Y up, +Z forward, +X = character's left), so nothing is rotated here.
"""
import json
import os
import shutil
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glb import Glb  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "source")
SRC = os.path.join(ROOT, "work", "src")
MODEL = os.path.join(SOURCE, "viper_cs.glb")
# from the page's MODEL_JSON
TEXTURES = {"CS_Pandemic_S0_MI": dict(color="df", normal="nm", orm="orm", emissive="em"),
            "CS_Pandemic_S0_Hair_MI": dict(color="hair_df", normal="hair_nm", orm="hair_orm", emissive="hair_em"),
            "Pandemic_S0_TP_Props_MI": dict(color="props_df", normal="props_nm", orm="props_orm",
                                            emissive="props_em"),
            "TP_Core_Eye_MI": dict(color="eye_df")}


def trs(t, r, s):
    x, y, z, w = r
    m = np.eye(4)
    m[:3, :3] = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                          [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                          [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]) * s
    m[:3, 3] = t
    return m


def poses(g, parent):
    """{animation: [world 4x4 per node]} at the first keyframe."""
    nodes = g.g["nodes"]
    out = {}
    for a in g.g.get("animations", []):
        t = {i: list(nd.get("translation", [0, 0, 0])) for i, nd in enumerate(nodes)}
        r = {i: list(nd.get("rotation", [0, 0, 0, 1])) for i, nd in enumerate(nodes)}
        s = {i: list(nd.get("scale", [1, 1, 1])) for i, nd in enumerate(nodes)}
        for ch in a["channels"]:
            v = g.accessor(a["samplers"][ch["sampler"]]["output"])[0]
            n, path = ch["target"]["node"], ch["target"]["path"]
            {"translation": t, "rotation": r, "scale": s}[path][n] = list(v)
        local = [trs(t[i], r[i], s[i]) for i in range(len(nodes))]
        world = [None] * len(nodes)

        def wm(i):
            if world[i] is None:
                world[i] = local[i] if parent[i] < 0 else wm(parent[i]) @ local[i]
            return world[i]
        out[a["name"]] = [wm(i).tolist() for i in range(len(nodes))]
    return out


def main():
    os.makedirs(os.path.join(SRC, "tex"), exist_ok=True)
    for f in os.listdir(os.path.join(SOURCE, "textures")):
        shutil.copy(os.path.join(SOURCE, "textures", f), os.path.join(SRC, "tex", f))
    g = Glb(MODEL)
    parent, local, world = g.node_matrices()
    nodes = g.g["nodes"]
    mats = [{"name": m.get("name"), "doubleSided": m.get("doubleSided"), "textures": TEXTURES.get(m.get("name"), {})}
            for m in g.g["materials"]]
    anim = poses(g, parent)
    skins = []
    for s in g.g["skins"]:
        joints = s["joints"]
        jset = set(joints)
        ibm = g.accessor(s["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
        skins.append({"joints": [nodes[j].get("name") for j in joints],
                      "parents": [nodes[parent[j]].get("name") if parent[j] >= 0 and parent[j] in jset else None
                                  for j in joints],
                      "bind": np.linalg.inv(ibm).tolist(), "rest": [world[j].tolist() for j in joints],
                      "poses": {k: [v[j] for j in joints] for k, v in anim.items()}})
    arr = {k: [] for k in ("pos", "nrm", "uv0", "uv1", "uv2", "col", "joints", "weights", "faces", "mat", "prim")}
    base, prim, meshes = 0, 0, []
    for ni, nd in enumerate(nodes):
        if "mesh" not in nd:
            continue
        me = g.g["meshes"][nd["mesh"]]
        meshes.append({"name": me.get("name"), "skin": nd.get("skin"), "node_world": world[ni].tolist(),
                       "prims": len(me["primitives"])})
        for p in me["primitives"]:
            a = p["attributes"]
            n = g.accessor(a["POSITION"]).shape[0]
            arr["pos"].append(g.accessor(a["POSITION"]))
            arr["nrm"].append(g.accessor(a["NORMAL"]))
            for k in range(3):
                arr[f"uv{k}"].append(g.accessor(a[f"TEXCOORD_{k}"]) if f"TEXCOORD_{k}" in a else np.zeros((n, 2)))
            c = g.accessor(a["COLOR_0"]) if "COLOR_0" in a else np.ones((n, 4))
            arr["col"].append(np.c_[c, np.ones(n)] if c.shape[1] == 3 else c)
            J = [g.accessor(a[k], normalize=False) for k in ("JOINTS_0", "JOINTS_1") if k in a]
            W = [g.accessor(a[k]) for k in ("WEIGHTS_0", "WEIGHTS_1") if k in a]
            arr["joints"].append(np.hstack(J + [np.zeros((n, 8 - 4 * len(J)))]).astype(np.int32))
            arr["weights"].append(np.hstack(W + [np.zeros((n, 8 - 4 * len(W)))]).astype(np.float32))
            idx = g.accessor(p["indices"], normalize=False).reshape(-1, 3).astype(np.int64)
            arr["faces"].append(idx + base)
            arr["mat"].append(np.full(len(idx), p.get("material", -1)))
            arr["prim"].append(np.full(len(idx), prim))
            base += n
            prim += 1
    out = {k: np.concatenate(v) for k, v in arr.items()}
    _, out["vid"] = np.unique(np.round(out["pos"], 5), axis=0, return_inverse=True)
    out["vid"] = out["vid"].ravel()
    np.savez_compressed(os.path.join(SRC, "mesh_body.npz"), **out)
    lo, hi = out["pos"].min(0), out["pos"].max(0)
    print(f"body: {len(out['pos'])} verts {len(out['faces'])} tris, {prim} primitives, bbox {np.round(lo, 3)}.."
          f"{np.round(hi, 3)}, weights/vertex max {(out['weights'] > 0).sum(1).max()}")
    json.dump({"materials": mats, "skins": skins, "meshes": meshes}, open(os.path.join(SRC, "scene.json"), "w"),
              indent=1)
    print(f"{len(mats)} materials, poses {list(anim)} -> {SRC}")


if __name__ == "__main__":
    main()
