"""The wow.export glTF of the Swift Spectral Tiger, converted to FFXIV model space.

WoW glTF: +X forward, +Y up, +Z right. FFXIV: +Z forward, +Y up, +X left.
"""
from pathlib import Path

import numpy as np

from inspect_src import Gltf

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "source/wow/creatures/SwiftSpectralTiger.gltf"
# rows: FFXIV x, y, z in terms of WoW X, Y, Z
TO_XIV = np.array([[0, 0, -1], [0, 1, 0], [1, 0, 0]], np.float64)


class WowModel:
    def __init__(self, path=SRC):
        self.g = Gltf(path)
        j = self.g.j
        skin = j["skins"][0]
        self.joint_nodes = skin["joints"]
        self.names = [j["nodes"][n]["name"].removeprefix("bone_") for n in self.joint_nodes]
        node_parent = {}
        for ni, n in enumerate(j["nodes"]):
            for c in n.get("children", []):
                node_parent[c] = ni
        jindex = {n: k for k, n in enumerate(self.joint_nodes)}
        self.parents = [jindex.get(node_parent.get(n, -1), -1) for n in self.joint_nodes]
        ibm = self.g.accessor(skin["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
        self.joint_pos = np.array([TO_XIV @ np.linalg.inv(m)[:3, 3] for m in ibm])
        self.meshes = []
        for mi, m in enumerate(j["meshes"]):
            for p in m["primitives"]:
                a = p["attributes"]
                mat = j["materials"][p["material"]]
                tex = j["images"][j["textures"][mat["pbrMetallicRoughness"]["baseColorTexture"]["index"]]["source"]]["uri"]
                self.meshes.append({
                    "index": mi,
                    "material": mat["name"],
                    "texture": (SRC.parent / tex.replace("\\", "/")).resolve(),
                    "positions": self.g.accessor(a["POSITION"]).astype(np.float64) @ TO_XIV.T,
                    "normals": self.g.accessor(a["NORMAL"]).astype(np.float64) @ TO_XIV.T,
                    "uvs": self.g.accessor(a["TEXCOORD_0"]).astype(np.float64),
                    "joints": self.g.accessor(a["JOINTS_0"]).astype(np.int64),
                    "weights": self.g.accessor(a["WEIGHTS_0"]).astype(np.float64),
                    "indices": self.g.accessor(p["indices"]).reshape(-1).astype(np.int64),
                })
