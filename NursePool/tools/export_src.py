"""Unpack the psylocke.gg Nurse-Pool glb (meshopt + KTX2/UASTC) into plain numpy / PNG files under work/src.

work/src/scene.json         materials (name, recipe, texture slots), skins (joint names, parents, bind world matrices)
work/src/mesh_<n>.npz        per mesh: pos, nrm, uv0..2, col, joints (N,8), weights (N,8), faces, mat (per tri), vid
work/src/tex/<image>.png     every referenced image, decoded

glTF is already in FFXIV axes (metres, Y up, +Z forward, +X = character's left), so nothing is rotated here.
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xdec  # noqa: E402
from glb import Glb  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CDN = os.path.join(ROOT, "source", "cdn")
SRC = os.path.join(ROOT, "work", "src")
MODEL = "18e36a49d06ad713e0923c3251ad0985224d416b3c9272fa4955a2b501158b7a"


def safe(name):
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", name)


def image(g, i):
    im = g.g["images"][i]
    uri = im["uri"]
    path = next((os.path.join(CDN, f) for f in os.listdir(CDN) if f.startswith(uri)), None)
    out = os.path.join(SRC, "tex", safe(im["name"]) + ".png")
    if path and not os.path.exists(out):
        data = open(path, "rb").read()
        if data[:12] == b"\xabKTX 20\xbb\r\n\x1a\n":
            Image.fromarray(xdec.ktx2_rgba(data)).save(out)
        else:
            Image.open(path).save(out)
    return os.path.basename(out) if path else None


def tex_refs(obj, g, out, key=""):
    """Every {"index": n} texture reference inside a material, by its JSON path."""
    if isinstance(obj, dict):
        if "index" in obj and isinstance(obj["index"], int) and key.lower().endswith(("texture", "map", "tex")):
            t = g.g["textures"][obj["index"]]
            src = t.get("extensions", {}).get("KHR_texture_basisu", {}).get("source", t.get("source"))
            out[key] = image(g, src)
        for k, v in obj.items():
            tex_refs(v, g, out, f"{key}.{k}" if key else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            tex_refs(v, g, out, f"{key}[{i}]")


def main():
    os.makedirs(os.path.join(SRC, "tex"), exist_ok=True)
    g = Glb(next(os.path.join(CDN, f) for f in os.listdir(CDN) if f.startswith(MODEL)))
    parent, local, world = g.node_matrices()
    nodes = g.g["nodes"]
    mats = []
    for m in g.g["materials"]:
        refs = {}
        tex_refs(m, g, refs)
        mats.append({"name": m.get("name"), "extras": m.get("extras"), "alphaMode": m.get("alphaMode"),
                     "alphaCutoff": m.get("alphaCutoff"), "doubleSided": m.get("doubleSided"),
                     "pbr": m.get("pbrMetallicRoughness"), "extensions": m.get("extensions"), "textures": refs})
    for i in range(len(g.g["images"])):
        image(g, i)
    skins = []
    for s in g.g["skins"]:
        joints = s["joints"]
        ibm = g.accessor(s["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
        bind = np.linalg.inv(ibm)
        jset = set(joints)
        skins.append({"joints": [nodes[j].get("name") for j in joints],
                      "parents": [nodes[parent[j]].get("name") if parent[j] >= 0 else None for j in joints],
                      "bind": bind.tolist(), "rest": [world[j].tolist() for j in joints],
                      "extras": [nodes[j].get("extras") for j in joints]})
        missing = [nodes[parent[j]].get("name") for j in joints if parent[j] >= 0 and parent[j] not in jset]
        if missing:
            print("  joints whose parent is outside the skin:", sorted(set(missing))[:10])
    meshes = []
    for ni, nd in enumerate(nodes):
        if "mesh" not in nd:
            continue
        me = g.g["meshes"][nd["mesh"]]
        arr = {k: [] for k in ("pos", "nrm", "tan", "uv0", "uv1", "uv2", "col", "joints", "weights", "faces", "mat")}
        base = 0
        for p in me["primitives"]:
            a = p["attributes"]
            n = g.accessor(a["POSITION"]).shape[0]
            arr["pos"].append(g.accessor(a["POSITION"]))
            arr["nrm"].append(g.accessor(a["NORMAL"]))
            arr["tan"].append(g.accessor(a["TANGENT"]) if "TANGENT" in a else np.zeros((n, 4)))
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
        meshes.append({"name": name, "skin": nd.get("skin"), "node_world": world[ni].tolist(),
                       "targets": (me.get("extras") or {}).get("targetNames", [])})
        lo, hi = out["pos"].min(0), out["pos"].max(0)
        print(f"{name}: {len(out['pos'])} verts {len(out['faces'])} tris, skin {nd.get('skin')}, "
              f"bbox {np.round(lo, 3)}..{np.round(hi, 3)}, weights/vertex max "
              f"{(out['weights'] > 0).sum(1).max()}")
    json.dump({"materials": mats, "skins": skins, "meshes": meshes}, open(os.path.join(SRC, "scene.json"), "w"),
              indent=1)
    print(f"{len(mats)} materials, {len(g.g['images'])} images -> {SRC}")


if __name__ == "__main__":
    main()
