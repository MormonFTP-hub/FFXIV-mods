"""Bundle the sim into one self-contained HTML file.

Writes to Aion2Sim/build/ (git-ignored):
  Aion2Sim.html   a normal page: double-click it, or send it to someone.
  artifact.html   the same page without <html>/<head>/<body>, for publishing as a claude.ai artifact
                  (the host adds its own skeleton).
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build"


def inline(html: str) -> str:
    def css(m):
        return "<style>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8") + "\n</style>"

    def js(m):
        path = ROOT / m.group(1)
        if not path.exists():
            print(f"skipping {m.group(1)} (not found)")
            return ""
        src = path.read_text(encoding="utf-8")
        # A literal </script> inside the code would end the inline tag early.
        return "<script>\n" + src.replace("</script", "<\\/script") + "\n</script>"

    html = re.sub(r'<link rel="stylesheet" href="([^"]+\.css)">', css, html)
    html = re.sub(r'<script src="([^"]+\.js)"></script>', js, html)
    return html


def main():
    OUT.mkdir(exist_ok=True)
    page = inline((ROOT / "index.html").read_text(encoding="utf-8"))
    (OUT / "Aion2Sim.html").write_text(page, encoding="utf-8")
    head = re.search(r"<head>(.*?)</head>", page, re.S).group(1)
    body = re.search(r"<body>(.*?)</body>", page, re.S).group(1)
    # the artifact host supplies charset and viewport; keep the title first so the gallery finds it
    head = re.sub(r'<meta charset="utf-8">\s*', "", head)
    head = re.sub(r'<meta name="viewport"[^>]*>\s*', "", head)
    (OUT / "artifact.html").write_text(head.strip() + "\n" + body.strip() + "\n", encoding="utf-8")
    for name in ("Aion2Sim.html", "artifact.html"):
        print(f"{name}: {(OUT / name).stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
