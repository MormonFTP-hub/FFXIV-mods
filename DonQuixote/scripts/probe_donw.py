"""Sample each source texture under the UVs of every material, to see which texture each one uses."""
import sys
import bpy
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
fbx, tex_dir = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx)
obj = next(o for o in bpy.data.objects if o.type == 'MESH')
me = obj.data
uv = np.zeros(len(me.loops) * 2)
me.uv_layers[0].data.foreach_get('uv', uv)
uv = uv.reshape(-1, 2)
mat_of_loop = np.zeros(len(me.loops), dtype=int)
for p in me.polygons:
    mat_of_loop[p.loop_start:p.loop_start + p.loop_total] = p.material_index

texs = {}
for key in ('DonB', 'DonF', 'DonH'):
    img = bpy.data.images.load(f'{tex_dir}/Don2_{key}_BaseColor.png')
    w, h = img.size
    px = np.zeros(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    texs[key] = (px.reshape(h, w, 4), w, h)

for mi, m in enumerate(me.materials):
    sel = uv[mat_of_loop == mi]
    print('MATUV', m.name, 'u', sel[:, 0].min().round(3), sel[:, 0].max().round(3), 'v', sel[:, 1].min().round(3), sel[:, 1].max().round(3))
    for key, (px, w, h) in texs.items():
        x = np.clip((sel[:, 0] % 1.0 * w).astype(int), 0, w - 1)
        y = np.clip((sel[:, 1] % 1.0 * h).astype(int), 0, h - 1)
        c = px[y, x, :3]
        print('   SAMPLE', key, 'mean', c.mean(0).round(3), 'black%', round(float((c.sum(1) < 0.03).mean() * 100), 1))
