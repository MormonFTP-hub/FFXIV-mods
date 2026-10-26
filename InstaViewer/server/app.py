"""Insta Viewer's local server: the page in web/, Instagram lookups, history, saving media.

    python -P -E server/app.py [--port 8771]
"""
import argparse
import ctypes
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import embeds  # noqa: E402
import ig  # noqa: E402

FROZEN = getattr(sys, "frozen", False)
SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(getattr(sys, "_MEIPASS", SRC), "web")
# From source, data stays in work/: the Microsoft Store Python redirects its AppData writes to a private folder that
# ffmpeg (a normal program) can't see.
LOCAL = (os.path.join(os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), "InstaViewer") if FROZEN
         else os.path.join(SRC, "work"))
THUMBS = os.path.join(LOCAL, "thumbs")
HD = os.path.join(LOCAL, "hd")
SHARE = os.path.join(LOCAL, "share")         # files copied for pasting into Discord
HISTORY = os.path.join(LOCAL, "history.json")
SETTINGS = os.path.join(LOCAL, "settings.json")
for d in (THUMBS, HD, SHARE):
    os.makedirs(d, exist_ok=True)
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css",
         ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".ico": "image/x-icon"}
NO_WINDOW = 0x08000000 if os.name == "nt" else 0

_hist_lock = threading.Lock()
_hd_jobs, _hd_lock = {}, threading.Lock()
_ping = {"t": None, "bye": False}


def heartbeat():
    return (None if _ping["t"] is None else time.time() - _ping["t"]), _ping["bye"]


def downloads_dir():
    """The user's Downloads folder (wherever they moved it), plus an Instagram subfolder. INSTAVIEWER_SAVE_DIR
    overrides it (tests)."""
    if os.environ.get("INSTAVIEWER_SAVE_DIR"):
        os.makedirs(os.environ["INSTAVIEWER_SAVE_DIR"], exist_ok=True)
        return os.environ["INSTAVIEWER_SAVE_DIR"]
    base = os.path.join(os.path.expanduser("~"), "Downloads")
    if os.name == "nt":
        try:
            from ctypes import wintypes

            class GUID(ctypes.Structure):
                _fields_ = [("a", wintypes.DWORD), ("b", wintypes.WORD), ("c", wintypes.WORD), ("d", ctypes.c_ubyte * 8)]
            g = GUID(0x374DE290, 0x123F, 0x4565, (ctypes.c_ubyte * 8)(0x91, 0x64, 0x39, 0xC4, 0x92, 0x5E, 0x46, 0x7B))
            p = ctypes.c_wchar_p()
            if ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(g), 0, None, ctypes.byref(p)) == 0:
                base = p.value
                ctypes.windll.ole32.CoTaskMemFree(p)
        except Exception:     # noqa: BLE001
            pass
    d = os.path.join(base, "Instagram")
    os.makedirs(d, exist_ok=True)
    return d


def clipboard_text():
    if os.name != "nt":
        return ""
    u32, k32 = ctypes.windll.user32, ctypes.windll.kernel32
    u32.GetClipboardData.restype = ctypes.c_void_p
    k32.GlobalLock.restype = ctypes.c_void_p
    k32.GlobalLock.argtypes = k32.GlobalUnlock.argtypes = [ctypes.c_void_p]
    for _ in range(3):
        if u32.OpenClipboard(None):
            break
        time.sleep(0.03)
    else:
        return ""
    try:
        if not u32.IsClipboardFormatAvailable(13):
            return ""
        h = u32.GetClipboardData(13)          # CF_UNICODETEXT
        if not h:
            return ""
        p = k32.GlobalLock(h)
        try:
            return ctypes.wstring_at(p)[:2000] if p else ""
        finally:
            k32.GlobalUnlock(h)
    finally:
        u32.CloseClipboard()


_clip = {"seq": None, "text": "", "thread": None}


