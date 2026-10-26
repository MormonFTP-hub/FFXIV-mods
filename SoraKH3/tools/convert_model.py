"""Fit the KH3 Sora rip onto FFXIV skeletons and export one glTF per gear model of the Air Cell set (e0907):
met (his head: face, eyes, hair), top, glv, dwn, sho.

Run inside Blender:  run_blender.ps1 convert_model.py <game_dir> <sora.dae> <out_dir> [races] [preview] [head=x]
  races: comma list of fitted races (default all of PROFILES); head=x overrides every race's head scale (tuning)
  -> <out_dir>/<race>/<slot>.glb, <out_dir>/<race>/parts.npz (head and jacket surfaces for showthrough.py)

2.0.0 (every race and gender): fitted to the Midlander man (c0101), Midlander woman (c0201), Roegadyn man (c0901)
and Lalafell (c1101); the other races are reshaped from those by the game's racial deformer (EQDP in package_mod).
His head rides in the hat slot (the hat's EQP hides the wearer's hair and ears), placed on the wearer's eyes
(work/fit/eyes.json, prep_faces.py) and scaled per race (PROFILES) so the wearer's own face stays inside it.

All fitting math happens in FFXIV game space (Y up, +Z forward, +X = character's left).
"""
import json
import math
import os
import sys
import xml.etree.ElementTree as ET

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from atlas import to_atlas_uv
from havok_tagfile import read_sklb_skeleton
from sqpack import Repo

GAME_DIR, DAE_PATH, OUT_DIR = sys.argv[1:4]
OPTS = sys.argv[4:]
PREVIEW = "preview" in OPTS
NS = "{http://www.collada.org/2005/11/COLLADASchema}"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SET = "e0907"   # Air Cell set: Hood, Jacket, Armlets, Halfslops, Shoes (all classes, level 1)
# head: scale of his head against the body-fit size (1.0 = 1.3.0's size on the Midlander man); eye_dy / eye_dz move
# his eyes off the wearer's eyes. Searched with showthrough.py: as small as the wearer's face allows.
# Midlander man: at 0.9 (the user: "head looks a little big") 0.25% of face 1 shows with his eyes 7.5 mm in front of
# the wearer's (his flat anime face otherwise let the wearer's brow and nose through: 3.6%); at 0.85 the back of the
# wearer's skull shows from behind and above (1.5-2.5%).
# Midlander woman at 0.9: 0.4-1.0% (the back of the skull, from behind and above). Roegadyn man: his big jaw and
# nose came through at 0.9 (6-7%); 1.035 and 2 cm forward: 0.4%. Lalafell faces are huge for the body: 1.85.
PROFILES = {
    "c0101": dict(head=0.9, eye_dy=0.0, eye_dz=0.0075),
    "c0201": dict(head=0.9, eye_dy=0.0, eye_dz=0.0075),
    "c0901": dict(head=1.035, eye_dy=0.0, eye_dz=0.02),
    "c1101": dict(head=1.85, eye_dy=0.0, eye_dz=0.015),
}
RACES = [r for o in OPTS if o.startswith("c") for r in o.split(",")] or list(PROFILES)
for o in OPTS:
    if o.startswith("head="):
        for p in PROFILES.values():
            p["head"] = float(o[5:])

# Which KH3 meshes to use (the -UV2/-UV3 duplicates only carry alternate UV sets,
# E_mat1 is the transparent eye-wetness layer) and which material key each becomes.
BODY_MESHES = {  # KH mesh -> material key on every body piece
    "p_ex001_mat0_Inst-UV1": "a",
    "p_ex001_mat1_Inst-UV1": "b",
    "p_ex001_mat2_Inst-UV1": "c",
    "p_ex001_mat3_Inst": "s",  # skin: its own skin.shpk material (texture set A's skin texels, see make_textures)
}
HEAD_MESHES = {  # KH mesh -> (material key, eye-atlas cell); all go to the hat (met) model
    "p_ex001_F_mat0_Inst": ("f", None),          # face skin (skin.shpk)
    "p_ex001_Eyelens_Inst": ("e", "iris"),
    "p_ex001_E_mat0_Inst": ("e", "eyewhite"),
    "p_ex001_E_mat3_Inst": ("e", "lash"),
    "p_ex001_M_mat0_Inst": ("e", "mouth"),
    "p_ex001_hair_Inst-UV1": ("h", None),        # hair (characterlegacy.shpk)
    "p_ex001_hair_Inst_Inst-UV1": ("h", None),
}
# material key -> letter in each model: mt_<race>e0907_<slot>_<letter>.mtrl (package_mod maps every race's name
# to one shared file per key)
LETTER = {"met": {"f": "a", "e": "b", "h": "c"}, **{s: {"a": "a", "b": "b", "c": "c", "s": "d"} for s in ("top", "glv", "dwn", "sho")}}
SKIN_KEYS = {"s", "f"}  # skin.shpk: vertex colour (0, 1, 1, 1), as vanilla faces and hands

