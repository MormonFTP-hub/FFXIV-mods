"""Instagram without signing in: posts, reels, carousels and profile previews from the public web pages.

Signed out, instagram.com still renders every public post and profile server-side, with the data in
<script type="application/json"> blocks (Relay payloads): xig_polaris_media for a post, xig_user_by_username for a
profile. That is all this reads; the JSON APIs (comments, web_profile_info, graphql) answer "require_login".
"""
import http.cookiejar
import json
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

# Plain Chrome: with an "Edg/" token Instagram caps the video tracks at 720p (no 1080p VP9 in the DASH manifest).
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/141.0.0.0 Safari/537.36")
BASE = "https://www.instagram.com"
CDN_HOSTS = (".cdninstagram.com", ".fbcdn.net")
RESERVED = {"p", "reel", "reels", "tv", "stories", "explore", "accounts", "direct", "share", "about", "legal",
            "developer", "web", "api", "graphql", "emails", "challenge", "s", "ar", "lite", "privacy"}

_jar = http.cookiejar.CookieJar()
_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_jar))
_cache, _lock = {}, threading.Lock()
TTL = 20 * 60


class IGError(Exception):
    """A problem worth showing as is: private post, login wall, bad link."""
    def __init__(self, msg, kind="error"):
        super().__init__(msg)
        self.kind = kind


