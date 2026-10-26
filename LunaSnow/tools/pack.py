"""Package the built models, materials and textures as a Penumbra modpack (out/Luna Snow - Coalsack Nebula (Marvel Rivals).pmp).

Default files: the Cosmic Explorer's set's (e6252) five models for Hyur Midlander female (c0201), Hyur Midlander male
(c0101) and Lalafell (c1101), their materials and every texture.
Manipulations:
  EQDP  every other race loads the Midlander model of its gender (Lalafell women load the Lalafell one; the game's
        racial deformer reshapes it), and the three fitted races load their own model and material for every slot
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
from build import LETTERS, RACES, SET, SLOTS  # noqa: E402
from xiv_files import write_pmp  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
NAME = "Luna Snow - Coalsack Nebula (Marvel Rivals)"
PMP = os.path.join(ROOT, "out", f"{NAME}.pmp")
VERSION = "1.1.0"
MOOGLE_HEAD = 236
OTHER = ["Highlander", "Elezen", "Miqote", "Roegadyn", "AuRa", "Hrothgar", "Viera"]
OWN = [("Female", "Midlander"), ("Male", "Midlander"), ("Male", "Lalafell")]
FALLBACK = [(g, r) for g in ("Male", "Female") for r in OTHER] + [("Female", "Lalafell")]
EQP = {"top": 0x0001 | 0x0100 | 0x0200 | 0x0400 | 0x4000,   # enabled, show legs / hands / head, no breast physics
       "dwn": (0x01 | 0x20) << 16,                          # enabled, show feet
       "glv": 0x01 << 24,
       "sho": 0x01 << 32}

DESCRIPTION = """Luna Snow from Marvel Rivals in her Coalsack Nebula skin, as a full-body costume on the Cosmic Explorer's set.

WEAR: the Cosmic Explorer's set (all classes, level 1): Cap, Jacket, Halfgloves, Slops and Boots.
Glamourer can put it on without owning it; out/Luna Snow - Glamourer import code.txt has a ready design.
  Cosmic Explorer's Cap         -> Luna's head, violet hair and ribbon, crescent moon and star earrings
                                   (hides your hair and ears)
  Cosmic Explorer's Jacket      -> bodysuit, glass top, collar gem, belt with the black-hole orb
  Cosmic Explorer's Halfgloves  -> forearms, the galaxy sleeve and her gloves
  Cosmic Explorer's Slops       -> skirt and the glass overskirt with its starry train (skirt physics)
  Cosmic Explorer's Boots       -> thigh-high stocking and boots

RACES: every race and gender. Built on the Midlander woman, the Midlander man and the Lalafell; the other races
are reshaped from those by the game. Men get Luna on a broader frame; Lalafell get a little Luna with a big head.

OPTION
  Hide your own face: only if your face shows through her head (it shouldn't, except Au Ra horns).
        Blanks every player face in this mod's collection, so use a collection that's only for your character.

Her face is static: no blinking, expressions or lip movement. Her hair has no physics; her skirts use the
game's skirt physics. The viewer's animated galaxy and glass effects are baked into flat colours.

Everyone in this mod's collection who wears the Cosmic Explorer's set looks like Luna Snow.

Luna Snow and Marvel Rivals belong to NetEase Games and Marvel. Model from the psylocke.gg viewer. Fan port,
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
            for i, material in enumerate(LETTERS[slot]):
                g = f"chara/equipment/e{SET:04d}/material/v0001/mt_{race}e{SET:04d}_{slot}_{'abcdefgh'[i]}.mtrl"
                default_files[g] = add(f"materials/{material}.mtrl", mtrls[material])

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
         "Description": "Only if your face shows through Luna's head. Blanks every player face in this collection.",
         "Options": [option("Hide every player face", "", hide)]},
    ]
    meta_json = {"Name": NAME, "Author": "Model by NetEase Games (Marvel Rivals); FFXIV port",
                 "Description": DESCRIPTION, "Version": VERSION, "Website": "",
                 "ModTags": ["Luna Snow", "Marvel Rivals", "Port", "Full Body", "Cosmic Explorer"]}
    write_pmp(PMP, meta_json, {"Files": default_files, "FileSwaps": {}, "Manipulations": manips}, groups, files)
    print(f"wrote {PMP} ({os.path.getsize(PMP) / 1e6:.1f} MB): {len(default_files)} default files, "
          f"{sum(len(o['Files']) for g in groups for o in g['Options'])} option files, {len(manips)} manipulations")


if __name__ == "__main__":
    build()
