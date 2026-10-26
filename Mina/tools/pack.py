"""Package the built models, materials and textures as a Penumbra modpack (out/Mina (Deadlock).pmp).

Default files: the Alternative set's (e6264) five models for Hyur Midlander female (c0201), Hyur Midlander male
(c0101) and Lalafell (c1101), their materials and every texture.
Manipulations:
  EQDP  every other race loads the Midlander model of its gender (Lalafell women load the Lalafell one; the game's
        racial deformer reshapes it), and the three fitted races load their own model and material for every slot
  EQP   head as the vanilla Moogle Head (hides hair, scalp and every race's ears); body shows the other four
        pieces but no necklace, bracelets or tail, and turns breast physics off; legs show the feet, no tail;
        hands and feet plain (no rings or bracelets)
Option groups: the purse, the overskirt's shape (flared, or draped clear of the hands), and an opt-in face hider.
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
NAME = "Mina (Deadlock)"
PMP = os.path.join(ROOT, "out", f"{NAME}.pmp")
VERSION = "1.3.0"
MOOGLE_HEAD = 236
OTHER = ["Highlander", "Elezen", "Miqote", "Roegadyn", "AuRa", "Hrothgar", "Viera"]
OWN = [("Female", "Midlander"), ("Male", "Midlander"), ("Male", "Lalafell")]
FALLBACK = [(g, r) for g in ("Male", "Female") for r in OTHER] + [("Female", "Lalafell")]
EQP = {"top": 0x0001 | 0x0100 | 0x0200 | 0x0400 | 0x4000,   # enabled, show legs / hands / head, no breast physics
       "dwn": (0x01 | 0x20) << 16,                          # enabled, show feet
       "glv": 0x01 << 24,
       "sho": 0x01 << 32}

DESCRIPTION = """Mina from Deadlock, as a full-body costume on the Alternative set.

WEAR: the Alternative set (all classes, level 1): Leather Ribbon, Ruffled Dress, False Nails, Bloomers and Boots.
Glamourer can put it on without owning it; out/Mina - Glamourer import code.txt has a ready design.
  Leather Ribbon  -> Mina's head and bob (hides your hair and ears)
  Ruffled Dress   -> jacket and purse
  False Nails     -> sleeves from the elbow and her red gloves
  Bloomers        -> shorts, stockings, skirt and the bat-wing overskirt (skirt physics)
  Boots           -> her heeled thigh boots

RACES: every race and gender. Built on the Midlander woman, the Midlander man and the Lalafell; the other races
are reshaped from those by the game. Men get Mina on a broader frame; Lalafell get a little Mina with a big head.

OPTIONS
  Purse: on (default) or off.
  Overskirt: hanging clear of the hands (default), or flared as in Deadlock. The game's standing poses hang your
        hands at your hips, where the flared overskirt hides them.
  Head size: Deadlock size (default), her own proportions with a slimmer bob, or FFXIV size, big enough to keep your
        own face hidden inside (about 19% bigger against her height). Deadlock size blanks every player face in this
        mod's collection, even without the set on: use a collection that's only for your character, or pick FFXIV
        size.
  Hide your own face: only if your face shows through her head (it doesn't for Midlanders, Viera or Lalafell).
        Blanks every player face in this mod's collection, so use a collection that's only for your character.

Her face is static: no blinking, expressions or lip movement. Her hair has no physics; her skirts use the
game's skirt physics.

Everyone in this mod's collection who wears the Alternative set looks like Mina.

Mina and Deadlock belong to Valve (model). Blender rig by Lellex (MinaRIG v0.2). Fan port, personal use only."""


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

    nopurse, draped, small = {}, {}, {}
    for race in RACES:
        local, game = models[f"{race}_top_nopurse"]
        nopurse[game] = add(f"models/{race}_top_nopurse.mdl", local)
        local, game = models[f"{race}_dwn_draped"]
        draped[game] = add(f"models/{race}_dwn_draped.mdl", local)
        local, game = models[f"{race}_met_small"]
        small[game] = add(f"models/{race}_met_small.mdl", local)
    hide = {}
    for name, (local, game) in models.items():
        if name.startswith("hide_"):
            hide[game] = add(f"hide/{name[5:]}.mdl", local)
    small.update(hide)

    groups = [
        {"Name": "Purse", "Description": "Her red shoulder bag with the bat charm.", "Type": "Single", "DefaultSettings": 0,
         "Priority": 1, "Options": [option("With purse", "", {}), option("No purse", "", nopurse)]},
        {"Name": "Overskirt", "Type": "Single", "DefaultSettings": 0, "Priority": 1,
         "Description": "The game's standing poses hang your hands at your hips, inside her wide bat-wing overskirt.",
         "Options": [option("Hangs clear of the hands", "The sides of both skirts hang closer to the body, so your "
                            "hands stay visible.", draped),
                     option("Flared, as in Deadlock", "Her own shape. Your hands disappear into it when you stand.", {})]},
        {"Name": "Head size", "Type": "Single", "DefaultSettings": 1, "Priority": 1,
         "Description": "Her head has to be at least as big as your own face for it to stay hidden inside.",
         "Options": [option("FFXIV size", "Big enough that your own face, custom face mods included, stays inside "
                            "it: about 19% bigger against her height than in Deadlock, with her full bob.", {}),
                     option("Deadlock size (hides your own face)", "Her proportions from Deadlock, with a slimmer "
                            "bob. Blanks every player face in this collection, even when you're not wearing the "
                            "set, so use a collection that's only for your character.", small)]},
        {"Name": "Hide your own face", "Type": "Multi", "DefaultSettings": 0,
         "Description": "Only if your face shows through Mina's head. Blanks every player face in this collection.",
         "Options": [option("Hide every player face", "", hide)]},
    ]
    meta_json = {"Name": NAME, "Author": "Model by Valve (Deadlock), rig by Lellex; FFXIV port",
                 "Description": DESCRIPTION, "Version": VERSION, "Website": "",
                 "ModTags": ["Mina", "Deadlock", "Port", "Full Body", "Alternative"]}
    write_pmp(PMP, meta_json, {"Files": default_files, "FileSwaps": {}, "Manipulations": manips}, groups, files)
    print(f"wrote {PMP} ({os.path.getsize(PMP) / 1e6:.1f} MB): {len(default_files)} default files, "
          f"{sum(len(o['Files']) for g in groups for o in g['Options'])} option files, {len(manips)} manipulations")


if __name__ == "__main__":
    build()
