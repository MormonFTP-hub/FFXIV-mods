"""Build workshop.json for the Materials tab: every Workshop recipe plus the best farming stages per material.

Inputs:
  <raw folder>      excel/building_data.json and excel/item_table.json (same GitHub tables as extract.py)
  <penguin folder>  Penguin Statistics API v2 saved as matrix.json (result/matrix?server=US), stages.json
                    (stages?server=US) and zones.json (zones), from https://penguin-stats.io/PenguinStats/api/v2/
Usage: python -I extract_workshop.py <raw folder> <penguin folder> <ArknightsCalc folder>
"""
import json, os, sys, time

raw, pg, out = sys.argv[1], sys.argv[2], sys.argv[3]
def load(folder, n):
    with open(os.path.join(folder, n), encoding="utf-8") as f:
        return json.load(f)

b = load(raw, "building_data.json")
items = load(raw, "item_table.json")["items"]
matrix = load(pg, "matrix.json")["matrix"]
stages = {s["stageId"]: s for s in load(pg, "stages.json")}
zones = {z["zoneId"]: z for z in load(pg, "zones.json")}
now = time.time() * 1000
MIN_RUNS = 300            # ignore drop rates measured on fewer runs than this
LMD = "4001"

def num(v, d=4):
    v = round(float(v), d)
    return int(v) if v == int(v) else v

def open_now(s):
    z = zones.get(s["zoneId"])
    if not z or z["type"] not in ("MAINLINE", "WEEKLY", "ACTIVITY_PERMANENT"):
        return False
    e = (s.get("existence") or {}).get("US") or {}
    if not e.get("exist"):
        return False
    if e.get("openTime") and e["openTime"] > now:
        return False
    if e.get("closeTime") and e["closeTime"] < now:
        return False
    return bool(s.get("apCost"))

def label(s):
    return s["code"] + (" (Adverse)" if s["stageId"].startswith("tough_") else "")

# recipes
recipes, used = [], set()
for f in sorted(b["workshopFormulas"].values(), key=lambda f: f["sortId"]):
    ins = [[c["id"], c["count"]] for c in f["costs"]]
    recipes.append({"id": f["formulaId"], "o": f["itemId"], "c": f["count"], "lmd": f["goldCost"],
                    "m": num(f["apCost"] / 360000, 2), "t": f["formulaType"][2:], "in": ins,
                    "x": num(f.get("extraOutcomeRate") or 0, 2)})
    used.add(f["itemId"])
    used.update(i for i, _ in ins)

# best stages per material: lowest Sanity per drop among stages open now
farm = {}
for r in matrix:
    if r["itemId"] not in used or not r["quantity"]:
        continue
    if r.get("end") and r["end"] < now:
        continue
    s = stages.get(r["stageId"])
    if not s or not open_now(s):
        continue
    # supply stages (SK and the like) have fixed drops, so far fewer reports are enough
    if r["times"] < (50 if zones[s["zoneId"]]["type"] == "WEEKLY" else MIN_RUNS):
        continue
    rate = r["quantity"] / r["times"]
    farm.setdefault(r["itemId"], []).append((s["apCost"] / rate, label(s), s["apCost"], rate))
out_items = {}
for i in sorted(used):
    best = sorted(farm.get(i, []))[:3]
    out_items[i] = {"n": items[i]["name"] if i in items else i, "r": {"TIER_1": 1, "TIER_2": 2, "TIER_3": 3, "TIER_4": 4, "TIER_5": 5}.get(str(items.get(i, {}).get("rarity")), 0),
                    "s": [[c, ap, num(rate)] for _, c, ap, rate in best]}

# LMD: the best CE stage, from its fixed drop
ce = []
for s in stages.values():
    if s["code"].startswith("CE-") and open_now(s):
        for d in s.get("dropInfos") or []:
            if d.get("itemId") == LMD and d.get("bounds"):
                avg = (d["bounds"]["lower"] + d["bounds"]["upper"]) / 2
                if avg:
                    ce.append((s["apCost"] / avg, s["code"], s["apCost"], avg))
ce.sort()
# The drop data does not list LMD amounts, so CE-6 is written in by hand: 10,000 LMD for 36 Sanity.
out_items[LMD] = {"n": "LMD", "r": 0, "s": [[c, ap, num(rate)] for _, c, ap, rate in ce[:1]] or [["CE-6", 36, 10000]]}

path = os.path.join(out, "workshop.json")
with open(path, "w", encoding="utf-8", newline="\n") as f:
    json.dump({"items": out_items, "recipes": recipes}, f, ensure_ascii=False, separators=(",", ":"))
print("workshop.json", len(recipes), "recipes", len(out_items), "items", os.path.getsize(path), "bytes")
print("LMD", out_items[LMD]["s"], "| CE candidates", [(c, ap, a) for _, c, ap, a in ce])
nofarm = [v["n"] for v in out_items.values() if not v["s"]]
print("no farming stage:", nofarm)
for nm in ("Carbon Stick", "Carbon Brick", "Carbon Pack", "Orirock Cube", "Orirock Cluster", "Polyester Pack", "Skill Summary - 3", "Keel"):
    hit = next((v for v in out_items.values() if v["n"] == nm), None)
    print(" ", nm, hit["s"] if hit else "not in recipes")
keel = next((v for v in items.values() if v["name"] == "Keel"), None)
if keel:
    print("Keel:", keel["itemId"], (keel.get("obtainApproach") or "")[:200], "|", (keel.get("usage") or "")[:160])
import collections
print(collections.Counter(r["t"] for r in recipes))
print([out_items[r["o"]]["n"] for r in recipes if r["t"] in ("ASC", "SKILL")])
