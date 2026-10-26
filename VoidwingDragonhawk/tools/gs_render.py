"""Render the built pack's dragonhawk body with the PMP Viewer's game-shader renderer (apps/xivrender) from the
command line: every file the pack redirects, bind pose, one camera, the viewer's neutral (or day) light.

python -P tools/gs_render.py <out.png> [--cam full|tail|head|wing|top] [--output final|gbuffer0..4|lightdiffuse|hdr]
                             [--env neutral|day|dark] [--swap <game path>=<local file> ...] [--size 1000x700]
--swap replaces one file without repacking (fast A/B for textures and materials).
"""
import json
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).parent))
from package import PMP  # noqa: E402

XIVRENDER = ROOT.parent / "PmpViewer/apps/xivrender/xivrender.exe"
UNPACK = ROOT / "work/gs/pack"
MDL = "chara/demihuman/d0001/obj/equipment/e0001/model/d0001e0001_dwn.mdl"
MATS = [f"chara/demihuman/d0001/obj/equipment/e0001/material/v0001/mt_d0001e0001_dwn_{m}.mtrl" for m in "abcd"]
# bind pose in FFXIV space: body ~1.2 m up, faces +Z, tail to -Z, wings +-3.9 m in X (left = +X)
CAMS = {"full": dict(Eye=[-6.5, 5.5, 5.5], Target=[0, 1.0, -1.2], FovY=40),
        "tail": dict(Eye=[-2.5, 3.0, -1.0], Target=[0, 0.9, -3.4], FovY=40),
        "head": dict(Eye=[-1.4, 2.2, 2.6], Target=[0, 1.3, 0.6], FovY=35),
        "wing": dict(Eye=[2.0, 4.5, 1.5], Target=[2.2, 1.2, -0.6], FovY=45),
        "top": dict(Eye=[0.01, 11.0, -1.2], Target=[0, 1.0, -1.2], FovY=45)}
ENVS = {"neutral": dict(LightDir=[0.3578, 0.7193, 0.5954], LightDiffuse=[0.573] * 3, LightSpecular=[0.573] * 3,
                        AmbientSh=[[0, 0.1903, 0, 0.2235]] * 3, Reflection=[0.3] * 3,
                        Background=[0.1047, 0.1139, 0.1328]),
        # the viewer's Day preset (xr block in viewer/app.js), fitted to in-game 7.4 daylight footage; sun at -50 / 49
        "day": dict(LightDir=[-0.5025, 0.7547, 0.4217], LightDiffuse=[1.342, 1.248, 1.101], LightSpecular=[1.342, 1.248, 1.101],
                    AmbientSh=[[0, 0.1354, 0, 0.7586], [0, 0.1973, 0, 0.7692], [0, 0.3295, 0, 0.8061]],
                    Reflection=[0.193, 0.209, 0.245], ReflectionGround=[0.162, 0.149, 0.124],
                    CameraLightColor=[0.0611] * 3, CameraLight=[0.3041, 0.0422, 0, 0], Background=[0.1016, 0.1084, 0.1265]),
        "dark": dict(LightDiffuse=[0, 0, 0], LightSpecular=[0, 0, 0], AmbientSh=[[0, 0, 0, 0]] * 3,
                     Reflection=[0, 0, 0], Shadows=False)}


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def unpack():
    stamp = UNPACK / ".stamp"
    if not stamp.exists() or stamp.stat().st_mtime < PMP.stat().st_mtime:
        zipfile.ZipFile(PMP).extractall(UNPACK)
        stamp.write_text("")
    files = json.loads((UNPACK / "default_mod.json").read_text(encoding="utf-8"))["Files"]
    return {g: str(UNPACK.joinpath(*inner.split("\\"))) for g, inner in files.items()}


def local_swaps():
    """Every material and texture as just built in work/mod (A/B without repacking)."""
    mod = ROOT / "work/mod"
    out = []
    for f in list((mod / "chara/demihuman/d0001/obj/equipment/e0001/material/v0001").glob("*.mtrl")) + \
            list((mod / "chara/demihuman/d0001/obj/equipment/e0001/texture").glob("*.tex")):
        out.append(f"{f.relative_to(mod).as_posix()}={f}")
    return out


def render(out, cam="full", output="final", env="neutral", swaps=(), size="1000x700"):
    redirects = unpack()
    for s in swaps:
        g, local = s.split("=", 1)
        redirects[g] = str(Path(local).resolve())
    w, h = map(int, size.split("x"))
    scene = dict(Width=w, Height=h, Camera=CAMS[cam], Env=dict(Ao=False, **ENVS[env]), Redirects=redirects,
                 Models=[dict(Id="dwn", Mdl=MDL, Materials=MATS)], Output=output, OutFile=str(Path(out).resolve()))
    sp = ROOT / "work/gs/scene.json"
    sp.write_text(json.dumps(scene, indent=1))
    game = json.loads((Path.home() / "AppData/Roaming/XIVLauncher/launcherConfigV3.json").read_text())["GamePath"]
    r = subprocess.run([str(XIVRENDER), str(Path(game) / "game/sqpack"), "--scene", str(sp)], capture_output=True, text=True)
    return (r.stdout + r.stderr).strip()


def main():
    swaps = [a for i, a in enumerate(sys.argv) if i and sys.argv[i - 1] == "--swap"]
    print(render(sys.argv[1], arg("--cam", "full"), arg("--output", "final"), arg("--env", "neutral"), swaps,
                 arg("--size", "1000x700"))[-2500:])


if __name__ == "__main__":
    main()
