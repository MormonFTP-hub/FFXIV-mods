"""Package the built models, materials and textures as a Penumbra modpack (out/Jubilee - Vampy Jammies (Marvel Rivals).pmp).

Default files: the Pajama set's (e6169) four models for Hyur Midlander female (c0201), Hyur Midlander male (c0101)
and Lalafell (c1101), their materials (in all three variants' material folders, so the Plain, Cactuar and Chocobo
pajamas all show her) and every texture.
Manipulations:
  EQDP  every other race loads the Midlander model of its gender (Lalafell women load the Lalafell one; the game's
        racial deformer reshapes it), and the three fitted races load their own model and material for every slot
  EQP   head as the vanilla Moogle Head (hides hair, scalp and every race's ears); body shows the legs and head
        pieces but not the hands slot (her hands are part of the shirt), no necklace, bracelets or tail, and breast
        physics off; legs show the feet; feet plain
Option groups: sprinkles on/off, and an opt-in face hider.
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
NAME = "Jubilee - Vampy Jammies (Marvel Rivals)"
PMP = os.path.join(ROOT, "out", f"{NAME}.pmp")
VERSION = "1.1.0"
MOOGLE_HEAD = 236
VARIANTS = (1, 2, 3)          # Plain, Cactuar and Chocobo Pajama: material folders v0001..v0003
OTHER = ["Highlander", "Elezen", "Miqote", "Roegadyn", "AuRa", "Hrothgar", "Viera"]
OWN = [("Female", "Midlander"), ("Male", "Midlander"), ("Male", "Lalafell")]
FALLBACK = [(g, r) for g in ("Male", "Female") for r in OTHER] + [("Female", "Lalafell")]
EQP = {"top": 0x0001 | 0x0100 | 0x0400 | 0x4000,            # enabled, show legs / head (not hands), no breast physics
       "dwn": (0x01 | 0x20) << 16,                          # enabled, show feet
       "sho": 0x01 << 32}

DESCRIPTION = """Jubilee from Marvel Rivals in her Vampy Jammies skin, as a full-body costume on the Pajama set.

WEAR: the Pajama set (all classes, level 1): Eye Mask, Shirt, Bottoms and Slippers. Plain, Cactuar or Chocobo
pajamas all work. Glamourer can put them on without owning them; out/Jubilee - Glamourer import code.txt has a
ready design.
  Pajama Eye Mask  -> Jubilee's head, amber eyes, black bob and the sleep-mask hat (hides your hair and ears)
  Pajama Shirt     -> fluffy jacket, crop top, arms and her hands (your gloves slot is hidden)
  Pajama Bottoms   -> pink shorts
  Pajama Slippers  -> knee-high leg warmers and bunny slippers

RACES: every race and gender. Built on the Midlander woman, the Midlander man and the Lalafell; the other races
are reshaped from those by the game. Men get Jubilee on a broader frame; Lalafell get a little Jubilee with a big
head.

OPTIONS
  Sprinkles: the little candy sprinkles floating round her outfit, on (default) or off.
  Hide your own face: only if your face shows through her head. Blanks every player face in this mod's
        collection, so use a collection that's only for your character.

Her face is static: no blinking, expressions or lip movement. Her hair and jacket have no physics.

Everyone in this mod's collection who wears the Pajama set looks like Jubilee.

Jubilee and Marvel Rivals belong to Marvel and NetEase (model from the game, via psylocke.gg). Fan port, personal
use only."""


def build():
    models = pickle.load(open(os.path.join(B, "mdl", "index.pkl"), "rb"))
    textures = pickle.load(open(os.path.join(B, "tex", "index.pkl"), "rb"))
    mtrls = {m: os.path.join(B, "mtrl", f"{m}.mtrl") for ms in LETTERS.values() for m in ms}
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
            for i, mat in enumerate(LETTERS[slot]):
                for v in VARIANTS:
                    g = f"chara/equipment/e{SET:04d}/material/v{v:04d}/mt_{race}e{SET:04d}_{slot}_{'abcdefgh'[i]}.mtrl"
                    default_files[g] = add(f"materials/{mat}.mtrl", mtrls[mat])

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

    plain = {}
    for name, (local, game) in models.items():
        if name.endswith("_nosprinkles"):
            plain[game] = add(f"models/{name}.mdl", local)
    hide = {}
    for name, (local, game) in models.items():
        if name.startswith("hide_"):
            hide[game] = add(f"hide/{name[5:]}.mdl", local)

    groups = [
        {"Name": "Sprinkles", "Description": "The little candy sprinkles floating round her outfit.", "Type": "Single",
         "DefaultSettings": 0, "Priority": 1,
         "Options": [option("With sprinkles", "", {}), option("No sprinkles", "", plain)]},
        {"Name": "Hide your own face", "Type": "Multi", "DefaultSettings": 0,
         "Description": "Only if your face shows through Jubilee's head. Blanks every player face in this collection.",
         "Options": [option("Hide every player face", "", hide)]},
    ]
    meta_json = {"Name": NAME, "Author": "Model by NetEase (Marvel Rivals), via psylocke.gg; FFXIV port",
                 "Description": DESCRIPTION, "Version": VERSION, "Website": "",
                 "ModTags": ["Jubilee", "Marvel Rivals", "Port", "Full Body", "Pajama"]}
    write_pmp(PMP, meta_json, {"Files": default_files, "FileSwaps": {}, "Manipulations": manips}, groups, files)
    print(f"wrote {PMP} ({os.path.getsize(PMP) / 1e6:.1f} MB): {len(default_files)} default files, "
          f"{sum(len(o['Files']) for g in groups for o in g['Options'])} option files, {len(manips)} manipulations")


if __name__ == "__main__":
    build()
