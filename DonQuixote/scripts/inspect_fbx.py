import bpy, sys
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=argv[0])
for o in bpy.data.objects:
    print('OBJ', o.type, o.name, 'parent=', o.parent.name if o.parent else None, 'scale=', tuple(round(s, 4) for s in o.scale), 'rot=', tuple(round(r, 3) for r in o.rotation_euler))
    if o.type == 'MESH':
        me = o.data
        ws = [o.matrix_world @ Vector(c) for c in o.bound_box]
        print('   verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons), 'mats', [m.name if m else None for m in me.materials], 'uvs', [u.name for u in me.uv_layers], 'shapekeys', len(me.shape_keys.key_blocks) if me.shape_keys else 0)
        print('   bbox min', tuple(round(min(v[i] for v in ws), 3) for i in range(3)), 'max', tuple(round(max(v[i] for v in ws), 3) for i in range(3)))
        print('   vgroups', len(o.vertex_groups))
    if o.type == 'ARMATURE':
        for b in o.data.bones:
            h = o.matrix_world @ b.head_local
            print('   BONE', b.name, 'parent=', b.parent.name if b.parent else None, 'head=', tuple(round(x, 3) for x in h))
