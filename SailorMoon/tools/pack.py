"""Package the built models, materials and textures as a Penumbra modpack (out/Sailor Moon (figure).pmp).

Default files: the costume's four models (Neo Queen's Tiara e6257 head; Educand's Sailor Top, Sailor Skirt and
Loafers e6162) for Hyur Midlander female (c0201), Hyur Midlander male (c0101), Roegadyn male (c0901) and
Lalafell (c1101), their materials and every texture.
Manipulations:
  EQDP  every other race loads the model the game falls back to (the Midlander of its gender; Hrothgar men the
        Roegadyn man's, Lalafell women the Lalafell's; the game's racial deformer reshapes it), and the four fitted
        races load their own model and material for every slot. Roegadyn men get their own fit because the deformer
        from the Midlander man scales arms and hands 2.7x (vanilla gear always ships Roegadyn models)
  EQP   head as the vanilla Moogle Head (hides hair, scalp and every race's ears); body shows the legs and head
        pieces but not the hands piece (her gloves are part of the top), no necklace, bracelets or tail, and
        turns breast physics off; legs show the feet, no tail; feet plain
Option group: an opt-in face hider.
"""
import os
import pickle
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meta  # noqa: E402
import xivdata as xd  # noqa: E402
from build import LETTERS, RACES, SETS, SLOTS, mtrl_game_path  # noqa: E402
from xiv_files import write_pmp  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
NAME = "Sailor Moon (figure)"
PMP = os.path.join(ROOT, "out", f"{NAME}.pmp")
VERSION = "1.2.0"
MOOGLE_HEAD = 236
OTHER = ["Highlander", "Elezen", "Miqote", "Roegadyn", "AuRa", "Hrothgar", "Viera"]
OWN = [("Female", "Midlander"), ("Male", "Midlander"), ("Male", "Roegadyn"), ("Male", "Lalafell")]
FALLBACK = [(g, r) for g in ("Male", "Female") for r in OTHER if (g, r) not in OWN] + [("Female", "Lalafell")]
EQP = {"top": 0x0001 | 0x0100 | 0x0400 | 0x4000,     # enabled, show legs / head (not hands), no breast physics
       "dwn": (0x01 | 0x20) << 16,                   # enabled, show feet
       "sho": 0x01 << 32}

DESCRIPTION = """Sailor Moon, from a 3D-print figure sculpt, as a full-body costume.

WEAR (all classes, level 1, any race): Neo Queen's Tiara, Educand's Sailor Top, Educand's Sailor Skirt and
Educand's Loafers. Glamourer can put them on without owning them; out/Sailor Moon - Glamourer import code.txt
has a ready design.
  Neo Queen's Tiara      -> her head, odango buns and pigtails (hides your hair and ears)
  Educand's Sailor Top   -> leotard top, sailor collar, bows, choker, puff sleeves, gloves (hides your hands
                            piece: her arms and gloves are part of the top)
  Educand's Sailor Skirt -> skirt (skirt physics), the back bow's tails, legs
  Educand's Loafers      -> her red boots

RACES: every race and gender. Built on the Midlander woman, the Midlander man, the Roegadyn man and the Lalafell;
the other races are reshaped from those by the game (Hrothgar men from the Roegadyn fit).

OPTION
  Hide your own face: only if your face shows through her head. Blanks every player face in this mod's
        collection, so use a collection that's only for your character.

The sculpt is a single solid print, painted region by region for this port. Her face is static (no blinking or
expressions), and her hair has no physics: the pigtails follow your upper body.

Everyone in this mod's collection who wears these items looks like Sailor Moon.

Sailor Moon belongs to Naoko Takeuchi / Kodansha / Toei Animation. Figure sculpt: author unknown. Fan port,
personal use only."""


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
            for texset in LETTERS[slot]:
                default_files[mtrl_game_path(race, slot, texset)] = add(f"materials/{texset}.mtrl", mtrls[texset])

    manips = []
    for slot in SLOTS:
        for gender, race in FALLBACK:
            manips.append(meta.eqdp_manip(SETS[slot], slot, gender, race, 0))
        for gender, race in OWN:
            manips.append(meta.eqdp_manip(SETS[slot], slot, gender, race, 0x3FF))
    manips.append(meta.eqp_manip(SETS["met"], "met", meta.eqp(MOOGLE_HEAD)))
    for slot, entry in EQP.items():
        manips.append(meta.eqp_manip(SETS[slot], slot, entry))

    def option(name, desc, f):
        return {"Name": name, "Description": desc, "Priority": 0, "Image": "", "Files": f, "FileSwaps": {},
                "Manipulations": []}

    hide = {}
    for name, (local, game) in models.items():
        if name.startswith("hide_"):
            hide[game] = add(f"hide/{name[5:]}.mdl", local)

    groups = [
        {"Name": "Hide your own face", "Type": "Multi", "DefaultSettings": 0,
         "Description": "Only if your face shows through her head. Blanks every player face in this collection.",
         "Options": [option("Hide every player face", "", hide)]},
    ]
    meta_json = {"Name": NAME, "Author": "Figure sculpt (STL) by its original author; FFXIV port",
                 "Description": DESCRIPTION, "Version": VERSION, "Website": "",
                 "ModTags": ["Sailor Moon", "Usagi", "Port", "Full Body", "Educand", "Neo Queen"]}
    write_pmp(PMP, meta_json, {"Files": default_files, "FileSwaps": {}, "Manipulations": manips}, groups, files)
    print(f"wrote {PMP} ({os.path.getsize(PMP) / 1e6:.1f} MB): {len(default_files)} default files, "
          f"{sum(len(o['Files']) for g in groups for o in g['Options'])} option files, {len(manips)} manipulations")


if __name__ == "__main__":
    build()
