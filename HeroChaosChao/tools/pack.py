"""Package work/build as a Penumbra modpack: out/Hero Chaos Chao (Mammet #001).pmp."""
import json
import os
import struct

import build
import xivdata as xd
from xiv_files import write_pmp

PMP = os.path.join(xd.ROOT, "out", "Hero Chaos Chao (Mammet #001).pmp")
VERSION = "1.1.0"
IMC = f"{build.BODY}/b0001.imc"
GC_VARIANTS = (2, 3, 4)   # Mammet #003L / #003G / #003U
BIT_MAMMET, BIT_CHAO = 1 << 0, 1 << 1   # atr_bv_a, atr_bv_b

DESCRIPTION = """The Hero Chaos Chao from Sonic Adventure 2: Battle as the Mammet #001 minion.

GET THE MINION
Mammet #001 costs 2,400 gil from the merchants next to each city's aetheryte: Maisenta (New Gridania),
Bango Zango (Limsa Lominsa Lower Decks) and Roarich (Ul'dah - Steps of Nald), or the minion trader in
the Gold Saucer's Chocobo Square. It's also on the market board.

The Chao uses the mammet's own skeleton and animations, so it walks, idles and plays like Mammet #001.
Put the mod in a collection assigned to your own character if other players' mammets should stay mammets.

GRAND COMPANY MAMMETS
The three Grand Company mammets (#003L, #003G, #003U) share Mammet #001's model. By default they stay
mammets (an IMC edit hides the Chao on them). Pick "Become Chao too" to turn them into the Chao as well.

Model and textures: Sonic Team / SEGA (Sonic Adventure 2: Battle). Personal use only."""


def vanilla_imc():
    b = open(xd.extract(IMC)[0], "rb").read()
    count, _ = struct.unpack_from("<HH", b, 0)
    entries = {}
    for v in range(count + 1):
        mat, decal, attr_sound, vfx, anim = struct.unpack_from("<BBHBB", b, 4 + v * 6)
        entries[v] = dict(material=mat, decal=decal, vfx=vfx, anim=anim, mask=attr_sound & 0x3FF, sound=attr_sound >> 10)
    return entries


def imc_manip(variant, e, mask):
    out = xd.xivtool("imcmanip", 8001, 1, variant, e["material"], e["decal"], e["vfx"], e["anim"], mask, e["sound"])
    return json.loads(out)


def build_pmp():
    index = json.load(open(os.path.join(build.B, "index.json")))
    imc = vanilla_imc()
    assert not imc[1]["mask"] & BIT_MAMMET and imc[1]["mask"] & BIT_CHAO, "Mammet #001's vanilla IMC entry changed"
    files, by_local, redirects = {}, {}, {}
    for game, local in index.items():
        if local not in by_local:
            by_local[local] = f"files/{os.path.relpath(local, build.B).replace(os.sep, '/')}"
            files[by_local[local]] = local
        redirects[game] = by_local[local].replace("/", "\\")
    stay = [imc_manip(v, imc[v], imc[v]["mask"] & ~BIT_CHAO) for v in GC_VARIANTS]
    chao = [imc_manip(v, imc[v], imc[v]["mask"] & ~BIT_MAMMET) for v in GC_VARIANTS]
    groups = [{
        "Name": "Grand Company mammets",
        "Description": "Mammet #003L, #003G and #003U share Mammet #001's model.",
        "Type": "Single",
        "DefaultSettings": 0,
        "Options": [
            {"Name": "Stay mammets", "Description": "Only Mammet #001 becomes the Chao.",
             "Files": {}, "FileSwaps": {}, "Manipulations": stay},
            {"Name": "Become Chao too", "Description": "All four mammets become the Chao.",
             "Files": {}, "FileSwaps": {}, "Manipulations": chao},
        ],
    }]
    meta = {"Name": "Hero Chaos Chao (Mammet #001)", "Author": "Sonic Team / SEGA (model), ported",
            "Description": DESCRIPTION, "Version": VERSION, "Website": "",
            "ModTags": ["Minion", "Mammet", "Chao", "Sonic Adventure 2", "Port"]}
    write_pmp(PMP, meta, {"Files": redirects}, groups, files)
    print(f"wrote {PMP} ({os.path.getsize(PMP) / 1e3:.0f} KB): {len(redirects)} redirects, {len(files)} files, "
          f"{len(stay)} + {len(chao)} IMC entries")


if __name__ == "__main__":
    build_pmp()
