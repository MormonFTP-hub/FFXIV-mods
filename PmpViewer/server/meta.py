"""Vanilla meta files (EQP, EQDP, IMC, EST, GMP) and the same lookups with a mod's manipulations applied on top."""
import struct

import game

EQP_PATH = "chara/xls/equipmentparameter/equipmentparameter.eqp"
GMP_PATH = "chara/xls/equipmentparameter/gimmickparameter.gmp"
EQP_BLOCK = 160

EQUIP = ["met", "top", "glv", "dwn", "sho"]
ACCES = ["ear", "nek", "wrs", "rir", "ril"]
SLOT_NAME = {"met": "Head", "top": "Body", "glv": "Hands", "dwn": "Legs", "sho": "Feet",
             "ear": "Ears", "nek": "Neck", "wrs": "Wrists", "rir": "RFinger", "ril": "LFinger"}
SLOT_OF_NAME = {v: k for k, v in SLOT_NAME.items()}
EQP_MASK = {"top": 0x0000_0000_0000_FFFF, "dwn": 0x0000_0000_00FF_0000, "glv": 0x0000_0000_FF00_0000,
            "sho": 0x0000_00FF_0000_0000, "met": 0xFFFF_FF00_0000_0000}
SLOT_SHIFT = {s: 2 * i for i, s in enumerate(EQUIP)} | {s: 2 * i for i, s in enumerate(ACCES)}

RACES = [  # (code, gender, Penumbra ModelRace, label)
    ("c0101", "Male", "Midlander", "Midlander ♂"), ("c0201", "Female", "Midlander", "Midlander ♀"),
    ("c0301", "Male", "Highlander", "Highlander ♂"), ("c0401", "Female", "Highlander", "Highlander ♀"),
    ("c0501", "Male", "Elezen", "Elezen ♂"), ("c0601", "Female", "Elezen", "Elezen ♀"),
    ("c0701", "Male", "Miqote", "Miqo'te ♂"), ("c0801", "Female", "Miqote", "Miqo'te ♀"),
    ("c0901", "Male", "Roegadyn", "Roegadyn ♂"), ("c1001", "Female", "Roegadyn", "Roegadyn ♀"),
    ("c1101", "Male", "Lalafell", "Lalafell ♂"), ("c1201", "Female", "Lalafell", "Lalafell ♀"),
    ("c1301", "Male", "AuRa", "Au Ra ♂"), ("c1401", "Female", "AuRa", "Au Ra ♀"),
    ("c1501", "Male", "Hrothgar", "Hrothgar ♂"), ("c1601", "Female", "Hrothgar", "Hrothgar ♀"),
    ("c1701", "Male", "Viera", "Viera ♂"), ("c1801", "Female", "Viera", "Viera ♀"),
]
RACE_OF = {(g, r): c for c, g, r, _ in RACES}
GENDER_RACE = {c: (g, r) for c, g, r, _ in RACES}
# Race.Fallback() in Penumbra.GameData: one step, then the game goes straight to c0101.
FALLBACK = {"c0201": "c0101", "c1501": "c0901", "c1201": "c1101"}
for _c, _g, _r, _ in RACES:
    if _c not in FALLBACK and _c != "c0101":
        FALLBACK[_c] = "c0201" if _g == "Female" else "c0101"
# Races with a skin material of their own; the rest use their nearest ancestor's (Roegadyn women use c0401's).
SKIN_RACES = {"c0101", "c0201", "c0301", "c0401", "c0901", "c1101", "c1301", "c1401", "c1501", "c1601", "c1701", "c1801"}


def skin_race(race):
    if race == "c1001":
        return "c0401"
    while race not in SKIN_RACES:
        race = FALLBACK[race]
    return race

_files = {}


def _read(path):
    if path not in _files:
        p = game.game_file(path)
        _files[path] = open(p, "rb").read() if p else None
    return _files[path]


EQP_DEFAULT = 0x3FE00070603F00     # what the game uses for sets without an entry


def _blocked_u64(data, set_id, default=0):
    if set_id == 0:
        return default
    sid = set_id
    block = sid // EQP_BLOCK
    control = struct.unpack_from("<Q", data, 0)[0]
    if block >= 64 or not control >> block & 1:
        return default
    count = bin(control & ((1 << block) - 1)).count("1")
    return struct.unpack_from("<Q", data, (EQP_BLOCK * count + sid % EQP_BLOCK) * 8)[0]


