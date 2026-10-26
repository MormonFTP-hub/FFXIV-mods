"""FFXIV skeleton reference pose as world matrices (Y up, +Z forward, meters)."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from havok_tagfile import read_sklb_skeleton


def quat_to_mat(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def load(path):
    names, parents, pose = read_sklb_skeleton(open(path, "rb").read())
    local = []
    for t, q, s in pose:
        m = np.eye(4)
        m[:3, :3] = quat_to_mat(q) * np.asarray(s)[None, :]
        m[:3, 3] = t
        local.append(m)
    world = [None] * len(names)
    for i in range(len(names)):
        p = parents[i]
        world[i] = local[i] if p < 0 else world[p] @ local[i]
    return names, list(parents), local, world