# --------------------------------------------------------------------------- DAE

def floats(el):
    return np.array(el.text.split(), np.float64)


def parse_dae(path):
    root = ET.parse(path).getroot()
    sources = {}
    geoms = {}
    for g in root.iter(NS + "geometry"):
        mesh = g.find(NS + "mesh")
        for s in mesh.findall(NS + "source"):
            acc = s.find(f"{NS}technique_common/{NS}accessor")
            sources[s.get("id")] = floats(s.find(NS + "float_array")).reshape(-1, int(acc.get("stride")))
        vert_src = {v.get("id"): v.find(NS + "input").get("source")[1:] for v in mesh.findall(NS + "vertices")}
        tris = mesh.find(NS + "triangles")
        inputs = {i.get("semantic"): (i.get("source")[1:], int(i.get("offset"))) for i in tris.findall(NS + "input")}
        stride = max(o for _, o in inputs.values()) + 1
        p = np.array(tris.find(NS + "p").text.split(), np.int64).reshape(-1, stride)
        vs, vo = inputs["VERTEX"]
        ns, no = inputs["NORMAL"]
        us, uo = inputs["TEXCOORD"]
        geoms[g.get("id")] = dict(
            name=g.get("name"),
            pos=sources[vert_src[vs]], nrm=sources[ns], uv=sources[us][:, :2],
            c_pos=p[:, vo].reshape(-1, 3), c_nrm=p[:, no].reshape(-1, 3), c_uv=p[:, uo].reshape(-1, 3))
    skins = {}
    for c in root.iter(NS + "controller"):
        skin = c.find(NS + "skin")
        srcs = {}
        for s in skin.findall(NS + "source"):
            na = s.find(NS + "Name_array")
            srcs[s.get("id")] = na.text.split() if na is not None else floats(s.find(NS + "float_array"))
        joints_in = {i.get("semantic"): i.get("source")[1:] for i in skin.find(NS + "joints").findall(NS + "input")}
        vw = skin.find(NS + "vertex_weights")
        vin = {i.get("semantic"): (i.get("source")[1:], int(i.get("offset"))) for i in vw.findall(NS + "input")}
        names = srcs[joints_in["JOINT"]]
        ibm = srcs[joints_in["INV_BIND_MATRIX"]].reshape(-1, 4, 4)
        wsrc = srcs[vin["WEIGHT"][0]]
        vcount = np.array(vw.find(NS + "vcount").text.split(), np.int64)
        v = np.array(vw.find(NS + "v").text.split(), np.int64).reshape(-1, 2)
        jo, wo = vin["JOINT"][1], vin["WEIGHT"][1]
        weights = []
        k = 0
        for n in vcount:
            weights.append([(int(v[k + i, jo]), float(wsrc[v[k + i, wo]])) for i in range(n)])
            k += n
        skins[skin.get("source")[1:]] = dict(joints=names, ibm=ibm, weights=weights)
    parents = {}

    def walk(node, parent):
        if node.get("type") == "JOINT":
            parents[node.get("name")] = parent
            parent = node.get("name")
        for ch in node.findall(NS + "node"):
            walk(ch, parent)

    for vs in root.iter(NS + "visual_scene"):
        for n in vs.findall(NS + "node"):
            walk(n, None)
    return geoms, skins, parents


# ------------------------------------------------------------------- FFXIV rig

