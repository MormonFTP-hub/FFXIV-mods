"""Dump the psylocke.gg Unseen Weaver model (one skinned glTF) to work/src, in the layout srcdata.py reads.

* work/src/scene.json        materials, primitive -> material, the skeleton at bind pose (parent, world matrix)
* work/src/mesh_<prim>.npz   pos, nrm, uv0, uv1, faces, groups (N, bones) weights, vid; one file per glTF primitive
* work/src/tex/<image>.png   every texture the materials name, transcoded from KTX2 (UASTC/ETC1S)
The glTF is already in FFXIV axes: metres, Y up, +Z forward, +X = character's left.

python -P -E tools/export_src.py
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xdec  # noqa: E402
from glb import Glb  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CDN = os.path.join(ROOT, "source", "cdn")
MODEL = os.path.join(CDN, "d617fb482db31c49a615942534617f13f4b94a61e94502325e523965aaa2cdf3.glb")
SRC = os.path.join(ROOT, "work", "src")
TEX = os.path.join(SRC, "tex")


def main():
    os.makedirs(TEX, exist_ok=True)
    G = Glb(MODEL)
    g = G.g
    parent, local, world = G.node_matrices()
    skin = g["skins"][0]
    joints = skin["joints"]
    ibm = G.accessor(skin["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)   # column-major -> rows
    names = [g["nodes"][j]["name"] for j in joints]
    jset = set(joints)
    bones = {}
    for k, j in enumerate(joints):
        p = parent[j]
        while p >= 0 and p not in jset:
            p = parent[p]
        bones[names[k]] = {"parent": g["nodes"][p]["name"] if p >= 0 else None,
                           "world": np.linalg.inv(ibm[k]).tolist(), "rest": world[j].tolist()}
    mesh_node = next(i for i, n in enumerate(g["nodes"]) if "mesh" in n)
    assert np.allclose(world[mesh_node], np.eye(4)), world[mesh_node]

    mats = [m["name"] for m in g["materials"]]
    prims = []
    for pi, pr in enumerate(g["meshes"][0]["primitives"]):
        a = pr["attributes"]
        pos = G.accessor(a["POSITION"]).astype(np.float64)
        nrm = G.accessor(a["NORMAL"]).astype(np.float64)
        uv0 = G.accessor(a["TEXCOORD_0"]).astype(np.float64)
        uv1 = G.accessor(a["TEXCOORD_1"]).astype(np.float64) if "TEXCOORD_1" in a else np.zeros_like(uv0)
        col = G.accessor(a["COLOR_0"]).astype(np.float64) if "COLOR_0" in a else np.ones((len(pos), 4))
        J = G.accessor(a["JOINTS_0"]).astype(np.int64)
        W = G.accessor(a["WEIGHTS_0"]).astype(np.float64)
        faces = G.accessor(pr["indices"]).astype(np.int64).reshape(-1, 3)
        used = sorted(set(J[W > 0].ravel().tolist()))
        col_of = {j: c for c, j in enumerate(used)}
        groups = np.zeros((len(pos), len(used)), np.float32)
        for k in range(J.shape[1]):
            for v in np.nonzero(W[:, k] > 0)[0]:
                groups[v, col_of[J[v, k]]] += W[v, k]
        # one id per welded position, so islands can be found across UV seams
        key = np.round(pos, 5)
        _, vid = np.unique(key, axis=0, return_inverse=True)
        name = f"p{pi:02d}_{mats[pr['material']]}"
        np.savez_compressed(os.path.join(SRC, f"mesh_{name}.npz"), pos=pos, nrm=nrm, uv0=uv0, uv1=uv1, col=col,
                            faces=faces, groups=groups, vid=vid.ravel())
        prims.append({"name": name, "material": mats[pr["material"]], "groups": [names[j] for j in used],
                      "verts": len(pos), "tris": len(faces)})
        print(f"{name}: {len(pos)} verts {len(faces)} tris, {len(used)} bones, y {pos[:, 1].min():.3f}..{pos[:, 1].max():.3f}")

    images = {}
    for mi, m in enumerate(g["materials"]):
        refs = {}
        pbr = m.get("pbrMetallicRoughness", {})
        for k in ("baseColorTexture", "metallicRoughnessTexture"):
            if k in pbr:
                refs["gltf:" + k] = pbr[k]["index"]
        for k in ("normalTexture", "occlusionTexture", "emissiveTexture"):
            if k in m:
                refs["gltf:" + k] = m[k]["index"]
        for k, v in m.get("extras", {}).get("extraTextures", {}).items():
            if "index" in v:
                refs[k] = v["index"]
        for k, ti in refs.items():
            t = g["textures"][ti]
            src = t.get("extensions", {}).get("KHR_texture_basisu", {}).get("source", t.get("source"))
            images.setdefault(src, set()).add(m["name"])
    for src in sorted(images):
        im = g["images"][src]
        out = os.path.join(TEX, im["name"].replace(":", "_") + ".png")
        if os.path.exists(out):
            continue
        p = os.path.join(CDN, im["uri"] + ".ktx2")
        if not os.path.exists(p):
            print("  (no ktx2)", im["name"], im["uri"][:12])
            continue
        rgba = xdec.ktx2_rgba(open(p, "rb").read())
        Image.fromarray(rgba).save(out)
        print(f"  {im['name']}: {rgba.shape[1]}x{rgba.shape[0]}")

    scene = {"materials": {m["name"]: {"extras": m.get("extras", {}), "alphaMode": m.get("alphaMode", "OPAQUE"),
                                       "doubleSided": m.get("doubleSided", False)} for m in g["materials"]},
             "images": [{"name": im["name"].replace(":", "_"), "uri": im.get("uri")} for im in g["images"]],
             "prims": prims, "bones": bones,
             "targets": g["meshes"][0].get("extras", {}).get("targetNames", [])}
    json.dump(scene, open(os.path.join(SRC, "scene.json"), "w"), indent=1)
    print("wrote", SRC)


if __name__ == "__main__":
    main()
