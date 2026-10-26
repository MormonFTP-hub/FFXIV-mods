"""Split the fitted Invisible Woman into the Valentione Rose Ribboned set's five models and convert each with
Penumbra's own glTF importer.

Per fitted race (Midlander woman c0201, Midlander man c0101, Lalafell c1101; work/fit/<race>.pkl):
  met   head, hair, lashes, eyes, witch hat, earrings, the rose and thorns on the hat
  top   bodice, chest, capelet, collar gem, shoulder rose and thorns, upper arms
  glv   gloved forearms and clawed hands, arm thorns
  dwn   skirt and petticoat, tights to the knee, belt
  sho   tights below the knee, leg thorns, heeled boots
The fit fixes the head pieces; every other part is split by skin weight per region, whole pieces going one way
when one slot clearly dominates. Each part's UVs are moved into its texture set's tile of its material's atlas
(textures.py -> MATERIALS), so no model has more than MAX_MATERIALS materials.
"""
import os
import pickle
import re
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from gltf_writer import write_glb  # noqa: E402
from islands import components  # noqa: E402
from textures import tile_of  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build")
SET = 6098
SLOTS = ["met", "top", "glv", "dwn", "sho"]
RACES = ("c0201", "c0101", "c1101")
ISLAND_MAJORITY = 0.7
ISLAND_MAX_TRIS = 4000     # bigger pieces (her skin: chest, arms and hands in one) split per triangle
# material letter per slot and material (textures.py -> MATERIALS: the trim and thorns share one atlas, the eyes
# and lashes another); Penumbra refuses a model with more than MAX_MATERIALS (MdlMaterialMaximum)
LETTERS = {"met": ["head", "hair", "eyes_lashes", "trim_thorns"], "top": ["body", "dress", "trim_thorns"],
           "glv": ["body", "dress", "trim_thorns"], "dwn": ["body", "dress", "trim_thorns"],
           "sho": ["body", "dress", "trim_thorns"]}
MAX_MATERIALS = 4
FACE_RACES = [f"c{n:04d}" for n in range(101, 1902, 100)]
FACE_IDS = [f"f{i:04d}" for i in list(range(1, 11)) + list(range(101, 111)) + list(range(201, 211))]


def mtrl(race, slot, texset):
    letter = "abcdefgh"[LETTERS[slot].index(texset)]
    return f"/mt_{race}e{SET:04d}_{slot}_{letter}.mtrl"


def region(bone):
    if bone == "j_kao":
        return "met"
    if bone.startswith(("j_te_", "j_oya_", "j_hito_", "j_naka_", "j_kusu_", "j_ko_", "n_hte_", "j_ude_b_")):
        return "glv"
    if bone.startswith(("j_asi_c_", "j_asi_d_", "j_asi_e_")):
        return "sho"
    if bone == "j_kosi" or bone.startswith(("j_asi_a_", "j_asi_b_", "j_sk_")):
        return "dwn"
    return "top"


def split(m):
    """Triangle -> slot index by summed skin weight per region."""
    score = np.zeros((len(m["pos"]), len(SLOTS)))
    for k in range(m["bones"].shape[1]):
        for i, b in enumerate(m["bones"][:, k]):
            if b:
                score[i, SLOTS.index(region(b))] += m["weights"][i, k]
    tri = score[m["faces"]].sum(1).argmax(1)
    ids, inv = np.unique(m["vid"], return_inverse=True)
    uf = inv[m["faces"]]
    comp = components(uf, len(ids))[uf[:, 0]]
    for c in np.unique(comp):
        sel = comp == c
        counts = np.bincount(tri[sel], minlength=len(SLOTS))
        if sel.sum() <= ISLAND_MAX_TRIS and counts.max() >= ISLAND_MAJORITY * sel.sum():
            tri[sel] = counts.argmax()
    return tri


def tangents(pos, nrm, uv, faces):
    """Per-vertex tangents from v-up UVs, w = bitangent sign."""
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


def sub(m, tri_sel):
    f = m["faces"][tri_sel]
    used, remap = np.unique(f, return_inverse=True)
    out = {k: (v[used] if isinstance(v, np.ndarray) and v.ndim and len(v) == len(m["pos"]) else v) for k, v in m.items()}
    out["faces"] = remap.reshape(-1, 3)
    return out


