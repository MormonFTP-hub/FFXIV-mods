"""Copy the original game files the Sora mod replaces into work/game/<game path>.

usage: extract_bases.py <game_dir> <out_dir>
"""
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sqpack import Repo

SET = "e0084"
RACE = "c0101"
FACE = "f0001"
HAIR = "h0001"
SLOTS = ("top", "glv", "dwn", "sho")

repo = Repo(sys.argv[1])
out = sys.argv[2]


def dump(path):
    data = repo.read(path)
    dst = os.path.join(out, path.replace("/", os.sep))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "wb") as f:
        f.write(data)
    print("extracted", path, len(data))
    return data


def mdl_materials(data):
    n_vdecl = struct.unpack_from("<H", data, 12)[0]
    p = 0x44 + n_vdecl * 136
    _, _, size = struct.unpack_from("<HHI", data, p)
    return [s.decode() for s in data[p + 8:p + 8 + size].split(b"\0") if s.endswith(b".mtrl")]


dump(f"chara/human/{RACE}/skeleton/base/b0001/skl_{RACE}b0001.sklb")

imc = dump(f"chara/equipment/{SET}/{SET}.imc")
n_variants, part_mask = struct.unpack_from("<HH", imc, 0)
# Equipment IMC parts are met, top, glv, dwn, sho; entries are (variants + 1) * parts,
# 6 bytes each: materialId u8, decalId u8, attrMask/sound u16, vfxId u8, animMask u8
IMC_PARTS = ("met",) + SLOTS
mat_ids = {s: set() for s in SLOTS}
for v in range(1, n_variants + 1):
    for pi, slot in enumerate(IMC_PARTS):
        if slot in mat_ids:
            mat_ids[slot].add(imc[4 + (v * len(IMC_PARTS) + pi) * 6])
print("imc variants", n_variants, "material ids per slot", {k: sorted(v) for k, v in mat_ids.items()})

for slot in SLOTS:
    mdl_path = f"chara/equipment/{SET}/model/{RACE}{SET}_{slot}.mdl"
    data = dump(mdl_path)
    for m in mdl_materials(data):
        for mid in sorted(mat_ids.get(slot, {1})):
            p = f"chara/equipment/{SET}/material/v{mid:04}/{m.lstrip('/')}"
            if repo.exists(p):
                dump(p)

for path in (f"chara/human/{RACE}/obj/face/{FACE}/model/{RACE}{FACE}_fac.mdl",
             f"chara/human/{RACE}/obj/hair/{HAIR}/model/{RACE}{HAIR}_hir.mdl"):
    data = dump(path)
    print("   materials:", mdl_materials(data))
