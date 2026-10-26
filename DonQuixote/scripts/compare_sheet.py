"""Lay out the 1.0.0 -> 1.1.0 comparison: in-game screenshot crop, GS 1.0.0, GS 1.1.0 (head), and the hands.

usage: python -P -E compare_sheet.py <project_dir> <in-game screenshot>
"""
import os
import sys

from PIL import Image, ImageDraw

ROOT, SHOT = sys.argv[1], sys.argv[2]
GS = os.path.join(ROOT, 'work', 'gs')
H = 520

shot = Image.open(SHOT).convert('RGB')
w, h = shot.size
tiles = [
    ('in game 1.0.0', shot.crop((int(w * 0.28), int(h * 0.08), int(w * 0.68), int(h * 0.33)))),
    ('GS 1.0.0', Image.open(os.path.join(GS, 'full_idle_head.png')).convert('RGB')),
    ('GS 1.1.0', Image.open(os.path.join(GS, 'v11g_head.png')).convert('RGB')),
]
hands = Image.open(os.path.join(GS, 'hands_before_after.png')).convert('RGB')
hands_new = Image.open(os.path.join(GS, 'hands_v11b.png')).convert('RGB')
row2 = [('GS 1.0.0 hands (idle)', hands.crop((0, 0, 896, 416))), ('GS 1.1.0 hands (idle)', hands_new)]

def fit(im, height):
    return im.resize((round(im.width * height / im.height), height), Image.LANCZOS)

row1 = [(t, fit(im, H)) for t, im in tiles]
row2 = [(t, fit(im, 400)) for t, im in row2]
width = max(sum(im.width for _, im in row1), sum(im.width for _, im in row2)) + 40
sheet = Image.new('RGB', (width, H + 400 + 90), (24, 26, 32))
draw = ImageDraw.Draw(sheet)
x = 10
for t, im in row1:
    sheet.paste(im, (x, 30))
    draw.text((x + 6, 8), t, fill=(230, 230, 230))
    x += im.width + 10
x = 10
for t, im in row2:
    sheet.paste(im, (x, H + 80))
    draw.text((x + 6, H + 58), t, fill=(230, 230, 230))
    x += im.width + 10
out = os.path.join(ROOT, 'work', 'compare_1.0.0_vs_1.1.0.png')
sheet.save(out)
print('wrote', out, sheet.size)
