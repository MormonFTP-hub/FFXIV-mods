"""Her face as the psylocke.gg viewer shows it: the face bones posed from her lobby idle animation, baked into the face
and mouth meshes.

The bind pose of the source rig is a blank face: the upper lids shut down over the eyes and a flat mouth
(work/preview/src_p10_sheet.png); over the eyeballs that read as a heavy, sleepy stare. The viewer plays
Lobby_Stand_Idle, whose FACIAL_* bones give her the open eyes and the smirk of the original. FFXIV has no use for her
face rig (the head is rigid), so 1.4.0 skins the face primitives (PRIMS) once with the idle's first key and keeps the
result as her rest shape: the eyes and brows fully, the mouth half way (the full smirk stretches the painted smile
lines into pale smudges, work/preview/expr_compare.png). Only FACIAL_* bones move; the eyeballs are on their own bones
(L/R_502_Eye) and keep looking ahead.

python -P -E tools/expression.py                 report lid opening and mouth corners per frame
python -P -E tools/expression.py <frame> ... [mouth=0.5]
                                                 preview the face at those frames (work/preview/expr_<frame>_m<mouth>_sheet.png)
"""
import glob
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glb  # noqa: E402
import srcdata as sd  # noqa: E402

ANIM = "b21f368412c0"     # Lobby_Stand_Idle, the viewer's idle (7 s, 211 keys)
FRAME = 0                 # the first key: eyes open, before the first blink
PRIMS = (10, 0, 4, 6)     # face; eyes + teeth/gums/tongue; brows/lashes; the eye-shadow card (bake_src.eye_shadow)
SKIP = ("FACIAL_L_Pupil", "FACIAL_R_Pupil")
MOUTH = ("Lip", "Mouth", "Jaw", "Chin", "Nasolabial", "Cheek", "Teeth", "Tongue", "Nose")
AMOUNT = {"mouth": 0.5, "rest": 1.0}   # how much of the pose each region takes (0 = bind, 1 = the idle)
_pose = None


def quat_mat(q):
    x, y, z, w = q / np.linalg.norm(q)
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def tracks():
    """{bone: {path: (times, values)}} for the FACIAL_* channels of the idle."""
    a = glb.Glb(glob.glob(os.path.join(sd.ROOT, "source", "cdn", ANIM + "*.glb"))[0])
    an = a.g["animations"][0]
    out = {}
    for c in an["channels"]:
        name = a.g["nodes"][c["target"]["node"]].get("name", "")
        if not name.startswith("FACIAL") or name in SKIP:
            continue
        s = an["samplers"][c["sampler"]]
        out.setdefault(name, {})[c["target"]["path"]] = (a.accessor(s["input"])[:, 0], a.accessor(s["output"]))
    return out


def local_at(trk, frame):
    """Local 4x4 of a bone at a key index."""
    m = np.eye(4)
    t = trk.get("translation")
    r = trk.get("rotation")
    if r is not None:
        m[:3, :3] = quat_mat(r[1][min(frame, len(r[1]) - 1)].astype(np.float64))
    if t is not None:
        m[:3, 3] = t[1][min(frame, len(t[1]) - 1)]
    return m


def slerp_to(R0, R1, t):
    """Rotation t of the way from R0 to R1."""
    D = R0.T @ R1
    ang = np.arccos(np.clip((np.trace(D) - 1) / 2, -1, 1))
    if ang < 1e-8:
        return R0.copy()
    ax = np.array([D[2, 1] - D[1, 2], D[0, 2] - D[2, 0], D[1, 0] - D[0, 1]]) / (2 * np.sin(ang))
    K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
    a = ang * t
    return R0 @ (np.eye(3) + np.sin(a) * K + (1 - np.cos(a)) * K @ K)


