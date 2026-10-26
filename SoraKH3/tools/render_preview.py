"""Render front/side/back previews of the fitted model with FFXIV joints marked.

run_blender.ps1 render_preview.py <fitted.blend> <out_prefix> [game_dir]
"""
import math
import os
import sys

import bpy
import mathutils
import numpy as np

blend, out_prefix = sys.argv[1], sys.argv[2]
POSE = len(sys.argv) > 4 and sys.argv[4] == "pose"
bpy.ops.wm.open_mainfile(filepath=blend)
scene = bpy.context.scene

# A stress pose in world axes (Blender: +X = character's left, -Y = forward, +Z = up).
TEST_POSE = {
    "j_sebo_b": ("X", -15), "j_kubi": ("Z", 20), "j_kao": ("Z", 15),
    "j_ude_a_l": ("X", -70), "j_ude_b_l": ("X", -80), "j_te_l": ("Y", 30),
    "j_ude_a_r": ("Y", -40), "j_ude_b_r": ("Z", -60),
    "j_asi_a_l": ("X", -55), "j_asi_b_l": ("X", 75), "j_asi_d_l": ("X", -20),
    "j_asi_a_r": ("X", 20), "j_asi_b_r": ("X", 30),
    "j_hito_a_r": ("Z", -50), "j_naka_a_r": ("Z", -55), "j_kusu_a_r": ("Z", -60), "j_ko_a_r": ("Z", -65),
}
if POSE:
    for ob in scene.objects:
        if ob.type != "ARMATURE":
            continue
        for name, (axis, deg) in TEST_POSE.items():
            pb = ob.pose.bones.get(name)
            if pb is None:
                continue
            rest = pb.bone.matrix_local.to_3x3()
            world = mathutils.Matrix.Rotation(math.radians(deg), 3, axis)
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = (rest.inverted() @ world @ rest).to_quaternion()
    bpy.context.view_layer.update()

joint_mat = bpy.data.materials.new("joint")
joint_mat.diffuse_color = (1, 0.05, 0.05, 1)
for ob in list(scene.objects):
    ob.hide_set(False)
    ob.hide_render = False
    if ob.type == "ARMATURE":
        for b in ob.data.bones:
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, location=ob.matrix_world @ b.head_local, segments=8, ring_count=6)
            s = bpy.context.active_object
            s.data.materials.append(joint_mat)
            s.color = (1, 0.05, 0.05, 1)
    elif ob.type == "MESH" and ob.data.materials and ob.data.materials[0] is not None and ob.data.materials[0].name != "joint":
        name = ob.name.split()[0]
        ob.color = {"top": (0.85, 0.3, 0.3, 1), "glv": (0.95, 0.85, 0.2, 1), "dwn": (0.3, 0.45, 0.9, 1),
                    "sho": (0.4, 0.8, 0.4, 1), "fac": (1.0, 0.8, 0.65, 1), "hir": (0.5, 0.32, 0.18, 1)}.get(name, (0.7, 0.7, 0.7, 1))

scene.render.engine = "BLENDER_WORKBENCH"
shading = scene.display.shading
shading.light = "STUDIO"
shading.color_type = "OBJECT"
shading.show_xray = True
shading.xray_alpha = 0.75
scene.render.resolution_x, scene.render.resolution_y = 700, 1000
scene.render.film_transparent = False
scene.world = scene.world or bpy.data.worlds.new("w")

cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 2.0
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
views = {"front": ((0, -4, 0.95), (math.radians(90), 0, 0), 2.1),
         "side": ((4, 0, 0.95), (math.radians(90), 0, math.radians(90)), 2.1),
         "back": ((0, 4, 0.95), (math.radians(90), 0, math.radians(180)), 2.1),
         "hand": ((0.62, -4, 0.98), (math.radians(90), 0, 0), 0.5),
         "head": ((0, -4, 1.68), (math.radians(90), 0, 0), 0.55),
         "head_side": ((4, 0, 1.68), (math.radians(90), 0, math.radians(90)), 0.55)}
wanted = sys.argv[3].split(",") if len(sys.argv) > 3 else ["front", "side", "back"]
for name in wanted:
    loc, rot, ortho = views[name]
    cam.location = loc
    cam.rotation_euler = rot
    cam_data.ortho_scale = ortho
    scene.render.filepath = f"{out_prefix}_{name}.png"
    bpy.ops.render.render(write_still=True)
    print("rendered", scene.render.filepath)
