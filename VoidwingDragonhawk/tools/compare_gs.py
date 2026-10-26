"""Side by side: the original WoW model (rendered the way WoW draws it) vs the built pack in GS, same cameras.

python -P tools/compare_gs.py <tag> [--swap <game path>=<file> ...]   -> work/gs/compare_<tag>.png
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from gs_render import CAMS, ENVS, local_swaps, render  # noqa: E402
from wowsrc import ROOT, SCALE  # noqa: E402

BLENDER = ROOT.parent / "Aerith/apps/blender-4.5.14-windows-x64/blender.exe"
OUT = ROOT / "work/gs"
VIEWS = ["full", "head", "tail", "wing"]
SIZE = (800, 560)


def source():
    """Render the source once per camera set (cached by the script's mtime)."""
    cfg = OUT / "source_cams.json"
    stamp = OUT / "src_full.png"
    script = ROOT / "tools/blender/render_source_cam.py"
    if stamp.exists() and stamp.stat().st_mtime > script.stat().st_mtime:
        return
    env = ENVS["neutral"]
    cfg.write_text(json.dumps({"source": str(ROOT / "source/wow/creature/dragonhawk2voidmount"), "scale": SCALE,
                               "light_dir": env["LightDir"], "background": env["Background"], "size": SIZE,
                               "cams": {v: CAMS[v] for v in VIEWS}}))
    r = subprocess.run([str(BLENDER), "-b", "--factory-startup", "-P", str(script), "--", str(cfg), str(OUT / "src")],
                       capture_output=True, text=True)
    if "RENDER DONE" not in r.stdout:
        raise RuntimeError(r.stdout[-2000:] + r.stderr[-2000:])


def main():
    tag = sys.argv[1]
    swaps = [a for i, a in enumerate(sys.argv) if i and sys.argv[i - 1] == "--swap"]
    if "--local" in sys.argv:
        swaps += local_swaps()
    env = sys.argv[sys.argv.index("--env") + 1] if "--env" in sys.argv else "neutral"
    OUT.mkdir(parents=True, exist_ok=True)
    source()
    w, h = SIZE
    sheet = Image.new("RGB", (2 * w, len(VIEWS) * h), (20, 20, 24))
    d = ImageDraw.Draw(sheet)
    for i, v in enumerate(VIEWS):
        gs = OUT / f"gs_{tag}_{v}.png"
        render(gs, v, "final", env, swaps, f"{w}x{h}")
        sheet.paste(Image.open(OUT / f"src_{v}.png").convert("RGB"), (0, i * h))
        sheet.paste(Image.open(gs).convert("RGB"), (w, i * h))
        d.text((8, i * h + 6), f"WoW original ({v})", fill=(255, 255, 0))
        d.text((w + 8, i * h + 6), f"GS {tag} ({v})", fill=(255, 255, 0))
    path = OUT / f"compare_{tag}.png"
    sheet.save(path)
    print(path)


if __name__ == "__main__":
    main()
