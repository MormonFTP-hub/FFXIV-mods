"""Render the reshaped WoW tiger next to/over the vanilla FFXIV tiger, with FFXIV joints marked."""
import subprocess
import sys
from pathlib import Path

import numpy as np

import xivdata as xd
from preview import bone_markers, write_static_gltf
from reshape import SKEL, reshape
from wowsrc import WowModel
from xiv_skeleton import Skeleton

BLENDER = r"E:\FFXIV-mods\Aerith\apps\blender-4.5.14-windows-x64\blender.exe"
OUT = Path(xd.ROOT) / "work/preview"


def render(src, prefix, views):
    subprocess.run([BLENDER, "-b", "-P", str(Path(__file__).parent / "blender/render_views.py"), "--",
                    str(src), str(prefix), views], check=True, capture_output=True)


def main(views="left,front,top,persp", offset=0.0):
    skel = Skeleton(SKEL)
    wow = reshape(WowModel(), skel)
    van = xd.model(xd.local("chara/monster/m0464/obj/body/b0001/model/m0464b0001.mdl"))["meshes"][0]
    meshes = []
    for i, m in enumerate(wow):
        meshes.append({"name": f"wow{i}", "positions": m["positions"] + [offset, 0, 0], "normals": m["normals"],
                       "uvs": m["uvs"], "indices": m["indices"], "texture": m["texture"]})
    meshes.append({"name": "xiv", "positions": van["pos"], "normals": van["nrm"], "indices": van["faces"].reshape(-1),
                   "color": (0.9, 0.55, 0.2, 1)})
    pts = np.array([skel.world[i][:3, 3] for i, n in enumerate(skel.names) if n.startswith("j_")])
    meshes.append({"name": "joints", **bone_markers(pts), "color": (1, 0, 0, 1)})
    OUT.mkdir(parents=True, exist_ok=True)
    src = OUT / "fit.gltf"
    write_static_gltf(src, meshes)
    render(src, OUT / ("fit" if not offset else "fit_apart"), views)
    print("rendered", OUT / "fit_*.png")


if __name__ == "__main__":
    main(*(sys.argv[1:2] or []), *(map(float, sys.argv[2:3])))
