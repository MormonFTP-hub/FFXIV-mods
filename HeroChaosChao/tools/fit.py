"""Put the Hero Chaos Chao on the Mammet #001 skeleton (m8001) and skin it.

The Chao is scaled so its head top meets the mammet's, and stays in its own pose: the two
bodies line up closely (shoulders, hips and neck within a few centimetres). The Chao's limbs and
trunk are much thicker than the mammet's, so weights come from the Chao's own shape: trunk and
head by height (hips, spine, head), arms and feet along their length, eyes and ears on the head.
"""
import os

import numpy as np

import chaosrc
import xivdata as xd
from xiv_skeleton import Skeleton

MAMMET = "chara/monster/m8001"
SKEL = xd.local(f"{MAMMET}/skeleton/base/b0001/skl_m8001b0001.sklb")
MDL = f"{MAMMET}/obj/body/b0001/model/m8001b0001.mdl"

HEAD_TOP = 0.617            # mammet head top (m); the Chao's head (without ears) is scaled to it
CHAO_HEAD_TOP = 4.42        # source units
SCALE = HEAD_TOP / CHAO_HEAD_TOP

# source object prefix -> how its vertices are weighted (None: dropped, SA2 placeholder triangles)
PIECES = {
    "001": "trunk",                     # belly
    "016": "trunk",                     # head, crest and the back running down to the floor
    "018": "head", "021": "head",       # eyes
    "019": "head", "022": "head",       # eyelids
    "023": "head", "025": "head",       # ear-wings
    "003": "limb", "010": "limb", "006": "limb", "013": "limb",
    "008": None, "037": None, "039": None,
}
NECK = (0.24, 0.31)    # trunk: head weight rises over this height (m); the Chao's chin is at ~0.31
WAIST = (0.12, 0.20)   # trunk: below this the hips (j_kosi) take over from the spine (j_sebo_a)
# limbs are weighted along their own length: (upper bone, lower bone, kind)
LIMBS = {
    "003": ("j_ude_a_l", "j_ude_b_l", "arm"),               # +X is the Chao's left, as in FFXIV
    "010": ("j_ude_a_r", "j_ude_b_r", "arm"),
    "006": ("j_asi_a_l", "j_asi_b_l", "foot"),
    "013": ("j_asi_a_r", "j_asi_b_r", "foot"),
}
ELBOW = (0.35, 0.75)   # arm: forearm weight rises over this stretch of the arm's length (0 shoulder, 1 tip)
ANKLE = (0.07, 0.12)   # foot: thigh weight rises over this height (m); the mammet's knee is at 0.09
# source material -> texture set (build.py packs the four sets into one material's atlas)
MATERIALS = {"HeroChaos.sa2mdl_2": "c", "HeroChaos.sa2mdl_5": "c",   # al_hcha00: white to pink tips
             "HeroChaos.sa2mdl_0": "d",                              # al_hcha01: peach belly / cheeks
             "HeroChaos.sa2mdl_1": "e",                              # al_hcha02: white with pink spots
             "HeroChaos.sa2mdl_4": "f"}                              # eye colour


def tangents(pos, nrm, uv, idx):
    """Per-vertex tangents (xyz + bitangent sign) from UV gradients, orthogonalised against the normals."""
    tri = idx.reshape(-1, 3)
    p0, p1, p2 = pos[tri[:, 0]], pos[tri[:, 1]], pos[tri[:, 2]]
    t0, t1, t2 = uv[tri[:, 0]], uv[tri[:, 1]], uv[tri[:, 2]]
    e1, e2, d1, d2 = p1 - p0, p2 - p0, t1 - t0, t2 - t0
    r = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
    r = np.where(np.abs(r) < 1e-12, 1e-12, r)
    sdir = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) / r[:, None]
    tdir = (e2 * d1[:, 0:1] - e1 * d2[:, 0:1]) / r[:, None]
    T, B = np.zeros_like(pos), np.zeros_like(pos)
    for c in range(3):
        np.add.at(T, tri[:, c], sdir)
        np.add.at(B, tri[:, c], tdir)
    T -= nrm * (nrm * T).sum(1, keepdims=True)
    bad = np.linalg.norm(T, axis=1) < 1e-9
    ref = np.where(np.abs(nrm[:, 1:2]) < 0.9, [[0.0, 1.0, 0.0]], [[1.0, 0.0, 0.0]])
    T[bad] = np.cross(ref, nrm)[bad]
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    w = np.where((np.cross(nrm, T) * B).sum(1) < 0, -1.0, 1.0)
    return np.hstack([T, w[:, None]])


