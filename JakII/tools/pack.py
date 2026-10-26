"""Package the built models, material and textures as a Penumbra modpack (out/Jak (Jak II).pmp).

Default files: the Scion Rogue's set (e6027) body, hands, legs and feet for Hyur Midlander male, the atlas
textures, plus EQDP entries so every other non-Lalafell male race wears the same c0101 models.
Option group "Jak's head" (both on): his face (face 1) and his hair with the goggles (hairstyle 1),
Hyur Midlander male.
"""
import os
import pickle
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meta  # noqa: E402
import xivdata as xd  # noqa: E402
from build import FACE, HAIR, MATERIAL, MODEL_PATH, RACE, SET  # noqa: E402
from xiv_files import write_pmp  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
NAME = "Jak (Jak II)"
PMP = os.path.join(ROOT, "out", f"{NAME}.pmp")
VERSION = "1.1.0"
OTHER_MALES = ["Highlander", "Elezen", "Miqote", "Roegadyn", "AuRa", "Hrothgar", "Viera"]
GROUP = "Jak's head"
FACE_OPTION = "Face (Midlander male, face 1)"
HAIR_OPTION = "Hair and goggles (Midlander male, hairstyle 1)"

DESCRIPTION = """Jak from Jak II (PS2), rigged to the FFXIV Hyur Midlander male skeleton.

GEAR (Scion Rogue's set, e6027; all classes, level 1):
  Jacket    -> blue shirt, scarf, chest straps, shoulder pauldron, Morph Gun holster on his back
  Armguards -> fingerless gloves with the big cuffs, his fists
  Gaskins   -> belt, pouch, white trousers, knee pads
  Boots     -> strapped boots
Leave the head slot empty to show his head. Other male races (except Lalafell) are redirected to the
Midlander models.

JAK'S HEAD (optional, on by default; Hyur Midlander male only):
  Face 1      -> Jak's face, eyes, goatee and long ears (static: no blinking or expressions)
  Hairstyle 1 -> his green-and-blond hair with the goggles (colour is baked in)
Use Glamourer to set Hyur Midlander / Male / Face 1 / Hairstyle 1 (the bundled design does it).
Face and hair replacements apply to everyone with that face/hairstyle in the collection, so use a
collection just for your character.

His limbs are stretched onto the FFXIV skeleton so animations bend at the right joints, his head and
boots are scaled down a little. Model: Naughty Dog (Jak II). Personal use only."""


def build():
    models = pickle.load(open(os.path.join(B, "mdl", "index.pkl"), "rb"))
    textures = pickle.load(open(os.path.join(B, "tex", "index.pkl"), "rb"))
    mtrl_local = os.path.join(B, "mtrl", "jak.mtrl")
    files = {}  # inside pack -> local file

    def add(inner, local):
        files[inner] = local
        return inner.replace("/", "\\")  # Penumbra's own mods store relative paths with backslashes

    def mtrl_game_path(model):
        n = MATERIAL[model].lstrip("/")
        if model == "fac":
            return f"chara/human/{RACE}/obj/face/{FACE}/material/{n}"
        if model == "hir":
            return f"chara/human/{RACE}/obj/hair/{HAIR}/material/v0001/{n}"
        return f"chara/equipment/e{SET:04d}/material/v0001/{n}"

    default_files, face_files, hair_files = {}, {}, {}
    mtrl_inner = add("materials/jak.mtrl", mtrl_local)
    for model, (local, game) in models.items():
        target = face_files if model == "fac" else hair_files if model == "hir" else default_files
        target[game] = add(f"models/{model}.mdl", local)
        target[mtrl_game_path(model)] = mtrl_inner
    for key, (local, game) in textures.items():
        default_files[game] = add(game, local)

    manips = []
    for race in OTHER_MALES:
        for slot in ("met", "top", "glv", "dwn", "sho"):
            manips.append(meta.eqdp_manip(SET, slot, "Male", race, 0))

    groups = [{
        "Name": GROUP,
        "Description": "Jak's face (Hyur Midlander male, face 1) and hair with goggles (hairstyle 1).",
        "Type": "Multi",
        "DefaultSettings": 3,
        "Options": [
            {"Name": FACE_OPTION, "Description": "Jak's face, eyes, brows, goatee and ears.",
             "Priority": 0, "Image": "", "Files": face_files, "FileSwaps": {}, "Manipulations": []},
            {"Name": HAIR_OPTION, "Description": "His green-and-blond hair and the goggles on his forehead.",
             "Priority": 0, "Image": "", "Files": hair_files, "FileSwaps": {}, "Manipulations": []},
        ],
    }]
    meta_json = {"Name": NAME, "Author": "Naughty Dog (model); FFXIV port", "Description": DESCRIPTION,
                 "Version": VERSION, "Website": "", "ModTags": ["Jak and Daxter", "Jak II", "Jak", "Port", "Outfit", "Male"]}
    default_mod = {"Files": default_files, "FileSwaps": {}, "Manipulations": manips}
    write_pmp(PMP, meta_json, default_mod, groups, files)
    print(f"wrote {PMP} ({os.path.getsize(PMP) / 1e6:.1f} MB): {len(default_files)} default files, "
          f"{len(face_files)} face, {len(hair_files)} hair, {len(manips)} manipulations")


if __name__ == "__main__":
    build()
