"""Convert the FF7R Cloud Strife DAE into TexTools .db models rigged to the
Hyur Midlander male (c0101) skeleton.

Steps: Blender Z-up decimeters -> FFXIV Y-up meters, refit the arm and finger
chains to the FFXIV reference pose (linear blend skinning), remap the
FF7R joint weights onto FFXIV bones and write one .db per gear slot.
"""
import os
import pickle
import re
import sqlite3
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dae_reader  # noqa: E402
import xiv_skeleton  # noqa: E402

ROOT = os.path.dirname(HERE)
WORK = os.path.join(ROOT, "work")
SET = "e0263"
RACE = "c0101"

# Blender (x, y, z) in decimeters -> FFXIV (x, z, -y) in meters.
GLOBAL = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 10]], dtype=np.float64) * 0.1
GLOBAL[3, 3] = 1.0

# Which slot model and material each source mesh goes to. Materials are
# per-model letters; see build_materials.py for the textures behind them.
LAYOUT = {
    "top": [("a", ["Body A", "Shirt", "Skin", "Bandage"]), ("b", ["Body B", "Pants"])],
    "glv": [("a", ["Head", "Eyelashes"]), ("b", ["Hair", "Eyebrows"])],
    "dwn": [("a", ["Eyes"]), ("b", ["Mouth"])],
    "sho": [],
}

FINGERS = {"Index": "hito", "Middle": "naka", "Ring": "kusu", "Pinky": "ko", "Thumb": "oya"}


def weight_rule(name):
    """Map an FF7R joint name to [(ffxiv_bone, fraction)], or None to defer to the parent."""
    m = re.match(r"([LR])_(.*)", name)
    side, base = (m.group(1).lower(), m.group(2)) if m else (None, name)
    s = f"_{side}" if side else ""
    if name in ("C_Hip_a", "C_HipW_Spo", "C_HipW_End"):
        return [("j_kosi", 1.0)]
    if name in ("C_Spine_a", "C_Spine1W_Spo", "C_Spine1W_End"):
        return [("j_sebo_a", 1.0)]
    if name == "C_Spine_b":
        return [("j_sebo_b", 1.0)]
    if name == "C_Spine_c":
        return [("j_sebo_b", 0.5), ("j_sebo_c", 0.5)]
    if name in ("C_Spine_d", "C_Weapon_a", "C_Weapon_b"):
        return [("j_sebo_c", 1.0)]
    if re.match(r"C_Turtleneck|[LR]_Turtleneck", name):
        return [("j_sebo_c", 0.5), ("j_kubi", 0.5)]
    if name in ("C_Neck_a", "C_Neck1W_Spo", "C_Neck1W_End", "C_FaceBase_b", "C_Throat_B"):
        return [("j_kubi", 1.0)]
    if name in ("C_Head_a", "C_FaceBase_a", "C_HairBase_a"):
        return [("j_kao", 1.0)]
    if side is None:
        return None
    if base in ("Shoulder_a", "ShoulderSub_End") or base.startswith(("Bust", "StdBust", "StdTopBelt")):
        return [("j_sebo_c", 1.0)] if base.startswith(("Bust", "StdBust", "StdTopBelt")) else [(f"j_sako{s}", 1.0)]
    if base.startswith("ShoulderSub") or base.startswith("Deltoid"):
        return [(f"n_hkata{s}", 1.0)]
    if base.startswith("Shoulderpad"):
        return [(f"n_kataarmor{s}", 1.0)]
    if base == "UpperArm_a":
        return [(f"j_ude_a{s}", 1.0)]
    if base.startswith("Elbow"):
        return [(f"n_hhiji{s}", 1.0)]
    if base == "Forearm_a":
        return [(f"j_ude_b{s}", 1.0)]
    if base.startswith(("ForearmrollA", "Wrist")):
        return [(f"n_hte{s}", 1.0)]
    if base.startswith("ForearmrollB"):
        return [(f"n_hte{s}", 0.6), (f"j_ude_b{s}", 0.4)]
    if base.startswith("ForearmrollC"):
        return [(f"n_hte{s}", 0.3), (f"j_ude_b{s}", 0.7)]
    if base in ("Hand_a", "Weapon_a"):
        return [(f"j_te{s}", 1.0)]
    fm = re.match(r"(Index|Middle|Ring|Pinky|Thumb)_(a|b|c|End)", base)
    if fm:
        seg = "a" if fm.group(2) == "a" else "b"
        return [(f"j_{FINGERS[fm.group(1)]}_{seg}{s}", 1.0)]
    if base.startswith("Hip_"):
        return [("j_kosi", 0.5), (f"j_asi_a{s}", 0.5)]
    if base == "UpperLeg_a" or base.startswith(("Femoris", "StdFemoris", "StduPants", "uPants")):
        return [(f"j_asi_a{s}", 1.0)]
    if base.startswith("Knee"):
        return [(f"j_asi_b{s}", 1.0)]
    if base == "Foreleg_a" or base.startswith(("Calf", "StdCalf", "StdbPants", "bPants")):
        return [(f"j_asi_c{s}", 1.0)]
    if base == "Foot_a":
        return [(f"j_asi_d{s}", 1.0)]
    if base.startswith("Toe"):
        return [(f"j_asi_e{s}", 1.0)]
    return None


