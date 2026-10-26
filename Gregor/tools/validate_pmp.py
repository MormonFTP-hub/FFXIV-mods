"""Check a built .pmp: every file parses with Penumbra/Lumina's own readers, every material a model names and
every texture a material names is shipped (or is the body skin material), and the JSON file maps point at
files that exist in the pack.

    python -P -E tools/validate_pmp.py "out/Aerith Gainsborough (FF7R).pmp"
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
            if "b0001" in mat:
                continue  # skin: the game uses the wearer's own body material
            gp = f"chara/equipment/e6148/material/v0001/{mat.lstrip('/')}"
            if gp not in game_paths:
                problems.append(f"{n}: material {mat} not shipped")
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
print("ALL OK" if not problems else "\n".join(["PROBLEMS:"] + problems))
