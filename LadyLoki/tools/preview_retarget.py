import sys, pickle; sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import retarget, render, ttdb, numpy as np
from PIL import Image
groups, joints, ibm = pickle.load(open('E:/FFXIV-mods/LadyLoki/work/loki_groups.pkl','rb'))
T, J, parent = retarget.build()
S = 'E:/FFXIV-mods/LadyLoki/source/'
texmap = {'Body_01':'T_1016504_Body_01_D','Body_02':'T_1016504_Body_02_D','Equip_01':'T_1016504_Equip_01_D','Equip_02':'T_1016504_Equip_02_D','Equip_03':'T_1016504_Equip_03_D','Equip_05':'T_1016504_Equip_02_D','Equip_06':'T_1016504_Equip_06_D','Equip_07':'T_1016504_Equip_07_D','Hair_01':'T_1016504_Hair_D','Hair_02':'T_1016504_Hair_D','Head':'T_1016504_Head_D'}
cache = {}; items = []; ret = {}
for g in groups:
    key = g['name'].replace('MI_WP_1016504_','').replace('MI_1016504_','')
    if key in ('Weapon_01','Eyes_01','Eyes_02','Equip_08'): continue
    p, n = retarget.apply(T, J, parent, joints, g['pos'], g['nrm'], g['J'], g['W'])
    ret[g['index']] = (p, n)
    f = texmap.get(key)
    tex = None
    if f:
        if f not in cache: cache[f] = np.array(Image.open(S + f + '.png').convert('RGBA'))
        tex = cache[f]
    uv = g['uv2'] if key == 'Hair_01' else g['uv']
    items.append({'pos': p, 'nrm': n, 'uv': uv, 'tris': g['tris'], 'tex': tex})
pickle.dump(ret, open('E:/FFXIV-mods/LadyLoki/work/retargeted.pkl','wb'))
bibo = []
for f in ['top_nude_m','dwn_sfw_m','glv','sho']:
    d = ttdb.read(f'E:/FFXIV-mods/LadyLoki/work/bibo/{f}.db')
    for m in d['meshes']:
        for p in m.parts:
            bibo.append({'pos': p.pos, 'nrm': p.nrm, 'uv': p.uv, 'tris': p.tris, 'tex': None, 'color': (120, 170, 230)})
X=np.array([1,0,0.]);Y=np.array([0,1,0.]);Z=np.array([0,0,1.])
imgs = []; b = None
for its in (items, bibo, items + bibo):
    im, b = render.render(its, right=-X, up=Y, size=800, bounds=b); imgs.append(im)
im, b = render.render(items + bibo, right=Z, up=Y, size=800, bounds=b); imgs.append(im)
s = Image.new('RGB', (3200, 800))
for i, im in enumerate(imgs): s.paste(im, (i*800, 0))
s.save('E:/FFXIV-mods/LadyLoki/work/preview_retarget.png')
