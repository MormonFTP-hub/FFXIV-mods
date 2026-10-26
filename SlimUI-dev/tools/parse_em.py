import sys
SYS = "ActionBar CastBar Minimap UnitFrame EncounterBar ExtraAbilities AuraFrame TalkingHeadFrame ChatFrame VehicleLeaveButton LootFrame HudTooltip ObjectiveTracker MicroMenu Bags StatusTrackingBar DurabilityFrame TimerBars VehicleSeatIndicator ArchaeologyBar CooldownViewer PersonalResourceDisplay EncounterEvents DamageMeter RaidWarning TotemActionBar LossOfControl".split()
PT = "TOPLEFT TOP TOPRIGHT LEFT CENTER RIGHT BOTTOMLEFT BOTTOM BOTTOMRIGHT".split()
def isnum(t):
    try: float(t); return True
    except: return False
toks = open(sys.argv[1], encoding="latin-1").read().split()
i = 0
# find layout names: non-numeric token followed by an integer count
while i < len(toks):
    t = toks[i]
    if not isnum(t) and i + 1 < len(toks) and toks[i+1].isdigit() and int(toks[i+1]) > 10:
        name, n = t, int(toks[i+1]); i += 2
        print("== layout", name, n, "systems")
        for _ in range(n):
            s, idx, d, p, rp, rel, x, y = toks[i:i+8]; i += 8
            a2 = ""
            if toks[i] != "-1":
                a2 = " +anchor2 " + " ".join(toks[i:i+6]); i += 6
            else:
                i += 1
            st = toks[i]; i += 1
            sets = " ".join("%d=%d" % (ord(st[k]) - 35, ord(st[k+1]) - 35) for k in range(0, len(st) - 1, 2))
            print("  %-16s idx=%-3s %s %-11s %-28s %-11s %8s %8s%s  [%s]" % (SYS[int(s)] if int(s) < len(SYS) else s, idx, "def" if d == "1" else "   ", PT[int(p)], rel, PT[int(rp)], x, y, a2, sets))
        continue
    i += 1