def quat_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def load_ffxiv_skeleton(race):
    repo = Repo(GAME_DIR)
    names, parents, pose = read_sklb_skeleton(repo.read(f"chara/human/{race}/skeleton/base/b0001/skl_{race}b0001.sklb"))
    world = []
    for i, (t, q, s) in enumerate(pose):
        m = np.eye(4)
        m[:3, :3] = quat_mat(q) * np.array(s)[None, :]
        m[:3, 3] = t
        world.append(m if parents[i] < 0 else world[parents[i]] @ m)
    return {n: dict(parent=names[p] if p >= 0 else None, world=w) for n, p, w in zip(names, parents, world)}


# ------------------------------------------------------------- bone mapping

FINGERS = {"A": "oya", "B": "hito", "C": "naka", "D": "kusu", "E": "ko"}


def side_map(side):
    s, ff = side, side.lower()
    m = {f"{s}_kata": f"j_sako_{ff}", f"{s}_ude1": f"j_ude_a_{ff}", f"{s}_ude2": f"j_ude_b_{ff}", f"{s}_te": f"j_te_{ff}",
         f"{s}_momo": f"j_asi_a_{ff}", f"{s}_hiza_spo": f"j_asi_b_{ff}", f"{s}_sune": f"j_asi_c_{ff}",
         f"{s}_ashi1": f"j_asi_d_{ff}", f"{s}_ashi2": f"j_asi_e_{ff}"}
    for k, f in FINGERS.items():
        m[f"{s}_yubi{k}1"] = f"j_{f}_a_{ff}"
        m[f"{s}_yubi{k}2"] = f"j_{f}_b_{ff}"
        m[f"{s}_yubi{k}3"] = f"j_{f}_b_{ff}"
    return m


SKIN_MAP = {"kh_sk": "j_kosi", "center": "j_kosi", "koshi": "j_kosi", "hara1": "j_sebo_a", "hara2": "j_sebo_b",
            "mune": "j_sebo_c", "kubi": "j_kubi", "atama": "j_kao"}
SKIN_MAP.update(side_map("L"))
SKIN_MAP.update(side_map("R"))

# Retarget deformers: kh bone -> (kh direction child, ffxiv bone, ffxiv direction child, stretch, twist pair)
# twist pair = ((kh_a, kh_b), (ff_a, ff_b)) vectors used to fix the roll around the bone.
DEFORMERS = {"kubi": ("atama", "j_kubi", "j_kao", True, None), "atama": (None, "j_kao", None, False, None)}
for S in "LR":
    s = S.lower()
    DEFORMERS.update({
        f"{S}_kata": (f"{S}_ude1", f"j_sako_{s}", f"j_ude_a_{s}", True, None),
        f"{S}_ude1": (f"{S}_ude2", f"j_ude_a_{s}", f"j_ude_b_{s}", True, None),
        f"{S}_ude2": (f"{S}_te", f"j_ude_b_{s}", f"j_te_{s}", True, None),
        f"{S}_te": (f"{S}_yubiC1", f"j_te_{s}", f"j_naka_a_{s}", False,
                    ((f"{S}_yubiB1", f"{S}_yubiE1"), (f"j_hito_a_{s}", f"j_ko_a_{s}"))),
        f"{S}_momo": (f"{S}_sune", f"j_asi_a_{s}", f"j_asi_b_{s}", True, None),
        f"{S}_sune": (f"{S}_ashi1", f"j_asi_c_{s}", f"j_asi_d_{s}", True, None),
        f"{S}_ashi1": (f"{S}_ashi2", f"j_asi_d_{s}", f"j_asi_e_{s}", False, None),
        f"{S}_ashi2": (None, f"j_asi_e_{s}", None, False, None),
    })
    for k, f in FINGERS.items():
        DEFORMERS[f"{S}_yubi{k}1"] = (f"{S}_yubi{k}2", f"j_{f}_a_{s}", f"j_{f}_b_{s}", True, None)
        DEFORMERS[f"{S}_yubi{k}2"] = (None, f"j_{f}_b_{s}", None, False, None)
TORSO_ROOTS = {"kh_sk", "center", "koshi", "hara1", "hara2", "mune", "trans", "X_effect", "t_camera"}
# Fingers start on FFXIV's own knuckles and reach its middle joints, so they bend where the game bends them
# (rigid fingers left the knuckles cm off and curled into claws on Mantis / Peni Parker).
ANCHOR_FF = {f"{S}_yubi{k}1" for S in "LR" for k in FINGERS}
IDENTITY_ROT = {"atama"}  # keep the head upright instead of inheriting the neck tilt
TORSO_SKIN = {"j_kosi", "j_sebo_a", "j_sebo_b", "j_sebo_c"}


