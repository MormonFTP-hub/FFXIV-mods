"""FFLogs' API (v2, GraphQL) for checking a fight's mechanics against real kills: where players stand, what hits whom,
the boss's HP. Needs an API client of your own (fflogs.com/api/clients: Create Client, not public) whose ID and
secret are in %USERPROFILE%/.fflogs/client.json as {"client_id": ..., "client_secret": ...}; that file is outside
the repo so the backup never pushes it. Answers are cached under work/fflogs/ (git-ignored).

  python BlackMageSim/tools/fflogs.py zones          # the raid zones and their encounters' ids
  python BlackMageSim/tools/fflogs.py query '{...}'  # any query, printed
Used as a module by tools/fflogs_m5s.py.
"""
import base64
import hashlib
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "work" / "fflogs"
KEYS = Path.home() / ".fflogs" / "client.json"
TOKEN_URL = "https://www.fflogs.com/oauth/token"
API_URL = "https://www.fflogs.com/api/v2/client"
_token = None


def token():
    """A client-credentials token, kept in work/fflogs/token.json until it expires."""
    global _token
    if _token:
        return _token
    CACHE.mkdir(parents=True, exist_ok=True)
    tf = CACHE / "token.json"
    if tf.exists():
        t = json.loads(tf.read_text())
        if t.get("expires", 0) > time.time() + 300:
            _token = t["access_token"]
            return _token
    k = json.loads(KEYS.read_text())
    auth = base64.b64encode(f"{k['client_id']}:{k['client_secret']}".encode()).decode()
    req = urllib.request.Request(TOKEN_URL, data=b"grant_type=client_credentials",
                                 headers={"Authorization": "Basic " + auth, "Content-Type": "application/x-www-form-urlencoded"})
    t = json.loads(urllib.request.urlopen(req, timeout=30).read())
    t["expires"] = time.time() + t.get("expires_in", 3600)
    tf.write_text(json.dumps(t))
    _token = t["access_token"]
    return _token


def query(q, variables=None, cache=True):
    """Run a GraphQL query; answers are cached by the query's text."""
    body = json.dumps({"query": q, "variables": variables or {}}).encode()
    cf = CACHE / (hashlib.sha1(body).hexdigest()[:20] + ".json")
    if cache and cf.exists():
        return json.loads(cf.read_text(encoding="utf-8"))
    req = urllib.request.Request(API_URL, data=body, headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json"})
    out = json.loads(urllib.request.urlopen(req, timeout=120).read())
    if out.get("errors"):
        raise RuntimeError(json.dumps(out["errors"])[:2000])
    CACHE.mkdir(parents=True, exist_ok=True)
    cf.write_text(json.dumps(out), encoding="utf-8")
    return out


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "zones"
    if cmd == "zones":
        d = query("{ worldData { zones { id name expansion { name } encounters { id name } } } }")
        for z in d["data"]["worldData"]["zones"]:
            if "Dawntrail" in (z["expansion"] or {}).get("name", ""):
                print(z["id"], z["name"], [(e["id"], e["name"]) for e in z["encounters"]])
    elif cmd == "query":
        print(json.dumps(query(sys.argv[2]), indent=1)[:20000])