def page(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Site": "none", "Upgrade-Insecure-Requests": "1"})
    t0 = time.time()
    try:
        with _opener.open(req, timeout=20) as r:
            body = r.read().decode("utf-8", "replace")
            print(f"  GET {url} -> {r.status} {len(body) // 1024} KB in {time.time() - t0:.1f}s", flush=True)
            return r.geturl(), body
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise IGError("That post or account doesn't exist (or was deleted).", "missing")
        if e.code == 429:
            raise IGError("Instagram is rate-limiting this connection. Give it a few minutes.", "limited")
        raise IGError(f"Instagram answered HTTP {e.code}.")
    except urllib.error.URLError as e:
        raise IGError(f"Couldn't reach Instagram ({e.reason}).", "offline")


def blobs(html):
    for b in re.findall(r'<script type="application/json"[^>]*>(.*?)</script>', html, re.S):
        try:
            yield json.loads(b)
        except ValueError:
            pass


def find(o, key):
    """Every value stored under `key` anywhere in a JSON tree."""
    stack = [o]
    while stack:
        x = stack.pop()
        if isinstance(x, dict):
            for k, v in x.items():
                if k == key and v is not None:
                    yield v
                elif isinstance(v, (dict, list)):
                    stack.append(v)
        elif isinstance(x, list):
            stack.extend(v for v in x if isinstance(v, (dict, list)))


def first(html, key):
    for j in blobs(html):
        for v in find(j, key):
            return v
    return None


# ---------------------------------------------------------------- links

def parse_link(text):
    """What a pasted link points at: ("post", code, index) / ("profile", username) / ("share", url) / ("story", user)."""
    text = (text or "").strip()
    m = re.search(r"(?:https?://)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am|ig\.me)(/[^\s\"'<>]*)?", text, re.I)
    if not m:
        bare = text.lstrip("@")
        if re.fullmatch(r"[A-Za-z0-9._]{1,30}", bare) and bare.lower() not in RESERVED:
            return ("profile", bare)
        if re.fullmatch(r"[A-Za-z0-9_-]{10,14}", text):
            return ("post", text, 0)
        raise IGError("That doesn't look like an Instagram link.", "badlink")
    full = "https://www.instagram.com" + (m.group(1) or "/")
    u = urllib.parse.urlparse(full)
    parts = [p for p in u.path.split("/") if p]
    q = urllib.parse.parse_qs(u.query)
    index = max(0, int(q.get("img_index", ["1"])[0]) - 1) if q.get("img_index", [""])[0].isdigit() else 0
    if not parts:
        raise IGError("That's the Instagram home page, not a post or profile.", "badlink")
    if parts[0] == "share":
        return ("share", full)
    if parts[0] == "stories":
        raise IGError("Stories can only be watched while signed in to Instagram.", "login")
    for i, p in enumerate(parts[:-1]):            # /p/X, /reel/X, /tv/X, /reels/X, /<user>/p/X, /<user>/reel/X
        if p in ("p", "reel", "reels", "tv"):
            return ("post", parts[i + 1], index)
    if parts[0] in RESERVED:
        raise IGError("That kind of Instagram page isn't supported (posts, reels and profiles are).", "badlink")
    return ("profile", parts[0])


def resolve(text):
    """parse_link, following share links (instagram.com/share/...) to the post they redirect to."""
    r = parse_link(text)
    if r[0] == "share":
        final, _ = page(r[1])
        r = parse_link(final)
        if r[0] == "share":
            raise IGError("That share link didn't lead anywhere viewable.", "badlink")
    return r


# ---------------------------------------------------------------- posts

def _width(c):
    """A candidate's width. Carousel slides leave width out: then the size is in the URL's stp (`_s1080x1080`), and
    a URL without one is the original upload."""
    if c.get("width"):
        return c["width"]
    m = re.search(r"[_=]s(\d+)x(\d+)", c["url"])
    return int(m.group(1)) if m else 10 ** 6


def _best(cands, want=None):
    """Largest candidate, or the smallest that is at least `want` px wide. Square crops (stp=c...) only as a last resort."""
    cands = [c for c in cands or [] if c.get("url")]
    full = [c for c in cands if not re.search(r"stp=c\d", c["url"])] or cands
    full.sort(key=_width)
    if not full:
        return None
    if want:
        for c in full:
            if _width(c) >= want:
                return c["url"]
    return full[-1]["url"]


def _user(u):
    if not u:
        return None
    return {"username": u.get("username"), "name": u.get("full_name") or "", "verified": bool(u.get("is_verified")),
            "private": bool(u.get("is_private")), "avatar": u.get("profile_pic_url") or u.get("profile_image_uri")}


def _dash(manifest):
    """Best video and audio track of a DASH manifest: [(url, kind, height, codecs)]."""
    out = {}
    for rep in re.finditer(r"<Representation\b([^>]*)>(.*?)</Representation>", manifest or "", re.S):
        attrs = dict(re.findall(r'(\w+)="([^"]*)"', rep.group(1)))
        base = re.search(r"<BaseURL>(.*?)</BaseURL>", rep.group(2), re.S)
        if not base:
            continue
        kind = "audio" if attrs.get("mimeType", "").startswith("audio") else "video"
        score = (int(attrs.get("height", 0)), attrs.get("codecs", "").startswith("avc"), int(attrs.get("bandwidth", 0)))
        if kind not in out or score > out[kind][0]:
            out[kind] = (score, base.group(1).replace("&amp;", "&"), attrs)
    return {k: {"url": v[1], "height": int(v[2].get("height", 0)), "width": int(v[2].get("width", 0)),
                "codecs": v[2].get("codecs")} for k, v in out.items()}


def _item(m, parent_dims=None):
    iv = (m.get("image_versions2") or {}).get("candidates") or []
    w = m.get("original_width") or (iv[0].get("width") if iv else None) or (parent_dims or (None, None))[0]
    h = m.get("original_height") or (iv[0].get("height") if iv else None) or (parent_dims or (None, None))[1]
    tags = []
    for t in ((m.get("usertags") or {}).get("in") or []):
        u = t.get("user") or {}
        pos = t.get("position") or [0, 0]
        tags.append({"username": u.get("username"), "name": u.get("full_name"), "verified": bool(u.get("is_verified")),
                     "x": pos[0], "y": pos[1]})
    it = {"kind": "image", "w": w, "h": h, "image": _best(iv) or m.get("display_uri"),
          "thumb": _best(iv, 320) or m.get("display_uri"), "alt": m.get("accessibility_caption") or "", "tags": tags}
    vv = m.get("video_versions") or []
    if vv:
        it["kind"] = "video"
        it["video"] = vv[0]["url"]
        dash = _dash(m.get("video_dash_manifest"))
        if dash.get("video"):
            it["hd"] = dash          # server side only (stripped before sending)
            it["hd_height"] = dash["video"]["height"]
            it["hd_p"] = min(dash["video"]["width"] or 10 ** 6, dash["video"]["height"])     # 1080x1920 is "1080p"
        it["audio"] = m.get("has_audio", True)
    return it


def _caption(m):
    c = m.get("caption") or {}
    return c.get("text") or ""


def _music(m):
    cm = m.get("clips_metadata") or {}
    mi = (cm.get("music_info") or {}).get("music_asset_info") or {}
    if mi.get("title"):
        return {"title": mi.get("title"), "artist": mi.get("display_artist") or ""}
    osi = cm.get("original_sound_info") or {}
    if osi:
        artist = (osi.get("ig_artist") or {}).get("username") or ""
        return {"title": osi.get("original_audio_title") or "Original audio", "artist": artist}
    return None


def _thumbs(conn, skip=None):
    out = []
    for e in (conn or {}).get("edges") or []:
        n = e.get("node") or {}
        if not n.get("code") or n.get("code") == skip:
            continue
        out.append({"code": n["code"], "thumb": n.get("display_uri") or _best((n.get("image_versions2") or {}).get("candidates"), 320),
                    "type": {1: "image", 2: "video", 8: "carousel"}.get(n.get("media_type"), "image"),
                    "product": n.get("product_type"), "caption": ((n.get("caption") or {}).get("text") or "")[:200],
                    "alt": n.get("accessibility_caption") or ""})
    return out


def _comment(n):
    u = n.get("user") or {}
    gif = None
    for v in find(n.get("giphy_media_info") or {}, "url"):
        if isinstance(v, str) and v.startswith("https://"):
            gif = v
            break
    return {"id": n.get("pk") or n.get("id"), "text": n.get("text") or "", "at": n.get("created_at"),
            "likes": n.get("comment_like_count") or 0, "covered": bool(n.get("is_covered")), "gif": gif,
            "user": {"username": u.get("username"), "avatar": u.get("profile_pic_url"), "verified": bool(u.get("is_verified"))}}


def _comment_page(cc):
    pi = cc.get("page_info") or {}
    return ([_comment(e["node"]) for e in cc.get("edges") or [] if e.get("node")],
            pi.get("end_cursor") if pi.get("has_next_page") else None)


def _tokens(html):
    """What the signed-out page's own GraphQL calls send: the LSD token and the CSRF token."""
    lsd = re.search(r'"LSD",\[\],\{"token":"([^"]+)"', html) or re.search(r'"lsd":"([^"]+)"', html)
    csrf = re.search(r'"csrf_token":"([^"]+)"', html)
    return {"lsd": lsd.group(1) if lsd else "", "csrf": csrf.group(1) if csrf else ""}


def post(code, fresh=False):
    key = ("post", code)
    with _lock:
        hit = _cache.get(key)
    if hit and not fresh and time.time() - hit[0] < TTL:
        return hit[1]
    final, html = page(f"{BASE}/p/{urllib.parse.quote(code)}/")
    if "/accounts/login" in final:
        raise IGError("Instagram sent a sign-in page instead of the post. It does this after lots of requests "
                      "from one connection; wait a few minutes and try again.", "limited")
    media = first(html, "xig_polaris_media")
    if not media:
        if 'property="og:title"' not in html:
            raise IGError("That post doesn't exist, or it was deleted.", "missing")
        raise IGError("Instagram didn't include this post's data. It may be private or need sign-in.", "login")
    m = media.get("if_not_gated_logged_out")
    if not m:
        raise IGError("This post is private or age-restricted, so Instagram only shows it when signed in.", "login")
    mt = m.get("media_type")
    if mt == 8 and m.get("carousel_media"):
        items = [_item(c, (m.get("original_width"), m.get("original_height"))) for c in m["carousel_media"]]
    else:
        items = [_item(m)]
    user = m.get("user") or {}
    loc = m.get("location") or {}
    first_comments, after = _comment_page(media.get("comments_connection") or {})
    data = {
        "code": m.get("code") or code,
        "url": f"{BASE}/{'reel' if m.get('product_type') == 'clips' else 'p'}/{m.get('code') or code}/",
        "type": {1: "image", 2: "video", 8: "carousel"}.get(mt, "image"),
        "product": m.get("product_type"),
        "taken_at": m.get("taken_at"),
        "likes": None if m.get("like_and_view_counts_disabled") else m.get("like_count"),
        "comments": m.get("comment_count"),
        "comments_off": bool(m.get("commenting_disabled_for_viewer")),
        "caption": _caption(m),
        "edited": bool(m.get("caption_is_edited")),
        "location": loc.get("name") if isinstance(loc, dict) else None,
        "music": _music(m) if m.get("product_type") == "clips" else None,
        "ai_label": bool(m.get("ai_label_info")),
        "user": _user(user),
        "coauthors": [_user(u) for u in m.get("coauthor_producers") or [] if u.get("username") != user.get("username")],
        "items": items,
        "more": _thumbs(user.get("polaris_ordered_timeline_connection"), skip=m.get("code") or code),
        "comment_list": first_comments,
        "comments_after": after,
        "fetched": time.time(),
        "_gql": {**_tokens(html), "media_id": media.get("pk") or m.get("pk"), "referer": final},
    }
    with _lock:
        _cache[key] = (time.time(), data)
    return data


def public(data):
    """A post without the server-only bits (DASH track URLs, page tokens)."""
    d = {k: v for k, v in data.items() if k != "_gql"}
    d["items"] = [{k: v for k, v in it.items() if k != "hd"} for it in data["items"]]
    return d


COMMENTS_QUERY = ("PolarisLoggedOutDesktopWWWPostCommentsPaginationQuery", "27837656105907150")


def _graphql(g, query, variables):
    """POST /api/graphql the way the signed-out post page does when you scroll its comments."""
    name, doc = query
    form = {"av": "0", "__d": "www", "__user": "0", "__a": "1", "lsd": g["lsd"], "fb_api_caller_class": "RelayModern",
            "fb_api_req_friendly_name": name, "server_timestamps": "true", "variables": json.dumps(variables), "doc_id": doc}
    req = urllib.request.Request(BASE + "/api/graphql", data=urllib.parse.urlencode(form).encode(), headers={
        "User-Agent": UA, "Accept": "*/*", "Accept-Language": "en-US,en;q=0.9",
        "Content-Type": "application/x-www-form-urlencoded", "X-FB-LSD": g["lsd"], "X-CSRFToken": g["csrf"],
        "X-IG-App-ID": "936619743392459", "X-FB-Friendly-Name": name, "Origin": BASE, "Referer": g["referer"],
        "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty"})
    try:
        with _opener.open(req, timeout=20) as r:
            body = r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        print(f"  graphql {name} -> HTTP {e.code}", flush=True)
        return None
    except urllib.error.URLError as e:
        raise IGError(f"Couldn't reach Instagram ({e.reason}).", "offline")
    try:
        return json.loads(body[9:] if body.startswith("for (;;);") else body)
    except ValueError:
        print(f"  graphql {name} -> not JSON: {body[:120]!r}", flush=True)
        return None


def comments(code, after):
    """The next page of a post's comments after `after` (a cursor from post() or an earlier call)."""
    p = post(code)
    for attempt in range(2):
        j = _graphql(p["_gql"], COMMENTS_QUERY, {"after": after, "first": 15, "media_id": p["_gql"]["media_id"]})
        cc = ((((j or {}).get("data") or {}).get("xig_polaris_media") or {}).get("comments_connection"))
        if cc is not None:
            items, nxt = _comment_page(cc)
            return {"comments": items, "after": nxt}
        if attempt == 0:
            p = post(code, fresh=True)          # page tokens expire: get new ones and try once more
    raise IGError("Instagram didn't send more comments just now. Try again in a minute.", "limited")


# ---------------------------------------------------------------- profiles

def profile(username, fresh=False):
    key = ("profile", username.lower())
    with _lock:
        hit = _cache.get(key)
    if hit and not fresh and time.time() - hit[0] < TTL:
        return hit[1]
    final, html = page(f"{BASE}/{urllib.parse.quote(username)}/")
    if "/accounts/login" in final:
        raise IGError("Instagram sent a sign-in page instead of the profile. Wait a few minutes and try again.", "limited")
    merged = {}
    for j in blobs(html):
        for u in find(j, "xig_user_by_username"):
            if isinstance(u, dict):
                for k, v in u.items():
                    if v is not None and k not in merged:
                        merged[k] = v
    if not merged.get("username"):
        raise IGError(f"There's no Instagram account called @{username}.", "missing")
    posts = _thumbs(merged.get("polaris_ordered_timeline_connection"))
    links = []
    for bl in merged.get("bio_links") or []:
        if bl.get("url"):
            links.append({"url": bl["url"], "title": bl.get("title") or re.sub(r"^https?://(www\.)?|/$", "", bl["url"])})
    data = {
        **_user(merged),
        "bio": merged.get("biography") or "",
        "followers": merged.get("follower_count"),
        "following": merged.get("following_count"),
        "posts_count": merged.get("all_media_count") or merged.get("media_count"),
        "links": links,
        "category": merged.get("category") or merged.get("category_name"),
        "pronouns": merged.get("pronouns") or [],
        "has_reels": bool(merged.get("has_any_clips")),
        "posts": posts,
        "url": f"{BASE}/{merged['username']}/",
        "fetched": time.time(),
    }
    with _lock:
        _cache[key] = (time.time(), data)
    return data


def cdn_ok(url):
    try:
        u = urllib.parse.urlparse(url)
    except ValueError:
        return False
    return u.scheme == "https" and any(u.hostname and u.hostname.endswith(h) for h in CDN_HOSTS)


def download(url, path, chunk=1 << 16):
    if not cdn_ok(url):
        raise IGError("Not an Instagram media URL.")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": BASE + "/"})
    with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
        while True:
            b = r.read(chunk)
            if not b:
                break
            f.write(b)
    return path
