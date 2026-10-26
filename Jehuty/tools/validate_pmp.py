"""Check a built .pmp: every file parses with Penumbra/Lumina's own readers, every material a model names and
every texture a material names is shipped (face hiders name their face's own vanilla material, which must exist
in the game), the JSON file maps point at files that exist in the pack, and Penumbra's own reader loads every
manipulation.

    python -P -E tools/validate_pmp.py "out/Lady Loki - Seaside Siren (Marvel Rivals).pmp"
"""
import json
import os
import re
import shutil
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402

pmp = sys.argv[1]
tmp = os.path.join(xd.ROOT, "work", "validate")
shutil.rmtree(tmp, ignore_errors=True)
z = zipfile.ZipFile(pmp)
z.extractall(tmp)
names = {n.replace("\\", "/") for n in z.namelist()}
problems = []

default = json.load(open(os.path.join(tmp, "default_mod.json"), encoding="utf-8"))
maps = [default["Files"]]
for n in sorted(names):
    if n.startswith("group_"):
        g = json.load(open(os.path.join(tmp, n), encoding="utf-8"))
        maps += [o["Files"] for o in g["Options"]]
game_paths = set()
for m in maps:
    for gp, inner in m.items():
        game_paths.add(gp)
        if inner.replace("\\", "/") not in names:
            problems.append(f"file map points at missing {inner}")

for n in sorted(names):
    p = os.path.join(tmp, *n.split("/"))
    if n.endswith(".mdl"):
        out = xd.xivtool("mdlinfo", p)
        mats = re.search(r"materials: (.*)", out).group(1).split(", ")
        for mat in mats:
            m = mat.lstrip("/")
            if "e0666" in m:
                if f"chara/equipment/e0666/material/v0001/{m}" not in game_paths:
                    problems.append(f"{n}: material {mat} not shipped")
            else:   # face hider: the face's own vanilla material
                race, face = m[3:8], m[8:13]
                if not xd.exists(f"chara/human/{race}/obj/face/{face}/material/{m}"):
                    problems.append(f"{n}: vanilla material {mat} not in the game")
        print(f"MDL  {n}: {out.splitlines()[0]} | {len(mats)} materials")
    elif n.endswith(".mtrl"):
        out = xd.xivtool("mtrlinfo", p)
        for t in re.findall(r"tex (\S+)", out):
            if t not in game_paths:
                problems.append(f"{n}: texture {t} not shipped")
        print(f"MTRL {n}: {out.splitlines()[0]}")
    elif n.endswith(".tex"):
        a = xd.texture(p)
        print(f"TEX  {n}: decoded {a.shape[1]}x{a.shape[0]}")
for n in sorted(names):
    if n == "default_mod.json" or n.startswith("group_"):
        for line in xd.xivtool("checkmanips", os.path.join(tmp, n)).splitlines():
            if "in json" in line:
                print(f"META {n}: {line.strip()}")
                want, got = re.search(r"(\d+) in json, (\d+) loaded", line).groups()
                if want != got:
                    problems.append(f"{n}: Penumbra loaded {got} of {want} manipulations")
            elif "valid=False" in line:
                problems.append(f"{n}: invalid manipulation {line.strip()}")
print("ALL OK" if not problems else "\n".join(["PROBLEMS:"] + problems))

