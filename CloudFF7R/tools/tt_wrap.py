"""Thin wrapper around the project-local TexTools ConsoleTools."""
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
TT = os.path.join(HERE, "tt", "ConsoleTools.exe")
MODEL_FLAGS = ["/mats", "/attributes", "/autoscale", "/heels"]


def run(*args):
    res = subprocess.run([TT, *args], cwd=os.path.dirname(TT), capture_output=True, text=True)
    out = (res.stdout or "") + (res.stderr or "")
    if res.returncode != 0 or "Exception" in out:
        raise RuntimeError(f"ConsoleTools {' '.join(args)} failed:\n{out[-3000:]}")
    return out


def wrap_model(db_path, mdl_path, game_path):
    return run("/wrap", db_path, mdl_path, game_path, *MODEL_FLAGS)


def wrap_texture(png_path, tex_path):
    return run("/wrap", png_path, tex_path)


def unwrap(src, dst, game_path=None):
    return run("/unwrap", src, dst, *([game_path] if game_path else []))
