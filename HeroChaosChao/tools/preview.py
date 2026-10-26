"""Static glTF writer for quick Blender previews (textured or flat-coloured meshes, no skin)."""
import base64
import json
import os
from pathlib import Path

import numpy as np

FLOAT, UINT = 5126, 5125


def write_static_gltf(path, meshes):
    """meshes: dicts with name, positions, normals, indices, and either uvs + texture (png path) or color (rgba)."""
    blob = bytearray()
    views, accessors, gl_meshes, materials, textures, images, nodes = [], [], [], [], [], [], []

    def add(arr, comp, typ, minmax=False):
        arr = np.ascontiguousarray(arr)
        while len(blob) % 4:
            blob.append(0)
        views.append({"buffer": 0, "byteOffset": len(blob), "byteLength": arr.nbytes})
        blob.extend(arr.tobytes())
        acc = {"bufferView": len(views) - 1, "componentType": comp, "count": int(arr.shape[0]), "type": typ}
        if minmax:
            acc["min"], acc["max"] = arr.min(0).tolist(), arr.max(0).tolist()
        accessors.append(acc)
        return len(accessors) - 1

    for m in meshes:
        attrs = {"POSITION": add(np.asarray(m["positions"], np.float32), FLOAT, "VEC3", True),
                 "NORMAL": add(np.asarray(m["normals"], np.float32), FLOAT, "VEC3")}
        mat = {"name": m["name"], "doubleSided": True, "pbrMetallicRoughness": {"metallicFactor": 0, "roughnessFactor": 0.8}}
        if m.get("texture"):
            attrs["TEXCOORD_0"] = add(np.asarray(m["uvs"], np.float32), FLOAT, "VEC2")
            images.append({"uri": os.path.relpath(Path(m["texture"]).resolve(), Path(path).resolve().parent).replace("\\", "/")})
            textures.append({"source": len(images) - 1})
            mat["pbrMetallicRoughness"]["baseColorTexture"] = {"index": len(textures) - 1}
        else:
            mat["pbrMetallicRoughness"]["baseColorFactor"] = list(m.get("color", (0.8, 0.8, 0.8, 1)))
        materials.append(mat)
        ind = add(np.asarray(m["indices"], np.uint32), UINT, "SCALAR")
        gl_meshes.append({"name": m["name"], "primitives": [{"attributes": attrs, "indices": ind, "material": len(materials) - 1}]})
        nodes.append({"name": m["name"], "mesh": len(gl_meshes) - 1})
    gltf = {"asset": {"version": "2.0"}, "scene": 0, "scenes": [{"nodes": list(range(len(nodes)))}], "nodes": nodes,
            "meshes": gl_meshes, "materials": materials, "accessors": accessors, "bufferViews": views,
            "buffers": [{"byteLength": len(blob), "uri": "data:application/octet-stream;base64," + base64.b64encode(bytes(blob)).decode()}]}
    if images:
        gltf["images"], gltf["textures"] = images, textures
    Path(path).write_text(json.dumps(gltf))


def bone_markers(points, size=0.03):
    """Small octahedra at the given points (one mesh), for showing joint positions."""
    base = np.array([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], float) * size
    faces = np.array([[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]])
    pos, idx = [], []
    for i, p in enumerate(points):
        pos.append(base + p)
        idx.append(faces + 6 * i)
    pos = np.concatenate(pos)
    return {"positions": pos, "normals": pos / np.maximum(np.linalg.norm(pos, axis=1, keepdims=True), 1e-9),
            "indices": np.concatenate(idx).reshape(-1)}