def vanilla_eqp(set_id):
    return _blocked_u64(_read(EQP_PATH), set_id, EQP_DEFAULT)


def vanilla_gmp(set_id):
    return _blocked_u64(_read(GMP_PATH), set_id)


def vanilla_eqdp(race, set_id, accessory=False):
    kind = "accessorydeformerparameter" if accessory else "equipmentdeformerparameter"
    data = _read(f"chara/xls/charadb/{kind}/{race}.eqdp")
    if data is None:
        return 0
    ident, block_size, block_count = struct.unpack_from("<HHH", data, 0)
    offsets = struct.unpack_from(f"<{block_count}H", data, 6)
    start = 6 + 2 * block_count
    block = set_id // block_size
    if block >= block_count or offsets[block] == 0xFFFF:
        return 0
    return struct.unpack_from("<H", data, start + 2 * (offsets[block] + set_id % block_size))[0]


def imc_path(kind, primary, secondary=0):
    if kind == "equipment":
        return f"chara/equipment/e{primary:04d}/e{primary:04d}.imc"
    if kind == "accessory":
        return f"chara/accessory/a{primary:04d}/a{primary:04d}.imc"
    if kind == "weapon":
        return f"chara/weapon/w{primary:04d}/obj/body/b{secondary:04d}/b{secondary:04d}.imc"
    if kind == "monster":
        return f"chara/monster/m{primary:04d}/obj/body/b{secondary:04d}/b{secondary:04d}.imc"
    if kind == "demihuman":
        return f"chara/demihuman/d{primary:04d}/obj/equipment/e{secondary:04d}/e{secondary:04d}.imc"
    raise ValueError(kind)


def vanilla_imc(path, part, variant):
    """IMC entry dict, or None when the file or variant is missing. part: index of the slot in the file."""
    data = _read(path)
    if data is None:
        return None
    count, mask = struct.unpack_from("<HH", data, 0)
    parts = max(bin(mask).count("1"), 1)
    if variant > count:
        return None
    off = 4 + (variant * parts + part) * 6
    if off + 6 > len(data):
        return None
    mat, decal, attr_sound, vfx, anim = struct.unpack_from("<BBHBB", data, off)
    return {"MaterialId": mat, "DecalId": decal, "AttributeMask": attr_sound & 0x3FF, "SoundId": attr_sound >> 10,
            "VfxId": vfx, "MaterialAnimationId": anim, "variants": count}


IMC_FIELDS = ("MaterialId", "DecalId", "AttributeMask", "SoundId", "VfxId", "MaterialAnimationId")
EST_FILE = {"Head": "extra_met", "Body": "extra_top", "Hair": "hairskeletontemplate", "Face": "faceskeletontemplate"}


def vanilla_est(slot, race, set_id):
    data = _read(f"chara/xls/charadb/{EST_FILE[slot]}.est")
    if data is None:
        return 0
    n = struct.unpack_from("<I", data, 0)[0]
    gr = int(race[1:])
    for i in range(n):
        s, r = struct.unpack_from("<HH", data, 4 + 4 * i)
        if r == gr and s == set_id:
            return struct.unpack_from("<H", data, 4 + 4 * n + 2 * i)[0]
    return 0


def est_skeleton(slot, race, skel_id):
    t = {"Head": ("met", "m"), "Body": ("top", "t"), "Hair": ("hair", "h"), "Face": ("face", "f")}[slot]
    return f"chara/human/{race}/skeleton/{t[0]}/{t[1]}{skel_id:04d}/skl_{race}{t[1]}{skel_id:04d}.sklb"


