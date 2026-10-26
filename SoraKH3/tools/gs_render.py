"""Render the built pack with the PMP Viewer's game-shader renderer (PmpViewer/apps/xivrender) from the command
line: Sora's six models at bind pose (the FFXIV A-pose, no skinning), one camera, one light preset.

python -P -E tools/gs_render.py <out.png> [--cam full|back|head|hand] [--env neutral|day] [--pose idle|pose1..4]
                                 [--frame N] [--output final|gbuffer0..4|lightdiffuse] [--swap <game path>=<local file> ...]
--swap replaces one file without repacking (fast A/B for materials and textures).
--pose skins the models with the game's own Midlander male animation (decoded by the PMP Viewer's anim.py).
Character state the game adds on top of the mod (e.g. from the user's Glamourer design):
  --skin/--hair/--eye/--lip r,g,b[,a]   customize colours (0..1, as Glamourer's advanced parameters show them)
  --decal <game path> --decal-color r,g,b,a   face paint on the face model (chara/common/texture/decal_face/_decal_N.tex)
"""
import json
import os
import re
import subprocess
import sys
import zipfile

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from havok_tagfile import read_sklb_skeleton  # noqa: E402
from sqpack import Repo  # noqa: E402
PMP = os.path.join(ROOT, "out", "Sora_KH3.pmp")
XIVTOOL = os.path.join(ROOT, "apps", "xivtool", "xivtool.exe")
XIVRENDER = os.path.join(os.path.dirname(ROOT), "PmpViewer", "apps", "xivrender", "xivrender.exe")
UNPACK = os.path.join(ROOT, "work", "gs", "pack")
SET, RACE, FACE, HAIR, MAT_SET = "e0084", "c0101", "f0001", "h0001", "v0002"
MODELS = {s: (f"chara/equipment/{SET}/model/{RACE}{SET}_{s}.mdl", f"chara/equipment/{SET}/material/{MAT_SET}")
          for s in ("top", "glv", "dwn", "sho")}
MODELS["fac"] = (f"chara/human/{RACE}/obj/face/{FACE}/model/{RACE}{FACE}_fac.mdl",
                 f"chara/human/{RACE}/obj/face/{FACE}/material")
MODELS["hir"] = (f"chara/human/{RACE}/obj/hair/{HAIR}/model/{RACE}{HAIR}_hir.mdl",
                 f"chara/human/{RACE}/obj/hair/{HAIR}/material/v0001")
CAMS = {"full": dict(Eye=[0, 0.97, 4.8], Target=[0, 0.97, 0], FovY=30),
        "back": dict(Eye=[0, 0.97, -4.8], Target=[0, 0.97, 0], FovY=30),
        "head": dict(Eye=[0, 1.66, 1.1], Target=[0, 1.66, 0], FovY=30),
        "chest": dict(Eye=[0, 1.3, 1.0], Target=[0, 1.3, 0], FovY=30),
        "hand": dict(Eye=[0.75, 1.0, 0.9], Target=[0.6, 0.98, 0], FovY=22)}
ENVS = {
    # the PMP Viewer's "Neutral studio" preset, as its page sends it to the renderer
    "neutral": dict(LightDir=[0.3578, 0.7193, 0.5954], LightDiffuse=[0.573] * 3, LightSpecular=[0.573] * 3,
                    AmbientSh=[[0, 0.1903, 0, 0.2235]] * 3, Reflection=[0.3] * 3, Background=[0.1047, 0.1139, 0.1328]),
    # the viewer's "Day" preset: renderer values fitted to 7.4 sunlight footage (PmpViewer viewer/app.js LIGHTS.day.xr)
    "day": dict(LightDir=[0.3578, 0.7193, 0.5954], LightDiffuse=[1.342, 1.248, 1.101], LightSpecular=[1.342, 1.248, 1.101],
                AmbientSh=[[0, 0.1354, 0, 0.7586], [0, 0.1973, 0, 0.7692], [0, 0.3295, 0, 0.8061]],
                Reflection=[0.193, 0.209, 0.245], ReflectionGround=[0.162, 0.149, 0.124],
                CameraLightColor=[0.0611] * 3, CameraLight=[0.3041, 0.0422, 0, 0], Background=[0.1047, 0.1139, 0.1328]),
}


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def redirects():
    if not os.path.exists(UNPACK) or os.path.getmtime(UNPACK) < os.path.getmtime(PMP):
        zipfile.ZipFile(PMP).extractall(UNPACK)
        os.utime(UNPACK)
    files = {}
    for name in os.listdir(UNPACK):
        if name == "default_mod.json":
            files.update(json.load(open(os.path.join(UNPACK, name), encoding="utf-8"))["Files"])
        elif name.startswith("group_"):
            for opt in json.load(open(os.path.join(UNPACK, name), encoding="utf-8"))["Options"]:
                files.update(opt["Files"])
    return {g: os.path.join(UNPACK, *inner.split("\\")) for g, inner in files.items()}


def _trs(t, q, s):
    x, y, z, w = q
    m = np.eye(4)
    m[:3, :3] = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                          [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                          [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]) * np.asarray(s)[None, :]
    m[:3, 3] = t
    return m


