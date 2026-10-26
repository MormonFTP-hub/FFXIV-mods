"""Collect canvas captures the PMP viewer page uploaded (see window.fourViews in the session notes) into work/viewer
and lay them out as <tag>_sheet.png (front/side/back) and <tag>_heads.png (head front/back).

    python -P -E tools/viewer_collect.py v2
"""
import os
import shutil
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UP = r"E:\FFXIV-mods\PmpViewer\work\uploads"
OUT = os.path.join(ROOT, "work", "viewer")
tag = sys.argv[1]
views = ("front", "side", "back", "head", "headback")
for v in views:
    src = os.path.join(UP, f"{tag}_{v}.zip")
    if os.path.exists(src):
        shutil.move(src, os.path.join(OUT, f"{tag}_{v}.png"))
ims = [Image.open(os.path.join(OUT, f"{tag}_{v}.png")).convert("RGB") for v in views[:3]]
sheet = Image.new("RGB", (sum(i.width for i in ims), max(i.height for i in ims)))
x = 0
for im in ims:
    sheet.paste(im, (x, 0))
    x += im.width
sheet.save(os.path.join(OUT, f"{tag}_sheet.png"))
heads = [Image.open(os.path.join(OUT, f"{tag}_{v}.png")).convert("RGB") for v in views[3:]]
hs = Image.new("RGB", (sum(i.width for i in heads), max(i.height for i in heads)))
x = 0
for im in heads:
    hs.paste(im, (x, 0))
    x += im.width
hs.save(os.path.join(OUT, f"{tag}_heads.png"))
print("ok")
