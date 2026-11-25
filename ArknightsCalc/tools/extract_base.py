"""Print the base (RIIC) data the Base tab uses, as one compact JSON object.

Needs excel/building_data.json and excel/item_table.json from the same GitHub tables as extract.py.
Usage: python -I extract_base.py <raw folder>      (paste the printed line into index.html as `const BASE=...`)
"""
import json, os, sys

raw = sys.argv[1]
def load(n):
    with open(os.path.join(raw, n), encoding="utf-8") as f:
        return json.load(f)

b = load("building_data.json")
items = load("item_table.json")["items"]
name = lambda i: items[i]["name"] if i in items else i

ROOMS = [("CONTROL", "Control Center"), ("TRADING", "Trading Post"), ("MANUFACTURE", "Factory"), ("POWER", "Power Plant"),
         ("DORMITORY", "Dormitory"), ("MEETING", "Reception Room"), ("WORKSHOP", "Workshop"), ("HIRE", "Office"),
         ("TRAINING", "Training Room")]
out = {"rooms": {}, "formulas": [], "drones": {}}
for key, label in ROOMS:
    r = b["rooms"][key]
    out["rooms"][key] = {"n": label, "max": r["maxCount"], "lv": [
        {"e": p["electricity"], "d": p["buildCost"]["labor"], "c": [[name(i["id"]), i["count"]] for i in p["buildCost"]["items"]],
         "s": p["maxStationedNum"]} for p in r["phases"]]}
for f in b["manufactFormulas"].values():
    out["formulas"].append({"n": name(f["itemId"]), "t": f["costPoint"], "k": f["formulaType"], "lv": f["requireRooms"][0]["roomLevel"] if f["requireRooms"] else 1,
                            "c": [[name(c["id"]), c["count"]] for c in f.get("costs") or []]})
for k in ("initMaxLabor", "laborRecoverTime", "manufactReduceTimeUnit", "manufactLaborCostUnit", "tradingReduceTimeUnit", "tradingLaborCostUnit"):
    out["drones"][k] = b.get(k)
print(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
if len(sys.argv) > 2:      # extra: show what else the table has
    for k in ("ELEVATOR", "CORRIDOR"):
        print(k, json.dumps([[p["buildCost"]["labor"], [[name(i["id"]), i["count"]] for i in p["buildCost"]["items"]]] for p in b["rooms"][k]["phases"]]))
    v0 = b["layouts"]["v0"]
    print("layout keys", list(v0.keys()))
    for k, v in v0.items():
        if isinstance(v, dict):
            first = next(iter(v.values()), None)
            print(" ", k, len(v), json.dumps(first)[:260])
    print("trading keys", [k for k in b.keys() if "rad" in k.lower() or "order" in k.lower() or "shop" in k.lower()])
