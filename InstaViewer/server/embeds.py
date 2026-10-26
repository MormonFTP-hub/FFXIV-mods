"""Things to paste into Discord: an embed link through an Instagram "fixer" site, or the media file itself.

Discord can't embed instagram.com links (Instagram shows its bot a login wall). Fixer sites mirror the URL layout
(instagram.com/reel/X -> fxinstagram.com/reel/X) and answer Discord's bot with og:video / twitter:player tags that
point at the mp4, so Discord shows a player. They come and go, hence the automatic mode that asks each one, the way
Discord's bot will, and takes the first that answers with the right kind of media.
"""
import concurrent.futures
import html
import re
import threading
import time
import urllib.error
import urllib.request

# Preference order for "auto". Checked 2026-10-23: all six answer Discord's bot with video for reels; zzinstagram has
# nothing for carousels, instagramfix sends a grid image of every slide for a whole carousel. Gone that day:
# ddinstagram.com (no DNS), vxinstagram.com (404); kkinstagram.com only gave a still image for reels.
SERVICES = ["fxinstagram.com", "instagramfix.com", "eeinstagram.com", "uuinstagram.com", "toinstagram.com",
            "zzinstagram.com"]
BOT_UA = "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"
_cache, _lock = {}, threading.Lock()
_last_good = {"service": None}
TTL = 30 * 60


def path_for(post, i):
    """/reel/CODE/ or /p/CODE/, with ?img_index=N for a slide past the first (InstaFix sites and fxinstagram)."""
    kind = "reel" if post.get("product") == "clips" and len(post["items"]) == 1 else "p"
    p = f"/{kind}/{post['code']}/"
    if len(post["items"]) > 1 and i > 0:
        p += f"?img_index={i + 1}"
    return p


def clean(service):
    s = re.sub(r"^https?://", "", (service or "").strip().lower()).split("/")[0]
    if not re.fullmatch(r"[a-z0-9.-]+\.[a-z]{2,}", s):
        raise ValueError(f"{service!r} isn't a domain like fxinstagram.com")
    return s


def probe(service, path, timeout=8):
    """What Discord's bot would get from service+path: 'video', 'image' or None, plus a note."""
    url = f"https://{service}{path}"
    t0 = time.time()
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": BOT_UA}), timeout=timeout) as r:
            body = r.read(400000).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}"
    except Exception as e:     # noqa: BLE001 (DNS failures, timeouts, bad certificates: all mean "not usable")
        return None, type(e).__name__
    meta = {k.lower(): html.unescape(v) for k, v in
            re.findall(r'<meta[^>]+(?:property|name)="([^"]+)"[^>]+content="([^"]*)"', body)}
    note = f"{time.time() - t0:.1f}s"
    if meta.get("og:video") or meta.get("og:video:secure_url") or meta.get("og:video:url") or meta.get("twitter:player:stream"):
        return "video", note
    if meta.get("og:image") or meta.get("twitter:image"):
        return "image", note
    return None, "no embed tags"


def link(post, i, service="auto"):
    """{url, service, kind}. For "auto", the first service (last good one first) whose answer has a video for a
    video item, or any media for a photo."""
    it = post["items"][i]
    want = "video" if it["kind"] == "video" else "image"
    path = path_for(post, i)
    if service != "auto":
        s = clean(service)
        return {"url": f"https://{s}{path}", "service": s, "kind": None}
    key = (post["code"], i)
    with _lock:
        hit = _cache.get(key)
    if hit and time.time() - hit[0] < TTL:
        return hit[1]
    order = SERVICES[:]
    if _last_good["service"] in order:
        order.remove(_last_good["service"])
        order.insert(0, _last_good["service"])
    # ask them all at once, but answer as soon as the most preferred working one is known
    ex = concurrent.futures.ThreadPoolExecutor(len(order))
    futures = {s: ex.submit(probe, s, path) for s in order}
    ex.shutdown(wait=False)
    results = {}
    for s in order:
        results[s] = kind, note = futures[s].result()
        if kind == want or (want == "image" and kind == "video"):
            print(f"discord embed: {s} ({kind}, {note}); skipped {results}", flush=True)
            out = {"url": f"https://{s}{path}", "service": s, "kind": kind}
            _last_good["service"] = s
            with _lock:
                _cache[key] = (time.time(), out)
            return out
    print("discord embed: nothing usable", results, flush=True)
    # nobody embeds this one properly: still give the best guess, flagged
    s = next((s for s in order if results[s][0]), order[0])
    return {"url": f"https://{s}{path}", "service": s, "kind": results[s][0], "warning":
            "None of the embed sites answered with a playable video just now. Discord may only show a picture."}


def test(post, i, service):
    """One service checked against this post, for the settings page."""
    s = clean(service)
    kind, note = probe(s, path_for(post, i))
    return {"service": s, "kind": kind, "note": note}
