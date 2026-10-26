"""Render the source skinned into one of the viewer's animation poses (scene.json "poses"), textured.

usage: python -P -E tools/look_pose.py <pose> [views] [head]  ->  work/preview/pose_<pose>[_head]_sheet.png
"head" frames the head only. Joints the pose scales to zero drop their triangles, as in the viewer.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402
import srcdata as sd  # noqa: E402


def skin(m, pose):
    """Posed positions and a per-vertex 'visible' mask (at most half its weight on joints scaled below 1%)."""
    sk = sd.scene()["skins"][0]
    bind = np.array(sk["bind"])
    P = np.array(sk["poses"][pose])
    S = P @ np.linalg.inv(bind)
    v4 = np.c_[m["pos"], np.ones(len(m["pos"]))]
    out = np.zeros((len(v4), 3))
    for k in range(8):
        w = m["weights"][:, k]
        out += w[:, None] * np.einsum("nij,nj->ni", S[m["joints"][:, k]], v4)[:, :3]
    scale = np.linalg.norm(P[:, :3, :3], axis=1).mean(1)
    gone = np.zeros(len(v4))
    for k in range(8):
        gone += m["weights"][:, k] * (scale[m["joints"][:, k]] < 0.01)
    return out, gone <= 0.5


if __name__ == "__main__":
    pose = sys.argv[1]
    views = sys.argv[2] if len(sys.argv) > 2 else "front,side,back"
    head = len(sys.argv) > 3 and sys.argv[3] == "head"
    m = sd.mesh()
    pos, vis = skin(m, pose)
    groups = []
    for mi, name in enumerate(m["materials"]):
        f = m["faces"][m["mat"] == mi]
        f = f[vis[f].all(1)]
        if not len(f):
            continue
        used, remap = np.unique(f, return_inverse=True)
        tex = sd.material(name)["textures"].get("color")
        groups.append(dict(name=f"m{mi}", pos=pos[used], faces=remap.reshape(-1, 3),
                           uv=np.c_[m["uv0"][used, 0], 1 - m["uv0"][used, 1]],
                           texture=os.path.join(sd.TEX, tex + ".png") if tex else None))
    out = os.path.join(preview.ROOT, "work", "preview")
    os.makedirs(out, exist_ok=True)
    obj = os.path.join(out, f"pose_{pose}.obj")
    preview.write_obj(obj, groups)
    region = None
    if head:
        hp = np.array(sd.scene()["skins"][0]["poses"][pose])[sd.scene()["skins"][0]["joints"].index("Head")][:3, 3]
        region = (hp + [-0.2, -0.15, -0.2], hp + [0.2, 0.3, 0.2])
    print(preview.render(obj, os.path.join(out, f"pose_{pose}" + ("_head" if head else "")), views, 900, region))
