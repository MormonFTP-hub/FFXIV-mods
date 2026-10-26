"""Sample the face texture where the neck front's centre line falls: ray-cast the neck at x = 0 and around it,
read each hit's UV and the source/built texel colours there."""
import sys
import bpy
import numpy as np
from mathutils import Vector
from mathutils.interpolate import poly_3d_calc

argv = sys.argv[sys.argv.index('--') + 1:]
blend, src_png, built_png = argv[0], argv[1], argv[2]
bpy.ops.wm.open_mainfile(filepath=blend)
imgs = {}
for key, path in (('src', src_png), ('built', built_png)):
    im = bpy.data.images.load(path)
    w, h = im.size
    px = np.zeros(w * h * 4, np.float32)
    im.pixels.foreach_get(px)
    imgs[key] = (px.reshape(h, w, 4), w, h)
dg = bpy.context.evaluated_depsgraph_get()
scene = bpy.context.scene
for z in (1.42, 1.44, 1.46):
    for x_mm in (-2, -1, -0.3, 0.0, 0.3, 1, 2):
        hit, loc, nrm, idx, obj, _ = scene.ray_cast(dg, Vector((x_mm / 1000, -0.5, z)), Vector((0, 1, 0)))
        if not hit or obj.name != 'Don_1':
            continue
        me = obj.data
        poly = me.polygons[idx]
        vs = [me.vertices[i].co for i in poly.vertices]
        wts = poly_3d_calc(vs, loc)
        uv = sum((Vector(me.uv_layers[0].data[li].uv) * wt for li, wt in zip(poly.loop_indices, wts)), Vector((0, 0)))
        out = []
        for key, (px, w, h) in imgs.items():
            c = px[min(int(uv.y % 1 * h), h - 1), min(int(uv.x % 1 * w), w - 1), :3]
            out.append(f'{key}={tuple(int(v * 255) for v in c)}')
        print('TEX z', z, 'x', x_mm, 'uv', (round(uv.x, 4), round(uv.y, 4)), ' '.join(out))
