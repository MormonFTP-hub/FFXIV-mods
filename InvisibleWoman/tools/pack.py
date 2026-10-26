"""Package the built models, materials and textures as a Penumbra modpack
(out/Invisible Woman - Unseen Weaver (Marvel Rivals).pmp).

Default files: the Valentione Rose Ribboned set's (e6098) five models for Hyur Midlander female (c0201), Hyur
Midlander male (c0101) and Lalafell (c1101), their materials (for all three colour variants: Rose, Forget-me-not
and Acacia load material sets v0001-v0003) and every texture.
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
NAME = "Invisible Woman - Unseen Weaver (Marvel Rivals)"
PMP = os.path.join(ROOT, "out", f"{NAME}.pmp")
VERSION = "1.2.0"
MATERIAL_SETS = (1, 2, 3)   # the IMC material set of variants 1-3 (Rose, Forget-me-not, Acacia)
MOOGLE_HEAD = 236
OTHER = ["Highlander", "Elezen", "Miqote", "Roegadyn", "AuRa", "Hrothgar", "Viera"]
OWN = [("Female", "Midlander"), ("Male", "Midlander"), ("Male", "Lalafell")]
FALLBACK = [(g, r) for g in ("Male", "Female") for r in OTHER] + [("Female", "Lalafell")]
EQP = {"top": 0x0001 | 0x0100 | 0x0200 | 0x0400 | 0x4000,   # enabled, show legs / hands / head, no breast physics
       "dwn": (0x01 | 0x20) << 16,                          # enabled, show feet
       "glv": 0x01 << 24,
       "sho": 0x01 << 32}

DESCRIPTION = """Invisible Woman (Sue Storm) from Marvel Rivals in her Unseen Weaver skin, as a full-body costume on the
Valentione Rose Ribboned set.

WEAR: the Valentione Rose Ribboned set (all classes, level 1): Ribboned Hat, Dress, Ribboned Gloves, Tights and
Heels. Any of its three colours (Rose, Forget-me-not, Acacia) works. Glamourer can put it on without owning it;
out/Invisible Woman - Glamourer import code.txt has a ready design.
  Ribboned Hat      -> her head, purple hair, witch hat, earrings (hides your hair and ears)
  Dress             -> bodice, capelet, collar gem, the shoulder rose and its thorns
  Ribboned Gloves   -> long dark gloves with claws, thorn bracelets
  Tights            -> skirt and petticoat (skirt physics), tights, belt
  Heels             -> heeled boots and the thorn vines round her shins

RACES: every race and gender. Built on the Midlander woman, the Midlander man and the Lalafell; the other races
are reshaped from those by the game. Men get her on a broader frame; Lalafell get a little Sue with a big head.

OPTION
  Hide your own face: only if your face shows through her head. Blanks every player face in this mod's
        collection, so use a collection that's only for your character.

Her face is static: no blinking, expressions or lip movement. Her hair has no physics; her skirt uses the game's
skirt physics.

Everyone in this mod's collection who wears the Valentione Rose Ribboned set looks like her.

Invisible Woman belongs to Marvel; the model is from Marvel Rivals (NetEase), via psylocke.gg. Fan port, personal
use only."""

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
                for ms in MATERIAL_SETS:
                    g = f"chara/equipment/e{SET:04d}/material/v{ms:04d}/mt_{race}e{SET:04d}_{slot}_{'abcdefgh'[i]}.mtrl"
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
         "Description": "Only if your face shows through her head. Blanks every player face in this collection.",
         "Options": [option("Hide every player face", "", hide)]},
    ]
    meta_json = {"Name": NAME, "Author": "Model from Marvel Rivals (NetEase), via psylocke.gg; FFXIV port",
                 "Description": DESCRIPTION, "Version": VERSION, "Website": "",
                 "ModTags": ["Invisible Woman", "Marvel Rivals", "Port", "Full Body", "Valentione Rose"]}
    write_pmp(PMP, meta_json, {"Files": default_files, "FileSwaps": {}, "Manipulations": manips}, groups, files)
    print(f"wrote {PMP} ({os.path.getsize(PMP) / 1e6:.1f} MB): {len(default_files)} default files, "
          f"{sum(len(o['Files']) for g in groups for o in g['Options'])} option files, {len(manips)} manipulations")


if __name__ == "__main__":
    build()
