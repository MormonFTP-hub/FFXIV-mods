"""Fit the Don Quixote VRChat model onto an FFXIV skeleton.

usage: blender -b -P convert.py -- <Don2.fbx> <skeleton.json> <out_dir> [--hat] [--outfit] [--name NAME]

Default: full body (head, hair, hands) on the Hyur Midlander female (c0201) skeleton.
--outfit: clothes only (no head, hair, hat or hands), scaled so her torso matches the target skeleton and
          with legs refitted too, for skeletons with other proportions (e.g. Viera male, c1701).

Steps:
  1. Bake the wanted shape-key mix (hat/lollipop toggles) and drop all shape keys.
  2. Uniformly scale/translate her so her hip joints sit on the FFXIV hip joints.
     At this scale her legs, spine, neck and head already match the game skeleton closely.
  3. Repose arms, hands and fingers so every joint lands on the matching FFXIV joint
     (rotate towards the next joint and stretch along the bone), then bake that pose into the mesh.
  4. Rename/merge her vertex groups to FFXIV bone names, keep at most 4 weights per vertex.
  5. Skin the result to an FFXIV armature, split by material and export a .glb for Penumbra's importer.
"""
import sys

import collections
import math

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, __file__.rsplit('\\', 1)[0])
from xiv_skeleton import build_armature  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
FBX, SKEL_JSON, OUT_DIR = argv[0], argv[1], argv[2]
TEX_DIR = FBX.replace('\\', '/').rsplit('/', 1)[0]
WITH_HAT = '--hat' in argv
OUTFIT = '--outfit' in argv
VARIANT = 'hat' if WITH_HAT else 'nohat'
NAME = argv[argv.index('--name') + 1] if '--name' in argv else f'don_{VARIANT}'

SIDES = ('L', 'R')
WEIGHT_MAP = {
    'spine': 'j_kosi', 'CoatBase': 'j_kosi',
    'spine.001': 'j_sebo_a', 'spine.002': 'j_sebo_b', 'spine.003': 'j_sebo_c',
    'spine.004': 'j_kubi', 'face': 'j_kao', 'Eye.L': 'j_kao', 'Eye.R': 'j_kao',
}
FINGERS = {'thumb': 'oya', 'f_index': 'hito', 'f_middle': 'naka', 'f_ring': 'kusu', 'f_pinky': 'ko'}
for s in SIDES:
    x = s.lower()
    WEIGHT_MAP.update({
        f'shoulder.{s}': f'j_sako_{x}', f'upper_arm.{s}': f'j_ude_a_{x}',
        f'forearm.{s}': f'j_ude_b_{x}', f'hand.{s}': f'j_te_{x}',
        f'thigh.{s}': f'j_asi_a_{x}', f'shin.{s}': f'j_asi_c_{x}',
        f'foot.{s}': f'j_asi_d_{x}', f'toe.{s}': f'j_asi_e_{x}',
    })
    for src, dst in FINGERS.items():
        WEIGHT_MAP[f'{src}.01.{s}'] = f'j_{dst}_a_{x}'
        WEIGHT_MAP[f'{src}.02.{s}'] = f'j_{dst}_b_{x}'
        WEIGHT_MAP[f'{src}.03.{s}'] = f'j_{dst}_b_{x}'
    for side_key, sk in (('F', 'f'), ('S', 's'), ('B', 'b')):
        WEIGHT_MAP[f'Coat{side_key}.{s}.003'] = f'j_sk_{sk}_a_{x}'
        WEIGHT_MAP[f'Coat{side_key}.{s}'] = f'j_sk_{sk}_a_{x}'
        WEIGHT_MAP[f'Coat{side_key}.{s}.002'] = f'j_sk_{sk}_b_{x}'
        WEIGHT_MAP[f'Coat{side_key}.{s}.001'] = f'j_sk_{sk}_c_{x}'

