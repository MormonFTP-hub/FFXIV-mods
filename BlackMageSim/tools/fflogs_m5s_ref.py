"""Where real NA parties stand at M5S's key mechanics (the medians over the kills tools/fflogs_m5s.py fetched), for
checking the sim's spots against: writes js/fights/m5s_ref.js (BLM.FIGHT_REFS.m5s), which `/qa logs` compares the
bots with. Layouts are normalised the way the comparison normalises the sim: the twist's plays mirrored so the final
side is east, Frogtourage 1 turned so its corridor runs north-south with the main tank north.

  python BlackMageSim/tools/fflogs_m5s_ref.py
"""
import json
import math
import statistics as st
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fflogs_m5s import OUT  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SLOTS = ["MT", "OT", "H1", "H2", "M1", "M2", "R1", "R2"]
PURE, PHYS = {"WhiteMage", "Astrologian"}, {"Bard", "Machinist", "Dancer"}
kills = [json.loads(f.read_text()) for f in sorted(OUT.glob("*.json"))]


def volleys(hits, name, gap=1.0):
    ts, out = sorted({h["t"] for h in hits if h["name"] == name}), []
    for t in ts:
        if not out or t - out[-1][-1] > gap:
            out.append([t])
        else:
            out[-1].append(t)
    return [v[0] for v in out]


def at_time(k, pid, t, win=1.6):
    best, bd = None, win
    for h in k["hits"]:
        if h["who"] == pid and h["at"] and abs(h["t"] - t) < bd:
            best, bd = h["at"], abs(h["t"] - t)
    for row in k["track"].get(str(pid), []):
        if abs(row[0] - t) < bd:
            best, bd = row[1:], abs(row[0] - t)
    return best


def slots(k):
    P = {int(i): p for i, p in k["players"].items()}
    autos = defaultdict(int)
    for h in k["hits"]:
        if h["name"] == "Attack":
            autos[h["who"]] += 1
    tanks = sorted([i for i, p in P.items() if p["role"] == "tank"], key=lambda i: -autos[i])
    heal = [i for i, p in P.items() if p["role"] == "healer"]
    h1 = [i for i in heal if P[i]["job"] in PURE][:1] or heal[:1]
    rng = [i for i, p in P.items() if p["role"] in ("ranged", "caster")]
    r1 = [i for i in rng if P[i]["job"] in PHYS][:1] or rng[:1]
    melee = [i for i, p in P.items() if p["role"] == "melee"]
    s = {"MT": tanks[0] if tanks else None, "OT": tanks[1] if len(tanks) > 1 else None, "H1": h1[0] if h1 else None,
         "H2": next((i for i in heal if i not in h1), None), "R1": r1[0] if r1 else None, "R2": next((i for i in rng if i not in r1), None)}
    bv = volleys(k["hits"], "Play B-Side")
    m1 = melee[0] if melee else None
    if bv and s["MT"] and len(melee) == 2:
        pm = at_time(k, s["MT"], bv[0]) or [0, 0]
        m1 = min(melee, key=lambda m: math.dist(at_time(k, m, bv[0]) or [99, 99], pm))
    s["M1"], s["M2"] = m1, next((m for m in melee if m != m1), None)
    return s


def mirror_east(p):
    me = st.median(v[0] for v in p.values())
    return {s: [v[0] * (1 if me >= 0 else -1), v[1]] for s, v in p.items()}


def corridor_ns(p):
    if st.pstdev([v[0] for v in p.values()]) > st.pstdev([v[1] for v in p.values()]):
        p = {s: [v[1], -v[0]] for s, v in p.items()}
    if p["MT"][1] < 0:
        p = {s: [-v[0], -v[1]] for s, v in p.items()}
    return p


# name: (how to find its times in a kill, which occurrence, normalisation, the cactbot event the sim samples at)
MECHS = {
    "Celebrate Good Times": (lambda k: volleys(k["hits"], "Celebrate Good Times"), 0, None),
    "Deep Cut": (lambda k: volleys(k["hits"], "Deep Cut"), 0, None),
    "Play A-side": (lambda k: volleys(k["hits"], "Play A-Side"), 0, mirror_east),
    "Play B-side": (lambda k: volleys(k["hits"], "Play B-Side"), 0, mirror_east),
    "Frogtourage 1 spread": (lambda k: [t for t in volleys(k["hits"], "Eighth Beats") if 300 < t < 330], 0, corridor_ns),
    "Frogtourage 1 stack": (lambda k: [t for t in volleys(k["hits"], "Quarter Beats") if 300 < t < 330], 0, corridor_ns),
    "Back-Up Dance 1 (Disco 2)": (lambda k: volleys(k["hits"], "Back-Up Dance"), 0, None),
    "Back-Up Dance 3 (Frogtourage 2)": (lambda k: volleys(k["hits"], "Back-Up Dance"), 2, None),
    "Back-Up Dance 4 (Frogtourage 2)": (lambda k: volleys(k["hits"], "Back-Up Dance"), 3, None),
}


def main():
    ref = {}
    for name, (times, idx, norm) in MECHS.items():
        cols = defaultdict(list)
        for k in kills:
            ts = times(k)
            if len(ts) <= idx:
                continue
            sl = slots(k)
            p = {s: at_time(k, pid, ts[idx]) for s, pid in sl.items() if pid}
            if len(p) < 8 or any(v is None for v in p.values()):
                continue
            p = norm(p) if norm else p
            for s, v in p.items():
                cols[s].append(v)
        if cols:
            ref[name] = {"n": len(cols["MT"]), "spots": {s: [round(st.median(v[0] for v in cols[s]), 2), round(st.median(v[1] for v in cols[s]), 2),
                                                             round(st.median(math.dist(v, [st.median(x[0] for x in cols[s]), st.median(x[1] for x in cols[s])]) for v in cols[s]), 2)]
                                                         for s in SLOTS if cols[s]}}
    js = ("// Generated by tools/fflogs_m5s_ref.py from FFLogs' M5S kills: where each party spot really stood at each mechanic\n"
          "// (median east, north, and how far a typical player was from it). `/qa logs` compares the bots with these.\n"
          "window.BLM = window.BLM || {};\nBLM.FIGHT_REFS = BLM.FIGHT_REFS || {};\n"
          f"BLM.FIGHT_REFS.m5s = {json.dumps({'kills': len(kills), 'mechs': ref}, separators=(',', ':'))};\n")
    (ROOT / "js" / "fights" / "m5s_ref.js").write_text(js, encoding="utf-8")
    for name, r in ref.items():
        print(f"{name} (n {r['n']}): " + "  ".join(f"{s} {v[0]:.1f},{v[1]:.1f}" for s, v in r["spots"].items()))


if __name__ == "__main__":
    main()
