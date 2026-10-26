"""Pack the converted models, materials and textures into a Penumbra modpack.

usage: python package.py            -> out/Jotaro Kujo (Part 4).pmp
"""
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xiv_files import write_pmp  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOD = os.path.join(ROOT, "work", "mod")
OUT = os.path.join(ROOT, "out", "Jotaro Kujo (Part 4).pmp")
SET, RACE, FACE, HAIR = "e0279", "c0101", "f0001", "h0001"

MODELS = {
    "top": f"chara/equipment/{SET}/model/{RACE}{SET}_top.mdl",
    "glv": f"chara/equipment/{SET}/model/{RACE}{SET}_glv.mdl",
    "dwn": f"chara/equipment/{SET}/model/{RACE}{SET}_dwn.mdl",
    "sho": f"chara/equipment/{SET}/model/{RACE}{SET}_sho.mdl",
    "fac": f"chara/human/{RACE}/obj/face/{FACE}/model/{RACE}{FACE}_fac.mdl",
    "hir": f"chara/human/{RACE}/obj/hair/{HAIR}/model/{RACE}{HAIR}_hir.mdl",
}

DESCRIPTION = """Jotaro Kujo (Part 4, Diamond is Unbreakable) from JoJo's Bizarre Adventure: Eyes of Heaven, \
re-rigged to the FFXIV skeleton.

For Hyur Midlander male. To become Jotaro:
- wear (or glamour) The Emperor's New Robe, Gloves, Breeches and Boots
- use face 1 and hairstyle 1 (Glamourer or the Aesthetician); face 1 becomes Jotaro's head and cap, \
hairstyle 1 becomes invisible
- no hat

The coat tails sway on the skirt bones. The face is static (no expressions).
His face and hands use the game's own skin shader, so they take your character's skin colour (a light or tan Midlander swatch suits him).

Model and textures: CyberConnect2 / Bandai Namco. Rip from The Models Resource."""


def main():
    tex = json.load(open(os.path.join(MOD, "files_textures.json")))
    pack_files, mapping = {}, {}

    def add(game_path, local_rel):
        inner = local_rel.replace("\\", "/")
        pack_files[inner] = os.path.join(MOD, *inner.split("/"))
        return inner.replace("/", "\\")

    for slot, gp in MODELS.items():
        dst = os.path.join(MOD, *gp.split("/"))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(ROOT, "work", "mdl", f"{slot}.mdl"), dst)
        mapping[gp] = add(gp, gp)
    for gp, rel in tex["files"].items():
        if gp == tex["variant_game_path"]:
            continue  # chosen by the colour option
        mapping[gp] = add(gp, rel)

    options = []
    order = ["White (default)", "Purple", "Blue", "Lavender"]  # DefaultSettings 0 = the first one
    for label in order:
        rel = tex["variants"][label]
        options.append({"Name": label, "Description": "", "Priority": 0,
                        "Files": {tex["variant_game_path"]: add(tex["variant_game_path"], rel)},
                        "FileSwaps": {}, "Manipulations": []})
    groups = [{"Name": "Coat colour", "Description": "Eyes of Heaven alternate costume colours.",
               "Type": "Single", "DefaultSettings": 0, "Options": options}]

    meta = {"Name": "Jotaro Kujo (Part 4)", "Author": "Arcadia", "Description": DESCRIPTION,
            "Image": "", "Version": "1.2.0", "Website": "",
            "ModTags": ["JoJo", "Jotaro", "Character Port", "Hyur Midlander Male"]}
    write_pmp(OUT, meta, {"Files": mapping}, groups, pack_files)
    print(f"wrote {OUT}: {len(mapping)} default files, {len(options)} colour options, {len(pack_files)} packed files,"
          f" {os.path.getsize(OUT) / 1e6:.1f} MB")


main()
