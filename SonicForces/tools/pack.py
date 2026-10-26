"""Package the built models, materials and textures as a Penumbra modpack (out/Sonic the Hedgehog (Sonic Forces).pmp).

Default files: the Werewolf set's (e6047) body, hands, legs and feet models for Hyur Midlander male (c0101),
Hyur Midlander female (c0201) and Lalafell (c1101), and every texture.
Manipulations:
  EQDP  every other race loads the Midlander model of its gender (Lalafell women load the Lalafell one), and the
        three fitted races load their own model and material for every slot
  EQP   head as the vanilla Moogle Head (hides hair, scalp and every race's ears); body shows the other four
        pieces but no necklace, bracelets or tail, and turns breast physics off; legs and hands plain
Option groups: the look (head model + materials) and an opt-in face hider.
"""
import os
import pickle
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meta  # noqa: E402
import xivdata as xd  # noqa: E402
from build import LOOKS, MOUTHS, RACES, SET, SLOTS  # noqa: E402
from xiv_files import write_pmp  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
NAME = "Sonic the Hedgehog (Sonic Forces)"
PMP = os.path.join(ROOT, "out", f"{NAME}.pmp")
VERSION = "1.1.1"
MOOGLE_HEAD = 236
OTHER = ["Highlander", "Elezen", "Miqote", "Roegadyn", "AuRa", "Hrothgar", "Viera"]
OWN = [("Male", "Midlander"), ("Female", "Midlander"), ("Male", "Lalafell")]
FALLBACK = [(g, r) for g in ("Male", "Female") for r in OTHER] + [("Female", "Lalafell")]
EQP = {"top": 0x0001 | 0x0100 | 0x0200 | 0x0400 | 0x4000,   # enabled, show legs / hands / head, no breast physics
       "dwn": (0x01 | 0x20 | 0x40) << 16,                   # enabled, show feet, hide tail
       "glv": 0x01 << 24,
       "sho": 0x01 << 32}
LOOK_NAMES = {("sonic", "r"): "Sonic", ("sonic", "l"): "Sonic, smirk on his left",
              ("super", "r"): "Super Sonic", ("super", "l"): "Super Sonic, smirk on his left"}

DESCRIPTION = """Sonic the Hedgehog from Sonic Forces, as a full-body costume on the Werewolf set.

WEAR: the Werewolf set (all classes, level 1): Werewolf Head, Body, Arms, Bottoms and Feet. Glamourer can put it
on without owning it; out/Sonic - Glamourer import code.txt has a ready design.
  Head    -> Sonic's head (hides your hair and ears)
  Body    -> torso, upper arms, back spikes
  Arms    -> forearms and gloves
  Bottoms -> hips, tail and legs
  Feet    -> socks and shoes

RACES: every race and gender.
  Lalafell are Sonic-sized: his own proportions, about 1 m tall.
  Everyone else is a tall Sonic (head, gloves and shoes kept cartoon-sized, limbs stretched to the body).

OPTIONS
  Look: Sonic or Super Sonic (Super Sonic glows faintly). Sonic's mouth sits on one side of his muzzle;
        pick the side.
  Hide your own face: only if your face shows through his head (it doesn't for Midlanders, Viera or Lalafell).
        Blanks every player face in this mod's collection, so use a collection that's only for your character.

Everyone in this mod's collection who wears the Werewolf set looks like Sonic.

Model: Sonic Forces (Sega / Sonic Team), ripped by Random Talking Bush (The Models Resource), importer by
chrrox, Link, Kentilan and ItsEasyActually. Fan port, personal use only."""


def build():
    models = pickle.load(open(os.path.join(B, "mdl", "index.pkl"), "rb"))
    textures = pickle.load(open(os.path.join(B, "tex", "index.pkl"), "rb"))
    mtrls = {n: os.path.join(B, "mtrl", f"{n}.mtrl") for n in ("sonic_body", "super_body", "sonic_eye", "super_eye")}
    files = {}

    def add(inner, local):
        files[inner] = local
        return inner.replace("/", "\\")

    def mtrl_path(race, slot, letter):
        return f"chara/equipment/e{SET:04d}/material/v0001/mt_{race}e{SET:04d}_{slot}_{letter}.mtrl"

    default_files = {}
    for _, (local, game) in textures.items():
        default_files[game] = add(game, local)
    for race in RACES:
        for slot in SLOTS[1:]:
            local, game = models[f"{race}_{slot}"]
            default_files[game] = add(f"models/{race}_{slot}.mdl", local)

    manips = []
    for gender, race in FALLBACK:
        for slot in SLOTS:
            manips.append(meta.eqdp_manip(SET, slot, gender, race, 0))
    for gender, race in OWN:
        for slot in SLOTS:
            manips.append(meta.eqdp_manip(SET, slot, gender, race, 0x3FF))
    manips.append(meta.eqp_manip(SET, "met", meta.eqp(MOOGLE_HEAD)))
    for slot, entry in EQP.items():
        manips.append(meta.eqp_manip(SET, slot, entry))

    def look_option(look, mouth):
        f = {}
        for race in RACES:
            local, game = models[f"{race}_met_{look}_{mouth}"]
            f[game] = add(f"models/{race}_met_{look}_{mouth}.mdl", local)
            for slot in SLOTS:
                f[mtrl_path(race, slot, "a")] = add(f"materials/{look}_body.mtrl", mtrls[f"{look}_body"])
            f[mtrl_path(race, "met", "b")] = add(f"materials/{look}_eye.mtrl", mtrls[f"{look}_eye"])
        return {"Name": LOOK_NAMES[(look, mouth)], "Description": "", "Priority": 0, "Image": "", "Files": f,
                "FileSwaps": {}, "Manipulations": []}

    hide = {}
    for name, (local, game) in models.items():
        if name.startswith("hide_"):
            hide[game] = add(f"hide/{name[5:]}.mdl", local)

    groups = [
        {"Name": "Look", "Description": "Sonic or Super Sonic, and which side of his muzzle the smirk is on.",
         "Type": "Single", "DefaultSettings": 0,
         "Options": [look_option(look, mouth) for look in LOOKS for mouth in MOUTHS]},
        {"Name": "Hide your own face", "Type": "Multi", "DefaultSettings": 0,
         "Description": "Only if your face shows through Sonic's head. Blanks every player face in this collection.",
         "Options": [{"Name": "Hide every player face", "Description": "", "Priority": 0, "Image": "", "Files": hide,
                      "FileSwaps": {}, "Manipulations": []}]},
    ]
    meta_json = {"Name": NAME, "Author": "Sonic Forces rip by Random Talking Bush; FFXIV port",
                 "Description": DESCRIPTION, "Version": VERSION, "Website": "",
                 "ModTags": ["Sonic", "Sonic Forces", "Port", "Full Body", "Werewolf"]}
    write_pmp(PMP, meta_json, {"Files": default_files, "FileSwaps": {}, "Manipulations": manips}, groups, files)
    print(f"wrote {PMP} ({os.path.getsize(PMP) / 1e6:.1f} MB): {len(default_files)} default files, "
          f"{sum(len(o['Files']) for g in groups for o in g['Options'])} option files, {len(manips)} manipulations")


if __name__ == "__main__":
    build()
