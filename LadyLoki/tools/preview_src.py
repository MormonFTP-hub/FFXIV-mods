import sys; sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import loki_load, render, numpy as np, pickle
from PIL import Image
groups, joints, ibm = loki_load.load()
pickle.dump((groups, joints, ibm), open('E:/FFXIV-mods/LadyLoki/work/loki_groups.pkl','wb'))
S = 'E:/FFXIV-mods/LadyLoki/source/'
texmap = {'Body_01':'T_1016504_Body_01_D','Body_02':'T_1016504_Body_02_D','Equip_01':'T_1016504_Equip_01_D','Equip_02':'T_1016504_Equip_02_D','Equip_03':'T_1016504_Equip_03_D','Equip_05':'T_1016504_Equip_02_D','Equip_06':'T_1016504_Equip_06_D','Equip_07':'T_1016504_Equip_07_D','Hair_01':'T_1016504_Hair_D','Hair_02':'T_1016504_Hair_D','Head':'T_1016504_Head_D','Weapon_01':'T_WP_1016504_Weapon_02_D','Eyes_01':'T_1016504_Tooth_D'}
cache = {}
items = []
for g in groups:
    key = g['name'].replace('MI_WP_1016504_','').replace('MI_1016504_','')
    tex = None
    if key in texmap:
        f = texmap[key]
        if f not in cache: cache[f] = np.array(Image.open(S + f + '.png').convert('RGBA'))
        tex = cache[f]
        if key.startswith('Hair'):
            tex = tex.copy(); tex[..., 3] = 255
    uv = g['uv2'] if key in ('Weapon_01','Hair_01') else g['uv']
    items.append({'pos': g['pos'], 'nrm': g['nrm'], 'uv': uv, 'tris': g['tris'], 'tex': tex, 'color': (255, 0, 255)})
X = np.array([1,0,0.]); Y = np.array([0,1,0.]); Z = np.array([0,0,1.])
front, b = render.render(items, right=X, up=Z, size=1100)
side, _ = render.render(items, right=-Y, up=Z, size=1100, bounds=b)
back, _ = render.render(items, right=-X, up=Z, size=1100, bounds=b)
sheet = Image.new('RGB', (3300, 1100)); sheet.paste(front, (0,0)); sheet.paste(side, (1100,0)); sheet.paste(back, (2200,0))
sheet.save('E:/FFXIV-mods/LadyLoki/work/preview_src.png')
