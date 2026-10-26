"""out/preview.png: the built Chao (Mammet #001) in bind pose, a walk and a wave, next to an untouched GC mammet."""
import os

from PIL import Image

import check_mdl
import xivdata as xd
from render import OUT

SHOTS = [("bind", "front", "1"), ("bind", "persp", "1"), ("walk", "persp", "1"), ("wave", "front", "1"), ("bind", "front", "2")]


def main():
    tiles = []
    for pose, view, variants in SHOTS:
        check_mdl.main(pose, view, variants)
        tiles.append(Image.open(OUT / f"mdl_{pose}_v{variants}_{view}.png"))
    w, h = tiles[0].size
    sheet = Image.new("RGB", (w * len(tiles), h))
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * w, 0))
    dst = os.path.join(xd.ROOT, "out", "preview.png")
    sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS).save(dst)
    print("wrote", dst)


if __name__ == "__main__":
    main()
