"""Render a .pmp with the game-shader renderer (GS) from the command line, posed with the game's own animations.

Resolves the mod exactly like the viewer page (api_open / api_scene: options, EQP/EQDP/IMC, your Penumbra collection
underneath, the character's face paint and colours), poses the merged skeleton the way the page does (racial deformers,
height and bust scaling, the game's .pap animations), and has apps/xivrender draw it. Bind pose hides weight problems
that a game animation shows (Sora's jacket layers sliding through each other at idle), so check posed renders too.

python -P -E tools/gs_render.py <mod.pmp | vanilla> <out.png> [options]
  subject   --design <Glamourer JSON file | clipboard code | .txt holding one>   (default: the mod's own targets)
            --race c0101 --clan N --face N --hair N --gear slot=set.variant[.dye1[.dye2]] (slots met top glv dwn sho ...)
            --face-paint N --paint-color N [--paint-flip]   --no-collection (the mod alone)
            --set "Group=Option[+Option...]"   mod options (default: the mod's defaults)
  pose      --pose bind|idle|pose1|pose2|pose3|pose4|walk|run   --time <seconds into the animation>
  view      --cam front|back|left|right|three-quarter|head|feet|hand_l|hand_r   --yaw <deg>   --size WxH
            --env day|neutral   --light-az <deg> --light-el <deg>   (as the viewer's "Light from" / "height")
  debug     --output final|gbuffer0..4|lightdiffuse|lightspecular|shadowmask|ao|hdr   --swap <game path>=<file>
"""
import argparse
import json
import math
import os
import subprocess
import sys
import tempfile

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))
import anim  # noqa: E402
import app  # noqa: E402
import customize as C  # noqa: E402
import game  # noqa: E402
import skeleton as S  # noqa: E402

XIVRENDER = os.path.join(ROOT, "apps", "xivrender", "xivrender.exe")
# the viewer's lighting presets as viewer/app.js sends them to the renderer (xrEnv); keep in step with LIGHTS there
ENVS = {
    "neutral": dict(LightDiffuse=[0.573] * 3, LightSpecular=[0.573] * 3, AmbientSh=[[0, 0.1903, 0, 0.2235]] * 3,
                    Reflection=[0.3] * 3),
    "day": dict(LightDiffuse=[1.342, 1.248, 1.101], LightSpecular=[1.342, 1.248, 1.101],
                AmbientSh=[[0, 0.1354, 0, 0.7586], [0, 0.1973, 0, 0.7692], [0, 0.3295, 0, 0.8061]],
                Reflection=[0.193, 0.209, 0.245], ReflectionGround=[0.162, 0.149, 0.124],
                CameraLightColor=[0.0611] * 3, CameraLight=[0.3041, 0.0422, 0, 0]),
}
CAMS = {"front": 0, "three-quarter": -35, "left": 90, "right": -90, "back": 180}


def trs(t, q, s):
    x, y, z, w = q
    m = np.eye(4)
    m[:3, :3] = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                          [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                          [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]) * np.asarray(s)[None, :]
    m[:3, 3] = t
    return m


def slerp(a, b, u):
    a, b = np.asarray(a, float), np.asarray(b, float)
    d = float(np.dot(a, b))
    if d < 0:
        b, d = -b, -d
    if d > 0.9995:
        q = a + u * (b - a)
    else:
        th = math.acos(d)
        q = (math.sin((1 - u) * th) * a + math.sin(u * th) * b) / math.sin(th)
    return q / np.linalg.norm(q)


