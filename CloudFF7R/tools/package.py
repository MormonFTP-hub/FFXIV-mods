"""Assemble the Penumbra modpack (.pmp) from the built models, materials and textures."""
import glob
import json
import os
import shutil
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "out")
STAGE = os.path.join(OUT, "pmp")
PMP = os.path.join(OUT, "Cloud Strife (FF7R) - Strife Set.pmp")
WORK_MDL = os.path.join(ROOT, "work", "mdl")
SET = "e0263"

DESCRIPTION = """Cloud Strife from Final Fantasy VII Remake Intergrade, ported onto the Hyur Midlander male skeleton so every FFXIV animation and emote drives him.

How to wear him:
- Character must be Hyur Midlander male (use Glamourer to switch if needed).
- Equip all four Strife pieces: Strife Vest, Strife Gloves, Strife Bags, Strife Boots (Glamourer works fine, you don't need to own them).
- Leave the head slot empty.

Cloud is split across the Strife pieces, so all four must be worn. The 'Cloud's head' option hides every Midlander male face and hairstyle while the mod is enabled, so assign this mod only to the collection your character uses. His face is static (no blinking, expressions or lip-sync).

Ripped model source: Final Fantasy VII Remake Intergrade (Square Enix), via The Models Resource. For personal use."""


def gp(path):
    return path.replace("\\", "/")


def stage(src, rel):
    dst = os.path.join(STAGE, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(src, dst)
    return rel.replace("/", "\\")


def main():
    if os.path.exists(STAGE):
        shutil.rmtree(STAGE)
    os.makedirs(STAGE)

    default = {}
    # Materials + textures (always on).
    mod_root = os.path.join(OUT, "mod")
    for f in glob.glob(os.path.join(mod_root, "**", "*.*"), recursive=True):
        rel = gp(os.path.relpath(f, mod_root))
        default[rel] = stage(f, rel)
    for slot in ("top", "sho"):
        rel = f"chara/equipment/{SET}/model/c0101{SET}_{slot}.mdl"
        default[rel] = stage(os.path.join(WORK_MDL, f"c0101{SET}_{slot}.mdl"), rel)

    cloud_head = {}
    for slot in ("glv", "dwn"):
        rel = f"chara/equipment/{SET}/model/c0101{SET}_{slot}.mdl"
        cloud_head[rel] = stage(os.path.join(WORK_MDL, f"c0101{SET}_{slot}.mdl"), "cloud_head/" + rel)
    hide_root = os.path.join(OUT, "hide")
    for f in sorted(glob.glob(os.path.join(hide_root, "**", "*.mdl"), recursive=True)):
        rel = gp(os.path.relpath(f, hide_root))
        cloud_head[rel] = stage(f, "cloud_head/" + rel)

    own_head = {}
    own_root = os.path.join(OUT, "ownhead")
    for f in glob.glob(os.path.join(own_root, "**", "*.mdl"), recursive=True):
        rel = gp(os.path.relpath(f, own_root))
        own_head[rel] = stage(f, "own_head/" + rel)

    meta = {
        "FileVersion": 3,
        "Name": "Cloud Strife (FF7R) - Strife Set",
        "Author": "Cloud FF7R port build",
        "Description": DESCRIPTION,
        "Image": "",
        "Version": "1.1.0",
        "Website": "",
        "ModTags": ["Gear", "Character", "Final Fantasy VII"],
    }
    default_mod = {"Version": 0, "Files": default, "FileSwaps": {}, "Manipulations": []}
    group = {
        "Version": 0,
        "Name": "Head",
        "Description": "Which head to show with Cloud's body.",
        "Image": "",
        "Page": 0,
        "Priority": 0,
        "Type": "Single",
        "DefaultSettings": 0,
        "Options": [
            {"Name": "Cloud's head", "Description": "Cloud's FF7R face and hair. Hides every Midlander male face and hairstyle while the mod is enabled. The face is static.",
             "Files": cloud_head, "FileSwaps": {}, "Manipulations": []},
            {"Name": "My own face and hair", "Description": "Only Cloud's outfit; your own face and hairstyle stay visible and keep their expressions.",
             "Files": own_head, "FileSwaps": {}, "Manipulations": []},
        ],
    }
    for name, data in (("meta.json", meta), ("default_mod.json", default_mod), ("group_001_head.json", group)):
        with open(os.path.join(STAGE, name), "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)

    # Every referenced file must exist in the staging folder.
    for files in (default, cloud_head, own_head):
        for rel in files.values():
            assert os.path.isfile(os.path.join(STAGE, rel.replace("\\", os.sep))), rel

    if os.path.exists(PMP):
        os.remove(PMP)
    with zipfile.ZipFile(PMP, "w", zipfile.ZIP_DEFLATED) as z:
        for f in glob.glob(os.path.join(STAGE, "**", "*"), recursive=True):
            if os.path.isfile(f):
                z.write(f, os.path.relpath(f, STAGE))
    print(f"default files {len(default)}, cloud head {len(cloud_head)}, own head {len(own_head)}")
    print("wrote", PMP, round(os.path.getsize(PMP) / 1e6, 1), "MB")


if __name__ == "__main__":
    main()
