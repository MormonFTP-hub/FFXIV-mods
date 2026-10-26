"""Pose the rigged tiger (and the vanilla FFXIV tiger, for comparison) with a test pose and render it."""
import sys

import numpy as np

import xivdata as xd
from preview import write_static_gltf
from preview_fit import OUT, render
from reshape import SKEL, reshape
from weights import VANILLA, skin
from wowsrc import WowModel
from xiv_skeleton import Skeleton


def axis_angle(axis, deg):
    axis = np.asarray(axis, float) / np.linalg.norm(axis)
    a = np.radians(deg)
    K = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
    return np.eye(3) + np.sin(a) * K + (1 - np.cos(a)) * K @ K


# world-space rotations about each joint (x = left, y = up, z = forward)
POSES = {
    "test": {"j_leg_a_l": ([1, 0, 0], -35), "j_leg_b_l": ([1, 0, 0], 40), "j_arm_a_r": ([1, 0, 0], 35),
             "j_arm_c_r": ([1, 0, 0], -50), "j_neck_b": ([1, 0, 0], 25), "j_head": ([0, 1, 0], 25),
             "j_tail_b": ([1, 0, 0], -40), "j_tail_c": ([0, 1, 0], 40), "j_jaw": ([1, 0, 0], 30),
             "j_spine_b": ([0, 1, 0], 15), "j_hand_l": ([1, 0, 0], -60)},
}


def pose_matrices(skel, pose):
    D = []
    for i, n in enumerate(skel.names):
        M = np.eye(4)
        if n in pose:
            p = skel.world[i][:3, 3]
            R = axis_angle(*pose[n])
            M[:3, :3] = R
            M[:3, 3] = p - R @ p
        D.append(M if skel.parents[i] < 0 else D[skel.parents[i]] @ M)
    return np.array(D)


def deform(pos, nrm, joints, weights, D):
    P = np.zeros_like(pos)
    N = np.zeros_like(nrm)
    h = np.hstack([pos, np.ones((len(pos), 1))])
    for s in range(joints.shape[1]):
        M = D[joints[:, s]]
        w = weights[:, s][:, None]
        P += w * np.einsum("nij,nj->ni", M, h)[:, :3]
        N += w * np.einsum("nij,nj->ni", M[:, :3, :3], nrm)
    return P, N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)


def main(pose="test", views="left,persp,front", vanilla="1"):
    skel = Skeleton(SKEL)
    meshes = skin(reshape(WowModel(), skel), skel)
    D = pose_matrices(skel, POSES[pose])
    out = []
    for i, m in enumerate(meshes):
        p, n = deform(m["positions"], m["normals"], m["xiv_joints"], m["xiv_weights"], D)
        out.append({"name": f"wow{i}", "positions": p, "normals": n, "uvs": m["uvs"], "indices": m["indices"], "texture": m["texture"]})
    van = xd.model(xd.local(VANILLA))["meshes"][0]
    vj = np.array([[skel.index[b] if b else 0 for b in row] for row in van["bones"]])
    p, n = deform(van["pos"], van["nrm"], vj, van["weights"], D)
    if vanilla == "1":
        out.append({"name": "xiv", "positions": p + [0, 3.2, 0], "normals": n, "indices": van["faces"].reshape(-1), "color": (0.9, 0.55, 0.2, 1)})
    tag = pose if vanilla == "1" else pose + "_solo"
    src = OUT / f"skin_{tag}.gltf"
    write_static_gltf(src, out)
    render(src, OUT / f"skin_{tag}", views)
    print("rendered", OUT / f"skin_{tag}_*.png")


if __name__ == "__main__":
    main(*sys.argv[1:])
