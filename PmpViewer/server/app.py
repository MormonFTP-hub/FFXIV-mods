"""PMP viewer: a local web app that loads Penumbra mods the way the game would and shows the result in 3D.

    python -P -E server/app.py [--port 8765] [mod.pmp]
"""
import argparse
import atexit
import glob
import json
import os
import sys
import threading
import time
import traceback
import uuid
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anim  # noqa: E402
import base64  # noqa: E402
import collection  # noqa: E402
import customize  # noqa: E402
import skeleton as S  # noqa: E402
import game  # noqa: E402
import meta as M  # noqa: E402
import pmp  # noqa: E402
import resolve  # noqa: E402
import shade  # noqa: E402
import targets  # noqa: E402

VIEWER = os.path.join(game.RES, "viewer")
MOD_ROOTS = [os.path.dirname(game.ROOT)]          # E:\FFXIV-mods: every */out/*.pmp
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css",
         ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml"}

_mods, _blobs, _lock = {}, {}, threading.Lock()
_ping = {"t": None, "bye": False}     # last heartbeat from an open viewer page (the desktop app watches it)


def heartbeat():
    """(seconds since a viewer page last pinged or None, whether the last page said goodbye)"""
    return (None if _ping["t"] is None else time.time() - _ping["t"]), _ping["bye"]


def open_mod(path):
    path = os.path.abspath(path)
    st = os.stat(path)
    key = (path, st.st_mtime_ns)
    with _lock:
        if key not in _mods:
            try:
                _mods[key] = pmp.Mod(path)
            except zipfile.BadZipFile:
                raise RuntimeError(f"{os.path.basename(path)} is not a readable zip (is a build still writing it?)")
        return _mods[key]


def list_mods():
    out = []
    for root in MOD_ROOTS:
        for p in sorted(glob.glob(os.path.join(root, "*", "out", "*.pmp"))):
            out.append({"path": p, "name": os.path.splitext(os.path.basename(p))[0],
                        "project": os.path.basename(os.path.dirname(os.path.dirname(p))),
                        "mtime": os.path.getmtime(p)})
    return out


def api_open(q):
    mod = open_mod(q["path"])
    every = mod.everything()
    t = targets.scan(every)
    manips = {}
    for x in every.manips:
        manips[x["m"].get("Type")] = manips.get(x["m"].get("Type"), 0) + 1
    penumbra = {"inJson": 0, "loaded": 0, "bad": []}
    try:        # each option on its own, the way Penumbra reads them
        for c in [mod.default] + [o["container"] for g in mod.groups for o in g.options] + [c for g in mod.groups for c in g.containers]:
            if c.manips:
                r = game.manips_loaded(c.manips)
                penumbra["inJson"] += r["inJson"]
                penumbra["loaded"] += r["loaded"]
                if r["loaded"] != r["inJson"]:
                    penumbra["bad"].append(f"{c.label}: {r['loaded']} of {r['inJson']}")
    except Exception as e:     # noqa: BLE001
        penumbra = {"error": str(e)}
    return {"mod": mod.summary(), "settings": mod.default_settings(), "targets": t,
            "subject": targets.default_subject(t), "manipCounts": manips, "penumbraManips": penumbra,
            "files": [{"path": gp, "inner": f["inner"], "option": f["from"], "present": f["present"]}
                      for gp, f in sorted(every.files.items())],
            "swaps": [{"path": gp, "to": s["to"], "option": s["from"]} for gp, s in sorted(every.swaps.items())]}


