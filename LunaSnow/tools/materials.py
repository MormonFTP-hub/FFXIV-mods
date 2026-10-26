"""Build the .mtrl files from a vanilla Dawntrail character.shpk material (e0800 top), pointed at Luna's textures:
one per material in textures.MATERIALS (the "outfit" atlas holds the gear, skirt and glass sets).

White colour table (the colour comes from the _base texture); shine and roughness come from the _mask texture.
Opacity is the _norm texture's blue, cut at 0.5 (her hair strands, brows and lashes). The train's stars glow a
little, as they sparkle in the viewer. Double-sided, like the rest of these ports.
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from textures import GAME_DIR, MATERIALS  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "mtrl")
TEMPLATE = "chara/equipment/e0800/material/v0001/mt_c0101e0800_top_a.mtrl"
DOUBLE_SIDED_FLAGS = 0xC
GLOW = {"stars": [0.18, 0.28, 0.55], "orb": [0.12, 0.05, 0.22]}

PLAIN = {"DiffuseColor": [1, 1, 1], "SpecularColor": [1, 1, 1], "EmissiveColor": [0, 0, 0], "TileAlpha": 0,
         "TileIndex": 0, "SphereMapMask": 0, "Roughness": 1.0, "Metalness": 0.0}


def spec(material):
    rows = {str(r): dict(PLAIN) for r in range(32)}
    if material in GLOW:
        for r in ("0", "1"):
            rows[r] = dict(PLAIN, EmissiveColor=GLOW[material])
    return {"textures": [f"{GAME_DIR}_{material}_base.tex", f"{GAME_DIR}_{material}_norm.tex",
                         f"{GAME_DIR}_{material}_mask.tex", f"{GAME_DIR}_flat_id.tex"],
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
        if line.strip().startswith(("tex ", "row  0", "row  1")):
            print("   ", line.strip())
    return dst


def build():
    os.makedirs(OUT, exist_ok=True)
    return {m: mtrlbuild(TEMPLATE, m, spec(m)) for m in MATERIALS}


if __name__ == "__main__":
    build()
