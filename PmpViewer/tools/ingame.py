"""Compare the PMP Viewer with the game, using a capture saved in game by the PMP Capture plugin (/pmpcapture).

    python -P -E tools/ingame.py [capture folder | latest] [--game-masks] [--viewer-colors] [--no-render]

The capture holds what the game drew at one moment: the character's customize bytes and gear, every file Penumbra
served (game path -> actual file), each model's enabled attribute / shape-key masks, the pose (model-space bone
transforms, physics included), the camera matrices, g_CustomizeParameter as uploaded, and the game's own render
targets (G-buffers, light buffers, depth, final image).

This tool rebuilds the same character with the viewer's resolver (your Penumbra collection underneath, as in game) and
checks, in order:
  1. files      every model / material / texture / skeleton the viewer would load vs what Penumbra served
  2. masks      which submesh attributes and shape keys each model shows (EQP/IMC rules, face shapes)
  3. colours    g_CustomizeParameter the viewer computes from the customize bytes vs the game's
  4. pixels     the frame redrawn by the game-shader renderer from the captured camera and pose, compared target by
                target with the game's on the character's pixels: G-buffers (geometry, materials, colours), depth,
                light buffers, final image
Everything goes to <capture>/compare/: report.md, report.json and side-by-side / difference images.

--game-masks     draw with the game's attribute / shape masks (isolates rendering from the resolver's visibility rules)
--viewer-colors  use the viewer's computed customize colours instead of the captured g_CustomizeParameter
"""
import argparse
import glob
import gzip
import json
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))
import app  # noqa: E402
import customize as C  # noqa: E402
import game  # noqa: E402
import meta as M  # noqa: E402

CAPTURES = os.path.join(ROOT, "work", "ingame")
XIVRENDER = os.path.join(ROOT, "apps", "xivrender", "xivrender.exe")
SLOTS = ["met", "top", "glv", "dwn", "sho", "ear", "nek", "wrs", "rir", "ril"]
RAW = ["gbuffer0", "gbuffer1", "gbuffer2", "gbuffer3", "gbuffer4", "lightdiffuse", "lightspecular", "depth", "hdr", "final"]


# ---------------------------------------------------------------- reading a capture

def latest():
    folders = sorted(glob.glob(os.path.join(CAPTURES, "*", "capture.json")), key=os.path.getmtime)
    if not folders:
        sys.exit(f"no captures in {CAPTURES} (in game: /pmpcapture)")
    return os.path.dirname(folders[-1])


def half(a):
    return np.frombuffer(a, np.float16).astype(np.float32)


def decode(raw, w, h, fmt):
    """A render target as numpy: float32 HxWxC for float formats, uint8 for UNORM 8-bit, (depth, stencil) for D24S8."""
    if fmt in (9, 10):                                    # R16G16B16A16 typeless / float
        return half(raw).reshape(h, w, 4)
    if fmt in (2,):                                       # R32G32B32A32_FLOAT
        return np.frombuffer(raw, np.float32).reshape(h, w, 4)
    if fmt in (27, 28, 29, 30):                           # R8G8B8A8
        return np.frombuffer(raw, np.uint8).reshape(h, w, 4)
    if fmt in (87, 88, 90, 91):                           # B8G8R8A8 / X8
        return np.frombuffer(raw, np.uint8).reshape(h, w, 4)[..., [2, 1, 0, 3]]
    if fmt in (44, 45):                                   # R24G8 / D24S8: depth in the low 24 bits
        v = np.frombuffer(raw, np.uint32).reshape(h, w)
        return (v & 0xFFFFFF).astype(np.float64) / 0xFFFFFF, (v >> 24).astype(np.uint8)
    if fmt in (39, 40, 41):                               # R32 / D32
        return np.frombuffer(raw, np.float32).reshape(h, w)
    if fmt in (33, 34):                                   # R16G16 float
        return half(raw).reshape(h, w, 2)
    if fmt == 26:                                         # R11G11B10_FLOAT
        v = np.frombuffer(raw, np.uint32).reshape(h, w)

        def small(bits, mbits):
            e = (bits >> mbits).astype(np.int32)
            m = (bits & ((1 << mbits) - 1)).astype(np.float64)
            return np.where(e == 0, m / (1 << mbits) * 2.0 ** -14, (1 + m / (1 << mbits)) * 2.0 ** (e - 15))
        return np.dstack([small(v & 0x7FF, 6), small((v >> 11) & 0x7FF, 6), small((v >> 22) & 0x3FF, 5)]).astype(np.float32)
    if fmt in (23, 24):                                   # R10G10B10A2
        v = np.frombuffer(raw, np.uint32).reshape(h, w)
        return np.dstack([(v & 1023) / 1023, ((v >> 10) & 1023) / 1023, ((v >> 20) & 1023) / 1023, (v >> 30) / 3]).astype(np.float32)
    return None


