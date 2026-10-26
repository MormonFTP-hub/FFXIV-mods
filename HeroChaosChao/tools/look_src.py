"""Render the source Chao (textured) from a few angles: work/preview/src_*.png."""
import sys

import chaosrc
from preview import write_static_gltf
from render import OUT, render


def main(views="front,left,back,persp"):
    meshes = []
    for i, pc in enumerate(chaosrc.load()):
        m = {"name": f"{i:02d}_{pc['object'][:3]}", "positions": pc["positions"], "normals": pc["normals"],
             "indices": pc["indices"]}
        if pc["texture"]:
            # OBJ v is up; glTF v is down
            m.update(uvs=pc["uvs"] * [1, -1] + [0, 1], texture=pc["texture"])
        else:
            m["color"] = (*pc["kd"], 1)
        meshes.append(m)
    OUT.mkdir(parents=True, exist_ok=True)
    src = OUT / "src.gltf"
    write_static_gltf(src, meshes)
    render(src, OUT / "src", views)
    print("rendered", OUT / "src_*.png")


if __name__ == "__main__":
    main(*sys.argv[1:])
