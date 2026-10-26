"""Package the built models, materials and textures as a Penumbra modpack (out/Lady Loki - Seaside Siren (Marvel Rivals).pmp).

Default files: the Summer's Flame set's (e0666) five models for Hyur Midlander female (c0201), Hyur Midlander male
(c0101), Roegadyn male (c0901) and Lalafell (c1101), their materials and every texture.
Manipulations:
  EQDP  every other race loads the model the game falls back to (the Midlander of its gender; Hrothgar men the
        Roegadyn man's, Lalafell women the Lalafell one) and the racial deformer reshapes it; the four fitted races
        load their own model and material for every slot. Roegadyn men get their own fit because the deformer from
        the Midlander man does not reproduce their arms
  EQP   head as the vanilla Moogle Head (hides hair, scalp and every race's ears); body shows the other four
        pieces but no necklace, bracelets or tail, and turns breast physics off; legs show the feet, no tail;
        hands and feet plain (no rings or bracelets)
Option groups:
  Headpiece / Jewellery  Single groups that set the IMC attribute mask of variant 1: the hat's (atr_mv_*) for the
                         headpiece, the top's, gloves', legs' and feet's (atr_tv/gv/dv/sv_*) for the jewellery set
                         (build.py tags each variant's submeshes). Defaults are the original's: crown, first set.
  Hide your own face     an opt-in face hider.
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
NAME = "Lady Loki - Seaside Siren (Marvel Rivals)"
PMP = os.path.join(ROOT, "out", f"{NAME}.pmp")
VERSION = "1.2.0"
MOOGLE_HEAD = 236
# (option, description, variant letter or None): the viewer's Customize menu, defaults first
HEADPIECES = [("Horned crown", "Her gold crown with the long horns, as in the original.", "a"),
              ("Horned sunglasses", "Gold sunglasses with smaller horns and pink lenses.", "b"),
              ("Crocodile hair clip", "A little green crocodile clip in her hair.", "c"),
              ("None", "Just her hair.", None)]
JEWELLERY = [("Gold", "Gold drop earrings, armbands and anklets, as in the original.", "a"),
             ("Shells", "Curled gold earrings, a shell necklace, bangles and anklets with shells.", "b"),
             ("Starfish", "Green hoop earrings, green bracelets and anklets with starfish.", "c"),
             ("None", "No earrings, bracelets or anklets.", None)]
OTHER = ["Highlander", "Elezen", "Miqote", "Roegadyn", "AuRa", "Hrothgar", "Viera"]
OWN = [("Female", "Midlander"), ("Male", "Midlander"), ("Male", "Roegadyn"), ("Male", "Lalafell")]
FALLBACK = [(g, r) for g in ("Male", "Female") for r in OTHER if (g, r) not in OWN] + [("Female", "Lalafell")]
EQP = {"top": 0x0001 | 0x0100 | 0x0200 | 0x0400 | 0x4000,   # enabled, show legs / hands / head, no breast physics
       "dwn": (0x01 | 0x20) << 16,                          # enabled, show feet
       "glv": 0x01 << 24,
       "sho": 0x01 << 32}

DESCRIPTION = """Lady Loki from Marvel Rivals in her Seaside Siren swimsuit, as a full-body costume on the Summer's Flame set.

WEAR: the Summer's Flame set (all classes, level 1): Hat, Top, Wrist Torque, Pareo and Sandals.
Glamourer can put it on without owning it; out/Lady Loki - Glamourer import code.txt has a ready design.
  Summer's Flame Hat           -> her head, long black hair and the headpiece you pick (hides your hair and ears)
  Summer's Flame Top           -> swimsuit, the sheer arm wraps, the gold back ornament, earrings and necklace
  Summer's Flame Wrist Torque  -> forearms and hands with the arm wraps' cuffs and the bracelets
  Summer's Flame Pareo         -> hips and thighs, the sea-green skirt (sways on the game's skirt bones), the gold
                                  sash and the snake round her thigh
  Summer's Flame Sandals       -> bare feet with the anklets

RACES: every race and gender. Built on the Midlander woman, the Midlander man, the Roegadyn man and the Lalafell;
the other races are reshaped from those by the game (Hrothgar men from the Roegadyn fit). Men get Loki on a
broader frame; Lalafell get a little Loki with a big head. Your own tail is hidden while the set is on.

OPTIONS
  Headpiece: Horned crown (default, as in the original), Horned sunglasses, Crocodile hair clip, or None.
  Jewellery: Gold (default, as in the original), Shells, Starfish, or None.
  Hide your own face: only if your face shows through her head (for most races it barely does; Au Ra jaw
        scales may show under her chin). Blanks every player face in this mod's collection, so use a collection
        that's only for your character.

Her face is static: no blinking, expressions or lip movement. Her hair has no physics. The scepter isn't included.

Everyone in this mod's collection who wears the Summer's Flame set looks like Lady Loki.

Loki and Marvel Rivals belong to Marvel and NetEase (model). Fan port, personal use only."""


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

    def option(name, desc, f, m=()):
        return {"Name": name, "Description": desc, "Priority": 0, "Image": "", "Files": f, "FileSwaps": {},
                "Manipulations": list(m)}

    def masks(slots, letter):
        """IMC entries of variant 1 showing only one variant's atr_*v_<letter> submeshes (none for None)."""
        bit = 1 << "abcdefghij".index(letter) if letter else 0
        return [meta.imc_manip(SET, s, 1, dict(meta.imc(SET, s, 1), AttributeMask=bit)) for s in slots]

    hide = {}
    for name, (local, game) in models.items():
        if name.startswith("hide_"):
            hide[game] = add(f"hide/{name[5:]}.mdl", local)

    groups = [
        {"Name": "Headpiece", "Type": "Single", "DefaultSettings": 0,
         "Description": "Loki's headpieces from the game's Customize menu.",
         "Options": [option(n, d, {}, masks(["met"], v)) for n, d, v in HEADPIECES]},
        {"Name": "Jewellery", "Type": "Single", "DefaultSettings": 0,
         "Description": "Loki's jewellery sets from the game's Customize menu (earrings, necklace, bracelets, anklets).",
         "Options": [option(n, d, {}, masks(["top", "glv", "dwn", "sho"], v)) for n, d, v in JEWELLERY]},
        {"Name": "Hide your own face", "Type": "Multi", "DefaultSettings": 0,
         "Description": "Only if your face shows through Loki's head. Blanks every player face in this collection.",
         "Options": [option("Hide every player face", "", hide)]},
    ]
    meta_json = {"Name": NAME, "Author": "Model by NetEase (Marvel Rivals); FFXIV port",
                 "Description": DESCRIPTION, "Version": VERSION, "Website": "",
                 "ModTags": ["Loki", "Marvel Rivals", "Port", "Full Body", "Summer's Flame"]}
    write_pmp(PMP, meta_json, {"Files": default_files, "FileSwaps": {}, "Manipulations": manips}, groups, files)
    print(f"wrote {PMP} ({os.path.getsize(PMP) / 1e6:.1f} MB): {len(default_files)} default files, "
          f"{sum(len(o['Files']) for g in groups for o in g['Options'])} option files, {len(manips)} manipulations")


if __name__ == "__main__":
    build()
