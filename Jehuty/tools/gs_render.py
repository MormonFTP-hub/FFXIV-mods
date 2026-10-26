"""Render the built pack's Midlander woman with the PMP Viewer's game-shader renderer (apps/xivrender), from the
command line: every file the pack redirects, one camera, the viewer's neutral light. After the InvisibleWoman port's
tool; --pose is new here.

python -P -E tools/gs_render.py <out.png> [--slots met,top] [--output final|gbuffer0..4|lightdiffuse|hdr]
                                 [--cam head|full|hands|back] [--swap <game path>=<local file> ...] [--env night]
                                 [--pose idle|pose1..4|walk|run [--frame N]] [--race c0201]
                                 [--look <bone>[,dx,dy,dz[,dist]]]   (camera on a posed bone, from +Z by default)
                                 [--parts <headpiece letter>,<jewellery letter>]   (default a,a; "-" = none: the
                                 other variants' atr_<m|t|g|d|s>v_* submeshes are hidden, as the IMC mask does)
                                 [--env day [--sun <az>,<el>]] [--ao] [--noshadow]
--env day is the PMP Viewer's Day preset with the game renderer values fitted to in-game footage (app.js LIGHTS.day.xr);
--sun places the sun as the viewer's sliders do (0 = from the camera's side, 90 = the figure's left; height in deg).
Fast A/B loop for materials and textures: --swap replaces one file without repacking. --pose skins the models with
the game's own animation (decoded by the PMP Viewer's server/anim.py), otherwise they stay in the bind pose.
"""
import importlib.util
import json
import os
import subprocess
import sys
import types
import zipfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig  # noqa: E402
import xivdata as xd  # noqa: E402
from build import SET, SLOTS  # noqa: E402
from pack import PMP  # noqa: E402

ROOT = xd.ROOT
XIVRENDER = os.path.join(os.path.dirname(ROOT), "PmpViewer", "apps", "xivrender", "xivrender.exe")
UNPACK = os.path.join(ROOT, "work", "gs", "pack")
CAMS = {"head": dict(Eye=[0, 1.5, 0.9], Target=[0, 1.5, 0], FovY=30),
        "full": dict(Eye=[0, 0.95, 3.6], Target=[0, 0.9, 0], FovY=30),
        "back": dict(Eye=[0, 0.95, -3.6], Target=[0, 0.9, 0], FovY=30),
        "hands": dict(Eye=[0.9, 0.95, 1.3], Target=[0.25, 0.85, 0.05], FovY=30)}
ENVS = {"default": {},
        # the PMP Viewer's "Neutral studio" preset, as its page sends it to the renderer
        "neutral": dict(LightDir=[0.3578, 0.7193, 0.5954], LightDiffuse=[0.573] * 3, LightSpecular=[0.573] * 3,
                        AmbientSh=[[0, 0.1903, 0, 0.2235]] * 3, Reflection=[0.3] * 3,
                        Background=[0.1047, 0.1139, 0.1328]),
        "dark": dict(LightDiffuse=[0, 0, 0], LightSpecular=[0, 0, 0], AmbientSh=[[0, 0, 0, 0]] * 3,
                                    Reflection=[0, 0, 0], Shadows=False),
        # the viewer's Day preset (app.js LIGHTS.day.xr, fitted to in-game footage); LightDir from --sun
        "day": dict(LightDiffuse=[1.342, 1.248, 1.101], LightSpecular=[1.342, 1.248, 1.101],
                    AmbientSh=[[0, 0.1354, 0, 0.7586], [0, 0.1973, 0, 0.7692], [0, 0.3295, 0, 0.8061]],
                    Reflection=[0.193, 0.209, 0.245], ReflectionGround=[0.162, 0.149, 0.124],
                    CameraLightColor=[0.0611] * 3, CameraLight=[0.3041, 0.0422, 0, 0],
                    Background=[0.3243, 0.3367, 0.3606]),
        "night": dict(LightDiffuse=[0.15, 0.15, 0.18], LightSpecular=[0.15, 0.15, 0.18],
                                      AmbientSh=[[0, 0.02, 0, 0.06], [0, 0.02, 0, 0.06], [0, 0.03, 0, 0.08]],
                                      Reflection=[0.05, 0.05, 0.06])}


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def viewer_anim():
    """The PMP Viewer's server/anim.py, loaded by path with its own havok_tagfile (this folder has an older one of
    the same name) and stand-ins for the server modules it imports but the decoder doesn't use."""
    srv = os.path.join(os.path.dirname(ROOT), "PmpViewer", "server")

    def load(name, alias):
        spec = importlib.util.spec_from_file_location(alias, os.path.join(srv, name + ".py"))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    saved = {k: sys.modules.get(k) for k in ("game", "meta", "havok_tagfile")}
    sys.modules.update(game=types.ModuleType("game"), meta=types.SimpleNamespace(FALLBACK={}),
                       havok_tagfile=load("havok_tagfile", "pmpv_havok_tagfile"))
    try:
        return load("anim", "pmpv_anim")
    finally:
        for k, v in saved.items():
            if v is None:
                sys.modules.pop(k, None)
            else:
                sys.modules[k] = v


