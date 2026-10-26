"""Rebuild everything: python -P tools/make.py [--from <step>]  (run from the project folder)"""
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
STEPS = ["build", "pack", "validate", "make_preview"]


def main():
    start = sys.argv[sys.argv.index("--from") + 1] if "--from" in sys.argv else STEPS[0]
    env = {**os.environ, "PYTHONPATH": str(HERE)}
    for step in STEPS[STEPS.index(start):]:
        print(f"== {step}")
        if subprocess.run([sys.executable, "-P", str(HERE / f"{step}.py")], env=env).returncode:
            sys.exit(f"{step} failed")


if __name__ == "__main__":
    main()