# Bones whose pose is fitted: (bone, joint its head snaps to or None, joint it aims at, child bone it aims with, mode)
#   stretch: rotate onto the joint and stretch along the bone so its child lands on the next joint
#   uniform: rotate onto the joint and scale uniformly (the hand: her palm keeps its shape)
#   rigid:   root on the joint, aim along the game's bone, keep the parent's scale (fingers and thumb)
# Fingers and thumb are rigid pieces rooted on the game's knuckles and aimed along its fingers, and their weights
# are split by position along the game's finger (finger_bones): a stretched or merely re-weighted finger bends
# away from the game's joints and crumples into a claw in the idle pose (Mantis/Asuka lesson).
FIT = []
for s in SIDES:
    x = s.lower()
    FIT += [
        (f'shoulder.{s}', None, f'j_ude_a_{x}', f'upper_arm.{s}', 'stretch'),
        (f'upper_arm.{s}', f'j_ude_a_{x}', f'j_ude_b_{x}', f'forearm.{s}', 'stretch'),
        (f'forearm.{s}', None, f'j_te_{x}', f'hand.{s}', 'stretch'),
        (f'hand.{s}', None, f'j_naka_a_{x}', f'f_middle.01.{s}', 'uniform'),
    ]
    for src, dst in FINGERS.items():
        FIT.append((f'{src}.01.{s}', f'j_{dst}_a_{x}', f'j_{dst}_b_{x}', f'{src}.02.{s}', 'rigid'))
    if OUTFIT:
        FIT += [
            (f'thigh.{s}', f'j_asi_a_{x}', f'j_asi_b_{x}', f'shin.{s}', 'stretch'),
            (f'shin.{s}', None, f'j_asi_d_{x}', f'foot.{s}', 'stretch'),
            (f'foot.{s}', None, f'j_asi_e_{x}', f'toe.{s}', 'stretch'),
        ]
FINGER_BLEND = 0.006  # m either side of the game's j_*_b where a finger's weight hands over from j_*_a
BUTT_LOW = 0.11      # m below the hip joints where the butt is back on the thighs (vanilla: the buttock crease)
BUTT_HIGH = 0.02     # m below the hip joints where it is all j_kosi
CENTRE_BLEND = 0.02  # m either side of the centre line where coat weight hands over between left and right chains
SKIRT_BLEND = 0.05   # m either side of each game skirt joint where a coat panel's weight hands over
LINING_REACH = 0.04  # m: lining vertices further than this from the shell keep their own weights
SKIN_WARMTH = 0.06    # hand/wrist faces whose texels are warmer than this (red - blue) are skin, not shirt cuff

SCALE = 0.4075  # full body on c0201: her thigh->foot length vs the game's j_asi_a->j_asi_d
HAND_BONES = ('hand.', 'thumb.', 'f_index.', 'f_middle.', 'f_ring.', 'f_pinky.')
SKIN_COLOUR = (0.0, 1.0, 1.0, 1.0)  # skin.shpk vertex colour: R = body-style shading, 0 on hands and faces
GEAR_COLOUR = (1.0, 1.0, 1.0, 1.0)  # gear vertex colour must be white (black renders pitch black)


def log(*a):
    print('CONVERT', *a, flush=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=FBX)
src_arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = next(o for o in bpy.data.objects if o.type == 'MESH')
me = body.data

# 1. Shape keys -> baked mix. Her hair shrinks to fit under the hat when the hat is on.
keys = me.shape_keys.key_blocks
for kb in keys:
    kb.value = 0.0
keys['LolShrink'].value = 1.0
keys['HatShrink'].value = 0.0 if WITH_HAT else 1.0
keys['HairShrink'].value = 1.0 if WITH_HAT else 0.0
lol_verts = set()
basis = [v.co.copy() for v in keys[0].data]
for i, v in enumerate(keys['LolShrink'].data):
    if (v.co - basis[i]).length > 1e-4:
        lol_verts.add(i)
hat_verts = set()
for i, v in enumerate(keys['HatShrink'].data):
    if (v.co - basis[i]).length > 1e-4:
        hat_verts.add(i)
mix = [basis[i].copy() for i in range(len(basis))]
for kb in keys[1:]:
    if kb.value:
        for i, v in enumerate(kb.data):
            mix[i] += (v.co - basis[i]) * kb.value
body.shape_key_clear()
for i, v in enumerate(me.vertices):
    v.co = mix[i]