def skin_mats(frame, T=None, amount=None):
    """{joint: 4x4} taking bind-pose points to the posed face (identity for every other joint)."""
    J = sd.joints()
    amount = AMOUNT if amount is None else amount
    T = tracks() if T is None else T
    world = {}

    def pose(n):
        if n in world:
            return world[n]
        j = J[n]
        if not n.startswith("FACIAL") or j["parent"] is None:
            world[n] = j["matrix"]
            return world[n]
        bind_local = np.linalg.inv(J[j["parent"]]["matrix"]) @ j["matrix"]
        loc = bind_local.copy()
        if n in T:
            L = local_at(T[n], frame)
            k = amount["mouth" if any(w in n for w in MOUTH) else "rest"]
            if "rotation" in T[n]:
                loc[:3, :3] = slerp_to(bind_local[:3, :3], L[:3, :3], k)
            if "translation" in T[n]:
                loc[:3, 3] += k * (L[:3, 3] - bind_local[:3, 3])
        world[n] = pose(j["parent"]) @ loc
        return world[n]

    return {n: pose(n) @ np.linalg.inv(J[n]["matrix"]) for n in J if n.startswith("FACIAL")}


def apply(m, S):
    """Linear-blend skin one primitive's pos/nrm/tan with the face matrices S (in place, returns m)."""
    names = m["jnames"]
    w = m["weights"]
    acc = np.zeros((len(m["pos"]), 4, 4))
    for k in range(names.shape[1]):
        for n in np.unique(names[:, k]):
            sel = names[:, k] == n
            acc[sel] += w[sel, k, None, None] * S.get(n, np.eye(4))
    acc /= np.maximum(w.sum(1), 1e-9)[:, None, None]
    m["pos"] = np.einsum("nij,nj->ni", acc[:, :3, :3], m["pos"]) + acc[:, :3, 3]
    for k in ("nrm", "tan"):
        if k in m:
            v = np.einsum("nij,nj->ni", acc[:, :3, :3], m[k][:, :3])
            v /= np.maximum(np.linalg.norm(v, axis=1, keepdims=True), 1e-9)
            m[k] = np.c_[v, m[k][:, 3:]] if m[k].shape[1] > 3 else v
    return m


def posed(m):
    """srcdata.prim hook: the face primitives in her idle expression."""
    global _pose
    if m["index"] not in PRIMS:
        return m
    if _pose is None:
        _pose = skin_mats(FRAME)
    return apply(m, _pose)


def report():
    J = sd.joints()
    T = tracks()
    n_keys = max(len(p[0]) for t in T.values() for p in t.values())
    lid = [n for n in J if "EyelidUpperA" in n and n[-1].isdigit()]
    corner = ["FACIAL_L_LipCorner", "FACIAL_R_LipCorner"]
    print(f"{len(T)} face bones, {n_keys} keys; columns: frame, upper-lid bones mm (blinks go negative), "
          f"mouth-corner lift mm, corner out mm")
    for f in range(0, n_keys, 6):
        S = skin_mats(f, T)
        d = {n: (S[n] @ np.append(J[n]["head"], 1))[:3] - J[n]["head"] for n in lid + corner}
        up = np.mean([d[n][1] for n in lid]) * 1000
        cy = np.mean([d[n][1] for n in corner]) * 1000
        cx = (d[corner[0]][0] - d[corner[1]][0]) / 2 * 1000
        print(f"  {f:4d}  {up:6.2f}  {cy:6.2f}  {cx:6.2f}")


def preview_frames(frames, mouth):
    import preview
    T = tracks()
    for f in frames:
        groups = []
        for i in PRIMS[:2]:
            m = apply(sd.prim(i, raw=True), skin_mats(f, T, dict(AMOUNT, mouth=mouth)))
            if i == 0:
                m = sd.submesh(m, (m["uv0"][m["faces"]][:, :, 0] < 1.0).all(1))
            tex = os.path.join(sd.ALBEDO, m["material"] + ".png")
            g = dict(name=f"p{i:02d}", pos=m["pos"], faces=m["faces"], uv=np.c_[m["uv0"][:, 0], 1 - m["uv0"][:, 1]])
            if os.path.exists(tex):
                g["texture"] = tex
            groups.append(g)
        obj = os.path.join(sd.ROOT, "work", f"expr_{f}.obj")
        preview.write_obj(obj, groups)
        print(preview.render(obj, os.path.join(sd.ROOT, "work", "preview", f"expr_{f}_m{mouth}"), "front,side", 500))


if __name__ == "__main__":
    if len(sys.argv) > 1:
        preview_frames([int(a) for a in sys.argv[1:] if "=" not in a],
                       float(dict(a.split("=") for a in sys.argv[1:] if "=" in a).get("mouth", 1.0)))
    else:
        report()
