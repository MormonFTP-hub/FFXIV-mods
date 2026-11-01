"""Builds Mit Plan's fight files (MitPlan/Plans/*.json) from the NA community mit sheets.

Sources (all public Google Sheets, read as CSV):
  Dancing Mad (Ultimate)   Ikuya Kirishima's "Ikuya Mit", the sheet NAUR lists for DMU
  Futures Rewritten        Fae Nightwolf & Valiaa Masume's "FRU Mit But Good", the one NAUR says NA PF tanks use
  M9S-M12S                 Silacy Alaseia's AAC Heavyweight mitsheet, phases from Exia's DT raid timeline sheet

Boss cast names for the in-game follow mode come from cactbot's timelines (github.com/OverlayPlugin/cactbot,
Apache-2.0): each hit gets the casts that start it, checked against the names the game actually uses.

    python tools/build_plans.py            use cached sheets in work/sheets, fetch what's missing
    python tools/build_plans.py --refresh  fetch every sheet again
"""
import csv
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "MitPlan" / "Plans"
WORK = ROOT / "work"
SIM_TIMELINES = ROOT.parent / "BlackMageSim" / "work" / "timelines"
REFRESH = "--refresh" in sys.argv

IKUYA = "10C3ytfH3irHqkb45rchIq5oqdAs-v_OKTj57M-Twi3k"
FMBG = "1M1LHe4mpb1lyxkLWJxrDwe_JH897nickG3XLTtwnI90"
SILACY = "1Pf2skmZvjjW-_lA5wwS8U0wHny5txsvRjPPw_4kg9cY"
EXIA = "1oG1SwNQ_Ncz2-1pOZrE9Y_A-2yECKD2ULNGpwvKtKho"

SUPERSCRIPTS = "¹²³⁴⁵⁶⁷⁸⁹⁰"


# ---------------------------------------------------------------- fetching

def sheet(doc, gid, name):
    path = WORK / "sheets" / f"{name}.csv"
    if REFRESH or not path.exists():
        url = f"https://docs.google.com/spreadsheets/d/{doc}/export?format=csv&gid={gid}"
        path.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url, timeout=30) as r:
            path.write_bytes(r.read())
        print(f"  fetched {name}")
    return list(csv.reader(io.StringIO(path.read_text(encoding="utf-8"))))


def cactbot(name):
    """Every ability name in a cactbot timeline, split into the separate names the game uses."""
    path = SIM_TIMELINES / f"{name.replace('/', '_')}.txt"
    if not path.exists():
        path = WORK / "timelines" / f"{name.replace('/', '_')}.txt"
        if REFRESH or not path.exists():
            url = f"https://raw.githubusercontent.com/OverlayPlugin/cactbot/main/ui/raidboss/data/{name}.txt"
            path.parent.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(url, timeout=30) as r:
                path.write_bytes(r.read())
    names = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r'^\s*[\d.]+\s+"([^"]+)"', line)
        if not m or m.group(1).startswith("--"):
            continue
        for part in re.sub(r"\s*\([^)]*\)", "", m.group(1)).split("/"):
            part = re.sub(r"\s+x\d+$", "", part.strip().rstrip("?"))
            if part:
                names.add(part)
    return names


# ---------------------------------------------------------------- cell parsing

def secs(text):
    m = re.match(r"^\s*(\d+):(\d\d)", text or "")
    return int(m.group(1)) * 60 + int(m.group(2)) if m else None


def split_items(line, seps):
    """Splits a cell line on the sheet's separators, but never inside brackets."""
    items, depth, cur, i = [], 0, "", 0
    while i < len(line):
        ch = line[i]
        depth += ch == "("
        depth -= ch == ")"
        hit = next((s for s in seps if depth == 0 and line.startswith(s, i)), None)
        if hit:
            items.append(cur)
            cur, i = "", i + len(hit)
            continue
        cur += ch
        i += 1
    items.append(cur)
    return [re.sub(r"\s+", " ", x).strip() for x in items if x.strip()]


def cell(text, seps=(" + ",)):
    """A sheet cell as lines of items. A line starting with ➔ is mitigation carried over from the hit above."""
    lines = []
    for raw in (text or "").replace("\r", "").split("\n"):
        raw = raw.strip()
        if not raw:
            continue
        if raw.startswith("+") and lines:
            lines[-1]["items"] += split_items(raw[1:], seps)
            continue
        carry = raw.startswith("➔")
        items = split_items(raw.lstrip("➔ ").strip(), seps)
        if items:
            lines.append({"carry": carry, "items": items} if carry else {"items": items})
    return lines


