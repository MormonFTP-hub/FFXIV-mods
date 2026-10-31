"""A fight's strats from wtfdig.info, as data: every strat it lists, with each party spot's place (its text, and for the
strats that have them, the highlighted part of the diagram) for each mechanic, for the fight scripts in js/fights/.

The site builds each fight's page from a JavaScript chunk holding its timeline, its strats and its config. This reads
that chunk as text and parses the object literals in it (it never runs it): the arrays assigned as `X=[{stratName:`
and `X=[{mechName:`, and the `X={fightKey:` config. Diagram highlights are calls in the chunk: three numbers are a
circle (x%, y%, r%), four a rectangle (x1%, x2%, y1%, y2%), in the diagram image's own percentages.

  python BlackMageSim/tools/wtfdig.py 72/m6s            # writes work/wtfdig/m6s.json and m6s.txt (a readable dump)
  python BlackMageSim/tools/wtfdig.py list              # the fights on the home page
"""
import json
import re
import sys
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "work" / "wtfdig"
SITE = "https://wtfdig.info/"


def get(url, cache=None):
    if cache and cache.exists():
        return cache.read_text(encoding="utf-8")
    # Through curl: the site turns away Python's own client.
    text = subprocess.run(["curl", "-s", "--fail", "--max-time", "60", url], capture_output=True, check=True).stdout.decode("utf-8", "replace")
    if cache:
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(text, encoding="utf-8")
    return text


class Literal:
    """A JavaScript object literal read as data: objects, arrays, strings (any quotes), numbers, !0/!1, calls."""

    def __init__(self, s, i):
        self.s, self.i = s, i

    def ws(self):
        while self.i < len(self.s) and self.s[self.i] in " \t\r\n":
            self.i += 1

    def peek(self):
        self.ws()
        return self.s[self.i]

    def value(self):
        c = self.peek()
        if c == "{":
            return self.obj()
        if c == "[":
            return self.arr()
        if c in "`'\"":
            return self.string()
        if c == "!":
            self.i += 1
            return not self.value()
        m = re.compile(r"-?\d+(\.\d+)?(e-?\d+)?").match(self.s, self.i)
        if m:
            self.i = m.end()
            return float(m.group()) if (m.group(1) or m.group(2)) else int(m.group())
        m = re.compile(r"[A-Za-z_$][\w$]*").match(self.s, self.i)
        if m:
            self.i = m.end()
            name = m.group()
            if self.peek() == "(":
                self.i += 1
                args = []
                while self.peek() != ")":
                    args.append(self.value())
                    if self.peek() == ",":
                        self.i += 1
                self.i += 1
                return {"fn": name, "args": args}
            return {"true": True, "false": False, "null": None, "void": None}.get(name, {"ref": name})
        raise ValueError(f"bad value at {self.i}: {self.s[self.i:self.i + 60]!r}")

    def string(self):
        q = self.s[self.i]
        self.i += 1
        out = []
        while self.s[self.i] != q:
            if self.s[self.i] == "\\":
                out.append({"n": "\n", "t": "\t"}.get(self.s[self.i + 1], self.s[self.i + 1]))
                self.i += 2
            elif q == "`" and self.s.startswith("${", self.i):        # a template's ${...}: kept as text
                depth, j = 0, self.i
                while True:
                    if self.s[j] == "{":
                        depth += 1
                    elif self.s[j] == "}":
                        depth -= 1
                        if depth == 0:
                            break
                    j += 1
                out.append(self.s[self.i:j + 1])
                self.i = j + 1
            else:
                out.append(self.s[self.i])
                self.i += 1
        self.i += 1
        return "".join(out)

    def obj(self):
        self.i += 1
        o = {}
        while self.peek() != "}":
            if self.s.startswith("...", self.i):         # ...name: another object's fields, resolved later
                self.i += 3
                m = re.compile(r"[A-Za-z_$][\w$]*").match(self.s, self.i)
                self.i = m.end()
                o["..." + m.group()] = {"spread": m.group()}
                if self.peek() == ",":
                    self.i += 1
                continue
            m = re.compile(r"[\w$]+|`[^`]*`|'[^']*'|\"[^\"]*\"").match(self.s, self.i)
            key = m.group().strip("`'\"")
            self.i = m.end()
            if self.peek() in ",}":                       # shorthand {a,b}
                o[key] = {"ref": key}
            else:
                self.i += 1                               # the colon
                o[key] = self.value()
            if self.peek() == ",":
                self.i += 1
        self.i += 1
        return o

    def arr(self):
        self.i += 1
        a = []
        while self.peek() != "]":
            if self.s.startswith("...", self.i):         # ...name: another array's items, resolved later
                self.i += 3
                m = re.compile(r"[A-Za-z_$][\w$]*").match(self.s, self.i)
                self.i = m.end()
                a.append({"spread": m.group()})
            else:
                a.append(self.value())
            if self.peek() == ",":
                self.i += 1
        self.i += 1
        return a


