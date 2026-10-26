"""Unpack the psylocke.gg White Fox (Pink Paws) GLB from source/cdn into work/src. The GLB already uses FFXIV
axes: metres, Y up, +Z forward, +X = character's left.

  work/src/scene.json             joints (name, parent, bind-pose world matrix), materials (name, recipe, textures,
                                  dye inputs), primitives (material, mesh file, size)
  work/src/mesh_p<NN>.npz         one per primitive: pos, nrm, tan, uv0..2, col, faces, joints, weights, vid
  work/src/tex/<image>.png        every texture, KTX2/UASTC transcoded to RGBA

python -P -E tools/extract_src.py
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
MODEL = "d5888f700418ad82d438ed035ba8fa6a55fc649855ca75187d42a932f2967c4f"   # SK_10600_1060501_Lobby, Pink Paws


def safe(name):
    return re.sub(r"[^A-Za-z0-9_.-]", "_", name)


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
        found = list(CDN.glob(im["uri"] + ".*"))
        name = safe(im["name"])
        images[i] = name
        dst = SRC / "tex" / f"{name}.png"
        if not found:
            print("  tex", name, "MISSING", im["uri"])
            images[i] = None
            continue
        if dst.exists():
            continue
        path = found[0]
        if path.suffix != ".ktx2":      # 1x1 WebP stand-ins
            Image.open(path).convert("RGBA").save(dst)
            continue
        Image.fromarray(xdec.ktx2_rgba(path.read_bytes())).save(dst)
    tex_image = {i: t.get("extensions", {}).get("KHR_texture_basisu", t)["source"] for i, t in enumerate(G["textures"])}

    def tex_ref(info):
        return images.get(tex_image[info["index"]]) if info and "index" in info else None   # cube maps: bufferView only

    materials = {}
    for mi, mt in enumerate(G["materials"]):
        pbr = mt.get("pbrMetallicRoughness", {})
        ex = mt.get("extras", {})
        materials[mt["name"]] = {
            "index": mi, "alphaMode": mt.get("alphaMode", "OPAQUE"), "alphaCutoff": mt.get("alphaCutoff"),
            "doubleSided": mt.get("doubleSided", False), "parent": ex.get("parentMaterial"),
            "recipe": ex.get("recipeKey"), "shading": ex.get("shadingModel"), "blend": ex.get("blendMode"),
            "baseColorFactor": pbr.get("baseColorFactor"),
            "baseColor": tex_ref(pbr.get("baseColorTexture")),
            "normal": tex_ref(mt.get("normalTexture")),
            "orm": tex_ref(pbr.get("metallicRoughnessTexture")),
            "emissive": tex_ref(mt.get("emissiveTexture")), "emissiveFactor": mt.get("emissiveFactor"),
            "extra": {k: tex_ref(v) for k, v in ex.get("extraTextures", {}).items()},
            "switches": ex.get("switches", {}),
            "inputs": ex.get("inputs", {}),
        }

    prims = []
    mesh = G["meshes"][0]
    for pi, pr in enumerate(mesh["primitives"]):
        mat = G["materials"][pr["material"]]["name"]
        A = {k: g.accessor(v) for k, v in pr["attributes"].items()}
        faces = g.accessor(pr["indices"]).reshape(-1, 3).astype(np.int64)
        pos = A["POSITION"].astype(np.float64)
        _, vid = np.unique(np.round(pos, 5), axis=0, return_inverse=True)
        out = dict(pos=pos, nrm=A["NORMAL"].astype(np.float64), faces=faces, vid=vid.reshape(-1),
                   joints=A["JOINTS_0"].astype(np.int64), weights=A["WEIGHTS_0"].astype(np.float64),
                   col=A["COLOR_0"].astype(np.float64) if "COLOR_0" in A else np.zeros((len(pos), 4)))
        for k in range(3):
            if f"TEXCOORD_{k}" in A:
                out[f"uv{k}"] = A[f"TEXCOORD_{k}"].astype(np.float64)
        if "TANGENT" in A:
            out["tan"] = A["TANGENT"].astype(np.float64)
        np.savez(SRC / f"mesh_p{pi:02d}.npz", **out)
        top = np.bincount(out["joints"].ravel(), out["weights"].ravel(), minlength=len(jnames))
        main_j = [jnames[j] for j in np.argsort(-top)[:4] if top[j] > 0]
        prims.append({"index": pi, "material": mat, "mesh": f"mesh_p{pi:02d}.npz", "verts": len(pos),
                      "tris": len(faces), "bbox": [pos.min(0).round(3).tolist(), pos.max(0).round(3).tolist()],
                      "main_joints": main_j})
        print(f"  p{pi:02d} {mat:28s} {len(pos):6d} v {len(faces):6d} t  y {pos[:, 1].min():.3f}..{pos[:, 1].max():.3f}"
              f"  {' '.join(main_j)}")
    json.dump({"joints": joints, "materials": materials, "primitives": prims,
               "targets": mesh.get("extras", {}).get("targetNames", [])}, open(SRC / "scene.json", "w"), indent=1)
    print("wrote", SRC, f"({len(joints)} joints, {len(images)} images)")


if __name__ == "__main__":
    main()
