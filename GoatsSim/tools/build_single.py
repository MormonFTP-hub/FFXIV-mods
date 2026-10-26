"""Bundle the game into one self-contained HTML file you can send to someone.

Writes to GoatsSim/build/ (git-ignored):
  GoatsSim.html  the whole game: page, scripts, styles, models and map inline. They double-click it.
  GoatsSim.zip   the same file zipped, smaller for email and chat uploads.

Needs an internet connection when it's opened (three.js, the Draco decoder and the fonts come from CDNs).
Run after the export tools:

    python GoatsSim/tools/build_single.py
"""
import base64
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "work"
OUT = ROOT / "build"
MODELS = ["hanamura", "reinhardt", "zarya", "dva_mech", "dva_pilot", "lucio", "brigitte", "zenyatta",
          "hammer", "cannon", "amp", "flail", "shield", "lightgun"]


def pack_script() -> str:
    pack = {name: base64.b64encode((WORK / "models" / f"{name}.glb").read_bytes()).decode("ascii") for name in MODELS}
    pack["nav_meta"] = json.loads((WORK / "map" / "nav.json").read_text(encoding="utf-8"))
    pack["nav_bin"] = base64.b64encode((WORK / "map" / "nav.bin").read_bytes()).decode("ascii")
    return ("// Overwatch models and Hanamura, converted from the game's files. Overwatch (c) Blizzard Entertainment.\n"
            "window.G = window.G || {};\nG.PACK = " + json.dumps(pack, separators=(",", ":")) + ";\n")


def inline(html: str) -> str:
    def css(m):
        return "<style>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8") + "\n</style>"

    def js(m):
        if m.group(1).startswith("http"):    # CDN libraries stay as links
            return m.group(0)
        src = (ROOT / m.group(1)).read_text(encoding="utf-8")
        # a literal </script> inside the code would end the inline tag early
        return "<script>\n" + src.replace("</script", "<\\/script") + "\n</script>"

    html = re.sub(r'<link rel="stylesheet" href="([^"?]+\.css)(?:\?[^"]*)?">', css, html)
    html = re.sub(r'<script src="([^"?]+\.js)(?:\?[^"]*)?"></script>', js, html)
    # the asset pack goes in before the game's own scripts
    first = html.index("<script>\n")
    return html[:first] + "<script>\n" + pack_script() + "</script>\n  " + html[first:]


def main():
    OUT.mkdir(exist_ok=True)
    html = inline((ROOT / "index.html").read_text(encoding="utf-8"))
    out = OUT / "GoatsSim.html"
    out.write_text(html, encoding="utf-8")
    z = OUT / "GoatsSim.zip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        zf.write(out, "GoatsSim.html")
    print(f"wrote {out} ({out.stat().st_size / 1048576:.1f} MB)")
    print(f"wrote {z} ({z.stat().st_size / 1048576:.1f} MB)")


if __name__ == "__main__":
    main()
