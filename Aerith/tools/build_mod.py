"""Build the Aerith Penumbra mod from work/export/*.json and the textures in work/mod.

  python -P -E tools/build_mod.py          (run tools/build_textures.py and the Blender fit/export first)

Models go through Penumbra's own glTF importer (apps/xivtool import), materials are copies of a vanilla
characterlegacy.shpk material, and the pack carries the EQP/EQDP edits for the Spring Dress set (e0141).
"""
import json
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meta  # noqa: E402
import xivdata as xd  # noqa: E402
from gltf_writer import write_glb  # noqa: E402
from xiv_files import write_pmp  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

ROOT = xd.ROOT
WORK = os.path.join(ROOT, "work")
MOD = os.path.join(WORK, "mod")
GLB = os.path.join(WORK, "glb")
OPTS = os.path.join(WORK, "opts")
OUT = os.path.join(ROOT, "out")
SET_ID = 141
E = f"e{SET_ID:04d}"
VERSION = "1.8.0"
SLOTS = ("met", "top", "glv", "dwn", "sho")
TEMPLATE = "chara/equipment/e0001/material/v0001/mt_c0201e0001_top_a.mtrl"   # vanilla characterlegacy.shpk
TEX = f"chara/equipment/{E}/texture"

# material -> (texture set, double-sided, alpha threshold)
MATERIALS = {
    "top_a": ("a", True, 0.5),
    "top_b": ("b", True, 0.5),
    "glv_a": ("a", True, 0.5),
    "sho_b": ("b", True, 0.5),
    "met_h": ("h", True, 0.35),
    "met_b": ("b", True, 0.5),
    "met_s": ("s", True, 0.5),
}
# characterlegacy shininess (specular power) of each colour-table pair: glossy first row, matte second. The _id map's
# green (FF7R gloss) blends between them per pixel; vanilla legacy rows run from about 3 (broad) to 32 (tight).
SHININESS = "32/3"

# EQP per slot. Body/hands/legs/feet follow the bare Emperor's New set (how the user's Bibo+ arms and legs
# normally show); the body hides the necklace and bracelet accessories (Aerith wears her own), the head hides
# the hairstyle and necklace. Her gloves and boots hide none of the body's skin pieces: Emperor's New sets
# HandsHideElbow and FeetHideKnee, which drop Bibo+'s elbow-to-forearm (atr_ude) and knee (atr_hiz) skin and
# leave holes between the sleeve and the bracelets and under the skirt.
EQP_E0279 = meta.eqp(279)
HANDS_HIDE = (1 << 25) | (1 << 26)              # HandsHideElbow, HandsHideForearm
FEET_HIDE = (1 << 33) | (1 << 34) | (1 << 35)   # FeetHideKnee, FeetHideCalf, FeetHideAnkle
EQP = {
    "top": EQP_E0279 & ~((1 << 11) | (1 << 12)),
    "glv": EQP_E0279 & ~HANDS_HIDE,
    "dwn": EQP_E0279,
    "sho": EQP_E0279 & ~FEET_HIDE,
    "met": (EQP_E0279 | (1 << 42)) & ~(1 << 45),
}
EQP_OWN_HAIR = EQP_E0279 & ~(1 << 45)      # head slot empty: your hairstyle shows, necklace still hidden
MET = f"chara/equipment/{E}/model/c0201{E}_met.mdl"
HEAD_OPTIONS = [
    ("Aerith's hair", "Aerith's hair with her pink ribbon. Hides your own hairstyle.", "head_aerith", EQP["met"]),
    ("Your own hairstyle", "Nothing on the head: keep your character's hair.", "head_none", EQP_OWN_HAIR),
]
FEMALE_FALLBACK = ["Highlander", "Elezen", "Miqote", "Roegadyn", "AuRa", "Hrothgar", "Viera"]

