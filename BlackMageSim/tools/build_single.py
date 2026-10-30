"""Bundle the sim into one self-contained HTML file for sharing.

Writes two files to BlackMageSim/build/ (git-ignored):
  BlackMageSim.html  a normal page: send it to someone, they double-click it.
  artifact.html      the same page without <html>/<head>/<body>, for publishing
                     as a claude.ai artifact (the host adds its own skeleton). The
                     game models go next to it as game-models-0.js, -1.js, ...: the
                     model JSON cut into 10 MB string chunks that the last one joins
                     and parses, so every published file stays under the 16 MB limit.
                     The icons (work/game-icons.js, ~16 MB) go next to it as game-icons-0.js,
                     -1.js, ...: whole icons per file, each file under 10 MB.
And a folder:
  site/              a website to upload to a free static host (Cloudflare Pages, GitHub
                     Pages, Netlify): the page as index.html with the icon and model files
                     beside it, every file under 25 MB (Cloudflare Pages' limit).
"""
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build"
SITE = OUT / "site"


def inline(html: str, keep=()) -> str:
    def css(m):
        return "<style>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8") + "\n</style>"

    def js(m):
        if m.group(1).startswith("http"):    # CDN libraries (three.js) stay as links
            return m.group(0)
        if m.group(1) in keep:               # published next to the page instead, in chunks
            return "\n".join(f'<script src="{n}"></script>' for n in keep[m.group(1)])
        path = ROOT / m.group(1)
        if not path.exists():           # work/game-icons.js is optional (made by extract_icons.py)
            print(f"skipping {m.group(1)} (not found)")
            return ""
        src = path.read_text(encoding="utf-8")
        # A literal </script> inside the code would end the inline tag early.
        return "<script>\n" + src.replace("</script", "<\\/script") + "\n</script>"

    html = re.sub(r'<link rel="stylesheet" href="([^"]+\.css)">', css, html)
    html = re.sub(r'<script src="([^"]+\.js)"></script>', js, html)
    return html


CHUNK = 10 * 1024 * 1024


def model_chunks():
    """Write work/game-models.js to build/ as game-models-N.js chunk files; return their names."""
    src = (ROOT / "work" / "game-models.js").read_text(encoding="utf-8")
    text = re.search(r"BLM\.GAME_MODELS = (\{.*\});\s*$", src, re.S).group(1)
    for old in OUT.glob("game-models-*.js"):
        old.unlink()
    names = []
    parts = [text[i:i + CHUNK] for i in range(0, len(text), CHUNK)]
    for k, part in enumerate(parts):
        js = "(window.__gm = window.__gm || []).push(" + json.dumps(part) + ");\n"
        if k == len(parts) - 1:
            js += "window.BLM = window.BLM || {};\nBLM.GAME_MODELS = JSON.parse(window.__gm.join(''));\ndelete window.__gm;\n"
        name = f"game-models-{k}.js"
        (OUT / name).write_text(js, encoding="utf-8")
        names.append(name)
    return names


def icon_chunks():
    """Write work/game-icons.js to build/ as game-icons-N.js files of whole icons; return their names."""
    src = (ROOT / "work" / "game-icons.js").read_text(encoding="utf-8")
    icons = json.loads(re.search(r"BLM\.GAME_ICONS = (\{.*\});?\s*$", src, re.S).group(1))
    for old in list(OUT.glob("game-icons-*.js")) + [OUT / "game-icons.js"]:
        if old.exists():
            old.unlink()
    groups, cur, size = [], {}, 0
    for k, v in icons.items():
        if cur and size + len(v) > CHUNK:
            groups.append(cur)
            cur, size = {}, 0
        cur[k] = v
        size += len(k) + len(v) + 8
    groups.append(cur)
    names = []
    for k, g in enumerate(groups):
        js = ("window.BLM = window.BLM || {};\nBLM.GAME_ICONS = Object.assign(BLM.GAME_ICONS || {}, "
              + json.dumps(g, separators=(",", ":")) + ");\n")
        name = f"game-icons-{k}.js"
        (OUT / name).write_text(js, encoding="utf-8")
        names.append(name)
    return names


def fragment(html: str) -> str:
    head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
    body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
    # The artifact host supplies charset and viewport metas.
    head = re.sub(r"\s*<meta (charset|name=\"viewport\")[^>]*>", "", head)
    head = head.replace("<title>Black Mage Dummy (Endwalker)</title>", "<title>Endwalker Black Mage Dummy</title>")
    return head.strip() + "\n" + body.strip() + "\n"


def site(page: str, files) -> None:
    """Write build/site/: the whole page as index.html, with its icon and model files beside it."""
    SITE.mkdir(exist_ok=True)
    for old in SITE.iterdir():
        if old.is_file():
            old.unlink()
    (SITE / "index.html").write_text(page, encoding="utf-8")
    for name in files:
        shutil.copyfile(OUT / name, SITE / name)


def main():
    src = (ROOT / "index.html").read_text(encoding="utf-8")
    OUT.mkdir(exist_ok=True)
    (OUT / "BlackMageSim.html").write_text(inline(src), encoding="utf-8")
    chunks = model_chunks()
    icons = icon_chunks()
    keep = {"work/game-models.js": chunks, "work/game-icons.js": icons}
    page = inline(src, keep=keep)
    (OUT / "artifact.html").write_text(fragment(page), encoding="utf-8")
    site(page, [*icons, *chunks])
    for name in ("BlackMageSim.html", "artifact.html", *icons, *chunks):
        print(f"{OUT / name}  {(OUT / name).stat().st_size / 1024:.0f} KB")
    files = sorted(SITE.iterdir())
    print(f"{SITE}  {len(files)} files, {sum(f.stat().st_size for f in files) / 1024 / 1024:.0f} MB, "
          f"largest {max(f.stat().st_size for f in files) / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
