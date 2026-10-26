"""Rebuild the whole Mina mod: source dump -> refs -> fit -> textures -> materials -> models -> modpack -> checks.
Run from anywhere:  python -P -E tools/make.py   (skip finished steps with e.g. --from build)"""
import os
import runpy
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PMP = os.path.join(ROOT, "out", "Mina (Deadlock).pmp")
BLEND = os.path.join(ROOT, "source", "MinaRIG_v0.2_88MMgX2.blend")
STEPS = ["export_src", "prep_refs", "fit", "textures", "materials", "build", "pack", "glamourer_design",
         "validate_pmp", "render_preview"]


def export_src():
    """The .blend's own scripts (its rig UI) are never run: Blender opens it with auto-run disabled."""
    sys.path.insert(0, HERE)
    import preview
    r = subprocess.run([preview.BLENDER, "-b", "--factory-startup", "--disable-autoexec", BLEND, "-P",
                        os.path.join(HERE, "blender", "export_src.py"), "--", ROOT], capture_output=True, text=True)
    print("\n".join(line for line in r.stdout.splitlines() if "split verts" in line))
    if r.returncode != 0:
        raise RuntimeError(r.stdout[-3000:] + r.stderr[-3000:])


start = sys.argv[sys.argv.index("--from") + 1] if "--from" in sys.argv else STEPS[0]
sys.path.insert(0, HERE)
for step in STEPS[STEPS.index(start):]:
    print(f"\n===== {step}")
    if step == "export_src":
        export_src()
        continue
    sys.argv = [step, PMP] if step == "validate_pmp" else [step]
    runpy.run_path(os.path.join(HERE, f"{step}.py"), run_name="__main__")