def pose_deltas(sc, kind, t):
    """Per skeleton bone: posed world x inverse bind world, as the page's Figure.playAnim computes it."""
    sk = sc["skeleton"]
    n = len(sk["names"])
    bind = [np.array(w, float).reshape(4, 4).T for w in sk["world"]]
    if kind == "bind" or not sc.get("race"):
        return bind, [np.eye(4)] * n
    inv = [np.linalg.inv(m) for m in bind]
    local_bind = [inv[p] @ bind[i] if p >= 0 else bind[i] for i, p in enumerate(sk["parents"])]
    a = anim.load(sc["race"], kind)
    tracks = [S.load_sklb(game.game_file(a["skeleton"]))[i][0] for i in a["bones"]]
    by_name = {nm: i for i, nm in enumerate(tracks)}
    frames, nf = a["frames"], a["frames"].shape[0]
    ft = (t * a["fps"]) % nf
    i0, u = int(ft), ft - int(ft)
    i1 = (i0 + 1) % nf
    bust = np.diag(list(sc["bust"]) + [1]) if sc.get("bust") else None
    world, deltas = [None] * n, [None] * n
    for i, name in enumerate(sk["names"]):
        tr = by_name.get(name)
        if tr is not None:
            f0, f1 = frames[i0, tr], frames[i1, tr]
            local = trs(f0[0:3] + u * (f1[0:3] - f0[0:3]), slerp(f0[3:7], f1[3:7], u), f0[7:10] + u * (f1[7:10] - f0[7:10]))
        else:
            local = local_bind[i]
        if bust is not None and name in ("j_mune_l", "j_mune_r"):
            local = local @ bust
        p = sk["parents"][i]
        world[i] = world[p] @ local if p >= 0 else local
        deltas[i] = world[i] @ inv[i]
    return world, deltas


def subject_from(args, opened):
    if args.design:
        text = open(args.design, encoding="utf-8-sig").read() if os.path.exists(args.design) else args.design
        spec = C.from_glamourer(text)
        for n in spec.pop("notes", []):
            print("design:", n)
        spec.pop("name", None)
    else:
        spec = dict(opened["subject"]) if opened else {"subject": "character", "race": "c0101", "gear": {}}
    for key in ("race", "clan", "face", "hair"):
        if getattr(args, key) is not None:
            spec[key] = getattr(args, key)
    gear = dict(spec.get("gear") or {})
    for g in args.gear:
        slot, val = g.split("=", 1)
        gear[slot] = [int(x) for x in val.split(".")] if val not in ("", "none") else None
    spec["gear"] = gear
    if args.face_paint is not None:
        spec["facePaint"] = args.face_paint
    if args.paint_color is not None:
        spec["facePaintIndex"] = args.paint_color
    if args.paint_flip:
        spec["facePaintReversed"] = True
    spec["collection"] = not args.no_collection
    spec.setdefault("subject", "character")
    return spec


