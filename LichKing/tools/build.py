"""Split the fitted Lich King into the Archfiend set's models, place Frostmourne in the Deathbringer's model space,
and convert both with Penumbra's own glTF importer (apps/xivtool import).

Models (Hyur Midlander male, c0101; other male races borrow them through EQDP):
  e0757 met  helmet (crown, faceplate), his dark face, the hair under the helmet, the eye glow
  e0757 top  breastplate, pauldrons, collar, cape (skirt physics bones), upper arms
  e0757 glv  forearms, gauntlets, fingers
  e0757 dwn  belt, tabard (front skirt bones), tassets, thigh plates and fur, knees
  e0757 sho  greaves, shin fur, sabatons
  w1501 b0037  Frostmourne
Slots follow the skin weights (whole islands kept together when one slot dominates); the cape always goes
with the top and the tabard with the legs.
"""
import os
import pickle
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from gltf_writer import write_glb  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build")
RACE, SET = "c0101", 757
WEAPON, WBODY = 1501, 37
SLOTS = ["met", "top", "glv", "dwn", "sho"]
MODEL_PATH = {s: f"chara/equipment/e{SET:04d}/model/{RACE}e{SET:04d}_{s}.mdl" for s in SLOTS}
MODEL_PATH["wep"] = f"chara/weapon/w{WEAPON:04d}/obj/body/b{WBODY:04d}/model/w{WEAPON:04d}b{WBODY:04d}.mdl"
TEXSET = {  # shading group -> material set (materials.py)
    "helm": "lk_a", "shoulders": "lk_a", "shoulders2": "lk_a", "cape": "lk_a", "cape1": "lk_a", "cloth": "lk_a",
    "head": "lk_a", "hair": "lk_a", "metal": "lk_b", "aiStandardSurface51SG": "lk_b", "leather": "lk_b",
    "fur": "lk_b", "eyes_glow": "lk_mist"}
LETTER = {"lk_a": "a", "lk_b": "b", "lk_mist": "c"}
FORCED = {"cape": "top", "cape1": "top", "cloth": "dwn", "head": "met", "hair": "met", "eyes_glow": "met"}
ISLAND_MAJORITY = 0.75

# Frostmourne: source blade axis positions (m, along its long axis) of the pommel end, the grip's lower end
# and the bottom of the guard; the grip is lengthened so two FFXIV hands fit on it (DRK animations).
SWORD_SCALE = 1.75
GRIP = (-0.33, -0.24)
GRIP_STRETCH = 2.5


def material_path(slot, texset):
    return f"/mt_{RACE}e{SET:04d}_{slot}_{LETTER[texset]}.mtrl"


def region(bone):
    if bone == "j_kao":
        return "met"
    if bone.startswith(("j_te_", "j_oya_", "j_hito_", "j_naka_", "j_kusu_", "j_ko_", "j_ude_b_", "n_hte_")):
        return "glv"
    if bone == "j_kosi" or bone.startswith(("j_asi_a_", "j_asi_b_")):
        return "dwn"
    if bone.startswith(("j_asi_c_", "j_asi_d_", "j_asi_e_")):
        return "sho"
    return "top"


def components(faces, n):
    parent = np.arange(n)

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for f in faces:
        ra = find(f[0])
        for v in f[1:]:
            rb = find(v)
            if ra != rb:
                parent[rb] = ra
    return np.array([find(i) for i in range(n)])


def split_slots(m):
    score = np.zeros((len(m["pos"]), len(SLOTS)))
    for k in range(m["bones"].shape[1]):
        for i, bn in enumerate(m["bones"][:, k]):
            if bn:
                score[i, SLOTS.index(region(bn))] += m["weights"][i, k]
    tri = score[m["faces"]].sum(1).argmax(1)
    comp = components(m["faces"], len(m["pos"]))[m["faces"][:, 0]]
    for c in np.unique(comp):
        sel = comp == c
        counts = np.bincount(tri[sel], minlength=len(SLOTS))
        if counts.max() >= ISLAND_MAJORITY * sel.sum():
            tri[sel] = counts.argmax()
    for mat, slot in FORCED.items():
        tri[m["material"] == mat] = SLOTS.index(slot)
    return tri


