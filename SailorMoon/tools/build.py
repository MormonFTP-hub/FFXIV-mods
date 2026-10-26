"""The fitted Sailor Moon as the costume's four models, converted with Penumbra's own glTF importer.

Per fitted race (Midlander woman c0201, Midlander man c0101, Roegadyn man c0901, Lalafell c1101;
work/fit/<race>.pkl):
  met  Neo Queen's Tiara (e6257)       head (material a: face, ears, eyes) and hair (material b)
  top  Educand's Sailor Top (e6162)    leotard top, collar, bows, choker, puff sleeves, arms and gloves
  dwn  Educand's Sailor Skirt (e6162)  skirt, back bow's tails, leotard bottom, legs
  sho  Educand's Loafers (e6162)       boots
The fit already assigns each part a slot. Every model copies its vanilla model's flags and gets a bounding
radius that covers her (the importer writes 1). Plus empty stand-ins for every player face (an option).
"""
import os
import pickle
import re
import struct
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from gltf_writer import write_glb  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build")
SETS = {"met": 6257, "top": 6162, "dwn": 6162, "sho": 6162}
SLOTS = list(SETS)
RACES = ("c0201", "c0101", "c0901", "c1101")
# material letter per slot and texture set
LETTERS = {"met": ["head", "hair"], "top": ["body"], "dwn": ["body"], "sho": ["body"]}
FACE_RACES = [f"c{n:04d}" for n in range(101, 1902, 100)]
FACE_IDS = [f"f{i:04d}" for i in list(range(1, 11)) + list(range(101, 111)) + list(range(201, 211))]


def mtrl_name(race, slot, texset):
    letter = "abcdefgh"[LETTERS[slot].index(texset)]
    return f"/mt_{race}e{SETS[slot]:04d}_{slot}_{letter}.mtrl"


def mtrl_game_path(race, slot, texset):
    return f"chara/equipment/e{SETS[slot]:04d}/material/v0001{mtrl_name(race, slot, texset)}"


def clean_tangents(tan, nrm):
    """Unit tangents perpendicular to the normals, sign +-1: a few come out of the fit parallel to their normal
    (or averaged to nothing across a UV seam), which glTF readers reject; those get any perpendicular."""
    n = nrm / np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
    t = np.nan_to_num(tan[:, :3])
    t -= n * np.sum(t * n, 1, keepdims=True)
    ln = np.linalg.norm(t, axis=1)
    bad = ln < 1e-3
    ref = np.where(np.abs(n[:, 1:2]) < 0.9, [[0.0, 1.0, 0.0]], [[1.0, 0.0, 0.0]])
    t[bad] = np.cross(ref[bad], n[bad])
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    w = np.where(np.nan_to_num(tan[:, 3]) < 0, -1.0, 1.0)
    return np.c_[t, w], n, int(bad.sum())


def set_flags1(path, bits):
    """OR bits into a v6 .mdl's ModelHeader flags1 byte: after the 0x44-byte file header, the vertex declarations
    (136 bytes each), the string block (count, pad, size, strings), then radius and nine u16 counts and the LOD count.
    (From the Asuka port; checked with `xivtool mdlinfo`.)"""
    b = bytearray(open(path, "rb").read())
    decl = struct.unpack_from("<H", b, 12)[0]
    o = 0x44 + 136 * decl
    o += 8 + struct.unpack_from("<I", b, o + 4)[0] + 4 + 18 + 1
    before = b[o]
    b[o] |= bits
    open(path, "wb").write(b)
    return f"0x{before:02X} -> 0x{b[o]:02X}"


