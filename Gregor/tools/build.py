"""Assemble the fitted pieces into FFXIV models and convert each with Penumbra's own glTF importer.

Wake Doctor's set (e6148), Hyur Midlander male (c0101) models, which Viera males wear through the racial deformer:
  top    coat, shoulder bolts, shirt / vest / tie / badge, neck skin          (variant: left sleeve rolled for a left centipede)
  glv    arm option: right centipede + left hand / both centipedes / left centipede + right arm / human arms
  dwn    pants, belt
  sho    right shoe, left leg armour and shoe
  met    glasses and/or halo
Skin pieces use the body's own material (/mt_c0101b0001_a.mtrl), so they take the wearer's skin.
"""
import os
import pickle
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from fit import edges_of, welded  # noqa: E402
from gltf_writer import write_glb  # noqa: E402
from islands import components  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build")
RACE, SET = "c0101", 6148
SKIN_MTRL = f"/mt_{RACE}b0001_a.mtrl"


def mtrl(slot, letter):
    return f"/mt_{RACE}e{SET:04d}_{slot}_{letter}.mtrl"


# material letter per (slot, texset); skin always uses the body material
LETTER = {("top", "aedd"): "a", ("top", "suit"): "b", ("glv", "centi"): "a", ("dwn", "suit"): "a",
          ("sho", "suit"): "a", ("sho", "aedd"): "b", ("met", "suit"): "a", ("met", "lens"): "b", ("met", "aedd"): "c"}
TOP = ["bolts", "suit:top", "suit_bits:top", "skin_neck"]
VARIANTS = {
    "top": {"top": ["coat"] + TOP, "top_rolled": ["coat_left_rolled"] + TOP},
    "glv": {"glv_right": ["centi_r", "skin_hand_l"], "glv_both": ["centi_r", "centi_l"],
            "glv_left": ["centi_l", "skin_arm_r"], "glv_human": ["skin_hand_l", "skin_arm_r"]},
    "dwn": {"dwn": ["suit:dwn", "suit_bits:dwn"]},
    "sho": {"sho": ["shoe_r", "leg_armor"]},
    "met": {"met_both": ["glasses_frame", "glasses_lens", "halo"], "met_glasses": ["glasses_frame", "glasses_lens"],
            "met_halo": ["halo"]},
}
ISLAND_MAJORITY = 0.75


def is_legs(bone):
    return bone == "j_kosi" or bone.startswith(("j_asi_", "n_hizasoubi_"))


def split_top_dwn(m):
    """Triangle -> 'top' or 'dwn' by summed leg/waist skin weight; whole islands go one way when one side dominates."""
    legs = np.zeros(len(m["pos"]))
    for k in range(m["bones"].shape[1]):
        legs += m["weights"][:, k] * np.array([is_legs(b) for b in m["bones"][:, k]])
    tri_legs = legs[m["faces"]].mean(1) > 0.5
    inv, uf, n = welded(m)
    comp = components(uf, n)[uf[:, 0]]
    for c in np.unique(comp):
        sel = comp == c
        frac = tri_legs[sel].mean()
        if frac >= ISLAND_MAJORITY or frac <= 1 - ISLAND_MAJORITY:
            tri_legs[sel] = frac >= 0.5
    return {"top": ~tri_legs, "dwn": tri_legs}


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


def piece(parts, spec, splits):
    """'name' or 'name:region' -> (part dict restricted to its triangles)."""
    name, _, region = spec.partition(":")
    m = parts[name]
    if not region:
        return name, m
    sel = splits[name][region]
    f = m["faces"][sel]
    used, remap = np.unique(f, return_inverse=True)
    sub = {k: (v[used] if isinstance(v, np.ndarray) and len(v) == len(m["pos"]) else v) for k, v in m.items()}
    sub["faces"] = remap.reshape(-1, 3)
    return spec, sub


def build():
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit", "fitted.pkl"), "rb"))
    parts = fit["parts"]
    skel = Skeleton(xd.extract(f"chara/human/{RACE}/skeleton/base/b0001/skl_{RACE}b0001.sklb")[0])
    splits = {n: split_top_dwn(parts[n]) for n in ("suit", "suit_bits")}
    os.makedirs(os.path.join(OUT, "gltf"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "mdl"), exist_ok=True)
    result = {}
    for slot, variants in VARIANTS.items():
        for vname, specs in variants.items():
            by_mat = {}
            for spec in specs:
                name, m = piece(parts, spec, splits)
                if len(m["faces"]) == 0:
                    continue
                mat = SKIN_MTRL if m["texset"] == "skin" else mtrl(slot, LETTER[(slot, m["texset"])])
                by_mat.setdefault(mat, []).append((name, m))
            meshes = []
            for mat, plist in sorted(by_mat.items(), key=lambda kv: kv[0] == SKIN_MTRL):
                arrs = {k: [] for k in ("pos", "nrm", "uv", "tan", "col", "bones", "weights", "faces")}
                base = 0
                for name, m in plist:
                    skin = m["texset"] == "skin"
                    uv_up = np.c_[m["uv"][:, 0], 1 - m["uv"][:, 1]] if skin else m["uv"]  # skin UVs come from the game
                    arrs["faces"].append(m["faces"] + base)
                    arrs["pos"].append(m["pos"])
                    arrs["nrm"].append(m["nrm"])
                    arrs["uv"].append(m["uv"] if skin else np.c_[m["uv"][:, 0], 1 - m["uv"][:, 1]])
                    arrs["tan"].append(tangents(m["pos"], m["nrm"], uv_up, m["faces"]))
                    # vertex colour set 0 multiplies the surface colour in character.shpk: vanilla gear has it white (black
                    # renders the model pitch black in game)
                    arrs["col"].append(m["col"] / 255.0 if skin else np.ones((len(m["pos"]), 4)))
                    arrs["bones"].append(m["bones"])
                    arrs["weights"].append(m["weights"])
                    base += len(m["pos"])
                a = {k: np.concatenate(v) for k, v in arrs.items()}
                missing = {b for b in a["bones"].ravel() if b and b not in skel.index}
                assert not missing, missing
                joints = np.vectorize(lambda b: skel.index[b] if b else 0)(a["bones"]).astype(np.int64)
                weights = np.where(a["bones"] == "", 0.0, a["weights"])
                weights /= weights.sum(1, keepdims=True)
                assert len(a["pos"]) < 65536, (vname, mat, len(a["pos"]))
                meshes.append(dict(name=f"{slot}_{len(meshes)}.0", material=mat, positions=a["pos"], normals=a["nrm"],
                                   uvs=a["uv"], tangents=a["tan"], colors=a["col"], joints=joints, weights=weights,
                                   indices=a["faces"].ravel()))
                print(f"{vname} {mat}: {len(a['pos'])} verts, {len(a['faces'])} tris from {[n for n, _ in plist]}")
            glb = os.path.join(OUT, "gltf", f"{vname}.glb")
            write_glb(glb, skel, meshes)
            mdl = os.path.join(OUT, "mdl", f"{vname}.mdl")
            r = subprocess.run(xd.XIVTOOL + ["import", glb, mdl], capture_output=True, text=True)
            print("   ", (r.stdout + r.stderr).strip()[:600])
            if r.returncode != 0 or not os.path.exists(mdl):
                raise RuntimeError(f"import failed for {vname}")
            result[vname] = (mdl, xd.gear_model_path(SET, slot, RACE), sorted(by_mat))
    with open(os.path.join(OUT, "mdl", "index.pkl"), "wb") as f:
        pickle.dump(result, f)
    return result


if __name__ == "__main__":
    build()
