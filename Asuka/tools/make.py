"""Rebuild the whole Asuka mod: source mesh -> labels -> joints -> bake -> refs -> fit -> textures -> materials ->
models -> modpack -> checks, then the plugsuit-only mod. Run from anywhere:  python -P -E tools/make.py
(skip finished steps with e.g. --from build). The plugsuit steps come last: build_outfit points the build module at
work/build_outfit for the rest of the run."""
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PMP = os.path.join(ROOT, "out", "Asuka Langley (Evangelion).pmp")
OUTFIT_PMP = os.path.join(ROOT, "out", "Asuka Plugsuit (Evangelion).pmp")
STEPS = ["src", "labels", "joints", "bake", "prep_refs", "fit", "textures", "materials", "build", "pack",
         "glamourer_design", "validate_pmp", "render_preview", "build_outfit", "pack_outfit", "validate_outfit"]

start = sys.argv[sys.argv.index("--from") + 1] if "--from" in sys.argv else STEPS[0]
sys.path.insert(0, HERE)
for step in STEPS[STEPS.index(start):]:
    print(f"\n===== {step}")
    script = "validate_pmp" if step == "validate_outfit" else step
    sys.argv = [script, OUTFIT_PMP if step == "validate_outfit" else PMP] if script == "validate_pmp" else [step]
    runpy.run_path(os.path.join(HERE, f"{script}.py"), run_name="__main__")
