"""Paste PNGs side by side: python -P -E tools/sheet.py out.png in1.png in2.png ... [--scale 0.66]"""
import sys

from PIL import Image

args = sys.argv[1:]
scale = 1.0
if "--scale" in args:
    i = args.index("--scale")
    scale = float(args[i + 1])
    del args[i:i + 2]
ims = [Image.open(p).convert("RGB") for p in args[1:]]
w, h = sum(i.width for i in ims), max(i.height for i in ims)
out = Image.new("RGB", (w, h))
x = 0
for im in ims:
    out.paste(im, (x, 0))
    x += im.width
out.resize((int(w * scale), int(h * scale))).save(args[0])
