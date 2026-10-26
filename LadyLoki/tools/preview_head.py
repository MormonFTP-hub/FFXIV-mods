import sys, pickle; sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import render, ttdb, numpy as np
from PIL import Image
W = 'E:/FFXIV-mods/LadyLoki/work/'; S = 'E:/FFXIV-mods/LadyLoki/source/'
fitd = pickle.load(open(W + 'outfit_fit.pkl', 'rb'))
TEX = {'suit': 'T_1016504_Equip_03_D', 'gold': 'T_1016504_Equip_02_D', 'skirt': 'T_1016504_Equip_01_D', 'acc6': 'T_1016504_Equip_06_D', 'acc7': 'T_1016504_Equip_07_D', 'hair': 'T_1016504_Hair_D'}
cache = {}
def tex(k):
    if k not in cache:
        cache[k] = np.array(Image.open(S + TEX[k] + '.png').convert('RGBA'))
        if k == 'hair': cache[k][..., 3] = 255
    return cache[k]
with_hair = len(sys.argv) > 1 and sys.argv[1] == 'hair'
items = [{'pos': x['pos'], 'nrm': x['nrm'], 'uv': x['uv'], 'tris': x['tris'], 'tex': tex(x['material'])} for x in fitd['slots']['met'] if with_hair or not x['hair']]
items += [{'pos': x['pos'], 'nrm': x['nrm'], 'uv': x['uv'], 'tris': x['tris'], 'tex': tex(x['material'])} for x in fitd['slots']['top']]
face = ttdb.read(W + 'game/chara_human_c0201_obj_face_f0001_model_c0201f0001_fac.db')
ff = [{'pos': p.pos, 'nrm': p.nrm, 'uv': p.uv, 'tris': p.tris, 'tex': None, 'color': (225, 180, 160)} for p in face['meshes'][0].parts]
if not with_hair:
    hair = ttdb.read(W + 'game/chara_human_c0201_obj_hair_h0001_model_c0201h0001_hir.db')
    ff += [{'pos': p.pos, 'nrm': p.nrm, 'uv': p.uv, 'tris': p.tris, 'tex': None, 'color': (90, 60, 50)} for m in hair['meshes'] for p in m.parts]
for x in fitd['bibo'].get('top', []):
    p = x['part']; ff.append({'pos': p.pos, 'nrm': p.nrm, 'uv': p.uv, 'tris': p.tris[x['keep']], 'tex': None, 'color': (225, 180, 160)})
X=np.array([1,0,0.]);Y=np.array([0,1,0.]);Z=np.array([0,0,1.])
ims = [render.render(items + ff, right=r, up=Y, size=700, bounds=(c, 1.53, 0.17))[0] for r, c in ((X, 0), (Z, 0.02), (-X, 0))]
s = Image.new('RGB', (2100, 700))
for i, im in enumerate(ims): s.paste(im, (i * 700, 0))
s.save(W + ('head_hair.png' if with_hair else 'head_nohair.png'))
