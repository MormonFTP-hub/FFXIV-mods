"""Rebuild everything: python -P tools/make.py [--from <step>]"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
STEPS = ["build_skeleton", "build_anims", "check_anims", "build_models", "build_textures", "build_materials", "package"]


def main():
    start = sys.argv[sys.argv.index("--from") + 1] if "--from" in sys.argv else STEPS[0]
    for step in STEPS[STEPS.index(start):]:
        if not (HERE / f"{step}.py").exists():
            print(f"== {step} (not written yet, skipped)")
            continue
        print(f"== {step}")
        r = subprocess.run([sys.executable, "-P", str(HERE / f"{step}.py")])
        if r.returncode:
            sys.exit(f"{step} failed")


if __name__ == "__main__":
    main()
