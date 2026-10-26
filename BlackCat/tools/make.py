"""Rebuild the whole Black Cat mod: unpack -> bake -> refs -> fit -> textures -> materials -> models -> modpack -> checks.
Run from anywhere:  python -P -E tools/make.py   (skip finished steps with e.g. --from build)
The source download (tools/fetch.py) is not part of it: source/cdn is kept."""
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PMP = os.path.join(ROOT, "out", "Black Cat - Pink Purr (Marvel Rivals).pmp")
STEPS = ["extract_src", "bake_src", "prep_refs", "fit", "textures", "materials", "build", "pack", "glamourer_design",
         "validate_pmp", "render_preview"]

start = sys.argv[sys.argv.index("--from") + 1] if "--from" in sys.argv else STEPS[0]
sys.path.insert(0, HERE)
for step in STEPS[STEPS.index(start):]:
    print(f"\n===== {step}")
    sys.argv = [step, PMP] if step == "validate_pmp" else [step]
    runpy.run_path(os.path.join(HERE, f"{step}.py"), run_name="__main__")
