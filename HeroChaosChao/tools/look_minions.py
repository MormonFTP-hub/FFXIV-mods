"""Render candidate minion models side by side (front + side), with their joints: work/preview/minions_*.png."""
import sys

import numpy as np

import xivdata as xd
from preview import bone_markers, write_static_gltf
from render import OUT, render
from xiv_skeleton import Skeleton

COLORS = [(0.9, 0.55, 0.2, 1), (0.3, 0.6, 0.9, 1), (0.5, 0.8, 0.4, 1), (0.85, 0.4, 0.7, 1), (0.8, 0.8, 0.3, 1), (0.6, 0.6, 0.6, 1)]


def main(models="8001,8080,8081,8188,8202", views="front,left"):
    meshes, x = [], 0.0
    for k, m in enumerate(int(v) for v in models.split(",")):
        base = f"chara/monster/m{m:04d}"
        skel = Skeleton(xd.extract(f"{base}/skeleton/base/b0001/skl_m{m:04d}b0001.sklb")[0])
        mdl = xd.model(f"{base}/obj/body/b0001/model/m{m:04d}b0001.mdl")
        lo = np.min([me["pos"].min(0) for me in mdl["meshes"]], 0)
        hi = np.max([me["pos"].max(0) for me in mdl["meshes"]], 0)
        off = np.array([x - lo[0], 0, 0])
        print(f"m{m}: size {np.round(hi - lo, 3)}, {len(skel.names)} bones: {' '.join(skel.names)}")
        for i, me in enumerate(mdl["meshes"]):
            meshes.append({"name": f"m{m}_{i}", "positions": me["pos"] + off, "normals": me["nrm"],
                           "indices": me["faces"].reshape(-1), "color": COLORS[k % len(COLORS)]})
        pts = np.array([w[:3, 3] for w in skel.world]) + off
        meshes.append({"name": f"joints{m}", **bone_markers(pts, 0.006), "color": (1, 0, 0, 1)})
        x += hi[0] - lo[0] + 0.1
    OUT.mkdir(parents=True, exist_ok=True)
    src = OUT / "minions.gltf"
    write_static_gltf(src, meshes)
    render(src, OUT / "minions", views)


if __name__ == "__main__":
    main(*sys.argv[1:])
