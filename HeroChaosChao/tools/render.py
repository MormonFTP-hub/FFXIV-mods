"""Render a glTF with the portable Blender (tools/blender/render_views.py)."""
import subprocess
from pathlib import Path

import xivdata as xd

BLENDER = r"E:\FFXIV-mods\Aerith\apps\blender-4.5.14-windows-x64\blender.exe"
OUT = Path(xd.ROOT) / "work/preview"


def render(src, prefix, views):
    subprocess.run([BLENDER, "-b", "-P", str(Path(__file__).parent / "blender/render_views.py"), "--",
                    str(src), str(prefix), views], check=True, capture_output=True)
