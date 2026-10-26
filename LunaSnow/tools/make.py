"""Rebuild the whole Luna Snow mod: source dump -> albedo bake -> refs -> fit -> textures -> materials -> models ->
modpack -> checks.
Run from anywhere:  python -P -E tools/make.py   (skip finished steps with e.g. --from build)
The source (source/cdn) comes from tools/fetch.py; tools/native/build.ps1 builds the KTX2/meshopt decoder DLL."""
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PMP = os.path.join(ROOT, "out", "Luna Snow - Coalsack Nebula (Marvel Rivals).pmp")
STEPS = ["extract_src", "shade", "prep_refs", "fit", "textures", "materials", "build", "pack", "glamourer_design",
         "validate_pmp", "render_preview"]

start = sys.argv[sys.argv.index("--from") + 1] if "--from" in sys.argv else STEPS[0]
sys.path.insert(0, HERE)
for step in STEPS[STEPS.index(start):]:
    print(f"\n===== {step}", flush=True)
    sys.argv = [step, PMP] if step == "validate_pmp" else [step]
    runpy.run_path(os.path.join(HERE, f"{step}.py"), run_name="__main__")
