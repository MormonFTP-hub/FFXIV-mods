"""Send JavaScript to the tiger copy of wow.export (see apps/wow.export/src/rc.js).

usage: python wowrc.py "<js body>"   or   python wowrc.py -f script.js
The body runs as an async function with `rc` (rc.core, rc.app) in scope; `return` a value.
"""
import json
import sys
import urllib.request


def run(js, timeout=600):
    req = urllib.request.Request("http://127.0.0.1:9334/", data=js.encode(), method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


if __name__ == "__main__":
    src = open(sys.argv[2], encoding="utf-8").read() if sys.argv[1] == "-f" else sys.argv[1]
    out = run(src)
    print(out["value"] if out["ok"] else "ERROR " + out["error"])
