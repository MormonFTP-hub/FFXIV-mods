"""Build "PMP Viewer.exe": one file holding Python, numpy, Pillow, the viewer page, a trimmed xivserve and xivrender
(the game-shader renderer).

    python -P -E tools/build_exe.py

Compiles tools/xivserve and tools/xivrender into build/ (so a viewer running from source keeps its apps/ copies), then packs.
Output: PmpViewer/PMP Viewer.exe. Intermediate files go to build/ (safe to delete).
"""
import os
import shutil
import subprocess
import sys
import zipfile

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
HELPER = os.path.join(BUILD, "xivserve-bin")
RENDERER = os.path.join(BUILD, "xivrender-bin")
# Dalamud / Penumbra libraries xivserve never loads (in-game UI, hooking, databases): left out of the exe.
DROP = ("FFXIVClientStructs", "TerraFX.", "Iced", "Dalamud.Bindings.", "InteropGenerator.", "HexaGen.", "Reloaded.",
        "goatcorp.", "PeNet", "Mono.Cecil", "EmbedIO", "Swan.Lite", "LiteDB", "SQLite", "Penumbra.CrashHandler",
        "System.Reactive")


def stage_helper(src=HELPER, name="xivserve", drop=DROP):
    """Copy a helper without debug symbols, XML docs, its deps manifest (the host then loads whatever DLLs sit
    next to it) and the libraries in drop; zip it for the exe."""
    dst = os.path.join(BUILD, name)
    shutil.rmtree(dst, ignore_errors=True)
    os.makedirs(dst)
    for n in os.listdir(src):
        p = os.path.join(src, n)
        if os.path.isdir(p) or n.endswith((".pdb", ".xml")) or n.endswith(".deps.json") or n.startswith(drop):
            continue
        shutil.copy2(p, dst)
    z = os.path.join(BUILD, name + ".zip")
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as f:
        for n in sorted(os.listdir(dst)):
            f.write(os.path.join(dst, n), n)
    size = sum(os.path.getsize(os.path.join(dst, n)) for n in os.listdir(dst))
    print(f"{name}: {len(os.listdir(dst))} files, {size / 1e6:.1f} MB ({os.path.getsize(z) / 1e6:.1f} MB zipped)")
    return dst, z


def make_icon():
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((8, 8, s - 8, s - 8), radius=52, fill=(29, 32, 39, 255), outline=(106, 168, 255, 255), width=10)
    # a little cube: the model the viewer shows
    c, r = (s // 2, s // 2 - 18), 62
    top = [(c[0], c[1] - r), (c[0] + r, c[1] - r // 2), (c[0], c[1]), (c[0] - r, c[1] - r // 2)]
    left = [(c[0] - r, c[1] - r // 2), (c[0], c[1]), (c[0], c[1] + r), (c[0] - r, c[1] + r // 2)]
    right = [(c[0] + r, c[1] - r // 2), (c[0], c[1]), (c[0], c[1] + r), (c[0] + r, c[1] + r // 2)]
    d.polygon(top, fill=(140, 192, 255, 255))
    d.polygon(left, fill=(76, 195, 138, 255))
    d.polygon(right, fill=(58, 140, 230, 255))
    try:
        font = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 46)
    except OSError:
        font = ImageFont.load_default()
    d.text((s // 2, s - 46), "PMP", fill=(228, 230, 235, 255), font=font, anchor="mm")
    p = os.path.join(BUILD, "pmpviewer.ico")
    img.save(p, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    return p


def main():
    os.makedirs(BUILD, exist_ok=True)
    subprocess.run(["dotnet", "build", "-c", "Release", "-o", HELPER, "-v", "q", "-nologo"],
                   cwd=os.path.join(ROOT, "tools", "xivserve"), check=True)
    _, helper_zip = stage_helper()
    # the renderer draws with D3D11 through TerraFX, so that one stays
    subprocess.run(["dotnet", "build", "-c", "Release", "-o", RENDERER, "-v", "q", "-nologo"],
                   cwd=os.path.join(ROOT, "tools", "xivrender"), check=True)
    _, render_zip = stage_helper(RENDERER, "xivrender", tuple(d for d in DROP if d != "TerraFX."))
    icon = make_icon()
    server = os.path.join(ROOT, "server")
    hidden = ["app", "game", "meta", "pmp", "resolve", "shade", "skeleton", "targets", "visibility",
              "havok_tagfile", "xiv_skeleton"]
    cmd = [sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile", "--windowed",
           "--name", "PMP Viewer", "--icon", icon, "--paths", server,
           "--add-data", f"{os.path.join(ROOT, 'viewer')}{os.pathsep}viewer",
           "--add-data", f"{helper_zip}{os.pathsep}.",
           "--add-data", f"{render_zip}{os.pathsep}.",
           "--distpath", os.path.join(BUILD, "dist"), "--workpath", os.path.join(BUILD, "pyinstaller"), "--specpath", BUILD]
    for h in hidden:
        cmd += ["--hidden-import", h]
    for x in ("matplotlib", "scipy", "pandas", "IPython", "pytest"):
        cmd += ["--exclude-module", x]
    subprocess.run(cmd + [os.path.join(server, "launcher.py")], check=True)
    exe = os.path.join(ROOT, "PMP Viewer.exe")
    old = os.path.join(ROOT, "PMP Viewer.old.exe")
    if os.path.exists(old):
        try:
            os.remove(old)
        except OSError:
            pass
    if os.path.exists(exe):
        try:
            os.remove(exe)
        except OSError:       # still running: Windows allows renaming a running exe, not replacing it
            os.replace(exe, old)
            print("the old exe is still running; it was renamed to PMP Viewer.old.exe")
    shutil.move(os.path.join(BUILD, "dist", "PMP Viewer.exe"), exe)
    print(f"built {exe} ({os.path.getsize(exe) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
