"""Build the .mtrl files from a vanilla Dawntrail character.shpk material (e0800 top), pointed at Jubilee's textures.

White colour table (the colour comes from the _base texture); shine and roughness come from the _mask texture,
opacity from the _norm texture's blue channel. Double-sided, like the rest of these ports. The hair material
cuts at the rip's own alpha-mask threshold (a third) so thin strands, brows and lashes keep their shape.
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
ALPHA_THRESHOLD = "0x29AC0223"
CUTOFF = {"hair": 0.3333}

PLAIN = {"DiffuseColor": [1, 1, 1], "SpecularColor": [1, 1, 1], "EmissiveColor": [0, 0, 0], "TileAlpha": 0,
         "TileIndex": 0, "SphereMapMask": 0, "Roughness": 1.0, "Metalness": 0.0}


def spec(mat):
    return {"textures": [f"{GAME_DIR}_{mat}_base.tex", f"{GAME_DIR}_{mat}_norm.tex", f"{GAME_DIR}_{mat}_mask.tex",
                         f"{GAME_DIR}_flat_id.tex"],
            "flags": DOUBLE_SIDED_FLAGS, "baseRow": 2, "rows": {str(r): dict(PLAIN) for r in range(32)},
            "constants": {ALPHA_THRESHOLD: [CUTOFF.get(mat, 0.5)]}}


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
    return {m: mtrlbuild(TEMPLATE, m, spec(m)) for m in MATERIALS}


if __name__ == "__main__":
    build()
