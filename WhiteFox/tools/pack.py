"""Package the built models, materials and textures as a Penumbra modpack (out/White Fox - Pink Paws (Marvel Rivals).pmp).

Default files: the Island Resort set's (e6173) five models for Hyur Midlander female (c0201), Hyur Midlander male
(c0101), Roegadyn male (c0901) and Lalafell (c1101), their materials and every texture.
Manipulations:
  EQDP  every other race loads the model the game falls back to (the Midlander of its gender; Hrothgar men the
        Roegadyn man's, Lalafell women the Lalafell one) and the racial deformer reshapes it; the four fitted races
        load their own model and material for every slot. Roegadyn men get their own fit because the deformer from
        the Midlander man does not reproduce their arms
  EQP   head as the vanilla Moogle Head (hides hair, scalp and every race's ears); body shows the other four
        pieces but no necklace, bracelets or tail (she brings three of her own), and turns breast physics off;
        legs show the feet, no tail; hands and feet plain (no rings or bracelets)
Option group: an opt-in face hider.
"""
import os
import pickle
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meta  # noqa: E402
import xivdata as xd  # noqa: E402
from build import LETTERS, RACES, SET, SLOTS  # noqa: E402
from xiv_files import write_pmp  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
NAME = "White Fox - Pink Paws (Marvel Rivals)"
PMP = os.path.join(ROOT, "out", f"{NAME}.pmp")
VERSION = "1.2.1"
MOOGLE_HEAD = 236
OTHER = ["Highlander", "Elezen", "Miqote", "Roegadyn", "AuRa", "Hrothgar", "Viera"]
OWN = [("Female", "Midlander"), ("Male", "Midlander"), ("Male", "Roegadyn"), ("Male", "Lalafell")]
FALLBACK = [(g, r) for g in ("Male", "Female") for r in OTHER if (g, r) not in OWN] + [("Female", "Lalafell")]
EQP = {"top": 0x0001 | 0x0100 | 0x0200 | 0x0400 | 0x4000,   # enabled, show legs / hands / head, no breast physics
       "dwn": (0x01 | 0x20) << 16,                          # enabled, show feet
       "glv": 0x01 << 24,
       "sho": 0x01 << 32}

DESCRIPTION = """White Fox from Marvel Rivals in her Pink Paws costume, as a full-body costume on the Island Resort set.

WEAR: the Island Resort set (all classes, level 1): Straw Hat, Shirt, Round Wristwatch, Slacks and Loop Sandals.
Glamourer can put it on without owning it; out/White Fox - Glamourer import code.txt has a ready design.
  Island Resort Straw Hat         -> her head, long hair, fox ears, the big bow, the flowered straw hat and
                                     pink sunglasses (hides your hair and ears)
  Island Resort Shirt             -> swimsuit, the sheer pink jacket, necklaces
  Island Resort Round Wristwatch  -> forearms and hands with the jacket's cuffs, bracelets and wrist flowers
  Island Resort Slacks            -> hips and thighs, the flowered thigh garter with its pouch, leg ribbons and
                                     her three fox tails
  Island Resort Loop Sandals      -> shins, ankle ribbons and bows, heeled sandals

RACES: every race and gender. Built on the Midlander woman, the Midlander man, the Roegadyn man and the Lalafell;
the other races are reshaped from those by the game (Hrothgar men from the Roegadyn fit). Men get White Fox on a
broader frame; Lalafell get a little White Fox with a big head. Your own tail is hidden while the set is on.
SKIN: her face and body use the game's skin shader, so they take your character's skin colour.

OPTION
  Hide your own face: only if your face shows through her head (for most races it barely does; Au Ra horns
        may poke out at the sides). Blanks every player face in this mod's collection, so use a collection that's
        only for your character.

Her face is static: no blinking, expressions or lip movement. Her hair, tails, bow and ribbons have no physics;
the tails ride the hips in the pose they have in her idle animation.

Everyone in this mod's collection who wears the Island Resort set looks like White Fox.

White Fox and Marvel Rivals belong to Marvel and NetEase (model). Fan port, personal use only."""


def build():
    models = pickle.load(open(os.path.join(B, "mdl", "index.pkl"), "rb"))
    textures = pickle.load(open(os.path.join(B, "tex", "index.pkl"), "rb"))
    mtrls = {t: os.path.join(B, "mtrl", f"{t}.mtrl") for ts in LETTERS.values() for t in ts}
    files = {}

    def add(inner, local):
        files[inner] = local
        return inner.replace("/", "\\")

    default_files = {}
    for _, (local, game) in textures.items():
        default_files[game] = add(game, local)
    for race in RACES:
        for slot in SLOTS:
            local, game = models[f"{race}_{slot}"]
            default_files[game] = add(f"models/{race}_{slot}.mdl", local)
            for i, texset in enumerate(LETTERS[slot]):
                g = f"chara/equipment/e{SET:04d}/material/v0001/mt_{race}e{SET:04d}_{slot}_{'abcdefgh'[i]}.mtrl"
                default_files[g] = add(f"materials/{texset}.mtrl", mtrls[texset])

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

    def option(name, desc, f):
        return {"Name": name, "Description": desc, "Priority": 0, "Image": "", "Files": f, "FileSwaps": {},
                "Manipulations": []}

    hide = {}
    for name, (local, game) in models.items():
        if name.startswith("hide_"):
            hide[game] = add(f"hide/{name[5:]}.mdl", local)

    groups = [
        {"Name": "Hide your own face", "Type": "Multi", "DefaultSettings": 0,
         "Description": "Only if your face shows through White Fox's head. Blanks every player face in this collection.",
         "Options": [option("Hide every player face", "", hide)]},
    ]
    meta_json = {"Name": NAME, "Author": "Model by NetEase (Marvel Rivals); FFXIV port",
                 "Description": DESCRIPTION, "Version": VERSION, "Website": "",
                 "ModTags": ["White Fox", "Marvel Rivals", "Port", "Full Body", "Island Resort"]}
    write_pmp(PMP, meta_json, {"Files": default_files, "FileSwaps": {}, "Manipulations": manips}, groups, files)
    print(f"wrote {PMP} ({os.path.getsize(PMP) / 1e6:.1f} MB): {len(default_files)} default files, "
          f"{sum(len(o['Files']) for g in groups for o in g['Options'])} option files, {len(manips)} manipulations")


if __name__ == "__main__":
    build()