def load_capture(folder):
    cap = json.load(open(os.path.join(folder, "capture.json"), encoding="utf-8"))
    targets = {}
    for t in cap.get("targets") or []:
        if not t.get("file"):
            continue
        raw = gzip.open(os.path.join(folder, t["file"])).read()
        targets[t["name"]] = (decode(raw, t["width"], t["height"], t["format"]), t)
    return cap, targets


# ---------------------------------------------------------------- the character as the viewer would build it

def subject_of(cap):
    ch = cap["character"]
    spec = C.from_bytes(ch["customize"])
    items = {}
    gear = {}
    for slot, v in zip(SLOTS, ch.get("equipment") or []):
        v = int(v)
        sid, var, s1, s2 = v & 0xFFFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF, (v >> 32) & 0xFF
        if sid == 0 and slot in M.ACCES:
            continue
        gear[slot] = [sid, var, s1, s2]
    spec["gear"] = gear
    spec["collection"] = True              # the game draws your whole collection
    spec["captureGlasses"] = ch.get("glasses")
    return spec


def penumbra_map(cap):
    """game path -> actual file, as Penumbra served it to this character."""
    out = {}
    for actual, gps in (cap.get("penumbra") or {}).items():
        for gp in gps:
            out[gp.lower()] = actual
    return out


def norm(p):
    if not p:
        return ""
    p = p.split("|")[-1] if p.startswith("|") else p        # Penumbra prefixes redirected handles with |hash|
    return os.path.normcase(os.path.normpath(p)).replace("\\", "/").lower() if (":" in p or p.startswith("\\")) else p.lower()


# ---------------------------------------------------------------- 1. files

def compare_files(sc, cap):
    pen = penumbra_map(cap)
    rows = []
    for e in sc["trace"]:
        if e["kind"] not in ("model", "material", "texture", "skeleton") or e.get("source") == "missing" and e["request"] not in pen:
            continue
        gp = e["request"]
        viewer = sc["render"]["redirects"].get(gp) or (gp if e.get("source") == "game" else None)
        game_actual = pen.get(gp)
        if game_actual is None:
            rows.append({"path": gp, "kind": e["kind"], "viewer": viewer, "game": None,
                         "verdict": "not loaded in game" if e.get("source") != "missing" else "missing in both"})
            continue
        same = norm(game_actual) == norm(viewer) or (e.get("source") == "game" and norm(game_actual) == gp)
        rows.append({"path": gp, "kind": e["kind"], "viewer": viewer, "game": game_actual,
                     "verdict": "same" if same else "DIFFERENT"})
    seen = {r["path"] for r in rows}
    for gp, actual in pen.items():
        if gp not in seen and gp.split(".")[-1] in ("mdl", "mtrl", "tex", "sklb"):
            rows.append({"path": gp, "kind": gp.split(".")[-1], "viewer": None, "game": actual, "verdict": "VIEWER DOESN'T LOAD IT"})
    return rows


# ---------------------------------------------------------------- 2. attribute and shape masks

