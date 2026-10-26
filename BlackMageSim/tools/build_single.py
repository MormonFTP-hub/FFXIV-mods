"""Bundle the sim into one self-contained HTML file for sharing.

Writes two files to BlackMageSim/build/ (git-ignored):
  BlackMageSim.html  a normal page: send it to someone, they double-click it.
  artifact.html      the same page without <html>/<head>/<body>, for publishing
                     as a claude.ai artifact (the host adds its own skeleton).
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build"


def inline(html: str) -> str:
    def css(m):
        return "<style>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8") + "\n</style>"

    def js(m):
        src = (ROOT / m.group(1)).read_text(encoding="utf-8")
        # A literal </script> inside the code would end the inline tag early.
        return "<script>\n" + src.replace("</script", "<\\/script") + "\n</script>"

    html = re.sub(r'<link rel="stylesheet" href="([^"]+\.css)">', css, html)
    html = re.sub(r'<script src="([^"]+\.js)"></script>', js, html)
    return html


def fragment(html: str) -> str:
    head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
    body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
    # The artifact host supplies charset and viewport metas.
    head = re.sub(r"\s*<meta (charset|name=\"viewport\")[^>]*>", "", head)
    head = head.replace("<title>Black Mage Dummy (Endwalker)</title>", "<title>Endwalker Black Mage Dummy</title>")
    return head.strip() + "\n" + body.strip() + "\n"


def main():
    html = inline((ROOT / "index.html").read_text(encoding="utf-8"))
    OUT.mkdir(exist_ok=True)
    (OUT / "BlackMageSim.html").write_text(html, encoding="utf-8")
    (OUT / "artifact.html").write_text(fragment(html), encoding="utf-8")
    for name in ("BlackMageSim.html", "artifact.html"):
        print(f"{OUT / name}  {(OUT / name).stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
