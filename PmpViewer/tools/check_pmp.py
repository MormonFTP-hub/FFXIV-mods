"""Run the PMP Viewer's checks on a .pmp without opening the page: how Penumbra reads its manipulations, files the
pack names but doesn't contain, the problems list for one character, and the "All races" table.

python -P -E tools/check_pmp.py <mod.pmp> [--design <Glamourer file|code>] [--race c0101 --face N --hair N]
                                [--gear slot=set.variant ...] [--face-paint N --paint-color N] [--no-collection]
                                [--set "Group=Option"]
Same subject options as tools/gs_render.py (the mod's own targets by default). Exit code 1 when there are errors.
"""
import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import app  # noqa: E402
from gs_render import settings_from, subject_from  # noqa: E402


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mod")
    for flag in ("--design", "--race"):
        ap.add_argument(flag)
    for flag in ("--clan", "--face", "--hair", "--face-paint", "--paint-color"):
        ap.add_argument(flag, type=int)
    ap.add_argument("--paint-flip", action="store_true")
    ap.add_argument("--gear", action="append", default=[])
    ap.add_argument("--set", action="append", default=[])
    ap.add_argument("--no-collection", action="store_true")
    args = ap.parse_args()

    path = os.path.abspath(args.mod)
    o = app.api_open({"path": path})
    print(f"{o['mod']['name']} {o['mod'].get('version', '')}: {len(o['files'])} files, {len(o['swaps'])} swaps")
    print("manipulations:", o["manipCounts"], "| as Penumbra reads them:", o["penumbraManips"])
    missing = [f["path"] for f in o["files"] if not f["present"]]
    print("files the pack names but doesn't contain:", missing or "none")

    spec = subject_from(args, o)
    settings = settings_from(args, o)
    sc = app.api_scene({"path": path, "settings": settings, "subject": spec})
    gear = ", ".join(f"{s}:{g[0]}.{g[1]}" for s, g in (spec.get("gear") or {}).items() if g)
    print(f"\n{spec.get('race')} face {spec.get('face')} hair {spec.get('hair')} ({gear}); {len(sc['problems'])} problems:")
    for p in sc["problems"]:
        print(f"  {p['level']:5} {p['text']}")

    rc = app.api_races_check({"path": path, "settings": settings, "subject": spec})
    print("\nAll races:")
    for r in rc["rows"]:
        srcs = ", ".join(f"{s}:{c['source']}{'(deformed)' if c['deformed'] else ''}" for s, c in r["slots"].items()
                         if s in ("met", "top", "glv", "dwn", "sho", "face", "hair"))
        print(f"  {r['code']} {r['label']:24} errors {r['errors']} warns {r['warns']}  {srcs}  {r['first'][:100]}")
    errors = sum(p["level"] == "error" for p in sc["problems"]) + sum(r["errors"] for r in rc["rows"])
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