def clipboard_cached():
    """The clipboard text as last read by a background thread. Reading can block for as long as the app that owns
    the clipboard takes to render it, so requests never read it themselves (they used to pile up and use every
    browser connection to the server); the thread only reads again when the clipboard sequence number changes."""
    if os.name != "nt":
        return ""
    if _clip["thread"] is None:
        def watch():
            while True:
                try:
                    seq = ctypes.windll.user32.GetClipboardSequenceNumber()
                    if seq != _clip["seq"]:
                        _clip["text"] = clipboard_text()
                        _clip["seq"] = seq
                except Exception:     # noqa: BLE001
                    pass
                time.sleep(0.7)
        _clip["thread"] = threading.Thread(target=watch, daemon=True)
        _clip["thread"].start()
    return _clip["text"]


def ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    winget = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Links", "ffmpeg.exe")
    return winget if os.path.exists(winget) else None


def read_settings():
    try:
        with open(SETTINGS, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def write_settings(changes):
    with _hist_lock:
        s = {**read_settings(), **changes}
        with open(SETTINGS + ".tmp", "w", encoding="utf-8") as f:
            json.dump(s, f)
        os.replace(SETTINGS + ".tmp", SETTINGS)
        return s


# ---------------------------------------------------------------- history

def read_history():
    try:
        with open(HISTORY, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return []


def write_history(items):
    tmp = HISTORY + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False)
    os.replace(tmp, HISTORY)


def thumb_name(key):
    return hashlib.sha1(key.encode()).hexdigest()[:16] + ".jpg"


def remember(entry, thumb_url):
    """Put an opened post/profile at the top of the history and keep a local copy of its thumbnail (CDN links expire)."""
    name = thumb_name(entry["key"])
    entry = {**entry, "thumb": name, "t": time.time()}
    with _hist_lock:
        items = [e for e in read_history() if e.get("key") != entry["key"]]
        items.insert(0, entry)
        write_history(items[:400])
    path = os.path.join(THUMBS, name)
    if thumb_url and not os.path.exists(path):
        def fetch():
            try:
                ig.download(thumb_url, path + ".part")
                os.replace(path + ".part", path)
            except Exception as e:     # noqa: BLE001
                print("thumb failed:", e, flush=True)
        threading.Thread(target=fetch, daemon=True).start()


def remember_post(p):
    first = p["items"][0] if p["items"] else {}
    remember({"key": "p:" + p["code"], "kind": "post", "code": p["code"], "type": p["type"], "product": p["product"],
              "title": p["user"]["username"] if p.get("user") else p["code"],
              "sub": " ".join(p["caption"].split())[:120], "count": len(p["items"])},
             first.get("thumb") or first.get("image"))


def remember_profile(u):
    remember({"key": "u:" + u["username"].lower(), "kind": "profile", "username": u["username"],
              "title": u["username"], "sub": u["name"] or "Profile", "verified": u["verified"]}, u.get("avatar"))


# ---------------------------------------------------------------- saving

def safe(s):
    return "".join(c if c.isalnum() or c in "._-" else "_" for c in s)[:80]


def hd_file(code, i):
    return os.path.join(HD, f"{safe(code)}_{i}.mp4")


def build_hd(code, i):
    """Merge the best DASH video and audio tracks of item i into one mp4 (stream copy, no re-encode)."""
    out = hd_file(code, i)
    if os.path.exists(out):
        return out
    it = ig.post(code)["items"][i]
    dash, exe = it.get("hd"), ffmpeg()
    if not dash or not exe:
        return None
    tmp = tempfile.mkdtemp(prefix="iv_", dir=HD)
    try:
        v = ig.download(dash["video"]["url"], os.path.join(tmp, "v.mp4"))
        cmd = [exe, "-v", "error", "-y", "-i", v]
        if dash.get("audio") and it.get("audio", True):
            cmd += ["-i", ig.download(dash["audio"]["url"], os.path.join(tmp, "a.mp4")), "-map", "0:v:0", "-map", "1:a:0"]
        part = os.path.join(tmp, "out.mp4")
        subprocess.run(cmd + ["-c", "copy", "-movflags", "+faststart", part], check=True, capture_output=True,
                       creationflags=NO_WINDOW, timeout=600)
        os.replace(part, out)
        return out
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def hd_status(code, i):
    """'ready' / 'building' / 'failed' / 'none'; starts building on first ask."""
    if os.path.exists(hd_file(code, i)):
        return "ready"
    key = (code, i)
    with _hd_lock:
        job = _hd_jobs.get(key)
        if job is None:
            p = ig.post(code)
            if i >= len(p["items"]) or not p["items"][i].get("hd") or not ffmpeg():
                return "none"
            job = _hd_jobs[key] = {"state": "building"}

            def run():
                try:
                    job["state"] = "ready" if build_hd(code, i) else "none"
                except Exception as e:     # noqa: BLE001
                    print("hd failed:", code, i, e, flush=True)
                    job["state"] = "failed"
            threading.Thread(target=run, daemon=True).start()
        return job["state"]


def save(code, which):
    p = ig.post(code)
    folder = downloads_dir()
    user = safe(p["user"]["username"]) if p.get("user") else "instagram"
    idx = range(len(p["items"])) if which == "all" else [int(which)]
    files = []
    for i in idx:
        it = p["items"][i]
        suffix = f"_{i + 1}" if len(p["items"]) > 1 else ""
        base = os.path.join(folder, f"{user}_{safe(p['code'])}{suffix}")
        if it["kind"] == "video":
            dst = base + ".mp4"
            hd = None
            try:
                hd = build_hd(code, i) if it.get("hd") and ffmpeg() else None
            except Exception as e:     # noqa: BLE001
                print("hd save failed, using the plain mp4:", e, flush=True)
            if hd:
                shutil.copyfile(hd, dst)
            else:
                ig.download(it["video"], dst + ".part")
                os.replace(dst + ".part", dst)
        else:
            dst = base + ".jpg"
            ig.download(it["image"], dst + ".part")
            os.replace(dst + ".part", dst)
        stamp = p.get("taken_at")
        if stamp:
            os.utime(dst, (stamp, stamp))
        files.append(dst)
    return {"files": files, "folder": folder}


# ---------------------------------------------------------------- Discord

DISCORD_LIMIT = 10 * 1000 * 1000      # Discord's upload limit without Nitro (10 MB)


def clipboard_put(entries):
    """Replace the clipboard with [(format, bytes)]. SetClipboardData needs a clipboard owner, hence the hidden
    message-only window. Done here rather than in the page, which may have lost its user activation by the time a
    slow lookup returns."""
    from ctypes import wintypes
    u32, k32 = ctypes.windll.user32, ctypes.windll.kernel32
    k32.GlobalAlloc.restype = k32.GlobalLock.restype = ctypes.c_void_p
    k32.GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]
    k32.GlobalLock.argtypes = k32.GlobalUnlock.argtypes = [ctypes.c_void_p]
    u32.SetClipboardData.argtypes = [wintypes.UINT, ctypes.c_void_p]
    u32.SetClipboardData.restype = ctypes.c_void_p
    u32.CreateWindowExW.restype = ctypes.c_void_p
    u32.CreateWindowExW.argtypes = [wintypes.DWORD, wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.DWORD, ctypes.c_int,
                                    ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p,
                                    ctypes.c_void_p, ctypes.c_void_p]
    u32.OpenClipboard.argtypes = u32.DestroyWindow.argtypes = [ctypes.c_void_p]

    def global_bytes(data):
        h = k32.GlobalAlloc(0x0042, len(data))       # GMEM_MOVEABLE | GMEM_ZEROINIT
        ctypes.memmove(k32.GlobalLock(h), data, len(data))
        k32.GlobalUnlock(h)
        return h

    hwnd = u32.CreateWindowExW(0, "STATIC", "InstaViewerClipboard", 0, 0, 0, 0, 0, ctypes.c_void_p(-3), None, None, None)
    try:
        for _ in range(10):
            if u32.OpenClipboard(hwnd):
                break
            time.sleep(0.05)
        else:
            raise RuntimeError("another program is holding the clipboard")
        try:
            u32.EmptyClipboard()
            for fmt, data in entries:
                if isinstance(fmt, str):
                    fmt = u32.RegisterClipboardFormatW(fmt)
                if not u32.SetClipboardData(fmt, global_bytes(data)):
                    raise RuntimeError("Windows refused the clipboard data")
        finally:
            u32.CloseClipboard()
    finally:
        u32.DestroyWindow(hwnd)


