import sys, os, glob, numpy as np; sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import tt, ttdb, render
from PIL import Image
OUT = 'E:/FFXIV-mods/LadyLoki/out/files/'; V = 'E:/FFXIV-mods/LadyLoki/work/verify/'
TEXP = 'E:/FFXIV-mods/LadyLoki/work/tex_png/'
MAT2TEX = {'mt_c0201e6137_top_a': 'suit', 'mt_c0201e6137_top_b': 'trim', 'mt_c0201e6137_dwn_a': 'skirt', 'mt_c0201e6137_met_a': 'hair'}
cache = {}
def tex_for(mat):
    k = MAT2TEX.get(mat)
    if mat.startswith('mt_w1001'): f = TEXP + 'v01_w1001b0071_loki_base.png'
    elif k: f = TEXP + f'v01_c0201e6137_loki_{k}_base.png'
    else: return None
    if f not in cache: cache[f] = np.array(Image.open(f).convert('RGBA'))
    return cache[f]
models = {'top': OUT + 'chara/equipment/e6137/model/c0201e6137_top.mdl', 'dwn': OUT + 'chara/equipment/e6137/model/c0201e6137_dwn.mdl',
          'glv': OUT + 'chara/equipment/e6137/model/c0201e6137_glv.mdl', 'sho': OUT + 'chara/equipment/e6137/model/c0201e6137_sho.mdl',
          'met_hair': OUT + 'models/met_hair/chara/equipment/e6137/model/c0201e6137_met.mdl',
          'met_headpiece': OUT + 'models/met_headpiece/chara/equipment/e6137/model/c0201e6137_met.mdl',
          'weapon': OUT + 'chara/weapon/w1001/obj/body/b0071/model/w1001b0071.mdl'}
items = {}
for k, f in models.items():
    ff = 'chara/weapon/w1001/obj/body/b0071/model/w1001b0071.mdl' if k == 'weapon' else 'chara/equipment/e6137/model/c0201e6137_%s.mdl' % k[:3]
    db = V + k + '.db'
    tt.unwrap(os.path.normpath(f), os.path.normpath(db), ff)
    d = ttdb.read(db)
    its = []
    for m in d['meshes']:
        for p in m.parts:
            mw = (p.weights > 0).sum(1).max()
            print(f'{k:14s} {m.material:28s} attr={p.attributes:22s} v={len(p.pos):6d} t={len(p.tris):6d} maxw={mw} wsum=[{p.weights.sum(1).min():.3f},{p.weights.sum(1).max():.3f}] bones={sorted(set(b for b in p.bones.ravel() if b))[:6]}...')
            t = tex_for(m.material)
            its.append({'pos': p.pos, 'nrm': p.nrm, 'uv': p.uv, 'tris': p.tris, 'tex': t, 'color': (225, 180, 160) if 'b0001' in m.material else (60, 60, 70)})
    items[k] = its
X=np.array([1,0,0.]);Y=np.array([0,1,0.]);Z=np.array([0,0,1.])
body = items['top'] + items['dwn'] + items['glv'] + items['sho']
for name, its in (('hair', body + items['met_hair']), ('nohair', body + items['met_headpiece'])):
    ims = []; b = None
    for r in (X, Z, -X):
        im, b = render.render(its, right=r, up=Y, size=900, bounds=b); ims.append(im)
    s = Image.new('RGB', (2700, 900))
    for i, im in enumerate(ims): s.paste(im, (i * 900, 0))
    s.save(V + f'final_{name}.png')
im, _ = render.render(items['weapon'], right=-Z, up=Y, size=700)
im2, _ = render.render(items['weapon'], right=X, up=Y, size=700)
s = Image.new('RGB', (1400, 700)); s.paste(im, (0, 0)); s.paste(im2, (700, 0)); s.save(V + 'final_weapon.png')
