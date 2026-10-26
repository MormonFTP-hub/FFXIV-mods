"""The four dragonhawk .mtrl files: vanilla Dawntrail gear material (e0800) as template,
pointed at our textures, no dye table (so the chocobo's colour doesn't tint it), and a
colour table with one row pair per surface. Odd rows are the glowing variant; the id
map's G channel blends towards them.
"""
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_textures import PAIR, TEX_DIR  # noqa: E402
from wowsrc import ROOT  # noqa: E402

XIVTOOL = ROOT / "apps/xivtool/xivtool.exe"
TEMPLATE = ROOT / "work/game/chara/equipment/e0800/material/v0001/mt_c0101e0800_top_a.mtrl"
OUT = ROOT / "work/mod/chara/demihuman/d0001/obj/equipment/e0001/material/v0001"
# bit 0 hides backfaces. WoW draws every one of these surfaces single-sided (no two-sided bit in the M2
# material flags); drawn double-sided, the backs of the feather cards showed up black in GS
SINGLE_SIDED = 0xD     # the template's own flags
TRANSPARENT = 0x10     # alpha blending (Penumbra's ShaderFlags.EnableTransparency)

PLAIN = {"DiffuseColor": [1, 1, 1], "SpecularColor": [1, 1, 1], "EmissiveColor": [0, 0, 0],
         "Roughness": 0.6, "Metalness": 0.0, "TileAlpha": 0, "TileIndex": 0, "SphereMapMask": 0}
SURFACES = {   # pair -> (even row, odd row overrides)
    # low specular colour: WoW draws the feathers unlit, so the painted navy stays deep instead of reflecting grey sky
    "feather": ({"Roughness": 0.65, "SpecularColor": [0.25, 0.25, 0.3]},
                {"Roughness": 0.5, "SpecularColor": [0.25, 0.25, 0.3], "EmissiveColor": [0.25, 0.6, 1.6]}),
    "gem": ({"Roughness": 0.15}, {"Roughness": 0.1, "EmissiveColor": [1.1, 0.35, 1.8]}),
    # fully metallic gold and steel get no diffuse light in game (dark olive gold in GS); WoW lights them as
    # painted colour with a sheen, so keep most of the diffuse
    "gold": ({"Roughness": 0.35, "Metalness": 0.6}, {"Roughness": 0.35, "Metalness": 0.6}),
    "steel": ({"Roughness": 0.4, "Metalness": 0.45}, {"Roughness": 0.4, "Metalness": 0.45}),
    "void": ({"Roughness": 0.35, "EmissiveColor": [0.12, 0.05, 0.3]}, {"Roughness": 0.3, "EmissiveColor": [0.9, 0.55, 1.8]}),
    "eye": ({"Roughness": 0.1, "EmissiveColor": [0.2, 0.5, 1.0]}, {"Roughness": 0.1, "EmissiveColor": [0.6, 1.4, 2.4]}),
    "trim": ({"Roughness": 0.75}, {"Roughness": 0.75}),
}
MATERIALS = {   # letter -> (texture set, flags)
    "a": ("dh_feather", SINGLE_SIDED),
    "b": ("dh_armour", SINGLE_SIDED),
    "c": ("dh_void", SINGLE_SIDED | TRANSPARENT),
    "d": ("dh_eye", SINGLE_SIDED),
}


def spec(texset, flags):
    rows = {str(r): dict(PLAIN) for r in range(32)}
    for kind, (even, odd) in SURFACES.items():
        p = PAIR[kind]
        rows[str(2 * p)].update(even)
        rows[str(2 * p + 1)].update(even)
        rows[str(2 * p + 1)].update(odd)
    return {"textures": [f"{TEX_DIR}/{texset}_{t}.tex" for t in ("base", "norm", "mask", "id")],
            "flags": flags, "rows": rows, "constants": {"0x29AC0223": [0.5]}}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    work = ROOT / "work/mtrl"
    work.mkdir(parents=True, exist_ok=True)
    for letter, (texset, flags) in MATERIALS.items():
        js = work / f"{letter}.json"
        js.write_text(json.dumps(spec(texset, flags), indent=1))
        dst = OUT / f"mt_d0001e0001_dwn_{letter}.mtrl"
        r = subprocess.run([str(XIVTOOL), "mtrlbuild", str(TEMPLATE), str(dst), str(js)], capture_output=True, text=True)
        if r.returncode != 0 or "wrote" not in r.stdout:
            raise RuntimeError(r.stdout + r.stderr)
        info = subprocess.run([str(XIVTOOL), "mtrlinfo", str(dst)], capture_output=True, text=True).stdout.splitlines()
        print(dst.name, info[0])


if __name__ == "__main__":
    main()
