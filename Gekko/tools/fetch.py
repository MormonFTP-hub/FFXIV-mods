"""Download Gekko from the Kingdom Archives model viewer (https://kingdomarchives.com/modelviewer/gekko).

The page's MODEL_JSON names the glb and its PNG textures; they're plain static files. Already-downloaded files are
skipped.  python -P -E tools/fetch.py   ->  source/gekko_cs.glb, source/textures/*.png
"""
import os
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://kingdomarchives.com/uploads/models/agents/"
FILES = {"gekko/gekko_cs.glb": "gekko_cs.glb", "gekko/gekko_cs.png": "gekko_cs.png",
         "eye_df.png": "textures/eye_df.png"}
FILES.update({f"gekko/textures/{t}.png": f"textures/{t}.png" for t in ("df", "nm", "orm", "em", "decal_df")})
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


def main():
    for url, rel in FILES.items():
        dst = os.path.join(ROOT, "source", rel)
        if os.path.exists(dst):
            continue
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        req = urllib.request.Request(BASE + url, headers={"User-Agent": UA})
        data = urllib.request.urlopen(req, timeout=60).read()
        open(dst, "wb").write(data)
        print(f"{rel}: {len(data)} bytes")


if __name__ == "__main__":
    main()
