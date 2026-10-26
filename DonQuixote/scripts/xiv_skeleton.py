"""Build the FFXIV c0201 skeleton as a Blender armature from the JSON made by hkx_skeleton.py.

Havok data is Y-up in metres; Blender is Z-up, so (x, y, z) -> (x, -z, y), the same conversion
the glTF importer/exporter applies. The character then faces -Y, like any Blender model.
"""
import json
import bpy
from mathutils import Matrix, Quaternion, Vector

Y_UP_TO_Z_UP = Matrix.Rotation(1.5707963267948966, 4, 'X')


def world_matrices(bones):
    mats = []
    for b in bones:
        q = Quaternion((b['q'][3], b['q'][0], b['q'][1], b['q'][2]))
        local = Matrix.Translation(Vector(b['t'])) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((*b['s'], 1.0))
        mats.append(local if b['parent'] < 0 else mats[b['parent']] @ local)
    return [Y_UP_TO_Z_UP @ m for m in mats]


def build_armature(json_path, name='c0201'):
    bones = json.load(open(json_path))
    mats = world_matrices(bones)
    arm = bpy.data.armatures.new(name)
    obj = bpy.data.objects.new(name, arm)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    edit = {}
    for b, m in zip(bones, mats):
        eb = arm.edit_bones.new(b['name'])
        head = m.to_translation()
        # Bone axis: towards the first child if there is one, else keep the parent's direction.
        children = [i for i, c in enumerate(bones) if c['parent'] == bones.index(b)]
        eb.head = head
        eb.tail = head + Vector((0, 0, 0.02))
        edit[b['name']] = (eb, children)
    for i, b in enumerate(bones):
        eb, children = edit[b['name']]
        if b['parent'] >= 0:
            eb.parent = arm.edit_bones[bones[b['parent']]['name']]
        far = [mats[c].to_translation() for c in children if (mats[c].to_translation() - eb.head).length > 0.005]
        if far:
            eb.tail = min(far, key=lambda p: (p - eb.head).length)
        elif eb.parent and (eb.head - eb.parent.head).length > 1e-4:
            eb.tail = eb.head + (eb.head - eb.parent.head).normalized() * 0.03
    bpy.ops.object.mode_set(mode='OBJECT')
    return obj, {b['name']: m for b, m in zip(bones, mats)}
