"""Summarise the wow.export glTF: meshes, materials, skeleton and animations."""
import json
import sys
from pathlib import Path

import numpy as np

SRC = Path(__file__).resolve().parents[1] / "source/wow/creature/dragonhawk2voidmount/dragonhawk2voidmount.gltf"

COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


class Gltf:
    def __init__(self, path=SRC):
        self.path = Path(path)
        self.j = json.loads(self.path.read_text())
        self.buffers = {}

    def buffer(self, i):
        if i not in self.buffers:
            self.buffers[i] = (self.path.parent / self.j["buffers"][i]["uri"]).read_bytes()
        return self.buffers[i]

    def accessor(self, i):
        a = self.j["accessors"][i]
        bv = self.j["bufferViews"][a["bufferView"]]
        data = self.buffer(bv["buffer"])
        dt = COMP[a["componentType"]]
        n = NCOMP[a["type"]]
        off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        stride = bv.get("byteStride")
        item = np.dtype(dt).itemsize * n
        if stride and stride != item:
            raw = np.frombuffer(data, np.uint8, count=stride * (a["count"] - 1) + item, offset=off)
            idx = np.arange(a["count"])[:, None] * stride + np.arange(item)
            arr = raw[idx].view(dt).reshape(a["count"], n)
        else:
            arr = np.frombuffer(data, dt, count=a["count"] * n, offset=off).reshape(a["count"], n)
        if a.get("normalized"):
            arr = arr.astype(np.float32) / np.iinfo(dt).max
        return arr


def main():
    g = Gltf()
    j = g.j
    print("asset", j.get("asset"))
    print("scenes", len(j.get("scenes", [])), "nodes", len(j["nodes"]), "meshes", len(j["meshes"]),
          "materials", len(j.get("materials", [])), "skins", len(j.get("skins", [])), "anims", len(j.get("animations", [])))
    for i, m in enumerate(j.get("materials", [])):
        print("mat", i, m.get("name"), json.dumps({k: v for k, v in m.items() if k != "name"})[:200])
    for i, t in enumerate(j.get("textures", [])):
        print("tex", i, j["images"][t["source"]].get("uri"))
    allpos = []
    for i, m in enumerate(j["meshes"]):
        for p in m["primitives"]:
            pos = g.accessor(p["attributes"]["POSITION"])
            allpos.append(pos)
            print(f"mesh {i} '{m.get('name')}' mat={p.get('material')} verts={len(pos)} tris={j['accessors'][p['indices']]['count'] // 3} "
                  f"attrs={sorted(p['attributes'])} bbox={pos.min(0).round(2)}..{pos.max(0).round(2)}")
    allpos = np.concatenate(allpos)
    print("total bbox", allpos.min(0).round(3), allpos.max(0).round(3))
    skin = j["skins"][0]
    joints = skin["joints"]
    print("joints", len(joints))
    parent = {}
    for ni, n in enumerate(j["nodes"]):
        for c in n.get("children", []):
            parent[c] = ni
    ibm = g.accessor(skin["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
    for k, ni in enumerate(joints):
        n = j["nodes"][ni]
        world = np.linalg.inv(ibm[k])[:3, 3]
        depth = 0
        p = ni
        while p in parent:
            p = parent[p]
            depth += 1
        print(f"  {k:3d} {'  ' * min(depth, 12)}{n.get('name')} t={np.round(n.get('translation', [0, 0, 0]), 3).tolist()} world={world.round(3).tolist()}")
    print("animations:")
    for i, a in enumerate(j.get("animations", [])):
        tmax = 0
        for s in a["samplers"]:
            tmax = max(tmax, j["accessors"][s["input"]].get("max", [0])[0])
        print(f"  {i:3d} {a.get('name')} channels={len(a['channels'])} len={tmax:.2f}s")


if __name__ == "__main__":
    main()