def resolve_rules(model):
    rules = {}
    for i, j in enumerate(model.joints):
        r = weight_rule(j.name)
        k = j.parent
        while r is None and k >= 0:
            r = weight_rule(model.joints[k].name)
            k = model.joints[k].parent
        rules[i] = r if r is not None else [("j_kosi", 1.0)]
    return rules


def rot_between(a, b):
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if np.linalg.norm(v) < 1e-9:
        return np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx * (1.0 / (1.0 + c))


def segment_delta(p_src, d_src, p_tgt, d_tgt, stretch=True):
    """World-space affine (A, t) moving the source segment onto the target one:
    x' = A x + t, rotating d_src onto d_tgt and scaling along the bone axis."""
    R = rot_between(d_src, d_tgt)
    u = d_src / np.linalg.norm(d_src)
    k = np.linalg.norm(d_tgt) / np.linalg.norm(d_src) if stretch else 1.0
    S = np.eye(3) + (k - 1.0) * np.outer(u, u)
    A = R @ S
    return A, p_tgt - A @ p_src


def main():
    model = pickle.load(open(os.path.join(WORK, "cloud_model.pkl"), "rb")) if os.path.exists(
        os.path.join(WORK, "cloud_model.pkl")) else dae_reader.load(os.path.join(ROOT, "source", "Cloud Strife.dae"))
    names, parents, xlocal, xworld = xiv_skeleton.load(
        os.path.join(WORK, "game/chara/human/c0101/skeleton/base/b0001/skl_c0101b0001.sklb"))
    X = {n: w for n, w in zip(names, xworld)}
    xp = {n: w[:3, 3] for n, w in X.items()}

    # Cloud joint world matrices in FFXIV space.
    cw = {j.name: GLOBAL @ j.world for j in model.joints}
    cp = {n: m[:3, 3] for n, m in cw.items()}

    # Per-joint affine deltas for the refit chains (everything else inherits).
    delta = {}
    for side, s in (("L", "_l"), ("R", "_r")):
        def chain(pairs):
            for (src, tgt), nxt in zip(pairs, pairs[1:] + [None]):
                if nxt is None:
                    continue
                d_src = cp[nxt[0]] - cp[src]
                d_tgt = xp[nxt[1]] - xp[tgt]
                delta[src] = segment_delta(cp[src], d_src, xp[tgt], d_tgt)

        chain([(f"{side}_UpperArm_a", f"j_ude_a{s}"), (f"{side}_Forearm_a", f"j_ude_b{s}"),
               (f"{side}_Hand_a", f"j_te{s}"), (f"{side}_Middle_a", f"j_naka_a{s}")])
        for f, x in FINGERS.items():
            a, b = f"{side}_{f}_a", f"{side}_{f}_b"
            chain([(a, f"j_{x}_a{s}"), (b, f"j_{x}_b{s}")])
            # Last segment: keep Cloud's length, align with the FFXIV bone's x axis.
            tip = f"{side}_{f}_End"
            d_src = cp[tip] - cp[b]
            d_tgt = X[f"j_{x}_b{s}"][:3, 0] * np.linalg.norm(d_src)
            delta[b] = segment_delta(cp[b], d_src, xp[f"j_{x}_b{s}"], d_tgt, stretch=False)

    ident = (np.eye(3), np.zeros(3))
    joint_delta = []
    for j in model.joints:
        k = model.joint_index[j.name]
        d = None
        while k >= 0 and d is None:
            d = delta.get(model.joints[k].name)
            k = model.joints[k].parent
        joint_delta.append(d or ident)
    JA = np.stack([d[0] for d in joint_delta])
    Jt = np.stack([d[1] for d in joint_delta])
    JN = np.stack([np.linalg.inv(a).T for a in JA])

    rules = resolve_rules(model)
    G3 = GLOBAL[:3, :3]
    Gn = G3 / np.linalg.norm(G3[0])

    meshes = {}
    for m in model.meshes:
        # Merge corners that only differed by vertex colour (unused here).
        P = m.positions @ G3.T
        N = m.normals @ Gn.T
        key = np.c_[np.round(P, 6), np.round(N, 4), np.round(m.uvs, 6)]
        _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
        inv = inv.reshape(-1)
        P, N, uv = P[first], N[first], m.uvs[first].copy()
        jidx, jw = m.joints[first], m.weights[first]
        tris = inv[m.triangles]
        # Linear blend skinning into the FFXIV rest pose.
        newP = np.zeros_like(P)
        newN = np.zeros_like(N)
        for k in range(jidx.shape[1]):
            w = jw[:, k:k + 1]
            A = JA[jidx[:, k]]
            newP += w * (np.einsum("nij,nj->ni", A, P) + Jt[jidx[:, k]])
            newN += w * np.einsum("nij,nj->ni", JN[jidx[:, k]], N)
        newN /= np.linalg.norm(newN, axis=1, keepdims=True).clip(1e-9)
        # Remap weights onto FFXIV bones.
        bw = [dict() for _ in range(len(P))]
        for k in range(jidx.shape[1]):
            for vi in np.nonzero(jw[:, k] > 0)[0]:
                for bone, frac in rules[jidx[vi, k]]:
                    bw[vi][bone] = bw[vi].get(bone, 0.0) + jw[vi, k] * frac
        meshes[m.name] = dict(P=newP, N=newN, uv=uv, tris=tris, bw=bw)
        print(f"{m.name:10s} verts {len(P):6d} (was {len(m.positions)}) tris {len(tris)}")

    pickle.dump(meshes, open(os.path.join(WORK, "cloud_xiv_meshes.pkl"), "wb"))
    for slot in LAYOUT:
        write_db(slot, meshes, names, parents, xlocal)