def note_lines(text):
    out = []
    for line in (text or "").replace("\r", "").split("\n"):
        line = line.strip()
        if line:
            out.append(line)
    return out


# ---------------------------------------------------------------- boss cast names

def norm(s):
    """A cast name as Mit Plan compares them: letters only, no trailing number (the plugin does the same)."""
    s = re.sub(r"(\s+([0-9]+|[ivx]+))+$", "", s.lower().strip())
    return re.sub(r"[^a-z]", "", s.replace("judgement", "judgment"))


def close(a, b):
    """True when two names are the same apart from one typo (sheets misspell boss names)."""
    if a == b:
        return True
    if min(len(a), len(b)) < 8 or abs(len(a) - len(b)) > 1:
        return False
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        row = [i]
        for j, cb in enumerate(b, 1):
            row.append(min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = row
    return prev[-1] <= 1


def sync_names(hit_name, casts):
    """The boss casts a sheet row is named after, as the game spells them."""
    name = re.sub(r"\([^)]*\)", " ", hit_name)
    name = re.sub(SUPERSCRIPT_RE, "", name)
    parts = re.split(r"\s*(?:\+|>|/|&|\bthen\b)\s*", name)
    found = []
    for part in parts:
        part = re.sub(r"\b(x\d+|\d+(st|nd|rd|th)?|#\d+|[IVX]+|set|sets|hits?|start|end|cast|part)\b", " ", part, flags=re.I)
        part = re.sub(r"\s+", " ", part).strip(" -:")
        if len(part) < 4:
            continue
        p = norm(part)
        best = next((c for c in sorted(casts) if norm(c) == p), None)
        best = best or next((c for c in sorted(casts) if close(p, norm(c))), None)
        if not best and len(p) >= 5:
            # "Screech" for Sadistic Screech: a whole-word end or start of exactly one cast name.
            def ends(c):
                words = c.lower().split()
                return p in {norm(" ".join(words[k:])) for k in range(len(words))} | {norm(" ".join(words[:k + 1])) for k in range(len(words))}
            hits = sorted({c for c in casts if ends(c)}, key=norm)
            hits = list({norm(c): c for c in hits}.values())
            best = hits[0] if len(hits) == 1 else None
        if best:
            best = re.sub(r"(\s+([0-9]+|[IVX]+))+$", "", best) if norm(best) == norm(re.sub(r"(\s+([0-9]+|[IVX]+))+$", "", best)) else best
        if best and best not in found:
            found.append(best)
    return found


SUPERSCRIPT_RE = f"[{SUPERSCRIPTS}*]+"


# ---------------------------------------------------------------- Ikuya (Dancing Mad)

def build_ikuya():
    tabs = [(161526414, "p1"), (583362985, "p2"), (247845947, "p3"), (2072785902, "p4"), (696382883, "p5")]
    keys = {"MT": "MT", "OT": "OT", "White Mage": "WHM", "Astrologian": "AST", "Scholar": "SCH", "Sage": "SGE",
            "D1": "D1", "D2": "D2", "D3": "D3", "D4": "D4", "Extras": "Extras"}
    casts = cactbot("07-dt/ultimate/dancing_mad")
    changelog = sheet(IKUYA, 1790462410, "dmu_changelog")
    version = next((c.strip() for r in changelog for c in r if c.strip().startswith("Version ")), "")
    phases = []
    for gid, tab in tabs:
        rows = sheet(IKUYA, gid, f"dmu_{tab}")
        title = next(c.strip() for r in rows for c in r if re.match(r"^Phase \d", c.strip()))
        head = next(i for i, r in enumerate(rows) if "MT" in r and "OT" in r)
        cols = {keys[c.strip()]: j for j, c in enumerate(rows[head]) if c.strip() in keys}
        tcol = rows[head].index("Time")
        hits, notes = [], []
        for r in rows[head + 1:]:
            name = r[1].strip() if len(r) > 1 else ""
            if not name:
                continue
            name = name.replace("Embrance", "Embrace").replace("\n", " ")
            name = re.sub(r"\s+", " ", name)
            if name == "Notes":
                notes += note_lines(r[tcol])
                continue
            when = r[tcol].strip()
            if secs(when) is None:
                # A row of instructions rather than a hit (e.g. Accretions, how to play Forsaken).
                hits.append({"name": name, "info": note_lines(when)})
                continue
            hit = {"name": name, "time": when, "t": secs(r[tcol + 1]) if secs(r[tcol + 1]) is not None else secs(when)}
            if r[tcol + 1].strip() and r[tcol + 1].strip() != when:
                hit["fightTime"] = when
                hit["time"] = r[tcol + 1].strip()
            hit["cells"] = {k: cell(r[j]) for k, j in cols.items() if cell(r[j])}
            hit["sync"] = sync_names(name, casts)
            hits.append(hit)
        n = re.match(r"Phase (\d+): (.*)", title)
        phases.append({"name": f"P{n.group(1)} · {n.group(2)}", "clock": f"p{n.group(1)}", "hits": hits, "notes": notes})

    # Ikuya's Omnitank tab: personal tank cooldowns by hit, as its own section per phase.
    omni = sheet(IKUYA, 1548551521, "dmu_omnitank")
    tank_notes = parse_omnitank(omni)
    return {
        "id": "dmu",
        "name": "Dancing Mad (Ultimate)",
        "short": "DMU",
        "duties": ["Dancing Mad (Ultimate)"],
        "source": {"title": "Ikuya Mit", "author": "Ikuya Kirishima", "version": version,
                   "url": "https://tinyurl.com/ikuyamittydmu", "via": "NAUR · naurffxiv.com/ultimate/kefka"},
        "about": ["All mechanics require shields.", "Times are phase times (fight time in the tooltip)."],
        "slots": [
            {"key": "MT", "label": "MT", "role": "tank"},
            {"key": "OT", "label": "OT", "role": "tank"},
            {"key": "WHM", "label": "White Mage", "jobs": ["WHM"]},
            {"key": "AST", "label": "Astrologian", "jobs": ["AST"]},
            {"key": "SCH", "label": "Scholar", "jobs": ["SCH"]},
            {"key": "SGE", "label": "Sage", "jobs": ["SGE"]},
            {"key": "D1", "label": "D1 (melee)", "role": "melee"},
            {"key": "D2", "label": "D2 (melee)", "role": "melee"},
            {"key": "D3", "label": "D3 (ranged)", "role": "ranged"},
            {"key": "D4", "label": "D4 (caster)", "role": "caster"},
            {"key": "Extras", "label": "Extras", "role": "extras"},
        ],
        "phases": phases,
        "tankCooldowns": tank_notes,
    }


def parse_omnitank(rows):
    """Ikuya's per-phase tank cooldown tables (personal mits, invulns, provokes)."""
    out, cur = [], None
    for r in rows:
        cells = [c.strip() for c in r]
        title = next((c for c in cells if re.match(r"^(Phase \d|P\d)", c)), None)
        if title and len([c for c in cells if c]) == 1:
            cur = {"phase": title, "columns": [], "rows": [], "notes": []}
            out.append(cur)
            continue
        if cur is None:
            continue
        if len(cells) > 3 and cells[3] == "Time":
            cur["columns"] = [c for c in cells[4:] if c]
            continue
        if len(cells) > 1 and cells[1] == "Notes":
            cur["notes"] = note_lines(r[3])
            continue
        if len(cells) > 1 and cells[1] and cur["columns"]:
            vals = [c for c in r[4:]]
            mt = vals[0] if vals else ""
            ot = vals[4] if len(vals) > 4 else ""
            cur["rows"].append({"name": re.sub(r"\s+", " ", cells[1]), "time": cells[3],
                                "a": cell(mt), "b": cell(ot)})
    return out


# ---------------------------------------------------------------- FMBG (Futures Rewritten)

def build_fmbg():
    tabs = [(598251485, "p1"), (370065642, "p2"), (810381878, "p3"), (1274743541, "p4"), (69044699, "p5")]
    keys = {"Tank 1": "MT", "Tank 2": "OT", "Scholar": "SCH", "Sage": "SGE", "White Mage": "WHM", "Astro": "AST",
            "Melee 1": "D1", "Melee 2": "D2", "Phys Range": "D3", "Caster": "D4", "Extras": "Extras"}
    casts = cactbot("07-dt/ultimate/futures_rewritten")
    phases = []
    for gid, tab in tabs:
        rows = sheet(FMBG, gid, f"fru_{tab}")
        title, cur, cols, ncol, prefix = None, None, {}, 1, ""
        for i, r in enumerate(rows):
            cells = [c.strip() for c in r]
            filled = [c for c in cells if c]
            if len(filled) == 1 and len(filled[0]) > 3 and filled[0] not in ("Lingering Mits", "Conditional Mits") and cur is None:
                title = filled[0]
                continue
            if "Tank 1" in cells:
                cols = {keys[c]: j for j, c in enumerate(cells) if c in keys}
                ncol = cells.index("Tank 1") - 1
                m = re.match(r"^(P\d): (.*)", title or "")
                if m:
                    prefix = m.group(1)
                    name = f"{m.group(1)} · {m.group(2)}"
                else:
                    name = f"{prefix} · {title}"
                cur = {"name": name, "clock": prefix.lower(), "hits": [], "notes": []}
                phases.append(cur)
                continue
            if cur is None:
                continue
            name = cells[ncol] if len(cells) > ncol else ""
            if name == "Notes":
                cur["notes"] = note_lines(r[ncol + 1])
                cur = None
                continue
            if not name and cells and secs(cells[0]) is not None and cur["hits"]:
                cur["hits"][-1]["time"] = cells[0]
                cur["hits"][-1]["t"] = secs(cells[0])
                continue
            if not name:
                continue
            hit = {"name": name, "cells": {}}
            for k, j in cols.items():
                text = r[j].replace("Seraph/ism", "Seraph/Seraphism")
                c = cell(text, seps=("/",))
                if c:
                    hit["cells"][k] = c
            hit["sync"] = sync_names(name, casts)
            cur["hits"].append(hit)
    return {
        "id": "fru",
        "name": "Futures Rewritten (Ultimate)",
        "short": "FRU",
        "duties": ["Futures Rewritten (Ultimate)"],
        "source": {"title": "FRU Mit But Good", "author": "Fae Nightwolf & Valiaa Masume",
                   "url": "http://mit.lesb.in/", "via": "NAUR · naurffxiv.com/ultimate/fru"},
        "about": ["The sheet NAUR says NA PF tanks use; party mits are mix and match.",
                  "Slashes in the sheet mean \"and\": each one is a separate button."],
        "slots": [
            {"key": "MT", "label": "Tank 1", "role": "tank"},
            {"key": "OT", "label": "Tank 2", "role": "tank"},
            {"key": "WHM", "label": "White Mage", "jobs": ["WHM"]},
            {"key": "AST", "label": "Astrologian", "jobs": ["AST"]},
            {"key": "SCH", "label": "Scholar", "jobs": ["SCH"]},
            {"key": "SGE", "label": "Sage", "jobs": ["SGE"]},
            {"key": "D1", "label": "Melee 1", "role": "melee"},
            {"key": "D2", "label": "Melee 2", "role": "melee"},
            {"key": "D3", "label": "Phys Range", "role": "ranged"},
            {"key": "D4", "label": "Caster", "role": "caster"},
            {"key": "Extras", "label": "Extras", "role": "extras"},
        ],
        "phases": phases,
    }


# ---------------------------------------------------------------- Silacy (M9S-M12S)

SAVAGE = [
    # id, name, duty, cactbot timeline, [(silacy gid, clock, [(phase name, start s)])]
    ("m9s", "M9S · Vamp Fatale", "AAC Heavyweight M1 (Savage)", "07-dt/raid/r9s",
     [(871196336, "fight", [("It's A10 Again", 0), ("More Buzz Saws", 147), ("Hell in a Cell", 365)])]),
    ("m10s", "M10S · Red Hot and Deep Blue", "AAC Heavyweight M2 (Savage)", "07-dt/raid/r10s",
     [(984942427, "fight", [("1 on 1", 0), ("Insane Air", 152), ("Snaking", 238), ("Xtreme Waves", 328),
                            ("Tubular", 409), ("Xtreme Snaking", 463)])]),
    ("m11s", "M11S · The Tyrant", "AAC Heavyweight M3 (Savage)", "07-dt/raid/r11s",
     [(65834755, "fight", [("Toy Weapons", 0), ("Charybdistopia", 174), ("Meteorain", 262),
                           ("Majestic Meteor", 357), ("Ecliptic Stampede", 476)])]),
    ("m12s", "M12S · Lindwurm", "AAC Heavyweight M4 (Savage)", "07-dt/raid/r12s",
     [(1056663241, "door", [("Door · Act 1", 0), ("Door · Act 2", 117), ("Door · Act 3", 183), ("Door · Curtain Call", 250)]),
      (1402650805, "final", [("Final · Replication 1", 0), ("Final · Replication 2", 88), ("Final · Blood Mana", 181),
                             ("Final · Idyllic Dream", 241)])]),
]

# Casts that start a part of a fight with no sheet row named after them (the clock syncs to them).
SAVAGE_EXTRA_SYNC = {
    ("m12s", "final", "Prepull"): [{"name": "Arcadia Aflame", "at": 15}],
}


def build_silacy():
    plans = []
    for pid, name, duty, tl, parts in SAVAGE:
        casts = cactbot(tl)
        phases, notes = [], []
        enrage = None
        for gid, clock, bounds in parts:
            rows = sheet(SILACY, gid, f"{pid}_{clock}")
            head = rows[0]
            cols = {c.strip(): j for j, c in enumerate(head) if c.strip() in ("MT", "OT", "Pure", "Shield", "M1", "M2", "R1", "R2", "Parking Lot")}
            part = [{"name": b[0], "clock": clock, "start": b[1], "hits": [], "notes": []} for b in bounds]
            in_notes = False
            for r in rows[1:]:
                when, label = r[0].strip(), (r[1].strip() if len(r) > 1 else "")
                if when.lower().startswith("enrage"):
                    enrage = (re.findall(r"\d+:\d\d", when) or [when])[-1]
                    part[-1]["hits"].append({"name": "Enrage", "time": enrage, "t": secs(enrage), "info": []})
                    in_notes = True
                if in_notes:
                    notes += [c.strip() for c in r[2:] if c.strip()]
                    continue
                if not label:
                    continue
                times = re.findall(r"\d+:\d\d", when)
                start = secs(times[0]) if times else 0
                end = secs(times[-1]) if times else start
                hit = {"name": re.sub(r"\s+", " ", label), "time": re.sub(r"\s*-\s*", "–", when) if times else when,
                       "t": start}
                if end != start:
                    hit["tEnd"] = end
                cells = {}
                for k, j in cols.items():
                    text = r[j] if j < len(r) else ""
                    if k == "MT" and re.search(r"EVERY SINGLE REMAINING|^NOTE:", text):
                        hit["note"] = re.sub(r"^NOTE:\s*", "", text.strip())
                        continue
                    c = cell(text)
                    if c:
                        cells["Parking" if k == "Parking Lot" else k] = c
                hit["cells"] = cells
                hit["sync"] = sync_names(label, casts)
                extra = SAVAGE_EXTRA_SYNC.get((pid, clock, label))
                if extra:
                    hit["syncAt"] = extra
                # A row belongs to the phase its last hit lands in.
                idx = max(i for i, b in enumerate(bounds) if end >= b[1])
                part[idx]["hits"].append(hit)
            phases += part
        number = pid.upper()
        plans.append({
            "id": pid,
            "name": name,
            "short": number,
            "duties": [duty],
            "source": {"title": "AAC Heavyweight Mitsheet", "author": "Silacy Alaseia (Odin)",
                       "url": "https://na.finalfantasyxiv.com/lodestone/character/30004232/blog/5650059/",
                       "via": "Phases from Exia's DT raid timelines"},
            "about": ["Silacy's personal preferences from week 1 PF, not the most optimal way to mitigate.",
                      "The healer columns are written for a Scholar shield healer; ask your healers where they want your mits."],
            "slots": [
                {"key": "MT", "label": "MT", "role": "tank"},
                {"key": "OT", "label": "OT", "role": "tank"},
                {"key": "Pure", "label": "Pure healer", "jobs": ["WHM", "AST"]},
                {"key": "Shield", "label": "Shield healer (written for SCH)", "jobs": ["SCH", "SGE"]},
                {"key": "M1", "label": "M1 (melee)", "role": "melee"},
                {"key": "M2", "label": "M2 (melee)", "role": "melee"},
                {"key": "R1", "label": "R1 (phys ranged)", "role": "ranged"},
                {"key": "R2", "label": "R2 (caster)", "role": "caster"},
                {"key": "Parking", "label": "Parking lot", "role": "extras"},
            ],
            "notes": notes,
            "phases": [p for p in phases if p["hits"]],
        })
    return plans


# ---------------------------------------------------------------- main

# ---------------------------------------------------------------- lining rows up with the boss's casts

SIM_FIGHTS = ROOT.parent / "BlackMageSim" / "work" / "fights"
SIM_KEY = {"dmu": "umad"}

# How far (s) a row's time may be from the cast it's named after; and how close two rows must agree on a clock offset.
ALIGN_REACH = 15
ALIGN_AGREE = 6


def cast_events(plan_id):
    """The boss's abilities along cactbot's main line (the Striking Dummy Sim's export), as (second, name as compared)."""
    path = SIM_FIGHTS / f"{SIM_KEY.get(plan_id, plan_id)}.json"
    if not path.exists():
        return None
    events = []
    for e in json.loads(path.read_text(encoding="utf-8"))["fight"]["events"]:
        if e["name"].startswith("-"):
            continue
        for part in re.sub(r"\s*\([^)]*\)", "", e["name"]).split("/"):
            part = re.sub(r"\s+x\d+$", "", part.strip())
            if norm(part):
                events.append((e["t"], norm(part)))
    return events


def token_times(hit):
    """Each of a row's casts with the time the sheet puts it at: the first starts the row, the last ends it."""
    names = hit.get("sync", [])
    t = hit.get("t")
    for i, name in enumerate(names):
        yield name, (hit.get("tEnd", t) if i > 0 and i == len(names) - 1 else t)


def align(plan):
    """
    Gives each row's casts the time on the plan's clock that cactbot's timeline puts them at, so the plugin can sync
    tightly and isn't fooled by a cast the sheet doesn't list (M9S's Dead Wake comes four times, the sheet names one).
    Sheets and cactbot drift apart over a fight (M10S's sheet has Snaking 24 s before cactbot does), so the offset
    between the two clocks is followed row by row, starting from what the first rows agree on. A cast inside a row's
    stretch ("Rain + Thirst > Screech", 4:12-4:44) gets its own time within it. Rows the sheet gives no time get the
    time of their cast between the rows around them.
    """
    events = cast_events(plan["id"])
    if events is None:
        print(f"      {plan['id']}: no cactbot events in {SIM_FIGHTS}, keeping the sheet's cast names only")
        return
    clocks = {}
    for p in plan["phases"]:
        clocks.setdefault(p["clock"], []).extend(h for h in p["hits"] if "cells" in h)

    def occurrences(name):
        return [e[0] for e in events if e[1] == norm(name)]

    for clock, hits in clocks.items():
        timed = [h for h in hits if h.get("t") is not None]
        first = []
        for h in timed:
            d = [x - at for name, at in token_times(h) for x in occurrences(name)]
            if d:
                first.append(d)
            if len(first) == 4:
                break
        if not first:
            for h in hits:
                h.pop("sync", None)
            continue
        diffs = [d for row in first for d in row]
        drift = max(diffs, key=lambda d: (sum(any(abs(d2 - d) <= ALIGN_AGREE for d2 in row) for row in first), -abs(d)))

        prev = None
        for i, h in enumerate(hits):
            exact = []
            if h.get("t") is None:
                lo = prev if prev is not None else -9999
                nxt = next((x["t"] for x in hits[i + 1:] if x.get("t") is not None), 99999)
                for name in h.get("sync", []):
                    found = [x - drift for x in occurrences(name) if lo < x - drift < nxt]
                    if found:
                        exact.append({"name": name, "at": round(found[0], 1)})
                if exact:
                    h["t"] = int(exact[0]["at"])
                    h["tEst"] = True
            else:
                lo, hi = h["t"], h.get("tEnd", h["t"])
                for k, (name, at) in enumerate(token_times(h)):
                    occ = [x - drift for x in occurrences(name)]
                    inside = [x for x in occ if lo - 3 <= x <= hi + 3]
                    near = [x for x in occ if abs(x - at) <= ALIGN_REACH]
                    pick = min(inside or near, key=lambda x: abs(x - at)) if inside or near else None
                    if pick is None:
                        continue
                    exact.append({"name": name, "at": round(pick, 1)})
                    if k == 0:
                        h["tSync"] = round(pick, 1)
                    # A single-time row's first cast says how far the clocks have drifted by now (half of it, so
                    # one row timed differently from the rest doesn't throw the next ones off).
                    if k == 0 and lo == hi and abs(pick - at) <= ALIGN_REACH:
                        drift += (pick - at) / 2
            if exact:
                h["syncAt"] = h.get("syncAt", []) + [x for x in exact if x not in h.get("syncAt", [])]
            # A cast cactbot never has near this row would sync the clock to the wrong time: drop it.
            h.pop("sync", None)
            if h.get("t") is not None:
                prev = h["t"]
                h["_drift"] = drift
                h["_ct"] = h.get("tSync", h["t"]) + drift
    # Keep the sheet's order: a row never lights up before the one above it.
    for hits in clocks.values():
        last = None
        for h in hits:
            when = h.get("tSync", h.get("t"))
            if when is None:
                continue
            if last is not None and when < last:
                h["tSync"] = last
                when = last
            last = when
    phase_syncs(plan, events)
    # A phase sharing its clock with the one before it (FRU's Light Rampant after Shiva) starts just before its first row.
    for prev, p in zip(plan["phases"], plan["phases"][1:]):
        times = [h.get("tSync", h.get("t")) for h in p["hits"] if h.get("tSync", h.get("t")) is not None]
        if p["clock"] == prev["clock"] and "start" not in p and times:
            p["start"] = round(min(times) - 5, 1)
    # Anything still untimed sorts with the row before it.
    for p in plan["phases"]:
        last = 0
        for h in p["hits"]:
            if h.get("t") is None:
                h["t"] = last
                h["tEst"] = True
            last = h["t"]
            h.pop("_drift", None)
            h.pop("_ct", None)


def phase_syncs(plan, events):
    """
    Every boss ability cactbot has in each phase, at its time on the phase's clock, so the plugin can follow the
    fight between the sheet's rows and tell which phase you're in from any cast. A phase runs in cactbot's time from
    a little before its first row (half the gap after the phase before, at most 20 s) to the next phase. A cast only
    ever used in one phase is that phase's "entry": seeing it means you're in that phase, even after joining mid-fight.
    A cast used once in the whole fight is an "anchor": it puts the clock at its time wherever the clock was.
    """
    rows = [[(h["_ct"], h["_drift"]) for h in p["hits"] if "_ct" in h] for p in plan["phases"]]
    starts = []
    for k, r in enumerate(rows):
        if not r:
            starts.append(None)
            continue
        first = min(ct for ct, _ in r)
        before = max((ct for ct, _ in rows[k - 1]), default=None) if k > 0 else None
        gap = first - before if before is not None else 40
        starts.append(first - min(20, max(gap, 0) / 2))
    spans = []
    for k, start in enumerate(starts):
        end = next((x for x in starts[k + 1:] if x is not None), 1e9)
        spans.append((start, end))

    def phase_of(t):
        return next((k for k, (a, b) in enumerate(spans) if a is not None and a <= t < b), None)

    where = {}
    count = {}
    for t, name in events:
        where.setdefault(name, set()).add(phase_of(t))
        count[name] = count.get(name, 0) + 1
    for k, p in enumerate(plan["phases"]):
        if spans[k][0] is None:
            continue
        syncs, seen = [], set()
        for t, name in events:
            if phase_of(t) != k or not name:
                continue
            drift = min(rows[k], key=lambda r: abs(r[0] - t))[1]
            at = round(t - drift, 1)
            if (name, at) in seen:
                continue
            seen.add((name, at))
            s = {"name": name, "at": at}
            if where[name] == {k}:
                s["entry"] = True
            if count[name] == 1:
                s["anchor"] = True
            syncs.append(s)
        p["syncs"] = syncs


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    plans = [build_ikuya(), build_fmbg()] + build_silacy()
    for plan in plans:
        align(plan)
    for plan in plans:
        hits = [h for p in plan["phases"] for h in p["hits"] if "cells" in h]
        synced = [h for h in hits if h.get("sync") or h.get("syncAt")]
        for h in hits:
            if not h.get("sync"):
                h.pop("sync", None)
        path = OUT / f"{plan['id']}.json"
        path.write_text(json.dumps(plan, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{plan['id']:5} {len(plan['phases'])} phases, {len(hits)} hits, {len(synced)} with boss casts -> {path.relative_to(ROOT)}")
        missing = [h["name"] for h in hits if not h.get("sync") and not h.get("syncAt")]
        if missing:
            print(f"      no cast: {', '.join(missing)}")


if __name__ == "__main__":
    main()
