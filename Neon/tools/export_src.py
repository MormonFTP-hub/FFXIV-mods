"""Unpack the Kingdom Archives Neon glb (plain buffers) and its PNG textures into work/src.

work/src/scene.json         materials (name, texture slots), skins (joint names, parents, bind world matrices)
work/src/mesh_<n>.npz        per mesh: pos, nrm, uv0..2, col, joints (N,8), weights (N,8), faces, mat (per tri), vid
work/src/tex/<name>.png      the viewer's textures (source/*.png), copied

The glb is already in FFXIV axes (metres, Y up, +Z forward, +X = character's left); its root's quarter turn about Y
(the viewer's camera framing) is left out, so the bind pose is the skin's inverse bind matrices.
"""
import json
import os
import re
import shutil
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glb import Glb  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "source")
SRC = os.path.join(ROOT, "work", "src")
MODEL = "neon_cs.glb"
# material -> the viewer's textures for it (uploads/models/agents/neon/textures/, agents/eye_df.png)
TEXTURES = {"CS_Sprinter_S0_MI": {"color": "df", "normal": "nm", "orm": "orm", "emissive": "em"},
            "CS_Sprinter_S0_Hair_MI": {"color": "hair_df", "normal": "hair_nm", "orm": "hair_orm",
                                       "emissive": "hair_em"},
            "TP_Core_Eye_MI": {"color": "eye_df"}}


def safe(name):
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", name)


def main():
    os.makedirs(os.path.join(SRC, "tex"), exist_ok=True)
    for f in os.listdir(SOURCE):
        if f.endswith(".png"):
            shutil.copyfile(os.path.join(SOURCE, f), os.path.join(SRC, "tex", f))
    g = Glb(os.path.join(SOURCE, MODEL))
    parent, local, world = g.node_matrices()
    nodes = g.g["nodes"]
    mats = [{"name": m.get("name"), "doubleSided": m.get("doubleSided"), "pbr": m.get("pbrMetallicRoughness"),
             "textures": TEXTURES.get(m.get("name"), {})} for m in g.g["materials"]]
    skins = []
    for s in g.g["skins"]:
        joints = s["joints"]
        ibm = g.accessor(s["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
        bind = np.linalg.inv(ibm)
        jset = set(joints)
        skins.append({"joints": [nodes[j].get("name") for j in joints],
                      "parents": [nodes[parent[j]].get("name") if parent[j] >= 0 and parent[j] in jset else None
                                  for j in joints],
                      "bind": bind.tolist(), "rest": [world[j].tolist() for j in joints]})
    meshes = []
    for ni, nd in enumerate(nodes):
        if "mesh" not in nd:
            continue
        me = g.g["meshes"][nd["mesh"]]
        arr = {k: [] for k in ("pos", "nrm", "uv0", "uv1", "uv2", "col", "joints", "weights", "faces", "mat")}
        base = 0
        for p in me["primitives"]:
            a = p["attributes"]
            n = g.accessor(a["POSITION"]).shape[0]
            arr["pos"].append(g.accessor(a["POSITION"]))
            arr["nrm"].append(g.accessor(a["NORMAL"]))
            for k in range(3):
                arr[f"uv{k}"].append(g.accessor(a[f"TEXCOORD_{k}"]) if f"TEXCOORD_{k}" in a else np.zeros((n, 2)))
            arr["col"].append(g.accessor(a["COLOR_0"]) if "COLOR_0" in a else np.ones((n, 4)))
            J = [g.accessor(a[k], normalize=False) for k in ("JOINTS_0", "JOINTS_1") if k in a]
            W = [g.accessor(a[k]) for k in ("WEIGHTS_0", "WEIGHTS_1") if k in a]
            arr["joints"].append(np.hstack(J + [np.zeros((n, 8 - 4 * len(J)))]).astype(np.int32))
            arr["weights"].append(np.hstack(W + [np.zeros((n, 8 - 4 * len(W)))]).astype(np.float32))
            idx = g.accessor(p["indices"], normalize=False).reshape(-1, 3).astype(np.int64)
            arr["faces"].append(idx + base)
            arr["mat"].append(np.full(len(idx), p.get("material", -1)))
            base += n
        out = {k: np.concatenate(v) for k, v in arr.items()}
        # welded vertex ids: same position across primitives (seams split by UV / material)
        _, out["vid"] = np.unique(np.round(out["pos"], 5), axis=0, return_inverse=True)
        out["vid"] = out["vid"].ravel()
        name = safe(me.get("name", f"mesh{ni}"))
        np.savez_compressed(os.path.join(SRC, f"mesh_{name}.npz"), **out)
        meshes.append({"name": name, "skin": nd.get("skin")})
        lo, hi = out["pos"].min(0), out["pos"].max(0)
        print(f"{name}: {len(out['pos'])} verts {len(out['faces'])} tris, skin {nd.get('skin')}, "
              f"bbox {np.round(lo, 3)}..{np.round(hi, 3)}, weights/vertex max {(out['weights'] > 0).sum(1).max()}")
    json.dump({"materials": mats, "skins": skins, "meshes": meshes}, open(os.path.join(SRC, "scene.json"), "w"),
              indent=1)
    print(f"{len(mats)} materials -> {SRC}")


if __name__ == "__main__":
    main()