# The Face option: Aerith's face replaces every face of these races (work/export/face_<race>_f<id>.json from
# tools/blender/build_face.py). Its four materials live in face 1's folder, named after it, so all faces share them.
FACE_RACES = ["c0201"]
FACE_DIR = os.path.join(OPTS, "face_aerith")
FACE_TEXTURES = ("aerith_face_", "aerith_eye_", "aerith_mth_", "aerith_lsh_")
# material -> (vanilla template or None for the legacy gear one, textures, double-sided, alpha threshold)
FACE_MATERIALS = {
    "fac": ("chara/human/{race}/obj/face/f0001/material/mt_{race}f0001_fac_a.mtrl",
            [f"{TEX}/aerith_face_base.tex", f"{TEX}/aerith_face_norm.tex", f"{TEX}/aerith_face_mask.tex"], False, 0.5),
    "eye": (None, ["eye"], False, 0.5),
    "mth": (None, ["mth"], False, 0.5),
    "lsh": (None, ["lsh"], True, 0.5),
}


def game(path):
    return os.path.join(MOD, *path.split("/"))


class MergedSkeleton:
    """Base skeleton plus face-skeleton bones, re-rooted under the base j_kao (what the glTF writer needs)."""

    def __init__(self, base, extras):
        self.bones, self.names, self.parents = list(base.bones), list(base.names), list(base.parents)
        self.world = [w for w in base.world]
        kao = base.world[base.index["j_kao"]]
        for sk in extras:
            to_base = kao @ np.linalg.inv(sk.world[sk.index["j_kao"]])
            for i, n in enumerate(sk.names):
                if n in self.names:
                    continue
                parent = sk.names[sk.parents[i]] if sk.parents[i] >= 0 else "j_kao"
                self.parents.append(self.names.index(parent))
                self.names.append(n)
                self.bones.append((n, self.parents[-1], *sk.bones[i][2:]))
                self.world.append(to_base @ sk.world[i])
        self.index = {n: i for i, n in enumerate(self.names)}
        self.world = np.array(self.world)

    def pos(self, name):
        return self.world[self.index[name]][:3, 3].copy()


def face_skeleton(race):
    base = Skeleton(xd.extract(f"chara/human/{race}/skeleton/base/b0001/skl_{race}b0001.sklb")[0])
    extras = []
    for f in range(1, 10):
        p = xd.extract(f"chara/human/{race}/skeleton/face/f{f:04d}/skl_{race}f{f:04d}.sklb")[0]
        if p:
            extras.append(Skeleton(p))
    return MergedSkeleton(base, extras)


def build_face():
    for race in FACE_RACES:
        sk = face_skeleton(race)
        jsons = sorted(f for f in os.listdir(os.path.join(WORK, "export")) if f.startswith(f"face_{race}_f"))
        for jf in jsons:
            fid = jf[len(f"face_{race}_f"):-5]
            meshes = json.load(open(os.path.join(WORK, "export", jf)))
            for m in meshes:
                missing = {j for js in m["joints"] for j in js} - set(sk.index)
                if missing:
                    raise RuntimeError(f"{jf} {m['name']}: bones not in the {race} skeletons: {sorted(missing)}")
                m["joints"] = [[sk.index[j] for j in js] for js in m["joints"]]
                m["name"] = "aerith_" + m["name"]
            glb = os.path.join(GLB, f"face_{race}_f{fid}.glb")
            write_glb(glb, sk, meshes)
            gp = f"chara/human/{race}/obj/face/f{fid}/model/{race}f{fid}_fac.mdl"
            mdl = os.path.join(FACE_DIR, *gp.split("/"))
            os.makedirs(os.path.dirname(mdl), exist_ok=True)
            print(xd.xivtool("import", glb, mdl).strip())
        tmpl_legacy = xd.extract(TEMPLATE)[0]
        fids = [jf[len(f"face_{race}_f"):-5] for jf in jsons]
        for name, (tmpl, texs, both, alpha) in FACE_MATERIALS.items():
            gp = f"chara/human/{race}/obj/face/f0001/material/mt_{race}f0001_aerith_{name}.mtrl"
            out = os.path.join(FACE_DIR, *gp.split("/"))
            os.makedirs(os.path.dirname(out), exist_ok=True)
            if tmpl:
                print(xd.xivtool("retex", xd.extract(tmpl.format(race=race))[0], out, *texs).strip())
            else:
                k = texs[0]
                t = [f"{TEX}/aerith_{k}_{c}.tex" for c in ("d", "n", "s", "id")]
                print(xd.xivtool("mkmtrl2", tmpl_legacy, out, "1.0", "1" if both else "0", f"{alpha}", SHININESS, *t).strip())
            # the game puts the character's own face id into a face model's material path (folder AND file name):
            # on face 5 it asks for f0005/material/mt_c0201f0005_aerith_fac.mtrl. Up to 1.7.0 only face 1's copies
            # shipped, so on faces 2-5 the materials failed to load and the face was invisible until a face swap.
            data = open(out, "rb").read()
            for fid in fids:
                if fid != "0001":
                    gp2 = f"chara/human/{race}/obj/face/f{fid}/material/mt_{race}f{fid}_aerith_{name}.mtrl"
                    out2 = os.path.join(FACE_DIR, *gp2.split("/"))
                    os.makedirs(os.path.dirname(out2), exist_ok=True)
                    open(out2, "wb").write(data)
    # the face textures only ship with the option
    src_dir = os.path.join(MOD, *TEX.split("/"))
    dst_dir = os.path.join(FACE_DIR, *TEX.split("/"))
    os.makedirs(dst_dir, exist_ok=True)
    for f in os.listdir(src_dir):
        if f.startswith(FACE_TEXTURES):
            os.replace(os.path.join(src_dir, f), os.path.join(dst_dir, f))


