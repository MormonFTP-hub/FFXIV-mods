"""Check the built .pmp: every file parses with Penumbra/Lumina's own readers, every material a model names and
every texture a material names is shipped, the JSON file maps point at files in the pack, and the
manipulations are well formed.

    python -P -E tools/validate.py ["out/The Lich King (WoW).pmp"]
"""
import json
import os
import re
import shutil
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from pack import PMP  # noqa: E402


def material_dir(model_game_path):
    """Material folder of a gear or weapon model's first material set."""
    return model_game_path.split("/model/")[0] + "/material/v0001"


def main(pmp):
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
    game_paths, inner_of = set(), {}
    for m in maps:
        for gp, inner in m.items():
            game_paths.add(gp)
            inner_of[inner.replace("\\", "/")] = gp
            if inner.replace("\\", "/") not in names:
                problems.append(f"file map points at missing {inner}")
    for n in sorted(names):
        p = os.path.join(tmp, *n.split("/"))
        if n.endswith(".mdl"):
            out = xd.xivtool("mdlinfo", p)
            mats = re.search(r"materials: (.*)", out).group(1).split(", ")
            for mat in mats:
                gp = f"{material_dir(inner_of[n])}/{mat.lstrip('/')}"
                if gp not in game_paths:
                    problems.append(f"{n}: material {mat} not shipped ({gp})")
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
    for m in default["Manipulations"]:
        if m["Type"] not in ("Eqp", "Eqdp") or "SetId" not in m["Manipulation"]:
            problems.append(f"odd manipulation {m}")
    print(f"{len(default['Manipulations'])} manipulations")
    print("ALL OK" if not problems else "\n".join(["PROBLEMS:"] + problems))
    return not problems


if __name__ == "__main__":
    if not main(next((a for a in sys.argv[1:] if a.endswith(".pmp")), PMP)):
        sys.exit(1)
