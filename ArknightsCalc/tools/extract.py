"""Build operators.json and enemies.json for the calculator from the game's data tables.

The tables come from https://github.com/Kengxxiao/ArknightsGameData_YoStar (en_US/gamedata):
  excel/character_table.json, excel/skill_table.json, excel/uniequip_table.json,
  excel/battle_equip_table.json, excel/enemy_handbook_table.json, levels/enemydata/enemy_database.json
Download them into one folder, then:  python -I extract.py <that folder> <ArknightsCalc folder>
"""
import json, os, re, sys

raw, out = sys.argv[1], sys.argv[2]

def load(n):
    with open(os.path.join(raw, n), encoding="utf-8") as f:
        return json.load(f)

CLASS = {"PIONEER": "Vanguard", "WARRIOR": "Guard", "TANK": "Defender", "SNIPER": "Sniper",
         "CASTER": "Caster", "MEDIC": "Medic", "SUPPORT": "Supporter", "SPECIAL": "Specialist"}

def num(v):
    v = round(float(v), 4)
    return int(v) if v == int(v) else v

def rarity(r):
    if isinstance(r, str):
        return int(r.rsplit("_", 1)[-1])
    return int(r) + 1

TAG = re.compile(r"<[@$][^>]*>|</>")
SLOT = re.compile(r"\{(-?)([^}:]+?)(?::([^}]+))?\}")

def render(desc, bb):
    """Fill a skill description's {key:format} slots from its blackboard."""
    vals = {b["key"].lower(): b.get("value") for b in bb if b.get("key")}
    def sub(m):
        neg, key, fmt = m.group(1), m.group(2).strip().lower(), m.group(3) or ""
        if key not in vals or vals[key] is None:
            return m.group(0)
        v = float(vals[key]) * (-1 if neg else 1)
        dec = len(fmt.split(".")[1].rstrip("%")) if "." in fmt else 0
        if "%" in fmt:
            return ("%." + str(dec) + "f%%") % (v * 100)
        if fmt:
            return ("%." + str(dec) + "f") % v
        return str(num(v))
    return SLOT.sub(sub, TAG.sub("", desc or "")).replace("\\n", " ").replace("\n", " ").strip()

def mods(buff):
    atk = aspd = 0
    if buff and buff.get("attributes"):
        for m in buff["attributes"].get("attributeModifiers") or []:
            t = m.get("attributeType")
            if t in ("ATK", 1):
                atk += m["value"]
            elif t in ("ATTACK_SPEED", 7):
                aspd += m["value"]
    return atk, aspd

chars, skills = load("character_table.json"), load("skill_table.json")
uni, battle = load("uniequip_table.json"), load("battle_equip_table.json")

modules = {}
for eid, e in uni["equipDict"].items():
    b = battle.get(eid)
    if not b:
        continue
    atk, spd = [], []
    for ph in b["phases"]:
        bb = {x["key"]: x["value"] for x in ph.get("attributeBlackboard") or []}
        atk.append(num(bb.get("atk", 0)))
        spd.append(num(bb.get("attack_speed", 0)))
    code = (e.get("typeIcon") or "").upper()
    modules.setdefault(e["charId"], []).append({"n": (code + " " + (e.get("uniEquipName") or "")).strip(), "a": atk, "s": spd})

ops = []
for cid, c in chars.items():
    if c.get("profession") not in CLASS or c.get("isNotObtainable") or not c.get("phases"):
        continue
    phases = []
    for ph in c["phases"]:
        kf = ph["attributesKeyFrames"]
        a, b = kf[0]["data"], kf[-1]["data"]
        phases.append([ph["maxLevel"], num(a["atk"]), num(b["atk"]), num(b["baseAttackTime"]), num(b["attackSpeed"])])
    fav = c.get("favorKeyFrames") or []
    pots = [list(map(num, mods(p.get("buff")))) for p in c.get("potentialRanks") or []]
    sk = []
    for s in c.get("skills") or []:
        t = skills.get(s.get("skillId") or "")
        if not t:
            continue
        lv = t["levels"]
        picks = [("Level 7", 6)] + ([("Mastery 3", 9)] if len(lv) >= 10 else [])
        levels = []
        for label, i in picks:
            if i >= len(lv):
                continue
            L = lv[i]
            bb = {x["key"].lower(): x.get("value") for x in L.get("blackboard") or []}
            fill = {}
            if bb.get("atk"):
                fill["atk"] = num(bb["atk"] * 100)
            sc = bb.get("atk_scale") or bb.get("attack@atk_scale")
            if sc:
                fill["scale"] = num(sc * 100)
            if bb.get("attack_speed"):
                fill["aspd"] = num(bb["attack_speed"])
            tm = bb.get("attack@times") or bb.get("times")
            if tm and 1 < tm <= 20 and tm == int(tm):
                fill["hits"] = int(tm)
            levels.append({"k": label, "d": render(L.get("description"), L.get("blackboard") or []),
                           "t": num(max(0, L.get("duration") or 0)), "f": fill})
        if levels:
            sk.append({"n": lv[0]["name"], "l": levels})
    ops.append({"id": cid, "n": (c.get("name") or "").strip(), "r": rarity(c["rarity"]), "c": CLASS[c["profession"]],
                "p": phases, "t": num(fav[-1]["data"]["atk"]) if fav else 0, "o": pots,
                "m": modules.get(cid, []), "s": sk})

