"""Build a .blend with game reference meshes (OBJ, Y-up) and optionally a fitted outfit, for preview renders.

usage: blender -b -P ref_scene.py -- <out.blend> <skeleton.json> [--outfit <outfit.blend>] <ref.obj>...
"""
import sys

import bpy

sys.path.insert(0, __file__.rsplit('\\', 1)[0])
from xiv_skeleton import build_armature  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
out, skel = argv[0], argv[1]
rest = argv[2:]
outfit = None
if rest and rest[0] == '--outfit':
    outfit, rest = rest[1], rest[2:]

if outfit:
    bpy.ops.wm.open_mainfile(filepath=outfit)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build_armature(skel, 'skeleton')

skin = bpy.data.materials.new('REF_skin')
skin.use_nodes = True
nt = skin.node_tree
nt.nodes.clear()
emit = nt.nodes.new('ShaderNodeEmission')
emit.inputs['Color'].default_value = (0.85, 0.62, 0.52, 1)
nt.links.new(emit.outputs['Emission'], nt.nodes.new('ShaderNodeOutputMaterial').inputs['Surface'])

for path in rest:
    before = set(bpy.data.objects)
    bpy.ops.wm.obj_import(filepath=path, forward_axis='NEGATIVE_Z', up_axis='Y')
    for o in set(bpy.data.objects) - before:
        o.data.materials.clear()
        o.data.materials.append(skin)
        print('REF', o.name, [round(v, 3) for v in o.dimensions])

bpy.ops.wm.save_as_mainfile(filepath=out)
print('SAVED', out)
