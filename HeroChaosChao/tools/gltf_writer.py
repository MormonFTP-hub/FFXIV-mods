"""Write skinned meshes as .glb in the shape Penumbra's glTF importer expects.

Penumbra groups mesh nodes by a trailing "_<mesh>.<submesh>" in the node name,
takes the material name verbatim as the .mdl material path, reads joint names
from the node's skin, and treats boolean-true node extras as attributes.
"""
import json
import struct

import numpy as np

from xiv_skeleton import Skeleton

FLOAT, USHORT, UINT, UBYTE = 5126, 5123, 5125, 5121
ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER = 34962, 34963


class _Builder:
    def __init__(self):
        self.blob = bytearray()
        self.views, self.accessors = [], []

    def add(self, arr, comp, type_, target=None, minmax=False, normalized=False):
        arr = np.ascontiguousarray(arr)
        while len(self.blob) % 4:
            self.blob.append(0)
        view = {"buffer": 0, "byteOffset": len(self.blob), "byteLength": arr.nbytes}
        if target:
            view["target"] = target
        self.blob += arr.tobytes()
        self.views.append(view)
        acc = {"bufferView": len(self.views) - 1, "componentType": comp,
               "count": int(arr.shape[0]), "type": type_}
        if normalized:
            acc["normalized"] = True
        if minmax:
            acc["min"] = arr.min(axis=0).tolist()
            acc["max"] = arr.max(axis=0).tolist()
        self.accessors.append(acc)
        return len(self.accessors) - 1


def _tangents(normals):
    """Any unit vector perpendicular to each normal. Our textures use a flat normal map
    and palette UVs (no UV gradient), so the exact tangent direction does not matter,
    but the game needs a valid one."""
    ref = np.where(np.abs(normals[:, 1:2]) < 0.9, [[0.0, 1.0, 0.0]], [[1.0, 0.0, 0.0]])
    t = np.cross(ref, normals)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    return np.hstack([t, np.ones((len(t), 1))]).astype(np.float32)


def write_glb(path, skeleton: Skeleton, meshes):
    """meshes: list of dicts with keys
         name      node name, e.g. "osrs_0.0"
         material  .mdl material path, e.g. "/mt_c0201e0279_top_a.mtrl"
         positions (N,3) float  FFXIV model space, metres, Y up, +Z forward
         normals   (N,3) float
         uvs       (N,2) float  glTF convention (v down)
         tangents  (N,4) float  optional; xyz + bitangent sign
         colors    (N,4) float  vertex colour, 0..1
         joints    (N,4) int    skeleton bone indices
         weights   (N,4) float
         indices   (M,) int
         attributes  list of attribute names (e.g. ["atr_ude"]), optional
    """
    b = _Builder()
    nodes = []
    # Full skeleton hierarchy as glTF nodes, so the file also previews correctly in Blender.
    for i, (name, parent, t, r, s) in enumerate(skeleton.bones):
        nodes.append({"name": name, "translation": list(map(float, t)),
                      "rotation": list(map(float, r)), "scale": list(map(float, s))})
    for i, p in enumerate(skeleton.parents):
        if p >= 0:
            nodes[p].setdefault("children", []).append(i)
    roots = [i for i, p in enumerate(skeleton.parents) if p < 0]

    gl_meshes, materials, skins, mesh_nodes = [], [], [], []
    mat_index = {}
    for m in meshes:
        used = sorted(set(np.asarray(m["joints"])[np.asarray(m["weights"]) > 0].tolist()))
        remap = {bone: j for j, bone in enumerate(used)}
        joints_local = np.vectorize(lambda v: remap.get(v, 0))(np.asarray(m["joints"])).astype(np.uint16)
        ibm = np.array([np.linalg.inv(skeleton.world[bone]).T.reshape(-1) for bone in used], dtype=np.float32)
        skins.append({"joints": used, "inverseBindMatrices": b.add(ibm, FLOAT, "MAT4"), "skeleton": roots[0]})

        if m["material"] not in mat_index:
            mat_index[m["material"]] = len(materials)
            materials.append({"name": m["material"]})
        idx = np.asarray(m["indices"])
        attrs = {
            "POSITION": b.add(np.asarray(m["positions"], np.float32), FLOAT, "VEC3", ARRAY_BUFFER, minmax=True),
            "NORMAL": b.add(np.asarray(m["normals"], np.float32), FLOAT, "VEC3", ARRAY_BUFFER),
            "TANGENT": b.add(np.asarray(m["tangents"], np.float32) if m.get("tangents") is not None
                             else _tangents(np.asarray(m["normals"], np.float64)), FLOAT, "VEC4", ARRAY_BUFFER),
            "TEXCOORD_0": b.add(np.asarray(m["uvs"], np.float32), FLOAT, "VEC2", ARRAY_BUFFER),
            "COLOR_0": b.add(np.asarray(m["colors"], np.float32), FLOAT, "VEC4", ARRAY_BUFFER),
            "JOINTS_0": b.add(joints_local, USHORT, "VEC4", ARRAY_BUFFER),
            "WEIGHTS_0": b.add(np.asarray(m["weights"], np.float32), FLOAT, "VEC4", ARRAY_BUFFER),
        }
        ind = b.add(idx.astype(np.uint32 if idx.max() > 65535 else np.uint16),
                    UINT if idx.max() > 65535 else USHORT, "SCALAR", ELEMENT_ARRAY_BUFFER)
        gl_meshes.append({"name": m["name"], "primitives": [
            {"attributes": attrs, "indices": ind, "material": mat_index[m["material"]], "mode": 4}]})
        node = {"name": m["name"], "mesh": len(gl_meshes) - 1, "skin": len(skins) - 1}
        if m.get("attributes"):
            node["extras"] = {a: True for a in m["attributes"]}
        mesh_nodes.append(len(nodes))
        nodes.append(node)

    gltf = {
        "asset": {"version": "2.0", "generator": "griffith-to-xiv"},
        "scene": 0,
        "scenes": [{"nodes": roots + mesh_nodes}],
        "nodes": nodes,
        "meshes": gl_meshes,
        "materials": materials,
        "skins": skins,
        "accessors": b.accessors,
        "bufferViews": b.views,
        "buffers": [{"byteLength": len(b.blob)}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    blob = bytes(b.blob) + b"\0" * (-len(b.blob) % 4)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(blob), 0x004E4942) + blob)
