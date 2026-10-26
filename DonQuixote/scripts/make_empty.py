"""Export a skinned glTF holding one tiny triangle hidden inside the hips: used to blank out gear slots.

usage: blender -b -P make_empty.py -- <c0201_skeleton.json> <out.glb>
"""
import sys

import bpy

sys.path.insert(0, __file__.rsplit('\\', 1)[0])
from xiv_skeleton import build_armature  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
arm, mats = build_armature(argv[0], 'c0201')
c = mats['j_kosi'].to_translation()
eps = 0.0005
me = bpy.data.meshes.new('Empty_0')
me.from_pydata([(c.x, c.y, c.z), (c.x + eps, c.y, c.z), (c.x, c.y, c.z + eps)], [], [(0, 1, 2)])
me.uv_layers.new(name='UVMap')
for i, loop in enumerate(me.uv_layers[0].data):
    loop.uv = ((0, 0), (1, 0), (0, 1))[i]
me.materials.append(bpy.data.materials.new('EMPTY'))
obj = bpy.data.objects.new('Empty_0', me)
bpy.context.scene.collection.objects.link(obj)
obj.vertex_groups.new(name='j_kosi').add([0, 1, 2], 1.0, 'REPLACE')
obj.parent = arm
obj.modifiers.new('Armature', 'ARMATURE').object = arm
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
arm.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=argv[1], export_format='GLB', use_selection=True, export_skins=True,
    export_morph=False, export_animations=False, export_tangents=True, export_vertex_color='NONE',
    export_materials='EXPORT', export_image_format='NONE', export_def_bones=False, export_yup=True,
)
print('EMPTY exported', argv[1])
