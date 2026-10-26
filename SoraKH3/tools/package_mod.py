"""Assemble the Penumbra mod folder and zip it into out/Sora_KH3.pmp (2.0.0: every race and gender).

usage: package_mod.py <work_dir> <mod_dir> <out_dir>

Default files: the Air Cell set's (e0907) five models for the Midlander man (c0101), Midlander woman (c0201),
Roegadyn man (c0901) and Lalafell (c1101), their materials and every texture.
Manipulations (as the White Fox port):
  EQDP  the four fitted races load their own model and material for every slot; every other race loads the model the
        game falls back to (the Midlander of its gender; Hrothgar men the Roegadyn man's, Lalafell women the
        Lalafell's) and the racial deformer reshapes it
  EQP   hood as the vanilla Moogle Head (hides hair, scalp and every race's ears); jacket shows legs, hands and head,
        no tail or breast physics; halfslops show the feet
Option group: an opt-in face hider (White Fox's empty face stand-ins).
"""
import json
import os
import shutil
import struct
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sqpack import Repo  # noqa: E402

work, mod, out = sys.argv[1:4]
SET_ID = 907
SET = f"e{SET_ID:04d}"
NAME = "Sora (Kingdom Hearts III)"
VERSION = "2.0.0"
GAME = json.load(open(os.path.join(os.environ["APPDATA"], "XIVLauncher", "launcherConfigV3.json")))["GamePath"]
MOOGLE_HEAD = 236
SLOT_NAME = {"met": "Head", "top": "Body", "glv": "Hands", "dwn": "Legs", "sho": "Feet"}
EQP_MASK = {"top": 0x0000_0000_0000_FFFF, "dwn": 0x0000_0000_00FF_0000, "glv": 0x0000_0000_FF00_0000,
            "sho": 0x0000_00FF_0000_0000, "met": 0xFFFF_FF00_0000_0000}
EQDP_SHIFT = {"met": 0, "top": 2, "glv": 4, "dwn": 6, "sho": 8}
OTHER = ["Highlander", "Elezen", "Miqote", "Roegadyn", "AuRa", "Hrothgar", "Viera"]
OWN = [("Male", "Midlander"), ("Female", "Midlander"), ("Male", "Roegadyn"), ("Male", "Lalafell")]
FALLBACK = [(g, r) for g in ("Male", "Female") for r in OTHER if (g, r) not in OWN] + [("Female", "Lalafell")]
EQP = {"top": 0x0001 | 0x0100 | 0x0200 | 0x0400 | 0x4000,   # enabled, show legs / hands / head, no breast physics
       "dwn": (0x01 | 0x20) << 16,                          # enabled, show feet
       "glv": 0x01 << 24,
       "sho": 0x01 << 32}
HIDE_GROUP = "Hide your own face"

DESCRIPTION = """Sora from Kingdom Hearts III, as a full-body costume on the Air Cell set.

WEAR: the Air Cell set (all classes, level 1): Hood, Jacket, Armlets, Halfslops and Shoes. Glamourer can put it on
without owning it; out/Sora - Glamourer import code.txt has a ready design.
  Air Cell Hood      -> his head: face, blue eyes and spiky hair (hides your hair and ears)
  Air Cell Jacket    -> jacket, shirt, hood, crown necklace, arms
  Air Cell Armlets   -> his hands and fingerless gloves
  Air Cell Halfslops -> belt, pockets, baggy shorts
  Air Cell Shoes     -> his big shoes

RACES: every race and gender. Built on the Midlander man, the Midlander woman, the Roegadyn man and the Lalafell;
the other races are reshaped from those by the game (Hrothgar men from the Roegadyn fit). Lalafell get a little Sora
with a big head. Your own tail is hidden while the set is on. His skin keeps its own colour on every race.

OPTION
  Hide your own face: only if your face shows through his head (for most races it barely does; Au Ra horns
        may poke out at the sides). Blanks every player face in this mod's collection, so use a collection that's
        only for your character.

His face is static: no blinking, expressions or lip movement. His hair has no physics.

Everyone in this mod's collection who wears the Air Cell set looks like Sora.

Kingdom Hearts and Sora belong to Square Enix / Disney (model). Fan port, personal use only."""

