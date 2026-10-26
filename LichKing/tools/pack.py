"""Package the built models, materials and textures as a Penumbra modpack (out/The Lich King (WoW).pmp).

Default files: the Archfiend set (e0757) for Hyur Midlander male, plus EQDP entries so every other non-Lalafell
male race wears the same c0101 models, and EQP entries that hide hair, ears, horns and tails under it.
Option group "Frostmourne": the Deathbringer greatsword (w1501 b0037, Dark Knight) becomes Frostmourne.
"""
import os
import pickle
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meta  # noqa: E402
import xivdata as xd  # noqa: E402
from build import LETTER, MODEL_PATH, RACE, SET, WBODY, WEAPON  # noqa: E402
from xiv_files import write_pmp  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
NAME = "The Lich King (WoW)"
PMP = os.path.join(ROOT, "out", f"{NAME}.pmp")
VERSION = "1.1.0"
MATERIAL_SETS = (1,)            # e0757 has one variant, on material set v0001
WEAPON_MATERIAL_SETS = (1, 3, 4)  # b0037 variants 1-4 use v0001, v0001, v0003, v0004
OTHER_MALES = ["Highlander", "Elezen", "Miqote", "Roegadyn", "AuRa", "Hrothgar", "Viera"]
# EQP bits (Penumbra's EqpEntry) the set clears
HEAD_HIDE = 0x0000_1000 << 40       # HeadShowEarAuRa
BODY_HIDE = 0x2000                  # BodyShowTail
LEGS_HIDE = 0x40 << 16              # LegsShowTail

DESCRIPTION = """Arthas Menethil as the Lich King, from the World of Warcraft model, with his WoW armour fitted to the FFXIV Hyur Midlander male skeleton.

GEAR (Archfiend set, e0757; all classes, level 1):
  Helm       -> the crown helm with his shadowed face, glowing eyes and the white hair under it (hides your hair)
  Armor      -> breastplate, skull pauldrons, collar and the floor-length cape (cape rides the skirt physics bones)
  Gauntlets  -> clawed gauntlets with fur cuffs
  Breeches   -> belt, front tabard (skirt physics bones), skull tassets and thigh fur
  Sabatons   -> greaves, shin fur and skull sabatons
Other male races (except Lalafell) are redirected to the Midlander models. Tails and Au Ra horns are hidden
under the set.

FROSTMOURNE (option, on by default):
  Deathbringer / Antiquated / Animated / Awoken / Ultima Deathbringer (Dark Knight greatsword, w1501 b0037)
  The Awoken and Ultima variants keep their vanilla visual effects.

The armour, sword and textures are Blizzard's (World of Warcraft), from a fan-made Maya rig of the WoW model.
Personal use only: don't upload or share this mod."""


def build():
    models = pickle.load(open(os.path.join(B, "mdl", "index.pkl"), "rb"))
    textures = pickle.load(open(os.path.join(B, "tex", "index.pkl"), "rb"))
    mtrl = {k: os.path.join(B, "mtrl", f"{k}.mtrl") for k in ("lk_a", "lk_b", "lk_mist", "fm")}
    files = {}  # inside pack -> local file

    def add(inner, local):
        files[inner] = local
        return inner.replace("/", "\\")

    default_files, sword_files = {}, {}
    for slot, (local, game) in models.items():
        if slot == "wep":
            continue
        default_files[game] = add(game, local)
        names = xd.xivtool("mdlinfo", local)
        for ts, letter in LETTER.items():
            name = f"mt_{RACE}e{SET:04d}_{slot}_{letter}.mtrl"
            if name not in names:
                continue
            for v in MATERIAL_SETS:
                gp = f"chara/equipment/e{SET:04d}/material/v{v:04d}/{name}"
                default_files[gp] = add(gp, mtrl[ts])
    local, game = models["wep"]
    sword_files[game] = add(game, local)
    for v in WEAPON_MATERIAL_SETS:
        gp = f"chara/weapon/w{WEAPON:04d}/obj/body/b{WBODY:04d}/material/v{v:04d}/mt_w{WEAPON:04d}b{WBODY:04d}_a.mtrl"
        sword_files[gp] = add(gp, mtrl["fm"])
    for key, (local, game) in textures.items():
        (sword_files if key.startswith("fm_") else default_files)[game] = add(game, local)

    manips = []
    for race in OTHER_MALES:
        for slot in ("met", "top", "glv", "dwn", "sho"):
            manips.append(meta.eqdp_manip(SET, slot, "Male", race, 0))
    eqp = meta.eqp(SET)
    for slot, hide in (("met", HEAD_HIDE), ("top", BODY_HIDE), ("dwn", LEGS_HIDE)):
        manips.append(meta.eqp_manip(SET, slot, eqp & ~hide))

    groups = [{
        "Name": "Frostmourne",
        "Description": "The Deathbringer greatsword (Dark Knight) becomes Frostmourne.",
        "Type": "Multi",
        "DefaultSettings": 1,
        "Options": [{"Name": "Frostmourne on the Deathbringer", "Description": "w1501 b0037, all its variants.",
                     "Priority": 0, "Image": "", "Files": sword_files, "FileSwaps": {}, "Manipulations": []}],
    }]
    meta_json = {"Name": NAME, "Author": "Blizzard Entertainment (model)", "Description": DESCRIPTION,
                 "Version": VERSION, "Website": "", "ModTags": ["World of Warcraft", "Lich King", "Arthas", "Port",
                                                                "Armor", "Male", "Dark Knight"]}
    default_mod = {"Files": default_files, "FileSwaps": {}, "Manipulations": manips}
    write_pmp(PMP, meta_json, default_mod, groups, files)
    print(f"wrote {PMP} ({os.path.getsize(PMP) / 1e6:.1f} MB): {len(default_files)} default files, "
          f"{len(sword_files)} Frostmourne files, {len(manips)} manipulations")
    return PMP


if __name__ == "__main__":
    build()
