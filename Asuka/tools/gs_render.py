"""Render the built pack's Midlander woman with the PMP Viewer's game-shader renderer (apps/xivrender), from the
command line: every file the pack redirects, at bind pose (no skinning), one camera, the viewer's neutral light.

python -P -E tools/gs_render.py <out.png> [--slots met,top] [--output final|gbuffer0..4|lightdiffuse|hdr]
                                 [--cam head|full] [--swap <game path>=<local file> ...] [--env night]
Fast A/B loop for materials and textures: --swap replaces one file without repacking.
"""
import json
import os
import subprocess
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from build import SET, SLOTS  # noqa: E402
from pack import PMP  # noqa: E402

ROOT = xd.ROOT
XIVRENDER = os.path.join(os.path.dirname(ROOT), "PmpViewer", "apps", "xivrender", "xivrender.exe")
UNPACK = os.path.join(ROOT, "work", "gs", "pack")
CAMS = {"head": dict(Eye=[0, 1.5, 0.9], Target=[0, 1.5, 0], FovY=30),
        "full": dict(Eye=[0, 0.95, 3.6], Target=[0, 0.9, 0], FovY=30)}
ENVS = {"default": {},
        # the PMP Viewer's "Neutral studio" preset, as its page sends it to the renderer
        "neutral": dict(LightDir=[0.3578, 0.7193, 0.5954], LightDiffuse=[0.573] * 3, LightSpecular=[0.573] * 3,
                        AmbientSh=[[0, 0.1903, 0, 0.2235]] * 3, Reflection=[0.3] * 3,
                        Background=[0.1047, 0.1139, 0.1328]),
        "dark": dict(LightDiffuse=[0, 0, 0], LightSpecular=[0, 0, 0], AmbientSh=[[0, 0, 0, 0]] * 3,
                                    Reflection=[0, 0, 0], Shadows=False),
        "night": dict(LightDiffuse=[0.15, 0.15, 0.18], LightSpecular=[0.15, 0.15, 0.18],
                                      AmbientSh=[[0, 0.02, 0, 0.06], [0, 0.02, 0, 0.06], [0, 0.03, 0, 0.08]],
                                      Reflection=[0.05, 0.05, 0.06]),
        # the viewer's "Day (outdoors)" preset: its game-renderer values, fitted to 7.4 daylight footage
        "day": dict(LightDir=[0.3578, 0.7193, 0.5954], LightDiffuse=[1.342, 1.248, 1.101],
                    LightSpecular=[1.342, 1.248, 1.101],
                    AmbientSh=[[0, 0.1354, 0, 0.7586], [0, 0.1973, 0, 0.7692], [0, 0.3295, 0, 0.8061]],
                    Reflection=[0.193, 0.209, 0.245], ReflectionGround=[0.162, 0.149, 0.124],
                    CameraLightColor=[0.0611] * 3, CameraLight=[0.3041, 0.0422, 0, 0],
                    Background=[0.1047, 0.1139, 0.1328])}


_extra = os.path.join(ROOT, "work", "gs", "refl_envs.json")      # extra test envs (face reflection A/B)
if os.path.exists(_extra):
    ENVS.update(json.load(open(_extra)))


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def unpack():
    if not os.path.exists(UNPACK) or os.path.getmtime(UNPACK) < os.path.getmtime(PMP):
        zipfile.ZipFile(PMP).extractall(UNPACK)
        os.utime(UNPACK)
    files = json.load(open(os.path.join(UNPACK, "default_mod.json"), encoding="utf-8"))["Files"]
    return {g: os.path.join(UNPACK, *inner.split("\\")) for g, inner in files.items()}


def main():
    out = sys.argv[1]
    redirects = unpack()
    for s in [a for i, a in enumerate(sys.argv) if i and sys.argv[i - 1] == "--swap"]:
        g, local = s.split("=", 1)
        redirects[g] = os.path.abspath(local)
    models = []
    for slot in arg("--slots", ",".join(SLOTS)).split(","):
        mdl = xd.gear_model_path(SET, slot, "c0201")
        names = xd.model(redirects[mdl])["materials"]
        mats = [f"chara/equipment/e{SET:04d}/material/v0001{n}" for n in names]
        models.append(dict(Id=slot, Mdl=mdl, Materials=mats))
    scene = dict(Width=800, Height=800 if arg("--cam", "head") == "head" else 1000, Camera=CAMS[arg("--cam", "head")],
                 Env=dict(Ao=False, **ENVS[arg("--env", "neutral")]), Redirects=redirects, Models=models,
                 Output=arg("--output", "final"), OutFile=os.path.abspath(out))
    sp = os.path.join(ROOT, "work", "gs", "scene.json")
    json.dump(scene, open(sp, "w"), indent=1)
    sq = xd.xivtool and json.load(open(os.path.join(os.environ["APPDATA"], "XIVLauncher", "launcherConfigV3.json")))["GamePath"]
    r = subprocess.run([XIVRENDER, os.path.join(sq, "game", "sqpack"), "--scene", sp], capture_output=True, text=True)
    print((r.stdout + r.stderr).strip()[-2500:])


if __name__ == "__main__":
    main()
