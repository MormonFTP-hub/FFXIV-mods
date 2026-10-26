"""Build the .mtrl files from a vanilla Dawntrail character.shpk material (e0800 top), pointed at Loki's textures.

White colour table (the colour comes from the _base texture); shine and roughness come from the _mask texture.
The decal (crest) key is set to vanilla's no-decal value, as hands, legs and feet have it: the e0800 top template has
it on, and the Sora port found the game then lays a bound decal (there: the character's face paint) over everything.
Double-sided, like the rest of these ports (the rip's cloth, hair cards and ribbons are single sheets). The hair
alpha-tests at the rip's own cut-off (1/3).
"""
import json
import os
import struct
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from texsets import SETS  # noqa: E402
from textures import GAME_DIR  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "mtrl")
TEMPLATE = "chara/equipment/e0800/material/v0001/mt_c0101e0800_top_a.mtrl"
DOUBLE_SIDED_FLAGS = 0xC
ALPHA_THRESHOLD = "0x29AC0223"
CUTOFF = {"hair": 0.333}   # the rip's own cut-off for the hair strand tips
DECAL_KEY, DECAL_ON, DECAL_OFF = 0xD2777173, 0xF35F5131, 0x4242B842   # character.shpk decal key (from SoraKH3)

PLAIN = {"DiffuseColor": [1, 1, 1], "SpecularColor": [1, 1, 1], "EmissiveColor": [0, 0, 0], "TileAlpha": 0,
         "TileIndex": 0, "SphereMapMask": 0, "Roughness": 1.0, "Metalness": 0.0}


def spec(texset):
    rows = {str(r): dict(PLAIN) for r in range(32)}
    norm = f"{GAME_DIR}_{texset}_norm.tex"
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
    # mtrlbuild doesn't set shader keys: swap the (id, value) pair in the written file
    data = open(dst, "rb").read()
    on, off = struct.pack("<II", DECAL_KEY, DECAL_ON), struct.pack("<II", DECAL_KEY, DECAL_OFF)
    assert data.count(on) == 1, (name, data.count(on))
    open(dst, "wb").write(data.replace(on, off))
    info = xd.xivtool("mtrlinfo", dst).splitlines()
    print(f"{name}: {info[0]}")
    for line in info:
        if line.strip().startswith(("tex ", "row  0", "const", "key")):
            print("   ", line.strip())
    return dst


def build():
    os.makedirs(OUT, exist_ok=True)
    return {t: mtrlbuild(TEMPLATE, t, spec(t)) for t in SETS}


if __name__ == "__main__":
    build()
