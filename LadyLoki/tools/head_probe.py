import sys, pickle; sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import render, ttdb, retarget, numpy as np
from PIL import Image
W = 'E:/FFXIV-mods/LadyLoki/work/'; S = 'E:/FFXIV-mods/LadyLoki/source/'
groups, joints, _ = pickle.load(open(W + 'loki_groups.pkl', 'rb'))
hs = float(sys.argv[1]) if len(sys.argv) > 1 else None
off = np.array([float(v) for v in sys.argv[2:5]]) if len(sys.argv) > 4 else np.zeros(3)
T, J, parent = retarget.build(head_scale=hs, head_offset=off)
head = [g for g in groups if g['name'].endswith('_Head')][0]
p, n = retarget.apply(T, J, parent, joints, head['pos'], head['nrm'], head['J'], head['W'], override_segment='head')
m = p[:, 1] > retarget.ffskel.load()['j_kao']['world'][1, 3] - 0.02
print('loki head bbox', p[m].min(0).round(4), p[m].max(0).round(4))
face = ttdb.read(W + 'game/chara_human_c0201_obj_face_f0001_model_c0201f0001_fac.db')
hair = ttdb.read(W + 'game/chara_human_c0201_obj_hair_h0001_model_c0201h0001_hir.db')
fp = np.concatenate([pp.pos for mm in face['meshes'][:1] for pp in mm.parts])
print('ff face bbox', fp.min(0).round(4), fp.max(0).round(4))
items = [{'pos': p, 'nrm': n, 'uv': head['uv'], 'tris': head['tris'], 'tex': np.array(Image.open(S + 'T_1016504_Head_D.png').convert('RGBA'))}]
ffi = []
for mm in face['meshes'][:1]:
    for pp in mm.parts: ffi.append({'pos': pp.pos, 'nrm': pp.nrm, 'uv': pp.uv, 'tris': pp.tris, 'tex': None, 'color': (120, 170, 230)})
hi = []
for mm in hair['meshes']:
    for pp in mm.parts: hi.append({'pos': pp.pos, 'nrm': pp.nrm, 'uv': pp.uv, 'tris': pp.tris, 'tex': None, 'color': (200, 120, 90)})
X=np.array([1,0,0.]);Y=np.array([0,1,0.]);Z=np.array([0,0,1.])
bnd = (0, 1.53, 0.15)
ims = [render.render(items + ffi, right=X, up=Y, size=600, bounds=bnd)[0], render.render(items + ffi, right=Z, up=Y, size=600, bounds=(0.02, 1.53, 0.15))[0],
       render.render(ffi, right=Z, up=Y, size=600, bounds=(0.02, 1.53, 0.15))[0], render.render(ffi + hi, right=Z, up=Y, size=600, bounds=(0.02, 1.53, 0.15))[0]]
s = Image.new('RGB', (2400, 600))
for i, im in enumerate(ims): s.paste(im, (i * 600, 0))
s.save(W + 'head_probe.png')
