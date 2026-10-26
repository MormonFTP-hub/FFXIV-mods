"""What a mod touches: equipment sets per slot, human parts, monsters, demihumans and weapons, read from its game
paths and manipulations, plus the in-game items that use those models. Used to pick a sensible preview."""
import re
from collections import defaultdict

import game
import meta as M

SLOT_CAT = {3: ["met"], 4: ["top"], 5: ["glv"], 7: ["dwn"], 8: ["sho"], 9: ["ear"], 10: ["nek"], 11: ["wrs"],
            12: ["rir", "ril"], 15: ["top"], 16: ["top"], 18: ["dwn"], 19: ["top"], 20: ["top"], 21: ["top"]}
CAT_NAME = {1: "Main hand", 2: "Off hand", 13: "Two-handed", 3: "Head", 4: "Body", 5: "Hands", 7: "Legs", 8: "Feet",
            9: "Ears", 10: "Neck", 11: "Wrists", 12: "Ring", 15: "Body (no head)", 16: "Body (full)", 18: "Legs + feet",
            19: "Full outfit", 20: "Body + hands + legs", 21: "Body + legs + feet"}

P_EQUIP = re.compile(r"chara/(equipment|accessory)/([ea])(\d{4})/(?:model/(c\d{4})[ea]\d{4}_(\w{3})\.mdl|material/v(\d{4})/mt_c\d{4}[ea]\d{4}_(\w{3})_|texture/)")
P_HUMAN = re.compile(r"chara/human/(c\d{4})/obj/(face|hair|tail|zear|body)/([fhtzb])(\d{4})/")
P_MON = re.compile(r"chara/monster/m(\d{4})/obj/body/b(\d{4})/")
P_DEMI = re.compile(r"chara/demihuman/d(\d{4})/obj/equipment/e(\d{4})/(?:model/d\d{4}e\d{4}_(\w{3})\.mdl)?")
P_WEAP = re.compile(r"chara/weapon/w(\d{4})/obj/body/b(\d{4})/")


def scan(resolved_all):
    """resolved_all: a Resolved with every option enabled (so nothing is missed)."""
    equip = defaultdict(lambda: {"slots": set(), "races": set(), "variants": set(), "files": 0})
    human = defaultdict(lambda: {"ids": set(), "files": 0})
    creatures = defaultdict(lambda: {"slots": set(), "files": 0})
    paths = list(resolved_all.files) + list(resolved_all.swaps)
    for gp in paths:
        m = P_EQUIP.match(gp)
        if m:
            kind, letter, sid, race, slot, ver, mslot = m.groups()
            t = equip[(kind, int(sid))]
            t["files"] += 1
            if slot:
                t["slots"].add(slot)
                t["races"].add(race)
            if ver:
                t["variants"].add(int(ver))
                t["slots"].add(mslot)
            continue
        m = P_HUMAN.match(gp)
        if m:
            race, kind, _, pid = m.groups()
            human[(race, kind)]["ids"].add(int(pid))
            human[(race, kind)]["files"] += 1
            continue
        for pat, kind in ((P_MON, "monster"), (P_DEMI, "demihuman"), (P_WEAP, "weapon")):
            m = pat.match(gp)
            if m:
                g = m.groups()
                t = creatures[(kind, int(g[0]), int(g[1]))]
                t["files"] += 1
                if kind == "demihuman" and g[2]:
                    t["slots"].add(g[2])
                break
    for x in resolved_all.manips:
        mm, t = x["m"].get("Manipulation") or {}, x["m"].get("Type")
        if t in ("Eqp", "Eqdp") and mm.get("Slot") in M.SLOT_OF_NAME:
            slot = M.SLOT_OF_NAME[mm["Slot"]]
            kind = "accessory" if slot in M.ACCES else "equipment"
            equip[(kind, int(mm["SetId"]))]["slots"].add(slot)
    out = {"equipment": [], "human": [], "creatures": []}
    items = game.items()
    for (kind, sid), t in sorted(equip.items(), key=lambda kv: -kv[1]["files"]):
        if sid == 0 and not t["slots"]:
            continue
        names = []
        for it in items:
            cats = SLOT_CAT.get(it["slot"])
            if not cats:
                continue
            if (it["model"] & 0xFFFF) == sid and (set(cats) & t["slots"]) and \
                    (cats[0] in M.ACCES) == (kind == "accessory"):
                names.append({"id": it["id"], "name": it["name"], "slot": cats[0], "variant": (it["model"] >> 16) & 0xFFFF})
        out["equipment"].append({"kind": kind, "set": sid, "slots": sorted(t["slots"], key=_slot_order),
                                 "races": sorted(t["races"]), "materialSets": sorted(t["variants"]),
                                 "files": t["files"], "items": names[:40]})
    for (race, kind), t in sorted(human.items()):
        out["human"].append({"race": race, "kind": kind, "ids": sorted(t["ids"]), "files": t["files"]})
    for (kind, pid, sid), t in sorted(creatures.items(), key=lambda kv: -kv[1]["files"]):
        out["creatures"].append({"kind": kind, "id": pid, "body": sid, "slots": sorted(t["slots"]), "files": t["files"]})
    return out


def _slot_order(s):
    order = M.EQUIP + M.ACCES
    return order.index(s) if s in order else 99


def default_subject(t):
    """A first preview: wear every equipment set the mod changes, as the first race it ships models for."""
    eq = [e for e in t["equipment"] if e["slots"]]
    if eq:
        gear = {}
        for e in eq:
            for s in e["slots"]:
                if s in gear:
                    continue
                variant = 1
                for it in e["items"]:
                    if it["slot"] == s or (s in ("rir", "ril") and it["slot"] == "rir"):
                        variant = it["variant"]
                        break
                gear[s] = [e["set"], variant]
        races = [r for e in eq for r in e["races"]]
        race = "c0101" if "c0101" in races or not races else races[0]
        return {"subject": "character", "race": race, "gear": gear, "face": 1, "hair": 1}
    hu = t["human"]
    if hu:
        h = hu[0]
        spec = {"subject": "character", "race": h["race"], "gear": {}, "face": 1, "hair": 1}
        key = {"face": "face", "hair": "hair", "tail": "tail", "zear": "ear", "body": "body"}[h["kind"]]
        spec[key] = h["ids"][0]
        return spec
    if t["creatures"]:
        c = t["creatures"][0]
        return {"subject": c["kind"], "kind": c["kind"], "id": c["id"], "body": c["body"], "variant": 1}
    return {"subject": "character", "race": "c0101", "gear": {}, "face": 1, "hair": 1}