def tangents(pos, nrm, uv, faces):
    """Per-vertex tangents from UVs (v up), w = bitangent sign."""
    p0, p1, p2 = pos[faces[:, 0]], pos[faces[:, 1]], pos[faces[:, 2]]
    t0, t1, t2 = uv[faces[:, 0]], uv[faces[:, 1]], uv[faces[:, 2]]
    e1, e2 = p1 - p0, p2 - p0
    d1, d2 = t1 - t0, t2 - t0
    r = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
    ok = np.abs(r) > 1e-12
    r = np.where(ok, r, 1)
    T = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) / r[:, None]
    B = (e2 * d1[:, 0:1] - e1 * d2[:, 0:1]) / r[:, None]
    T[~ok] = 0
    B[~ok] = 0
    tv, bv = np.zeros_like(pos), np.zeros_like(pos)
    for k in range(3):
        np.add.at(tv, faces[:, k], T)
        np.add.at(bv, faces[:, k], B)
    n = nrm / np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
    tv -= n * np.sum(tv * n, 1, keepdims=True)
    bad = np.linalg.norm(tv, axis=1) < 1e-9
    ref = np.where(np.abs(n[:, 1:2]) < 0.9, [[0.0, 1.0, 0.0]], [[1.0, 0.0, 0.0]])
    tv[bad] = np.cross(ref[bad], n[bad])
    tv /= np.linalg.norm(tv, axis=1, keepdims=True)
    w = np.where(np.sum(np.cross(n, tv) * bv, 1) < 0, -1.0, 1.0)
    return np.hstack([tv, w[:, None]])


def corner_mesh(m, tri_idx):
    """Unique (vertex, uv) corners of the selected triangles -> per-vertex arrays + local faces."""
    f = m["faces"][tri_idx]
    uv = m["uv"][tri_idx].reshape(-1, 2)
    key = np.c_[f.reshape(-1), np.round(uv * 65536).astype(np.int64)]
    uniq, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    vid = uniq[:, 0]
    out = {"vid": vid, "pos": m["pos"][vid], "nrm": m["nrm"][vid], "uv": uv[first], "faces": inv.reshape(-1, 3)}
    if "bones" in m:
        out["bones"], out["weights"] = m["bones"][vid], m["weights"][vid]
    return out


class WeaponSkeleton:
    """Weapon models bind to the weapon skeleton by name; n_hara sits at the model origin."""
    bones = [("n_root", -1, (0, 0, 0), (0, 0, 0, 1), (1, 1, 1)), ("n_hara", 0, (0, 0, 0), (0, 0, 0, 1), (1, 1, 1))]
    names = ["n_root", "n_hara"]
    parents = [-1, 0]
    index = {"n_root": 0, "n_hara": 1}
    world = np.stack([np.eye(4), np.eye(4)])


def place_sword(fm):
    """Frostmourne in weapon space: blade up +Y, the bottom of the guard at the origin, flat in the XY plane."""
    p = fm["pos"]
    t_axis, wide, thin = np.linalg.svd(p - p.mean(0), full_matrices=False)[2]
    t = (p - p.mean(0)) @ t_axis
    if t.max() < -t.min():  # tip towards +t (the blade is the longer end)
        t_axis, t = -t_axis, -t
    grip = (t > GRIP[0]) & (t < GRIP[1])
    centre = p[grip].mean(0)
    rel = p - centre
    t = rel @ t_axis + (centre - p.mean(0)) @ t_axis
    a, c = rel @ wide, rel @ thin
    if np.linalg.det(np.stack([wide, t_axis, thin])) < 0:
        c = -c
    g0, g1 = GRIP
    y = np.where(t >= g1, t - g1,
                 np.where(t >= g0, GRIP_STRETCH * (t - g1), GRIP_STRETCH * (g0 - g1) + (t - g0)))
    pos = np.stack([a, y, c], 1) * SWORD_SCALE
    n = np.zeros_like(pos)
    fn = np.cross(pos[fm["faces"][:, 1]] - pos[fm["faces"][:, 0]], pos[fm["faces"][:, 2]] - pos[fm["faces"][:, 0]])
    for k in range(3):
        np.add.at(n, fm["faces"][:, k], fn)
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    print(f"Frostmourne in weapon space: {pos.min(0).round(3)} .. {pos.max(0).round(3)}")
    return dict(pos=pos, nrm=n, faces=fm["faces"], uv=fm["uv"], material=fm["material"])