def compare_masks(sc, cap):
    out = []
    by_path = {m["request"]: m for m in sc["models"]}
    for cm in cap["character"].get("models") or []:
        f = cm.get("file") or ""
        gp = next((p for p, a in penumbra_map(cap).items() if norm(a) == norm(f)), None) or norm(f)
        vm = by_path.get(gp)
        if vm is None:
            out.append({"slot": cm["slot"], "file": f, "verdict": "viewer has no model for it"})
            continue
        attrs, shapes = vm["attributes"], vm["shapeNames"]
        game_attrs = {a for i, a in enumerate(attrs) if cm["attributeMask"] >> i & 1}
        game_shapes = {s for i, s in enumerate(shapes) if cm["shapeMask"] >> i & 1}
        shown = {a for a in attrs if vm["attrs"].get(a, {}).get("show", True)}
        on = set(vm.get("shapesOn") or [])
        out.append({"slot": cm["slot"], "path": gp, "viewerSlot": vm["slot"],
                    "attrOnlyGame": sorted(game_attrs - shown), "attrOnlyViewer": sorted(shown - game_attrs),
                    "shapeOnlyGame": sorted(game_shapes - on), "shapeOnlyViewer": sorted(on - game_shapes),
                    "gameShapes": sorted(game_shapes), "gameAttrs": sorted(game_attrs),
                    "verdict": "same" if game_attrs == shown and game_shapes == on else "DIFFERENT"})
    return out


# ---------------------------------------------------------------- 3. customize colours

NAMES = ["SkinColor", "LipColor", "MainColor", "MeshColor", "LeftColor", "RightColor", "OptionColor"]


def viewer_customize_cb(sc):
    """g_CustomizeParameter as xivrender's FillCustomize builds it from the viewer's colours (squared, W terms)."""
    c = sc["render"]["customize"]

    def col(k, d):
        v = c.get(k)
        return v if v and len(v) >= 3 else d
    sq = lambda v: [x * x for x in v[:3]]
    skin = col("skin", [238 / 255, 195 / 255, 166 / 255])
    hair = col("hair", [90 / 255, 58 / 255, 34 / 255])
    high = col("highlight", hair)
    eye = col("eye", [90 / 255, 128 / 255, 166 / 255])
    eyel = col("eyeLeft", eye)
    lip = c.get("lip") or [0, 0, 0, 0]
    opt = col("option", [1, 1, 1])
    w = lambda k, d: (c.get(k) or [d])[0]
    return [*sq(skin), w("muscle", 1), *sq(lip), lip[3] if len(lip) > 3 else 0, *sq(hair), w("paintScale", 1),
            *sq(high), w("paintOffset", 0), *sq(eyel), w("leftW", 0), *sq(eye), w("rightW", 0), *sq(opt), 0]


def compare_customize(sc, cap):
    g = (cap["character"].get("customizeParameter") or {}).get("floats")
    if not g:
        return None
    v = viewer_customize_cb(sc)
    rows = []
    for i, name in enumerate(NAMES):
        gv, vv = [float(x) for x in g[i * 4:i * 4 + 4]], v[i * 4:i * 4 + 4]
        rows.append({"name": name, "game": [round(x, 4) for x in gv], "viewer": [round(x, 4) for x in vv],
                     "maxDiff": round(max(abs(a - b) for a, b in zip(gv, vv)), 4)})
    return rows


# ---------------------------------------------------------------- 4. pose, camera and the redraw

def qs_matrix(t):
    x, y, z, qx, qy, qz, qw, sx, sy, sz = t
    m = np.eye(4)
    m[:3, :3] = np.array([[1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw)],
                          [2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw)],
                          [2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)]]) * np.array([sx, sy, sz])
    m[:3, 3] = (x, y, z)
    return m


def captured_world(cap):
    """bone name -> posed world matrix (column-vector convention): character transform x model-space pose."""
    sk = cap["character"]["skeleton"]
    w = qs_matrix(list(sk["position"]) + list(sk["rotation"]) + list(sk["scale"]))
    out = {}
    for p in sk.get("partials") or []:
        for name, t in zip(p.get("bones") or [], p.get("model") or []):
            out.setdefault(name, w @ qs_matrix(t))
    return out


