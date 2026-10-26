"""Game data access for the viewer: one long-running xivserve process (Lumina + Penumbra's file readers) and
content-hashed caches of parsed models, materials and decoded textures under work/."""
import hashlib
import json
import os
import struct
import subprocess
import sys
import threading
import time
import zipfile

import numpy as np
from PIL import Image

FROZEN = getattr(sys, "frozen", False)                             # running as "PMP Viewer.exe"
SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # the PmpViewer folder (source layout)
RES = getattr(sys, "_MEIPASS", SRC)                                # read-only files: viewer/ (and xivserve.zip in the exe)
ROOT = os.path.dirname(os.path.abspath(sys.executable)) if FROZEN else SRC
LOCAL = os.path.join(os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), "PmpViewer")


def _writable(d):
    try:
        os.makedirs(d, exist_ok=True)
        probe = os.path.join(d, ".probe")
        open(probe, "w").close()
        os.remove(probe)
        return True
    except OSError:
        return False


WORK = os.path.join(ROOT, "work") if _writable(os.path.join(ROOT, "work")) else os.path.join(LOCAL, "work")
GAME = os.path.join(WORK, "game")
CACHE = os.path.join(WORK, "cache")


def _xivserve():
    """The helper exe. From source: apps/xivserve. In the exe: unpacked once per version into %LOCALAPPDATA%."""
    if os.environ.get("PMPVIEWER_XIVSERVE"):          # testing a staged helper
        return os.environ["PMPVIEWER_XIVSERVE"]
    if not FROZEN:
        return os.path.join(SRC, "apps", "xivserve", "xivserve.exe")
    z = os.path.join(RES, "xivserve.zip")
    h = hashlib.sha1(open(z, "rb").read()).hexdigest()[:12]
    dst = os.path.join(LOCAL, "xivserve", h)
    if not os.path.exists(os.path.join(dst, "xivserve.exe")):
        tmp = dst + f".part{os.getpid()}"
        zipfile.ZipFile(z).extractall(tmp)
        try:
            os.replace(tmp, dst)
        except OSError:           # another instance got there first
            pass
    return os.path.join(dst, "xivserve.exe")


def _xivrender():
    """The game-shader renderer (D3D11, runs the game's own .shpk/.shcd shaders). From source: apps/xivrender."""
    if os.environ.get("PMPVIEWER_XIVRENDER"):
        return os.environ["PMPVIEWER_XIVRENDER"]
    if not FROZEN:
        return os.path.join(SRC, "apps", "xivrender", "xivrender.exe")
    z = os.path.join(RES, "xivrender.zip")
    h = hashlib.sha1(open(z, "rb").read()).hexdigest()[:12]
    dst = os.path.join(LOCAL, "xivrender", h)
    if not os.path.exists(os.path.join(dst, "xivrender.exe")):
        tmp = dst + f".part{os.getpid()}"
        zipfile.ZipFile(z).extractall(tmp)
        try:
            os.replace(tmp, dst)
        except OSError:
            pass
    return os.path.join(dst, "xivrender.exe")


