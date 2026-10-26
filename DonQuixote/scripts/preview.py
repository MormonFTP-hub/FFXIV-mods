"""Render front/side preview images of a model, for checking textures and fit.

usage: blender -b -P preview.py -- <model.fbx|.glb|.blend> <texdir> <out_prefix> [MAT=tex.png ...]
"""
import math
import sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, tex_dir, out = argv[0], argv[1], argv[2]
tex_map = dict(a.split('=', 1) for a in argv[3:])
focus = tex_map.pop('FOCUS', None)  # "x,y,z,size": frame a close-up instead of the whole model

if src.endswith('.blend'):
    bpy.ops.wm.open_mainfile(filepath=src)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if src.endswith('.fbx'):
        bpy.ops.import_scene.fbx(filepath=src)
    else:
        bpy.ops.import_scene.gltf(filepath=src)

scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == 'MESH' and o.visible_get()]

for o in meshes:
    for slot in o.material_slots:
        m = slot.material
        if not m:
            continue
        key = next((k for k in tex_map if k in m.name), None)
        if key is None:
            continue
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(f'{tex_dir}/{tex_map[key]}', check_existing=True)
        emit = nt.nodes.new('ShaderNodeEmission')
        outn = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(tex.outputs['Color'], emit.inputs['Color'])
        nt.links.new(emit.outputs['Emission'], outn.inputs['Surface'])

pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
center = (lo + hi) / 2
height = hi.z - lo.z
if focus:
    fx, fy, fz, size = (float(v) for v in focus.split(','))
    center, height = Vector((fx, fy, fz)), size

scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items.keys() else 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 640, 960
scene.world = scene.world or bpy.data.worlds.new('w')
scene.world.color = (0.18, 0.18, 0.2)

cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = height * 1.1
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

for name, direction in (('front', Vector((0, -1, 0))), ('side', Vector((1, 0, 0))), ('back', Vector((0, 1, 0)))):
    cam.location = center + direction * height * 3
    cam.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = f'{out}_{name}.png'
    bpy.ops.render.render(write_still=True)
    print('RENDERED', scene.render.filepath)