def palettes(sc, world):
    bind = {n: np.array(m, float).reshape(4, 4).T for n, m in zip(sc["skeleton"]["names"], sc["skeleton"]["world"])}
    missing = set()
    out = []
    for m in sc["models"]:
        deform = [np.array(d, float).reshape(4, 4).T for d in m["deform"]] if m.get("deform") else None
        pal = []
        for i, name in enumerate(m["boneNames"]):
            if name in world and name in bind and np.isfinite(world[name]).all():
                p = world[name] @ np.linalg.inv(bind[name])
            else:
                missing.add(name)
                p = np.eye(4)
            if deform:
                p = p @ deform[i]
            pal.append(p.T.ravel().tolist())
        out.append(pal)
    return out, sorted(missing)


def render(sc, cap, folder, game_masks, viewer_colors):
    world = captured_world(cap)
    pals, missing = palettes(sc, world)
    cm_by_path = {}
    pen = penumbra_map(cap)
    for cm in cap["character"].get("models") or []:
        gp = next((p for p, a in pen.items() if norm(a) == norm(cm.get("file") or "")), None)
        if gp:
            cm_by_path[gp] = cm
    models = []
    for m, r, pal in zip(sc["models"], sc["render"]["models"], pals):
        hidden_attrs = [a for a, v in m["attrs"].items() if v.get("show") is False]
        shapes = m.get("shapesOn") or []
        cm = cm_by_path.get(m["request"])
        if game_masks:
            if cm is None:
                continue
            hidden_attrs = [a for i, a in enumerate(m["attributes"]) if not cm["attributeMask"] >> i & 1]
            shapes = [s for i, s in enumerate(m["shapeNames"]) if cm["shapeMask"] >> i & 1]
        elif m["hidden"]:
            continue
        desc = dict(Id=m["slot"], Mdl=r["mdl"], Materials=r["materials"], Stains=r.get("stains") or [], Bones=pal,
                    HiddenAttributes=hidden_attrs, Shapes=shapes)
        if r.get("decal"):
            desc.update(Decal=r["decal"], DecalColor=r["decalColor"])
        models.append(desc)
    cam = cap["camera"]["render"]
    rnd = cap["game"].get("render") or {}
    w, h = int(rnd.get("width") or 1920), int(rnd.get("height") or 1080)
    # the sun: the shadow camera looks along the light, so the light comes from minus its forward axis
    sv = np.array(cap["env"]["shadowCamera"]["view"], float).reshape(4, 4)
    light_dir = (sv[0, 2], sv[1, 2], sv[2, 2])
    env = dict(LightDir=list(light_dir), LightDiffuse=[1.342, 1.248, 1.101], LightSpecular=[1.342, 1.248, 1.101],
               AmbientSh=[[0, 0.1354, 0, 0.7586], [0, 0.1973, 0, 0.7692], [0, 0.3295, 0, 0.8061]],
               Reflection=[0.193, 0.209, 0.245], ReflectionGround=[0.162, 0.149, 0.124], Ao=True, AoSamples=8,
               Background=[0, 0, 0])
    out = os.path.join(folder, "compare", "viewer.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    scene = dict(Width=w, Height=h, Camera=dict(View=cam["view"], Projection=cam["projection"], Near=cam["near"]), Env=env,
                 Redirects=sc["render"]["redirects"], Models=models, Customize=sc["render"].get("customize") or {},
                 OutFile=out, RawOutputs=RAW)
    cb = (cap["character"].get("customizeParameter") or {}).get("floats")
    if cb and not viewer_colors:
        scene["CustomizeRaw"] = [float(x) for x in cb]
    sp = os.path.join(folder, "compare", "scene.json")
    json.dump(scene, open(sp, "w"))
    r = subprocess.run([XIVRENDER, game.sqpack(), "--scene", sp], capture_output=True, text=True)
    log = [ln for ln in (r.stdout + r.stderr).splitlines() if ln.strip()]
    raws = {}
    for name in RAW:
        p = f"{out}.{name}.bin"
        if os.path.exists(p):
            hd = json.load(open(f"{out}.{name}.json"))
            raws[name] = decode(open(p, "rb").read(), hd["width"], hd["height"], hd["format"])
    return raws, log, missing, light_dir


