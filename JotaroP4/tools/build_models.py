"""Split the fitted Jotaro into FFXIV models and write one .glb per model for Penumbra's importer.

usage: python build_models.py            -> work/gltf/{top,glv,dwn,sho,fac,hir}.glb + models.json

  top/glv/dwn/sho  The Emperor's New Robe/Gloves/Breeches/Boots (e0279), split per triangle by the
                   FFXIV bones that carry it (hands -> glv, feet -> sho, hips/legs -> dwn, rest -> top)
  fac              face f0001: Jotaro's whole head (face, cap and hair are one mesh), eyes, lashes
Skin (1.1.0): the face mesh's and the hands' skin triangles (picked by the atlas colour under them) get their own
skin.shpk materials, fac_a and glv_b, with vertex colour (0, 1, 1, 1) as vanilla faces and hands. On the gear shader
his skin went dull and dark whenever the sun wasn't on it; the cap and hair stay on the atlas material (etc_a).
  hir              hair h0001: a single degenerate triangle, so the player's own hair never shows
"""
import json
import os
import pickle
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gltf_writer import write_glb  # noqa: E402
from xivskel import Skeleton  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "work", "gltf")
SET, RACE, FACE, HAIR = "e0279", "c0101", "f0001", "h0001"

ATLAS = os.path.join(ROOT, "source", "Jotaro Kujo (Part 4)", "Textures", "t_4jtr01_body01_d.png")
FACE_SKIN = f"/mt_{RACE}{FACE}_fac_a.mtrl"      # skin.shpk (vanilla face material)
HAND_SKIN = f"/mt_{RACE}{SET}_glv_b.mtrl"       # skin.shpk (vanilla body material)
SKIN_MATERIALS = {FACE_SKIN, HAND_SKIN}
SKIN_SPLIT = {"face_4"}                         # face meshes whose skin triangles go to FACE_SKIN
FACE_MATERIAL = {  # rip mesh -> face material
    "face_1": f"/mt_{RACE}{FACE}_etc_a.mtrl", "face_2": f"/mt_{RACE}{FACE}_etc_a.mtrl",
    "face_4": f"/mt_{RACE}{FACE}_etc_a.mtrl",
    "eye_l_Layer_2": f"/mt_{RACE}{FACE}_iri_a.mtrl", "eye_r_Layer_2": f"/mt_{RACE}{FACE}_iri_a.mtrl",
    "face_3": f"/mt_{RACE}{FACE}_etc_b.mtrl",  # eyelashes (alpha tested)
}


_atlas = None


def skin_triangles(m):
    """Triangles whose three corners and centroid mostly sit on warm, not-black atlas texels (skin, its hatched
    shadows included; black hair, the white cap and the gold badge are left out)."""
    global _atlas
    if _atlas is None:
        _atlas = np.asarray(Image.open(ATLAS).convert("RGB"), np.float32)
    h, w = _atlas.shape[:2]
    uv = m["c_uv"] % 1.0
    pts = np.concatenate([uv, uv.mean(1, keepdims=True)], 1)
    px = np.clip((pts[..., 0] * w).astype(int), 0, w - 1)
    py = np.clip(((1 - pts[..., 1]) * h).astype(int), 0, h - 1)
    rgb = _atlas[py, px]
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1)
    warm = (rgb[..., 0] >= rgb[..., 1]) & (rgb[..., 1] >= rgb[..., 2]) & (mx > 25) & (sat > 0.15)
    return warm.sum(1) >= 3


def region(bone):
    if bone.startswith(("j_te_", "j_oya", "j_hito", "j_naka", "j_kusu", "j_ko_")):
        return "glv"
    if bone.startswith(("j_asi_d", "j_asi_e")):
        return "sho"
    if bone.startswith(("j_asi_a", "j_asi_b", "j_asi_c")) or bone == "j_kosi":
        return "dwn"
    return "top"


def tangents(pos, nrm, uv, tris):
    """Per-vertex tangents (xyz + handedness w) from UV gradients, glTF UV convention."""
    t_acc = np.zeros_like(pos)
    b_acc = np.zeros_like(pos)
    p0, p1, p2 = pos[tris[:, 0]], pos[tris[:, 1]], pos[tris[:, 2]]
    w0, w1, w2 = uv[tris[:, 0]], uv[tris[:, 1]], uv[tris[:, 2]]
    e1, e2 = p1 - p0, p2 - p0
    d1, d2 = w1 - w0, w2 - w0
    r = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
    r = np.where(np.abs(r) < 1e-12, 1e-12, r)
    sdir = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) / r[:, None]
    tdir = (e2 * d1[:, 0:1] - e1 * d2[:, 0:1]) / r[:, None]
    for k in range(3):
        np.add.at(t_acc, tris[:, k], sdir)
        np.add.at(b_acc, tris[:, k], tdir)
    t = t_acc - nrm * np.sum(nrm * t_acc, 1, keepdims=True)
    bad = np.linalg.norm(t, axis=1) < 1e-9
    ref = np.where(np.abs(nrm[:, 1:2]) < 0.9, [[0.0, 1.0, 0.0]], [[1.0, 0.0, 0.0]])
    t[bad] = np.cross(ref[bad], nrm[bad])
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    w = np.where(np.sum(np.cross(nrm, t) * b_acc, 1) < 0, -1.0, 1.0)
    return np.hstack([t, w[:, None]]).astype(np.float32)