def import_glb(name, skel, meshes):
    """glTF -> .mdl, then the bounding radius (the importer writes 1; vanilla gear is about 1.7)."""
    glb = os.path.join(OUT, "gltf", f"{name}.glb")
    write_glb(glb, skel, meshes)
    mdl = os.path.join(OUT, "mdl", f"{name}.mdl")
    r = subprocess.run(xd.XIVTOOL + ["import", glb, mdl], capture_output=True, text=True)
    print("   ", (r.stdout + r.stderr).strip()[:1500])
    if r.returncode != 0 or not os.path.exists(mdl):
        raise RuntimeError(f"import failed for {name}")
    radius = max(float(np.linalg.norm(m["positions"], axis=1).max()) for m in meshes)
    print("   ", xd.xivtool("mdlradius", mdl, mdl, f"{radius:.3f}").strip())
    return mdl


def gl_mesh(name, material, c, joints, weights):
    tan = tangents(c["pos"], c["nrm"], c["uv"], c["faces"])
    # vertex colour set 0 multiplies the surface colour in character.shpk: vanilla gear has it white (black
    # renders the model pitch black in game)
    return dict(name=name, material=material, positions=c["pos"], normals=c["nrm"],
                uvs=np.c_[c["uv"][:, 0], 1 - c["uv"][:, 1]], tangents=tan,
                colors=np.ones((len(c["pos"]), 4)), joints=joints, weights=weights,
                indices=c["faces"].ravel())


def build():
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit", "fitted.pkl"), "rb"))
    skel = Skeleton(xd.extract(f"chara/human/{RACE}/skeleton/base/b0001/skl_{RACE}b0001.sklb")[0])
    os.makedirs(os.path.join(OUT, "gltf"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "mdl"), exist_ok=True)
    slot = split_slots(fit)
    texset = np.array([TEXSET[m] for m in fit["material"]])
    result = {}
    for si, s in enumerate(SLOTS):
        meshes = []
        for ts in ("lk_a", "lk_b", "lk_mist"):
            idx = np.nonzero((slot == si) & (texset == ts))[0]
            if not len(idx):
                continue
            c = corner_mesh(fit, idx)
            assert len(c["pos"]) < 65536, (s, ts, len(c["pos"]))
            joints = np.vectorize(lambda bn: skel.index[bn] if bn else 0)(c["bones"]).astype(np.int64)
            weights = np.where(c["bones"] == "", 0.0, c["weights"])
            weights /= weights.sum(1, keepdims=True)
            meshes.append(gl_mesh(f"{s}_{len(meshes)}.0", material_path(s, ts), c, joints, weights))
            mats = sorted(set(fit["material"][idx]))
            print(f"{s} {ts}: {len(c['pos'])} verts, {len(idx)} tris  ({', '.join(mats)})")
        result[s] = import_glb(s, skel, meshes)

    fm = place_sword(pickle.load(open(os.path.join(ROOT, "work", "src", "src.pkl"), "rb"))["frostmourne"])
    c = corner_mesh(fm, np.arange(len(fm["faces"])))
    n = len(c["pos"])
    wj = np.zeros((n, 4), np.int64)
    wj[:, 0] = 1
    ww = np.zeros((n, 4))
    ww[:, 0] = 1
    print(f"wep fm: {n} verts, {len(fm['faces'])} tris")
    result["wep"] = import_glb("wep", WeaponSkeleton, [gl_mesh("wep_0.0", f"/mt_w{WEAPON:04d}b{WBODY:04d}_a.mtrl",
                                                                 c, wj, ww)])
    with open(os.path.join(OUT, "mdl", "index.pkl"), "wb") as f:
        pickle.dump({k: (v, MODEL_PATH[k]) for k, v in result.items()}, f)
    return result


if __name__ == "__main__":
    build()