def nearest(bone, parents, table):
    b = bone
    while b is not None and b not in table:
        b = parents.get(b)
    return b


# ------------------------------------------------------------------ helpers

def rot_between(a, b):
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if c < -0.999999:
        axis = np.cross(a, [1, 0, 0])
        if np.linalg.norm(axis) < 1e-6:
            axis = np.cross(a, [0, 1, 0])
        return axis_angle(axis, math.pi)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx / (1 + c)


def axis_angle(axis, ang):
    axis = np.asarray(axis, float) / np.linalg.norm(axis)
    x, y, z = axis
    c, s, t = math.cos(ang), math.sin(ang), 1 - math.cos(ang)
    return np.array([[t * x * x + c, t * x * y - s * z, t * x * z + s * y],
                     [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
                     [t * x * z - s * y, t * y * z + s * x, t * z * z + c]])


def affine(lin, src_point, dst_point):
    m = np.eye(4)
    m[:3, :3] = lin
    m[:3, 3] = dst_point - lin @ src_point
    return m


# --------------------------------------------------------------------- main

def main():
    geoms, skins, kh_parents = parse_dae(DAE_PATH)
    eyes = json.load(open(os.path.join(ROOT, "work", "fit", "eyes.json")))
    for race in RACES:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        fit_race(race, geoms, skins, kh_parents, eyes[race])


def fit_race(race, geoms, skins, kh_parents, eye):
    prof = PROFILES[race]
    print(f"===== {race} {prof}")
    ff = load_ffxiv_skeleton(race)
    F = {n: b["world"][:3, 3] for n, b in ff.items()}

    any_skin = next(iter(skins.values()))
    kh_bind = {n: np.linalg.inv(m) for n, m in zip(any_skin["joints"], any_skin["ibm"])}

    # KH (Blender-style Z up) -> game axes, then turn Sora to face +Z.
    to_game = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)
    H0 = {n: to_game @ m[:3, 3] for n, m in kh_bind.items()}
    eyes = (H0["L_eye"] + H0["R_eye"]) / 2
    fwd = eyes - H0["atama"]
    yaw = math.atan2(fwd[0], fwd[2])
    rot = axis_angle([0, 1, 0], -yaw)
    left = rot @ (H0["L_eye"] - H0["R_eye"])
    print(f"KH yaw {math.degrees(yaw):.1f} deg, left after turn {np.round(left, 3)}")
    assert left[0] > 0, "Sora's left should land on +X"

    ground = min(H0["L_ashi2"][1], H0["R_ashi2"][1])
    hip_kh = H0["koshi"][1] - ground
    leg_kh = np.linalg.norm(H0["L_momo"] - H0["L_sune"]) + np.linalg.norm(H0["L_sune"] - H0["L_ashi1"])
    leg_ff = np.linalg.norm(F["j_asi_a_l"] - F["j_asi_b_l"]) + np.linalg.norm(F["j_asi_b_l"] - F["j_asi_d_l"])
    torso_kh = H0["kubi"][1] - H0["koshi"][1]
    torso_ff = F["j_kubi"][1] - F["j_kosi"][1]
    arm_kh = np.linalg.norm(H0["L_ude1"] - H0["L_ude2"]) + np.linalg.norm(H0["L_ude2"] - H0["L_te"])
    arm_ff = np.linalg.norm(F["j_ude_a_l"] - F["j_ude_b_l"]) + np.linalg.norm(F["j_ude_b_l"] - F["j_te_l"])
    ratios = dict(hip=F["j_kosi"][1] / hip_kh, legs=leg_ff / leg_kh, torso=torso_ff / torso_kh, arms=arm_ff / arm_kh)
    # Uniform scale: between Sora's leg ratio and the torso/arm ratios, so nothing is stretched too far
    # while his big head and hands stay recognisably Sora-sized.
    scale = float(np.exp(np.mean(np.log([ratios["legs"], ratios["torso"], ratios["arms"]]))))
    print("size ratios FFXIV/KH:", {k: round(v, 3) for k, v in ratios.items()}, "-> uniform scale", round(scale, 3))

    G = np.eye(4)
    G[:3, :3] = scale * rot @ to_game
    G[:3, 3] = 0
    hk = (G @ np.append(kh_bind["koshi"][:3, 3], 1))[:3]
    G[:3, 3] = F["j_kosi"] - hk  # pelvis on the FFXIV pelvis
    H = {n: (G @ np.append(m[:3, 3], 1))[:3] for n, m in kh_bind.items()}

    # ---- head: rigid, scaled per race, his eyes (lens centroids) on the wearer's (iris centroids)
    lens = next(g for g in geoms.values() if g["name"] == "p_ex001_Eyelens_Inst")
    lp = (G @ np.c_[lens["pos"], np.ones(len(lens["pos"]))].T).T[:, :3]
    sora_l, sora_r = lp[lp[:, 0] > 0].mean(0), lp[lp[:, 0] < 0].mean(0)
    target = np.array(eye["mid"]) + [0, prof["eye_dy"], prof["eye_dz"]]
    M_head = affine(prof["head"] * np.eye(3), (sora_l + sora_r) / 2, target)
    head_joint = (M_head @ np.append(H["atama"], 1))[:3]
    print(f"  head x{prof['head']}: his eyes {np.linalg.norm(sora_l - sora_r) * prof['head'] * 100:.1f} cm apart "
          f"(wearer's {np.linalg.norm(np.subtract(eye['left'], eye['right'])) * 100:.1f}), head joint "
          f"{np.round(head_joint, 3)} vs j_kao {np.round(F['j_kao'], 3)}")

    # ---- torso lattice: piecewise-linear by height through matching joints
    knots = [("L_momo", "j_asi_a_l"), ("koshi", "j_kosi"), ("hara2", "j_sebo_b"), ("mune", "j_sebo_c"),
             ("L_ude1", "j_ude_a_l"), ("kubi", "j_kubi")]
    kh_y = np.array([H[a][1] for a, _ in knots])
    ff_y = np.array([F[b][1] for _, b in knots])
    order_ok = np.all(np.diff(kh_y) > 0) and np.all(np.diff(ff_y) > 0)
    print("torso knots KH y", np.round(kh_y, 3), "FF y", np.round(ff_y, 3), "monotonic", order_ok)
    if not order_ok:
        keep = [0, 1, 3, 5]
        kh_y, ff_y, knots = kh_y[keep], ff_y[keep], [knots[i] for i in keep]
    dz = np.array([F[b][2] - H[a][2] for a, b in knots])
    sx_y = np.array([H["L_momo"][1], H["L_ude1"][1]])
    sx_v = np.array([F["j_asi_a_l"][0] / H["L_momo"][0], F["j_ude_a_l"][0] / H["L_ude1"][0]])
    print("torso width scale hip/shoulder", np.round(sx_v, 3))

    def field(p):  # p: (n,3)
        y = p[:, 1]
        y2 = np.interp(y, kh_y, ff_y)
        lo, hi = y < kh_y[0], y > kh_y[-1]
        y2[lo] = ff_y[0] + (y[lo] - kh_y[0])
        y2[hi] = ff_y[-1] + (y[hi] - kh_y[-1])
        sx = np.interp(y, sx_y, sx_v)
        z2 = p[:, 2] + np.interp(y, kh_y, dz)
        return np.stack([p[:, 0] * sx, y2, z2], 1), sx

    def field_point(p):
        return field(p[None, :])[0][0]

    # ---- per-bone affine transforms, parents first
    M, R_of = {}, {}

    def deformer_parent(b):
        p = kh_parents.get(b)
        while p is not None and p not in DEFORMERS and p not in TORSO_ROOTS:
            p = kh_parents.get(p)
        return p

    def depth(b):
        d, p = 0, b
        while p is not None:
            p, d = kh_parents.get(p), d + 1
        return d

    for b in sorted(DEFORMERS, key=depth):
        kh_child, ff_bone, ff_child, stretch, twist = DEFORMERS[b]
        if b == "atama":
            M[b], R_of[b] = M_head, np.eye(3)
            continue
        par = deformer_parent(b)
        anchor = field_point(H[b]) if (par is None or par in TORSO_ROOTS) else (M[par] @ np.append(H[b], 1))[:3]
        if b in ANCHOR_FF:
            print(f"  {b}: knuckle moved {np.linalg.norm(anchor - F[ff_bone]) * 100:.1f} cm onto {ff_bone}")
            anchor = F[ff_bone]
        if kh_child is None:
            lin = np.eye(3) if b in IDENTITY_ROT else R_of[par]
            R_of[b] = lin
            M[b] = affine(lin, H[b], anchor)
            continue
        d_kh = H[kh_child] - H[b]
        reach = head_joint if b == "kubi" else F[ff_child]   # the neck ends where the placed head starts
        d_ff = (reach - anchor) if stretch else (F[ff_child] - F[ff_bone])
        R = rot_between(d_kh, d_ff)
        if twist:
            (ka, kb), (fa, fb) = twist
            u = R @ (H[kb] - H[ka])
            w = F[fb] - F[fa]
            axis = d_ff / np.linalg.norm(d_ff)
            u -= axis * np.dot(u, axis)
            w -= axis * np.dot(w, axis)
            ang = math.atan2(np.dot(np.cross(u, w), axis), np.dot(u, w))
            print(f"  {b}: twist {math.degrees(ang):.1f} deg")
            R = axis_angle(axis, ang) @ R
        lin = R
        if stretch:
            k = np.linalg.norm(d_ff) / np.linalg.norm(d_kh)
            u = d_kh / np.linalg.norm(d_kh)
            lin = R @ (np.eye(3) + (k - 1) * np.outer(u, u))
            print(f"  {b} -> {ff_bone}: stretch {k:.3f}")
        R_of[b] = R
        M[b] = affine(lin, H[b], anchor)

    # ---- torso weights by height. KH3 paints the jacket front and hem (suso chains), the shirt, the belt (koshi)
    # and the chest (mune) on different bones; mapped bone for bone, layers at the same height followed different
    # FFXIV bones and slid through each other when the idle pose bent the spine (lining through the lapels, belt
    # strap over the jacket hem). Every torso weight is spread over pelvis and spine by the vertex's height instead.
    hip_y = F["j_kosi"][1]
    spine_knots = [(hip_y - 0.04, "j_kosi"), (hip_y + 0.04, "j_sebo_a"), (F["j_sebo_b"][1], "j_sebo_b"),
                   (F["j_sebo_c"][1], "j_sebo_c")]

    def spine_weights(y):
        if y <= spine_knots[0][0]:
            return [(spine_knots[0][1], 1.0)]
        for (y0, b0), (y1, b1) in zip(spine_knots, spine_knots[1:]):
            if y <= y1:
                t = (y - y0) / (y1 - y0)
                return [(b0, 1 - t), (b1, t)]
        return [(spine_knots[-1][1], 1.0)]

    # ---- deform every mesh
    deformer_of = {}
    skin_of = {}
    for kb in kh_parents:
        d = nearest(kb, kh_parents, set(DEFORMERS) | TORSO_ROOTS)
        deformer_of[kb] = d if d in DEFORMERS else None
        skin_of[kb] = SKIN_MAP[nearest(kb, kh_parents, SKIN_MAP)]
    out_meshes = []  # (model, material, positions, normals, uvs, tris, weights[(names, w)])
    wanted = {**{k: ("body", (v, None)) for k, v in BODY_MESHES.items()},
              **{k: ("met", v) for k, v in HEAD_MESHES.items()}}
    for gid, g in geoms.items():
        if g["name"] not in wanted:
            continue
        model, (mat, cell) = wanted[g["name"]]
        sk = skins[gid]
        P = (G @ np.c_[g["pos"], np.ones(len(g["pos"]))].T).T[:, :3]
        Nrm = (G[:3, :3] @ g["nrm"].T).T
        n = len(P)
        newP = np.zeros_like(P)
        # per-vertex: blend affine transforms
        vert_lin = np.zeros((n, 3, 3))
        tp, tsx = field(P)
        ff_w = []
        for vi, infl in enumerate(sk["weights"]):
            acc = {}
            for ji, w in infl:
                kb = sk["joints"][ji]
                d = deformer_of[kb]
                if d is None:
                    newP[vi] += w * tp[vi]
                    vert_lin[vi] += w * np.diag([tsx[vi], 1, 1])
                else:
                    newP[vi] += w * (M[d][:3, :3] @ P[vi] + M[d][:3, 3])
                    vert_lin[vi] += w * M[d][:3, :3]
                fb = skin_of[kb]
                if d is None and fb in TORSO_SKIN:
                    for sb, sw in spine_weights(tp[vi][1]):
                        acc[sb] = acc.get(sb, 0) + w * sw
                else:
                    acc[fb] = acc.get(fb, 0) + w
            tot = sum(w for _, w in infl)
            if tot > 0 and abs(tot - 1) > 1e-4:
                newP[vi] /= tot
                vert_lin[vi] /= tot
            top4 = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
            s = sum(w for _, w in top4) or 1
            ff_w.append([(b, w / s) for b, w in top4 if w / s > 0.001])
        # normals: per corner, use the vertex's blended linear part (inverse transpose)
        inv_t = np.linalg.inv(vert_lin).transpose(0, 2, 1)
        c_pos = g["c_pos"].ravel()
        c_n = np.einsum("nij,nj->ni", inv_t[c_pos], Nrm[g["c_nrm"].ravel()])
        c_n /= np.linalg.norm(c_n, axis=1, keepdims=True)
        uv = g["uv"][g["c_uv"].ravel()].reshape(-1, 3, 2)
        shift = np.floor(uv.mean(1, keepdims=True))  # wrap each triangle's UVs into 0..1
        uv = (uv - shift).reshape(-1, 2)
        if cell:
            uv = to_atlas_uv(uv, cell)
        out_meshes.append(dict(model=model, material=mat, src=g["name"], pos=newP, c_nrm=c_n, c_uv=uv,
                               tris=g["c_pos"], weights=ff_w))
        print(f"deformed {g['name']}: {n} verts, {len(g['c_pos'])} tris -> {model}")

    # ---- split body meshes by dominant FFXIV region per triangle
    def region(bone):
        if bone.startswith(("j_te_", "j_oya", "j_hito", "j_naka", "j_kusu", "j_ko_")):
            return "glv"
        if bone.startswith(("j_asi_d", "j_asi_e")):
            return "sho"
        if bone.startswith(("j_asi_a", "j_asi_b", "j_asi_c")) or bone == "j_kosi":
            return "dwn"
        return "top"

    pieces = []  # (model name, mesh dict subset)
    for m in out_meshes:
        if m["model"] != "body":
            pieces.append((m["model"], m, np.arange(len(m["tris"]))))
            continue
        vreg = []
        for infl in m["weights"]:
            score = {}
            for b, w in infl:
                score[region(b)] = score.get(region(b), 0) + w
            vreg.append(score)
        tri_reg = []
        for t in m["tris"]:
            score = {}
            for v in t:
                for r, w in vreg[v].items():
                    score[r] = score.get(r, 0) + w
            tri_reg.append(max(score, key=score.get))
        tri_reg = np.array(tri_reg)
        for slot in ("top", "glv", "dwn", "sho"):
            idx = np.nonzero(tri_reg == slot)[0]
            if len(idx):
                pieces.append((slot, m, idx))

    stats = {}
    out_dir = os.path.join(OUT_DIR, race)
    os.makedirs(out_dir, exist_ok=True)
    groups = {}
    for slot, m, idx in pieces:
        groups.setdefault(slot, []).append((m, idx))
    # head and jacket surfaces in game space, for showthrough.py
    parts = {}
    for slot in ("met", "top"):
        P, T, n = [], [], 0
        for m, idx in groups.get(slot, []):
            used, remap = np.unique(m["tris"][idx], return_inverse=True)
            P.append(m["pos"][used])
            T.append(remap.reshape(-1, 3) + n)
            n += len(used)
        parts[f"{slot}_pos"], parts[f"{slot}_faces"] = np.vstack(P), np.vstack(T)
    np.savez(os.path.join(out_dir, "parts.npz"), **parts)
    for slot, items in groups.items():
        objs = []
        used_bones = set()
        for mi, (m, idx) in enumerate(items):
            mat_name = f"/mt_{race}{SET}_{slot}_{LETTER[slot][m['material']]}.mtrl"
            obj = build_object(f"{slot} {mi}.0", m, idx, mat_name)
            used_bones |= {vg.name for vg in obj.vertex_groups}
            objs.append(obj)
            stats.setdefault(slot, []).append(dict(mesh=obj.name, source=m["src"], material=mat_name,
                                                   verts=len(obj.data.vertices), tris=len(obj.data.polygons)))
        arm = build_armature(f"{slot}_skeleton", ff, used_bones)
        for obj in objs:
            obj.parent = arm
            mod = obj.modifiers.new("Armature", "ARMATURE")
            mod.object = arm
        print(f"{slot}: {len(objs)} meshes, {len(used_bones)} bones: {sorted(used_bones)}")
        export_gltf(os.path.join(out_dir, f"{slot}.glb"), objs + [arm])
        if PREVIEW:
            continue
        for o in objs + [arm]:
            o.hide_set(True)
            o.hide_render = True
    with open(os.path.join(out_dir, "models.json"), "w") as f:
        json.dump(stats, f, indent=1)
    if PREVIEW:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "sora_fitted.blend"))


