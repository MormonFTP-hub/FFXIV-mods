"""Build the .mtrl files: a vanilla Dawntrail character.shpk gear material (e0800) as template, pointed at our
textures, no dye, and a colour table with one row pair per surface kind (textures.PAIRS). The odd row of
each pair is its glowing variant, which the id map's G channel blends towards."""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from textures import GEAR_DIR, PAIRS, WEAPON_DIR  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "mtrl")
TEMPLATE = "chara/equipment/e0800/material/v0001/mt_c0101e0800_top_a.mtrl"
DOUBLE_SIDED = 0xC  # template is 0xD; bit 0 hides backfaces (the plates, cape, fur and hair are thin shells)
TRANSPARENT = 0x10  # alpha blending

GLOW = [0.35, 0.85, 1.5]  # ice blue
SURFACES = {  # kind -> row properties (the odd row adds GLOW)
    "metal": {"Roughness": 0.45, "Metalness": 0.7},
    "leather": {"Roughness": 0.65, "Metalness": 0.0},
    "cloth": {"Roughness": 0.8, "Metalness": 0.0},
    "cape": {"Roughness": 0.85, "Metalness": 0.0},
    "fur": {"Roughness": 0.9, "Metalness": 0.0},
    "skin": {"Roughness": 0.55, "Metalness": 0.0},
    "hair": {"Roughness": 0.6, "Metalness": 0.0},
    "steel": {"Roughness": 0.3, "Metalness": 0.9},
    "hilt": {"Roughness": 0.4, "Metalness": 0.8},
    "mist": {"Roughness": 1.0, "Metalness": 0.0, "EmissiveColor": [0.15, 0.4, 0.75]},
}
MATERIALS = {  # name -> (texture dir, texture set, flags, alpha threshold)
    "lk_a": (GEAR_DIR, "lk_a", DOUBLE_SIDED, 0.5),
    "lk_b": (GEAR_DIR, "lk_b", DOUBLE_SIDED, 0.5),
    "lk_mist": (GEAR_DIR, "lk_mist", DOUBLE_SIDED | TRANSPARENT, 0.02),
    "fm": (WEAPON_DIR, "fm", 0xD, 0.5),
}


def spec(tex_dir, texset, flags, threshold):
    plain = {"DiffuseColor": [1, 1, 1], "SpecularColor": [1, 1, 1], "EmissiveColor": [0, 0, 0],
             "TileAlpha": 0, "TileIndex": 0, "SphereMapMask": 0, "ShaderId": 0, **SURFACES["metal"]}
    rows = {str(r): dict(plain) for r in range(32)}
    for kind, pair in PAIRS.items():
        rows[str(2 * pair)].update(SURFACES[kind])
        rows[str(2 * pair + 1)].update(SURFACES[kind])
        rows[str(2 * pair + 1)]["EmissiveColor"] = [g * (1.4 if kind == "mist" else 1) for g in GLOW]
    return {"textures": [f"{tex_dir}_{texset}_{t}.tex" for t in ("base", "norm", "mask", "id")],
            "flags": flags, "baseRow": 2, "rows": rows, "constants": {"0x29AC0223": [threshold]}}


def build():
    os.makedirs(OUT, exist_ok=True)
    template = xd.extract(TEMPLATE)[0]
    out = {}
    for name, (tex_dir, texset, flags, threshold) in MATERIALS.items():
        js = os.path.join(OUT, f"{name}.json")
        json.dump(spec(tex_dir, texset, flags, threshold), open(js, "w"), indent=1)
        dst = os.path.join(OUT, f"{name}.mtrl")
        r = subprocess.run(xd.XIVTOOL + ["mtrlbuild", template, dst, js], capture_output=True, text=True)
        if r.returncode != 0 or "wrote" not in r.stdout:
            raise RuntimeError(r.stdout + r.stderr)
        out[name] = dst
        info = xd.xivtool("mtrlinfo", dst).splitlines()
        print(f"{name}: {info[0]}")
        for line in info:
            if line.strip().startswith(("tex ", "row  0", "row  1", "row 18", "row 19")):
                print("   ", line.strip())
    return out


if __name__ == "__main__":
    build()
