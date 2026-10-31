"""Real M5S kills from FFLogs (tools/fflogs.py), boiled down for checking the sim's mechanics against: for each kill,
the players (job, role) and, for every hit Dancing Green's side lands on a player, the second into the fight, the
ability, who it hit and where they stood; his casts with their timings; the debuffs players got (Burn Baby Burn,
Wavelength) with their durations; and where everyone was every couple of seconds (from their own casts).

  python BlackMageSim/tools/fflogs_m5s.py fetch [n] [region]   # n kills (default 12) from the region's rankings (NA)
  python BlackMageSim/tools/fflogs_m5s.py summary              # what's been fetched

Writes work/fflogs/m5s/<report>.json (git-ignored). Positions are [east, north] yalms from the arena's middle, as the
sim's fight scripts use; seconds count from the pull.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fflogs as F      # noqa: E402

OUT = F.ROOT / "work" / "fflogs" / "m5s"
ENCOUNTER, SAVAGE = 97, 101
ROLE = {"Paladin": "tank", "Warrior": "tank", "DarkKnight": "tank", "Gunbreaker": "tank",
        "WhiteMage": "healer", "Scholar": "healer", "Astrologian": "healer", "Sage": "healer",
        "Monk": "melee", "Dragoon": "melee", "Ninja": "melee", "Samurai": "melee", "Reaper": "melee", "Viper": "melee",
        "Bard": "ranged", "Machinist": "ranged", "Dancer": "ranged",
        "BlackMage": "caster", "Summoner": "caster", "RedMage": "caster", "Pictomancer": "caster"}

META = """query($code: String!) { reportData { report(code: $code) {
  fights(killType: Kills, encounterID: %d) { id kill startTime endTime difficulty }
  masterData { actors { id name type subType } abilities { gameID name } }
} } }""" % ENCOUNTER
EVENTS = """query($code: String!, $f: [Int]!, $s: Float, $e: Float, $dt: EventDataType, $h: HostilityType) { reportData { report(code: $code) {
  events(fightIDs: $f, startTime: $s, endTime: $e, dataType: $dt, hostilityType: $h, includeResources: true, limit: 10000) { data nextPageTimestamp }
} } }"""


def pos(res):
    return [round(res["x"] / 100 - 100, 2), round(100 - res["y"] / 100, 2)] if res and "x" in res else None


def events(code, fight, dt, hostility="Friendlies"):
    out, s = [], fight["startTime"]
    while s is not None:
        d = F.query(EVENTS, {"code": code, "f": [fight["id"]], "s": s, "e": fight["endTime"], "dt": dt, "h": hostility})
        ev = d["data"]["reportData"]["report"]["events"]
        out += ev["data"]
        s = ev["nextPageTimestamp"]
    return out


def fetch_one(code):
    of = OUT / f"{code}.json"
    if of.exists():
        return json.loads(of.read_text())
    m = F.query(META, {"code": code})["data"]["reportData"]["report"]
    kills = [f for f in m["fights"] if f["kill"] and f.get("difficulty") == SAVAGE] or [f for f in m["fights"] if f["kill"]]
    if not kills:
        return None
    fight = kills[-1]
    t0 = fight["startTime"]
    actors = {a["id"]: a for a in m["masterData"]["actors"]}
    names = {a["gameID"]: a["name"] for a in m["masterData"]["abilities"]}
    players = {a["id"]: {"job": a["subType"], "role": ROLE.get(a["subType"])} for a in actors.values()
               if a["type"] == "Player" and a["subType"] in ROLE}
    boss_ids = {a["id"] for a in actors.values() if a["type"] == "NPC"}
    hits, track, casts, debuffs = [], {}, [], []
    # Hits on players (damage taken), with where they stood.
    for e in events(code, fight, "DamageTaken"):
        if e.get("type") != "damage" or e.get("targetID") not in players or e.get("sourceID") in players:
            continue
        p = pos(e.get("targetResources"))
        hits.append({"t": round((e["timestamp"] - t0) / 1000, 2), "id": e.get("abilityGameID"), "name": names.get(e.get("abilityGameID"), "?"),
                     "who": e["targetID"], "at": p, "amount": e.get("amount", 0), "unmit": e.get("unmitigatedAmount", 0)})
    # The boss's (and his helpers') casts.
    for e in events(code, fight, "Casts", "Enemies"):
        if e.get("type") not in ("begincast", "cast"):
            continue
        casts.append({"t": round((e["timestamp"] - t0) / 1000, 2), "type": e["type"], "id": e.get("abilityGameID"),
                      "name": names.get(e.get("abilityGameID"), "?"), "src": e.get("sourceID"), "at": pos(e.get("sourceResources")),
                      "dur": e.get("duration")})
    # Players' own casts: where each stood, every GCD or so.
    for e in events(code, fight, "Casts"):
        if e.get("sourceID") in players and e.get("type") in ("cast", "begincast"):
            p = pos(e.get("sourceResources"))
            if p:
                track.setdefault(e["sourceID"], []).append([round((e["timestamp"] - t0) / 1000, 2)] + p)
    # Debuffs on players.
    for e in events(code, fight, "Debuffs", "Friendlies"):
        if e.get("type") in ("applydebuff", "removedebuff") and e.get("targetID") in players:
            debuffs.append({"t": round((e["timestamp"] - t0) / 1000, 2), "type": e["type"], "id": e.get("abilityGameID"),
                            "name": names.get(e.get("abilityGameID"), "?"), "who": e["targetID"], "at": pos(e.get("targetResources"))})
    boss_hp = None
    out = {"code": code, "fight": fight["id"], "duration": round((fight["endTime"] - t0) / 1000, 2), "players": players,
           "hits": hits, "casts": casts, "track": track, "debuffs": debuffs, "boss": sorted(boss_ids), "bossHp": boss_hp}
    OUT.mkdir(parents=True, exist_ok=True)
    of.write_text(json.dumps(out), encoding="utf-8")
    return out


def rankings(region, pages):
    codes = []
    for page in range(1, pages + 1):
        d = F.query("""query($p: Int, $r: String) { worldData { encounter(id: %d) {
          characterRankings(difficulty: %d, serverRegion: $r, page: $p) } } }""" % (ENCOUNTER, SAVAGE), {"p": page, "r": region})
        for x in d["data"]["worldData"]["encounter"]["characterRankings"]["rankings"]:
            c = (x.get("report") or {}).get("code")
            if c and not c.startswith("a:") and c not in codes:
                codes.append(c)
    return codes


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "summary"
    if cmd == "fetch":
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 12
        region = sys.argv[3] if len(sys.argv) > 3 else "NA"
        codes = rankings(region, 2)
        done = 0
        for c in codes:
            if done >= n:
                break
            try:
                r = fetch_one(c)
            except Exception as ex:       # noqa: BLE001
                print(c, "failed:", str(ex)[:200])
                continue
            if r:
                done += 1
                print(f"{c}: {r['duration']}s, {len(r['hits'])} hits, {len(r['casts'])} casts, {sum(len(v) for v in r['track'].values())} positions")
        rl = F.query("{ rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn } }", cache=False)["data"]["rateLimitData"]
        print("API points:", rl)
    else:
        for f in sorted(OUT.glob("*.json")):
            r = json.loads(f.read_text())
            print(f.stem, r["duration"], sorted({p["job"] for p in r["players"].values()}))
