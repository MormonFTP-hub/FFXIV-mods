"""Linear blend skinning for previews: pose a skeleton with world-space joint rotations, deform meshes."""
import numpy as np


def axis_angle(axis, deg):
    axis = np.asarray(axis, float) / np.linalg.norm(axis)
    a = np.radians(deg)
    K = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
    return np.eye(3) + np.sin(a) * K + (1 - np.cos(a)) * K @ K


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
