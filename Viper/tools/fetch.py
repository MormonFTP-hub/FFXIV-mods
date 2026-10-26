"""Download the Kingdom Archives viewer's Viper files (https://kingdomarchives.com/modelviewer/viper) to source/.

usage: python -P -E tools/fetch.py
The paths are the ones the viewer page loads (its MODEL_JSON and network requests). Files already there are kept.
"""
import os
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "source")
SITE = "https://kingdomarchives.com/uploads/models/agents/"
FILES = {"viper_cs.glb": "viper/viper_cs.glb", "viper_cs.png": "viper/viper_cs.png",
         "textures/eye_df.png": "eye_df.png"}
FILES.update({f"textures/{t}.png": f"viper/textures/{t}.png"
              for p in ("", "hair_", "props_") for t in (p + "df", p + "nm", p + "orm", p + "em")})


def main():
    for dst, src in FILES.items():
        path = os.path.join(SOURCE, dst)
        if os.path.exists(path):
            continue
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(SITE + src, headers={"User-Agent": "Mozilla/5.0",
                                                          "Referer": "https://kingdomarchives.com/modelviewer/viper"})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    data = r.read()
                break
            except Exception as e:  # noqa: BLE001
                print("retry", src, e)
                time.sleep(2)
        else:
            raise RuntimeError(src)
        open(path, "wb").write(data)
        print(f"{dst}: {len(data)} bytes")


if __name__ == "__main__":
    main()
