"""Check a built .pmp: every file parses with Penumbra/Lumina's own readers, every material a model names and
every texture a material names is shipped (in the same option or the always-on default files), and the JSON
file maps point at files that exist in the pack.

    python -P -E tools/validate_pmp.py "out/Jak (Jak II).pmp"
"""
import json
import os
import re
import shutil
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402


def material_game_path(model_game_path, mat):
    """Where the game looks for a material a model names: next to the model, in material/ (v0001 for gear and hair)."""
    folder = model_game_path.rsplit("/model/", 1)[0]
    n = mat.lstrip("/")
    return f"{folder}/material/{n}" if "/obj/face/" in folder else f"{folder}/material/v0001/{n}"


pmp = sys.argv[1]
tmp = os.path.join(xd.ROOT, "work", "validate")
shutil.rmtree(tmp, ignore_errors=True)
z = zipfile.ZipFile(pmp)
z.extractall(tmp)
names = {n.replace("\\", "/") for n in z.namelist()}
problems = []

default = json.load(open(os.path.join(tmp, "default_mod.json"), encoding="utf-8"))
maps = [("default", default["Files"])]
for n in sorted(names):
    if n.startswith("group_"):
        g = json.load(open(os.path.join(tmp, n), encoding="utf-8"))
        maps += [(f"{g['Name']} / {o['Name']}", o["Files"]) for o in g["Options"]]
for label, m in maps:
    visible = set(m) | set(default["Files"])   # an option sees its own files plus the default ones
    for gp, inner in m.items():
        inner = inner.replace("\\", "/")
        if inner not in names:
            problems.append(f"{label}: file map points at missing {inner}")
            continue
        p = os.path.join(tmp, *inner.split("/"))
        if gp.endswith(".mdl"):
            out = xd.xivtool("mdlinfo", p)
            mats = re.search(r"materials: (.*)", out).group(1).split(", ")
            for mat in mats:
                if material_game_path(gp, mat) not in visible:
                    problems.append(f"{label}: {gp} material {mat} not shipped")
            print(f"MDL  {gp}: {out.splitlines()[0]} | {len(mats)} materials")
        elif gp.endswith(".mtrl"):
            out = xd.xivtool("mtrlinfo", p)
            for t in re.findall(r"tex (\S+)", out):
                if t not in visible:
                    problems.append(f"{label}: {gp} texture {t} not shipped")
            print(f"MTRL {gp}: {out.splitlines()[0]}")
        elif gp.endswith(".tex"):
            a = xd.texture(p)
            print(f"TEX  {gp}: decoded {a.shape[1]}x{a.shape[0]}")
print(f"manipulations: {len(default['Manipulations'])}")
print("ALL OK" if not problems else "\n".join(["PROBLEMS:"] + problems))