def convert(name, skel, meshes_by_mat, vanilla=None):
    """meshes_by_mat: {material: [part dicts]} -> .mdl via glTF. With a vanilla model, copy its flags and set the
    bounding radius to the larger of its radius and ours (the importer writes 1)."""
    meshes = []
    for mat, plist in meshes_by_mat.items():
        arrs = {k: [] for k in ("pos", "nrm", "uv", "tan", "bones", "weights", "faces")}
        base = 0
        for m in plist:
            arrs["faces"].append(m["faces"] + base)
            arrs["pos"].append(m["pos"])
            arrs["nrm"].append(m["nrm"])
            arrs["uv"].append(np.c_[m["uv"][:, 0], 1 - m["uv"][:, 1]])
            arrs["tan"].append(tangents(m["pos"], m["nrm"], m["uv"], m["faces"]))
            arrs["bones"].append(m["bones"])
            arrs["weights"].append(m["weights"])
            base += len(m["pos"])
        a = {k: np.concatenate(v) for k, v in arrs.items()}
        missing = {b for b in a["bones"].ravel() if b and b not in skel.index}
        assert not missing, missing
        joints = np.vectorize(lambda b: skel.index[b] if b else 0)(a["bones"]).astype(np.int64)
        weights = np.where(a["bones"] == "", 0.0, a["weights"])
        weights /= weights.sum(1, keepdims=True)
        assert len(a["pos"]) < 65536, (name, mat, len(a["pos"]))
        # vertex colour set 0 multiplies the surface colour in character.shpk: vanilla gear has it white (black
        # renders the model pitch black in game)
        meshes.append(dict(name=f"{name}_{len(meshes)}.0", material=mat, positions=a["pos"], normals=a["nrm"],
                           uvs=a["uv"], tangents=a["tan"], colors=np.ones((len(a["pos"]), 4)),
                           joints=joints, weights=weights, indices=a["faces"].ravel()))
        print(f"  {name} {mat}: {len(a['pos'])} verts, {len(a['faces'])} tris")
    glb = os.path.join(OUT, "gltf", f"{name}.glb")
    write_glb(glb, skel, meshes)
    mdl = os.path.join(OUT, "mdl", f"{name}.mdl")
    r = subprocess.run(xd.XIVTOOL + ["import", glb, mdl], capture_output=True, text=True)
    print("   ", (r.stdout + r.stderr).strip()[:600])
    if r.returncode != 0 or not os.path.exists(mdl):
        raise RuntimeError(f"import failed for {name}")
    if vanilla:
        src = xd.extract(vanilla)[0] or xd.extract(re.sub(r"c\d{4}e", "c0101e", vanilla))[0]
        xd.xivtool("mdlflags", mdl, mdl, src)
        van = float(xd.xivtool("mdlinfo", src).split("radius=")[1].split()[0])
        ours = max(np.linalg.norm(m["pos"], axis=1).max() for pl in meshes_by_mat.values() for m in pl)
        out = xd.xivtool("mdlradius", mdl, mdl, f"{max(van, ours * 1.02):.4f}")
        print("   ", out.strip())
    return mdl


def to_atlas(p):
    """A part with its texture set's tile in its material's atlas: UVs (v up) moved into the tile."""
    mat, c, r, nc, nr = tile_of(p["texset"])
    q = dict(p)
    q["uv"] = np.c_[(p["uv"][:, 0] + c) / nc, (p["uv"][:, 1] + (nr - 1 - r)) / nr]
    q["texset"] = mat
    return q


def build_race(race, result):
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit", f"{race}.pkl"), "rb"))
    skel = Skeleton(xd.extract(f"chara/human/{race}/skeleton/base/b0001/skl_{race}b0001.sklb")[0])
    by_slot = {s: {} for s in SLOTS}
    for name, p in fit["parts"].items():
        p = to_atlas(p)
        if p["slot"] is not None:
            by_slot[p["slot"]].setdefault(p["texset"], []).append(p)
            continue
        tri = split(p)
        for si, slot in enumerate(SLOTS):
            if (tri == si).any():
                by_slot[slot].setdefault(p["texset"], []).append(sub(p, tri == si))
                print(f"  {name} -> {slot}: {(tri == si).sum()} tris")
    for slot in SLOTS:
        mats = {mtrl(race, slot, t): by_slot[slot][t] for t in LETTERS[slot] if t in by_slot[slot]}
        assert set(by_slot[slot]) <= set(LETTERS[slot]), (slot, set(by_slot[slot]))
        assert len(mats) <= MAX_MATERIALS, (slot, list(mats))
        name = f"{race}_{slot}"
        game = xd.gear_model_path(SET, slot, race)
        result[name] = (convert(name, skel, mats, game), game)


def face_hiders(result):
    """Empty stand-ins for every player face model in the game (one degenerate triangle that keeps the face's
    first material, so nothing points at a missing material)."""
    paths = [f"chara/human/{r}/obj/face/{f}/model/{r}{f}_fac.mdl" for r in FACE_RACES for f in FACE_IDS]
    local = xd.extract(*paths)
    found = [p for p, l in zip(paths, local) if l]
    print(f"face hiders: {len(found)} face models")
    for p in found:
        name = "hide_" + os.path.basename(p)[:-4]
        done = os.path.join(OUT, "mdl", f"{name}.mdl")
        if os.path.exists(done):       # they never change: reuse the ones from an earlier build
            result[name] = (done, p)
            continue
        race = p.split("/")[2]
        skel = Skeleton(xd.extract(f"chara/human/{race}/skeleton/base/b0001/skl_{race}b0001.sklb")[0])
        first_mat = xd.model(p)["materials"][0]
        c = skel.pos("j_kao")
        eps = 0.0005
        m = dict(pos=np.array([c, c + [eps, 0, 0], c + [0, 0, eps]]), nrm=np.tile([0.0, 1, 0], (3, 1)),
                 uv=np.array([[0.0, 0], [1, 0], [0, 1]]), faces=np.array([[0, 1, 2]]),
                 bones=np.array([["j_kao", "", "", ""]] * 3, object), weights=np.tile([1.0, 0, 0, 0], (3, 1)))
        result[name] = (convert(name, skel, {first_mat: [m]}), p)


def build(races=RACES):
    os.makedirs(os.path.join(OUT, "gltf"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "mdl"), exist_ok=True)
    result = {}
    for race in races:
        build_race(race, result)
    face_hiders(result)
    with open(os.path.join(OUT, "mdl", "index.pkl"), "wb") as f:
        pickle.dump(result, f)
    return result


if __name__ == "__main__":
    build(tuple(sys.argv[1:]) or RACES)
