"""Wavefront OBJ reader: one mesh per 'o' block, split into unique (position, uv, normal) vertices.

Positions stay in the file's own space (metres, Y up, +Z forward, +X = character's left),
which is already FFXIV's model space. UVs keep the OBJ convention (v up).
"""
import numpy as np


def load_obj(path):
    pos, uv, nrm = [], [], []
    objects = []  # name, material, corner triples
    cur = None
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith("v "):
                pos.append(line.split()[1:4])
            elif line.startswith("vt "):
                uv.append(line.split()[1:3])
            elif line.startswith("vn "):
                nrm.append(line.split()[1:4])
            elif line.startswith("o "):
                cur = {"name": line[2:].strip(), "material": None, "corners": []}
                objects.append(cur)
            elif line.startswith("usemtl "):
                cur["material"] = line[7:].strip()
            elif line.startswith("f "):
                c = [tuple(int(x) if x else 0 for x in tok.split("/")) for tok in line.split()[1:]]
                for i in range(1, len(c) - 1):  # fan-triangulate
                    cur["corners"] += [c[0], c[i], c[i + 1]]
    pos = np.array(pos, float)
    uv = np.array(uv, float)
    nrm = np.array(nrm, float)
    meshes = {}
    for o in objects:
        corners = np.array([(t + (0, 0))[:3] for t in o["corners"]], np.int64) - 1  # (v, vt, vn), 0-based
        keys, inverse = np.unique(corners, axis=0, return_inverse=True)
        meshes[o["name"]] = {
            "name": o["name"],
            "material": o["material"],
            "pos": pos[keys[:, 0]],
            "uv": uv[keys[:, 1]] if len(uv) else np.zeros((len(keys), 2)),
            "nrm": nrm[keys[:, 2]] if len(nrm) else np.zeros((len(keys), 3)),
            "pos_id": keys[:, 0],  # shared position index, to weld seams when needed
            "faces": inverse.reshape(-1, 3),
        }
    return meshes
