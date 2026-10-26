"""Side-by-side sheet: the source render next to game-shader (GS) captures from the PMP Viewer, each cropped to the
figure and scaled to the same height.

python -P -E tools/compare_gs.py <out.png> <image> [image ...]
The first image's background colour is sampled from its corners; every image is cropped to the pixels that differ
from its own corner colour.
"""
import sys

import numpy as np
from PIL import Image, ImageDraw

H = 1000


def crop(path):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(int)
    bg = np.median(np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3),
                                   a[-8:, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)]), 0)
    fg = np.abs(a - bg).sum(-1) > 30
    ys, xs = np.nonzero(fg)
    pad = 10
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, im.width), min(ys.max() + pad, im.height))
    im = im.crop(box)
    return im.resize((int(im.width * H / im.height), H), Image.LANCZOS)


def main(out, paths):
    ims = [crop(p) for p in paths]
    sheet = Image.new("RGB", (sum(i.width for i in ims) + 20 * (len(ims) - 1), H + 24), (40, 40, 46))
    d = ImageDraw.Draw(sheet)
    x = 0
    for p, im in zip(paths, ims):
        sheet.paste(im, (x, 24))
        d.text((x + 4, 4), p.replace("\\", "/").rsplit("/", 1)[-1], fill=(255, 255, 0))
        x += im.width + 20
    sheet.save(out)
    print(out, sheet.size)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
