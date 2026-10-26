# Converts the Overwatch hero rips in source/ into small skinned GLBs for the sim (work/models/).
#
#   blender -b --factory-startup --python GoatsSim/tools/export_heroes.py -- [hero ...]
#
# The rips are DataTool FBX exports with the material -> texture links stripped, so each material's
# colour map is pinned here by texture id (found by matching each mesh's UV layout against the
# painted area of every texture in its folder, then checked by eye). Meshes are decimated to a
# game-sized budget, textures are scaled to 1024 or less, meshes are Draco-compressed, and weapons are
# baked to static meshes that the game attaches to the hands at runtime.
import bpy, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
SRC = os.path.join(PROJ, "source")
OUT = os.path.join(PROJ, "work", "models")
TEX = os.path.join(PROJ, "work", "tex")

DARK = (0.08, 0.06, 0.05)
WHITE = (0.85, 0.85, 0.85)

# material id -> (texture id | rgb, options)
#   size: texture edge in px, alpha: cutout from the colour map's alpha, emit: emission mask texture id
HEROES = {
    "reinhardt": {
        "fbx": "reinhardt/Raw Files/Model/Reinhardt Optimus Prime.fbx",
        "tris": 16000,
        "mats": {
            "00000000F8DC": ("00000004DC2C", {"size": 1024, "emit": "00000004DC2D", "emit_color": (0.35, 0.75, 1.0)}),
            "00000000F900": ((0.75, 0.1, 0.08), {}),
            "00000000F8DF": ("00000004DC35", {"size": 128, "emit": "00000004DC37", "emit_color": (1.0, 0.6, 0.2)}),
        },
    },
    "zarya": {
        "fbx": "zarya/Raw Files/Model/Zarya OW2.fbx",
        "tris": 15000,
        "mats": {
            "000000009925": ("00000002A652", {"size": 1024}),
            "00000000A54F": ("00000002A652", {"size": 1024}),
            "00000000A5B4": ("00000002E048", {"size": 256}),
            "000000009932": ("00000002A68D", {"size": 128}),
            "000000009931": ("000000032A53", {"size": 512, "alpha": True}),
            "000000008226": (DARK, {}), "000000008210": (DARK, {}), "0000000082FB": (DARK, {}),
        },
    },
    "brigitte": {
        "fbx": "brigitte/Raw Files/Model/Brigitte ANTIFRAGILE BB.fbx",
        "tris": 15000,
        "mats": {
            "00000000DB61": ("000000045559", {"size": 1024, "emit": "00000004555A", "emit_color": (1.0, 0.45, 0.9)}),
            "00000000DB63": ("000000045559", {"size": 1024}),
            "00000000DB62": ("00000004555F", {"size": 512, "alpha": True}),
            "0000000099FB": ("000000022149", {"size": 128}),
            "00000000DB64": (DARK, {}), "000000005B0C": (DARK, {}),
            "000000008226": (DARK, {}), "000000008210": (DARK, {}), "0000000082FB": (DARK, {}),
        },
    },
    "lucio": {
        "fbx": "lucio/Raw Files/Model/Lucio Jazzy.fbx",
        "tris": 13000,
        "mats": {
            "0000000041E1": ("00000000D563", {"size": 1024}),
            "0000000041E3": ("00000000D563", {"size": 1024}),
            "0000000046EA": ("00000000D563", {"size": 1024}),
            "0000000041E4": ("00000000D571", {"size": 1024}),
            "000000000AAB": ("000000003F69", {"size": 128}),
            "00000000196C": ("000000003F69", {"size": 128}),
            "0000000041E2": (DARK, {}), "0000000041E5": (DARK, {}), "000000000AAA": (DARK, {}),
        },
    },
    "zenyatta": {
        "fbx": "zenyatta/Raw Files/Zenyatta OW2.fbx",
        "tris": 16000,
        "orbs_bone": "bone_0005",
        "mats": {
            "00000000A3F9": ("00000002D528", {"size": 1024, "emit": "00000002D52D", "emit_color": (1.0, 0.85, 0.45)}),
            "00000000AD76": ("000000031267", {"size": 512, "emit": "000000031217", "emit_color": (0.4, 0.9, 1.0)}),
        },
    },
    "dva_mech": {
        "fbx": "dva/Raw Files/Mech/Tokki My Melody.fbx",
        "tris": 16000,
        "mats": {
            "00000001382B": ("0000000659AE", {"size": 1024}),
            "00000001382C": ("0000000659A6", {"size": 1024}),
            "000000013828": (WHITE, {}),
        },
    },
    "dva_pilot": {
        "fbx": "dva/Raw Files/Model/Dva My Melody.fbx",
        "tris": 9000,
        "mats": {
            "000000013824": ("0000000659BA", {"size": 1024}),
            "000000013829": ("0000000659BA", {"size": 1024}),
            "00000001382A": ("00000006599F", {"size": 512, "alpha": True}),
            "0000000098D0": ("00000002A4C2", {"size": 128}),
            "000000008226": (DARK, {}), "000000008210": (DARK, {}), "0000000082FB": (DARK, {}),
        },
    },
}

