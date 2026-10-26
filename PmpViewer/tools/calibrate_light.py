"""Fit the game renderer's light (sun, ambient SH, reflection probe, camera light) to frames of in-game footage.

Inputs live in work/calibration (see README "Calibrating the light"):
  frames/t<N>.png        video frames (any size; 16:10 like the saved state is easiest)
  state_<name>.bin       a /frame request saved from the viewer page (camera + pose), see tools/calibrate_page.js
  scene_<name>.json      the /scene body for that state (the outfit)
  views.json             [{"state": "fending", "frame": 6, "yaw": -25, "headY": 250, "exclude": [[x0,y0,x1,y1], ...]}, ...]
                         headY: rows above it (in 1080p frame pixels) are ignored (the head is the player's own
                         customisation); exclude: overlays such as a channel watermark. "holdOut": true keeps a view out
                         of the first fit and reports how well that fit predicts it.
The renderer must be running (open the viewer page; its port is window.pmpv.xr.port).

usage: python -P -E tools/calibrate_light.py <renderer port> [iterations]
Writes work/calibration/fit.json (the env values for a LIGHTS preset's xr block in viewer/app.js) and compare.png.
"""
import json
import math
import os
import struct
import sys
import time
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "work", "calibration")
PORT = int(sys.argv[1])
ITERS = int(sys.argv[2]) if len(sys.argv) > 2 else 400
URL = f"http://127.0.0.1:{PORT}"
LUM = np.array([0.2126, 0.7152, 0.0722], np.float32)
SKY_TINT = np.array([0.74, 0.80, 0.94])
SUN_TINT = np.array([1.0, 0.93, 0.82])
GROUND_TINT = np.array([0.85, 0.78, 0.65])
W, H = 864, 540            # fitting resolution
_scene = [None]


def post(path, body):
    return urllib.request.urlopen(urllib.request.Request(URL + path, body), timeout=120).read()


class State:
    def __init__(self, name):
        raw = open(os.path.join(DIR, f"state_{name}.bin"), "rb").read()
        jl = struct.unpack_from("<I", raw, 0)[0]
        self.head = json.loads(raw[4:4 + jl])
        self.bones = raw[4 + jl:]
        self.head["env"]["aoSamples"] = 4
        self.scene = open(os.path.join(DIR, f"scene_{name}.json"), "rb").read()
        eye, self.tgt = np.array(self.head["camera"]["eye"]), np.array(self.head["camera"]["target"])
        self.rel = eye - self.tgt
        self.dist = math.hypot(self.rel[0], self.rel[2])

    def render(self, env, yaw, w=W, h=H):
        if _scene[0] is not self:
            post("/scene", self.scene)
            _scene[0] = self
        t = math.radians(yaw)
        cam = dict(self.head["camera"], eye=(self.tgt + np.array([math.sin(t) * self.dist, self.rel[1], math.cos(t) * self.dist])).tolist())
        head = dict(self.head, env=dict(self.head["env"], **env), camera=cam, format="rgba", width=w, height=h)
        j = json.dumps(head).encode()
        return np.frombuffer(post("/frame", struct.pack("<I", len(j)) + j + self.bones), np.uint8).reshape(h, w, 4)[..., :3]


