"""Binary STL reader: welds the triangle soup into an indexed mesh."""
import numpy as np


def read(path):
    """Returns (verts float32 Nx3, faces int32 Mx3), with identical corner positions welded."""
    with open(path, "rb") as f:
        f.seek(80)
        n = int(np.frombuffer(f.read(4), "<u4")[0])
        rec = np.frombuffer(f.read(n * 50), np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")]))
    corners = rec["v"].reshape(-1, 3)
    verts, inv = np.unique(corners, axis=0, return_inverse=True)
    faces = inv.reshape(-1, 3).astype(np.int32)
    keep = (faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (faces[:, 0] != faces[:, 2])
    return verts.astype(np.float32), faces[keep]


def components(nv, faces):
    """Connected-component label per vertex (min-label propagation over face edges)."""
    lab = np.arange(nv)
    e = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    while True:
        m = np.minimum(lab[e[:, 0]], lab[e[:, 1]])
        new = lab.copy()
        np.minimum.at(new, e[:, 0], m)
        np.minimum.at(new, e[:, 1], m)
        new = new[new]
        if np.array_equal(new, lab):
            break
        lab = new
    return lab
