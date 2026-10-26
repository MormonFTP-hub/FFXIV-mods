"""Unpack the psylocke.gg Luna Snow GLB (source/cdn) into work/src, in FFXIV axes (the GLB already uses them:
metres, Y up, +Z forward, +X = character's left).

  work/src/scene.json        joints (name, parent, bind-pose world matrix), materials (name, recipe, textures)
  work/src/mesh_<mat>.npz    one primitive per material: pos, nrm, uv0..2, col, faces, joints, weights, vid
  work/src/tex/<image>.png   every texture, KTX2/UASTC transcoded to RGBA
"""
import json
import os
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glb  # noqa: E402
import xdec  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CDN = ROOT / "source" / "cdn"
SRC = ROOT / "work" / "src"
MODEL = "2896e3e851c137eebdbab4419caf8ce3828bab07125fa8d598102dcffcfa6f7d"   # SK_1031_1031500_Lobby, Coalsack Nebula


def safe(name):
    return re.sub(r"[^A-Za-z0-9_.-]", "_", name)


def short(mat):
    return mat.replace("MI_1031502_", "")


def main():
    (SRC / "tex").mkdir(parents=True, exist_ok=True)
    g = glb.Glb(next(CDN.glob(MODEL + ".*")))
    G = g.g
    sk = G["skins"][0]
    parent, _, _ = g.node_matrices()
    ibm = g.accessor(sk["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
    jnames = [G["nodes"][j]["name"] for j in sk["joints"]]
    node_to_joint = {j: i for i, j in enumerate(sk["joints"])}
    joints = {}
    for i, j in enumerate(sk["joints"]):
        p = parent[j]
        joints[jnames[i]] = {"index": i, "parent": jnames[node_to_joint[p]] if p in node_to_joint else None,
                             "world": np.linalg.inv(ibm[i]).tolist()}

    images = {}
    for i, im in enumerate(G["images"]):
        path = next(CDN.glob(im["uri"] + ".*"))
        name = safe(im["name"])
        images[i] = name
        dst = SRC / "tex" / f"{name}.png"
        if dst.exists():
            continue
        if path.suffix != ".ktx2":      # a few 1x1 WebP stand-ins
            Image.open(path).convert("RGBA").save(dst)
            print("  tex", name, "webp", Image.open(path).size)
            continue
        Image.fromarray(xdec.ktx2_rgba(path.read_bytes())).save(dst)
        print("  tex", name, xdec.ktx2_info(path.read_bytes()))
    tex_image = {i: t.get("extensions", {}).get("KHR_texture_basisu", t)["source"] for i, t in enumerate(G["textures"])}

    def tex_ref(info):
        return images.get(tex_image[info["index"]]) if info else None

    materials = {}
    for mi, mt in enumerate(G["materials"]):
        pbr = mt.get("pbrMetallicRoughness", {})
        ex = mt.get("extras", {})
        materials[short(mt["name"])] = {
            "index": mi, "alphaMode": mt.get("alphaMode", "OPAQUE"), "doubleSided": mt.get("doubleSided", False),
            "parent": ex.get("parentMaterial"), "recipe": ex.get("recipeKey"),
            "baseColorFactor": pbr.get("baseColorFactor"),
            "baseColor": tex_ref(pbr.get("baseColorTexture")),
            "normal": tex_ref(mt.get("normalTexture")),
            "orm": tex_ref(pbr.get("metallicRoughnessTexture")),
            "emissive": tex_ref(mt.get("emissiveTexture")), "emissiveFactor": mt.get("emissiveFactor"),
            "extra": {k: tex_ref(v) if isinstance(v, dict) and "index" in v else v
                      for k, v in ex.get("extraTextures", {}).items()},
            "params": {k: v for k, v in ex.items() if k not in ("extraTextures", "switches")},
        }

    mesh = G["meshes"][0]
    for pi, pr in enumerate(mesh["primitives"]):
        name = short(G["materials"][pr["material"]]["name"])
        A = {k: g.accessor(v) for k, v in pr["attributes"].items()}
        faces = g.accessor(pr["indices"]).reshape(-1, 3).astype(np.int64)
        pos = A["POSITION"].astype(np.float64)
        _, vid = np.unique(np.round(pos, 5), axis=0, return_inverse=True)
        out = dict(pos=pos, nrm=A["NORMAL"].astype(np.float64), faces=faces, vid=vid.reshape(-1),
                   joints=A["JOINTS_0"].astype(np.int64), weights=A["WEIGHTS_0"].astype(np.float64),
                   col=A.get("COLOR_0", np.zeros((len(pos), 4))))
        for k in range(3):
            if f"TEXCOORD_{k}" in A:
                out[f"uv{k}"] = A[f"TEXCOORD_{k}"].astype(np.float64)
        if "TANGENT" in A:
            out["tan"] = A["TANGENT"].astype(np.float64)
        np.savez(SRC / f"mesh_{name}.npz", **out)
        materials[name]["mesh"] = f"mesh_{name}.npz"
        materials[name]["verts"] = len(pos)
        materials[name]["tris"] = len(faces)
        print(f"  mesh {name:16s} {len(pos):6d} verts {len(faces):6d} tris  y {pos[:, 1].min():.3f}..{pos[:, 1].max():.3f}")
    json.dump({"joints": joints, "materials": materials,
               "targets": mesh.get("extras", {}).get("targetNames", [])}, open(SRC / "scene.json", "w"), indent=1)
    print("wrote", SRC)


if __name__ == "__main__":
    main()