def blur(a, r=1.5):
    return np.asarray(Image.fromarray(a).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255


def env_of(x):
    """x: log sun, sun azimuth / elevation (deg), log sky ambient, log ground/sky, log reflection sky / ground,
    log camera-light colour, log camera-light diffuse / specular (g_InstanceParameter m_CameraLight)."""
    sun = SUN_TINT * np.exp(x[0])
    az, el = np.radians(x[1]), np.radians(np.clip(x[2], 5, 85))
    amb = SKY_TINT * np.exp(x[3])
    gnd = GROUND_TINT * np.exp(x[3] + x[4])
    cam = float(np.exp(x[7]))
    return {"lightDir": [float(np.sin(az) * np.cos(el)), float(np.sin(el)), float(np.cos(az) * np.cos(el))],
            "lightDiffuse": sun.tolist(), "lightSpecular": sun.tolist(),
            "ambientSh": [[0, float((amb[i] - gnd[i]) / 2), 0, float((amb[i] + gnd[i]) / 2)] for i in range(3)],
            "reflection": (SKY_TINT * np.exp(x[5])).tolist(), "reflectionGround": (GROUND_TINT * np.exp(x[6])).tolist(),
            "cameraLightColor": [cam, cam, cam], "cameraLight": [float(np.exp(x[8])), float(np.exp(x[9])), 0, 0]}


class View:
    def __init__(self, spec, states):
        self.spec, self.st = spec, states[spec["state"]]
        self.t, self.yaw, self.head_y = spec["frame"], float(spec.get("yaw", 0)), spec.get("headY", 0)
        self.src = Image.open(os.path.join(DIR, "frames", f"t{self.t}.png")).convert("RGB")
        self.zoom, self.dx, self.dy = 1.0, 0.0, 0.0
        self.prepare()

    def ref_image(self, w, h):
        """The video frame zoomed about its centre and shifted (in fitting pixels), at w x h."""
        sw, sh = self.src.size
        k, a, s = sw / w, 1 / self.zoom, w / W
        coeffs = (a * k, 0, sw / 2 - a * k * (w / 2 + self.dx * s), 0, a * k, sh / 2 - a * k * (h / 2 + self.dy * s))
        return self.src.transform((w, h), Image.AFFINE, coeffs, resample=Image.BILINEAR)

    def prepare(self):
        self.ref = blur(np.asarray(self.ref_image(W, H)))
        base = self.st.render({}, self.yaw)
        m = np.abs(base.astype(int) - base[1, 1].astype(int)).max(axis=2) > 4
        m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(7))) > 128
        sx, sy = W / 1728, H / 1080
        m[:int(self.head_y * sy), :] = False
        for x0, y0, x1, y1 in self.spec.get("exclude", []):
            m[int(y0 * sy):int(y1 * sy), int(x0 * sx):int(x1 * sx)] = False
        self.mask = m

    def loss(self, env):
        d = (blur(self.st.render(env, self.yaw)) - self.ref)[self.mask]
        y = d @ LUM
        c = d - y[:, None]
        e = y * y + 0.3 * (c * c).sum(axis=1) / 3
        n = int(len(e) * 0.9)      # the worst 10% are pose differences (sky or ground inside our outline)
        return float(np.mean(np.partition(e, n)[:n]))

    def align(self, env):
        best = (self.loss(env), self.zoom, self.dx, self.dy, self.yaw)
        for rnd in range(2):
            span = 1 / (rnd + 1)
            for zoom in np.linspace(best[1] - 0.06 * span, best[1] + 0.06 * span, 5):
                for dx in np.linspace(best[2] - 16 * span, best[2] + 16 * span, 5):
                    for dy in np.linspace(best[3] - 16 * span, best[3] + 16 * span, 5):
                        self.zoom, self.dx, self.dy = zoom, dx, dy
                        self.prepare()
                        l = self.loss(env)
                        if l < best[0]:
                            best = (l, zoom, dx, dy, self.yaw)
            self.zoom, self.dx, self.dy = best[1:4]
            for yaw in np.arange(best[4] - 6, best[4] + 6.1, 2):
                self.yaw = yaw
                self.prepare()
                l = self.loss(env)
                if l < best[0]:
                    best = (l, *best[1:4], yaw)
            self.yaw = best[4]
            self.prepare()
        print(f"  t{self.t}: zoom {self.zoom:.3f} offset {self.dx:.0f},{self.dy:.0f} yaw {self.yaw:.0f}", flush=True)


def nelder_mead(f, x0, step, iters):
    n = len(x0)
    pts = [np.array(x0, float)] + [np.array(x0, float) + np.eye(n)[i] * step[i] for i in range(n)]
    vals = [f(p) for p in pts]
    for it in range(iters):
        order = np.argsort(vals)
        pts, vals = [pts[i] for i in order], [vals[i] for i in order]
        c = np.mean(pts[:-1], axis=0)
        xr = c + (c - pts[-1]); fr = f(xr)
        if fr < vals[0]:
            xe = c + 2 * (c - pts[-1]); fe = f(xe)
            pts[-1], vals[-1] = (xe, fe) if fe < fr else (xr, fr)
        elif fr < vals[-2]:
            pts[-1], vals[-1] = xr, fr
        else:
            xc = c + 0.5 * (pts[-1] - c); fc = f(xc)
            if fc < vals[-1]:
                pts[-1], vals[-1] = xc, fc
            else:
                pts = [pts[0]] + [pts[0] + 0.5 * (p - pts[0]) for p in pts[1:]]
                vals = [vals[0]] + [f(p) for p in pts[1:]]
    i = int(np.argmin(vals))
    return pts[i], vals[i]


