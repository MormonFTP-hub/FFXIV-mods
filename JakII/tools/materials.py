"""Build the .mtrl: a vanilla Dawntrail character.shpk material (with a diffuse texture) as template, pointed at
Jak's atlas, colour table set to plain white with per-surface roughness / metalness (row pairs from the _id map).
Every model (gear, face, hair) uses this one material file under its own game path."""
import json
import os
import struct
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from textures import GAME_DIR, PAIRS  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "mtrl")
TEMPLATE = "chara/equipment/e0800/material/v0001/mt_c0101e0800_top_a.mtrl"
DOUBLE_SIDED_FLAGS = 0xC  # template is 0xD; bit 0 hides backfaces (the rip's ears, scarf and hair are thin shells)
# character.shpk's decal key: the body template has it on (Free Company crests). In the face slot the game binds the
# character's FACE PAINT as that decal, and face paints are masks with full alpha, so the face took the paint colour
# (Sora 1.1.0 in game). The material gets vanilla's no-decal value, as hands, legs and feet use.
DECAL_KEY, DECAL_ON, DECAL_OFF = 0xD2777173, 0xF35F5131, 0x4242B842


def decal_off(path):
    d = open(path, "rb").read()
    on, off = struct.pack("<II", DECAL_KEY, DECAL_ON), struct.pack("<II", DECAL_KEY, DECAL_OFF)
    if d.count(on) != 1:
        raise RuntimeError(f"{path}: expected one decal key entry, found {d.count(on)}")
    open(path, "wb").write(d.replace(on, off))

SURFACES = {  # pair -> row properties
    "cloth": {"Roughness": 0.9, "Metalness": 0.0},
    "leather": {"Roughness": 0.65, "Metalness": 0.0},
    "metal": {"Roughness": 0.45, "Metalness": 0.8},
    "skin": {"Roughness": 0.6, "Metalness": 0.0},
    "hair": {"Roughness": 0.55, "Metalness": 0.0},
    "eye": {"Roughness": 0.1, "Metalness": 0.0},
    "lens": {"Roughness": 0.05, "Metalness": 0.2},
}


def spec():
    rows = {}
    for r in range(32):
        rows[str(r)] = {"DiffuseColor": [1, 1, 1], "SpecularColor": [1, 1, 1], "EmissiveColor": [0, 0, 0],
                        "TileAlpha": 0, "TileIndex": 0, "SphereMapMask": 0, **SURFACES["cloth"]}
    for kind, pair in PAIRS.items():
        rows[str(2 * pair)].update(SURFACES[kind])
        rows[str(2 * pair + 1)].update(SURFACES[kind])
    return {"textures": [f"{GAME_DIR}_{t}.tex" for t in ("base", "norm", "mask", "id")],
            "flags": DOUBLE_SIDED_FLAGS, "baseRow": 2, "rows": rows, "constants": {"0x29AC0223": [0.5]}}


def build():
    os.makedirs(OUT, exist_ok=True)
    js = os.path.join(OUT, "jak.json")
    json.dump(spec(), open(js, "w"), indent=1)
    dst = os.path.join(OUT, "jak.mtrl")
    r = subprocess.run(xd.XIVTOOL + ["mtrlbuild", xd.extract(TEMPLATE)[0], dst, js], capture_output=True, text=True)
    if r.returncode != 0 or "wrote" not in r.stdout:
        raise RuntimeError(r.stdout + r.stderr)
    decal_off(dst)
    info = xd.xivtool("mtrlinfo", dst).splitlines()
    print(f"jak: {info[0]}")
    for line in info:
        if line.strip().startswith(("tex ", "row  0", "row  4", "row  6", "row 12")):
            print("   ", line.strip())
    return dst


if __name__ == "__main__":
    build()