# make names unique: same-name forms get their class added
seen = {}
for o in ops:
    seen.setdefault(o["n"], []).append(o)
for name, group in seen.items():
    if len(group) > 1:
        for o in group:
            o["n"] = "%s (%s)" % (name, o["c"])
ops.sort(key=lambda o: (-o["r"], o["n"]))

# Base skills for Trading Posts and Factories (excel/building_data.json), for the Base tab.
PHASE = {"PHASE_0": 0, "PHASE_1": 1, "PHASE_2": 2}
LEAD = re.compile(r"^When this Operator is assigned to (?:a|an|the) [A-Za-z ]+?,\s*", re.I)
COND = re.compile(r"for every|for each|per |up to|if |when |with |other|increase|decrease|convert|considered", re.I)

def base_value(text, eff):
    if re.search(r"productivity|efficiency", text, re.I):
        m = re.search(r"up to \+?(\d+(?:\.\d+)?)%", text, re.I)
        if m:
            return float(m.group(1))
    if eff:
        return float(eff)
    m = (re.search(r"(?:productivity|efficiency)\s*\+(\d+(?:\.\d+)?)%", text, re.I)
         or re.search(r"\+(\d+(?:\.\d+)?)%\s*(?:productivity|order acquisition efficiency)", text, re.I))
    return float(m.group(1)) if m else 0.0

bpath = os.path.join(raw, "building_data.json")
if os.path.exists(bpath):
    bd = load("building_data.json")
    rows = []
    for o in ops:
        c = bd["chars"].get(o["id"])
        if not c:
            continue
        sk = []
        for slot, s in enumerate(c.get("buffChar") or []):
            for x in s.get("buffData") or []:
                b = bd["buffs"].get(x["buffId"])
                if not b or b["roomType"] not in ("TRADING", "MANUFACTURE"):
                    continue
                text = TAG.sub("", b["description"]).replace("\n", " ").strip()
                tag = ("rec" if re.search(r"Battle Record", text, re.I) else
                       "gold" if re.search(r"Precious Metal|Pure Gold", text, re.I) else
                       "shard" if re.search(r"Originium", text, re.I) else "all")
                row = {"k": slot, "g": b["roomType"][0], "e": PHASE.get(x["cond"]["phase"], 0), "n": b["buffName"],
                       "d": text, "v": num(base_value(text, b.get("efficiency"))), "t": tag}
                if COND.search(LEAD.sub("", text)) or "the same" in text:
                    row["q"] = 1
                sk.append(row)
        if sk:
            rows.append({"n": o["n"], "r": o["r"], "s": sk})
    path = os.path.join(out, "baseskills.json")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows) + "\n]\n")
    alls = [s for r in rows for s in r["s"]]
    print("baseskills.json", len(rows), "operators", len(alls), "skills", os.path.getsize(path), "bytes;",
          sum(1 for s in alls if s["v"] == 0), "with no number,", sum(1 for s in alls if s.get("q")), "flagged to check")
    for nm in ("Exusiai", "Texas", "Gravel", "Vermeil", "Ptilopsis"):
        r = next((r for r in rows if r["n"] == nm), None)
        print(" ", nm, json.dumps(r["s"] if r else None)[:420])

for o in ops:
    del o["id"]

hand = load("enemy_handbook_table.json")
hand = hand.get("enemyData", hand)
db = load("enemy_database.json")["enemies"]
ATTR = ("maxHp", "atk", "def", "magicResistance")

def val(x):
    if isinstance(x, dict):
        return x.get("m_value") if x.get("m_defined") else None
    return x

enemies = []
for e in db:
    h = hand.get(e["Key"])
    if not h or h.get("hideInHandbook"):
        continue
    levels, prev, name = [], [0, 0, 0, 0], None
    for lv in e["Value"]:
        d = lv["enemyData"]
        name = name or val(d.get("name"))
        cur = []
        for i, k in enumerate(ATTR):
            v = val(d["attributes"].get(k))
            cur.append(num(v) if v is not None else prev[i])
        prev = cur
        levels.append(cur)
    enemies.append({"n": (h.get("name") or name or e["Key"]).strip(), "i": h.get("enemyIndex") or "",
                    "k": (h.get("enemyLevel") or "").title(), "l": levels})
seen = {}
for e in enemies:
    seen.setdefault(e["n"], []).append(e)
for name, group in seen.items():
    if len(group) > 1:
        for e in group:
            e["n"] = "%s [%s]" % (name, e["i"]) if e["i"] else name
enemies.sort(key=lambda e: e["n"].lower())

def write(name, rows):
    path = os.path.join(out, name)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows) + "\n]\n")
    print(name, len(rows), "rows", os.path.getsize(path), "bytes")

write("operators.json", ops)
write("enemies.json", enemies)
ex = next(o for o in ops if o["n"] == "Exusiai")
print(json.dumps(ex)[:900])
print(json.dumps(next((e for e in enemies if e["l"] and len(e["l"]) > 1), enemies[0]))[:300])
print("unfilled slots:", sum(1 for o in ops for s in o["s"] for l in s["l"] if "{" in l["d"]))
print("same-name enemies left:", len(enemies) - len({e["n"] for e in enemies}))
