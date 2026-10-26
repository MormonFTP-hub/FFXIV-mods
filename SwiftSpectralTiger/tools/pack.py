"""Package work/build as a Penumbra modpack: out/Swift Spectral Tiger.pmp."""
import json
import os

import xivdata as xd
from xiv_files import write_pmp

B = os.path.join(xd.ROOT, "work", "build")
PMP = os.path.join(xd.ROOT, "out", "Swift Spectral Tiger.pmp")
VERSION = "1.1.0"

DESCRIPTION = """The Swift Spectral Tiger from World of Warcraft as an FFXIV mount, rigged to the FFXIV tiger skeleton.

CHOCOBO (on by default)
Every chocobo mount (Company Chocobo, Legacy / Black / Draught chocobo) becomes the Swift Spectral Tiger.
The chocobo also gets the FFXIV tiger's skeleton and animations, so it walks, runs, jumps, flies and
swims like a big cat instead of using chocobo animations.
  - Take your chocobo's barding off: barding pieces are chocobo-shaped and will not fit the tiger.
  - Your chocobo companion uses the same model and skeleton, so it turns into the tiger too. Its basic
    movement is covered, but its battle actions are still chocobo animations and can look broken.
    Turn the mod off before summoning the companion if that bothers you.
  - Put the mod in a collection assigned to your own character to keep other players' chocobos unchanged.

FFXIV TIGER MOUNTS (off by default)
Also replaces the Centurio Tiger, War Tiger and Battle Tiger mounts. They already use the tiger skeleton,
so this option is only the model.

Not included: WoW's transparency and particle effects. The tiger is opaque with a soft blue glow and
green eye glow.

Model and textures: Blizzard Entertainment (World of Warcraft). Personal use only."""


def build():
    index = json.load(open(os.path.join(B, "index.json")))
    files = {}

    def add(prefix, game, local):
        inner = f"{prefix}/{game}"
        files[inner] = local
        return inner.replace("/", "\\")

    textures = {g: add("textures", g, l) for g, l in index["textures"].items()}
    choco = {g: add("chocobo", g, l) for g, l in index["choco"].items()}
    tiger = {g: add("tiger", g, l) for g, l in index["tiger"].items()}
    groups = [{
        "Name": "Replace",
        "Description": "Which mounts become the Swift Spectral Tiger.",
        "Type": "Multi",
        "DefaultSettings": 1,
        "Options": [
            {"Name": "Chocobo", "Description": "All chocobo mounts, with the FFXIV tiger's skeleton and animations. Remove barding first.",
             "Priority": 0, "Image": "", "Files": choco, "FileSwaps": {}, "Manipulations": []},
            {"Name": "FFXIV tiger mounts", "Description": "Centurio Tiger, War Tiger and Battle Tiger (model only).",
             "Priority": 0, "Image": "", "Files": tiger, "FileSwaps": {}, "Manipulations": []},
        ],
    }]
    meta = {"Name": "Swift Spectral Tiger", "Author": "Blizzard Entertainment (model), ported", "Description": DESCRIPTION,
            "Version": VERSION, "Website": "", "ModTags": ["Mount", "Chocobo", "World of Warcraft", "Port", "Tiger"]}
    write_pmp(PMP, meta, {"Files": textures}, groups, files)
    print(f"wrote {PMP} ({os.path.getsize(PMP) / 1e6:.1f} MB): {len(textures)} texture, {len(choco)} chocobo, {len(tiger)} tiger files")


if __name__ == "__main__":
    build()
