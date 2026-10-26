"""Render the fitted Chao over the mammet (bind pose) and the skinned Chao in test poses: work/preview/fit_*.png.

python -P tools/check_fit.py [bind|wave|walk|look] [views]
"""
import sys

import numpy as np

import fit
from preview import bone_markers, write_static_gltf
from render import OUT, render
from skinning import deform, pose_matrices
from xiv_skeleton import Skeleton

TEXTURES = {"c": "al_hcha00.png", "d": "al_hcha01.png", "e": "al_hcha02.png", "f": "HeroChaosChaoEyeColor.png"}
# world-space rotations about joints (x = left, y = up, z = forward)
POSES = {
    "wave": {"j_ude_a_l": ([0, 0, 1], 100), "j_ude_b_l": ([1, 0, 0], -60), "j_kao": ([0, 1, 0], 30),
             "j_asi_a_r": ([1, 0, 0], -40), "j_asi_b_r": ([1, 0, 0], 50)},
    "walk": {"j_asi_a_l": ([1, 0, 0], -35), "j_asi_a_r": ([1, 0, 0], 30), "j_ude_a_l": ([1, 0, 0], 35),
             "j_ude_a_r": ([1, 0, 0], -35), "j_sebo_a": ([0, 1, 0], 10)},
    "look": {"j_kao": ([1, 0, 0], 25), "j_kubi": ([0, 0, 1], 15), "j_sebo_a": ([1, 0, 0], 15)},
}


def weight_meshes(skel):
    """Chao triangles grouped and coloured by the dominant bone of their first vertex."""
    fixed = {"j_kao": (0.9, 0.2, 0.2), "j_sebo_a": (0.3, 0.8, 0.3), "j_kosi": (0.2, 0.4, 0.95),
             "j_ude_a_l": (0.95, 0.85, 0.2), "j_ude_b_l": (0.95, 0.5, 0.1), "j_ude_a_r": (0.95, 0.85, 0.2),
             "j_ude_b_r": (0.95, 0.5, 0.1), "j_asi_a_l": (0.7, 0.3, 0.9), "j_asi_b_l": (0.2, 0.9, 0.9),
             "j_asi_a_r": (0.7, 0.3, 0.9), "j_asi_b_r": (0.2, 0.9, 0.9)}
    colors = {n: (*fixed.get(n, (0.6, 0.6, 0.6)), 1) for n in skel.names}
    out = []
    for m in fit.chao(skel):
        tri = m["indices"].reshape(-1, 3)
        dom = m["joints"][tri[:, 0], np.argmax(m["weights"][tri[:, 0]], axis=1)]
        for b in np.unique(dom):
            t = tri[dom == b].reshape(-1)
            out.append({"name": f"{m['suffix']}_{skel.names[b]}", "positions": m["positions"][t], "normals": m["normals"][t],
                        "indices": np.arange(len(t)), "color": colors[skel.names[b]]})
    return out


def main(pose="bind", views="front,left,persp"):
    skel = Skeleton(fit.SKEL)
    if pose == "weights":
        src = OUT / "fit_weights.gltf"
        write_static_gltf(src, weight_meshes(skel))
        render(src, OUT / "fit_weights", views)
        return
    meshes = []
    D = pose_matrices(skel, POSES[pose]) if pose != "bind" else np.tile(np.eye(4), (len(skel.names), 1, 1))
    for m in fit.chao(skel):
        p, n = deform(m["positions"], m["normals"], m["joints"], m["weights"], D)
        meshes.append({"name": f"chao_{m['suffix']}", "positions": p, "normals": n, "uvs": m["uvs"],
                       "indices": m["indices"], "texture": str(fit.chaosrc.SRC + "/" + TEXTURES[m["suffix"]])})
    if pose == "bind":
        body = fit.mammet(skel)[0]
        meshes.append({"name": "mammet", "positions": body["pos"] + [0.45, 0, 0], "normals": body["nrm"],
                       "indices": body["faces"].reshape(-1), "color": (0.9, 0.55, 0.2, 1)})
        pts = np.array([w[:3, 3] for w in skel.world])
        meshes.append({"name": "joints", **bone_markers(np.vstack([pts, pts + [0.45, 0, 0]]), 0.008), "color": (1, 0, 0, 1)})
    OUT.mkdir(parents=True, exist_ok=True)
    src = OUT / f"fit_{pose}.gltf"
    write_static_gltf(src, meshes)
    render(src, OUT / f"fit_{pose}", views)
    print("rendered", OUT / f"fit_{pose}_*.png")


if __name__ == "__main__":
    main(*sys.argv[1:])