def pose_skinning(kind, frame):
    """bone name -> world-space skinning matrix (posed world x inverse rest world) for one frame of the game's
    Midlander male animation `kind` (PmpViewer/server/anim.py FILES)."""
    # the viewer's .pap decoder; it needs the viewer's own havok_tagfile, not ours (same module name)
    ours = sys.modules.pop("havok_tagfile")
    sys.path.insert(0, os.path.join(os.path.dirname(ROOT), "PmpViewer", "server"))
    import anim  # noqa: E402
    sys.path.pop(0)
    sys.modules["havok_tagfile"] = ours
    game = json.load(open(os.path.join(os.environ["APPDATA"], "XIVLauncher", "launcherConfigV3.json")))["GamePath"]
    repo = Repo(os.path.join(game, "game"))
    rel, want = anim.FILES[kind]
    pap = os.path.join(ROOT, "work", "game", "anim", os.path.basename(rel))
    os.makedirs(os.path.dirname(pap), exist_ok=True)
    with open(pap, "wb") as f:
        f.write(repo.read(f"chara/human/{RACE}/animation/a0001/{rel}"))
    names, hav, cont = anim._pap(pap)
    pick = next((i for i, nm in enumerate(names) if want in nm and "_add_" not in nm), 0)
    binding = cont["bindings"][hav[pick]]
    frames = anim._decode(binding["animation"])
    frame = min(frame, len(frames) - 1)
    bnames, parents, ref = read_sklb_skeleton(repo.read(f"chara/human/{RACE}/skeleton/base/b0001/skl_{RACE}b0001.sklb"))
    local_rest = [_trs(*p) for p in ref]
    local_pose = list(local_rest)
    for track, bone in enumerate(binding["transformTrackToBoneIndices"]):
        v = frames[frame, track]
        local_pose[bone] = _trs(v[0:3], v[3:7], v[7:10])
    rest, posed = [], []
    for i in range(len(bnames)):
        p = parents[i]
        rest.append(local_rest[i] if p < 0 else rest[p] @ local_rest[i])
        posed.append(local_pose[i] if p < 0 else posed[p] @ local_pose[i])
    # keep the figure where the bind pose stands (the animation's root carries no offset we need)
    root_fix = np.eye(4)
    root_fix[:3, 3] = rest[bnames.index("j_kosi")][:3, 3] - posed[bnames.index("j_kosi")][:3, 3]
    root_fix[1, 3] = 0
    print(f"pose {names[pick]} frame {frame}/{len(frames)}")
    return {n: root_fix @ posed[i] @ np.linalg.inv(rest[i]) for i, n in enumerate(bnames)}


def main():
    out = os.path.abspath(sys.argv[1])
    red = redirects()
    for s in [a for i, a in enumerate(sys.argv) if i and sys.argv[i - 1] == "--swap"]:
        g, local = s.split("=", 1)
        red[g] = os.path.abspath(local)
    skin = pose_skinning(arg("--pose"), int(arg("--frame", "0"))) if arg("--pose") else None
    models = []
    for slot, (mdl, mat_dir) in MODELS.items():
        info = subprocess.run([XIVTOOL, "mdlinfo", red[mdl]], capture_output=True, text=True).stdout
        names = re.search(r"^materials: (.*)$", info, re.M).group(1).split(", ")
        desc = dict(Id=slot, Mdl=mdl, Materials=[f"{mat_dir}/{n.lstrip('/')}" for n in names])
        if skin:
            bones = re.search(r"^bones: (.*)$", info, re.M).group(1).split(", ")
            desc["Bones"] = [skin[b].T.ravel().tolist() if b in skin else None for b in bones]  # column-major
        if slot == "fac" and arg("--decal"):
            desc["Decal"] = arg("--decal")
            desc["DecalColor"] = [float(v) for v in arg("--decal-color", "1,1,1,1").split(",")]
        models.append(desc)
    customize = {k: [float(v) for v in arg(f"--{k}").split(",")] for k in ("skin", "hair", "eye", "lip") if arg(f"--{k}")}
    if "hair" in customize:
        customize["highlight"] = customize["hair"]
    cam = arg("--cam", "full")
    w, h = (1024, 1536) if cam in ("full", "back") else (1024, 1024)
    scene = dict(Width=w, Height=h, Camera=CAMS[cam], Env=dict(Ao=True, **ENVS[arg("--env", "day")]),
                 Redirects=red, Models=models, Output=arg("--output", "final"), OutFile=out)
    if customize:
        scene["Customize"] = customize
    sp = os.path.join(ROOT, "work", "gs", "scene.json")
    json.dump(scene, open(sp, "w"), indent=1)
    game = json.load(open(os.path.join(os.environ["APPDATA"], "XIVLauncher", "launcherConfigV3.json")))["GamePath"]
    r = subprocess.run([XIVRENDER, os.path.join(game, "game", "sqpack"), "--scene", sp], capture_output=True, text=True)
    print((r.stdout + r.stderr).strip()[-2000:])
    print("wrote", out if os.path.exists(out) else "NOTHING")


if __name__ == "__main__":
    main()