# Drop the lollipop always, and the hat unless asked for.
bm = bmesh.new()
bm.from_mesh(me)
bm.verts.ensure_lookup_table()
drop = lol_verts | (set() if WITH_HAT else hat_verts)
if OUTFIT:
    # Outfit only: the wearer's own head, ears and hands replace hers.
    head_mats = {i for i, m in enumerate(me.materials) if m.name in ('DonF', 'DonH', 'DonW')}
    for p in me.polygons:
        if p.material_index in head_mats:
            drop.update(p.vertices)
    hand_groups = {vg.index for vg in body.vertex_groups if vg.name.startswith(HAND_BONES)}
    for v in me.vertices:
        if sum(g.weight for g in v.groups if g.group in hand_groups) > 0.5:
            drop.add(v.index)
bmesh.ops.delete(bm, geom=[bm.verts[i] for i in drop], context='VERTS')
bm.to_mesh(me)
bm.free()
log('dropped verts', len(drop), 'remaining', len(me.vertices))

# 2. Uniform scale + translation onto the FFXIV hips.
xiv_obj, xiv = build_armature(SKEL_JSON, 'skeleton')
xiv_pos = {n: m.to_translation() for n, m in xiv.items()}
bpy.ops.object.select_all(action='DESELECT')
for o in (src_arm, body):
    o.select_set(True)
bpy.context.view_layer.objects.active = src_arm
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in (src_arm, body):
    assert (o.matrix_world - Matrix.Identity(4)).to_3x3().determinant() == 0 or o.matrix_world == Matrix.Identity(4), o.name
    log('object matrix ok', o.name, o.matrix_world == Matrix.Identity(4))
rest ={b.name: b.matrix_local.copy() for b in src_arm.data.bones}
hip_src = (rest['thigh.L'].translation + rest['thigh.R'].translation) / 2
hip_dst = (xiv_pos['j_asi_a_l'] + xiv_pos['j_asi_a_r']) / 2
if OUTFIT:
    # Match hip-to-neck height; the legs and arms are then stretched onto the joints by the fit.
    SCALE = (xiv_pos['j_kubi'].z - hip_dst.z) / (rest['spine.004'].translation.z - hip_src.z)
    log('outfit scale', round(SCALE, 4))
fit = Matrix.Translation(hip_dst) @ Matrix.Scale(SCALE, 4) @ Matrix.Translation(-hip_src)
me.transform(fit)
bpy.context.view_layer.objects.active = src_arm
bpy.ops.object.mode_set(mode='EDIT')
# Read every bone first: moving a connected child's head also moves its parent's tail.
ends = {eb.name: (fit @ eb.head, fit @ eb.tail) for eb in src_arm.data.edit_bones}
for eb in src_arm.data.edit_bones:
    eb.use_connect = False
for eb in src_arm.data.edit_bones:
    eb.head, eb.tail = ends[eb.name]
bpy.ops.object.mode_set(mode='OBJECT')
for b in src_arm.data.bones:
    b.inherit_scale = 'NONE'
rest = {b.name: b.matrix_local.copy() for b in src_arm.data.bones}
for n in ('thigh.L', 'shin.L', 'foot.L', 'spine.004', 'face', 'upper_arm.L', 'forearm.L', 'hand.L'):
    log('after scale', n, tuple(round(c, 3) for c in rest[n].translation))
log('target', {n: tuple(round(c, 3) for c in xiv_pos[n]) for n in ('j_asi_a_l', 'j_asi_b_l', 'j_asi_d_l', 'j_kubi', 'j_ude_a_l', 'j_ude_b_l', 'j_te_l')})

# 3. Fit the arm pose. D[b] = desired_armature_matrix @ rest^-1 is each bone's deformation.
fit_by_bone = {f[0]: f for f in FIT}
desired = {}
deform = {}
uscale = {}


def rot_part(m):
    return m.to_quaternion().to_matrix().to_4x4()


