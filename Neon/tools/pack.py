"""Package the built models, materials and textures as a Penumbra modpack (out/Neon (Valorant).pmp).

Default files: the Critical Hit B Tour set's (e6222) five models for Hyur Midlander male (c0101), Hyur Midlander
female (c0201), Roegadyn male (c0901) and Lalafell (c1101), their materials and every texture. The materials go in
both material folders: B-1 Tour reads v0001, B-2 Tour v0002 (IMC), so both variants become Neon.
Manipulations:
  EQDP  every other race loads the model the game falls back to (Midlander of its gender; Hrothgar men the Roegadyn
        man's, Lalafell women the Lalafell one) and the racial deformer reshapes it; the four fitted races load
        their own model and material for every slot. Roegadyn men get their own fit because the deformer from the
        Midlander man scales arms and hands 2.7x (vanilla gear always ships Roegadyn models)
  EQP   head as the vanilla Moogle Head (hides hair, scalp and every race's ears); body shows the other four
        pieces but no necklace, bracelets or tail, and turns breast physics off; legs show the feet, no tail;
        hands and feet plain (no rings or bracelets)
Option group: an opt-in face hider.
"""
import os
import pickle
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meta  # noqa: E402
import xivdata as xd  # noqa: E402
from build import RACES, SET, SLOTS, letters  # noqa: E402
from xiv_files import write_pmp  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
NAME = "Neon (Valorant)"
PMP = os.path.join(ROOT, "out", f"{NAME}.pmp")
VERSION = "1.2.0"
MOOGLE_HEAD = 236
VARIANTS = (1, 2)               # material folders: B-1 Tour (v0001) and B-2 Tour (v0002)
OTHER = ["Highlander", "Elezen", "Miqote", "Roegadyn", "AuRa", "Hrothgar", "Viera"]
OWN = [("Male", "Midlander"), ("Female", "Midlander"), ("Male", "Roegadyn"), ("Male", "Lalafell")]
FALLBACK = [(g, r) for g in ("Male", "Female") for r in OTHER if (g, r) not in OWN] + [("Female", "Lalafell")]
EQP = {"top": 0x0001 | 0x0100 | 0x0200 | 0x0400 | 0x4000,   # enabled, show legs / hands / head, no breast physics
       "dwn": (0x01 | 0x20) << 16,                          # enabled, show feet
       "glv": 0x01 << 24,
       "sho": 0x01 << 32}

DESCRIPTION = """Neon from Valorant, as a full-body costume on the Critical Hit B Tour set.

WEAR: the Critical Hit B-1 Tour set (all classes, level 1): Headset, Top, Halfgloves, Breeches and Longboots.
Glamourer can put it on without owning it; out/Neon - Glamourer import code.txt has a ready design.
  Critical Hit B-1 Tour Headset    -> Neon's head, face and blue hair buns (hides your hair and ears)
  Critical Hit B-1 Tour Top        -> collar, crop top, gold chest plates, backpack, bare upper arms
  Critical Hit B-1 Tour Halfgloves -> forearm sleeves, wristbands and fingerless gloves
  Critical Hit B-1 Tour Breeches   -> belt, waist sash, hip pouch and thighs
  Critical Hit B-1 Tour Longboots  -> lower legs and her sneakers
(The Critical Hit B-2 Tour set shares these models and changes too.)

RACES: every race and gender. Built on the Midlander woman, the Midlander man, the Roegadyn man and the Lalafell;
the other races are reshaped from those by the game (Hrothgar men from the Roegadyn fit). Lalafell get a little
Neon with a big head.

OPTION
  Hide your own face: only if your face shows through hers (Au Ra horns and jaw scales can, and so can face mods
        with their own ears, such as Abigail's elf ears, which the headset can't hide). Blanks every player face in
        this mod's collection, so use a collection that's only for your character, and give this mod a higher
        priority than your face mod.

The face is static: no blinking or lip movement. The hair has no physics.

Everyone in this mod's collection who wears the Critical Hit B Tour set looks like Neon.

Neon and Valorant belong to Riot Games (model from the Kingdom Archives viewer). Fan port, personal use only."""


def build():
    models = pickle.load(open(os.path.join(B, "mdl", "index.pkl"), "rb"))
    textures = pickle.load(open(os.path.join(B, "tex", "index.pkl"), "rb"))
    L = letters()
    mtrls = {t: os.path.join(B, "mtrl", f"{t}.mtrl") for ts in L.values() for t in ts}
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
            for i, texset in enumerate(L[slot]):
                for v in VARIANTS:
                    g = f"chara/equipment/e{SET:04d}/material/v{v:04d}/mt_{race}e{SET:04d}_{slot}_{'abcdefgh'[i]}.mtrl"
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
         "Description": "Only if your face shows through Neon's. Blanks every player face in this collection.",
         "Options": [option("Hide every player face", "", hide)]},
    ]
    meta_json = {"Name": NAME, "Author": "Model by Riot Games (Valorant, via Kingdom Archives); FFXIV port",
                 "Description": DESCRIPTION, "Version": VERSION, "Website": "",
                 "ModTags": ["Neon", "Valorant", "Port", "Full Body", "Critical Hit B Tour"]}
    write_pmp(PMP, meta_json, {"Files": default_files, "FileSwaps": {}, "Manipulations": manips}, groups, files)
    print(f"wrote {PMP} ({os.path.getsize(PMP) / 1e6:.1f} MB): {len(default_files)} default files, "
          f"{sum(len(o['Files']) for g in groups for o in g['Options'])} option files, {len(manips)} manipulations")


if __name__ == "__main__":
    build()