def convert(name, skel, meshes_by_mat, vanilla=None, no_shadow=False):
    """meshes_by_mat: {material: [part dicts]} -> .mdl via glTF. With a vanilla model, copy its flags and set the
    bounding radius to the larger of its radius and ours. no_shadow: the model casts no sun shadow (flags1 bit 0,
    ShadowDisabled), so her bangs don't throw a hard shadow across her face (seen in GS; vanilla hair does the same)."""
    meshes = []
    for mat, plist in meshes_by_mat.items():
        arrs = {k: [] for k in ("pos", "nrm", "uv", "tan", "bones", "weights", "faces")}
        base = 0
        for m in plist:
            arrs["faces"].append(m["faces"] + base)
            arrs["pos"].append(m["pos"])
            arrs["nrm"].append(m["nrm"])
            arrs["uv"].append(np.c_[m["uv"][:, 0], 1 - m["uv"][:, 1]])
            arrs["tan"].append(m["tan"])
            arrs["bones"].append(m["bones"])
            arrs["weights"].append(m["weights"])
            base += len(m["pos"])
        a = {k: np.concatenate(v) for k, v in arrs.items()}
        a["tan"], a["nrm"], n_bad = clean_tangents(a["tan"], a["nrm"])
        if n_bad:
            print(f"  {name} {mat}: rebuilt {n_bad} degenerate tangents")
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
        src = xd.extract(vanilla)[0] or xd.extract(re.sub(r"c\d{4}e", "c0201e", vanilla))[0]
        xd.xivtool("mdlflags", mdl, mdl, src)
        van = float(xd.xivtool("mdlinfo", src).split("radius=")[1].split()[0])
        ours = max(np.linalg.norm(m["pos"], axis=1).max() for pl in meshes_by_mat.values() for m in pl)
        out = xd.xivtool("mdlradius", mdl, mdl, f"{max(van, ours * 1.02):.4f}")
        print("   ", out.strip())
    if no_shadow:
        print("    flags1", set_flags1(mdl, 0x01), xd.xivtool("mdlinfo", mdl).split("flags1=")[1].split()[0])
    return mdl


def build_race(race, result):
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit", f"{race}.pkl"), "rb"))
    skel = Skeleton(xd.extract(f"chara/human/{race}/skeleton/base/b0001/skl_{race}b0001.sklb")[0])
    by_slot = {s: {} for s in SLOTS}
    for name, p in fit["parts"].items():
        by_slot[p["slot"]].setdefault(p["texset"], []).append(p)
    for slot in SLOTS:
        assert set(by_slot[slot]) <= set(LETTERS[slot]), (slot, set(by_slot[slot]))
        mats = {mtrl_name(race, slot, t): by_slot[slot][t] for t in LETTERS[slot] if t in by_slot[slot]}
        name = f"{race}_{slot}"
        game = xd.gear_model_path(SETS[slot], slot, race)
        result[name] = (convert(name, skel, mats, game, no_shadow=slot == "met"), game)


def face_hiders(result):
    """Empty stand-ins for every player face model in the game (one degenerate triangle that keeps the face's
    first material, so nothing points at a missing material)."""
    paths = [f"chara/human/{r}/obj/face/{f}/model/{r}{f}_fac.mdl" for r in FACE_RACES for f in FACE_IDS]
    local = xd.extract(*paths)
    found = [p for p, l in zip(paths, local) if l]
    print(f"face hiders: {len(found)} face models")
    for p in found:
        race = p.split("/")[2]
        skel = Skeleton(xd.extract(f"chara/human/{race}/skeleton/base/b0001/skl_{race}b0001.sklb")[0])
        first_mat = xd.model(p)["materials"][0]
        c = skel.pos("j_kao")
        eps = 0.0005
        m = dict(pos=np.array([c, c + [eps, 0, 0], c + [0, 0, eps]]), nrm=np.tile([0.0, 1, 0], (3, 1)),
                 uv=np.array([[0.0, 0], [1, 0], [0, 1]]), faces=np.array([[0, 1, 2]]),
                 tan=np.tile([1.0, 0, 0, 1], (3, 1)),
                 bones=np.array([["j_kao", "", "", ""]] * 3, object), weights=np.tile([1.0, 0, 0, 0], (3, 1)))
        name = "hide_" + os.path.basename(p)[:-4]
        done = os.path.join(OUT, "mdl", f"{name}.mdl")
        result[name] = (done if os.path.exists(done) else convert(name, skel, {first_mat: [m]}), p)  # never change


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
