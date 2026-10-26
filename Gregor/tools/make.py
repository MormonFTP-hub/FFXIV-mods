"""Rebuild the whole Gregor mod: FBX dump -> refs -> fit -> textures -> materials -> models -> modpack -> checks.
Run from anywhere:  python -P -E tools/make.py   (skip finished steps with e.g. --from build)"""
import os
import runpy
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BLENDER = os.path.join(os.path.dirname(ROOT), "Aerith", "apps", "blender-4.5.14-windows-x64", "blender.exe")
PMP = os.path.join(ROOT, "out", "Gregor AEDD (Limbus Company).pmp")
STEPS = ["export_src", "prep_refs", "fit", "textures", "materials", "build", "pack", "glamourer_design", "validate_pmp"]

start = sys.argv[sys.argv.index("--from") + 1] if "--from" in sys.argv else STEPS[0]
sys.path.insert(0, HERE)
for step in STEPS[STEPS.index(start):]:
    print(f"\n===== {step}")
    if step == "export_src":
        subprocess.run([BLENDER, "-b", "--factory-startup", "-P", os.path.join(HERE, "blender", "export_src.py"), "--", ROOT],
                       check=True)
        continue
    sys.argv = [step, PMP] if step == "validate_pmp" else [step]
    runpy.run_path(os.path.join(HERE, f"{step}.py"), run_name="__main__")