def clipboard_set_text(text):
    clipboard_put([(13, (text + "\0").encode("utf-16-le"))])                  # CF_UNICODETEXT


def clipboard_files(paths):
    """Files on the clipboard the way Explorer's Copy puts them (CF_HDROP), so Ctrl+V in Discord uploads them."""
    import struct
    drop = struct.pack("<IiiII", 20, 0, 0, 0, 1) + ("\0".join(os.path.abspath(p) for p in paths) + "\0\0").encode("utf-16-le")
    clipboard_put([(15, drop), ("Preferred DropEffect", struct.pack("<I", 1))])   # DROPEFFECT_COPY


def share_file(code, i):
    """The item as a file for Discord: the 1080p video if it fits under the upload limit, else the plain one."""
    p = ig.post(code)
    it = p["items"][i]
    user = safe(p["user"]["username"]) if p.get("user") else "instagram"
    base = os.path.join(SHARE, f"{user}_{safe(p['code'])}" + (f"_{i + 1}" if len(p["items"]) > 1 else ""))
    if it["kind"] != "video":
        dst = base + ".jpg"
        if not os.path.exists(dst):
            ig.download(it["image"], dst + ".part")
            os.replace(dst + ".part", dst)
        return {"path": dst, "size": os.path.getsize(dst), "quality": "photo"}
    hd = None
    try:
        hd = build_hd(code, i) if it.get("hd") and ffmpeg() else None
    except Exception as e:     # noqa: BLE001
        print("hd for discord failed, using the plain mp4:", e, flush=True)
    if hd and os.path.getsize(hd) <= DISCORD_LIMIT:
        dst, quality = base + ".mp4", f"{it.get('hd_p')}p"
        shutil.copyfile(hd, dst)
    else:
        dst, quality = base + ".mp4", "standard"
        ig.download(it["video"], dst + ".part")
        os.replace(dst + ".part", dst)
        if hd and os.path.getsize(dst) > os.path.getsize(hd):    # both too big: send the smaller one
            shutil.copyfile(hd, dst)
            quality = f"{it.get('hd_p')}p"
    return {"path": dst, "size": os.path.getsize(dst), "quality": quality}


