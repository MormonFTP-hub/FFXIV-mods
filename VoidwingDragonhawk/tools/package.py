"""Package everything as a Penumbra modpack: out/Voidwing Dragonhawk (Company Chocobo).pmp.

Replaces the chocobo (demihuman d0001), so it applies to the Company Chocobo mount and
every other mount and companion that uses the chocobo model:
  - skeleton (chocobo bones + dragonhawk bones) and the three resident animation packs
  - body model d0001e0001_dwn (also the e0009 / e0027 bodies) with its materials/textures
  - every barding piece (head / body / legs) and the default saddle, reins and leg wraps
    become empty models, so barding never floats around the dragonhawk
  - element ids (effect anchors) on moving chocobo bones moved to the matching dragonhawk bones
"""
import json
import struct
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from build_models import empty_mesh  # noqa: E402
from gltf_writer import write_glb  # noqa: E402
from wowsrc import ROOT, fk  # noqa: E402
from xiv_files import write_pmp  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

XIVTOOL = ROOT / "apps/xivtool/xivtool.exe"
MOD = ROOT / "work/mod"
GAME = ROOT / "work/game"
D = "chara/demihuman/d0001"
EQ = f"{D}/obj/equipment"
PMP = ROOT / "out/Voidwing Dragonhawk (Company Chocobo).pmp"
VERSION = "1.3.0"    # 1.1.0: spline-compressed animations (1.0.0's 29 MB mount.pap left the mount invisible)
#                      1.2.0: matched to the WoW source in GS: single-sided like WoW, _id G inverted to the
#                             game's meaning, less metal armour, no black mip fringes
#                      1.3.0: brighter colours, Neon's lift on every _base (build_textures.LIFT)
BODY_SETS = (1, 9, 27)          # sets that have their own chocobo body (dwn) model
BARDING_SLOTS = ("met", "top", "sho")

DESCRIPTION = """The Voidwing Dragonhawk (World of Warcraft: Midnight, Epic Edition mount) as your chocobo.

Replaces the chocobo model, so the Company Chocobo mount (and the Legacy / Black chocobo mounts and your chocobo companion) becomes the dragonhawk, with its own WoW animations: hovering idle, walk and run on the ground, flying idle / forward / turning / glide / take-off, swimming, jumping.

Barding is hidden while this is on. The chocobo's colour doesn't tint it.

Ported from the World of Warcraft model. For personal use only, please don't redistribute: the model and textures belong to Blizzard Entertainment."""


def xivtool(*args):
    r = subprocess.run([str(XIVTOOL), *map(str, args)], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stdout + r.stderr)
    return r.stdout


def barding_models():
    """{game path of every vanilla met/top/sho model: its first material name}."""
    paths = [f"{EQ}/e{s:04d}/model/d0001e{s:04d}_{slot}.mdl" for s in range(1, 200) for slot in BARDING_SLOTS]
    out = {}
    for i in range(0, len(paths), 100):            # stay under the Windows command-line limit
        for line in xivtool("mdlmaterials", *paths[i:i + 100]).splitlines():
            path, *mats = line.split("|")
            if mats and mats[0]:
                out[path] = mats[0]
    return out


def empty_models(models):
    """One empty .mdl per material name (an empty model must still name the vanilla material)."""
    skel = Skeleton(str(MOD / f"{D}/skeleton/base/b0001/skl_d0001b0001.sklb"))
    work = ROOT / "work/empty"
    work.mkdir(parents=True, exist_ok=True)
    lines, out = [], {}
    for mat in sorted(set(models.values())):
        stem = mat.strip("/").removesuffix(".mtrl")
        glb, mdl = work / f"{stem}.glb", work / f"{stem}.mdl"
        write_glb(glb, skel, [empty_mesh(mat, 0)])
        lines.append(f"{glb}|{mdl}")
        out[mat] = mdl
    (work / "list.txt").write_text("\n".join(lines))
    print("  ", xivtool("importmany", work / "list.txt").strip())
    return out


def imc_material_variants(set_id, part=3):
    """Material variant ids the given part (3 = dwn) uses across the set's imc variants."""
    p = GAME / f"{EQ}/e{set_id:04d}/e{set_id:04d}.imc"
    if not p.exists():
        xivtool("extract", GAME, f"{EQ}/e{set_id:04d}/e{set_id:04d}.imc")
    d = p.read_bytes()
    count, mask = struct.unpack_from("<HH", d, 0)
    parts = bin(mask).count("1")
    ids = set()
    for v in range(count + 1):
        o = 4 + (v * parts + part) * 6
        if o + 6 <= len(d):
            ids.add(d[o])
    return sorted(i for i in ids if i > 0) or [1]


