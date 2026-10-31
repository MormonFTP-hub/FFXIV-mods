"""Bundle the sim into one self-contained HTML file for sharing.

Writes two files to BlackMageSim/build/ (git-ignored):
  BlackMageSim.html  a normal page: send it to someone, they double-click it.
  artifact.html      the same page without <html>/<head>/<body>, for publishing
                     as a claude.ai artifact (the host adds its own skeleton). The
                     game models go next to it as game-models-0.js, -1.js, ...: the
                     model JSON cut into 10 MB string chunks that the last one joins
                     and parses, so every published file stays under the 16 MB limit.
                     The icons (work/game-icons.js, ~18 MB) go next to it as game-icons-0.js,
                     -1.js, ...: whole icons per file, each file under 10 MB. The map
                     (work/game-map.js, from tools/export_map.py) goes next to it the
                     same way as the models, as game-map-0.js, ...; so do the fights'
                     maps, which the page lists (BLM.MAP_FILES) and loads only when you
                     go to that fight.
                     The game's sounds and music (work/sounds/, work/music/, from tools/export_audio.py) go next
                     to it as sounds/<name>.js and music/<name>.js: the page loads a job's or a fight's when it
                     needs them. BlackMageSim.html has them all inside.
  DummySimLab.html   the simulator (sim.html) in one file; sim-artifact.html its artifact fragment.
And a folder:
  site/              a website to upload to a free static host (Cloudflare Pages, GitHub
                     Pages, Netlify): the page as index.html with the icon and model files
                     beside it, every file under 25 MB (Cloudflare Pages' limit), and the simulator as
                     sim.html.
"""
import base64
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


def model_chunks(stem="game-models", var="GAME_MODELS"):
    """Write work/<stem>.js to build/ as <stem>-N.js chunk files; return their names (none without the file)."""
    path = ROOT / "work" / f"{stem}.js"
    for old in OUT.glob(f"{stem}-*.js"):
        old.unlink()
    if not path.exists():
        print(f"skipping {path.name} (not found)")
        return []
    src = path.read_text(encoding="utf-8")
    text = re.search(r"BLM\." + var + r" = (\{.*\});\s*$", src, re.S).group(1)
    acc = "window.__" + stem.replace("-", "_")
    names = []
    parts = [text[i:i + CHUNK] for i in range(0, len(text), CHUNK)]
    for k, part in enumerate(parts):
        js = f"({acc} = {acc} || []).push(" + json.dumps(part) + ");\n"
        if k == len(parts) - 1:
            js += f"window.BLM = window.BLM || {{}};\nBLM.{var} = JSON.parse({acc}.join(''));\ndelete {acc};\n"
        name = f"{stem}-{k}.js"
        (OUT / name).write_text(js, encoding="utf-8")
        names.append(name)
    return names


def map_chunks():
    """Each work/game-map*.js (BLM.GAME_MAPS[key] = {...}) as build/<stem>-N.js chunks; {source path: names}, and
    each map's listing ({key: {name, label, fight, files, stub}}) for the page to load it when it's wanted."""
    for old in OUT.glob("game-map*-*.js"):
        old.unlink()
    out = {}
    MAP_INDEX.clear()
    for path in sorted((ROOT / "work").glob("game-map*.js")):
        src = path.read_text(encoding="utf-8")
        m = re.search(r'BLM\.GAME_MAPS\[("[^"]+")\] = (\{.*\});\s*$', src, re.S)
        if not m:
            print(f"skipping {path.name} (not a GAME_MAPS file: export it again)")
            continue
        key, text = m.group(1), m.group(2)
        acc = "window.__" + path.stem.replace("-", "_")
        parts = [text[i:i + CHUNK] for i in range(0, len(text), CHUNK)]
        names = []
        for k, part in enumerate(parts):
            js = f"({acc} = {acc} || []).push(" + json.dumps(part) + ");\n"
            if k == len(parts) - 1:
                js += (f"window.BLM = window.BLM || {{}};\nBLM.GAME_MAPS = BLM.GAME_MAPS || {{}};\n"
                       f"BLM.GAME_MAPS[{key}] = JSON.parse({acc}.join(''));\ndelete {acc};\n")
            name = f"{path.stem}-{k}.js"
            (OUT / name).write_text(js, encoding="utf-8")
            names.append(name)
        out[f"work/{path.name}"] = names
        G = json.loads(text)
        f = G.get("fight")
        MAP_INDEX[json.loads(key)] = {"name": G.get("name"), "label": G.get("label"), "files": names, "stub": True,
                                      "fight": {"duty": f.get("duty"), "boss": f.get("boss")} if f else None, "path": f"work/{path.name}"}
    return out


