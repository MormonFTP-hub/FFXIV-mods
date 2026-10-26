"""Rebuild the whole Griffith mod: refs -> fit -> textures -> materials -> models -> modpack -> checks.
Run from anywhere:  python -P -E tools/make.py   (skip finished steps with e.g. --from build)"""
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
STEPS = ["prep_refs", "fit", "textures", "materials", "build", "pack", "validate_pmp"]

start = sys.argv[sys.argv.index("--from") + 1] if "--from" in sys.argv else STEPS[0]
sys.path.insert(0, HERE)
for step in STEPS[STEPS.index(start):]:
    print(f"\n===== {step}")
    runpy.run_path(os.path.join(HERE, f"{step}.py"), run_name="__main__")
