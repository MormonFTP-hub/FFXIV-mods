"""Insta Viewer as a desktop app (the entry point of "Insta Viewer.exe").

Starts the local server and opens it in an Edge app window (its own window, no tabs or address bar); closing that
window quits everything. Without Edge it opens the default browser and shows a small window with a Quit button.
A link given on the command line opens straight away; a second launch reuses the running viewer.

    "Insta Viewer.exe" [instagram link] [--serve-only] [--port N]
"""
import json
import os
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
import webbrowser
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app  # noqa: E402

PORT = 8771
EDGE = [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"]


def log_to_file():
    """A windowed exe has no console: send prints and tracebacks to the data folder."""
    if sys.stdout is None or app.FROZEN:
        f = open(os.path.join(app.LOCAL, "instaviewer.log"), "a", encoding="utf-8", buffering=1)
        sys.stdout = sys.stderr = f
        print(f"\n--- {time.strftime('%Y-%m-%d %H:%M:%S')} Insta Viewer starting")


def running_viewer(port):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/info", timeout=1.5) as r:
            return json.load(r).get("app") == "Insta Viewer"
    except Exception:     # noqa: BLE001
        return False


def start_server(port):
    for p in [port] + list(range(port + 1, port + 20)):
        try:
            srv = ThreadingHTTPServer(("127.0.0.1", p), app.Handler)
        except OSError:
            continue
        srv.daemon_threads = True
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        return srv, p
    raise RuntimeError("no free port for the viewer")


def page(port, link):
    url = f"http://127.0.0.1:{port}/index.html"
    return url + ("#/open/" + urllib.parse.quote(link, safe="") if link else "")


def open_window(url):
    """Edge app window with its own profile, so the process lives exactly as long as the window."""
    edge = next((e for e in EDGE if os.path.exists(e)), None)
    if not edge:
        return None
    profile = os.path.join(app.LOCAL, "window")
    cmd = [edge, f"--app={url}", f"--user-data-dir={profile}", "--no-first-run", "--no-default-browser-check",
           "--window-size=1600,1000", "--autoplay-policy=no-user-gesture-required"]
    if app.read_settings().get("theme", "dark") == "dark":
        cmd.append("--force-dark-mode")          # dark title bar and scrollbars even when Windows is in light mode
    return subprocess.Popen(cmd)


def control_window(url, on_quit):
    """Fallback when there is no Edge: the page in the default browser, and a tiny window to stop the viewer."""
    webbrowser.open(url)
    import tkinter as tk
    root = tk.Tk()
    root.title("Insta Viewer")
    root.resizable(False, False)
    tk.Label(root, text="Insta Viewer is running at", padx=16, pady=10).pack()
    tk.Label(root, text=url.split("/index.html")[0], fg="#2463b5", cursor="hand2").pack()
    row = tk.Frame(root, pady=10)
    row.pack()
    tk.Button(row, text="Open", width=10, command=lambda: webbrowser.open(url)).pack(side="left", padx=4)
    tk.Button(row, text="Quit", width=10, command=root.destroy).pack(side="left", padx=4)
    root.mainloop()
    on_quit()


def watch(win):
    """Wait until the viewer window is closed: normally the end of the Edge process. When Edge hands the window
    to another of its processes (it exits within seconds), the page's heartbeat decides: /api/ping every 2 s and
    /api/bye on close. Returns False if no page ever connected."""
    t0 = time.time()
    while win.poll() is None:
        time.sleep(1)
    if time.time() - t0 > 5:
        return True
    print("Edge handed the window to another process; following the page's heartbeat", flush=True)
    while True:
        time.sleep(1)
        age, bye = app.heartbeat()
        if age is None:
            if time.time() - t0 > 90:
                return False
            continue
        if age > (4 if bye else 150):        # hidden windows throttle timers to about once a minute
            return True


def main():
    args = sys.argv[1:]
    serve_only = "--serve-only" in args
    port = PORT
    if "--port" in args:
        port = int(args[args.index("--port") + 1])
    link = next((a for a in args if "instagr" in a.lower() or a.startswith("@")), None)
    log_to_file()

    if not serve_only and running_viewer(port):          # already open: just show another window
        url = page(port, link)
        if not open_window(url):
            webbrowser.open(url)
        return

    srv, port = start_server(port)
    threading.Thread(target=app.clean_share, daemon=True).start()
    url = page(port, link)
    print(f"Insta Viewer on {url}", flush=True)
    if serve_only:
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            srv.shutdown()
        return
    win = open_window(url)
    if win is None or not watch(win):
        print("no viewer window connected; showing the control window", flush=True)
        control_window(url, srv.shutdown)
        return
    srv.shutdown()


if __name__ == "__main__":
    main()