for bone in src_arm.data.bones:  # parents always come before children
    r = rest[bone.name]
    parent_d = deform[bone.parent.name] if bone.parent else Matrix.Identity(4)
    parent_rot = rot_part(parent_d)
    us = uscale[bone.parent.name] if bone.parent else 1.0
    head = parent_d @ r.translation
    base = Matrix.Translation(head) @ parent_rot @ rot_part(r) @ Matrix.Scale(us, 4)
    spec = fit_by_bone.get(bone.name)
    if spec:
        _, snap, aim, child, mode = spec
        if snap:
            if mode == 'rigid':
                log('root moved', bone.name, 'onto', snap, 'by mm', round((xiv_pos[snap] - head).length * 1000, 1))
            head = xiv_pos[snap].copy()
        cur = parent_rot.to_3x3() @ (rest[child].translation - r.translation)
        tgt = xiv_pos[aim] - head
        delta = cur.rotation_difference(tgt).to_matrix().to_4x4()
        if bone.name.startswith('hand.'):
            # Twist the palm so index->pinky matches the game's j_hito_a->j_ko_a.
            s = bone.name[-1]
            x = s.lower()
            across = (delta @ parent_rot).to_3x3() @ (rest[f'f_pinky.01.{s}'].translation - rest[f'f_index.01.{s}'].translation)
            want = xiv_pos[f'j_ko_a_{x}'] - xiv_pos[f'j_hito_a_{x}']
            axis = tgt.normalized()
            a = (across - axis * across.dot(axis)).normalized()
            w = (want - axis * want.dot(axis)).normalized()
            angle = a.angle(w)
            if a.cross(w).dot(axis) < 0:
                angle = -angle
            delta = Matrix.Rotation(angle, 4, axis) @ delta
        bone_y = (r.to_3x3() @ Vector((0, 1, 0))).normalized()
        off_axis = bone_y.angle((rest[child].translation - r.translation).normalized())
        k = tgt.length / cur.length
        if mode == 'stretch':
            scale, us = Matrix.Diagonal((1.0, k, 1.0)), 1.0
        elif mode == 'uniform':
            scale, us = Matrix.Diagonal((k, k, k)), k
        else:
            scale = Matrix.Diagonal((us, us, us))
            log('turned', bone.name, 'deg', round(cur.angle(tgt) * 57.2958, 1))
        log('fit', bone.name, mode, round(k if mode != 'rigid' else us, 3), 'bone-axis error deg', round(off_axis * 57.2958, 1))
        m3 = (delta @ parent_rot @ rot_part(r)).to_3x3() @ scale
        desired[bone.name] = Matrix.Translation(head) @ m3.to_4x4()
    else:
        desired[bone.name] = base
    uscale[bone.name] = us
    deform[bone.name] = desired[bone.name] @ r.inverted()

bpy.context.view_layer.objects.active = src_arm
bpy.ops.object.mode_set(mode='POSE')
for bone in src_arm.data.bones:
    pb = src_arm.pose.bones[bone.name]
    pb.matrix = desired[bone.name]
    bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='OBJECT')
for s in SIDES:
    x = s.lower()
    for b, j in ((f'forearm.{s}', f'j_ude_b_{x}'), (f'hand.{s}', f'j_te_{x}'), (f'f_index.01.{s}', f'j_hito_a_{x}'), (f'thumb.01.{s}', f'j_oya_a_{x}'), (f'shin.{s}', f'j_asi_b_{x}'), (f'foot.{s}', f'j_asi_d_{x}')):
        got = src_arm.pose.bones[b].head
        log('check', b, 'vs', j, 'error cm', round((got - xiv_pos[j]).length * 100, 2))

mod = next(m for m in body.modifiers if m.type == 'ARMATURE')
bpy.context.view_layer.objects.active = body
bpy.ops.object.modifier_apply(modifier=mod.name)
body.parent = None
if OUTFIT:
    # Her boots sit higher under the ankle than the game's feet: squash everything below the ankles so the
    # soles land on the floor instead of sinking into it.
    ankle = (xiv_pos['j_asi_d_l'].z + xiv_pos['j_asi_d_r'].z) / 2
    low = min(v.co.z for v in me.vertices)
    if low < 0:
        k = ankle / (ankle - low)
        for v in me.vertices:
            if v.co.z < ankle:
                v.co.z = ankle - (ankle - v.co.z) * k
        log('grounded soles', round(low, 3), '->', round(min(v.co.z for v in me.vertices), 3))