def game_to_blender(p):
    return np.stack([p[..., 0], -p[..., 2], p[..., 1]], -1)


def build_object(name, m, tri_idx, mat_name):
    tris = m["tris"][tri_idx]
    used, remap = np.unique(tris, return_inverse=True)
    remap = remap.reshape(-1, 3)
    corner_idx = (tri_idx[:, None] * 3 + np.arange(3)[None, :]).ravel()
    me = bpy.data.meshes.new(name)
    co = game_to_blender(m["pos"][used])
    me.vertices.add(len(used))
    me.vertices.foreach_set("co", co.astype(np.float32).ravel())
    me.loops.add(len(tris) * 3)
    me.loops.foreach_set("vertex_index", remap.ravel().astype(np.int32))
    me.polygons.add(len(tris))
    me.polygons.foreach_set("loop_start", (np.arange(len(tris)) * 3).astype(np.int32))
    me.update(calc_edges=True)
    uvl = me.uv_layers.new(name="UVMap")
    uvl.data.foreach_set("uv", m["c_uv"][corner_idx].astype(np.float32).ravel())
    col = me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
    rgba = np.ones((len(tris) * 3, 4), np.float32)
    if m["material"] in SKIN_KEYS:
        rgba[:, 0] = 0.0  # skin.shpk reads R as body-style shading; faces and hands are 0, else the skin looks hazy
    col.data.foreach_set("color", rgba.ravel())
    me.color_attributes.active_color = col
    me.normals_split_custom_set(game_to_blender(m["c_nrm"][corner_idx]).astype(np.float32).tolist())
    mat = bpy.data.materials.get(mat_name) or bpy.data.materials.new(mat_name)
    me.materials.append(mat)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    vgs = {}
    for new_i, old_i in enumerate(used):
        for b, w in m["weights"][old_i]:
            if b not in vgs:
                vgs[b] = obj.vertex_groups.new(name=b)
            vgs[b].add([new_i], w, "REPLACE")
    return obj


