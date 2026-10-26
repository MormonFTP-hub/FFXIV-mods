import sys, numpy as np; sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import ttdb, render
from PIL import Image
exec(open('E:/FFXIV-mods/LadyLoki/tools/verify_models.py').read().split('models = {')[0])
V = 'E:/FFXIV-mods/LadyLoki/work/verify/'; W = 'E:/FFXIV-mods/LadyLoki/work/'
def load(k, shift=None):
    its = []
    for m in ttdb.read(V + k + '.db')['meshes']:
        for p in m.parts:
            P = p.pos if shift is None else p.pos + shift
            its.append({'pos': P, 'nrm': p.nrm, 'uv': p.uv, 'tris': p.tris, 'tex': tex_for(m.material), 'color': (232, 196, 178) if 'b0001' in m.material else (60, 60, 70)})
    return its
face = ttdb.read(W + 'game/chara_human_c0201_obj_face_f0001_model_c0201f0001_fac.db')
hair = ttdb.read(W + 'game/chara_human_c0201_obj_hair_h0001_model_c0201h0001_hir.db')
head = [{'pos': p.pos, 'nrm': p.nrm, 'uv': p.uv, 'tris': p.tris, 'tex': None, 'color': (232, 196, 178)} for p in face['meshes'][0].parts]
hh = [{'pos': p.pos, 'nrm': p.nrm, 'uv': p.uv, 'tris': p.tris, 'tex': None, 'color': (70, 50, 60)} for m in hair['meshes'] for p in m.parts]
body = load('top') + load('dwn') + load('glv') + load('sho')
staff = load('weapon', shift=np.array([-0.62, 0.95, 0.05]))
X=np.array([1,0,0.]);Y=np.array([0,1,0.]);Z=np.array([0,0,1.])
b = (-0.1, 0.95, 0.95)
a, _ = render.render(body + head + hh + load('met_headpiece') + staff, right=X, up=Y, size=1000, bounds=b, bg=(30, 34, 44))
c, _ = render.render(body + head + load('met_hair') + staff, right=X, up=Y, size=1000, bounds=b, bg=(30, 34, 44))
d, _ = render.render(body + head + load('met_hair'), right=-X, up=Y, size=1000, bounds=(0.1, 0.95, 0.95), bg=(30, 34, 44))
s = Image.new('RGB', (3000, 1000)); s.paste(a, (0, 0)); s.paste(c, (1000, 0)); s.paste(d, (2000, 0))
s.save('E:/FFXIV-mods/LadyLoki/out/preview.png')
