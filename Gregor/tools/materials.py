"""Build the .mtrl files from vanilla Dawntrail templates, pointed at Gregor's textures.

character.shpk (template: a vanilla e0800 top material) for suit / aedd / centipede: white colour table,
roughness from the _mask texture, and per texture set one row pair whose second row the _id texture blends
towards where its green is low (G 255 = first row, as the game reads it; textures.py → id_tex). The suit and coat keep
metal as their second row: the source's metallic maps mark only real metal there (glasses frame, buckles, the coat's
bolts, the leg armour's plates), so since 1.1.1 only those parts are metal:
  suit, aedd   second row metal
  centi        second row glows cyan in the "veins" variant (the avatar's emission toggle), plain otherwise
  eyes         both rows glow red (the centipede's eyes glow by default on the avatar)
characterglass.shpk (template: the Avalanche Leader's Sunglasses lens) for the glasses lenses.
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from textures import GAME_DIR, LENS_REF, PAIRS  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "mtrl")
TEMPLATE = "chara/equipment/e0800/material/v0001/mt_c0101e0800_top_a.mtrl"
DOUBLE_SIDED_FLAGS = 0xC  # template is 0xD; bit 0 hides backfaces (coat, cuffs and the centipede need both sides)
VEIN_GLOW = [0.43, 1.08, 1.2]     # the avatar's cyan emission colour (0.36, 0.90, 1.0), a little brighter
EYE_GLOW = [1.6, 0.12, 0.12]

PLAIN = {"DiffuseColor": [1, 1, 1], "SpecularColor": [1, 1, 1], "EmissiveColor": [0, 0, 0], "TileAlpha": 0,
         "TileIndex": 0, "SphereMapMask": 0, "Roughness": 1.0, "Metalness": 0.0}
SECOND_ROW = {  # pair -> overrides for its second (odd) row, per material variant
    "suit": {"Metalness": 1.0},
    "aedd": {"Metalness": 1.0},
    "centi": {},
    "eyes": {"EmissiveColor": EYE_GLOW},
}
FIRST_ROW = {"eyes": {"EmissiveColor": EYE_GLOW}}


def spec(texset, veins=False):
    rows = {str(r): dict(PLAIN) for r in range(32)}
    for kind, pair in PAIRS.items():
        rows[str(2 * pair)].update(FIRST_ROW.get(kind, {}))
        rows[str(2 * pair + 1)].update(SECOND_ROW[kind])
    if veins:
        rows[str(2 * PAIRS["centi"] + 1)]["EmissiveColor"] = VEIN_GLOW
    return {"textures": [f"{GAME_DIR}_{texset}_{t}.tex" for t in ("base", "norm", "mask", "id")],
            "flags": DOUBLE_SIDED_FLAGS, "baseRow": 2, "rows": rows, "constants": {"0x29AC0223": [0.5]}}


def mtrlbuild(template, name, js):
    p = os.path.join(OUT, f"{name}.json")
    json.dump(js, open(p, "w"), indent=1)
    dst = os.path.join(OUT, f"{name}.mtrl")
    r = subprocess.run(xd.XIVTOOL + ["mtrlbuild", xd.extract(template)[0], dst, p], capture_output=True, text=True)
    if r.returncode != 0 or "wrote" not in r.stdout:
        raise RuntimeError(r.stdout + r.stderr)
    info = xd.xivtool("mtrlinfo", dst).splitlines()
    print(f"{name}: {info[0]}")
    for line in info:
        if line.strip().startswith(("tex ", "row  4", "row  5", "row  6", "row  7", "row 28")):
            print("   ", line.strip())
    return dst


def build():
    os.makedirs(OUT, exist_ok=True)
    out = {}
    for texset in ("suit", "aedd", "centi"):
        out[texset] = mtrlbuild(TEMPLATE, texset, spec(texset))
    out["centi_veins"] = mtrlbuild(TEMPLATE, "centi_veins", spec("centi", veins=True))
    out["lens"] = mtrlbuild(LENS_REF[1], "lens", {"textures": [f"{GAME_DIR}_lens_{t}.tex" for t in ("norm", "mask", "id")]})
    return out


if __name__ == "__main__":
    build()
