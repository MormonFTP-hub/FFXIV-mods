"""Check the .pmp as Penumbra and the game would see it.

- every redirect points at a file in the pack, and every shipped file parses (mdl, mtrl, tex)
- every material the model names resolves for each mammet variant's material set (shipped or vanilla)
- every texture those materials name is shipped or vanilla
- the IMC options load through Penumbra's own manipulation reader, with the intended masks
"""
import json
import os
import shutil
import struct
import zipfile

import build
import pack
import xivdata as xd

OUT = os.path.join(xd.ROOT, "work", "validate")
EXPECT = {"Stay mammets": 0x3FD, "Become Chao too": 0x3FE}
MAX_MATERIALS = 4   # Penumbra's MdlMaterialMaximum


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    with zipfile.ZipFile(pack.PMP) as z:
        z.extractall(OUT)
        names = set(z.namelist())
    default = json.load(open(os.path.join(OUT, "default_mod.json")))
    redirects = {g: p.replace("\\", "/") for g, p in default["Files"].items()}
    problems = []
    for g, p in redirects.items():
        if p not in names:
            problems.append(f"missing in pack: {p} (for {g})")
    for p in sorted(set(redirects.values())):
        local = os.path.join(OUT, p)
        cmd = {".mdl": "mdlinfo", ".mtrl": "mtrlinfo", ".tex": "texinfo"}[os.path.splitext(p)[1]]
        first = xd.xivtool(cmd, local).splitlines()[0]
        print(f"ok {p}: {first[:110]}")

    def resolve(game):
        return os.path.join(OUT, redirects[game]) if game in redirects else xd.extract(game)[0]

    imc = pack.vanilla_imc()
    mdl = xd.model(resolve(build.MDL_PATH))
    if len(mdl["materials"]) > MAX_MATERIALS:
        problems.append(f"model names {len(mdl['materials'])} materials (Penumbra's MdlMaterialMaximum is {MAX_MATERIALS})")
    print(f"ok model: {len(mdl['materials'])} materials (at most {MAX_MATERIALS})")
    for variant in (1, *pack.GC_VARIANTS):
        mat_set = imc[variant]["material"]
        for mat in mdl["materials"]:
            game = f"{build.BODY}/material/v{mat_set:04d}/{mat.lstrip('/')}"
            local = resolve(game)
            if local is None:
                problems.append(f"variant {variant}: material {game} missing")
                continue
            for tex in xd.material(local)["textures"]:
                if resolve(tex) is None:
                    problems.append(f"variant {variant}: texture {tex} missing (from {game})")
        print(f"ok variant {variant}: {len(mdl['materials'])} materials in v{mat_set:04d} and their textures resolve")

    for f in sorted(os.listdir(OUT)):
        if f.startswith("group_"):
            out = xd.xivtool("checkmanips", os.path.join(OUT, f))
            print(out.rstrip())
            g = json.load(open(os.path.join(OUT, f)))
            for o in g["Options"]:
                masks = {m["Manipulation"]["Variant"]: m["Manipulation"]["Entry"]["AttributeMask"] for m in o["Manipulations"]}
                if masks != {v: EXPECT[o["Name"]] for v in pack.GC_VARIANTS}:
                    problems.append(f"option {o['Name']}: unexpected masks {masks}")
            if out.count("valid=True") != sum(len(o["Manipulations"]) for o in g["Options"]):
                problems.append(f"{f}: not every IMC manipulation loaded as valid")

    print("\n".join(["PROBLEMS:"] + problems) if problems else "all checks passed")
    return not problems


if __name__ == "__main__":
    raise SystemExit(0 if main() else 1)
