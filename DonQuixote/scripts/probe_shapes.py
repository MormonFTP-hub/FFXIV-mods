import sys
import bpy
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=argv[0])
obj = next(o for o in bpy.data.objects if o.type == 'MESH')
me = obj.data
for kb in me.shape_keys.key_blocks:
    print('KEY', kb.name, 'value', round(kb.value, 3), 'mute', kb.mute)
basis = np.array([v.co for v in me.shape_keys.key_blocks[0].data])
wverts = sorted({vi for p in me.polygons if me.materials[p.material_index].name == 'DonW' for vi in p.vertices})
print('DONW basis bbox', basis[wverts].min(0).round(3), basis[wverts].max(0).round(3))
for kb in me.shape_keys.key_blocks[1:]:
    co = np.array([v.co for v in kb.data])
    moved = np.linalg.norm(co - basis, axis=1) > 1e-4
    print('KEYMOVES', kb.name, int(moved.sum()), 'of which DonW', int(moved[wverts].sum()))
    if moved[wverts].any():
        print('   DonW bbox with key', co[wverts].min(0).round(3), co[wverts].max(0).round(3))