MAP_INDEX = {}           # map_chunks' listing of every map
EAGER_MAPS = ("pier",)   # loaded with the page (where you start); the rest when you go there
# The claude.ai copies: each holds 256 MB at most, so the fights are split between them (the website has them all).
# Each page lists only its own fights; the shared files (models, icons, the pier, the jobs' sounds) are in both, and
# artifact-files.json says which files each needs. M2S, a timeline-only test fight, is on neither.
ARTIFACTS = {
    "artifact.html": ("m5s", "m6s", "m7s", "m8s", "m9s", "m10s", "m11s", "m12s"),          # the Savage tiers
    "artifact-2.html": ("m4s", "ex1", "ex2", "ex3", "ex4", "ex5", "ex6", "ex7", "ex8", "chaotic"),   # the rest
    "artifact-3.html": ("fru", "umad", "tea", "ucob"),                                                # the ultimates
}


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


AUDIO_TAG = '<script src="js/audio.js"></script>'


def audio_files():
    """work/sounds/*.js copied to build/sounds/, and each work/music/*.js written to build/music/ as its tracks'
    .mp3 files (a third smaller than base64; the page fetches one when you go there) with a small .js listing them.
    Returns (the work files, for the one-file page; the build files, for the website and the artifact)."""
    inline, names = [], []
    for d in ("sounds", "music"):
        if (OUT / d).exists():
            shutil.rmtree(OUT / d)
        src = ROOT / "work" / d
        if not src.exists():
            continue
        (OUT / d).mkdir()
        for f in sorted(src.glob("*.js")):
            inline.append(f"{d}/{f.name}")
            if d == "sounds":
                shutil.copyfile(f, OUT / d / f.name)
                names.append(f"{d}/{f.name}")
                continue
            text = f.read_text(encoding="utf-8")
            head, body = text.split(".push(", 1)
            track = json.loads(body.rsplit(");", 1)[0])
            for k, part in enumerate(track["parts"]):
                mp3 = f"{f.stem}-{k}.mp3"
                (OUT / d / mp3).write_bytes(base64.b64decode(part.pop("src").split(",", 1)[1]))
                part["url"] = f"{d}/{mp3}"
                names.append(f"{d}/{mp3}")
            (OUT / d / f.name).write_text(head + ".push(" + json.dumps(track, separators=(",", ":")) + ");\n", encoding="utf-8")
            names.append(f"{d}/{f.name}")
    return inline, names


def with_audio(src: str, names, inside: bool) -> str:
    """The page with the audio files: all of them inside (one file to send), or loaded from beside it."""
    if inside:
        tags = "".join(f'<script src="work/{n}"></script>\n  ' for n in names)
    else:
        tags = "<script>BLM.ASSET_BASE = '';</script>\n  "
    return src.replace(AUDIO_TAG, tags + AUDIO_TAG)


def fragment(html: str) -> str:
    head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
    body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
    # The artifact host supplies charset and viewport metas.
    head = re.sub(r"\s*<meta (charset|name=\"viewport\")[^>]*>", "", head)
    return head.strip() + "\n" + body.strip() + "\n"


def site(page: str, files) -> None:
    """Write build/site/: the whole page as index.html, with its icon and model files beside it."""
    SITE.mkdir(exist_ok=True)
    for old in SITE.iterdir():
        if old.is_file():
            old.unlink()
        elif old.name in ("sounds", "music"):
            shutil.rmtree(old)
    (SITE / "index.html").write_text(page, encoding="utf-8")
    for name in files:
        (SITE / name).parent.mkdir(exist_ok=True)
        shutil.copyfile(OUT / name, SITE / name)
    # Cloudflare's wrangler leaves its cache (account name included) in the folder it runs from: never upload it.
    (SITE / ".assetsignore").write_text(".wrangler\n", encoding="utf-8")


