"""Which layers make up the back of her hips, and what are they weighted to in her own rig?

Layer = the colour of the DonB texel under each face: coat shell (dark teal-grey), lining (maroon), trousers
(near-black), shirt (light). Heights are in her own FBX units (thighs at ~2.30, knees at ~1.39)."""
import collections
import sys

import bpy
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
fbx, tex = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx)
body = next(o for o in bpy.data.objects if o.type == 'MESH')
me = body.data
img = bpy.data.images.load(tex)
img.scale(1024, 1024)
px = np.zeros(1024 * 1024 * 4, np.float32)
img.pixels.foreach_get(px)
px = px.reshape(1024, 1024, 4)
uv = me.uv_layers[0].data
names = {g.index: g.name for g in body.vertex_groups}
b_idx = next(i for i, m in enumerate(me.materials) if m.name == 'DonB')


def layer(c):
    r, g, b = c
    if max(c) > 0.6:
        return 'shirt/light'
    if r > g * 1.4 and r > b * 1.4:
        return 'lining'
    if max(c) < 0.16:
        return 'trousers/black'
    return 'coat'


stats = collections.defaultdict(collections.Counter)
counts = collections.Counter()
for p in me.polygons:
    if p.material_index != b_idx:
        continue
    c = p.center
    # back of the hips and upper thighs: behind the body centre, between mid-thigh and the waist
    if not (1.75 < c.z < 2.55 and c.y > 0.05 and abs(c.x) < 0.45):
        continue
    u = sum(uv[li].uv[0] for li in p.loop_indices) / p.loop_total
    v = sum(uv[li].uv[1] for li in p.loop_indices) / p.loop_total
    lay = layer(px[min(int(v % 1 * 1024), 1023), min(int(u % 1 * 1024), 1023), :3])
    counts[lay] += 1
    for vi in p.vertices:
        for g in me.vertices[vi].groups:
            stats[lay][names[g.group]] += g.weight
for lay, cnt in counts.most_common():
    tot = sum(stats[lay].values())
    print('HIPS', lay, 'faces', cnt, {k: round(v / tot, 2) for k, v in stats[lay].most_common(7)})
