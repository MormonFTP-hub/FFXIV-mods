# Cuts the fight area out of the Hanamura rip and exports it as one GLB for the sim (work/models/hanamura.glb).
#
#   blender -b --factory-startup --python GoatsSim/tools/export_map.py
#
# First run imports source/hanamura/Raw Files/Hanamura.fbx (about 6 minutes) and caches it as
# work/map/hanamura.blend; later runs open the cache.
#
# The rip has no material -> texture links, and the map's textures are fully painted tiles and trim
# sheets, so they can't be matched to materials by UV layout the way the heroes' were. Each material
# gets a colour from what the surface is instead (roof, ground, wall, trim, foliage), so the map reads
# like Hanamura without a wrong texture on it. Ambient occlusion is baked into vertex colours so the
# flat colours still have depth. MATCHES pins a texture to a material by hand where one is known.
import bpy, os, sys, json, math, zlib
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
FBX = os.path.join(PROJ, "source", "hanamura", "Raw Files", "Hanamura.fbx")
TEXDIR = os.path.join(PROJ, "source", "hanamura", "Raw Files")
WORK = os.path.join(PROJ, "work")
BLEND = os.path.join(WORK, "map", "hanamura.blend")
OUT = os.path.join(WORK, "models", "hanamura.glb")
TEXOUT = os.path.join(WORK, "tex")

CORE = (-20.0, 70.0, -34.0, 38.0)       # x0 x1 y0 y1 (blender, z up): detailed
CORE_Z = (-10.0, 45.0)
BACK_R = 220.0                          # backdrop: big things within this radius of the fight
SKY_R = 1600.0                          # skyline: only very big things
MIN_CORE = 0.35                         # drop clutter smaller than this (bbox diagonal, m)
MATCHES = {}                            # material id -> texture id, pinned by hand
FIGHT = (25.0, 0.0)

PALETTE = {
    "roof_slate": (0.27, 0.31, 0.38),
    "roof_teal": (0.24, 0.38, 0.37),
    "ground": (0.63, 0.58, 0.50),
    "floor_wood": (0.50, 0.36, 0.25),
    "plaster": (0.86, 0.81, 0.70),
    "lacquer": (0.60, 0.19, 0.13),
    "wood_dark": (0.33, 0.21, 0.14),
    "wood": (0.48, 0.32, 0.21),
    "stone": (0.55, 0.55, 0.52),
    "leaf_pink": (0.93, 0.62, 0.72),
    "leaf_green": (0.36, 0.52, 0.30),
    "far": (0.55, 0.60, 0.66),
}


def hash01(s):
    return (zlib.crc32(s.encode()) % 1000) / 1000.0


def load_scene():
    if os.path.exists(BLEND):
        bpy.ops.wm.open_mainfile(filepath=BLEND)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=FBX, use_image_search=False)
        os.makedirs(os.path.dirname(BLEND), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=BLEND)