def clean_share():
    """Files copied for Discord are only needed until they're pasted: drop the ones older than a day."""
    for n in os.listdir(SHARE):
        f = os.path.join(SHARE, n)
        try:
            if time.time() - os.path.getmtime(f) > 86400:
                os.remove(f)
        except OSError:
            pass


# ---------------------------------------------------------------- http

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass

    def send(self, body, ctype="application/json", status=200, cache=False):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "max-age=604800" if cache else "no-store")
        self.end_headers()
        self.wfile.write(body)

    def fail(self, e):
        if isinstance(e, ig.IGError):
            return self.send({"error": str(e), "kind": e.kind}, status=400)
        traceback.print_exc()
        self.send({"error": f"Something went wrong: {e}", "kind": "error"}, status=500)

    def file(self, path, cache=False):
        """A local file, with Range support so <video> can seek."""
        if not os.path.isfile(path):
            return self.send({"error": "not found"}, status=404)
        size = os.path.getsize(path)
        ctype = TYPES.get(os.path.splitext(path)[1].lower(), "application/octet-stream")
        rng = self.headers.get("Range")
        start, end = 0, size - 1
        if rng and rng.startswith("bytes="):
            a, _, b = rng[6:].split(",")[0].partition("-")
            if a:
                # open-ended video ranges come back in 8 MB pieces, so a paused <video> doesn't park a connection
                start, end = int(a), (int(b) if b else int(a) + (8 << 20) - 1)
            else:
                start = max(0, size - int(b))
            end = min(end, size - 1)
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Cache-Control", "max-age=604800" if cache else "no-cache")
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            left = end - start + 1
            try:
                while left > 0:
                    b = f.read(min(left, 1 << 16))
                    if not b:
                        break
                    self.wfile.write(b)
                    left -= len(b)
            except (ConnectionError, OSError):
                pass

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        try:
            if u.path == "/api/ping":
                _ping.update(t=time.time(), bye=False)
                return self.send({"ok": True})
            if u.path == "/api/info":
                return self.send({"ffmpeg": bool(ffmpeg()), "downloads": downloads_dir(), "app": "Insta Viewer",
                                  "embed_services": embeds.SERVICES})
            if u.path == "/api/open":
                t0 = time.time()
                r = ig.resolve(q.get("q", ""))
                print(f"open {r[:2]} ({time.time() - t0:.1f}s to resolve)", flush=True)
                if r[0] == "post":
                    p = ig.post(r[1], fresh=q.get("fresh") == "1")
                    remember_post(p)
                    return self.send({"kind": "post", "index": r[2], "post": ig.public(p)})
                prof = ig.profile(r[1], fresh=q.get("fresh") == "1")
                remember_profile(prof)
                return self.send({"kind": "profile", "profile": prof})
            if u.path == "/api/comments":
                return self.send(ig.comments(q["code"], q["after"]))
            if u.path == "/api/history":
                return self.send(read_history())
            if u.path == "/api/clipboard":
                t = clipboard_cached().strip()
                try:
                    r = ig.parse_link(t) if "instagr" in t.lower() else None
                except ig.IGError:
                    r = None
                return self.send({"text": t if r else "", "kind": r[0] if r else None})
            if u.path == "/api/discord/link":
                r = embeds.link(ig.post(q["code"]), int(q.get("i", 0)), q.get("service") or "auto")
                if q.get("copy") == "1":
                    clipboard_set_text(r["url"])
                return self.send(r)
            if u.path == "/api/discord/test":
                return self.send(embeds.test(ig.post(q["code"]), int(q.get("i", 0)), q["service"]))
            if u.path == "/api/hd":
                return self.send({"state": hd_status(q["code"], int(q.get("i", 0)))})
            if u.path.startswith("/hd/"):
                code, _, i = u.path[4:].rsplit(".", 1)[0].rpartition("_")
                return self.file(hd_file(code, int(i)))
            if u.path.startswith("/thumb/"):
                return self.file(os.path.join(THUMBS, os.path.basename(u.path)), cache=True)
            rel = unquote(u.path).lstrip("/") or "index.html"
            path = os.path.normpath(os.path.join(WEB, rel))
            if not path.startswith(os.path.normpath(WEB)) or not os.path.isfile(path):
                return self.send({"error": "not found"}, status=404)
            with open(path, "rb") as f:
                return self.send(f.read(), TYPES.get(os.path.splitext(path)[1], "application/octet-stream"))
        except Exception as e:     # noqa: BLE001
            return self.fail(e)

    def do_POST(self):
        u = urlparse(self.path)
        n = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"{}") if n else {}
        except ValueError:
            body = {}
        try:
            if u.path == "/api/bye":
                _ping["bye"] = True
                return self.send({"ok": True})
            if u.path == "/api/discord/file":
                r = share_file(body["code"], int(body.get("i", 0)))
                clipboard_files([r["path"]])
                return self.send({**r, "limit": DISCORD_LIMIT})
            if u.path == "/api/save":
                return self.send(save(body["code"], body.get("which", "0")))
            if u.path == "/api/reveal":
                path = body.get("path") or downloads_dir()
                if os.path.isfile(path):
                    subprocess.Popen(["explorer", "/select,", os.path.normpath(path)])
                elif os.path.isdir(path):
                    os.startfile(path)
                return self.send({"ok": True})
            if u.path == "/api/external":
                url = body.get("url", "")
                if url.startswith(("https://", "http://")):
                    webbrowser.open(url)
                return self.send({"ok": True})
            if u.path == "/api/settings":
                return self.send(write_settings({k: v for k, v in body.items() if k in ("theme",)}))
            if u.path == "/api/history/remove":
                with _hist_lock:
                    write_history([e for e in read_history() if e.get("key") != body.get("key")])
                return self.send({"ok": True})
            if u.path == "/api/history/clear":
                with _hist_lock:
                    write_history([])
                return self.send({"ok": True})
            return self.send({"error": "not found"}, status=404)
        except Exception as e:     # noqa: BLE001
            return self.fail(e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8771)
    a = ap.parse_args()
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    srv.daemon_threads = True
    print(f"Insta Viewer on http://127.0.0.1:{a.port}/", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