# Skin: her face (DonF) and her hands' skin (out of DonB, as DonS) go on the game's skin shader so they shade
# like FFXIV skin and take the character's skin colour. Faces are tagged for the texture build (skin_textures.py):
# 1 face, 2 neck, 3 eyes, 4 hand skin.
names = {vg.index: vg.name for vg in body.vertex_groups}


def vweight(pred):
    return [sum(g.weight for g in v.groups if pred(names[g.group])) for v in me.vertices]


hand_w = vweight(lambda n: n.startswith(HAND_BONES) or n.startswith('forearm.'))
eye_w = vweight(lambda n: n.startswith('Eye.'))
neck_w = vweight(lambda n: n == 'spine.004')
mat_index = {m.name: i for i, m in enumerate(me.materials)}
cats = [0] * len(me.polygons)
img = bpy.data.images.load(TEX_DIR + '/Don2_DonB_BaseColor.png')
img.scale(1024, 1024)
px = np.zeros(1024 * 1024 * 4, dtype=np.float32)
img.pixels.foreach_get(px)
px = px.reshape(1024, 1024, 4)
uv = me.uv_layers[0].data


def texel(p):
    u = sum(uv[li].uv[0] for li in p.loop_indices) / p.loop_total
    v = sum(uv[li].uv[1] for li in p.loop_indices) / p.loop_total
    return px[min(int(v % 1 * 1024), 1023), min(int(u % 1 * 1024), 1023), :3]


def layer(c):
    """Coat layer by the DonB texel colour: the shell is dark teal-grey, the lining maroon."""
    r, g, b = c
    if max(c) > 0.6:
        return 'light'
    if r > g * 1.4 and r > b * 1.4:
        return 'lining'
    if max(c) < 0.16:
        return 'black'
    return 'shell'


face_layer = {p.index: layer(texel(p)) for p in me.polygons if p.material_index == mat_index['DonB']}
vert_layers = [collections.Counter() for _ in me.vertices]
for fi, lay in face_layer.items():
    for vi in me.polygons[fi].vertices:
        vert_layers[vi][lay] += 1
lining_verts = [i for i, c in enumerate(vert_layers) if c and c.most_common(1)[0][0] == 'lining']
shell_faces = [fi for fi, lay in face_layer.items() if lay == 'shell']
if not OUTFIT:
    don_s = next(m for m in me.materials if m.name == 'DonB').copy()
    don_s.name = 'DonS'
    me.materials.append(don_s)
    s_idx = len(me.materials) - 1
    warm = []
    for p in me.polygons:
        n = len(p.vertices)
        if p.material_index == mat_index['DonF']:
            if sum(eye_w[i] for i in p.vertices) / n > 0.5:
                cats[p.index] = 3
            elif sum(neck_w[i] for i in p.vertices) / n > 0.5:
                cats[p.index] = 2
            else:
                cats[p.index] = 1
        elif p.material_index == mat_index['DonB'] and sum(hand_w[i] for i in p.vertices) / n > 0.2:
            # skin if the centroid and most corners sample warm, light texels (the cuff is white, the coat dark);
            # 1.1.0's first pass took only hand-weighted faces and left wrist/back-of-hand skin on the gear material
            pts = [uv[li].uv for li in p.loop_indices]
            pts.append((sum(q[0] for q in pts) / len(pts), sum(q[1] for q in pts) / len(pts)))
            cs = [px[min(int(q[1] % 1 * 1024), 1023), min(int(q[0] % 1 * 1024), 1023), :3] for q in pts]
            ok = [c[0] - c[2] >= SKIN_WARMTH and c.mean() > 0.5 for c in cs]
            warm.append(float(cs[-1][0] - cs[-1][2]))
            if ok[-1] and sum(ok) >= len(ok) / 2:
                p.material_index = s_idx
                cats[p.index] = 4
    w = np.array(warm)
    log('hand faces', len(w), 'warmth r-b percentiles', np.percentile(w, [5, 25, 50, 75, 95]).round(3) if len(w) else None,
        '-> hand skin faces', cats.count(4))
    log('face faces: face', cats.count(1), 'neck', cats.count(2), 'eyes', cats.count(3))
me.attributes.new('dq_cat', 'INT', 'FACE').data.foreach_set('value', cats)