def api_scene(q):
    t0 = time.time()
    resolved = None
    if q.get("path"):
        mod = open_mod(q["path"])
        resolved = mod.resolve({int(k): v for k, v in (q.get("settings") or {}).items()})
    spec = q.get("subject") or {"subject": "character"}
    if spec.get("collection"):        # the user's other enabled mods underneath, as in game
        resolved = collection.layered(resolved, q.get("path") or None) or resolved
    if spec.get("subject", "character") == "character":
        scene, blob = resolve.character(resolved, spec)
    else:
        scene, blob = resolve.creature(resolved, spec)
    bid = uuid.uuid4().hex
    with _lock:
        _blobs[bid] = blob
        while len(_blobs) > 8:
            _blobs.pop(next(iter(_blobs)))
    scene["blob"] = bid
    scene["blobSize"] = len(blob)
    scene["manips"] = [{"type": x["m"].get("Type"), "manip": x["m"].get("Manipulation"), "option": x["from"]}
                       for x in (resolved.manips if resolved else [])]
    scene["conflicts"] = resolved.conflicts if resolved else []
    scene["seconds"] = round(time.time() - t0, 2)
    return scene


def api_races_check(q):
    """The current gear on every race: which model each slot gets and from where (no textures)."""
    resolved = None
    if q.get("path"):
        resolved = open_mod(q["path"]).resolve({int(k): v for k, v in (q.get("settings") or {}).items()})
    base = dict(q.get("subject") or {})
    rows, slots = [], []
    for code, gender, race_name, label in M.RACES:
        spec = dict(base, race=code, face=1, hair=1, tail=1, ear=1)
        scene, _ = resolve.character(resolved, spec, dry=True)
        cells = {}
        for m in scene["models"]:
            tr = scene["trace"][m["trace"]]
            cells[m["slot"]] = {"source": m["source"], "request": m["request"], "modelRace": m["modelRace"],
                                "deformed": bool(m["modelRace"] and m["modelRace"] != code), "hidden": m["hidden"]}
            if m["slot"] not in slots:
                slots.append(m["slot"])
        for e in scene["trace"]:
            if e["kind"] == "model" and e["source"] == "missing" and e.get("slot") not in cells:
                cells[e["slot"]] = {"source": "missing", "request": e["request"], "modelRace": None, "deformed": False,
                                    "hidden": None}
                if e["slot"] not in slots:
                    slots.append(e["slot"])
        errs = [p for p in scene["problems"] if p["level"] == "error"]
        warns = [p for p in scene["problems"] if p["level"] == "warn"]
        rows.append({"code": code, "label": label, "slots": cells, "errors": len(errs), "warns": len(warns),
                     "first": (errs or warns or [{"text": ""}])[0]["text"][:160]})
    order = M.EQUIP + M.ACCES + ["face", "hair", "tail", "zear"]
    return {"rows": rows, "slots": sorted(slots, key=lambda x: order.index(x) if x in order else 99)}


_anim_json = {}


def api_anim(q):
    """A game animation for a race: per frame and track, translation xyz, rotation xyzw, scale xyz (float32)."""
    key = (q.get("race", "c0101"), q.get("kind", "idle"))
    if key not in _anim_json:
        a = anim.load(*key)
        names = [n for n, _, _ in S.load_sklb(game.game_file(a["skeleton"]))]
        _anim_json[key] = {"fps": a["fps"], "frames": int(a["frames"].shape[0]), "tracks": [names[i] for i in a["bones"]],
                           "race": a["race"], "name": a["name"],
                           "data": base64.b64encode(a["frames"].astype("<f4").tobytes()).decode()}
    return _anim_json[key]