def world_bounds(o):
    me = o.data
    co = np.zeros(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    M = np.array(o.matrix_world, np.float32)
    w = co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
    return w.min(0), w.max(0)


def pick_objects():
    core, back = [], []
    for o in bpy.data.objects:
        if o.type != "MESH" or not o.data.polygons:
            continue
        lo, hi = world_bounds(o)
        c = (lo + hi) / 2
        size = float(np.linalg.norm(hi - lo))
        inside = hi[0] > CORE[0] and lo[0] < CORE[1] and hi[1] > CORE[2] and lo[1] < CORE[3] and hi[2] > CORE_Z[0] and lo[2] < CORE_Z[1]
        d = math.hypot(c[0] - FIGHT[0], c[1] - FIGHT[1])
        if inside:
            if size >= MIN_CORE:
                core.append(o)
        elif d < BACK_R and size > 4:
            back.append(o)
        elif d < SKY_R and size > 25:
            back.append(o)
    return core, back


def realize(objs, ratio_fn):
    """Apply armature + a decimate modifier and return plain mesh objects."""
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in objs:
        t = len(o.data.polygons)
        r = ratio_fn(o, t)
        if r < 0.99:
            m = o.modifiers.new("dec", "DECIMATE")
            m.ratio = r
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        me.transform(o.matrix_world)
        n = bpy.data.objects.new(o.name + "_r", me)
        bpy.context.scene.collection.objects.link(n)
        out.append(n)
    return out


# ---------------------------------------------------------------- classification
def material_stats(objs):
    st = {}
    for o in objs:
        me = o.data
        me.calc_loop_triangles()
        nt = len(me.loop_triangles)
        if nt == 0:
            continue
        nv = len(me.vertices)
        co = np.zeros(nv * 3, np.float32)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        t = np.zeros(nt * 3, np.int32)
        me.loop_triangles.foreach_get("vertices", t)
        P = co[t.reshape(-1, 3)]
        n = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
        a = np.linalg.norm(n, axis=1)
        nz = n[:, 2] / np.maximum(a, 1e-9)
        z = P[:, :, 2].mean(1)
        mi = np.zeros(nt, np.int32)
        me.loop_triangles.foreach_get("material_index", mi)
        for k, slot in enumerate(o.material_slots):
            if not slot.material:
                continue
            s = mi == k
            if not s.any():
                continue
            d = st.setdefault(slot.material.name, dict(area=0.0, up=0.0, slope=0.0, vert=0.0, z=0.0, tris=0, meshes=[], col=np.zeros(3), ncol=0))
            w = a[s] * 0.5
            d["area"] += w.sum()
            d["up"] += w[nz[s] > 0.85].sum()
            d["slope"] += w[(nz[s] > 0.3) & (nz[s] <= 0.85)].sum()
            d["vert"] += w[np.abs(nz[s]) <= 0.3].sum()
            d["z"] += (w * z[s]).sum()
            d["tris"] += int(s.sum())
            d["meshes"].append(me)
            if k == 0 and me.color_attributes:
                ca = me.color_attributes[0]
                c = np.zeros(len(ca.data) * 4, np.float32)
                ca.data.foreach_get("color", c)
                c = c.reshape(-1, 4)[:, :3]
                d["col"] += c.sum(0)
                d["ncol"] += len(c)
    for d in st.values():
        A = max(d["area"], 1e-6)
        for k in ("up", "slope", "vert", "z"):
            d[k] /= A
    return st


def classify(name, d, ground):
    h = d["z"] - ground
    r = hash01(name)
    # the rip's first vertex colour is pure red on foliage (wind sway): cherry blossom up high, bushes low
    if d["ncol"]:
        c = d["col"] / d["ncol"]
        if c[0] > 0.85 and c[1] < 0.25 and c[2] < 0.25:
            return "leaf_pink" if h > 1.5 else "leaf_green"
        if c[0] > 0.85 and 0.25 < c[1] < 0.6 and 0.25 < c[2] < 0.6 and h > 3:   # roof tiles are tinted pink-red
            return "roof_teal" if r < 0.3 else "roof_slate"
    # roof tiles have plenty of vertical edges, so up high a modest share of sloped faces is enough
    if (d["slope"] > 0.45 and h > 2.5) or (h > 7 and d["slope"] > 0.15 and d["slope"] + d["up"] > 0.3):
        return "roof_teal" if r < 0.3 else "roof_slate"
    if d["up"] > 0.6 and h < 1.2:
        return "ground"
    if d["up"] > 0.6:
        return "floor_wood"
    if d["vert"] > 0.5:
        return "plaster" if r < 0.5 else ("lacquer" if r < 0.7 else "wood_dark")
    if d["tris"] > 3000 and d["area"] / d["tris"] < 0.02:
        return "leaf_pink" if r < 0.5 else "leaf_green"
    return "wood" if r < 0.6 else ("lacquer" if r < 0.8 else "stone")


_tex_cache = {}


def tex_image(tid, cutout):
    if tid in _tex_cache:
        return _tex_cache[tid]
    os.makedirs(TEXOUT, exist_ok=True)
    img = bpy.data.images.load(os.path.join(TEXDIR, tid + ".dds"))
    w, h = img.size
    s = 512 if max(w, h) >= 1024 else 256
    if max(w, h) > s:
        img.scale(max(1, w * s // max(w, h)), max(1, h * s // max(w, h)))
    ext = "png" if cutout else "jpg"
    p = os.path.join(TEXOUT, f"map_{tid}.{ext}")
    img.filepath_raw = p
    img.file_format = "PNG" if cutout else "JPEG"
    img.save()
    bpy.data.images.remove(img)
    img = bpy.data.images.load(p)
    _tex_cache[tid] = img
    return img


def new_material(name, color=None, img=None, cutout=False):
    m = bpy.data.materials.new(name + ("_mask" if cutout else ""))
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.8
    if img is not None:
        tn = m.node_tree.nodes.new("ShaderNodeTexImage")
        tn.image = img
        m.node_tree.links.new(tn.outputs["Color"], b.inputs["Base Color"])
        if cutout:
            m.node_tree.links.new(tn.outputs["Alpha"], b.inputs["Alpha"])
    else:
        b.inputs["Base Color"].default_value = (*color, 1)
    return m


def join(objs, name):
    objs = [o for o in objs if o.data.polygons]
    with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, selected_objects=objs):
        bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


def bake_ao(o):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 24
    sc.render.bake.target = "VERTEX_COLORS"
    if sc.world is None:
        sc.world = bpy.data.worlds.new("w")
    sc.world.light_settings.distance = 4.0
    me = o.data
    for ca in list(me.color_attributes):
        me.color_attributes.remove(ca)
    ca = me.color_attributes.new("AO", "BYTE_COLOR", "POINT")
    me.color_attributes.active_color = ca
    for x in bpy.context.selected_objects:
        x.select_set(False)
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.bake(type="AO")
    # lift the AO so open surfaces stay bright: c = 0.35 + 0.65 * ao
    a = np.zeros(len(ca.data) * 4, np.float32)
    ca.data.foreach_get("color", a)
    a = a.reshape(-1, 4)
    a[:, :3] = 0.35 + 0.65 * a[:, :3]
    a[:, 3] = 1
    ca.data.foreach_set("color", a.ravel())


def main():
    load_scene()
    core, back = pick_objects()
    print("core objects", len(core), "backdrop objects", len(back))
    core_r = realize(core, lambda o, t: 1.0 if t < 160 else (0.32 if t < 800 else (0.14 if t < 3000 else 0.07)))
    back_r = realize(back, lambda o, t: 1.0 if t < 40 else (0.25 if t < 1000 else 0.06))
    keep = set(core_r) | set(back_r)
    for o in list(bpy.data.objects):
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    print("tris core", sum(len(o.data.polygons) for o in core_r), "backdrop", sum(len(o.data.polygons) for o in back_r))

    floors = np.load(os.path.join(WORK, "map", "floors.npy"))
    ground = float(np.median(floors[:, :, 0][floors[:, :, 0] != 255])) * 0.25 - 12.0
    stats = material_stats(core_r)
    report = []
    made = {}
    for name, d in sorted(stats.items(), key=lambda kv: -kv[1]["area"]):
        mid = name.split(".")[0]
        if mid in MATCHES:
            made[name] = new_material("t_" + MATCHES[mid], img=tex_image(MATCHES[mid], False))
            report.append((name, "tex", MATCHES[mid], round(d["area"])))
            continue
        cls = classify(name, d, ground)
        key = "c_" + cls
        if key not in made:
            made[key] = new_material(key, PALETTE[cls])
        made[name] = made[key]
        report.append((name, cls, round(d["area"]), round(d["up"], 2), round(d["slope"], 2), round(d["vert"], 2), round(d["z"] - ground, 1)))
    far = new_material("c_far", PALETTE["far"])
    for o in core_r + back_r:
        for slot in o.material_slots:
            if slot.material is None:
                continue
            if o in back_r and slot.material.name not in made:
                slot.material = far
            else:
                slot.material = made.get(slot.material.name, far)
    with open(os.path.join(WORK, "map", "materials.json"), "w") as fp:
        json.dump(report, fp, indent=0)
    print("materials", len(report), "pinned textures", sum(1 for r in report if r[1] == "tex"))

    core_o = join(core_r, "core")
    back_o = join(back_r, "backdrop")
    for o in (core_o, back_o):
        for ca in list(o.data.color_attributes):
            o.data.color_attributes.remove(ca)
        keep_uv = 1 if MATCHES else 0
        while len(o.data.uv_layers) > keep_uv:
            o.data.uv_layers.remove(o.data.uv_layers[-1])
    bake_ao(core_o)
    # backdrop gets a flat vertex colour so both meshes use the same material setup
    ca = back_o.data.color_attributes.new("AO", "BYTE_COLOR", "POINT")
    back_o.data.color_attributes.active_color = ca
    a = np.full(len(ca.data) * 4, 0.9, np.float32)
    ca.data.foreach_set("color", a)

    for o in bpy.context.selected_objects:
        o.select_set(False)
    core_o.select_set(True)
    back_o.select_set(True)
    kw = dict(filepath=OUT, export_format="GLB", use_selection=True, export_animations=False, export_skins=False,
              export_image_format="AUTO", export_texcoords=bool(MATCHES), export_normals=True, export_tangents=False,
              export_materials="EXPORT", export_yup=True, export_extras=False,
              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
              export_draco_position_quantization=16, export_draco_normal_quantization=10,
              export_draco_texcoord_quantization=12, export_draco_color_quantization=8)
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color="ACTIVE")
    except TypeError:
        bpy.ops.export_scene.gltf(**kw, export_colors=True)
    print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB")


main()