def remap_eid():
    """Point effect anchors on moving chocobo bones at the matching dragonhawk bones."""
    src = GAME / f"{D}/skeleton/base/b0001/eid_d0001b0001.eid"
    d = bytearray(src.read_bytes())
    skel = json.loads((ROOT / "work/skeleton.json").read_text())
    names = skel["names"]
    pose = np.array(skel["pose"])
    wt, _, _ = fk(skel["parents"], pose[None, :, 0:3], pose[None, :, 4:8], pose[None, :, 8:11])
    wt = wt[0]
    dh = [i for i, n in enumerate(names) if n.startswith("dh_")]

    def nearest(target):
        return names[min(dh, key=lambda i: np.linalg.norm(wt[i] - target))]

    lo = min(wt[i][1] for i in dh)
    remap = {"j_kao": "dh_Head", "j_sebo_b": "dh_7", "n_hara": "dh_SpineLow", "j_kosi": "dh_3",
             "j_hane_i_l": nearest([2.0, wt[names.index('dh_SpineLow')][1], 0.0]),
             "j_hane_i_r": nearest([-2.0, wt[names.index('dh_SpineLow')][1], 0.0]),
             "j_asi_d_l": nearest([0.3, lo, 0.2]), "j_asi_d_r": nearest([-0.3, lo, 0.2])}
    n = struct.unpack_from("<I", d, 8)[0]
    changed = 0
    for i in range(n):
        o = 16 + i * 64
        name = d[o:o + 32].split(b"\0")[0].decode()
        if name in remap:
            d[o:o + 32] = remap[name].encode().ljust(32, b"\0")
            d[o + 36:o + 60] = struct.pack("<6f", 0, 0, 0, 0, 0, 0)
            changed += 1
    out = MOD / f"{D}/skeleton/base/b0001/eid_d0001b0001.eid"
    out.write_bytes(bytes(d))
    print(f"   element ids: {changed}/{n} moved to dragonhawk bones")
    return out


def main():
    files, default = {}, {}

    def add(game_path, local):
        inner = game_path
        files[inner] = local
        default[game_path] = inner.replace("/", "\\")

    # skeleton, element ids, animations
    add(f"{D}/skeleton/base/b0001/skl_d0001b0001.sklb", MOD / f"{D}/skeleton/base/b0001/skl_d0001b0001.sklb")
    add(f"{D}/skeleton/base/b0001/eid_d0001b0001.eid", remap_eid())
    for pap in ("mount", "demihuman", "idle"):
        gp = f"{D}/animation/a0001/bt_common/resident/{pap}.pap"
        add(gp, MOD / gp)

    # body model, materials (in every body set's variant folders) and textures
    body = MOD / f"{EQ}/e0001/model/d0001e0001_dwn.mdl"
    mtrls = sorted((MOD / f"{EQ}/e0001/material/v0001").glob("*.mtrl"))
    for s in BODY_SETS:
        gp = f"{EQ}/e{s:04d}/model/d0001e{s:04d}_dwn.mdl"
        files[f"{EQ}/e0001/model/d0001e0001_dwn.mdl"] = body
        default[gp] = f"{EQ}/e0001/model/d0001e0001_dwn.mdl".replace("/", "\\")
        for v in imc_material_variants(s):
            for m in mtrls:
                files[f"{EQ}/e0001/material/v0001/{m.name}"] = m
                default[f"{EQ}/e{s:04d}/material/v{v:04d}/{m.name}"] = f"{EQ}/e0001/material/v0001/{m.name}".replace("/", "\\")
    for t in sorted((MOD / f"{EQ}/e0001/texture").glob("*.tex")):
        add(f"{EQ}/e0001/texture/{t.name}", t)

    # barding and the default saddle / reins / leg wraps -> empty models
    models = barding_models()
    empties = empty_models(models)
    for gp, mat in models.items():
        inner = f"empty/{empties[mat].name}"
        files[inner] = empties[mat]
        default[gp] = inner.replace("/", "\\")

    meta_json = {"Name": "Voidwing Dragonhawk (Company Chocobo)", "Author": "ported from World of Warcraft",
                 "Description": DESCRIPTION, "Version": VERSION, "Website": "",
                 "ModTags": ["Mount", "Chocobo", "World of Warcraft", "Port", "Dragonhawk"]}
    write_pmp(PMP, meta_json, {"Files": default, "FileSwaps": {}, "Manipulations": []}, [], files)
    print(f"wrote {PMP.name} ({PMP.stat().st_size / 1e6:.1f} MB): {len(default)} game paths, {len(files)} files, "
          f"{len(models)} barding models hidden")


if __name__ == "__main__":
    main()
