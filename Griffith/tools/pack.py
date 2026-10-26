"""Package the built models, materials and textures as a Penumbra modpack (out/Griffith (Reborn).pmp).

Default files: the Hellhound / Grey Hound / Shadowhound set (e0110) for Hyur Midlander male, plus EQDP
entries so every other non-Lalafell male race wears the same c0101 models.
Option group "Face & Hair": Griffith's face (face 1) and hair (hairstyle 1) for Hyur Midlander male.
"""
import os
import pickle
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meta  # noqa: E402
import xivdata as xd  # noqa: E402
from build import MATERIAL, MODEL_PATH, RACE, SET  # noqa: E402
from xiv_files import write_pmp  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
PMP = os.path.join(ROOT, "out", "Griffith (Reborn).pmp")
VERSION = "1.1.0"
MATERIAL_SETS = (1, 2, 3)  # e0110 variants 1-3 (Hellhound, Grey Hound, Shadowhound) use v0001-v0003
OTHER_MALES = ["Highlander", "Elezen", "Miqote", "Roegadyn", "AuRa", "Hrothgar", "Viera"]
TEXSET_OF = {"_top_a": "armor", "_glv_a": "armor", "_dwn_a": "armor", "_sho_a": "armor", "_met_a": "armor",
             "_top_b": "cape", "_met_b": "hair", "_hir_a": "hair", "_etc_a": "hair", "_fac_a": "face"}

DESCRIPTION = """Griffith (Reborn) from BERSERK and the Band of the Hawk, rigged to the FFXIV Hyur Midlander male skeleton.

GEAR (Hellhound set, e0110 - any of Hellhound / Grey Hound / Shadowhound; all classes, level 1):
  Helm      -> hawk helmet with his hair flowing out (hides your hair, like the vanilla helm)
  Armor     -> breastplate, pauldrons, wings and cape (cape uses the skirt physics bones)
  Gauntlets -> gauntlets and gloves
  Cuisses   -> belt, thigh plates
  Sabatons  -> greaves and spurred sabatons
Hide headgear to show his face and hair instead of the helmet.
Other male races (except Lalafell) are redirected to the Midlander models.

FACE & HAIR (optional, on by default; Hyur Midlander male only):
  Face 1      -> Griffith's face (static: no blinking or expressions)
  Hairstyle 1 -> Griffith's long silver hair (colour is baked in, not from your hair colour)
Use Glamourer to set Hyur Midlander / Male / Face 1 / Hairstyle 1. Assign this mod in a collection used
only by your character, since face/hair replacements apply to everyone with that face/hairstyle.

Model: Koei Tecmo (BERSERK and the Band of the Hawk). Rip by SirDuckman."""


def build():
    models = pickle.load(open(os.path.join(B, "mdl", "index.pkl"), "rb"))
    textures = pickle.load(open(os.path.join(B, "tex", "index.pkl"), "rb"))
    mtrl_local = {ts: os.path.join(B, "mtrl", f"{ts}.mtrl") for ts in ("armor", "cape", "hair", "face")}
    files = {}  # inside pack -> local file

    def add(inner, local):
        files[inner] = local
        return inner.replace("/", "\\")  # Penumbra's own mods store relative paths with backslashes

    def mtrl_game_paths(model, name):
        n = name.lstrip("/")
        if model == "fac":
            return [f"chara/human/{RACE}/obj/face/f0001/material/{n}"]
        if model == "hir":
            return [f"chara/human/{RACE}/obj/hair/h0001/material/v0001/{n}"]
        return [f"chara/equipment/e{SET:04d}/material/v{v:04d}/{n}" for v in MATERIAL_SETS]

    def texset(name):
        return next(ts for suf, ts in TEXSET_OF.items() if name.endswith(suf + ".mtrl"))

    default_files, face_files, hair_files = {}, {}, {}
    for model, (local, game) in models.items():
        target = face_files if model == "fac" else hair_files if model == "hir" else default_files
        prefix = "face/" if model == "fac" else "hair/" if model == "hir" else ""
        target[game] = add(prefix + game, local)
        for (mod, _), name in MATERIAL.items():
            if mod != model:
                continue
            for gp in mtrl_game_paths(model, name):
                target[gp] = add(prefix + gp, mtrl_local[texset(name)])
    for key, (local, game) in textures.items():
        default_files[game] = add(game, local)

    manips = []
    for race in OTHER_MALES:
        for slot in ("met", "top", "glv", "dwn", "sho"):
            manips.append(meta.eqdp_manip(SET, slot, "Male", race, 0))

    groups = [{
        "Name": "Face & Hair",
        "Description": "Griffith's face (Hyur Midlander male, face 1) and hair (hairstyle 1).",
        "Type": "Multi",
        "DefaultSettings": 3,
        "Options": [
            {"Name": "Face (Midlander male, face 1)", "Description": "Griffith's face, eyes and lashes.",
             "Priority": 0, "Image": "", "Files": face_files, "FileSwaps": {}, "Manipulations": []},
            {"Name": "Hair (Midlander male, hairstyle 1)", "Description": "Griffith's long silver hair.",
             "Priority": 0, "Image": "", "Files": hair_files, "FileSwaps": {}, "Manipulations": []},
        ],
    }]
    meta_json = {"Name": "Griffith (Reborn)", "Author": "SirDuckman (rip)", "Description": DESCRIPTION,
                 "Version": VERSION, "Website": "", "ModTags": ["Berserk", "Griffith", "Port", "Armor", "Male"]}
    default_mod = {"Files": default_files, "FileSwaps": {}, "Manipulations": manips}
    write_pmp(PMP, meta_json, default_mod, groups, files)
    size = os.path.getsize(PMP)
    print(f"wrote {PMP} ({size / 1e6:.1f} MB): {len(default_files)} default files, {len(face_files)} face, "
          f"{len(hair_files)} hair, {len(manips)} manipulations")


if __name__ == "__main__":
    build()
