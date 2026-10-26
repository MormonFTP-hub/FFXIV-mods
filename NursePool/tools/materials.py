"""Build the .mtrl files from a vanilla Dawntrail character.shpk material (e0800 top), pointed at Nurse-Pool's textures.

Every colour-table row is plain white (the colour comes from the _base texture; shine and roughness from _mask), so
the shared empty _id can't pick metal. 1.0.x had a metal second row and wrote the rip's metalness into _id G, but
G = 255 picks the pair's FIRST row: nearly everything came out metal, near-black in daylight (seen in GS).
Two things are patched in the written file, since mtrlbuild keeps the template's:
  * the decal (crest) key goes to vanilla's no-decal value, as hands, legs and feet have it: with it on, the game lays
    whatever decal it binds over the whole surface (the Sora port found that)
  * the samplers wrap instead of mirroring (Penumbra SamplerFlags bits 0-3 = U/V address mode). The rip's gear atlas
    tiles past u = 1, and 872 of its triangles cross a tile edge, so only wrap draws them as the source does.
Double-sided, like the rest of these ports. The wig's loose strand cards alpha-test through the _norm blue.
The skin (textures.SKIN_SETS) clones the vanilla male body's skin.shpk material instead, with only its textures swapped
(its third, the shared skin_mask.tex, too: that one is laid out for the vanilla body's UVs). Its samplers already wrap
and skin.shpk has no decal key, so it isn't patched.
"""
import json
import os
import struct
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from mtrl import Mtrl  # noqa: E402
from textures import GAME_DIR, SKIN_SETS, TEXSETS, has  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "mtrl")
TEMPLATE = "chara/equipment/e0800/material/v0001/mt_c0101e0800_top_a.mtrl"
DOUBLE_SIDED_FLAGS = 0xC
ALPHA_THRESHOLD = "0x29AC0223"
CUTOFF = {"hairfx": 0.333}      # the rip's own cut-off for its hair
DECAL_KEY, DECAL_ON, DECAL_OFF = 0xD2777173, 0xF35F5131, 0x4242B842   # character.shpk decal key (from SoraKH3)
ADDRESS_BITS = 0xF              # sampler flags: U (bits 0-1) and V (bits 2-3) address mode, 0 = wrap

PLAIN = {"DiffuseColor": [1, 1, 1], "SpecularColor": [1, 1, 1], "EmissiveColor": [0, 0, 0], "TileAlpha": 0,
         "TileIndex": 0, "SphereMapMask": 0, "Roughness": 1.0, "Metalness": 0.0}


def spec(texset):
    rows = {str(r): dict(PLAIN) for r in range(32)}
    norm = f"{GAME_DIR}_{texset}_norm.tex" if has(texset, "norm") else f"{GAME_DIR}_flat_norm.tex"
    return {"textures": [f"{GAME_DIR}_{texset}_base.tex", norm, f"{GAME_DIR}_{texset}_mask.tex",
                         f"{GAME_DIR}_flat_id.tex"],
            "flags": DOUBLE_SIDED_FLAGS, "baseRow": 2, "rows": rows,
            "constants": {ALPHA_THRESHOLD: [CUTOFF.get(texset, 0.5)]}}


def skin_spec(texset):
    return {"textures": [f"{GAME_DIR}_{texset}_{k}.tex" for k in ("base", "norm", "mask")]}


def patch(path):
    """Decal key off, samplers wrapping."""
    m = Mtrl.read(path)
    keys = {k: v for k, v in m.keys}
    assert keys.get(DECAL_KEY) == DECAL_ON, hex(keys.get(DECAL_KEY, 0))
    m.keys = [[k, DECAL_OFF if k == DECAL_KEY else v] for k, v in m.keys]
    m.samplers = [[sid, flags & ~ADDRESS_BITS, tex] for sid, flags, tex in m.samplers]
    m.write(path)


def mtrlbuild(template, name, js):
    p = os.path.join(OUT, f"{name}.json")
    json.dump(js, open(p, "w"), indent=1)
    dst = os.path.join(OUT, f"{name}.mtrl")
    r = subprocess.run(xd.XIVTOOL + ["mtrlbuild", xd.extract(template)[0], dst, p], capture_output=True, text=True)
    if r.returncode != 0 or "wrote" not in r.stdout:
        raise RuntimeError(r.stdout + r.stderr)
    if name not in SKIN_SETS:
        patch(dst)
    info = xd.xivtool("mtrlinfo", dst).splitlines()
    print(f"{name}: {info[0]}")
    for line in info:
        if line.strip().startswith(("tex ", "row  0", "row  1", "sampler", "key 0xD2777173", "const 0x29AC0223")):
            print("   ", line.strip())
    return dst


def build():
    os.makedirs(OUT, exist_ok=True)
    return {t: mtrlbuild(SKIN_SETS[t], t, skin_spec(t)) if t in SKIN_SETS else mtrlbuild(TEMPLATE, t, spec(t))
            for t in TEXSETS}


if __name__ == "__main__":
    build()