class Meta:
    """Lookups with the mod's manipulations layered over the game's files; each answer says where it came from."""

    def __init__(self, resolved=None):
        self.eqp, self.eqdp, self.imc, self.est, self.gmp = {}, {}, {}, {}, {}
        self.other = []
        if resolved is None:
            return
        for x in resolved.manips:
            t, m, src = x["m"].get("Type"), x["m"].get("Manipulation") or {}, x["from"]
            try:
                if t == "Eqp":
                    s = SLOT_OF_NAME[m["Slot"]]
                    self.eqp[(int(m["SetId"]), s)] = (int(m["Entry"]) & EQP_MASK[s], src)
                elif t == "Eqdp":
                    race = RACE_OF[(m["Gender"], m["Race"])]
                    self.eqdp[(race, int(m["SetId"]), SLOT_OF_NAME[m["Slot"]])] = (int(m["Entry"]), src)
                elif t == "Imc":
                    self.imc[_imc_key(m)] = (m["Entry"], src, x["m"].get("_imcGroup"))
                elif t == "Est":
                    race = RACE_OF[(m["Gender"], m["Race"])]
                    self.est[(m["Slot"], race, int(m["SetId"]))] = (int(m["Entry"]), src)
                elif t == "Gmp":
                    self.gmp[int(m["SetId"])] = (m["Entry"], src)
                else:
                    self.other.append({"type": t, "manip": m, "from": src})
            except (KeyError, ValueError) as e:
                self.other.append({"type": t, "manip": m, "from": src, "error": f"unreadable: {e}"})

    def eqp_entry(self, set_id, slot):
        """(this slot's bits of the EQP entry, source)"""
        if (set_id, slot) in self.eqp:
            v, src = self.eqp[(set_id, slot)]
            return v, f"mod: {src}"
        return vanilla_eqp(set_id) & EQP_MASK[slot], "game"

    def eqdp_bits(self, race, set_id, slot):
        """(material bit, model bit, source) for this race/set/slot."""
        acc = slot in ACCES
        sh = SLOT_SHIFT[slot]
        if (race, set_id, slot) in self.eqdp:
            v, src = self.eqdp[(race, set_id, slot)]
            src = f"mod: {src}"
        else:
            v, src = vanilla_eqdp(race, set_id, acc), "game"
        return bool(v >> sh & 1), bool(v >> (sh + 1) & 1), src

    def model_race(self, race, set_id, slot):
        """The race whose model the game loads (Penumbra's ResolveContext: own race if its EQDP model bit is set,
        else one Fallback() step if that race has the bit, else c0101), and the checks on the way."""
        if race == "c0101":
            return race, [{"race": race, "model": True, "material": True, "source": "c0101 always uses its own"}]
        chain = []
        for r in (race, FALLBACK.get(race)):
            if r is None or r == "c0101":
                break
            mat, mdl, src = self.eqdp_bits(r, set_id, slot)
            chain.append({"race": r, "model": mdl, "material": mat, "source": src})
            if mdl:
                return r, chain
        chain.append({"race": "c0101", "model": True, "material": True, "source": "final fallback"})
        return "c0101", chain

    def imc_entry(self, kind, primary, secondary, slot_index, variant, slot_name=None):
        path = imc_path(kind, primary, secondary)
        van = vanilla_imc(path, slot_index, variant)
        key = (kind, primary, secondary, variant, slot_name or "")
        hit = self.imc.get(key)
        if hit is None:
            for (k, p, s, v, sl), val in self.imc.items():
                if k == kind and p == primary and s == secondary and sl == (slot_name or "") and val[2] and val[2]["allVariants"]:
                    hit = val
                    break
        if hit is not None:
            entry, src, grp = hit
            e = dict(van or {})
            if grp and grp["onlyAttributes"] and van:
                e["AttributeMask"] = int(entry.get("AttributeMask", 0))
            else:
                e.update({k: int(v) for k, v in entry.items() if k in IMC_FIELDS})
            return e, f"mod: {src}", path
        return van, "game", path

    def est_entry(self, slot, race, set_id):
        if (slot, race, set_id) in self.est:
            v, src = self.est[(slot, race, set_id)]
            return v, f"mod: {src}"
        return vanilla_est(slot, race, set_id), "game"


def _imc_key(m):
    kind = {"Equipment": "equipment", "Accessory": "accessory", "Weapon": "weapon", "Monster": "monster",
            "DemiHuman": "demihuman"}[m["ObjectType"]]
    slot = m.get("EquipSlot", "Unknown")
    slot = SLOT_OF_NAME.get(slot, "") if kind in ("equipment", "accessory", "demihuman") else ""
    return (kind, int(m["PrimaryId"]), int(m.get("SecondaryId", 0)), int(m.get("Variant", 0)), slot)