WEAPONS = {
    "hammer": ("reinhardt/Raw Files/Weapon/Optimus Prime Hammer.fbx", 4000,
               {"00000000F607": ("00000004D020", {"size": 1024}), "00000000F606": ((0.9, 0.9, 0.9), {})}),
    "cannon": ("zarya/Raw Files/Weapon/Particle Cannon OW3.fbx", 5000,
               {"00000000A33C": ("00000002D25C", {"size": 1024}), "00000000A50A": ((0.95, 0.4, 0.7), {}), "00000000A51A": (DARK, {})}),
    "amp": ("lucio/Raw Files/Weapon/Jazzy Gun.fbx", 3000,
            {"0000000041E9": ("00000000D58E", {"size": 512}), "0000000044D0": ((0.4, 1.0, 0.3), {}),
             "000000004876": ((0.4, 1.0, 0.3), {}), "0000000041EA": ((0.4, 1.0, 0.3), {})}),
    "flail": ("brigitte/Raw Files/Flail/ANTIFRAGILE BB Flail.fbx", 3000,
              {"00000000D343": ("00000004200A", {"size": 1024, "emit": "00000004200B", "emit_color": (1.0, 0.4, 0.9)}),
               "00000000D588": ((1.0, 0.5, 0.9), {}), "00000000D58E": (DARK, {})}),
    "shield": ("brigitte/Raw Files/Shield/ANTIFRAGILE BB Shield.fbx", 3000,
               {"00000000D342": ("000000042004", {"size": 1024}), "000000006B00": ((1.0, 0.45, 0.85), {}),
                "00000000D58E": (DARK, {}), "00000000D518": (DARK, {})}),
    "lightgun": ("dva/Raw Files/Light Gun/My Melody Light Gun.fbx", 2000,
                 {"00000001382C": ("0000000659A6", {"size": 512}), "000000013827": (WHITE, {})}),
}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_fbx(rel):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, rel), use_image_search=False)
    return [o for o in bpy.data.objects if o not in before]


_images = {}