def build_models():
    sk = Skeleton(xd.extract("chara/human/c0201/skeleton/base/b0001/skl_c0201b0001.sklb")[0])
    os.makedirs(GLB, exist_ok=True)
    for slot in SLOTS:
        meshes = json.load(open(os.path.join(WORK, "export", f"{slot}.json")))
        for m in meshes:
            missing = {j for js in m["joints"] for j in js} - set(sk.index)
            if missing:
                raise RuntimeError(f"{slot} {m['name']}: bones not in the c0201 skeleton: {sorted(missing)}")
            m["joints"] = [[sk.index[j] for j in js] for js in m["joints"]]
            m["name"] = "aerith_" + m["name"]
        glb = os.path.join(GLB, f"{slot}.glb")
        write_glb(glb, sk, meshes)
        mdl = game(f"chara/equipment/{E}/model/c0201{E}_{slot}.mdl")
        if slot == "met":
            mdl = os.path.join(OPTS, "head_aerith", *MET.split("/"))
        os.makedirs(os.path.dirname(mdl), exist_ok=True)
        print(xd.xivtool("import", glb, mdl).strip())
        if slot == "met":
            # her fringe and side locks hang in front of the face as cut-out strand cards, and their sun shadow
            # dappled the face grey with lit gaps in game (1.2.0-1.6.0); the hair casts no shadow (flags1 bit 0)
            print(xd.xivtool("mdlflags", mdl, mdl, "1").strip())
    # "Your own hairstyle": an invisible head piece (one microscopic triangle inside the head)
    k = sk.pos("j_kao")
    tiny = {"name": "aerith_met_0.0", "material": f"/mt_c0201{E}_met_b.mtrl",
            "positions": [list(k), list(k + [1e-4, 0, 0]), list(k + [0, 1e-4, 0])],
            "normals": [[0, 0, 1]] * 3, "tangents": [[1, 0, 0, 1]] * 3, "uvs": [[0, 0], [1, 0], [0, 1]],
            "colors": [[1, 1, 1, 1]] * 3, "joints": [[sk.index["j_kao"]] * 4] * 3,
            "weights": [[1, 0, 0, 0]] * 3, "indices": [0, 1, 2]}
    glb = os.path.join(GLB, "met_none.glb")
    write_glb(glb, sk, [tiny])
    mdl = os.path.join(OPTS, "head_none", *MET.split("/"))
    os.makedirs(os.path.dirname(mdl), exist_ok=True)
    print(xd.xivtool("import", glb, mdl).strip())


def build_materials():
    tmpl = xd.extract(TEMPLATE)[0]
    folder = f"chara/equipment/{E}/material/v{xd.imc_material_set(SET_ID, 'top', 1):04d}"
    for name, (ts, both, alpha) in MATERIALS.items():
        out = game(f"{folder}/mt_c0201{E}_{name}.mtrl")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        texs = [f"{TEX}/aerith_{ts}_{c}.tex" for c in ("d", "n", "s", "id")]
        print(xd.xivtool("mkmtrl2", tmpl, out, "1.0", "1" if both else "0", f"{alpha}", SHININESS, *texs).strip())


