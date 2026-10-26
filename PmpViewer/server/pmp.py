"""Penumbra mods (.pmp archives or unpacked mod folders): option groups, settings, and the merged set of file
redirections, file swaps and meta manipulations that Penumbra would apply for a given choice of options."""
import hashlib
import json
import os
import threading
import zipfile

from game import WORK

MODS = os.path.join(WORK, "mods")


def _lower(p):
    return p.replace("\\", "/").lower().strip("/")


class Container:
    """One option's (or the default container's) payload."""

    def __init__(self, d, label):
        self.label = label
        self.files = {_lower(k): v.replace("\\", "/") for k, v in (d.get("Files") or {}).items()}
        self.swaps = {_lower(k): _lower(v) for k, v in (d.get("FileSwaps") or {}).items()}
        self.manips = list(d.get("Manipulations") or [])


class Group:
    def __init__(self, d, index, file):
        self.index, self.file = index, file
        self.name = d.get("Name", f"group {index}")
        self.type = d.get("Type", "Single")
        self.priority = int(d.get("Priority", 0) or 0)
        self.default = int(d.get("DefaultSettings", 0) or 0)
        self.description = d.get("Description", "")
        self.raw = d
        self.options = []
        for i, o in enumerate(d.get("Options") or []):
            self.options.append({"name": o.get("Name", f"option {i}"), "description": o.get("Description", ""),
                                 "priority": int(o.get("Priority", 0) or 0), "raw": o,
                                 "container": Container(o, f"{self.name} / {o.get('Name', i)}")})
        self.containers = [Container(c, f"{self.name} / combination {i}") for i, c in enumerate(d.get("Containers") or [])]

    def summary(self):
        return {"index": self.index, "name": self.name, "type": self.type, "priority": self.priority,
                "default": self.default, "description": self.description,
                "options": [{"name": o["name"], "description": o["description"], "priority": o["priority"],
                             "files": len(o["container"].files), "swaps": len(o["container"].swaps),
                             "manips": len(o["container"].manips)} for o in self.options]}

    def active(self, setting):
        """Containers this setting turns on, highest precedence first (Penumbra keeps the first entry per key)."""
        if self.type == "Single":
            i = setting if 0 <= setting < len(self.options) else 0
            return [self.options[i]["container"]] if self.options else []
        if self.type == "Multi":
            on = [(o["priority"], -i, o) for i, o in enumerate(self.options) if setting >> i & 1]
            return [o["container"] for _, _, o in sorted(on, key=lambda t: (t[0], t[1]), reverse=True)]
        if self.type == "Combining":
            return [self.containers[setting]] if 0 <= setting < len(self.containers) else []
        return []   # Imc groups carry no files; see imc_manips()

    def imc_manips(self, setting):
        """An Imc group writes IMC entries: the default entry's attribute mask XOR each selected option's mask;
        a selected disable option turns the group off."""
        if self.type != "Imc":
            return []
        d = self.raw
        entry = dict(d.get("DefaultEntry") or {})
        mask = int(entry.get("AttributeMask", 0))
        for i, o in enumerate(self.options):
            if o["raw"].get("IsDisableSubMod"):
                if setting >> i & 1:
                    return []
                continue
            if setting >> i & 1:
                mask ^= int(o["raw"].get("AttributeMask", 0))
        entry["AttributeMask"] = mask
        ident = dict(d.get("Identifier") or {})
        return [{"Type": "Imc", "Manipulation": {**ident, "Entry": entry},
                 "_imcGroup": {"allVariants": bool(d.get("AllVariants")), "onlyAttributes": bool(d.get("OnlyAttributes"))}}]


