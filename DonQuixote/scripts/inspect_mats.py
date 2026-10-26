import sys
import bpy

argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=argv[0])
me_obj = next(o for o in bpy.data.objects if o.type == 'MESH')
me = me_obj.data
counts = {}
for p in me.polygons:
    counts[p.material_index] = counts.get(p.material_index, 0) + 1
for i, m in enumerate(me.materials):
    imgs = []
    if m and m.use_nodes:
        imgs = [(n.image.name, n.image.filepath) for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image]
    print('MAT', i, m.name if m else None, 'faces', counts.get(i, 0), imgs)
print('SHAPEKEYS', [k.name for k in me.shape_keys.key_blocks] if me.shape_keys else [])
used = {}
for v in me.vertices:
    for g in v.groups:
        if g.weight > 0.001:
            used[g.group] = used.get(g.group, 0) + 1
print('VGROUPS', [(vg.name, used.get(vg.index, 0)) for vg in me_obj.vertex_groups])
mx = max(len([g for g in v.groups if g.weight > 0.001]) for v in me.vertices)
print('MAX_INFLUENCES', mx)
# Which material each bone group mostly affects (to see how the hair is skinned).
for vg in me_obj.vertex_groups:
    if vg.name in ('face', 'spine.004', 'Eye.L', 'Eye.R'):
        mats = {}
        for p in me.polygons:
            for vi in p.vertices:
                for g in me.vertices[vi].groups:
                    if g.group == vg.index and g.weight > 0.001:
                        mats[me.materials[p.material_index].name] = mats.get(me.materials[p.material_index].name, 0) + 1
        print('GROUP_MATS', vg.name, mats)