def settings_from(args, opened):
    if not opened:
        return {}
    settings = {int(k): v for k, v in opened["settings"].items()}
    groups = {g["name"].lower(): g for g in opened["mod"].get("groups", [])}
    for s in args.set:
        gname, opts = s.split("=", 1)
        g = groups.get(gname.strip().lower())
        if g is None:
            sys.exit(f"no option group {gname!r}; groups: {', '.join(x['name'] for x in groups.values())}")
        names = [o["name"].lower() for o in g["options"]]
        picks = [names.index(o.strip().lower()) for o in opts.split("+") if o.strip()]
        settings[g["index"]] = picks[0] if g["type"] == "Single" else sum(1 << i for i in picks)
    return settings


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mod")
    ap.add_argument("out")
    ap.add_argument("--design")
    ap.add_argument("--race")
    ap.add_argument("--clan", type=int)
    ap.add_argument("--face", type=int)
    ap.add_argument("--hair", type=int)
    ap.add_argument("--gear", action="append", default=[])
    ap.add_argument("--face-paint", type=int)
    ap.add_argument("--paint-color", type=int)
    ap.add_argument("--paint-flip", action="store_true")
    ap.add_argument("--no-collection", action="store_true")
    ap.add_argument("--set", action="append", default=[])
    ap.add_argument("--pose", default="idle")
    ap.add_argument("--time", type=float, default=0.0)
    ap.add_argument("--cam", default="front")
    ap.add_argument("--yaw", type=float)
    ap.add_argument("--size", default="1024x1536")
    ap.add_argument("--env", default="day", choices=sorted(ENVS))
    ap.add_argument("--light-az", type=float, default=31)
    ap.add_argument("--light-el", type=float, default=46)
    ap.add_argument("--output", default="final")
    ap.add_argument("--swap", action="append", default=[])
    args = ap.parse_args()

    path = None if args.mod.lower() == "vanilla" else os.path.abspath(args.mod)
    opened = app.api_open({"path": path}) if path else None
    spec = subject_from(args, opened)
    sc = app.api_scene({"path": path or "", "settings": settings_from(args, opened), "subject": spec})
    for p in sc["problems"]:
        if p["level"] in ("error", "warn"):
            print(f"{p['level']:5} {p['text'][:240]}")

    # pose: the page's palette per model bone = figure scale x (posed world x bind world^-1) x racial deformer
    world, deltas = pose_deltas(sc, args.pose, args.time)
    G = np.diag([sc.get("scale") or 1.0] * 3 + [1.0])
    models = []
    for m, r in zip(sc["models"], sc["render"]["models"]):
        if m["hidden"]:
            continue
        deform = [np.array(d, float).reshape(4, 4).T for d in m["deform"]] if m.get("deform") else None
        bones = []
        for i, g in enumerate(m["bones"]):
            pal = G @ (deltas[g] if g >= 0 else np.eye(4))
            if deform:
                pal = pal @ deform[i]
            bones.append(pal.T.ravel().tolist())          # column-major, as the page sends them
        desc = dict(Id=f"{m['slot']}", Mdl=r["mdl"], Materials=r["materials"], Stains=r.get("stains") or [], Bones=bones,
                    HiddenAttributes=[a for a, v in m["attrs"].items() if v.get("show") is False], Shapes=m.get("shapesOn") or [])
        if r.get("decal"):
            desc.update(Decal=r["decal"], DecalColor=r["decalColor"])
        models.append(desc)

    # camera: framed on the posed skeleton
    pts = np.array([w[:3, 3] for w in world]) * (sc.get("scale") or 1.0)
    top, bottom = pts[:, 1].max() + 0.12, max(0.0, pts[:, 1].min())
    w, h = (int(x) for x in args.size.lower().split("x"))
    fov = 30.0
    if args.cam == "head":
        names = sc["skeleton"]["names"]
        target = pts[names.index("j_kao")] if "j_kao" in names else np.array([0, top - 0.15, 0])
        target = target + np.array([0, 0.05, 0])
        dist, yaw = 0.9, 0.0
    elif args.cam == "feet":
        target, dist, yaw = np.array([0, 0.25, 0]), 1.3, 0.0
    elif args.cam in ("hand_l", "hand_r"):             # the posed hand, seen from the front-outside
        names = sc["skeleton"]["names"]
        s = args.cam[-1]
        target = (pts[names.index(f"j_te_{s}")] + pts[names.index(f"j_naka_b_{s}")]) / 2
        dist, yaw = 0.45, 30.0 if s == "l" else -30.0
    else:
        target = np.array([0, (top + bottom) / 2, 0])
        dist = (top - bottom) / 2 * 1.08 / math.tan(math.radians(fov / 2)) * max(1.0, h / w * 0.66)
        yaw = CAMS.get(args.cam, 0.0)
    if args.yaw is not None:
        yaw = args.yaw
    t = math.radians(yaw)
    eye = target + np.array([math.sin(t) * dist, 0.05 * dist, math.cos(t) * dist])
    az, el = math.radians(args.light_az), math.radians(args.light_el)
    env = dict(ENVS[args.env], LightDir=[math.sin(az) * math.cos(el), math.sin(el), math.cos(az) * math.cos(el)],
               Ao=True, AoSamples=8, Background=[0.1047, 0.1139, 0.1328])
    redirects = dict(sc["render"]["redirects"])
    for s in args.swap:
        g, local = s.split("=", 1)
        redirects[g] = os.path.abspath(local)
    out = os.path.abspath(args.out)
    scene = dict(Width=w, Height=h, Camera=dict(Eye=eye.tolist(), Target=target.tolist(), FovY=fov), Env=env,
                 Redirects=redirects, Models=models, Customize=sc["render"].get("customize") or {}, Output=args.output,
                 OutFile=out)
    fd, sp = tempfile.mkstemp(suffix=".json", prefix="gs_scene_")
    with os.fdopen(fd, "w") as f:
        json.dump(scene, f)
    try:
        r = subprocess.run([XIVRENDER, game.sqpack(), "--scene", sp], capture_output=True, text=True)
    finally:
        os.remove(sp)
    notes = [ln for ln in (r.stdout + r.stderr).splitlines() if ln.strip() and not ln.startswith("xivrender on")]
    for ln in notes[-12:]:
        print(ln)
    print("wrote", out if os.path.exists(out) else "NOTHING")


if __name__ == "__main__":
    main()
