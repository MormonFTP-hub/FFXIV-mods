"""Package the plugsuit alone (tools/build_outfit.py) as out/Asuka Plugsuit (Evangelion).pmp.

Default files: the Magitek set's (e6164) Jacket, Fingerstalls, Bottoms and Shoes models for the four fitted races and
for Miqo'te women, Au Ra women and Highlander men (build_outfit.EXTRA: their own collar wrap), the suit's material and
textures. The head slot isn't touched, so your own head, hair and any hat show.
Manipulations: EQDP (those seven load their own models, the rest the fallback the game's racial deformer reshapes) and
EQP for those four slots; no head EQP.
"""
import os
import pickle
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_outfit as bo  # noqa: E402  (points build's paths at work/build_outfit)
import meta  # noqa: E402
import pack  # noqa: E402
import xivdata as xd  # noqa: E402
from build import RACES, SET, letters  # noqa: E402
from xiv_files import write_pmp  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build_outfit")
TEX = os.path.join(ROOT, "work", "build", "tex")
MTRL = os.path.join(ROOT, "work", "build", "mtrl")
NAME = "Asuka Plugsuit (Evangelion)"
PMP = os.path.join(ROOT, "out", f"{NAME}.pmp")
VERSION = "1.2.0"
EXTRA_OWN = {"c0801": ("Female", "Miqote"), "c1401": ("Female", "AuRa"), "c0301": ("Male", "Highlander")}
OWN = pack.OWN + [EXTRA_OWN[r] for r in bo.EXTRA]
FALLBACK = [gr for gr in pack.FALLBACK if gr not in OWN]

DESCRIPTION = """Asuka Langley's red plugsuit (Evangelion) on your own character: your head, face and hair stay.

WEAR: the Magitek set (all classes, level 1): Jacket, Fingerstalls, Bottoms and Shoes. Wear any head piece or none.
Glamourer can put it on without owning it; out/Asuka Plugsuit - Glamourer import code.txt has a ready design.
  Magitek Jacket       -> plugsuit torso, the collar and upper arms
  Magitek Fingerstalls -> forearms, wrist cuffs and gloves
  Magitek Bottoms      -> hips, thighs and knees
  Magitek Shoes        -> shins and the red heeled boots

RACES: every race and gender, from the same fits as the full-body mod (Midlander woman and man, Roegadyn man,
Lalafell; the other races are reshaped from those by the game), plus own models for Miqo'te women, Au Ra women and
Highlander men, whose necks are thicker. The collar hugs your own neck like a turtleneck, up to just under the jaw.
The suit replaces your whole body below the collar.

The full-body mod "Asuka Langley (Evangelion)" uses the same items: enable one of the two per collection.

Model: "Asuka Langley (Evangelion) T-Pose 3D Model" by Alina Ricci (Sketchfab, CC BY 4.0),
https://sketchfab.com/3d-models/asuka-langley-evangelion-t-pose-3d-model-062cd48300004ad4b07174337276daec
Asuka Langley and Evangelion belong to khara / Studio Gainax. Fan port, not affiliated with them."""


def build():
    models = pickle.load(open(os.path.join(B, "mdl", "index.pkl"), "rb"))
    textures = pickle.load(open(os.path.join(TEX, "index.pkl"), "rb"))
    L = letters()
    used = {t for ts in L.values() for t in ts}
    files, default_files = {}, {}

    def add(inner, local):
        files[inner] = local
        return inner.replace("/", "\\")

    for key, (local, game) in textures.items():
        if key == "flat_id" or key.rsplit("_", 1)[0] in used:
            default_files[game] = add(game, local)
    for race in RACES + tuple(bo.EXTRA):
        for slot in bo.SLOTS:
            local, game = models[f"{race}_{slot}"]
            default_files[game] = add(f"models/{race}_{slot}.mdl", local)
            for i, texset in enumerate(L[slot]):
                g = f"chara/equipment/e{SET:04d}/material/v0001/mt_{race}e{SET:04d}_{slot}_{'abcdefgh'[i]}.mtrl"
                default_files[g] = add(f"materials/{texset}.mtrl", os.path.join(MTRL, f"{texset}.mtrl"))
    manips = []
    for gender, race in FALLBACK:
        for slot in bo.SLOTS:
            manips.append(meta.eqdp_manip(SET, slot, gender, race, 0))
    for gender, race in OWN:
        for slot in bo.SLOTS:
            manips.append(meta.eqdp_manip(SET, slot, gender, race, 0x3FF))
    for slot, entry in pack.EQP.items():
        manips.append(meta.eqp_manip(SET, slot, entry))
    meta_json = {"Name": NAME, "Author": "Model by Alina Ricci (Sketchfab, CC BY 4.0); FFXIV port",
                 "Description": DESCRIPTION, "Version": VERSION,
                 "Website": "https://sketchfab.com/3d-models/asuka-langley-evangelion-t-pose-3d-model-062cd48300004ad4b07174337276daec",
                 "ModTags": ["Asuka", "Evangelion", "Plugsuit", "Port", "Outfit", "Magitek"]}
    write_pmp(PMP, meta_json, {"Files": default_files, "FileSwaps": {}, "Manipulations": manips}, [], files)
    print(f"wrote {PMP} ({os.path.getsize(PMP) / 1e6:.1f} MB): {len(default_files)} files, {len(manips)} manipulations")


if __name__ == "__main__":
    build()
