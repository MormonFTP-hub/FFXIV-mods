"""Run the PMP Viewer's own checks on out/Sora_KH3.pmp without opening the page: how Penumbra reads the
manipulations, the problems list for Hyur Midlander male (face 1, hairstyle 1, the mod's gear), and the
"All races" table.

python -P -E tools/viewer_check.py
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(ROOT), "PmpViewer", "server"))
import app  # noqa: E402

PMP = os.path.join(ROOT, "out", "Sora_KH3.pmp")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    o = app.api_open({"path": PMP})
    print("manipulations:", o["manipCounts"], "penumbra:", o["penumbraManips"])
    missing = [f["path"] for f in o["files"] if not f["present"]]
    print("files:", len(o["files"]), "missing in pack:", missing or "none")
    subject = dict(o["subject"])
    print("subject:", subject)
    settings = o["settings"]
    scene = app.api_scene({"path": PMP, "settings": settings, "subject": dict(subject, race="c0101", face=1, hair=1)})
    print(f"\nMidlander male, the mod's gear ({len(scene['problems'])} problems):")
    for p in scene["problems"]:
        print(f"  {p['level']:5} {p['text'][:220]}")
    rc = app.api_races_check({"path": PMP, "settings": settings, "subject": subject})
    print("\nAll races:")
    for r in rc["rows"]:
        srcs = ", ".join(f"{s}:{c['source']}{'(deformed)' if c['deformed'] else ''}{'(hidden)' if c.get('hidden') else ''}"
                         for s, c in r["slots"].items() if s in ("met", "top", "glv", "dwn", "sho", "hair", "tail", "zear"))
        print(f"  {r['code']} {r['label']:24} errors {r['errors']} warns {r['warns']}  {srcs}  {r['first'][:100]}")


if __name__ == "__main__":
    main()