class Chunk:
    """The chunk's variables, parsed when a value refers to one (`x` or `...x`)."""

    def __init__(self, src):
        self.src, self.memo = src, {}

    def var(self, name):
        if name in self.memo:
            return self.memo[name]
        self.memo[name] = None                            # a guard against a variable that refers to itself
        for m in re.finditer(r"(?<![\w$.])" + re.escape(name) + r"=(?!=)", self.src):
            j = m.end()
            if self.src[j] not in "[{`'\"-0123456789":
                continue
            try:
                v = Literal(self.src, j).value()
            except (ValueError, IndexError, AttributeError):
                continue
            self.memo[name] = self.resolve(v)
            return self.memo[name]
        return None

    def resolve(self, v, depth=0):
        if depth > 60:
            return v
        if isinstance(v, list):
            out = []
            for x in v:
                if isinstance(x, dict) and set(x) == {"spread"}:
                    r = self.var(x["spread"])
                    out.extend(r if isinstance(r, list) else [])
                else:
                    out.append(self.resolve(x, depth + 1))
            return out
        if isinstance(v, dict):
            if set(v) == {"ref"}:
                r = self.var(v["ref"])
                return r if r is not None else v
            if "fn" in v and "args" in v:
                return {"fn": v["fn"], "args": [self.resolve(a, depth + 1) for a in v["args"]]}
            out = {}
            for k, x in v.items():
                if k.startswith("...") and isinstance(x, dict) and "spread" in x:
                    r = self.var(x["spread"])
                    if isinstance(r, dict):
                        out.update(r)
                else:
                    out[k] = self.resolve(x, depth + 1)
            return out
        return v


def grab(src, pattern):
    m = re.search(pattern, src)
    if not m:
        return None
    ch = Chunk(src)
    return ch.resolve(Literal(src, src.index("=", m.start()) + 1).value())


def all_strats(src):
    """Every strat object in the chunk ({stratName: ...}), wherever it's defined, with its references resolved."""
    ch, out, seen = Chunk(src), [], set()
    for m in re.finditer(r"\{stratName:", src):
        try:
            st = ch.resolve(Literal(src, m.start()).value())
        except (ValueError, IndexError, AttributeError):
            continue
        name = st.get("stratName")
        if isinstance(name, str) and name not in seen:
            seen.add(name)
            out.append(st)
    return out


def mask(m):
    if not isinstance(m, dict) or "args" not in m:
        return None
    a = [float(x) for x in m["args"] if isinstance(x, (int, float))]
    return {"circle": a[:3]} if len(a) == 3 else {"rect": a[:4]} if len(a) >= 4 else None


def fight(path):
    """path like '72/m6s' or 'ultimates/fru': the fight's chunk, parsed."""
    key = path.strip("/").split("/")[-1]
    page = get(SITE + path.strip("/"), OUT / "pages" / f"{key}.html")
    chunks = sorted(set(re.findall(r'_app/immutable/(?:chunks|nodes)/[\w.-]+\.js', page)))
    for c in chunks:
        src = get(SITE + c, OUT / "chunks" / Path(c).name)
        if "stratName:" not in src or "fightKey:" not in src:
            continue
        strats = all_strats(src)
        config = grab(src, r"[,;\s](?:[\w$]+)=\{fightKey:")
        timeline = grab(src, r"[,;\s](?:[\w$]+)=\[\{mechName:")
        for st in strats or []:
            for ph in st.get("strats", []) if isinstance(st.get("strats"), list) else []:
                for me in ph.get("mechs", []) if isinstance(ph, dict) and isinstance(ph.get("mechs"), list) else []:
                    for r in me.get("strats", []) if isinstance(me, dict) and isinstance(me.get("strats"), list) else []:
                        if isinstance(r, dict) and "mask" in r:
                            r["mask"] = mask(r["mask"])
        return {"key": key, "path": path, "chunk": c, "config": config, "timeline": timeline, "strats": strats}
    raise RuntimeError(f"no strat data found for {path} ({len(chunks)} chunks)")


def dump(d):
    """A readable listing: each strat's phases, mechanics and each spot's place (text, diagram, highlight)."""
    txt = lambda v: v if isinstance(v, str) else json.dumps(v)[:80] if v else ""      # noqa: E731
    lst = lambda v: v if isinstance(v, list) else []                                 # noqa: E731
    lines = []
    cfg = d.get("config") or {}
    lines.append(f"{txt(cfg.get('title', d['key']))}  default strat: {txt(cfg.get('defaultStratName'))}")
    for k, v in (cfg.get("strats") or {}).items():
        if isinstance(v, dict):
            lines.append(f"  strat {k}: {txt(v.get('label'))} {[b.get('text') for b in lst(v.get('badges')) if isinstance(b, dict)]}")
    for st in d.get("strats") or []:
        lines.append("")
        lines.append(f"== {txt(st.get('stratName'))} | {txt(st.get('notes'))}")
        for ph in lst(st.get("strats")):
            if not isinstance(ph, dict):
                continue
            lines.append(f"# {txt(ph.get('phaseName'))} | {txt(ph.get('description'))}")
            for me in lst(ph.get("mechs")):
                if not isinstance(me, dict):
                    continue
                lines.append(f"  - {txt(me.get('mechanic'))} | {txt(me.get('description'))} {txt(me.get('imageUrl'))}")
                for r in lst(me.get("strats")):
                    if not isinstance(r, dict):
                        continue
                    img = txt(r.get("imageUrl")).split("/")[-1]
                    lines.append(f"      {txt(r.get('role'))[:1]}{txt(r.get('party'))} {txt(r.get('description'))!r} {img} {json.dumps(r.get('mask')) if r.get('mask') else ''}")
    return "\n".join(lines)


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "list"
    if arg == "list":
        home = get(SITE)
        print(sorted(set(re.findall(r'href="/?((?:\d+|ultimates)/[\w-]+)"', home))))
    else:
        d = fight(arg)
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / f"{d['key']}.json").write_text(json.dumps(d, indent=1), encoding="utf-8")
        (OUT / f"{d['key']}.txt").write_text(dump(d), encoding="utf-8")
        print(f"{d['key']}: {len(d['strats'] or [])} strats -> {OUT / (d['key'] + '.json')}")
