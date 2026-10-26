"""Read the built chocobo body .mdl back (as the game data tools see it) and render it in the test pose."""
import sys

import numpy as np

import xivdata as xd
from preview import write_static_gltf
from preview_fit import OUT, render
from preview_skin import POSES, deform, pose_matrices
from reshape import SKEL
from xiv_skeleton import Skeleton

TEXTURES = {"a": "spectraltiger/spectralridingtigerarmored.png", "b": "spectraltiger/spectralridingtigersaddle.png",
            "c": "frostsabre/pvpridingtigereyeglowgreen.png"}


def main(pose="test", views="left,persp"):
    skel = Skeleton(SKEL)
    mdl = xd.model(xd.os.path.join(xd.ROOT, "work", "build", "mdl", "choco_top.mdl"))
    D = pose_matrices(skel, POSES[pose]) if pose != "bind" else np.tile(np.eye(4), (len(skel.names), 1, 1))
    out = []
    for i, m in enumerate(mdl["meshes"]):
        j = np.array([[skel.index[b] if b else 0 for b in row] for row in m["bones"]])
        p, n = deform(m["pos"], m["nrm"], j, m["weights"], D)
        tex = xd.os.path.join(xd.ROOT, "source", "wow", "creature", TEXTURES[m["material"][-6]])
        out.append({"name": f"mdl{i}", "positions": p, "normals": n, "uvs": m["uv"], "indices": m["faces"].reshape(-1), "texture": tex})
        print(m["material"], len(m["pos"]), "verts, weight sums", m["weights"].sum(1).min().round(3), m["weights"].sum(1).max().round(3))
    src = OUT / f"mdl_{pose}.gltf"
    write_static_gltf(src, out)
    render(src, OUT / f"mdl_{pose}", views)
    print("rendered", OUT / f"mdl_{pose}_*.png")


if __name__ == "__main__":
    main(*sys.argv[1:])