repo = Repo(os.path.join(GAME, "game"))


def eqp(set_id):
    """The vanilla EQP entry of a set (all five slots' bits)."""
    data = repo.read("chara/xls/equipmentparameter/equipmentparameter.eqp")
    block = set_id // 160
    control = struct.unpack_from("<Q", data, 0)[0]
    if not control >> block & 1:
        return 0
    count = bin(control & ((1 << block) - 1)).count("1")
    return struct.unpack_from("<Q", data, (160 * count + set_id % 160) * 8)[0]


def eqp_manip(slot, entry):
    return {"Type": "Eqp", "Manipulation": {"SetId": SET_ID, "Slot": SLOT_NAME[slot], "Entry": entry & EQP_MASK[slot]}}


def eqdp_manip(slot, gender, race, entry):
    return {"Type": "Eqdp", "Manipulation": {"Gender": gender, "Race": race, "SetId": SET_ID, "Slot": SLOT_NAME[slot],
                                             "Entry": entry & (3 << EQDP_SHIFT[slot])}}


with open(os.path.join(mod, "files_textures.json")) as f:
    generated = json.load(f)  # textures and materials already written into the mod folder
index = json.load(open(os.path.join(work, "mdl", "index.json")))
hide = {}
for name, (local, gp) in index.items():
    inner = f"hide/{os.path.basename(local)}" if name.startswith("hide_") else gp
    dst = os.path.join(mod, *inner.split("/"))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(local, dst)
    if name.startswith("hide_"):
        hide[gp] = inner.replace("/", "\\")
    else:
        generated[gp] = inner.replace("/", "\\")

manips = [eqdp_manip(slot, g, r, 0) for g, r in FALLBACK for slot in SLOT_NAME]
manips += [eqdp_manip(slot, g, r, 0x3FF) for g, r in OWN for slot in SLOT_NAME]
manips.append(eqp_manip("met", eqp(MOOGLE_HEAD)))
manips += [eqp_manip(slot, entry) for slot, entry in EQP.items()]

meta = {"FileVersion": 3, "Name": NAME, "Author": "Square Enix (model); FFXIV port", "Description": DESCRIPTION,
        "Image": "", "Version": VERSION, "Website": "",
        "ModTags": ["Kingdom Hearts", "Sora", "Port", "Full Body", "Air Cell"]}
default = {"Name": "", "Priority": 0, "Files": dict(sorted(generated.items())), "FileSwaps": {}, "Manipulations": manips}
group = {
    "Version": 0, "Name": HIDE_GROUP, "Image": "", "Page": 0, "Priority": 0, "Type": "Multi", "DefaultSettings": 0,
    "Description": "Only if your face shows through Sora's head. Blanks every player face in this collection.",
    "Options": [{"Name": "Hide every player face", "Description": "", "Priority": 0, "Image": "",
                 "Files": dict(sorted(hide.items())), "FileSwaps": {}, "Manipulations": []}],
}
for old in [n for n in os.listdir(mod) if n.startswith("group_")]:
    os.remove(os.path.join(mod, old))
GROUP_FILE = "group_001_hide_your_own_face.json"
for name, obj in (("meta.json", meta), ("default_mod.json", default), (GROUP_FILE, group)):
    with open(os.path.join(mod, name), "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)

os.makedirs(out, exist_ok=True)
pmp = os.path.join(out, "Sora_KH3.pmp")
shipped = set(generated.values()) | set(hide.values())
with zipfile.ZipFile(pmp, "w", zipfile.ZIP_DEFLATED) as z:
    for name in ("meta.json", "default_mod.json", GROUP_FILE):
        z.write(os.path.join(mod, name), name)
    for rel in sorted(shipped):
        z.write(os.path.join(mod, *rel.split("\\")), rel.replace("\\", "/"))
print(f"{len(generated)} default paths, {len(hide)} face stand-ins, {len(manips)} manipulations "
      f"(head EQP {eqp(MOOGLE_HEAD) & EQP_MASK['met']:#x})")
print("wrote", pmp, os.path.getsize(pmp) // 1024, "KB")