def build_mesh(name, material, m, tri_idx, sk, uv_shift=(0.0, 0.0)):
    """Unique vertices for the chosen triangles of a fitted mesh, in glTF conventions."""
    tris = m["tris"][tri_idx]
    c_uv = m["c_uv"][tri_idx].reshape(-1, 2) + np.array(uv_shift)
    c_uv = np.stack([c_uv[:, 0], 1.0 - c_uv[:, 1]], 1)  # Collada v-up -> glTF v-down
    c_n = m["c_nrm"][tri_idx].reshape(-1, 3)
    c_p = tris.reshape(-1)
    key = np.c_[c_p, np.round(c_n * 1000), np.round(c_uv * 100000)]
    uniq, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.reshape(-1)
    src = c_p[first]
    pos = m["pos"][src]
    nrm = c_n[first]
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True)
    uv = c_uv[first]
    joints = np.zeros((len(src), 4), np.int64)
    weights = np.zeros((len(src), 4), np.float32)
    for i, v in enumerate(src):
        for k, (b, w) in enumerate(m["weights"][v][:4]):
            joints[i, k] = sk.index[b]
            weights[i, k] = w
    weights /= weights.sum(1, keepdims=True)
    indices = inv.reshape(-1, 3)
    colors = np.ones((len(src), 4), np.float32)
    if material in SKIN_MATERIALS:
        colors[:, 0] = 0.0   # skin.shpk reads R as body-style shading; vanilla faces and hands are 0
    return dict(name=name, material=material, positions=pos, normals=nrm, uvs=uv,
                tangents=tangents(pos, nrm, uv, indices),
                colors=colors, joints=joints, weights=weights,
                indices=indices.reshape(-1))


def main():
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit.pkl"), "rb"))
    sk = Skeleton()
    pieces = {s: [] for s in ("top", "glv", "dwn", "sho", "fac")}
    for m in fit["meshes"]:
        if m["name"] in FACE_MATERIAL:
            # the iris sits on the texture's corner (wrapping); the texture is rolled by half so it is
            # centred, and the UVs move with it
            shift = (0.5, -0.5) if m["name"].startswith("eye") else (0.0, 0.0)
            if m["name"] in SKIN_SPLIT:
                sk_tri = skin_triangles(m)
                pieces["fac"].append((FACE_SKIN, m, np.nonzero(sk_tri)[0], shift))
                pieces["fac"].append((FACE_MATERIAL[m["name"]], m, np.nonzero(~sk_tri)[0], shift))
                print(f"{m['name']}: {sk_tri.sum()} of {len(sk_tri)} triangles are skin")
            else:
                pieces["fac"].append((FACE_MATERIAL[m["name"]], m, np.arange(len(m["tris"])), shift))
            continue
        vreg = []
        for infl in m["weights"]:
            score = {}
            for b, w in infl:
                score[region(b)] = score.get(region(b), 0) + w
            vreg.append(score)
        tri_reg = []
        for t in m["tris"]:
            score = {}
            for v in t:
                for r, w in vreg[v].items():
                    score[r] = score.get(r, 0) + w
            tri_reg.append(max(score, key=score.get))
        tri_reg = np.array(tri_reg)
        m["slot"] = tri_reg
        sk_tri = skin_triangles(m)
        for slot in ("top", "glv", "dwn", "sho"):
            idx = np.nonzero(tri_reg == slot)[0]
            if slot == "glv":      # the bare hands: skin on HAND_SKIN
                skin = idx[sk_tri[idx]]
                if len(skin):
                    pieces[slot].append((HAND_SKIN, m, skin, (0.0, 0.0)))
                    print(f"{m['name']}: {len(skin)} hand triangles are skin")
                idx = idx[~sk_tri[idx]]
            if len(idx):
                pieces[slot].append((f"/mt_{RACE}{SET}_{slot}_a.mtrl", m, idx, (0.0, 0.0)))

    os.makedirs(OUT, exist_ok=True)
    stats = {}
    for slot, items in pieces.items():
        # one glTF mesh per material, the rip pieces sharing it become submeshes
        by_mat = {}
        for mat, m, idx, shift in items:
            by_mat.setdefault(mat, []).append((m, idx, shift))
        meshes = []
        for mi, (mat, parts) in enumerate(by_mat.items()):
            for si, (m, idx, shift) in enumerate(parts):
                meshes.append(build_mesh(f"jotaro_{mi}.{si}", mat, m, idx, sk, shift))
        write_glb(os.path.join(OUT, f"{slot}.glb"), sk, meshes)
        stats[slot] = [dict(mesh=x["name"], material=x["material"], verts=len(x["positions"]),
                            tris=len(x["indices"]) // 3,
                            bones=sorted({sk.names[j] for j in np.unique(x["joints"][x["weights"] > 0])}))
                       for x in meshes]
        print(f"{slot}: " + ", ".join(f"{s['mesh']} {s['material']} {s['verts']}v {s['tris']}t {len(s['bones'])} bones"
                                      for s in stats[slot]))

    # hair h0001: one zero-area triangle on the head bone
    p = sk.pos("j_kao")
    empty = dict(name="hair_0.0", material=f"/mt_{RACE}{HAIR}_hir_a.mtrl",
                 positions=np.array([p, p + [0.0001, 0, 0], p + [0, 0.0001, 0]]), normals=np.tile([0, 0, 1.0], (3, 1)),
                 uvs=np.zeros((3, 2)), colors=np.ones((3, 4)), joints=np.full((3, 4), sk.index["j_kao"]),
                 weights=np.tile([1.0, 0, 0, 0], (3, 1)), indices=np.array([0, 1, 2]))
    write_glb(os.path.join(OUT, "hir.glb"), sk, [empty])
    with open(os.path.join(OUT, "models.json"), "w") as f:
        json.dump(stats, f, indent=1)
    with open(os.path.join(ROOT, "work", "fit_slots.pkl"), "wb") as f:
        pickle.dump(fit, f)


main()
