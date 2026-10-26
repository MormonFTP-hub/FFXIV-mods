"""Extract the Lich King and Frostmourne from source/lichking/lichking.mb into work/src/src.pkl.

Replays the scene's polygon history (mbmesh.py) at the bind pose, applies its smoothing, and converts to
FFXIV axes (metres, Y up, +Z forward, +X = character's left). The scene's mesh space is cm with Y up,
+X forward and +Z to the character's right.

src.pkl: {"lichking": {pos, faces (F,3), uv (F,3,2) per corner, material (F,), weights (V,J), joints [J]},
          "frostmourne": {pos, faces, uv, material},
          "skeleton": {name: (parent, 4x4 world bind matrix, column-vector convention)}}
"""
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mbmesh as mm  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MB = os.path.join(ROOT, "source", "lichking", "lichking.mb")
OUT = os.path.join(ROOT, "work", "src", "src.pkl")
SMOOTH = True
AXES = np.array([[0, 0, -1], [0, 1, 0], [1, 0, 0]], float)  # scene mesh space -> FFXIV axes
SCALE = 0.01  # cm -> m


def shading_groups(shape, mesh):
    """Shading group name per face, from the shape's instObjGroups and the replayed group bits."""
    S = mm.SCENE
    og_sg, gid_og = {}, {}
    prefix = f"{shape}.iog.og["
    for a, b in S["cons"]:
        if b.startswith(prefix):
            og = b[len(prefix):].split("]")[0]
            if b.endswith(".gco"):
                og_sg[og] = a.split(".")[0]
            elif b.endswith(".gid"):
                gid_og[a.split(".")[0]] = og
    bit_sg = {}
    for node, bit in mm.GROUP_BITS.items():
        sg = og_sg.get(gid_og.get(node))
        if sg and not sg.endswith("Set") and not sg.endswith("Set1"):
            bit_sg[bit] = sg
    out = []
    for g in mesh.groups:
        names = [sg for bit, sg in bit_sg.items() if g >> bit & 1]
        assert len(names) == 1, names
        out.append(names[0])
    return np.array(out)


def triangulate(mesh, material):
    faces, uv, mat = [], [], []
    for f, fu, m in zip(mesh.faces, mesh.fuv, material):
        for k in range(1, len(f) - 1):
            faces.append([f[0], f[k], f[k + 1]])
            uv.append([mesh.uv[fu[0]], mesh.uv[fu[k]], mesh.uv[fu[k + 1]]])
            mat.append(m)
    return np.array(faces), np.array(uv), np.array(mat)


def evaluate(shape, orig, chain_stop, cluster=None):
    blob = mm.read_mesh_blob(mm.node_attrs(orig)["o"][3])
    W = joints = gm = pm = None
    if cluster:
        W, joints, pm, gm = mm.skin_weights(cluster, len(blob["P"]))
    mesh = mm.Mesh(blob, W)
    if cluster:
        mm.apply_history(mesh, mm.history_chain(f"{cluster}.ip[0].ig", orig))
    mm.apply_history(mesh, mm.history_chain(f"{shape}.i", chain_stop), smooth=SMOOTH)
    for line in mesh.log:
        if "GRPP" not in line:
            print("   ", line)
    faces, uv, mat = triangulate(mesh, shading_groups(shape, mesh))
    out = dict(pos=np.array(mesh.P) @ AXES.T * SCALE, faces=faces, uv=uv, material=mat)
    if cluster:
        out["weights"] = np.array(mesh.W)
        out["joints"] = joints
    return out, gm, pm


def skeleton(gm, pm, joints):
    """Bind matrices: inverse bindPreMatrix for skin influences, else the joint's bindPose; both are world
    space, where the mesh sits at local @ gm (Maya row vectors)."""
    out = {}
    inv_gm = np.linalg.inv(gm)
    slot = {n: i for i, n in enumerate(joints)}
    for name, (parent, bps) in mm.joints().items():
        B = np.linalg.inv(pm[slot[name]]) if name in slot else bps
        if B is None:
            continue
        L = B @ inv_gm  # row-vector matrix in mesh space
        M = np.eye(4)
        M[:3, :3] = AXES @ L[:3, :3].T  # columns: joint axes in FFXIV axes
        M[:3, 3] = AXES @ L[3, :3] * SCALE
        out[name] = (parent, M)
    return out


def main():
    mm.load(MB)
    print("lichking")
    lk, gm, pm = evaluate("lichkingShape", "lichkingShapeOrig", "skinCluster1", cluster="skinCluster1")
    print("frostmourne")
    fm, _, _ = evaluate("frostmourneShape", "frostmourneShape1", "frostmourneShape1")
    skel = skeleton(gm, pm, lk["joints"])
    for k, m in (("lichking", lk), ("frostmourne", fm)):
        u, n = np.unique(m["material"], return_counts=True)
        print(f"{k}: {len(m['pos'])} verts, {len(m['faces'])} tris, bbox {m['pos'].min(0).round(3)} .. "
              f"{m['pos'].max(0).round(3)}\n    materials {dict(zip(u.tolist(), n.tolist()))}")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    pickle.dump({"lichking": lk, "frostmourne": fm, "skeleton": skel}, open(OUT, "wb"))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