def manipulations():
    manip = [meta.eqp_manip(SET_ID, slot, EQP[slot]) for slot in SLOTS if slot != "met"]  # head: per option
    for slot in SLOTS:
        manip.append(meta.eqdp_manip(SET_ID, slot, "Female", "Midlander", 0x3FF))
        for race in FEMALE_FALLBACK:   # these races use the Midlander model through their racial deformer
            manip.append(meta.eqdp_manip(SET_ID, slot, "Female", race, 0))
    return manip


def package():
    files = {}
    for dp, _, fs in os.walk(MOD):
        for f in fs:
            rel = os.path.relpath(os.path.join(dp, f), MOD).replace("\\", "/")
            files[rel] = os.path.join(dp, f)
    meta_json = {
        "Name": "Aerith Gainsborough (FF7 Remake)",
        "Author": "FF7R rip port",
        "Description": (
            "Aerith's outfit from Final Fantasy VII Remake Intergrade, refit for FFXIV women "
            "(Midlander, Highlander, Elezen, Miqo'te, Roegadyn, Au Ra, Hrothgar, Viera) on Bibo+ (Medium).\n\n"
            "Replaces the Spring Dress set (e0141):\n"
            "  Spring Straw Hat = Aerith's hair with her pink ribbon (or keep your own hairstyle: Head option)\n"
            "  Spring Dress = pink dress, red jacket and choker\n"
            "  Coronal Wristband = her bracelets (bare hands)\n"
            "  Spring Skirt = bare legs\n"
            "  Spring Dress Shoes = her boots\n\n"
            "Face option: Aerith's own face, rigged to the FFXIV face bones (it blinks, talks and emotes). While it is "
            "on it replaces every Midlander woman's face, for everyone you see, so switch it off when you are done.\n\n"
            "Wear all five pieces (Glamourer works). Requires Bibo+ (skin materials).\n"
            "Personal use only: the original assets belong to Square Enix."
        ),
        "Version": VERSION,
        "Website": "",
        "ModTags": ["Bibo+", "Gear", "Port", "Final Fantasy VII"],
    }
    default_mod = {"Files": {k: k.replace("/", "\\") for k in files}, "Manipulations": manipulations()}
    pack = {k.replace("/", "\\"): v for k, v in files.items()}
    options = []
    for name, desc, folder, eqp in HEAD_OPTIONS:
        inner = folder + "\\" + MET.replace("/", "\\")
        pack[inner] = os.path.join(OPTS, folder, *MET.split("/"))
        options.append({"Name": name, "Description": desc, "Priority": 0, "Files": {MET: inner}, "FileSwaps": {},
                        "Manipulations": [meta.eqp_manip(SET_ID, "met", eqp)]})
    groups = [{"Name": "Head", "Description": "What the Spring Straw Hat shows.", "Type": "Single",
               "DefaultSettings": 0, "Options": options}]
    face_files = {}
    for dp, _, fs in os.walk(FACE_DIR):
        for f in fs:
            rel = os.path.relpath(os.path.join(dp, f), FACE_DIR).replace("\\", "/")
            inner = "face_aerith\\" + rel.replace("/", "\\")
            face_files[rel] = inner
            pack[inner] = os.path.join(dp, f)
    groups.append({"Name": "Face", "Type": "Single", "DefaultSettings": 0,
                   "Description": "Aerith's own face. While it is on it replaces every Midlander woman's face (faces 1-5), "
                                  "for everyone you see. Her face takes your skin colour; her eyes stay green.",
                   "Options": [{"Name": "Your own face", "Description": "", "Priority": 0, "Files": {}, "FileSwaps": {},
                                "Manipulations": []},
                               {"Name": "Aerith's face", "Description": "Midlander women only.", "Priority": 0,
                                "Files": face_files, "FileSwaps": {}, "Manipulations": []}]})
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "Aerith Gainsborough (FF7R).pmp")
    write_pmp(path, meta_json, default_mod, groups, pack)
    print(f"wrote {path}: {len(files)} files, {len(default_mod['Manipulations'])} meta edits, "
          f"{os.path.getsize(path) / 1e6:.1f} MB")


if __name__ == "__main__":
    steps = sys.argv[1:] or ["models", "materials", "package"]
    if "models" in steps:
        build_models()
    if "models" in steps or "face" in steps:
        build_face()
    if "materials" in steps:
        build_materials()
    if "package" in steps:
        package()
