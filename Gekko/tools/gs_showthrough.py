"""How much of the wearer's own face shows past Gekko's head and neck in the game's shaders (GS), per race.

For each race, PmpViewer/tools/gs_render.py draws the built pack's head close-up from several angles, and its albedo
G-buffer once as packed and once with the pack's "Hide your own face" option on (every player face model blanked).
Albedo pixels that differ are the wearer's face showing through (a final-image diff also counts the hidden face's own
shadow, which Gekko's shadowless head no longer covers). poke.py's rays from the head centre missed the nape.

python -P -E tools/gs_showthrough.py [race ...]     (default: one race per fit and deformer family)
  -> per race and view: differing pixels; work/gs/show_<race>.png marks them in magenta
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GS = os.path.join(os.path.dirname(ROOT), "PmpViewer", "tools", "gs_render.py")
PMP = os.path.join(ROOT, "out", "Gekko (Valorant).pmp")
OUT = os.path.join(ROOT, "work", "gs", "show")
VIEWS = {"side_l": 90, "back34_l": 140, "back": 180, "back34_r": -140, "side_r": -90}
RACES = ("c0101", "c0301", "c0501", "c0701", "c1701", "c0901", "c1501", "c0201", "c0401", "c0601", "c0801", "c1001",
         "c1801", "c1101")
SIZE = 500


def render(race, yaw, path, hide, output="final"):
    args = [sys.executable, "-P", "-E", GS, PMP, path, "--race", race, "--pose", "idle", "--env", "day", "--cam", "head",
            "--yaw", str(yaw), "--size", f"{SIZE}x{SIZE}", "--output", output]
    if hide:
        args += ["--set", "Hide your own face=Hide every player face"]
    r = subprocess.run(args, capture_output=True, text=True)
    if not os.path.exists(path):
        raise RuntimeError(r.stdout[-2000:] + r.stderr[-2000:])


def main(races):
    os.makedirs(OUT, exist_ok=True)
    for race in races:
        tiles, counts = [], {}
        for view, yaw in VIEWS.items():
            f, a, b = (os.path.join(OUT, f"{race}_{view}{s}.png") for s in ("", "_albedo", "_albedo_hidden"))
            render(race, yaw, f, False)
            render(race, yaw, a, False, "gbuffer2")
            render(race, yaw, b, True, "gbuffer2")
            x = np.asarray(Image.open(a).convert("RGB")).astype(int)
            y = np.asarray(Image.open(b).convert("RGB")).astype(int)
            d = np.abs(x - y).sum(2) > 30
            counts[view] = int(d.sum())
            t = np.asarray(Image.open(f).convert("RGB")).copy()
            t[d] = [255, 0, 255]
            tiles.append(Image.fromarray(t))
        sheet = Image.new("RGB", (SIZE * len(tiles), SIZE))
        for i, t in enumerate(tiles):
            sheet.paste(t, (i * SIZE, 0))
        sheet.save(os.path.join(ROOT, "work", "gs", f"show_{race}.png"))
        print(f"{race}: " + ", ".join(f"{v} {c}" for v, c in counts.items()) + f"  (of {SIZE}x{SIZE})", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:] or RACES)