def trs(t, q, s):
    x, y, z, w = q
    r = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    m = np.eye(4)
    m[:3, :3] = r * np.asarray(s)
    m[:3, 3] = t
    return m


def pose_deltas(race, kind, frame=0):
    """{bone: world pose x inverse bind} for the race's base skeleton at one frame of a game animation."""
    an = viewer_anim()
    rel, want = an.FILES[kind]
    names_, hav, cont = an._pap(xd.extract(f"chara/human/{race}/animation/a0001/{rel}")[0])
    pick = next((i for i, n in enumerate(names_) if want in n and "_add_" not in n), 0)
    binding = cont["bindings"][hav[pick]]
    frames = an._decode(binding["animation"])
    f = frames[frame % len(frames)]
    track = {b: t for t, b in enumerate(binding["transformTrackToBoneIndices"])}
    names, parent, world = rig.load_skeleton(f"skeleton_{race}")
    posed, out = {}, {}
    for i, n in enumerate(names):
        p = parent[n]
        if i in track:
            local = trs(f[track[i], 0:3], f[track[i], 3:7], f[track[i], 7:10])
        else:
            local = (np.linalg.inv(world[p]) @ world[n]) if p else world[n]
        posed[n] = posed[p] @ local if p else local
        out[n] = posed[n] @ np.linalg.inv(world[n])
    return out


def model_bones(local_mdl):
    line = next(ln for ln in xd.xivtool("mdlinfo", local_mdl).splitlines() if ln.startswith("bones:"))
    return [b.strip() for b in line[6:].split(",") if b.strip()]


def env():
    e = dict(ENVS[arg("--env", "neutral")], Ao="--ao" in sys.argv)
    e.setdefault("Shadows", "--noshadow" not in sys.argv)
    if arg("--sun") or arg("--env") == "day":
        az, el = (np.radians(float(v)) for v in arg("--sun", "31,46").split(","))
        e["LightDir"] = [float(np.sin(az) * np.cos(el)), float(np.sin(el)), float(np.cos(az) * np.cos(el))]
    return e


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
    race = arg("--race", "c0201")
    deltas = pose_deltas(race, arg("--pose"), int(arg("--frame", 0))) if arg("--pose") else None
    models = []
    for slot in arg("--slots", ",".join(SLOTS)).split(","):
        mdl = xd.gear_model_path(SET, slot, race)
        names = xd.model(redirects[mdl])["materials"]
        mats = [f"chara/equipment/e{SET:04d}/material/v0001{n}" for n in names]
        head, jewel = arg("--parts", "a,a").split(",")
        keep = head if slot == "met" else jewel
        prefix = {"met": "atr_mv", "top": "atr_tv", "glv": "atr_gv", "dwn": "atr_dv", "sho": "atr_sv"}[slot]
        m = dict(Id=slot, Mdl=mdl, Materials=mats, HiddenAttributes=[f"{prefix}_{x}" for x in "abc" if x != keep])
        if deltas:
            m["Bones"] = [deltas.get(b, np.eye(4)).T.ravel().tolist() for b in model_bones(redirects[mdl])]
        models.append(m)
    cam = CAMS[arg("--cam", "head")]
    if arg("--look"):
        bone, *rest = arg("--look").split(",")
        d = [float(v) for v in rest] or [0, 0, 1]
        dist = d[3] if len(d) > 3 else 0.35
        _, _, world = rig.load_skeleton(f"skeleton_{race}")
        t = ((deltas or {}).get(bone, np.eye(4)) @ world[bone])[:3, 3]
        d = np.array(d[:3]) / np.linalg.norm(d[:3])
        cam = dict(Eye=(t + d * dist).tolist(), Target=t.tolist(), FovY=30)
    scene = dict(Width=800, Height=800 if arg("--cam", "head") == "head" else 1000, Camera=cam,
                 Env=env(), Redirects=redirects, Models=models,
                 Output=arg("--output", "final"), OutFile=os.path.abspath(out))
    sp = os.path.join(ROOT, "work", "gs", "scene.json")
    json.dump(scene, open(sp, "w"), indent=1)
    sq = xd.xivtool and json.load(open(os.path.join(os.environ["APPDATA"], "XIVLauncher", "launcherConfigV3.json")))["GamePath"]
    r = subprocess.run([XIVRENDER, os.path.join(sq, "game", "sqpack"), "--scene", sp], capture_output=True, text=True)
    print((r.stdout + r.stderr).strip()[-2500:])


if __name__ == "__main__":
    main()