def mammet(skel):
    """The vanilla mammet's LOD0 meshes, with skeleton bone indices."""
    meshes = xd.model(MDL)["meshes"]
    for m in meshes:
        m["joints"] = np.array([[skel.index[b] if b else 0 for b in row] for row in m["bones"]])
    return meshes


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def limb_weights(pos, kind, skel, upper):
    """Weight of the lower bone (forearm / shin) for each limb vertex."""
    if kind == "foot":
        return 1 - smoothstep(*ANKLE, pos[:, 1])
    # arm: position along its main axis, measured from the end nearest the shoulder joint
    c = pos.mean(0)
    axis = np.linalg.svd(pos - c)[2][0]
    s = (pos - c) @ axis
    if np.linalg.norm(c + axis * s.min() - skel.pos(upper)) > np.linalg.norm(c + axis * s.max() - skel.pos(upper)):
        s = -s
    t = (s - s.min()) / (s.max() - s.min())
    return smoothstep(*ELBOW, t)


def top4(W):
    order = np.argsort(-W, axis=1)[:, :4]
    w = np.take_along_axis(W, order, 1)
    w[w < 0.02] = 0
    w /= w.sum(1, keepdims=True)
    return order, w


def chao(skel):
    """Chao meshes in mammet space, one per mdl material: positions, normals, uvs, tangents, joints, weights."""
    out = {}
    for pc in chaosrc.load():
        key = pc["object"][:3]
        if PIECES[key] is None:
            continue
        pos = pc["positions"] * SCALE
        nrm = pc["normals"] / np.linalg.norm(pc["normals"], axis=1, keepdims=True)
        uv = pc["uvs"] * [1, -1] + [0, 1]                    # OBJ v up -> glTF/FFXIV v down
        W = np.zeros((len(pos), len(skel.names)))
        if key in LIMBS:
            upper, lower, kind = LIMBS[key]
            wl = limb_weights(pos, kind, skel, upper)
            W[:, skel.index[upper]] = 1 - wl
            W[:, skel.index[lower]] = wl
        elif PIECES[key] == "head":
            W[:, skel.index["j_kao"]] = 1
        else:
            head = smoothstep(*NECK, pos[:, 1])
            hips = (1 - head) * (1 - smoothstep(*WAIST, pos[:, 1]))
            W[:, skel.index["j_kao"]] = head
            W[:, skel.index["j_kosi"]] = hips
            W[:, skel.index["j_sebo_a"]] = 1 - head - hips
        joints, weights = top4(W)
        suffix = MATERIALS[pc["material"]]
        o = out.setdefault(suffix, {k: [] for k in ("positions", "normals", "uvs", "joints", "weights", "indices", "objects")})
        base = sum(len(p) for p in o["positions"])
        o["positions"].append(pos)
        o["normals"].append(nrm)
        o["uvs"].append(uv)
        o["joints"].append(joints)
        o["weights"].append(weights)
        o["indices"].append(pc["indices"] + base)
        o["objects"].append(pc["object"][:3])
    meshes = []
    for suffix in sorted(out):
        o = out[suffix]
        m = {k: np.concatenate(o[k]) for k in ("positions", "normals", "uvs", "joints", "weights", "indices")}
        m["tangents"] = tangents(m["positions"], m["normals"], m["uvs"], m["indices"])
        m["suffix"], m["objects"] = suffix, o["objects"]
        meshes.append(m)
    return meshes


def landmarks():
    skel = Skeleton(SKEL)
    pcs = {pc["object"][:3]: pc["positions"] * SCALE for pc in chaosrc.load()}
    arm, foot, belly = pcs["003"], pcs["006"], pcs["001"]
    shoulder = arm[np.argsort(arm[:, 1])[-4:]].mean(0)
    print(f"scale {SCALE:.4f}")
    print("chao shoulder (top of arm)", shoulder.round(3), " mammet j_ude_a_l", skel.pos("j_ude_a_l").round(3))
    print("chao foot top", foot.max(0).round(3), " mammet j_asi_a_l", skel.pos("j_asi_a_l").round(3))
    print("chao belly", belly.min(0).round(3), belly.max(0).round(3), " mammet j_kosi", skel.pos("j_kosi").round(3),
          "j_kubi", skel.pos("j_kubi").round(3), "j_kao", skel.pos("j_kao").round(3))


if __name__ == "__main__":
    landmarks()
    skel = Skeleton(SKEL)
    for m in chao(skel):
        used = sorted({skel.names[j] for j in np.unique(m["joints"][m["weights"] > 0])})
        print(m["suffix"], len(m["positions"]), "verts", len(m["indices"]) // 3, "tris", m["objects"], used)
