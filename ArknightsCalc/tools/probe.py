"""Print the shape of the downloaded Arknights tables (short output). Usage: python -I probe.py <raw folder>"""
import json, sys, os

raw = sys.argv[1]
def load(n):
    with open(os.path.join(raw, n), encoding="utf-8") as f:
        return json.load(f)

def short(v, depth=0, maxd=3):
    if isinstance(v, dict):
        if depth >= maxd:
            return "{%d keys}" % len(v)
        return "{" + ", ".join("%s: %s" % (k, short(x, depth + 1, maxd)) for k, x in list(v.items())[:14]) + ("..." if len(v) > 14 else "") + "}"
    if isinstance(v, list):
        if not v:
            return "[]"
        return "[%d x %s]" % (len(v), short(v[0], depth + 1, maxd))
    s = repr(v)
    return s if len(s) < 60 else s[:57] + "..."

ch = load("character_table.json")
print("chars", len(ch))
a = ch.get("char_103_angel") or next(iter(ch.values()))
print("keys", list(a.keys()))
for k in ("name", "rarity", "profession", "subProfessionId", "isNotObtainable", "displayNumber"):
    print(k, repr(a.get(k)))
print("phase0", short(a["phases"][0], 0, 4))
print("kf", json.dumps(a["phases"][-1]["attributesKeyFrames"][-1])[:600])
print("favor", json.dumps(a["favorKeyFrames"][-1])[:500])
print("pot", json.dumps(a["potentialRanks"])[:900])
print("skills", short(a["skills"], 0, 3))

sk = load("skill_table.json")
sid = a["skills"][-1]["skillId"]
s = sk[sid]
print("skill keys", list(s.keys()), "levels", len(s["levels"]))
print("skill lvl", json.dumps(s["levels"][-1])[:900])

ue = load("uniequip_table.json")
print("uniequip keys", list(ue.keys()))
ed = ue["equipDict"]
e0 = next(v for v in ed.values() if v.get("charId") == "char_103_angel" and "001" not in v["uniEquipId"])
print("equip", short(e0, 0, 1))
be = load("battle_equip_table.json")
b0 = be[e0["uniEquipId"]]
print("battle equip", json.dumps(b0["phases"][-1].get("attributeBlackboard"))[:300])

eh = load("enemy_handbook_table.json")
print("handbook keys", list(eh.keys())[:8])
hd = eh.get("enemyData", eh)
k0 = next(iter(hd))
print("handbook entry", k0, short(hd[k0], 0, 1))
db = load("enemy_database.json")
print("db keys", list(db.keys()))
en = db["enemies"]
print("enemies", len(en), short(en[0], 0, 2))
print("enemy lvl0", json.dumps(en[0]["Value"][0]["enemyData"]["attributes"])[:700])
print("enemy name", json.dumps(en[0]["Value"][0]["enemyData"]["name"]))
