"""Build the .mtrl files from a vanilla Dawntrail character.shpk material (e0800 top), pointed at Black Cat's textures.

White colour table (the colour comes from the _base texture); shine and roughness come from the _mask texture.
Double-sided, like the rest of these ports (the rip's cloth, hair cards and ribbons are single sheets). The hair
alpha-tests at the rip's own cut-off (1/3), the accessory atlas at 1/2 (only the drape's fade uses it).
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from texsets import SETS  # noqa: E402
from textures import ALPHA_SETS, GAME_DIR  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "mtrl")
TEMPLATE = "chara/equipment/e0800/material/v0001/mt_c0101e0800_top_a.mtrl"
DOUBLE_SIDED_FLAGS = 0xC
ALPHA_THRESHOLD = "0x29AC0223"
CUTOFF = {"hair": 0.333}

PLAIN = {"DiffuseColor": [1, 1, 1], "SpecularColor": [1, 1, 1], "EmissiveColor": [0, 0, 0], "TileAlpha": 0,
         "TileIndex": 0, "SphereMapMask": 0, "Roughness": 1.0, "Metalness": 0.0}


def spec(texset):
    rows = {str(r): dict(PLAIN) for r in range(32)}
    norm = f"{GAME_DIR}_{texset}_norm.tex" if texset in ALPHA_SETS else f"{GAME_DIR}_flat_norm.tex"
    return {"textures": [f"{GAME_DIR}_{texset}_base.tex", norm, f"{GAME_DIR}_{texset}_mask.tex",
                         f"{GAME_DIR}_flat_id.tex"],
            "flags": DOUBLE_SIDED_FLAGS, "baseRow": 2, "rows": rows,
            "constants": {ALPHA_THRESHOLD: [CUTOFF.get(texset, 0.5)]}}


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
        if line.strip().startswith(("tex ", "row  0", "const")):
            print("   ", line.strip())
    return dst


def build():
    os.makedirs(OUT, exist_ok=True)
    return {t: mtrlbuild(TEMPLATE, t, spec(t)) for t in SETS}


if __name__ == "__main__":
    build()