def write_db(slot, meshes, names, parents, xlocal):
    path = os.path.join(WORK, "db", f"{RACE}{SET}_{slot}.db")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        os.remove(path)
    db = sqlite3.connect(path)
    schema = open(os.path.join(ROOT, "tools", "tt", "converters", "fbx", "sql", "CreateDB.SQL")).read()
    db.executescript(schema)
    root_name = f"{RACE}{SET}_{slot}"
    db.executemany("insert into meta values (?,?)", [
        ("unit", "meter"), ("application", "cloud_ff7r_port"), ("version", "1.0"), ("up", "y"),
        ("front", "z"), ("handedness", "r"), ("for_3ds_max", "0"), ("root_name", root_name)])
    db.execute("insert into models values (0, ?)", (root_name,))

    groups = LAYOUT[slot]
    used_bones = set()
    mesh_id = 0
    if not groups:
        # Empty model: one degenerate triangle on the hips using the vanilla material.
        groups_out = [(0, f"/mt_{RACE}{SET}_{slot}_a.mtrl")]
        db.execute("insert into materials values (0, ?, '', '', '', '', '')", groups_out[0][1:])
        db.execute("insert into meshes values (0, 0, 0, 'Empty', 'Standard')")
        db.execute("insert into parts values (0, 0, 'Part 0', '')")
        db.execute("insert into bones values (0, 0, 'j_kosi')")
        used_bones.add("j_kosi")
        for vi in range(3):
            db.execute("insert into vertices values (" + ",".join(["?"] * 47) + ")", (
                0, 0, vi, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                0, 1.0, 0, 0.0, 0, 0.0, 0, 0.0, 0, 0.0, 0, 0.0, 0, 0.0, 0, 0.0, 0.0, 0.0))
            db.execute("insert into indices values (0, 0, ?, ?)", (vi, vi))
    else:
        # TexTools wants one mesh per material; source meshes become its parts.
        for mat_id, (letter, srcs) in enumerate(groups):
            db.execute("insert into materials values (?, ?, '', '', '', '', '')",
                       (mat_id, f"/mt_{RACE}{SET}_{slot}_{letter}.mtrl"))
            write_mesh(db, mat_id, mat_id, [(src, meshes[src]) for src in srcs], used_bones)

    # Skeleton: used bones plus their ancestors, as parent-relative matrices.
    keep = set()
    for b in used_bones:
        i = names.index(b)
        while i >= 0:
            keep.add(i)
            i = parents[i]
    for i in sorted(keep):
        p = parents[i]
        db.execute("insert into skeleton values (" + ",".join(["?"] * 18) + ")",
                   (names[i], names[p] if p >= 0 else None, *xlocal[i].reshape(-1).tolist()))
    db.commit()
    db.close()
    print("wrote", path)


