"""Read vanilla EQP / EQDP / IMC entries, and write them as Penumbra manipulations."""
import struct

import xivdata as xd

EQP_PATH = "chara/xls/equipmentparameter/equipmentparameter.eqp"
EQP_BLOCK = 160

# Penumbra slot names and the bits each slot owns in an EQP entry.
SLOT_NAME = {"met": "Head", "top": "Body", "glv": "Hands", "dwn": "Legs", "sho": "Feet"}
EQP_MASK = {
    "top": 0x0000_0000_0000_FFFF,
    "dwn": 0x0000_0000_00FF_0000,
    "glv": 0x0000_0000_FF00_0000,
    "sho": 0x0000_00FF_0000_0000,
    "met": 0xFFFF_FF00_0000_0000,
}
# EQDP: two bits (material, model) per slot, at the slot's own position.
EQDP_SHIFT = {"met": 0, "top": 2, "glv": 4, "dwn": 6, "sho": 8}
RACE_CODE = {("Male", "Midlander"): "c0101", ("Female", "Midlander"): "c0201",
             ("Male", "Highlander"): "c0301", ("Female", "Highlander"): "c0401",
             ("Male", "Elezen"): "c0501", ("Female", "Elezen"): "c0601",
             ("Male", "Miqote"): "c0701", ("Female", "Miqote"): "c0801",
             ("Male", "Roegadyn"): "c0901", ("Female", "Roegadyn"): "c1001",
             ("Male", "AuRa"): "c1301", ("Female", "AuRa"): "c1401",
             ("Male", "Hrothgar"): "c1501", ("Female", "Hrothgar"): "c1601",
             ("Male", "Viera"): "c1701", ("Female", "Viera"): "c1801"}

_cache = {}


def _file(path):
    if path not in _cache:
        _cache[path] = open(xd.extract(path)[0], "rb").read()
    return _cache[path]


def eqp(set_id):
    data = _file(EQP_PATH)
    sid = max(set_id, 1)
    block = sid // EQP_BLOCK
    control = struct.unpack_from("<Q", data, 0)[0]
    if not control >> block & 1:
        return 0
    count = bin(control & ((1 << block) - 1)).count("1")
    return struct.unpack_from("<Q", data, (EQP_BLOCK * count + sid % EQP_BLOCK) * 8)[0]


def eqdp(race_code, set_id):
    data = _file(f"chara/xls/charadb/equipmentdeformerparameter/{race_code}.eqdp")
    ident, block_size, block_count = struct.unpack_from("<HHH", data, 0)
    offsets = struct.unpack_from(f"<{block_count}H", data, 6)
    data_start = 6 + 2 * block_count
    block = set_id // block_size
    if block >= block_count or offsets[block] == 0xFFFF:
        return 0
    return struct.unpack_from("<H", data, data_start + 2 * (offsets[block] + set_id % block_size))[0]


def imc(set_id, slot, variant):
    p = xd.extract(f"chara/equipment/e{set_id:04d}/e{set_id:04d}.imc")[0]
    b = open(p, "rb").read()
    order = ["met", "top", "glv", "dwn", "sho"]
    off = 4 + (variant * 5 + order.index(slot)) * 6
    mat, decal, attr_sound, vfx, anim = struct.unpack_from("<BBHBB", b, off)
    return {"MaterialId": mat, "DecalId": decal, "VfxId": vfx, "MaterialAnimationId": anim,
            "AttributeMask": attr_sound & 0x3FF, "SoundId": attr_sound >> 10}


def eqp_manip(set_id, slot, entry):
    return {"Type": "Eqp", "Manipulation": {"SetId": set_id, "Slot": SLOT_NAME[slot], "Entry": entry & EQP_MASK[slot]}}


def eqdp_manip(set_id, slot, gender, race, entry):
    return {"Type": "Eqdp", "Manipulation": {"Gender": gender, "Race": race, "SetId": set_id,
                                             "Slot": SLOT_NAME[slot], "Entry": entry & (3 << EQDP_SHIFT[slot])}}


def imc_manip(set_id, slot, variant, entry):
    return {"Type": "Imc", "Manipulation": {"ObjectType": "Equipment", "PrimaryId": set_id, "Variant": variant,
                                            "EquipSlot": SLOT_NAME[slot], "Entry": entry}}
