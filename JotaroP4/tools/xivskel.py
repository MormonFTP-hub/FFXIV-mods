"""FFXIV c0101 base skeleton: bone names, parents, local pose and world bind matrices (metres, Y up, +Z forward)."""
import os

import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from havok_tagfile import read_sklb_skeleton

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKLB = os.path.join(ROOT, "work", "game", "chara", "human", "c0101", "skeleton", "base", "b0001", "skl_c0101b0001.sklb")


def quat_to_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


class Skeleton:
    """Same interface gltf_writer expects: bones [(name, parent, t, r, s)], names, parents, index, world."""

    def __init__(self, path=SKLB):
        names, parents, pose = read_sklb_skeleton(open(path, "rb").read())
        self.bones = [(n, p, list(t), list(r), list(s)) for n, p, (t, r, s) in zip(names, parents, pose)]
        self.names = list(names)
        self.parents = list(parents)
        self.index = {n: i for i, n in enumerate(self.names)}
        world = []
        for name, parent, t, r, s in self.bones:
            local = np.eye(4)
            local[:3, :3] = quat_to_mat(r) * np.array(s)
            local[:3, 3] = t
            world.append(local if parent < 0 else world[parent] @ local)
        self.world = np.array(world)

    def pos(self, name):
        return self.world[self.index[name]][:3, 3].copy()

    def parent_name(self, name):
        p = self.parents[self.index[name]]
        return self.names[p] if p >= 0 else None


if __name__ == "__main__":
    sk = Skeleton()
    print(len(sk.names), "bones")
    for i, n in enumerate(sk.names):
        p = sk.world[i][:3, 3]
        print(f"{i:3d} {n:20s} parent={sk.parent_name(n) or '-':20s} pos=({p[0]:.4f}, {p[1]:.4f}, {p[2]:.4f})")
