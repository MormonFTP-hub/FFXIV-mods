"""Split the fitted Griffith into FFXIV models and convert each to .mdl with Penumbra's own glTF importer.

Models (Hyur Midlander male, c0101):
  e0110 top/glv/dwn/sho  armour split by skin weights (cape on top), met = hawk helm + helmet hair
  f0001 face             Griffith's head, eyes, teeth, lashes
  h0001 hair             his long hair (the back hair also rides on the helm, which hides the hair model)
"""
import os
import pickle
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from fit import adjacency, components  # noqa: E402
from gltf_writer import write_glb  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build")
RACE, SET = "c0101", 110

MODEL_PATH = {s: f"chara/equipment/e{SET:04d}/model/{RACE}e{SET:04d}_{s}.mdl" for s in ("met", "top", "glv", "dwn", "sho")}
MODEL_PATH["fac"] = f"chara/human/{RACE}/obj/face/f0001/model/{RACE}f0001_fac.mdl"
MODEL_PATH["hir"] = f"chara/human/{RACE}/obj/hair/h0001/model/{RACE}h0001_hir.mdl"

MATERIAL = {
    ("top", "armor"): f"/mt_{RACE}e{SET:04d}_top_a.mtrl", ("top", "cape"): f"/mt_{RACE}e{SET:04d}_top_b.mtrl",
    ("glv", "armor"): f"/mt_{RACE}e{SET:04d}_glv_a.mtrl",
    ("dwn", "armor"): f"/mt_{RACE}e{SET:04d}_dwn_a.mtrl",
    ("sho", "armor"): f"/mt_{RACE}e{SET:04d}_sho_a.mtrl",
    ("met", "armor"): f"/mt_{RACE}e{SET:04d}_met_a.mtrl", ("met", "hair"): f"/mt_{RACE}e{SET:04d}_met_b.mtrl",
    ("fac", "face"): f"/mt_{RACE}f0001_fac_a.mtrl", ("fac", "hair"): f"/mt_{RACE}f0001_etc_a.mtrl",
    ("hir", "hair"): f"/mt_{RACE}h0001_hir_a.mtrl",
}
TEXSET = {"0.png": "armor", "17.png": "cape", "11.png": "hair", "5.png": "face"}

BODY_PARTS = ["model_1_submesh_1", "model_1_submesh_2", "model_1_submesh_3", "model_1_submesh_4", "model_1_submesh_5"]
FIXED = {
    "model_1_submesh_0": ["top"], "model_1_submesh_6": ["top"],
    "model_1_submesh_7": ["hir", "met"],
    "model_2_submesh_0": ["hir"], "model_2_submesh_1": ["hir"], "model_2_submesh_2": ["hir"],
    "model_3_submesh_0": ["met"], "model_3_submesh_1": ["met"],
    "model_4_submesh_0": ["fac"], "model_4_submesh_1": ["fac"], "model_4_submesh_2": ["fac"], "model_4_submesh_3": ["fac"],
}
ISLAND_MAJORITY = 0.75


def region(bone):
    if bone.startswith(("j_te_", "j_oya_", "j_hito_", "j_naka_", "j_kusu_", "j_ko_", "n_hte_", "j_ude_b_", "n_hhiji_", "n_hijisoubi_")):
        return "glv"
    if bone == "j_kosi" or bone.startswith(("j_asi_a_", "j_asi_b_", "n_hizasoubi_")):
        return "dwn"
    if bone.startswith(("j_asi_c_", "j_asi_d_", "j_asi_e_")):
        return "sho"
    return "top"


SLOTS = ["top", "glv", "dwn", "sho"]


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
    """Replace zero / NaN normals (a few in the rip) with area-weighted geometric normals, welded across UV seams."""
    n = np.nan_to_num(m["nrm"])
    ln = np.linalg.norm(n, axis=1)
    bad = ln < 0.5
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


def texsets():
    tex, cur = {}, None
    for line in open(os.path.join(ROOT, "source", "Griffith.mtl")):
        if line.startswith("newmtl"):
            cur = line.split()[1]
        elif line.startswith("map_Kd"):
            tex[cur] = TEXSET[line.split()[1]]
    return tex


def build():
    fitted = pickle.load(open(os.path.join(ROOT, "work", "fit", "fitted.pkl"), "rb"))
    skel = Skeleton(xd.extract("chara/human/c0101/skeleton/base/b0001/skl_c0101b0001.sklb")[0])
    tset = texsets()
    pieces = {}  # (model, texset) -> list of (part name, triangle indices)
    for name, m in fitted.items():
        ts = tset[m["material"]]
        if name in BODY_PARTS:
            tri = split_body(m)
            for si, slot in enumerate(SLOTS):
                idx = np.nonzero(tri == si)[0]
                if len(idx):
                    pieces.setdefault((slot, ts), []).append((name, idx))
        else:
            for model in FIXED[name]:
                pieces.setdefault((model, ts), []).append((name, np.arange(len(m["faces"]))))

    for n, m in fitted.items():
        fixed = repair_normals(m)
        if fixed:
            print(f"{n}: repaired {fixed} normals")
    tan = {n: tangents(m["pos"], m["nrm"], m["uv"], m["faces"]) for n, m in fitted.items()}
    os.makedirs(os.path.join(OUT, "gltf"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "mdl"), exist_ok=True)
    result = {}
    for model in MODEL_PATH:
        meshes = []
        for (mod, ts), plist in sorted(pieces.items()):
            if mod != model:
                continue
            arrs = {k: [] for k in ("pos", "nrm", "uv", "tan", "bones", "weights", "faces")}
            base = 0
            for name, idx in plist:
                m = fitted[name]
                f = m["faces"][idx]
                used, remap = np.unique(f, return_inverse=True)
                arrs["faces"].append(remap.reshape(-1, 3) + base)
                for k, src in (("pos", m["pos"]), ("nrm", m["nrm"]), ("uv", m["uv"]), ("tan", tan[name]),
                               ("bones", m["bones"]), ("weights", m["weights"])):
                    arrs[k].append(src[used])
                base += len(used)
            a = {k: np.concatenate(v) for k, v in arrs.items()}
            joints = np.vectorize(lambda b: skel.index[b] if b else 0)(a["bones"]).astype(np.int64)
            weights = np.where(a["bones"] == "", 0.0, a["weights"])
            weights /= weights.sum(1, keepdims=True)
            assert len(a["pos"]) < 65536, (model, ts, len(a["pos"]))
            # vertex colour set 0 multiplies the surface colour in character.shpk: vanilla gear has it white (black
            # renders the model pitch black in game)
            meshes.append(dict(name=f"{model}_{len(meshes)}.0", material=MATERIAL[(model, ts)],
                               positions=a["pos"], normals=a["nrm"], uvs=np.c_[a["uv"][:, 0], 1 - a["uv"][:, 1]],
                               tangents=a["tan"], colors=np.ones((len(a["pos"]), 4)),
                               joints=joints, weights=weights, indices=a["faces"].ravel()))
            print(f"{model} {ts}: {len(a['pos'])} verts, {len(a['faces'])} tris from {[n for n, _ in plist]}")
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