def api_items(q):
    term = (q.get("q") or "").lower()
    slot = q.get("slot")
    out = []
    for it in game.items():
        cats = targets.SLOT_CAT.get(it["slot"])
        if not cats or (slot and slot not in cats and not (slot == "ril" and "rir" in cats)):
            continue
        if term and term not in it["name"].lower() and term != str(it["model"] & 0xFFFF):
            continue
        out.append({"id": it["id"], "name": it["name"], "slot": cats[0], "set": it["model"] & 0xFFFF,
                    "variant": (it["model"] >> 16) & 0xFFFF})
        if len(out) >= 60:
            break
    return out


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send(self, code, body, ctype="application/json", cache=False):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "max-age=86400" if cache else "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        try:
            if u.path == "/api/ping":
                _ping.update(t=time.time(), bye=False)
                return self.send(200, {"ok": True})
            if u.path == "/api/render_info":
                return self.send(200, {"port": game.RENDER.ensure()})
            if u.path == "/api/mods":
                return self.send(200, list_mods())
            if u.path == "/api/races":
                return self.send(200, [{"code": c, "gender": g, "race": r, "label": lab} for c, g, r, lab in M.RACES])
            if u.path == "/api/items":
                return self.send(200, api_items(q))
            if u.path == "/api/anim":
                return self.send(200, api_anim(q))
            if u.path == "/api/palette":
                race = q.get("race", "c0101")
                clan = int(q.get("clan") or customize.clans(race)[0])
                return self.send(200, customize.palettes(race, clan if clan in customize.clans(race) else customize.clans(race)[0]))
            if u.path.startswith("/api/blob/"):
                blob = _blobs.get(u.path.rsplit("/", 1)[1])
                return self.send(200, blob, "application/octet-stream") if blob else self.send(404, {"error": "gone"})
            if u.path.startswith("/baked/"):
                p = os.path.join(shade.BAKED, os.path.basename(unquote(u.path)))
                return self.send(200, open(p, "rb").read(), "image/png", cache=True) if os.path.exists(p) else self.send(404, "")
            rel = unquote(u.path).lstrip("/") or "index.html"
            p = os.path.normpath(os.path.join(VIEWER, rel))
            if p.startswith(VIEWER) and os.path.isfile(p):
                return self.send(200, open(p, "rb").read(), TYPES.get(os.path.splitext(p)[1], "application/octet-stream"),
                                 cache="vendor" in rel)
            return self.send(404, {"error": "not found"})
        except Exception as e:     # noqa: BLE001
            traceback.print_exc()
            return self.send(500, {"error": str(e)})

    def do_POST(self):
        u = urlparse(self.path)
        if u.path == "/api/bye":
            _ping["bye"] = True
            return self.send(200, {"ok": True})
        if u.path == "/api/capture":     # a game-shader frame saved from the page (gallery / documentation)
            name = "".join(c for c in os.path.basename(unquote(self.headers.get("X-File-Name", "capture.png"))) if c.isalnum() or c in "._- ")
            if not name.lower().endswith(".png"):
                return self.send(400, {"error": "png only"})
            dst = os.path.join(game.WORK, "captures", name)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, "wb") as f:
                f.write(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            return self.send(200, {"path": dst})
        if u.path == "/api/upload":      # a .pmp dropped on the page: keep a copy under work/uploads
            try:
                name = os.path.basename(unquote(self.headers.get("X-File-Name", "upload.pmp"))) or "upload.pmp"
                if not name.lower().endswith((".pmp", ".zip")):
                    return self.send(400, {"error": "drop a .pmp file"})
                dst = os.path.join(game.WORK, "uploads", name)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                with open(dst, "wb") as f:
                    f.write(self.rfile.read(int(self.headers.get("Content-Length", 0))))
                return self.send(200, {"path": dst})
            except Exception as e:     # noqa: BLE001
                return self.send(500, {"error": str(e)})
        try:
            q = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            if u.path == "/api/open":
                return self.send(200, api_open(q))
            if u.path == "/api/scene":
                return self.send(200, api_scene(q))
            if u.path == "/api/races_check":
                return self.send(200, api_races_check(q))
            if u.path == "/api/glamourer":
                return self.send(200, customize.from_glamourer(q.get("text", "")))
            return self.send(404, {"error": "not found"})
        except Exception as e:     # noqa: BLE001
            traceback.print_exc()
            return self.send(500, {"error": f"{type(e).__name__}: {e}", "trace": traceback.format_exc()[-2000:]})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("mod", nargs="?")
    a = ap.parse_args()
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    atexit.register(game.RENDER.close)
    # read the user's Penumbra collection now: listing every mod's files is slow on a cold disk
    threading.Thread(target=collection.lookup, args=("",), daemon=True).start()
    url = f"http://127.0.0.1:{a.port}/" + (f"?mod={a.mod}" if a.mod else "")
    print(f"PMP viewer on {url}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
