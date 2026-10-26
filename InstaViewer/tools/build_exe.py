"""Build "Insta Viewer.exe": one file holding Python, the server and the page.

    python -P -E tools/build_exe.py

Output: InstaViewer/Insta Viewer.exe. Intermediate files go to build/ (safe to delete).
"""
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")


def make_icon():
    """web/icon.svg drawn with Pillow: violet-to-coral rounded square, viewfinder corners, play triangle."""
    s = 1024
    grad = Image.new("RGBA", (s, s))
    a, b = (139, 123, 255), (255, 138, 107)
    px = grad.load()
    for y in range(s):
        for x in range(s):
            t = (x + y) / (2 * (s - 1))
            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
    mask = Image.new("L", (s, s), 0)
    k = s / 64
    ImageDraw.Draw(mask).rounded_rectangle((2 * k, 2 * k, 62 * k, 62 * k), radius=16 * k, fill=255)
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    w = round(4.5 * k)
    white = (255, 255, 255, 255)
    for (x0, y0, dx, dy) in ((15, 15, 1, 1), (49, 15, -1, 1), (49, 49, -1, -1), (15, 49, 1, -1)):
        x0, y0 = x0 * k, y0 * k
        d.line([(x0, y0 + dy * 9 * k), (x0, y0)], fill=white, width=w)
        d.line([(x0, y0), (x0 + dx * 9 * k, y0)], fill=white, width=w)
        for (cx, cy) in ((x0, y0 + dy * 9 * k), (x0 + dx * 9 * k, y0), (x0, y0)):
            d.ellipse((cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2), fill=white)
    d.polygon([(27 * k, 24.5 * k), (27 * k, 39.5 * k), (39.5 * k, 32 * k)], fill=white)
    p = os.path.join(BUILD, "instaviewer.ico")
    img.resize((256, 256), Image.LANCZOS).save(p, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    return p


def main():
    os.makedirs(BUILD, exist_ok=True)
    icon = make_icon()
    server = os.path.join(ROOT, "server")
    cmd = [sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile", "--windowed",
           "--name", "Insta Viewer", "--icon", icon, "--paths", server,
           "--add-data", f"{os.path.join(ROOT, 'web')}{os.pathsep}web",
           "--hidden-import", "app", "--hidden-import", "ig", "--hidden-import", "embeds",
           "--distpath", os.path.join(BUILD, "dist"), "--workpath", os.path.join(BUILD, "pyinstaller"), "--specpath", BUILD]
    for x in ("numpy", "PIL", "matplotlib", "scipy", "pandas", "IPython", "pytest", "tkinter.test"):
        cmd += ["--exclude-module", x]
    subprocess.run(cmd + [os.path.join(server, "launcher.py")], check=True)
    exe = os.path.join(ROOT, "Insta Viewer.exe")
    old = os.path.join(ROOT, "Insta Viewer.old.exe")
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
            print("the old exe is still running; it was renamed to Insta Viewer.old.exe")
    shutil.move(os.path.join(BUILD, "dist", "Insta Viewer.exe"), exe)
    print(f"built {exe} ({os.path.getsize(exe) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
