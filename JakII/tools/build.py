"""Split the fitted Jak into FFXIV models and convert each to .mdl with Penumbra's own glTF importer.

Models (Hyur Midlander male, c0101):
  e6027 top/glv/dwn/sho  body split by skin weights: shirt, sleeves, scarf, straps, pauldron, holster / forearms,
                         gloves and fists / belt, pouch, pants to the knee / knee pads, boot shafts, boots
  f0001 face             his head: face, eyes, teeth, brows and goatee, ears
  h0001 hair             his hair and the goggles on his forehead
Every model uses the one atlas material (materials.py) under its own game path.
"""
import os
import pickle
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from fit import FACE_PARTS, HAIR_PARTS, adjacency, components  # noqa: E402
from gltf_writer import write_glb  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build")
RACE, SET, FACE, HAIR = "c0101", 6027, "f0001", "h0001"
SLOTS = ["top", "glv", "dwn", "sho"]

MODEL_PATH = {s: xd.gear_model_path(SET, s, RACE) for s in SLOTS}
MODEL_PATH["fac"] = f"chara/human/{RACE}/obj/face/{FACE}/model/{RACE}{FACE}_fac.mdl"
MODEL_PATH["hir"] = f"chara/human/{RACE}/obj/hair/{HAIR}/model/{RACE}{HAIR}_hir.mdl"
MATERIAL = {s: f"/mt_{RACE}e{SET:04d}_{s}_a.mtrl" for s in SLOTS}
MATERIAL["fac"] = f"/mt_{RACE}{FACE}_fac_a.mtrl"
MATERIAL["hir"] = f"/mt_{RACE}{HAIR}_hir_a.mtrl"
FIXED = {**{n: "fac" for n in FACE_PARTS}, **{n: "hir" for n in HAIR_PARTS}}
ISLAND_MAJORITY = 0.75


def region(bone):
    if bone.startswith(("j_te_", "j_oya_", "j_hito_", "j_naka_", "j_kusu_", "j_ko_", "n_hte_", "j_ude_b_", "n_hhiji_", "n_hijisoubi_")):
        return "glv"
    if bone == "j_kosi" or bone.startswith(("j_asi_a_", "j_asi_b_", "n_hizasoubi_")):
        return "dwn"
    if bone.startswith(("j_asi_c_", "j_asi_d_", "j_asi_e_")):
        return "sho"
    return "top"


def split_body(m):
    """Triangle -> slot: by summed skin weight per region, whole islands kept together when one slot dominates."""
    score = np.zeros((len(m["pos"]), len(SLOTS)))
    for k in range(m["bones"].shape[1]):
        for i, b in enumerate(m["bones"][:, k]):
            if b:
                score[i, SLOTS.index(region(b))] += m["weights"][i, k]
    tri = score[m["faces"]].sum(1).argmax(1)
    ids, inv = np.unique(m["pos_id"], return_inverse=True)
    uf = inv[m["faces"]]
    comp = components(adjacency(uf, len(ids)), len(ids))[uf[:, 0]]
    for c in np.unique(comp):
        sel = comp == c
        counts = np.bincount(tri[sel], minlength=len(SLOTS))
        if counts.max() >= ISLAND_MAJORITY * sel.sum():
            tri[sel] = counts.argmax()
    return tri


def tangents(pos, nrm, uv, faces):
    """Per-vertex tangents from UVs (OBJ v-up, i.e. Blender / glTF-exporter convention), w = bitangent sign."""
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
    tv = np.zeros_like(pos)
    bv = np.zeros_like(pos)
    for k in range(3):
        np.add.at(tv, faces[:, k], T)
        np.add.at(bv, faces[:, k], B)
    n = nrm / np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
    tv -= n * np.sum(tv * n, 1, keepdims=True)
    ln = np.linalg.norm(tv, axis=1)
    bad = ln < 1e-9
    ref = np.where(np.abs(n[:, 1:2]) < 0.9, [[0.0, 1.0, 0.0]], [[1.0, 0.0, 0.0]])
    tv[bad] = np.cross(ref[bad], n[bad])
    tv /= np.linalg.norm(tv, axis=1, keepdims=True)
    w = np.where(np.sum(np.cross(n, tv) * bv, 1) < 0, -1.0, 1.0)
    return np.hstack([tv, w[:, None]])


