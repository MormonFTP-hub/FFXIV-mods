"""Build the .mtrl files from a vanilla Dawntrail character.shpk material (e0800 top), pointed at her textures.

White colour table (the colour comes from the _base texture); shine and roughness come from the _mask texture.
Row pair 0 is plain, pair 1 metal (the gold), pair 2 plain with a second glow colour, as the _id texture's red
picks. The second row of each pair glows where the _id texture's green is low (G = 255 picks the first row): pairs
0 and 1 in the set's first GLOW colour, pair 2 in its second. An atlas material (textures.py -> MATERIALS) gives
each tile its own ROW_PAIRS row pairs, which its _id red points at, so the trim and the thorns keep their own glow
colours. Double-sided, like the rest of these ports; strands and hair are alpha-tested at 0.5.
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from mtrl import Mtrl  # noqa: E402
from textures import MATERIALS, ROW_PAIRS, tex_of  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "mtrl")
TEMPLATE = "chara/equipment/e0800/material/v0001/mt_c0101e0800_top_a.mtrl"
DOUBLE_SIDED_FLAGS = 0xC
# The rip's glow (HDR), brought into the game's range by one factor for every set (GAME_GLOW, tuned in the PMP
# Viewer's game shaders against the psylocke.gg viewer with its lights off). Per set: (first, second) colour.
#   trim    emissiveColor x emissiveStrength; second: the collar gem (commonCrystal, a pale cyan glow)
#   thorns  the flow glow: flowNoiseColor x flowNoiseIntensity x flowMaskIntensity x mean(flowTex) 0.37
GAME_GLOW = 0.3
RIP_GLOW = {"trim": ([0.224 * 4.5, 0.143 * 4.5, 0.668 * 4.5], [0.9, 2.6, 4.0]),
            "thorns": ([0.1 * 15 * 0.37, 0.515 * 15 * 0.37, 1.0 * 15 * 0.37], None)}
GLOW = {t: tuple(None if c is None else [round(v * GAME_GLOW, 3) for v in c] for c in cs) for t, cs in RIP_GLOW.items()}

# Constants added to the template (mtrl.py can add ones it lacks). None: vanilla glowing Dawntrail gear (e0847) leaves
# g_EmissiveColor (0x38A64362, package default 0) unset too, and the game-shader renderer shows no colour-table glow
# either way, so there is nothing to tell it from.
EMISSIVE = {}

# the gold (pair 1): the rip adds a gold-tinted cube-map reflection; full metal reads near-black away from bright skies
GOLD_ROW = {"Metalness": 0.5, "Roughness": 0.6}

PLAIN = {"DiffuseColor": [1, 1, 1], "SpecularColor": [1, 1, 1], "EmissiveColor": [0, 0, 0], "TileAlpha": 0,
         "TileIndex": 0, "SphereMapMask": 0, "Roughness": 1.0, "Metalness": 0.0}


def spec(mat):
    rows = {str(r): dict(PLAIN) for r in range(32)}
    for k, texset in enumerate(t for row in MATERIALS[mat] for t in row):    # the k-th tile's rows
        r0 = 2 * ROW_PAIRS * k
        for r in (r0 + 2, r0 + 3):
            rows[str(r)].update(GOLD_ROW)
        first, second = GLOW.get(texset, (None, None))
        for r, c in ((r0 + 1, first), (r0 + 3, first), (r0 + 5, second)):
            if c is not None:
                rows[str(r)]["EmissiveColor"] = c
    return {"textures": [tex_of(mat, k) for k in ("base", "norm", "mask", "id")],
            "flags": DOUBLE_SIDED_FLAGS, "baseRow": 2, "rows": rows, "constants": {"0x29AC0223": [0.5]}}


def mtrlbuild(template, name, js):
    p = os.path.join(OUT, f"{name}.json")
    json.dump(js, open(p, "w"), indent=1)
    dst = os.path.join(OUT, f"{name}.mtrl")
    r = subprocess.run(xd.XIVTOOL + ["mtrlbuild", xd.extract(template)[0], dst, p], capture_output=True, text=True)
    if r.returncode != 0 or "wrote" not in r.stdout:
        raise RuntimeError(r.stdout + r.stderr)
    m = Mtrl.read(dst)
    for cid, values in EMISSIVE.items():
        m.set_constant(cid, values)
    m.write(dst)
    info = xd.xivtool("mtrlinfo", dst).splitlines()
    print(f"{name}: {info[0]}")
    for line in info:
        if line.strip().startswith(("tex ", "row  0", "row  1", "const 0x38A64362")):
            print("   ", line.strip())
    return dst


def build():
    os.makedirs(OUT, exist_ok=True)
    return {m: mtrlbuild(TEMPLATE, m, spec(m)) for m in MATERIALS}


if __name__ == "__main__":
    build()