def sim_lab() -> None:
    """Dummy Sim Lab (sim.html), the simulator: one self-contained file, an artifact fragment and the site's sim.html."""
    page = inline((ROOT / "sim.html").read_text(encoding="utf-8"))
    (OUT / "DummySimLab.html").write_text(page, encoding="utf-8")
    (OUT / "sim-artifact.html").write_text(fragment(page), encoding="utf-8")
    (SITE / "sim.html").write_text(page, encoding="utf-8")
    for name in ("DummySimLab.html", "sim-artifact.html"):
        print(f"{OUT / name}  {(OUT / name).stat().st_size / 1024:.0f} KB")


def main():
    src = (ROOT / "index.html").read_text(encoding="utf-8")
    assert AUDIO_TAG in src, "index.html has no js/audio.js tag"
    OUT.mkdir(exist_ok=True)
    inside, audio = audio_files()
    (OUT / "BlackMageSim.html").write_text(inline(with_audio(src, inside, True)), encoding="utf-8")
    src = with_audio(src, audio, False)
    chunks = model_chunks()
    map_files = map_chunks()
    maps = [n for names in map_files.values() for n in names]
    icons = icon_chunks()
    keep = {"work/game-models.js": chunks, "work/game-icons.js": icons, **map_files}
    # On the website and the artifact the fights' maps load when you go there: their tags go, a listing comes.
    lazy = {}
    for k, m in MAP_INDEX.items():
        if k in EAGER_MAPS:
            continue
        keep[m["path"]] = []
        lazy[k] = {n: v for n, v in m.items() if n != "path"}
    def listed(d):
        return src.replace(AUDIO_TAG, f"<script>BLM.MAP_FILES = {json.dumps(d, separators=(',', ':'))};</script>\n  " + AUDIO_TAG)
    page = inline(listed(lazy), keep=keep)
    shared = [*icons, *chunks, *[n for k, m in MAP_INDEX.items() if k in EAGER_MAPS for n in m["files"]]]
    shared += [n for n in audio if n.startswith("sounds/") and not n.startswith("sounds/boss-")]
    shared += [n for n in audio if n.startswith(("music/pier", "music/win"))]
    listing = {}
    for name, keys in ARTIFACTS.items():
        art = {k: v for k, v in lazy.items() if k in keys}
        (OUT / name).write_text(fragment(inline(listed(art), keep=keep)), encoding="utf-8")
        own = [n for k in art for n in art[k]["files"]]
        own += [n for n in audio if any(n in (f"sounds/boss-{k}.js", f"music/{k}.js") or n.startswith(f"music/{k}-") for k in art)]
        files = shared + own
        listing[name] = {"fights": list(art), "files": files,
                         "mb": round((sum((OUT / f).stat().st_size for f in files) + (OUT / name).stat().st_size) / 1048576, 1)}
        print(f"{OUT / name}  {len(art)} fights, {len(files)} files, {listing[name]['mb']} MB in all")
    (OUT / "artifact-files.json").write_text(json.dumps(listing, indent=1), encoding="utf-8")
    site(page, [*icons, *chunks, *maps, *audio])
    sim_lab()
    if audio:
        size = sum((OUT / n).stat().st_size for n in audio)
        print(f"{OUT / 'sounds'}, {OUT / 'music'}  {len(audio)} files, {size / 1024 / 1024:.0f} MB")
    for name in ("BlackMageSim.html", "artifact.html", *icons, *chunks, *maps):
        print(f"{OUT / name}  {(OUT / name).stat().st_size / 1024:.0f} KB")
    files = sorted(f for f in SITE.rglob("*") if f.is_file())
    print(f"{SITE}  {len(files)} files, {sum(f.stat().st_size for f in files) / 1024 / 1024:.0f} MB, "
          f"largest {max(f.stat().st_size for f in files) / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