def build_armature(name, ff, used):
    need = set()
    for b in used:
        while b is not None:
            need.add(b)
            b = ff[b]["parent"]
    arm_data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    to_bl = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float)
    # FFXIV bones point down their local X; Blender bones point down local Y.
    x_to_y = np.array([[0, 1, 0], [-1, 0, 0], [0, 0, 1]], float)
    import mathutils
    ebs = {}
    for b in sorted(need, key=lambda n: list(ff).index(n)):
        w = ff[b]["world"]
        rot = w[:3, :3] / np.linalg.norm(w[:3, :3], axis=0)
        mb = np.eye(4)
        mb[:3, :3] = to_bl @ rot @ x_to_y
        mb[:3, 3] = to_bl @ w[:3, 3]
        eb = arm_data.edit_bones.new(b)
        eb.head = (0, 0, 0)
        eb.tail = (0, 0.04, 0)
        eb.matrix = mathutils.Matrix(mb.tolist())
        ebs[b] = eb
    for b, eb in ebs.items():
        p = ff[b]["parent"]
        if p in ebs:
            eb.parent = ebs[p]
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def export_gltf(path, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    kwargs = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=False,
                  export_texcoords=True, export_normals=True, export_tangents=True, export_materials="EXPORT",
                  export_skins=True, export_all_influences=False, export_animations=False, export_morph=False,
                  export_yup=True, export_def_bones=False)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    if "export_vertex_color" in props:
        kwargs["export_vertex_color"] = "ACTIVE"
    elif "export_colors" in props:
        kwargs["export_colors"] = True
    kwargs = {k: v for k, v in kwargs.items() if k in props or k == "filepath"}
    bpy.ops.export_scene.gltf(**kwargs)
    print("exported", path)


main()
