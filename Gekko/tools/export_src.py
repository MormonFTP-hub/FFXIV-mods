"""Unpack the Kingdom Archives Gekko glb (plain glTF, textures beside it as PNG) into numpy / PNG files under work/src.

work/src/scene.json      materials (name, viewer recipe), skins (joint names, parents, bind world matrices)
work/src/mesh_body.npz   every primitive of every mesh, merged: pos, nrm, uv0..2, col (COLOR_0), col1 (COLOR_1),
                         joints (N,8), weights (N,8), faces, mat (per tri), prim (per tri, viewer order), vid
work/src/tex/<name>.png  the viewer's textures (df, nm, orm, em, decal_df, eye_df)

The viewer draws material CS_AggroBot_S0_MI with df/nm/orm/em on UV0, except its 6th primitive in scene order
(MODEL_JSON SpecialMaterialIndex 5), which is a decal sheet drawn with decal_df on UV1, alpha blended.
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
MODEL = os.path.join(SOURCE, "gekko_cs.glb")
# from the page's MODEL_JSON
RECIPES = {
    "CS_AggroBot_S0_MI": dict(type="PBR", df="df.png", nm="nm.png", orm="orm.png", em="em.png",
                              decal="decal_df.png", decal_index=5, metallic=1, roughness=1),
    "TP_Core_Eye_MI": dict(type="Eye", df="eye_df.png"),
    "TP_AggroBot_S0_Glass_MI": dict(type="AgentGlass", opacity=0.2, metallic=1, roughness=1, color=[0, 0, 0]),
}


def main():
    os.makedirs(os.path.join(SRC, "tex"), exist_ok=True)
    for f in os.listdir(os.path.join(SOURCE, "textures")):
        shutil.copy(os.path.join(SOURCE, "textures", f), os.path.join(SRC, "tex", f))
    g = Glb(MODEL)
    parent, local, world = g.node_matrices()
    nodes = g.g["nodes"]
    mats = [{"name": m.get("name"), "doubleSided": m.get("doubleSided"), "recipe": RECIPES.get(m.get("name"))}
            for m in g.g["materials"]]
    skins = []
    for s in g.g["skins"]:
        joints = s["joints"]
        ibm = g.accessor(s["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
        skins.append({"joints": [nodes[j].get("name") for j in joints],
                      "parents": [nodes[parent[j]].get("name") if parent[j] >= 0 else None for j in joints],
                      "bind": np.linalg.inv(ibm).tolist(), "rest": [world[j].tolist() for j in joints]})
    arr = {k: [] for k in ("pos", "nrm", "uv0", "uv1", "uv2", "col", "col1", "joints", "weights", "faces", "mat",
                           "prim")}
    base, prim, meshes = 0, 0, []
    for ni, nd in enumerate(nodes):          # node order = three.js traversal order here (both meshes are roots)
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
            arr["col"].append(g.accessor(a["COLOR_0"]) if "COLOR_0" in a else np.ones((n, 4)))
            arr["col1"].append(g.accessor(a["COLOR_1"]) if "COLOR_1" in a else np.ones((n, 4)))
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
    for k in ("col", "col1"):
        if out[k].shape[1] == 3:
            out[k] = np.c_[out[k], np.ones(len(out[k]))]
    _, out["vid"] = np.unique(np.round(out["pos"], 5), axis=0, return_inverse=True)
    out["vid"] = out["vid"].ravel()
    np.savez_compressed(os.path.join(SRC, "mesh_body.npz"), **out)
    lo, hi = out["pos"].min(0), out["pos"].max(0)
    print(f"body: {len(out['pos'])} verts {len(out['faces'])} tris, {prim} primitives, bbox {np.round(lo, 3)}.."
          f"{np.round(hi, 3)}, weights/vertex max {(out['weights'] > 0).sum(1).max()}")
    json.dump({"materials": mats, "skins": skins, "meshes": meshes}, open(os.path.join(SRC, "scene.json"), "w"),
              indent=1)
    print(f"{len(mats)} materials -> {SRC}")


if __name__ == "__main__":
    main()
