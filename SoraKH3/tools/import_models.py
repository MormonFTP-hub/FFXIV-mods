"""Convert the fitted glTF files into the final .mdl files with Penumbra's own importer (apps/xivtool import,
the same code as Advanced Editing > Models > Import), then:
  - copy the vanilla Air Cell model's flags (the fitted race's own, else its gender's Midlander) and keep at least its
    bounding radius (the importer writes radius 1)
  - turn sun shadows off on the head (flags1 bit 0, ShadowDisabled): the fringe striped his face with shadows (GS)
  - check vertex colour set 0 is white on the gear-shader meshes (black renders pitch black in game, Mantis 1.0.0)
    and every model names at most 4 materials (Penumbra's MdlMaterialMaximum)
and copy White Fox's empty face stand-ins for the opt-in face hider.

usage: python -P -E tools/import_models.py [races]   ->  work/mdl/<race>_<slot>.mdl, work/mdl/hide/*.mdl, index.json
"""
import json
import os
import pickle
import re
import shutil
import struct
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XIVTOOL = os.path.join(ROOT, "apps", "xivtool", "xivtool.exe")
GAME = os.path.join(ROOT, "work", "game")
SET = "e0907"
RACES = ("c0101", "c0201", "c0901", "c1101")
SLOTS = ("met", "top", "glv", "dwn", "sho")
MAX_MATERIALS = 4
NO_SHADOW = {"met"}
WHITEFOX_HIDERS = os.path.join(os.path.dirname(ROOT), "WhiteFox", "work", "build", "mdl", "index.pkl")


def set_flags1_bits(path, bits):
    """OR bits into the model header's flags1 byte (radius f32, 9 u16 counts, lodCount u8, flags1 u8)."""
    d = bytearray(open(path, "rb").read())
    n_vdecl = struct.unpack_from("<H", d, 12)[0]
    p = 0x44 + n_vdecl * 136
    str_size = struct.unpack_from("<I", d, p + 4)[0]
    d[p + 8 + str_size + 4 + 18 + 1] |= bits
    open(path, "wb").write(bytes(d))


def xivtool(*args):
    r = subprocess.run([XIVTOOL, *map(str, args)], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"xivtool {args[0]} failed:\n{r.stdout}{r.stderr}")
    return r.stdout


def info(path):
    out = xivtool("mdlinfo", path)
    radius = float(re.search(r"radius=([\d.eE+-]+)", out).group(1))
    mats = re.search(r"^materials: (.*)$", out, re.M).group(1).split(", ")
    lo = [float(v) for v in re.search(r"bbox min=(\S+)", out).group(1).split(",")[:3]]
    hi = [float(v) for v in re.search(r"max=(\S+)", out).group(1).split(",")[:3]]
    return radius, mats, lo, hi


def vanilla(race, slot):
    """Local copy of the vanilla Air Cell model for the race, else the Midlander woman's or man's (flags only)."""
    for r in dict.fromkeys((race, "c0201", "c0101")):
        gp = f"chara/equipment/{SET}/model/{r}{SET}_{slot}.mdl"
        local = os.path.join(GAME, *gp.split("/"))
        if os.path.exists(local) or "MISSING" not in xivtool("extract", GAME, gp):
            return local
    raise FileNotFoundError(f"no vanilla {SET} {slot} model")


def main(races=RACES):
    out_dir = os.path.join(ROOT, "work", "mdl")
    os.makedirs(out_dir, exist_ok=True)
    index_path = os.path.join(out_dir, "index.json")
    index = json.load(open(index_path)) if os.path.exists(index_path) else {}
    problems = []
    for race in races:
        for slot in SLOTS:
            glb = os.path.join(ROOT, "work", "gltf", race, f"{slot}.glb")
            mdl = os.path.join(out_dir, f"{race}_{slot}.mdl")
            res = xivtool("import", glb, mdl).strip()
            warnings = [l for l in res.splitlines() if l.startswith("WARN")]
            van = vanilla(race, slot)
            xivtool("mdlflags", mdl, mdl, van)
            v_radius, _, _, _ = info(van)
            _, mats, lo, hi = info(mdl)
            radius = max(v_radius, max(max(abs(a), abs(b)) for a, b in zip(lo, hi)))
            xivtool("mdlradius", mdl, mdl, f"{radius:.4f}")
            if slot in NO_SHADOW:
                set_flags1_bits(mdl, 0x01)
            flags = re.search(r"flags1=(.*?) flags2", xivtool("mdlinfo", mdl)).group(1)
            # vertex colour set 0 per mesh: white on gear-shader meshes; skin.shpk meshes carry (0, 1, 1, 1)
            whites, mesh_mat = [], None
            for line in xivtool("mdlstreams", mdl).splitlines():
                m = re.match(r"mesh \d+ (\S+)", line)
                if m:
                    mesh_mat = m.group(1)
                m = re.search(r"usage=7 usageIndex=0: mean=\[([^\]]*)\] min=\[([^\]]*)\]", line)
                if m:
                    mins = [float(v) for v in m.group(2).split(",")]
                    whites.append(min(mins[1:]) if mesh_mat and (mesh_mat.endswith("_d.mtrl") or
                                  (slot == "met" and mesh_mat.endswith("_a.mtrl"))) else min(mins))
            print(f"{race} {slot}: {os.path.getsize(mdl) // 1024} KB, {len(mats)} materials, radius {radius:.2f}, "
                  f"flags1 {flags}, min vertex colour {min(whites):.2f}{'' if not warnings else ', ' + '; '.join(warnings)}")
            if len(mats) > MAX_MATERIALS:
                problems.append(f"{race} {slot} names {len(mats)} materials")
            if min(whites) < 0.99:
                problems.append(f"{race} {slot} vertex colour set 0 is not white")
            index[f"{race}_{slot}"] = [mdl, f"chara/equipment/{SET}/model/{race}{SET}_{slot}.mdl"]
    # opt-in face hider: White Fox's empty stand-ins for every player face model
    hide_dir = os.path.join(out_dir, "hide")
    os.makedirs(hide_dir, exist_ok=True)
    for name, (local, game) in pickle.load(open(WHITEFOX_HIDERS, "rb")).items():
        if name.startswith("hide_"):
            dst = os.path.join(hide_dir, os.path.basename(local))
            shutil.copyfile(local, dst)
            index[name] = [dst, game]
    json.dump(index, open(index_path, "w"), indent=1)
    print(f"{sum(k.startswith('hide_') for k in index)} face stand-ins copied")
    if problems:
        sys.exit("PROBLEMS: " + "; ".join(problems))
    print("all models OK")


if __name__ == "__main__":
    main(tuple(sys.argv[1].split(",")) if len(sys.argv) > 1 else RACES)