def smoothstep(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def finger_bones(p, dst, x):
    """A finger vertex -> {bone: share}: j_*_a up to the game finger's middle joint, j_*_b past it."""
    a, b = xiv_pos[f'j_{dst}_a_{x}'], xiv_pos[f'j_{dst}_b_{x}']
    t = smoothstep(((p - b).dot((b - a).normalized()) + FINGER_BLEND) / (2 * FINGER_BLEND))
    return {f'j_{dst}_a_{x}': 1 - t, f'j_{dst}_b_{x}': t}


def coat_panels(p):
    """A coat vertex -> {(panel, side): share} by where it sits around the hips, like a vanilla robe: front, side and
    back skirt chains by azimuth between the game's own j_sk_*_a joints, left/right blended across the centre line.
    Her rig split each spot between panels differently for the coat's shell and its red lining, so the two layers
    moved apart in the run and the lining showed through the front flaps (GS, 1.3.0)."""
    cx, cy = xiv_pos['j_kosi'].x, xiv_pos['j_kosi'].y
    out = {}
    right = smoothstep((CENTRE_BLEND - (p.x - cx)) / (2 * CENTRE_BLEND))
    for x, share in (('l', 1 - right), ('r', right)):
        if share <= 0:
            continue
        sign = 1 if x == 'l' else -1
        ang = math.atan2(p.y - cy, max(sign * (p.x - cx), 1e-6))
        keys = [(sk, math.atan2(xiv_pos[f'j_sk_{sk}_a_{x}'].y - cy, sign * (xiv_pos[f'j_sk_{sk}_a_{x}'].x - cx)))
                for sk in ('f', 's', 'b')]
        keys.sort(key=lambda kv: kv[1])
        if ang <= keys[0][1]:
            out[(keys[0][0], x)] = share
        elif ang >= keys[-1][1]:
            out[(keys[-1][0], x)] = share
        else:
            for (k0, a0), (k1, a1) in zip(keys, keys[1:]):
                if a0 <= ang <= a1:
                    t = (ang - a0) / (a1 - a0)
                    out[(k0, x)] = out.get((k0, x), 0.0) + share * (1 - t)
                    out[(k1, x)] = out.get((k1, x), 0.0) + share * t
                    break
    return out


def skirt_bones(p, sk, x):
    """A coat vertex of panel sk (f/s/b) on side x -> {skirt bone: share} by its height along the game's own skirt
    chain: j_sk_*_a above the game's b joint, b between, c below its c joint, blended SKIRT_BLEND either side.
    Her coat chains bend 5-11 cm away from the game's skirt joints; mapped bone for bone, part of each flap turned
    around the wrong pivot and folded into the legs when running (dark patches through the coat in GS, 1.2.0)."""
    zb, zc = xiv_pos[f'j_sk_{sk}_b_{x}'].z, xiv_pos[f'j_sk_{sk}_c_{x}'].z
    t1 = smoothstep((zb + SKIRT_BLEND - p.z) / (2 * SKIRT_BLEND))
    t2 = smoothstep((zc + SKIRT_BLEND - p.z) / (2 * SKIRT_BLEND))
    return {f'j_sk_{sk}_a_{x}': 1 - t1, f'j_sk_{sk}_b_{x}': max(t1 - t2, 0.0), f'j_sk_{sk}_c_{x}': t2}


def along(p, a, b):
    ab = b - a
    return (p - a).dot(ab) / ab.dot(ab)


def twist_helpers(acc, p):
    """Share arm weight with the game's shoulder/elbow/wrist helper bones like vanilla gear (curves from Asuka),
    so twisting the forearm in game poses doesn't pinch the sleeve and wrist."""
    for x in ('l', 'r'):
        ua, fa = acc.get(f'j_ude_a_{x}', 0.0), acc.get(f'j_ude_b_{x}', 0.0)
        if ua == 0 and fa == 0:
            continue
        t_up = along(p, xiv_pos[f'j_ude_a_{x}'], xiv_pos[f'j_ude_b_{x}'])
        t_fo = along(p, xiv_pos[f'j_ude_b_{x}'], xiv_pos[f'j_te_{x}'])
        hk = float(np.interp(t_up, [0.0, 0.25, 0.45, 0.6, 0.75], [0.6, 0.6, 0.45, 0.2, 0.0]))
        if t_up <= 1.0:
            hj = float(np.interp(t_up, [0.75, 0.9, 1.0], [0.0, 0.35, 0.25]))
        else:
            hj = float(np.interp(t_fo, [0.0, 0.1, 0.2], [0.25, 0.08, 0.0]))
        ht = float(np.interp(t_fo, [0.1, 0.3, 0.45, 0.6, 0.85, 1.0], [0.08, 0.15, 0.4, 0.55, 0.8, 0.8]))
        if ua > 0:
            acc[f'n_hkata_{x}'] = acc.get(f'n_hkata_{x}', 0.0) + ua * hk
            acc[f'j_ude_a_{x}'] = ua * (1 - hk)
        if fa > 0:
            acc[f'n_hte_{x}'] = acc.get(f'n_hte_{x}', 0.0) + fa * ht
            acc[f'j_ude_b_{x}'] = fa * (1 - ht)
        if hj > 0:
            for b in (f'j_ude_a_{x}', f'j_ude_b_{x}'):
                if acc.get(b, 0.0) > 0:
                    acc[f'n_hhiji_{x}'] = acc.get(f'n_hhiji_{x}', 0.0) + acc[b] * hj
                    acc[b] *= 1 - hj


# 4. Vertex groups -> FFXIV bone names (fingers split along the game's fingers, arm twist helpers), max 4 weights.
unmapped = sorted({names[g.group] for v in me.vertices for g in v.groups if g.weight > 0 and names[g.group] not in WEIGHT_MAP})
assert not unmapped, f'unmapped weighted bones: {unmapped}'
per_vert = []
accs = []
for v in me.vertices:
    acc = {}
    fingers = {}
    coats = {}
    for g in v.groups:
        if g.weight <= 0:
            continue
        n = names[g.group]
        digit = n.split('.')[0]
        if digit in FINGERS:
            key = (FINGERS[digit], n[-1].lower())
            fingers[key] = fingers.get(key, 0.0) + g.weight
            continue
        if n.startswith('Coat') and n != 'CoatBase':
            coats['all'] = coats.get('all', 0.0) + g.weight
            continue
        t = WEIGHT_MAP[n]
        acc[t] = acc.get(t, 0.0) + g.weight
    for (dst, x), w in fingers.items():
        for b, k in finger_bones(v.co, dst, x).items():
            acc[b] = acc.get(b, 0.0) + w * k
    for (sk, x), k_panel in (coat_panels(v.co).items() if coats else ()):
        for b, k in skirt_bones(v.co, sk, x).items():
            acc[b] = acc.get(b, 0.0) + coats['all'] * k_panel * k
    twist_helpers(acc, v.co)
    accs.append(acc)

# Back of the hips like vanilla legs (c0201e0000_dwn: the butt is 98% j_kosi above the hip joint, 70% at the
# crease, thigh below). Her rig put her trousers' butt 84% on the thighs, so in the game's run it swung back
# through the coat, which hangs on the skirt bones and j_kosi like the vanilla Taoist's robe (GS, 1.1.0).
hip_z = (xiv_pos['j_asi_a_l'].z + xiv_pos['j_asi_a_r'].z) / 2
hip_y = (xiv_pos['j_asi_a_l'].y + xiv_pos['j_asi_a_r'].y) / 2
moved = 0
for i, v in enumerate(me.vertices):
    acc = accs[i]
    thigh = acc.get('j_asi_a_l', 0.0) + acc.get('j_asi_a_r', 0.0)
    if thigh <= 0:
        continue
    up = smoothstep((v.co.z - (hip_z - BUTT_LOW)) / (BUTT_LOW - BUTT_HIGH))
    back = smoothstep((v.co.y - hip_y - 0.01) / 0.04)
    k = up * back
    if k <= 0:
        continue
    for b in ('j_asi_a_l', 'j_asi_a_r'):
        if b in acc:
            acc['j_kosi'] = acc.get('j_kosi', 0.0) + acc[b] * k
            acc[b] *= 1 - k
    moved += 1
log('butt verts re-weighted toward j_kosi', moved)

# The coat's red lining copies the outer shell's weights from the nearest shell point, so the two layers can't
# separate in motion (in GS the lining pushed through the shell at the hips when running).
if lining_verts and shell_faces:
    from mathutils.bvhtree import BVHTree
    from mathutils.interpolate import poly_3d_calc
    tree = BVHTree.FromPolygons([v.co for v in me.vertices], [tuple(me.polygons[fi].vertices) for fi in shell_faces])
    copied = 0
    for i in lining_verts:
        loc, nrm, idx, dist = tree.find_nearest(me.vertices[i].co, LINING_REACH)
        if loc is None:
            continue
        poly = me.polygons[shell_faces[idx]]
        bary = poly_3d_calc([me.vertices[j].co for j in poly.vertices], loc)
        acc = {}
        for j, wj in zip(poly.vertices, bary):
            for b, w in accs[j].items():
                acc[b] = acc.get(b, 0.0) + w * wj
        accs[i] = acc
        copied += 1
    log('lining verts riding the shell', copied, 'of', len(lining_verts))

for i, acc in enumerate(accs):
    top = sorted(((t, w) for t, w in acc.items() if w > 1e-4), key=lambda kv: -kv[1])[:4]
    total = sum(w for _, w in top)
    assert total > 0, f'vertex {i} has no weights'
    per_vert.append([(t, w / total) for t, w in top])
body.vertex_groups.clear()
groups = {}
for i, ws in enumerate(per_vert):
    for t, w in ws:
        if t not in groups:
            groups[t] = body.vertex_groups.new(name=t)
        groups[t].add([i], w, 'REPLACE')
log('ffxiv bones used', len(groups), sorted(groups))

# 5. Skin to the FFXIV armature, split per material, export.
bpy.data.objects.remove(src_arm, do_unlink=True)
body.parent = xiv_obj
arm_mod = body.modifiers.new('Armature', 'ARMATURE')
arm_mod.object = xiv_obj
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.mesh.separate(type='MATERIAL')
order = ['DonB', 'DonF', 'DonH', 'DonS', 'DonW']
SKIN_MATS = ('DonF', 'DonS')
parts = [o for o in bpy.data.objects if o.type == 'MESH']
for o in parts:
    used = {o.data.materials[p.material_index].name for p in o.data.polygons}
    assert len(used) == 1, (o.name, used)
    mat = used.pop()
    keep = next(m for m in o.data.materials if m.name == mat)
    o.data.materials.clear()
    o.data.materials.append(keep)
    o.name = f'Don_{order.index(mat)}'
    o.data.name = o.name
    col = o.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    col.data.foreach_set('color', (SKIN_COLOUR if mat in SKIN_MATS else GEAR_COLOUR) * len(col.data))
    o.data.color_attributes.active_color = col
    log('part', o.name, mat, 'verts', len(o.data.vertices), 'tris', sum(len(p.vertices) - 2 for p in o.data.polygons))

# UV triangles of the skin parts with their tags, for skin_textures.py.
uvcats = {}
for o in parts:
    mat = o.data.materials[0].name
    if mat not in SKIN_MATS:
        continue
    me_o = o.data
    me_o.calc_loop_triangles()
    tag = me_o.attributes['dq_cat'].data
    uvl = me_o.uv_layers[0].data
    uvcats[mat] = [[c for li in t.loops for c in uvl[li].uv] + [tag[t.polygon_index].value] for t in me_o.loop_triangles]
if uvcats:
    import json
    with open(f'{OUT_DIR}/{NAME}_uvcats.json', 'w') as f:
        json.dump(uvcats, f)
    log('uv categories', {k: len(v) for k, v in uvcats.items()})

bpy.ops.wm.save_as_mainfile(filepath=f'{OUT_DIR}/{NAME}.blend')
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
    o.select_set(True)
xiv_obj.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=f'{OUT_DIR}/{NAME}.glb', export_format='GLB', use_selection=True,
    export_skins=True, export_morph=False, export_animations=False, export_tangents=True,
    export_normals=True, export_texcoords=True, export_vertex_color='ACTIVE', export_materials='EXPORT', export_image_format='NONE',
    export_def_bones=False, export_yup=True, export_apply=False,
)
log('exported', f'{OUT_DIR}/{NAME}.glb')