def repair_normals(m):
    """Replace zero / NaN normals with area-weighted geometric normals, welded across UV seams."""
    n = np.nan_to_num(m["nrm"])
    bad = np.linalg.norm(n, axis=1) < 0.5
    if bad.any():
        ids, inv = np.unique(m["pos_id"], return_inverse=True)
        p = m["pos"][m["faces"]]
        fn = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
        acc = np.zeros((len(ids), 3))
        for k in range(3):
            np.add.at(acc, inv[m["faces"][:, k]], fn)
        geo = acc[inv]
        gl = np.linalg.norm(geo, axis=1)
        geo = np.where(gl[:, None] > 1e-12, geo / np.maximum(gl, 1e-12)[:, None], [[0.0, 1.0, 0.0]])
        n[bad] = geo[bad]
    m["nrm"] = n / np.linalg.norm(n, axis=1, keepdims=True)
    return int(bad.sum())


def build():
    fitted = pickle.load(open(os.path.join(ROOT, "work", "fit", "fitted.pkl"), "rb"))
    assert all("atlas_uv" in m for m in fitted.values()), "run textures.py first"
    skel = Skeleton(xd.extract(f"chara/human/{RACE}/skeleton/base/b0001/skl_{RACE}b0001.sklb")[0])
    pieces = {}  # model -> list of (part name, triangle indices)
    for name, m in fitted.items():
        if name in FIXED:
            pieces.setdefault(FIXED[name], []).append((name, np.arange(len(m["faces"]))))
            continue
        tri = split_body(m)
        for si, slot in enumerate(SLOTS):
            idx = np.nonzero(tri == si)[0]
            if len(idx):
                pieces.setdefault(slot, []).append((name, idx))

    for n, m in fitted.items():
        fixed = repair_normals(m)
        if fixed:
            print(f"{n}: repaired {fixed} normals")
    tan = {n: tangents(m["pos"], m["nrm"], m["atlas_uv"], m["faces"]) for n, m in fitted.items()}
    os.makedirs(os.path.join(OUT, "gltf"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "mdl"), exist_ok=True)
    result = {}
    for model in MODEL_PATH:
        arrs = {k: [] for k in ("pos", "nrm", "uv", "tan", "bones", "weights", "faces")}
        base = 0
        for name, idx in pieces[model]:
            m = fitted[name]
            f = m["faces"][idx]
            used, remap = np.unique(f, return_inverse=True)
            arrs["faces"].append(remap.reshape(-1, 3) + base)
            for k, src in (("pos", m["pos"]), ("nrm", m["nrm"]), ("uv", m["atlas_uv"]), ("tan", tan[name]),
                           ("bones", m["bones"]), ("weights", m["weights"])):
                arrs[k].append(src[used])
            base += len(used)
        a = {k: np.concatenate(v) for k, v in arrs.items()}
        joints = np.vectorize(lambda b: skel.index[b] if b else 0)(a["bones"]).astype(np.int64)
        weights = np.where(a["bones"] == "", 0.0, a["weights"])
        weights /= weights.sum(1, keepdims=True)
        assert len(a["pos"]) < 65536, (model, len(a["pos"]))
        # vertex colour set 0 multiplies the surface colour in character.shpk: vanilla gear has it white (black
        # renders the model pitch black in game)
        meshes = [dict(name=f"{model}_0.0", material=MATERIAL[model], positions=a["pos"], normals=a["nrm"],
                       uvs=np.c_[a["uv"][:, 0], 1 - a["uv"][:, 1]], tangents=a["tan"],
                       colors=np.ones((len(a["pos"]), 4)),
                       joints=joints, weights=weights, indices=a["faces"].ravel())]
        print(f"{model}: {len(a['pos'])} verts, {len(a['faces'])} tris, "
              f"{len({b for b in a['bones'].ravel() if b})} bones, from {[n for n, _ in pieces[model]]}")
        glb = os.path.join(OUT, "gltf", f"{model}.glb")
        write_glb(glb, skel, meshes)
        mdl = os.path.join(OUT, "mdl", f"{model}.mdl")
        r = subprocess.run(xd.XIVTOOL + ["import", glb, mdl], capture_output=True, text=True)
        print("   ", (r.stdout + r.stderr).strip()[:1500])
        if r.returncode != 0 or not os.path.exists(mdl):
            raise RuntimeError(f"import failed for {model}")
        result[model] = mdl
    with open(os.path.join(OUT, "mdl", "index.pkl"), "wb") as f:
        pickle.dump({k: (v, MODEL_PATH[k]) for k, v in result.items()}, f)
    return result


if __name__ == "__main__":
    build()
