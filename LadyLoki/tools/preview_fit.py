import sys, pickle; sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import render, ttdb, numpy as np
from PIL import Image
W = 'E:/FFXIV-mods/LadyLoki/work/'; S = 'E:/FFXIV-mods/LadyLoki/source/'
fitd = pickle.load(open(W + 'outfit_fit.pkl', 'rb'))
TEX = {'suit': 'T_1016504_Equip_03_D', 'gold': 'T_1016504_Equip_02_D', 'skirt': 'T_1016504_Equip_01_D', 'acc6': 'T_1016504_Equip_06_D', 'acc7': 'T_1016504_Equip_07_D', 'hair': 'T_1016504_Hair_D'}
cache = {}
def tex(k):
    if k not in cache: cache[k] = np.array(Image.open(S + TEX[k] + '.png').convert('RGBA'))
    return cache[k]
SLOTCOL = {'top': (230, 90, 90), 'dwn': (90, 200, 90), 'glv': (90, 120, 240), 'sho': (240, 200, 60), 'met': (200, 90, 220)}
items = []; slot_items = []
for slot, lst in fitd['slots'].items():
    for x in lst:
        items.append({'pos': x['pos'], 'nrm': x['nrm'], 'uv': x['uv'], 'tris': x['tris'], 'tex': tex(x['material'])})
        slot_items.append({'pos': x['pos'], 'nrm': x['nrm'], 'uv': x['uv'], 'tris': x['tris'], 'tex': None, 'color': SLOTCOL[slot]})
bibo = []
for slot, lst in fitd['bibo'].items():
    for x in lst:
        p = x['part']
        col = (225, 180, 160) if 'b0001' in x['material'] else (60, 60, 70)
        bibo.append({'pos': p.pos, 'nrm': p.nrm, 'uv': p.uv, 'tris': p.tris[x['keep']], 'tex': None, 'color': col})
X=np.array([1,0,0.]);Y=np.array([0,1,0.]);Z=np.array([0,0,1.])
views = [(X, Y), (Z, Y), (-X, Y)]
imgs = []; b = None
for r, u in views:
    im, b = render.render(items + bibo, right=r, up=u, size=900, bounds=b); imgs.append(im)
im, b = render.render(slot_items + bibo, right=X, up=Y, size=900, bounds=b); imgs.append(im)
s = Image.new('RGB', (3600, 900))
for i, im in enumerate(imgs): s.paste(im, (i*900, 0))
s.save(W + 'preview_fit.png')
# close-up of torso
im, _ = render.render(items + bibo, right=X, up=Y, size=1000, bounds=(0, 1.2, 0.3))
im2, _ = render.render(items + bibo, right=Z, up=Y, size=1000, bounds=(0, 1.2, 0.3))
s = Image.new('RGB', (2000, 1000)); s.paste(im, (0, 0)); s.paste(im2, (1000, 0)); s.save(W + 'preview_fit_torso.png')