# ---------------------------------------------------------------- comparing pixels

def to_u8(a, mode):
    if mode == "srgb_hdr":                 # light buffers / HDR: a simple curve to look at
        a = np.clip(a[..., :3], 0, None)
        return (np.clip(a / (1 + a), 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)
    if mode == "depth":
        d = a[0] if isinstance(a, tuple) else a
        nz = d[d > 0]
        lo, hi = (np.percentile(nz, 1), np.percentile(nz, 99)) if nz.size else (0, 1)
        return (np.clip((d - lo) / max(hi - lo, 1e-9), 0, 1) * 255).astype(np.uint8)
    return a[..., :3] if a.dtype == np.uint8 else (np.clip(a[..., :3], 0, 1) * 255).astype(np.uint8)


def compare_pixels(targets, raws, folder):
    """On the character's pixels: where the viewer drew geometry and both depths agree."""
    res = {}
    if "depth" not in raws or "depth" not in targets:
        return {"error": "no depth to find the character's pixels"}
    vd, _ = raws["depth"]
    gd = targets["depth"][0]
    gd = gd[0] if isinstance(gd, tuple) else gd
    if gd.shape != vd.shape:
        return {"error": f"size differs: game {gd.shape}, viewer {vd.shape}"}
    drawn = vd > 0
    agree = drawn & (np.abs(gd - vd) < 2e-4 * np.maximum(vd, 1e-6) + 1e-6)
    res["characterPixels"] = int(drawn.sum())
    res["depthAgrees"] = round(float(agree.sum() / max(drawn.sum(), 1)), 4)
    Image.fromarray(np.dstack([(drawn & ~agree) * 255, agree * 255, np.zeros_like(vd, np.uint8)]).astype(np.uint8)).save(
        os.path.join(folder, "depth_agreement.png"))
    for name, mode in (("gbuffer0", "u8"), ("gbuffer1", "u8"), ("gbuffer2", "u8"), ("gbuffer4", "u8"),
                       ("lightdiffuse", "srgb_hdr"), ("lightspecular", "srgb_hdr"), ("final", "u8")):
        gname = "backbuffer" if name == "final" else name
        if name not in raws or gname not in targets:
            continue
        g, v = targets[gname][0], raws[name]
        if g.shape[:2] != v.shape[:2]:
            res[name] = {"error": f"size differs: game {g.shape}, viewer {v.shape}"}
            continue
        gf = g.astype(np.float32) / (255 if g.dtype == np.uint8 else 1)
        vf = v.astype(np.float32) / (255 if v.dtype == np.uint8 else 1)
        ch = min(gf.shape[2], vf.shape[2], 3 if name in ("final",) or "light" in name else 4)
        d = np.abs(gf[..., :ch] - vf[..., :ch])
        m = agree if name != "final" else drawn
        dm = d[m]
        res[name] = {"meanAbs": [round(float(x), 4) for x in dm.mean(0)] if dm.size else None,
                     "p99": [round(float(x), 4) for x in np.percentile(dm, 99, axis=0)] if dm.size else None,
                     "over2of255": round(float((dm.max(axis=1) > 2 / 255).mean()), 4) if dm.size else None}
        # side by side (game | viewer | difference x8) cropped to the character
        ys, xs = np.where(drawn)
        if ys.size:
            y0, y1 = max(ys.min() - 20, 0), min(ys.max() + 20, drawn.shape[0])
            x0, x1 = max(xs.min() - 20, 0), min(xs.max() + 20, drawn.shape[1])
            a, b = to_u8(g, mode)[y0:y1, x0:x1], to_u8(v, mode)[y0:y1, x0:x1]
            diff = np.clip(np.abs(a.astype(int) - b.astype(int)) * 8, 0, 255).astype(np.uint8)
            Image.fromarray(np.hstack([a, b, diff])).save(os.path.join(folder, f"{name}_game_viewer_diff.png"))
    return res


def previews(targets, folder):
    for name, (a, t) in targets.items():
        try:
            mode = "depth" if name == "depth" else "srgb_hdr" if t["format"] in (2, 9, 10, 26) else "u8"
            arr = to_u8(a, mode)
            if arr.ndim == 3 and arr.shape[2] == 2:
                arr = np.dstack([arr, np.zeros_like(arr[..., :1])])
            Image.fromarray(arr).save(os.path.join(folder, f"game_{name}.png"))
        except Exception as e:      # noqa: BLE001
            print("preview", name, e)


# ---------------------------------------------------------------- report

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("capture", nargs="?", default="latest")
    ap.add_argument("--game-masks", action="store_true")
    ap.add_argument("--viewer-colors", action="store_true")
    ap.add_argument("--no-render", action="store_true")
    a = ap.parse_args()
    folder = latest() if a.capture == "latest" else os.path.abspath(a.capture)
    out = os.path.join(folder, "compare")
    os.makedirs(out, exist_ok=True)
    cap, targets = load_capture(folder)
    previews(targets, out)
    spec = subject_of(cap)
    sc = app.api_scene({"path": "", "settings": {}, "subject": spec})
    report = {"capture": folder, "subject": {k: v for k, v in spec.items() if k != "gear"}, "gear": spec["gear"],
              "notes": cap.get("notes"), "game": cap.get("game")}
    report["files"] = compare_files(sc, cap)
    report["masks"] = compare_masks(sc, cap)
    report["customize"] = compare_customize(sc, cap)
    report["viewerProblems"] = [p for p in sc["problems"] if p["level"] in ("error", "warn")]
    if not a.no_render:
        raws, log, missing, light = render(sc, cap, folder, a.game_masks, a.viewer_colors)
        report["renderLog"] = log[-20:]
        report["bonesNotInCapture"] = missing
        report["lightDir"] = [round(float(x), 4) for x in light]
        report["pixels"] = compare_pixels(targets, raws, out)
    json.dump(report, open(os.path.join(out, "report.json"), "w"), indent=1, default=str)
    write_md(report, os.path.join(out, "report.md"))
    print(open(os.path.join(out, "report.md"), encoding="utf-8").read())


def write_md(r, path):
    L = [f"# In-game capture vs PMP Viewer", "", f"Capture: `{r['capture']}`", ""]
    files = r["files"]
    bad = [f for f in files if f["verdict"] not in ("same",)]
    L += [f"## 1. Files: {len(files) - len(bad)} of {len(files)} the same", ""]
    for f in bad[:80]:
        L.append(f"- **{f['verdict']}** {f['kind']} `{f['path']}`  viewer: `{f['viewer']}`  game: `{f['game']}`")
    masks = r["masks"]
    L += ["", f"## 2. Attributes and shape keys: {sum(m['verdict'] == 'same' for m in masks)} of {len(masks)} models the same", ""]
    for m in masks:
        if m["verdict"] != "same":
            L.append(f"- slot {m['slot']} `{m.get('path') or m.get('file')}`: {m['verdict']}"
                     + "".join(f"; {k} {m[k]}" for k in ("attrOnlyGame", "attrOnlyViewer", "shapeOnlyGame", "shapeOnlyViewer") if m.get(k)))
    L += ["", "## 3. Customize colours (g_CustomizeParameter)", ""]
    for c in r["customize"] or []:
        L.append(f"- {c['name']}: game {c['game']} viewer {c['viewer']} (max diff {c['maxDiff']})")
    if r.get("pixels"):
        L += ["", "## 4. Pixels (character only)", "", "```", json.dumps(r["pixels"], indent=1), "```"]
    if r.get("bonesNotInCapture"):
        L += ["", f"Bones the viewer skins that the capture lacks: {', '.join(r['bonesNotInCapture'][:30])}"]
    open(path, "w", encoding="utf-8").write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