def fit(views, starts):
    f = lambda x: sum(v.loss(env_of(x)) for v in views) / len(views)
    step = np.array([0.5, 40, 20, 0.6, 0.6, 0.7, 0.7, 0.7, 0.7, 0.7])
    return min((nelder_mead(f, s, step, ITERS) for s in starts), key=lambda r: r[1])


def main():
    t0 = time.time()
    specs = json.load(open(os.path.join(DIR, "views.json")))
    states = {s["state"]: State(s["state"]) for s in specs}
    views = [View(s, states) for s in specs]
    prev = os.path.join(DIR, "fit.json")
    x0 = np.array(json.load(open(prev))["x"]) if os.path.exists(prev) else \
        np.array([0.0, 30.0, 50.0, np.log(0.3), np.log(0.6), np.log(0.3), np.log(0.4), np.log(0.1), np.log(0.3), np.log(0.1)])
    print("aligning frames", flush=True)
    for v in views:
        v.align(env_of(x0))
    preset = {k: next(iter(states.values())).head["env"][k] for k in ("lightDir", "lightDiffuse", "lightSpecular", "ambientSh", "reflection")}
    before = {v.t: round(v.loss(preset), 6) for v in views}
    fitted = [v for v in views if not v.spec.get("holdOut")]
    held = [v for v in views if v.spec.get("holdOut")]
    report = {"before": before}
    if held:
        x, _ = fit(fitted, [x0, np.array([0.0, 30.0, 50.0, np.log(0.1), np.log(0.5), 0, 0, np.log(0.3), 0, np.log(0.3)])])
        report["heldOut"] = {v.t: round(v.loss(env_of(x)), 6) for v in held}
        print("held-out views:", report["heldOut"], "before:", {v.t: before[v.t] for v in held}, flush=True)
        x0 = x
    x, val = fit(views, [x0])
    env = env_of(x)
    report["after"] = {v.t: round(v.loss(env), 6) for v in views}
    print(f"per view before {before}\n         after  {report['after']}\n{time.time() - t0:.0f}s", flush=True)
    json.dump({"x": x.tolist(), "env": env, "report": report, "align": {v.t: [v.zoom, v.dx, v.dy, v.yaw] for v in views}},
              open(prev, "w"), indent=1)

    # video frame | preset before | fitted, full resolution, cropped round the figure
    rows = []
    for v in views:
        ref = v.ref_image(1728, 1080)
        old = Image.fromarray(v.st.render(preset, v.yaw, 1728, 1080))
        new = Image.fromarray(v.st.render(env, v.yaw, 1728, 1080))
        m = np.asarray(new).astype(int)
        cols = np.where(np.abs(m - m[2, 2]).max(axis=2).max(axis=0) > 6)[0]
        cx = (cols[0] + cols[-1]) // 2 if len(cols) else 864
        box = (max(0, cx - 300), 0, max(0, cx - 300) + 600, 1080)
        rows.append([im.crop(box) for im in (ref, old, new)])
    out = Image.new("RGB", (1840, 60 + 1090 * len(rows)), (24, 26, 31))
    d = ImageDraw.Draw(out)
    for i, label in enumerate(("in game", "viewer: preset before", "viewer: fitted")):
        d.text((30 + i * 610, 20), label, fill=(230, 230, 230))
    for r, row in enumerate(rows):
        for c, im in enumerate(row):
            out.paste(im, (10 + c * 610, 60 + r * 1090))
    out.resize((out.width // 2, out.height // 2), Image.LANCZOS).save(os.path.join(DIR, "compare.png"))
    print(json.dumps(env))


if __name__ == "__main__":
    main()
