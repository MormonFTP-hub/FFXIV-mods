"""FFXIV skeleton helpers: world-space bind pose from an .sklb."""
import numpy as np
from havok_tagfile import read_sklb


def quat_to_mat(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


class Skeleton:
    def __init__(self, path):
        self.bones = read_sklb(path)
        self.names = [b[0] for b in self.bones]
        self.parents = [b[1] for b in self.bones]
        self.index = {n: i for i, n in enumerate(self.names)}
        self.world = []  # 4x4 bind-pose world matrices
        for name, parent, t, r, s in self.bones:
            local = np.eye(4)
            local[:3, :3] = quat_to_mat(r) * np.array(s)
            local[:3, 3] = t
            self.world.append(local if parent < 0 else self.world[parent] @ local)
        self.world = np.array(self.world)

    def pos(self, name):
        return self.world[self.index[name]][:3, 3].copy()