def write_mesh(db, mesh_id, mat_id, parts, used_bones):
    total_verts = sum(len(m["P"]) for _, m in parts)
    assert total_verts < 65536, f"mesh {mesh_id} has too many vertices ({total_verts})"
    db.execute("insert into meshes values (?, 0, ?, ?, 'Standard')", (mesh_id, mat_id, "+".join(n for n, _ in parts)))
    bones = sorted({b for _, m in parts for d in m["bw"] for b in d})
    bid = {b: i for i, b in enumerate(bones)}
    used_bones.update(bones)
    db.executemany("insert into bones values (?, ?, ?)", [(mesh_id, i, b) for i, b in enumerate(bones)])
    for part_id, (name, mesh) in enumerate(parts):
        P, N, uv, tris, bw = mesh["P"], mesh["N"], mesh["uv"], mesh["tris"], mesh["bw"]
        db.execute("insert into parts values (?, ?, ?, '')", (mesh_id, part_id, name))
        rows = []
        for vi in range(len(P)):
            top = sorted(bw[vi].items(), key=lambda kv: -kv[1])[:4]
            total = sum(w for _, w in top)
            slots = []
            for b, w in top:
                slots += [bid[b], w / total]
            slots += [0, 0.0] * (8 - len(top))
            rows.append((mesh_id, part_id, vi, *P[vi], *N[vi], 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                         1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 1.0,
                         uv[vi, 0], 1.0 - uv[vi, 1], 0.0, 0.0, 0.0, 0.0, *slots, 0.0, 0.0))
        db.executemany("insert into vertices values (" + ",".join(["?"] * 47) + ")", rows)
        db.executemany("insert into indices values (?, ?, ?, ?)",
                       [(mesh_id, part_id, i, int(v)) for i, v in enumerate(tris.reshape(-1))])


if __name__ == "__main__":
    main()
