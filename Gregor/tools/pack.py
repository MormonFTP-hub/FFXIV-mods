"""Package the built models, materials and textures as a Penumbra modpack (out/Gregor AEDD (Limbus Company).pmp).

Default files: Wake Doctor's set (e6148) legs and feet models, all materials and textures for Hyur Midlander male,
EQDP entries so every other non-Lalafell male race (Viera included) wears these c0101 models, and the head
slot's EQP taken from a pair of vanilla sunglasses so the glasses keep your hair and ears showing.
Option groups pick the arm look, the head piece and the centipede glow.
"""
import os
import pickle
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meta  # noqa: E402
import xivdata as xd  # noqa: E402
from build import LETTER, RACE, SET, mtrl  # noqa: E402
from xiv_files import write_pmp  # noqa: E402

ROOT = xd.ROOT
B = os.path.join(ROOT, "work", "build")
NAME = "Gregor AEDD (Limbus Company)"
PMP = os.path.join(ROOT, "out", f"{NAME}.pmp")
VERSION = "1.1.1"
OTHER_MALES = ["Highlander", "Elezen", "Miqote", "Roegadyn", "AuRa", "Hrothgar", "Viera"]
SUNGLASSES = 6259   # Avalanche Leader's Sunglasses: head EQP that shows hair, ears and earrings
TEXSET_MTRL = {"aedd": "aedd", "suit": "suit", "centi": "centi", "lens": "lens"}

DESCRIPTION = """Gregor's AEDD outfit from Limbus Company, ported from the VRChat avatar "AEDD Gregor" for Hyur Midlander male
and every male race that wears Midlander gear, Viera included. It keeps your own head, face, hair, ears and skin.

GEAR: Wake Doctor's set (all classes, level 1)
  Wake Doctor's Mask          -> Gregor's tinted glasses and the blue halo (hair and ears stay visible)
  Wake Doctor's White Coat    -> blue coat with shoulder bolts, shirt, vest, tie and ID badge (coat tails use the skirt physics bones)
  Wake Doctor's Rubber Gloves -> the arm option below
  Wake Doctor's Bottoms       -> trousers and belt
  Wake Doctor's Shoes         -> right shoe, armoured left leg with its crystal spikes

OPTIONS
  Arms: right centipede (default, as on the avatar), both centipedes, left centipede only, or no centipede.
        The centipede is scaled so it just reaches the floor when your arm hangs straight down.
  Head piece: glasses and halo, glasses only, or halo only.
  Centipede glow: glowing red eyes (default), or eyes plus glowing cyan veins.

The glasses are placed for the Viera male face. Other faces and races may need a hidden head piece.
Everyone in this mod's collection who wears the Wake Doctor's set as a non-Lalafell man looks like this.

Original avatar: "AEDD Gregor" VRChat model (commissioned by L7_Spectra on X). Credit the model's creator; not for resale.
Gregor and Limbus Company belong to Project Moon. Personal use only."""


def build():
    models = pickle.load(open(os.path.join(B, "mdl", "index.pkl"), "rb"))
    textures = pickle.load(open(os.path.join(B, "tex", "index.pkl"), "rb"))
    mtrl_local = {n: os.path.join(B, "mtrl", f"{n}.mtrl") for n in ("aedd", "suit", "centi", "centi_veins", "lens")}
    files = {}

    def add(inner, local):
        files[inner] = local
        return inner.replace("/", "\\")

    def mtrl_path(slot, letter):
        return f"chara/equipment/e{SET:04d}/material/v0001/{mtrl(slot, letter).lstrip('/')}"

    def model(vname):
        local, game, _ = models[vname]
        return {game: add(f"models/{vname}.mdl", local)}

    default_files = {}
    for (slot, texset), letter in LETTER.items():
        if slot == "glv":
            continue   # the centipede material is chosen by the glow option
        default_files[mtrl_path(slot, letter)] = add(f"materials/{texset}.mtrl", mtrl_local[TEXSET_MTRL[texset]])
    for _, (local, game) in textures.items():
        default_files[game] = add(game, local)
    default_files.update(model("dwn"))
    default_files.update(model("sho"))

    manips = []
    for race in OTHER_MALES:
        for slot in ("met", "top", "glv", "dwn", "sho"):
            manips.append(meta.eqdp_manip(SET, slot, "Male", race, 0))
    manips.append(meta.eqp_manip(SET, "met", meta.eqp(SUNGLASSES)))

    def option(name, desc, vnames, extra=None):
        f = {}
        for v in vnames:
            f.update(model(v))
        f.update(extra or {})
        return {"Name": name, "Description": desc, "Priority": 0, "Image": "", "Files": f, "FileSwaps": {}, "Manipulations": []}

    centi = mtrl_path("glv", LETTER[("glv", "centi")])
    groups = [
        {"Name": "Arms", "Description": "Which arms become AEDD's centipedes (Rubber Gloves and White Coat).",
         "Type": "Single", "DefaultSettings": 0, "Options": [
             option("Right centipede", "As on the avatar: the right arm is the centipede, the left hand is yours.",
                    ["top", "glv_right"]),
             option("Both centipedes", "Both arms are centipedes; the left sleeve is rolled like the right.",
                    ["top_rolled", "glv_both"]),
             option("Left centipede", "Left arm centipede, bare right forearm below the rolled sleeve.",
                    ["top_rolled", "glv_left"]),
             option("No centipede", "Bare right forearm below the rolled sleeve, your own left hand.", ["top", "glv_human"]),
         ]},
        {"Name": "Head piece", "Description": "What the Wake Doctor's Mask shows. Your hair and ears stay visible.",
         "Type": "Single", "DefaultSettings": 0, "Options": [
             option("Glasses and halo", "", ["met_both"]),
             option("Glasses only", "", ["met_glasses"]),
             option("Halo only", "", ["met_halo"]),
         ]},
        {"Name": "Centipede glow", "Description": "The avatar's centipede eyes glow red; its veins glow cyan on a toggle.",
         "Type": "Single", "DefaultSettings": 0, "Options": [
             option("Glowing eyes", "", [], {centi: add("materials/centi.mtrl", mtrl_local["centi"])}),
             option("Glowing eyes and veins", "", [], {centi: add("materials/centi_veins.mtrl", mtrl_local["centi_veins"])}),
         ]},
    ]
    meta_json = {"Name": NAME, "Author": "AEDD Gregor avatar (commissioned by L7_Spectra); FFXIV port",
                 "Description": DESCRIPTION, "Version": VERSION, "Website": "",
                 "ModTags": ["Limbus Company", "Gregor", "Port", "Outfit", "Male", "Viera"]}
    write_pmp(PMP, meta_json, {"Files": default_files, "FileSwaps": {}, "Manipulations": manips}, groups, files)
    print(f"wrote {PMP} ({os.path.getsize(PMP) / 1e6:.1f} MB): {len(default_files)} default files, "
          f"{sum(len(o['Files']) for g in groups for o in g['Options'])} option files, {len(manips)} manipulations")
    for race in ["Midlander"] + OTHER_MALES:
        code = meta.RACE_CODE[("Male", race)]
        print(f"  vanilla EQDP {race:10s} {code}: {meta.eqdp(code, SET):#06x}")


if __name__ == "__main__":
    build()
