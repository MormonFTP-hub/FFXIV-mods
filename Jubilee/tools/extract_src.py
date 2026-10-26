"""Unpack Jubilee's Vampy Jammies model from the psylocke.gg CDN objects into work/src.

The character is one skinned glTF (source/cdn/<HOST>.glb, from the skin's scene file): meshopt-compressed buffers and
Basis UASTC KTX2 textures. tools/decode_glb.mjs and tools/decode_ktx2.mjs (portable Node in apps/) undo those; this
script then writes
  work/src/scene.json   bones (parent, bind-pose world matrix), materials (name, textures, alpha mode, extras)
  work/src/mesh_<i>.npz one per primitive / material: pos, nrm, uv0, uv1, col, joints (bone names), weights, faces, vid
  work/src/tex/<image name>.png
Positions stay in the glTF's own space (metres, Y up); srcdata.py converts to FFXIV axes.
"""
import json
import os
import struct
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CDN = os.path.join(ROOT, "source", "cdn")
SRC = os.path.join(ROOT, "work", "src")
NODE = os.path.join(ROOT, "apps", "node-v24.22.1-win-x64", "node.exe")
HOST = "a3a63115f5ba7c225a205e04c1e6e1d546a3cfc875f2281cc6f9368fac82d507"   # SK_1064_1064300_Lobby
COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def node(*args):
    r = subprocess.run([NODE, *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stdout + r.stderr)
    return r.stdout


def read_glb(path):
    b = open(path, "rb").read()
    n = struct.unpack_from("<I", b, 12)[0]
    j = json.loads(b[20:20 + n])
    bin_ = b[20 + n + 8:]
    return j, bin_


def accessor(j, bin_, i):
    a = j["accessors"][i]
    v = j["bufferViews"][a["bufferView"]]
    dt = np.dtype(COMP[a["componentType"]])
    nc = NCOMP[a["type"]]
    stride = v.get("byteStride") or dt.itemsize * nc
    off = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    raw = np.frombuffer(bin_, np.uint8, count=stride * (a["count"] - 1) + dt.itemsize * nc, offset=off)
    out = np.lib.stride_tricks.as_strided(raw, (a["count"], dt.itemsize * nc), (stride, 1)).copy()
    arr = out.view(dt).reshape(a["count"], nc)
    if a.get("normalized"):
        arr = arr.astype(np.float64) / np.iinfo(dt).max
    return arr


def trs(nd):
    m = np.eye(4)
    if "matrix" in nd:
        return np.array(nd["matrix"], float).reshape(4, 4).T
    x, y, z, w = nd.get("rotation", [0, 0, 0, 1])
    m[:3, :3] = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                 [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                 [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    m[:3, :3] *= np.array(nd.get("scale", [1, 1, 1]))[None, :]
    m[:3, 3] = nd.get("translation", [0, 0, 0])
    return m


def weld_ids(pos):
    """Same id for vertices at the same position (glTF splits them at UV and normal seams)."""
    q = np.round(pos / 1e-5).astype(np.int64)
    _, inv = np.unique(q, axis=0, return_inverse=True)
    return inv.ravel()


def textures(j):
    """image index -> png name; decodes every KTX2 the model names."""
    os.makedirs(os.path.join(SRC, "tex"), exist_ok=True)
    rgba = os.path.join(SRC, "rgba")
    os.makedirs(rgba, exist_ok=True)
    names = {}
    ktx = []
    for i, im in enumerate(j["images"]):
        h = im["uri"]
        local = [f for f in os.listdir(CDN) if f.startswith(h)]
        assert local, h
        names[i] = (im["name"].replace(":", "_"), os.path.join(CDN, local[0]))
        if local[0].endswith(".ktx2"):
            ktx.append(os.path.join(CDN, local[0]))
    print(node(os.path.join(ROOT, "tools", "decode_ktx2.mjs"), rgba, *sorted(set(ktx))).strip())
    out = {}
    for i, (name, path) in names.items():
        dst = os.path.join(SRC, "tex", name + ".png")
        h = os.path.basename(path).split(".")[0]
        if path.endswith(".ktx2"):
            info = json.load(open(os.path.join(rgba, h + ".json")))
            a = np.fromfile(os.path.join(rgba, h + ".rgba"), np.uint8).reshape(info["height"], info["width"], 4)
            Image.fromarray(a, "RGBA").save(dst)
        else:
            Image.open(path).save(dst)       # plain PNG / JPEG object
        out[i] = name
    return out


def main():
    os.makedirs(SRC, exist_ok=True)
    glb = os.path.join(SRC, "jubilee.glb")
    print(node(os.path.join(ROOT, "tools", "decode_glb.mjs"), os.path.join(CDN, HOST + ".glb"), glb).strip())
    j, bin_ = read_glb(glb)
    img = textures(j)
    tex_img = {i: t.get("extensions", {}).get("KHR_texture_basisu", {}).get("source", t.get("source"))
               for i, t in enumerate(j["textures"])}

    # skeleton: bind pose from the inverse bind matrices, parents from the node tree
    skin = j["skins"][0]
    joints = skin["joints"]
    names = [j["nodes"][n]["name"] for n in joints]
    parent_of = {c: p for p, nd in enumerate(j["nodes"]) for c in nd.get("children", [])}
    ibm = accessor(j, bin_, skin["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
    bones = {}
    for k, n in enumerate(joints):
        p = parent_of.get(n)
        while p is not None and p not in joints:
            p = parent_of.get(p)
        bones[names[k]] = {"parent": j["nodes"][p]["name"] if p is not None else None,
                           "bind": np.linalg.inv(ibm[k].astype(float)).tolist()}

    mats = []
    for m in j["materials"]:
        t = {}
        pbr = m.get("pbrMetallicRoughness", {})
        for key, ref in (("baseColor", pbr.get("baseColorTexture")), ("orm", pbr.get("metallicRoughnessTexture")),
                         ("normal", m.get("normalTexture")), ("occlusion", m.get("occlusionTexture")),
                         ("emissive", m.get("emissiveTexture"))):
            if ref:
                t[key] = img[tex_img[ref["index"]]]
        for key, ref in m.get("extras", {}).get("extraTextures", {}).items():
            t[key] = img[tex_img[ref["index"]]]
        mats.append({"name": m["name"], "alphaMode": m.get("alphaMode", "OPAQUE"), "alphaCutoff": m.get("alphaCutoff", 0.5),
                     "doubleSided": m.get("doubleSided", False), "textures": t,
                     "baseColorFactor": pbr.get("baseColorFactor", [1, 1, 1, 1]),
                     "recipe": m.get("extras", {}).get("recipeKey"), "parent": m.get("extras", {}).get("parentMaterial"),
                     "inputs": m.get("extras", {}).get("inputs", {})})

    mesh = j["meshes"][0]
    prims = []
    for pi, pr in enumerate(mesh["primitives"]):
        at = pr["attributes"]
        pos = accessor(j, bin_, at["POSITION"]).astype(float)
        d = {"pos": pos, "nrm": accessor(j, bin_, at["NORMAL"]).astype(float),
             "uv0": accessor(j, bin_, at["TEXCOORD_0"]).astype(float),
             "faces": accessor(j, bin_, pr["indices"]).reshape(-1, 3).astype(np.int64), "vid": weld_ids(pos)}
        if "TEXCOORD_1" in at:
            d["uv1"] = accessor(j, bin_, at["TEXCOORD_1"]).astype(float)
        if "COLOR_0" in at:
            d["col"] = accessor(j, bin_, at["COLOR_0"]).astype(float)
        jt = np.concatenate([accessor(j, bin_, at[k]) for k in sorted(at) if k.startswith("JOINTS_")], 1)
        wt = np.concatenate([accessor(j, bin_, at[k]) for k in sorted(at) if k.startswith("WEIGHTS_")], 1).astype(float)
        d["joints"] = np.array(names, object)[jt.astype(np.int64)]
        d["joints"][wt <= 0] = ""
        d["weights"] = wt / np.maximum(wt.sum(1, keepdims=True), 1e-9)
        np.savez_compressed(os.path.join(SRC, f"mesh_{pi}.npz"), **{k: (v.astype(str) if v.dtype == object else v)
                                                                   for k, v in d.items()})
        mi = pr.get("material")
        prims.append({"index": pi, "material": mi, "verts": len(pos), "tris": len(d["faces"])})
        lo, hi = pos.min(0), pos.max(0)
        print(f"prim {pi:2d} {mats[mi]['name']:28s} v={len(pos):6d} f={len(d['faces']):6d} "
              f"bbox {np.round(lo, 3)}..{np.round(hi, 3)}")
    json.dump({"bones": bones, "materials": mats, "prims": prims}, open(os.path.join(SRC, "scene.json"), "w"), indent=1)
    print(f"{len(bones)} bones, {len(mats)} materials, {len(img)} images -> {SRC}")


if __name__ == "__main__":
    sys.exit(main())