def texture(folder, tid, size, alpha, tag):
    """Scale a ripped TGA down and save it next to the models; returns a Blender image."""
    key = (folder, tid, size, alpha)
    if key in _images:
        return _images[key]
    os.makedirs(TEX, exist_ok=True)
    src = os.path.join(folder, tid + ".tga")
    img = bpy.data.images.load(src)
    w, h = img.size
    if max(w, h) > size:
        img.scale(max(1, w * size // max(w, h)), max(1, h * size // max(w, h)))
    ext = "png" if alpha else "jpg"
    out = os.path.join(TEX, f"{tag}_{tid}.{ext}")
    img.filepath_raw = out
    img.file_format = "PNG" if alpha else "JPEG"
    if not alpha:
        bpy.context.scene.render.image_settings.quality = 88
    img.save()
    bpy.data.images.remove(img)
    img = bpy.data.images.load(out)
    _images[key] = img
    return img


def make_material(name, spec, folder, tag):
    what, opt = spec
    mat = bpy.data.materials.new(name + ("_mask" if opt.get("alpha") else ""))
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.65
    bsdf.inputs["Metallic"].default_value = 0.0
    if isinstance(what, tuple):
        bsdf.inputs["Base Color"].default_value = (*what, 1)
        return mat
    img = texture(folder, what, opt.get("size", 1024), opt.get("alpha", False), tag)
    tn = nt.nodes.new("ShaderNodeTexImage")
    tn.image = img
    nt.links.new(tn.outputs["Color"], bsdf.inputs["Base Color"])
    if opt.get("alpha"):
        nt.links.new(tn.outputs["Alpha"], bsdf.inputs["Alpha"])
    if opt.get("emit"):
        en = nt.nodes.new("ShaderNodeTexImage")
        en.image = texture(folder, opt["emit"], 512, False, tag)
        en.image.colorspace_settings.name = "sRGB"
        mix = nt.nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs["Fac"].default_value = 1.0
        mix.inputs["Color2"].default_value = (*opt.get("emit_color", (1, 1, 1)), 1)
        nt.links.new(en.outputs["Color"], mix.inputs["Color1"])
        nt.links.new(mix.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 1.0
    return mat


def assign_materials(objs, table, folder, tag):
    made = {}
    for o in objs:
        if o.type != "MESH":
            continue
        for slot in o.material_slots:
            if not slot.material:
                continue
            mid = slot.material.name.split(".")[0]
            spec = table.get(mid)
            if spec is None:
                print("  unmapped material", mid, "on", o.name, "-> grey")
                spec = ((0.5, 0.5, 0.5), {})
            if mid not in made:
                made[mid] = make_material(f"{tag}_{mid}", spec, folder, tag)
            slot.material = made[mid]


def tri_count(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def decimate(objs, target):
    meshes = [o for o in objs if o.type == "MESH"]
    total = sum(tri_count(o) for o in meshes)
    big = [o for o in meshes if tri_count(o) > 600]
    small = total - sum(tri_count(o) for o in big)
    ratio = max(0.08, min(1.0, (target - small) / max(1, total - small)))
    for o in big:
        if ratio >= 0.98:
            break
        mod = o.modifiers.new("dec", "DECIMATE")
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]):
            bpy.ops.object.modifier_move_to_index(modifier="dec", index=0)
            bpy.ops.object.modifier_apply(modifier="dec")
    after = sum(tri_count(o) for o in meshes)
    print(f"  tris {total} -> {after} (ratio {ratio:.2f})")


def bake_static(objs):
    """Freeze rigged meshes in their rest pose and drop the armatures (weapons don't animate)."""
    meshes = [o for o in objs if o.type == "MESH"]
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
        for m in list(o.modifiers):
            if m.type == "ARMATURE":
                o.modifiers.remove(m)
        o.vertex_groups.clear()
    for o in objs:
        if o.type in ("ARMATURE", "EMPTY"):
            bpy.data.objects.remove(o, do_unlink=True)
    meshes = [o for o in meshes if o.name in bpy.data.objects]
    if len(meshes) > 1:
        with bpy.context.temp_override(active_object=meshes[0], selected_editable_objects=meshes, selected_objects=meshes):
            bpy.ops.object.join()
    return meshes[0]


def export(path, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        if o.name in bpy.data.objects:
            o.select_set(True)
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_animations=False,
              export_skins=True, export_all_influences=False, export_def_bones=False,
              export_image_format="AUTO", export_texcoords=True, export_normals=True,
              export_tangents=False, export_materials="EXPORT", export_yup=True, export_extras=False,
              # Draco keeps the shareable single-file build small; the game decodes it with three's DRACOLoader
              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
              export_draco_position_quantization=14, export_draco_normal_quantization=10,
              export_draco_texcoord_quantization=12, export_draco_generic_quantization=12)
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color="NONE")
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)
    print("  wrote", path, os.path.getsize(path) // 1024, "KB")


def zen_orbs(objs, body_arm, bone):
    """Zenyatta's floating orbs are 11 small rigs placed by empties: bake them into one mesh on his chest bone."""
    orb_meshes = [o for o in objs if o.type == "MESH" and o.parent and o.parent != body_arm]
    if not orb_meshes:
        return objs
    rigs = {o.parent for o in orb_meshes}
    for o in orb_meshes:
        dg = bpy.context.evaluated_depsgraph_get()
        mw = o.matrix_world.copy()
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        me.transform(mw)
        o.data = me
        o.modifiers.clear()
        o.vertex_groups.clear()
        o.parent = None
        o.matrix_world.identity()
    with bpy.context.temp_override(active_object=orb_meshes[0], selected_editable_objects=orb_meshes, selected_objects=orb_meshes):
        bpy.ops.object.join()
    orbs = orb_meshes[0]
    orbs.name = "ZenOrbs"
    # skin every vertex fully to the chest bone so the orbs ride along with him
    vg = orbs.vertex_groups.new(name=bone)
    vg.add(list(range(len(orbs.data.vertices))), 1.0, "REPLACE")
    orbs.parent = body_arm
    mod = orbs.modifiers.new("Armature", "ARMATURE")
    mod.object = body_arm
    for r in rigs:
        if r.name in bpy.data.objects:
            bpy.data.objects.remove(r, do_unlink=True)
    for o in list(bpy.data.objects):
        if o.type == "EMPTY":
            bpy.data.objects.remove(o, do_unlink=True)
    return [o for o in bpy.data.objects]


def run_hero(name):
    h = HEROES[name]
    print("==", name)
    reset()
    objs = import_fbx(h["fbx"])
    folder = os.path.dirname(os.path.join(SRC, h["fbx"]))
    arms = [o for o in objs if o.type == "ARMATURE"]
    body = max(arms, key=lambda a: len(a.data.bones))
    if "orbs_bone" in h:
        objs = zen_orbs(objs, body, h["orbs_bone"])
    for o in list(objs):
        if o.type == "EMPTY" and o.name in bpy.data.objects:
            bpy.data.objects.remove(o, do_unlink=True)
    objs = [o for o in bpy.data.objects]
    assign_materials(objs, h["mats"], folder, name)
    decimate(objs, h["tris"])
    os.makedirs(OUT, exist_ok=True)
    export(os.path.join(OUT, name + ".glb"), objs)


def run_weapon(name):
    rel, tris, mats = WEAPONS[name]
    print("==", name)
    reset()
    objs = import_fbx(rel)
    folder = os.path.dirname(os.path.join(SRC, rel))
    assign_materials(objs, mats, folder, name)
    decimate(objs, tris)
    mesh = bake_static(objs)
    mesh.name = name
    export(os.path.join(OUT, name + ".glb"), [mesh])


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    names = argv or list(HEROES) + list(WEAPONS)
    for n in names:
        if n in HEROES:
            run_hero(n)
        elif n in WEAPONS:
            run_weapon(n)
        else:
            print("unknown", n)
