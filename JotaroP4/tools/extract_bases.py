"""Copy the vanilla game files the Jotaro mod replaces (or is built from) into work/game/<game path>.

usage: python extract_bases.py
"""
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sqpack import Repo

GAME_DIR = r"C:\Program Files (x86)\SquareEnix\FINAL FANTASY XIV - A Realm Reborn\game"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "work", "game")
SET, RACE, FACE, HAIR = "e0279", "c0101", "f0001", "h0001"

repo = Repo(GAME_DIR)


def dump(path):
    data = repo.read(path)
    dst = os.path.join(OUT, path.replace("/", os.sep))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "wb") as f:
        f.write(data)
    print("extracted", path, len(data))
    return data


dump(f"chara/human/{RACE}/skeleton/base/b0001/skl_{RACE}b0001.sklb")
imc = dump(f"chara/equipment/{SET}/{SET}.imc")
n_variants, part_mask = struct.unpack_from("<HH", imc, 0)
for v in range(0, n_variants + 1):
    print(" imc variant", v, [struct.unpack_from("<BBHBB", imc, 4 + (v * 5 + p) * 6) for p in range(5)])
for slot in ("met", "top", "glv", "dwn", "sho"):
    dump(f"chara/equipment/{SET}/model/{RACE}{SET}_{slot}.mdl")
dump(f"chara/human/{RACE}/obj/face/{FACE}/model/{RACE}{FACE}_fac.mdl")
dump(f"chara/human/{RACE}/obj/hair/{HAIR}/model/{RACE}{HAIR}_hir.mdl")
dump(f"chara/human/{RACE}/obj/body/b0001/model/{RACE}b0001_top.mdl") if repo.exists(f"chara/human/{RACE}/obj/body/b0001/model/{RACE}b0001_top.mdl") else None
dump(f"chara/equipment/e0000/model/{RACE}e0000_top.mdl")
dump(f"chara/equipment/e0000/model/{RACE}e0000_dwn.mdl")
dump(f"chara/equipment/e0000/model/{RACE}e0000_glv.mdl")
dump(f"chara/equipment/e0000/model/{RACE}e0000_sho.mdl")
dump("chara/xls/equipmentparameter/equipmentparameter.eqp")
dump(f"chara/xls/charadb/equipmentdeformerparameter/{RACE}.eqdp")
# material templates
dump("chara/equipment/e0039/material/v0001/mt_c0101e0039_top_a.mtrl")
dump("chara/equipment/e0084/material/v0002/mt_c0101e0084_top_a.mtrl")
# skin.shpk templates (1.1.0: his face and hands on the game's skin shader)
dump(f"chara/human/{RACE}/obj/face/{FACE}/material/mt_{RACE}{FACE}_fac_a.mtrl")
dump(f"chara/human/{RACE}/obj/body/b0001/material/v0001/mt_{RACE}b0001_a.mtrl")