class XivRender:
    """One xivrender process serving frames over HTTP on a local port; the page talks to it directly."""

    def __init__(self):
        self.proc, self.port, self.lock = None, None, threading.Lock()

    def ensure(self):
        with self.lock:
            if self.proc is not None and self.proc.poll() is None and self.port:
                return self.port
            log = open(os.path.join(WORK, "xivrender.log"), "a", encoding="utf-8")
            self.proc = subprocess.Popen([_xivrender(), sqpack(), "--serve", "0", "--parent", str(os.getpid())], stdout=subprocess.PIPE, stderr=log,
                                         stdin=subprocess.DEVNULL, text=True, encoding="utf-8", bufsize=1,
                                         creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            deadline = time.time() + 60
            while time.time() < deadline:
                line = self.proc.stdout.readline()
                if not line:
                    break
                if line.startswith("PORT "):
                    self.port = int(line.split()[1])
                    return self.port
            raise RuntimeError("xivrender did not start (see work/xivrender.log)")

    def close(self):
        if self.proc and self.proc.poll() is None:
            self.proc.kill()


RENDER = XivRender()


def sqpack():
    """The game's sqpack folder: PMPVIEWER_SQPACK, XIVLauncher's GamePath, then the usual install folders."""
    cands = [os.environ.get("PMPVIEWER_SQPACK")]
    try:
        cfg = json.load(open(os.path.join(os.environ.get("APPDATA", ""), "XIVLauncher", "launcherConfigV3.json"),
                             encoding="utf-8-sig"))
        if cfg.get("GamePath"):
            cands.append(os.path.join(cfg["GamePath"], "game", "sqpack"))
    except (OSError, ValueError):
        pass
    for base in (r"C:\Program Files (x86)\SquareEnix\FINAL FANTASY XIV - A Realm Reborn",
                 r"C:\Program Files (x86)\Steam\steamapps\common\FINAL FANTASY XIV Online",
                 r"C:\Program Files (x86)\Steam\steamapps\common\FINAL FANTASY XIV - A Realm Reborn"):
        cands.append(os.path.join(base, "game", "sqpack"))
    for c in cands:
        if c and os.path.isdir(os.path.join(c, "ffxiv")):
            return c
    raise RuntimeError("FFXIV's game folder wasn't found (looked at XIVLauncher's GamePath and the usual install "
                       "folders). Set PMPVIEWER_SQPACK to ...\\game\\sqpack.")


class XivServe:
    def __init__(self):
        self.proc = None
        self.lock = threading.Lock()

    def _start(self):
        self.proc = subprocess.Popen([_xivserve(), sqpack()], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.DEVNULL, text=True, encoding="utf-8", bufsize=1,
                                     creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        hello = self.proc.stdout.readline()
        if "ready" not in hello:
            raise RuntimeError("xivserve did not start: " + hello)

    def call(self, op, **kw):
        with self.lock:
            if self.proc is None or self.proc.poll() is not None:
                self._start()
            self.proc.stdin.write(json.dumps({"op": op, **kw}) + "\n")
            self.proc.stdin.flush()
            out = json.loads(self.proc.stdout.readline())
        if isinstance(out, dict) and "error" in out:
            raise RuntimeError(f"xivserve {op}: {out['error']}")
        return out

    def close(self):
        if self.proc and self.proc.poll() is None:
            try:
                self.proc.stdin.close()        # the helper exits at end of input
                self.proc.wait(5)
            except Exception:                  # noqa: BLE001
                self.proc.kill()


SERVE = XivServe()
_exists = {}


def extract(*paths):
    """Local copies of game files (None where the game has no such file)."""
    want = [p for p in paths if p not in _exists]
    for i in range(0, len(want), 200):
        got = SERVE.call("extract", dir=GAME, paths=want[i:i + 200])["files"]
        _exists.update(got)
    return [_exists[p] for p in paths]


def exists(*paths):
    """Whether the game has each file, without reading it."""
    want = [p for p in paths if p not in _exists and p not in _known]
    for i in range(0, len(want), 500):
        _known.update(SERVE.call("exists", paths=want[i:i + 500])["exists"])
    return [(_exists[p] is not None) if p in _exists else _known[p] for p in paths]


_known = {}


def game_file(path):
    return extract(path)[0]


def write_json(path, obj):
    """Write a cache file under a temporary name, then rename it: readers never see half a file. On Windows the
    rename is refused (access denied) while another thread has the old file open, so retry briefly, then keep the
    file that is there: it is only a cache, and the caller already has the data."""
    tmp = f"{path}.{os.getpid()}.{threading.get_ident()}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f)
    for _ in range(40):
        try:
            os.replace(tmp, path)
            return
        except PermissionError:
            time.sleep(0.05)
    try:
        os.remove(tmp)
    except OSError:
        pass


def read_json(path):
    """A cache file, or None when it is missing or unreadable (it is then simply rebuilt)."""
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


_locks, _locks_guard = {}, threading.Lock()


def lock_for(key):
    """One lock per cache entry, so threads sharing a texture or material build it once."""
    with _locks_guard:
        return _locks.setdefault(key, threading.Lock())


def file_hash(path):
    st = os.stat(path)
    key = f"{os.path.abspath(path)}|{st.st_size}|{st.st_mtime_ns}"
    return hashlib.sha1(key.encode()).hexdigest()[:16]


def _cache(name):
    os.makedirs(CACHE, exist_ok=True)
    return os.path.join(CACHE, name)


_models = {}


def model(local):
    """LOD0 of a .mdl: header dict plus per-mesh numpy arrays."""
    h = file_hash(local)
    if h in _models:
        return _models[h]
    binp, jsp = _cache(h + ".mdl2.bin"), _cache(h + ".mdl2.json")      # mdl2: with per-set vertex colour means
    # one parse per model at a time: two loads parsing the same model raced on one .part file and on the rename
    # ("Permission denied" while the other thread read the .bin), and the model then failed to load
    with lock_for("mdl:" + h):
        if h in _models:
            return _models[h]
        hdr = read_json(jsp) if os.path.exists(binp) else None
        if hdr is None:
            part = f"{binp}.{os.getpid()}.{threading.get_ident()}.part"
            hdr = SERVE.call("mdl", file=os.path.abspath(local), out=part)
            for _ in range(40):
                try:
                    os.replace(part, binp)
                    break
                except PermissionError:
                    time.sleep(0.05)
            else:
                binp = part         # the cache file stays locked: read this parse's own copy
            write_json(jsp, hdr)
        raw = open(binp, "rb").read()
        for m in hdr["meshes"]:
            n, ni = m["vertexCount"], m["indexCount"]
            m["pos"] = np.frombuffer(raw, np.float32, n * 3, m["pos"]).reshape(n, 3)
            m["nrm"] = np.frombuffer(raw, np.float32, n * 3, m["nrm"]).reshape(n, 3)
            m["uv"] = np.frombuffer(raw, np.float32, n * 4, m["uv"]).reshape(n, 4)
            m["col"] = np.frombuffer(raw, np.uint8, n * 4, m["col"]).reshape(n, 4)
            m["bi"] = np.frombuffer(raw, np.uint16, n * 8, m["bi"]).reshape(n, 8)
            m["bw"] = np.frombuffer(raw, np.float32, n * 8, m["bw"]).reshape(n, 8)
            m["idx"] = np.frombuffer(raw, np.uint32, ni, m["idx"])
        for s in hdr["shapes"]:
            for p in s["parts"]:
                p["values"] = np.frombuffer(raw, np.uint32, p["count"] * 2, p["at"]).reshape(-1, 2)
        _models[h] = hdr
    return hdr


_mtrls = {}


def material(local):
    h = file_hash(local)
    if h not in _mtrls:
        p = _cache(h + ".mtrl.json")
        m = read_json(p)
        if m is None:
            m = SERVE.call("mtrl", file=os.path.abspath(local))
            write_json(p, m)
        _mtrls[h] = m
    return _mtrls[h]


# .tex formats Pillow's native BCn decoder handles (checked against Lumina's decode): format -> (mode, n)
BCN = {0x3420: ("RGBA", 1), 0x3430: ("RGBA", 2), 0x3431: ("RGBA", 3), 0x6120: ("L", 4), 0x6230: ("RGB", 5),
       0x6432: ("RGBA", 7)}


def _decode_tex(local):
    d = open(local, "rb").read()
    fmt, w, h = struct.unpack_from("<IHH", d, 4)
    off = struct.unpack_from("<I", d, 28)[0]
    if fmt in BCN:
        mode, n = BCN[fmt]
        return np.asarray(Image.frombytes(mode, (w, h), d[off:], "bcn", n).convert("RGBA"))
    if fmt in (0x1450, 0x1451):          # B8G8R8A8 / B8G8R8X8
        a = np.frombuffer(d, np.uint8, w * h * 4, off).reshape(h, w, 4)[..., [2, 1, 0, 3]].copy()
        if fmt == 0x1451:
            a[..., 3] = 255
        return a
    return None


_tex_locks, _tex_guard = {}, threading.Lock()


def texture(local):
    """Top mip as an (H, W, 4) uint8 RGBA array."""
    h = file_hash(local)
    p = _cache(h + ".tex.npy")
    with _tex_guard:
        lock = _tex_locks.setdefault(h, threading.Lock())
    with lock:
        if not os.path.exists(p):
            _decode_to(local, h, p)
    return np.load(p)


def _decode_to(local, h, p):
    """Decode a .tex into the .npy cache; written under a temporary name so readers never see half a file."""
    try:
        a = _decode_tex(local)
    except Exception:     # noqa: BLE001  (Lumina below gets the final say)
        a = None
    if a is None:
        raw = _cache(h + ".tex.raw")
        info = SERVE.call("tex", file=os.path.abspath(local), out=raw)
        a = np.fromfile(raw, np.uint8).reshape(info["h"], info["w"], 4)
        os.remove(raw)
    tmp = p[:-4] + f".{threading.get_ident()}.tmp.npy"
    np.save(tmp, a)
    os.replace(tmp, p)


_items = None


def items():
    global _items
    if _items is None:
        p = _cache("items.json")
        if not os.path.exists(p):
            SERVE.call("items", out=p)
        _items = json.load(open(p, encoding="utf-8"))
    return _items


def manips_loaded(manips):
    return SERVE.call("manips", json=manips)