class Mod:
    def __init__(self, path):
        self.path = os.path.abspath(path)
        if os.path.isdir(self.path):
            self.root = self.path
            names = []
            for dp, _, fs in os.walk(self.root):
                names += [os.path.relpath(os.path.join(dp, f), self.root).replace("\\", "/") for f in fs]
        else:       # a .pmp: members are unpacked on first use, so opening a big mod stays quick
            st = os.stat(self.path)
            key = hashlib.sha1(f"{self.path}|{st.st_size}|{st.st_mtime_ns}".encode()).hexdigest()[:12]
            self.root = os.path.join(MODS, key)
            self.zip = zipfile.ZipFile(self.path)
            self.members = {n.replace("\\", "/"): n for n in self.zip.namelist() if not n.endswith("/")}
            names = list(self.members)
        self._lock = threading.Lock()
        self.names = sorted(names)
        self.by_lower = {n.lower(): n for n in self.names}
        self.meta = self._json("meta.json") or {}
        self.groups = []
        if isinstance(self.meta.get("Groups"), list) or "DefaultData" in self.meta:
            # Penumbra 1.7+ installs mods as one meta.json (FileVersion 4) holding the default container and groups
            self.default = Container(self.meta.get("DefaultData") or {}, "Default")
            for g in self.meta.get("Groups") or []:
                self.groups.append(Group(g, len(self.groups), "meta.json"))
            return
        self.default = Container(self._json("default_mod.json") or {}, "Default")
        for n in self.names:
            if n.lower().startswith("group_") and n.lower().endswith(".json") and "/" not in n:
                self.groups.append(Group(self._json(n), len(self.groups), n))

    def _json(self, name):
        p = self.local(name)
        return json.load(open(p, encoding="utf-8-sig")) if p else None

    def has(self, inner):
        return inner.replace("\\", "/").lower() in self.by_lower

    def local(self, inner):
        """Local file for a path inside the mod (case-insensitive), unpacked on demand; None if absent."""
        real = self.by_lower.get(inner.replace("\\", "/").lower())
        if real is None:
            return None
        dst = os.path.join(self.root, *real.split("/"))
        if not os.path.exists(dst) and hasattr(self, "zip"):
            with self._lock:
                if not os.path.exists(dst):
                    os.makedirs(os.path.dirname(dst), exist_ok=True)
                    with open(dst + ".part", "wb") as f:
                        f.write(self.zip.read(self.members[real]))
                    os.replace(dst + ".part", dst)
        return dst

    def default_settings(self):
        return {g.index: g.default for g in self.groups}

    def summary(self):
        return {"path": self.path, "name": self.meta.get("Name", os.path.basename(self.path)),
                "author": self.meta.get("Author", ""), "version": self.meta.get("Version", ""),
                "description": self.meta.get("Description", ""), "website": self.meta.get("Website", ""),
                "fileCount": len(self.names), "groups": [g.summary() for g in self.groups],
                "default": {"files": len(self.default.files), "swaps": len(self.default.swaps),
                            "manips": len(self.default.manips)}}

    def resolve(self, settings):
        """Merge everything the settings enable. Groups go in descending priority (ties: the later group), each group's
        own options in their precedence order, and the default container last; the first entry for a game path or
        manipulation wins, the way Penumbra's collection cache fills its dictionaries."""
        order = sorted(self.groups, key=lambda g: (-g.priority, -g.index))
        containers = []
        imc = []
        for g in order:
            s = int(settings.get(g.index, settings.get(str(g.index), g.default)))
            containers += g.active(s)
            imc += [(g.name, m) for m in g.imc_manips(s)]
        containers.append(self.default)
        files, swaps, manips, conflicts = {}, {}, {}, []
        for c in containers:
            for gp, inner in c.files.items():
                if gp in files or gp in swaps:
                    conflicts.append({"path": gp, "winner": (files.get(gp) or swaps.get(gp))["from"], "loser": c.label})
                    continue
                files[gp] = {"inner": inner, "present": self.has(inner), "from": c.label}
            for gp, src in c.swaps.items():
                if gp in files or gp in swaps:
                    conflicts.append({"path": gp, "winner": (files.get(gp) or swaps.get(gp))["from"], "loser": c.label})
                    continue
                swaps[gp] = {"to": src, "from": c.label}
            for m in c.manips:
                key = manip_key(m)
                if key in manips:
                    conflicts.append({"manip": key, "winner": manips[key]["from"], "loser": c.label})
                    continue
                manips[key] = {"m": m, "from": c.label}
        for label, m in imc:
            key = manip_key(m)
            if key not in manips:
                manips[key] = {"m": m, "from": label}
        return Resolved(self, files, swaps, list(manips.values()), conflicts)

    def everything(self):
        """Every file and manipulation of every option at once (for finding what the mod touches)."""
        files, swaps, manips = {}, {}, []
        cs = [self.default] + [o["container"] for g in self.groups for o in g.options] + [c for g in self.groups for c in g.containers]
        for c in cs:
            for gp, inner in c.files.items():
                files.setdefault(gp, {"inner": inner, "present": self.has(inner), "from": c.label})
            for gp, src in c.swaps.items():
                swaps.setdefault(gp, {"to": src, "from": c.label})
            manips += [{"m": m, "from": c.label} for m in c.manips]
        for g in self.groups:
            manips += [{"m": m, "from": g.name} for m in g.imc_manips(g.default)]
        return Resolved(self, files, swaps, manips, [])


def manip_key(m):
    t = m.get("Type")
    d = dict(m.get("Manipulation") or {})
    d.pop("Entry", None)
    return t + ":" + json.dumps(d, sort_keys=True)


class Resolved:
    def __init__(self, mod, files, swaps, manips, conflicts):
        self.mod, self.files, self.swaps, self.manips, self.conflicts = mod, files, swaps, manips, conflicts

    def lookup(self, game_path):
        """('mod', local file, label) | ('swap', game path, label) | (None, None, None)"""
        gp = _lower(game_path)
        if gp in self.files:
            f = self.files[gp]
            return "mod", self.mod.local(f["inner"]) if f["present"] else None, f["from"]
        if gp in self.swaps:
            s = self.swaps[gp]
            return "swap", s["to"], s["from"]
        return None, None, None

    def manips_of(self, kind):
        return [(x["m"]["Manipulation"], x["from"]) for x in self.manips if x["m"].get("Type") == kind]
