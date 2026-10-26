"""Dump Peni Parker (Floral Frights) from the psylocke.gg host-body GLB for the numpy pipeline.

The GLB (SharpGLTF, EXT_meshopt_compression, KHR_texture_basisu) holds five skinned meshes: Peni
(SK_1042_Girl_1042302_Lobby), the SP//dr mech, its two launchers and the spider drone. Only Peni is kept.
glTF axes already match FFXIV (metres, Y up, +Z forward, +X = her left) and the bind pose is the node rest pose.

work/src/mesh_<n>.npz  one per primitive: pos, nrm, uv0 (v up), col (RGBA 0..1), joints (N,4) index into
                       scene.json "bones", weights (N,4), faces (M,3)
work/src/scene.json    meshes (material, texture names), bones (name, parent, world 4x4 bind matrix), materials
work/src/tex/<image>.png  every image Peni's materials use, transcoded from KTX2 (UASTC) to RGBA
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
HOST = "8fa7f2072b45a307e4a394baecf103ad927b3d3b7b7f77cbb189bbdecd5fb8fe"
OUT = os.path.join(ROOT, "work", "src")
TEX = os.path.join(OUT, "tex")
PENI = "SK_1042_Girl_1042302_Lobby"


def image_name(g, ti):
    t = g.g["textures"][ti]
    src = t.get("extensions", {}).get("KHR_texture_basisu", {}).get("source", t.get("source"))
    im = g.g["images"][src]
    return im["name"].replace("_gltf:", "_").replace(":", "_"), im["uri"]


def material_textures(g, m):
    out = {}
    pbr = m.get("pbrMetallicRoughness", {})
    for k in ("baseColorTexture", "metallicRoughnessTexture"):
        if k in pbr:
            out[k] = pbr[k]["index"]
    for k in ("normalTexture", "occlusionTexture", "emissiveTexture"):
        if k in m:
            out[k] = m[k]["index"]
    sp = m.get("extensions", {}).get("KHR_materials_specular", {})
    if "specularColorTexture" in sp:
        out["specularColorTexture"] = sp["specularColorTexture"]["index"]
    # the stylised shaders' own maps (hair shadow colour and opacity, procedural eye parts, ...);
    # HDR reflection maps live in raw buffer views and are skipped
    for k, v in m.get("extras", {}).get("extraTextures", {}).items():
        if "index" in v:
            out["x:" + k] = v["index"]
    return {k: image_name(g, v) for k, v in out.items()}


def main():
    os.makedirs(TEX, exist_ok=True)
    g = Glb(os.path.join(CDN, HOST + ".glb"))
    j = g.g
    mi = next(i for i, m in enumerate(j["meshes"]) if m["name"] == PENI)
    node = next(n for n in j["nodes"] if n.get("mesh") == mi)
    skin = j["skins"][node["skin"]]
    parent, _, world = g.node_matrices()
    jn = skin["joints"]
    names = [j["nodes"][i]["name"] for i in jn]
    ibm = g.accessor(skin["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
    bind = np.linalg.inv(ibm)
    drift = max(np.abs(bind[k] - world[i]).max() for k, i in enumerate(jn))
    jset = {n: k for k, n in enumerate(jn)}
    bones = []
    for k, i in enumerate(jn):
        p = parent[i]
        while p >= 0 and p not in jset:
            p = parent[p]
        bones.append({"name": names[k], "parent": names[jset[p]] if p >= 0 else None, "world": bind[k].tolist()})
    print(f"{PENI}: {len(names)} joints, bind vs rest drift {drift:.2e}")

    scene = {"bones": bones, "meshes": [], "materials": {}}
    images = {}
    for pi, p in enumerate(j["meshes"][mi]["primitives"]):
        a = p["attributes"]
        mat = j["materials"][p["material"]]
        pos = g.accessor(a["POSITION"]).astype(np.float64)
        nrm = g.accessor(a["NORMAL"]).astype(np.float64)
        nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
        uv = g.accessor(a["TEXCOORD_0"]).astype(np.float64)
        col = g.accessor(a["COLOR_0"]).astype(np.float64) if "COLOR_0" in a else np.ones((len(pos), 4))
        joints = g.accessor(a["JOINTS_0"]).astype(np.int64)
        weights = g.accessor(a["WEIGHTS_0"]).astype(np.float64)
        weights /= np.maximum(weights.sum(1, keepdims=True), 1e-9)
        faces = g.accessor(p["indices"]).astype(np.int64).reshape(-1, 3)
        extra_uv = {f"uv{k}": np.c_[u[:, 0], 1 - u[:, 1]] for k in (1, 2, 3) if f"TEXCOORD_{k}" in a
                    for u in [g.accessor(a[f"TEXCOORD_{k}"]).astype(np.float64)]}
        np.savez_compressed(os.path.join(OUT, f"mesh_{pi}.npz"), pos=pos, nrm=nrm, uv0=np.c_[uv[:, 0], 1 - uv[:, 1]],
                            col=col, joints=joints, weights=weights, faces=faces, **extra_uv)
        tex = material_textures(g, mat)
        for k, (name, uri) in tex.items():
            images[name] = uri
        scene["meshes"].append({"index": pi, "material": mat["name"], "textures": {k: v[0] for k, v in tex.items()},
                                "verts": len(pos), "tris": len(faces)})
        scene["materials"][mat["name"]] = {"alphaMode": mat.get("alphaMode"), "alphaCutoff": mat.get("alphaCutoff"),
                                           "extras": mat.get("extras", {})}
        print(f"  mesh_{pi}: {mat['name']:34s} {len(pos):6d} verts {len(faces):6d} tris  "
              f"y {pos[:, 1].min():.3f}..{pos[:, 1].max():.3f}  {sorted(tex)}")
    json.dump(scene, open(os.path.join(OUT, "scene.json"), "w"), indent=1)

    for name, uri in sorted(images.items()):
        dst = os.path.join(TEX, name + ".png")
        if os.path.exists(dst):
            continue
        src = next(f for f in os.listdir(CDN) if f.startswith(uri))
        data = open(os.path.join(CDN, src), "rb").read()
        if data[:4] == b"\xabKTX":
            rgba = xdec.ktx2_rgba(data)
        else:                       # 1x1 lossless WebP placeholders (flat normal, black emissive, ...)
            rgba = np.asarray(Image.open(os.path.join(CDN, src)).convert("RGBA"))
        Image.fromarray(rgba, "RGBA").save(dst)
        print(f"  tex {name}: {rgba.shape[1]}x{rgba.shape[0]}")


if __name__ == "__main__":
    main()
