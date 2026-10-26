"""Run the Blender bake (tools/blender/bake.py): game mesh, UVs and baked textures in work/bake."""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paint  # noqa: E402
import preview  # noqa: E402

ROOT = preview.ROOT
CONFIG = {
    "targets": {"head": 9000, "hair": 48000, "body": 58000},     # triangles per texture set
    "ao_distance": 0.08,
    "ao_samples": 64,
    "uv_angle": 66.0,
    "uv_margin": 0.003,
    "cage": 0.003,
    "ray": 0.008,
    "margin": 8,
    "texsets": list(paint.TEXSETS),
    "eye_box": list(paint.EYE_BOX),
    "sizes": {"head": {"base": 2048, "ao": 1024, "nrm": 2048},
              "hair": {"base": 2048, "ao": 2048, "nrm": 4096},
              "body": {"base": 4096, "ao": 2048, "nrm": 4096}},
}


def main():
    out = os.path.join(ROOT, "work", "bake")
    os.makedirs(out, exist_ok=True)
    cfg = os.path.join(out, "config.json")
    json.dump(CONFIG, open(cfg, "w"), indent=1)
    log = os.path.join(out, "bake.log")
    with open(log, "w") as f:
        r = subprocess.run([preview.BLENDER, "-b", "--factory-startup", "-P",
                            os.path.join(ROOT, "tools", "blender", "bake.py"), "--", ROOT, cfg],
                           stdout=f, stderr=subprocess.STDOUT, text=True)
    text = open(log).read()
    print("\n".join(l for l in text.splitlines() if l.startswith("[") or "Error" in l))
    if r.returncode != 0 or "BAKE DONE" not in text:
        raise RuntimeError(f"bake failed, see {log}")


if __name__ == "__main__":
    main()
