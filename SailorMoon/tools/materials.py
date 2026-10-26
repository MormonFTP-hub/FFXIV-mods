"""Build the .mtrl files from a vanilla Dawntrail character.shpk material (e0800 top), pointed at the baked
textures: one per texture set (head, hair, body).

White colour table (the colour comes from the _base texture); shine and roughness come from the _mask texture,
the sculpt's detail from the _norm texture. Double-sided, like the rest of these ports.

The template's decal key (0xD2777173 = 0xF35F5131, for FC crests) is switched off (0x4242B842, as vanilla
hands/legs/feet): with it on, the game stamps the slot's decal over the material (the head slot's is the
character's face paint, the Educand's top has an equipment decal), which turned the Sora port's face dark.
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paint  # noqa: E402
import xivdata as xd  # noqa: E402
from mtrl import Mtrl  # noqa: E402
from textures import GAME_DIR  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "mtrl")
TEMPLATE = "chara/equipment/e0800/material/v0001/mt_c0101e0800_top_a.mtrl"
DOUBLE_SIDED_FLAGS = 0xC
DECAL_KEY, DECAL_OFF = 0xD2777173, 0x4242B842

PLAIN = {"DiffuseColor": [1, 1, 1], "SpecularColor": [1, 1, 1], "EmissiveColor": [0, 0, 0], "TileAlpha": 0,
         "TileIndex": 0, "SphereMapMask": 0, "Roughness": 1.0, "Metalness": 0.0}


def spec(texset):
    rows = {str(r): dict(PLAIN) for r in range(32)}
    return {"textures": [f"{GAME_DIR}_{texset}_base.tex", f"{GAME_DIR}_{texset}_norm.tex",
                         f"{GAME_DIR}_{texset}_mask.tex", f"{GAME_DIR}_flat_id.tex"],
            "flags": DOUBLE_SIDED_FLAGS, "baseRow": 2, "rows": rows, "constants": {"0x29AC0223": [0.5]}}


def mtrlbuild(template, name, js):
    p = os.path.join(OUT, f"{name}.json")
    json.dump(js, open(p, "w"), indent=1)
    dst = os.path.join(OUT, f"{name}.mtrl")
    r = subprocess.run(xd.XIVTOOL + ["mtrlbuild", xd.extract(template)[0], dst, p], capture_output=True, text=True)
    if r.returncode != 0 or "wrote" not in r.stdout:
        raise RuntimeError(r.stdout + r.stderr)
    m = Mtrl.read(dst)
    m.keys = [[k, DECAL_OFF if k == DECAL_KEY else v] for k, v in m.keys]
    m.write(dst)
    info = xd.xivtool("mtrlinfo", dst).splitlines()
    print(f"{name}: {info[0]}")
    for line in info:
        if line.strip().startswith(("tex ", "row  0", "row  1")):
            print("   ", line.strip())
    return dst


def build():
    os.makedirs(OUT, exist_ok=True)
    return {t: mtrlbuild(TEMPLATE, t, spec(t)) for t in paint.TEXSETS}


if __name__ == "__main__":
    build()
