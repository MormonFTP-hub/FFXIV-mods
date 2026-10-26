"""Build the .mtrl files from a vanilla Dawntrail character.shpk material (e0800 top), pointed at Mina's textures.

White colour table (the colour comes from the _base texture); shine and roughness come from the _mask texture.
A texture set with self-illumination (none at the moment: in game nothing on her glows) gets a second row that
glows where its _id texture picks it. Double-sided, like the rest of these ports. Two things are patched in the
written file, since mtrlbuild keeps the template's (as the Nurse-Pool and Sora ports do):
  * the decal (crest) key goes to vanilla's no-decal value, as hands, legs and feet have it: with it on, the game can
    lay whatever decal it binds over the whole surface (Sora's face took the character's face paint)
  * the samplers wrap instead of mirroring
Her skin (textures.SKIN_SETS) clones the vanilla Midlander woman's body material instead (skin.shpk), with its three
textures swapped (the shared skin_mask.tex too: it is laid out for the vanilla body's UVs). skin.shpk has no decal key
and its samplers already wrap.
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from mtrl import Mtrl  # noqa: E402
from textures import GAME_DIR, SKIN_SETS, SKIN_TEMPLATE, TEXSETS  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "mtrl")
TEMPLATE = "chara/equipment/e0800/material/v0001/mt_c0101e0800_top_a.mtrl"
DOUBLE_SIDED_FLAGS = 0xC
GLOW = {}       # texset -> emissive colour of its second row, for sets with self-illumination
DECAL_KEY, DECAL_ON, DECAL_OFF = 0xD2777173, 0xF35F5131, 0x4242B842   # character.shpk decal key (from SoraKH3)
ADDRESS_BITS = 0xF              # sampler flags: U (bits 0-1) and V (bits 2-3) address mode, 0 = wrap

PLAIN = {"DiffuseColor": [1, 1, 1], "SpecularColor": [1, 1, 1], "EmissiveColor": [0, 0, 0], "TileAlpha": 0,
         "TileIndex": 0, "SphereMapMask": 0, "Roughness": 1.0, "Metalness": 0.0}


def spec(texset):
    rows = {str(r): dict(PLAIN) for r in range(32)}
    if texset in GLOW:
        rows["1"]["EmissiveColor"] = GLOW[texset]
    id_tex = f"{GAME_DIR}_{texset}_id.tex" if TEXSETS[texset][2] else f"{GAME_DIR}_flat_id.tex"
    return {"textures": [f"{GAME_DIR}_{texset}_base.tex", f"{GAME_DIR}_flat_norm.tex", f"{GAME_DIR}_{texset}_mask.tex",
                         id_tex],
            "flags": DOUBLE_SIDED_FLAGS, "baseRow": 2, "rows": rows, "constants": {"0x29AC0223": [0.5]}}


def skin_spec(texset):
    return {"textures": [f"{GAME_DIR}_{texset}_base.tex", f"{GAME_DIR}_skin_norm.tex", f"{GAME_DIR}_skin_mask.tex"]}


def patch(path):
    """Decal key off, samplers wrapping."""
    m = Mtrl.read(path)
    keys = {k: v for k, v in m.keys}
    assert keys.get(DECAL_KEY) == DECAL_ON, hex(keys.get(DECAL_KEY, 0))
    m.keys = [[k, DECAL_OFF if k == DECAL_KEY else v] for k, v in m.keys]
    m.samplers = [[sid, flags & ~ADDRESS_BITS, tex] for sid, flags, tex in m.samplers]
    m.write(path)


def mtrlbuild(template, name, js, gear=True):
    p = os.path.join(OUT, f"{name}.json")
    json.dump(js, open(p, "w"), indent=1)
    dst = os.path.join(OUT, f"{name}.mtrl")
    r = subprocess.run(xd.XIVTOOL + ["mtrlbuild", xd.extract(template)[0], dst, p], capture_output=True, text=True)
    if r.returncode != 0 or "wrote" not in r.stdout:
        raise RuntimeError(r.stdout + r.stderr)
    if gear:
        patch(dst)
    info = xd.xivtool("mtrlinfo", dst).splitlines()
    print(f"{name}: {info[0]}")
    for line in info:
        if line.strip().startswith(("tex ", "row  0", "row  1", "sampler", "key 0xD2777173")):
            print("   ", line.strip())
    return dst


def build():
    os.makedirs(OUT, exist_ok=True)
    out = {t: mtrlbuild(TEMPLATE, t, spec(t)) for t in TEXSETS}
    out.update({t: mtrlbuild(SKIN_TEMPLATE, t, skin_spec(t), gear=False) for t in SKIN_SETS})
    return out


if __name__ == "__main__":
    build()
