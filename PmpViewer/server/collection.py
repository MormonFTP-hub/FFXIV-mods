"""Files a mod relies on that neither it nor the game has, looked up in the user's own Penumbra collection.

Body-mod ports point their skin at materials like mt_c0201b0001_bibo.mtrl, which only Bibo+ (or another
body mod) provides. In game Penumbra serves those from the other enabled mods of the collection, so the
viewer does the same for paths that would otherwise be missing: the collection Penumbra assigns to
"Yourself" (else the Default one), its enabled mods with their chosen options, higher priority first.
"""
import json
import os
import threading

import pmp

CFG = os.path.join(os.environ.get("APPDATA", ""), "XIVLauncher", "pluginConfigs")
ZERO = "00000000-0000-0000-0000-000000000000"
_lock = threading.Lock()
_mods = {}      # installed mod folder -> (stamp, pmp.Mod): listing a big mod's files takes long on a cold disk


def _json(path):
    try:
        return json.load(open(path, encoding="utf-8-sig"))
    except (OSError, ValueError):
        return None


def _mod_dir():
    # Penumbra 1.x keeps its live settings in Penumbra/config/penumbra.json; the root Penumbra.json is the old layout
    # (its .bak still names E:\cum from before the mods moved to D:\Penumbra).
    for name in (os.path.join("Penumbra", "config", "penumbra.json"), os.path.join("Penumbra", "config", "penumbra.json.bak"),
                 "Penumbra.json", "Penumbra.json.bak"):
        d = _json(os.path.join(CFG, name))
        if d and d.get("ModDirectory") and os.path.isdir(d["ModDirectory"]):
            return d["ModDirectory"]
    return None


def _collection_file():
    active = _json(os.path.join(CFG, "Penumbra", "active_collections.json")) or {}
    for key in ("Yourself", "Default"):
        guid = active.get(key)
        if guid and guid != ZERO:
            p = os.path.join(CFG, "Penumbra", "collections", f"{guid}.json")
            if os.path.exists(p):
                return p
    return None


def _stamp(path):
    """Changes when Penumbra rewrites the mod's json files (option edits, changes made in its mod editor)."""
    try:
        with os.scandir(path) as it:
            return os.stat(path).st_mtime_ns, max((e.stat().st_mtime_ns for e in it if e.name.lower().endswith(".json")), default=0)
    except OSError:
        return None


def _mod(path):
    stamp = _stamp(path)
    hit = _mods.get(path)
    if hit is None or hit[0] != stamp:
        hit = _mods[path] = (stamp, pmp.Mod(path))
    return hit[1]


def _resolved_layers(col_path, mod_dir):
    """Every enabled mod of the collection, resolved with the options the user picked, highest priority first:
    [(normalised folder path, mod name, pmp.Resolved)]."""
    col = _json(col_path) or {}
    entries = []
    for folder, st in (col.get("Settings") or {}).items():
        if not st or not st.get("Enabled"):
            continue
        path = os.path.join(mod_dir, folder)
        if not os.path.isdir(path):
            continue
        entries.append((-int(st.get("Priority", 0) or 0), folder, path, st.get("Settings") or {}))
    out = []
    for _, folder, path, chosen in sorted(entries):
        try:
            mod = _mod(path)
            settings = {g.index: chosen[g.name] for g in mod.groups if g.name in chosen}
            out.append((os.path.normcase(os.path.abspath(path)), mod.meta.get("Name") or folder, mod.resolve(settings)))
        except Exception:      # noqa: BLE001  a broken mod in the collection must not break the viewer
            continue
    return out


_layers = {"key": None, "layers": [], "files": None}


def _current():
    """The collection's resolved layers, rebuilt when Penumbra rewrites the collection file; None without Penumbra."""
    col_path, mod_dir = _collection_file(), _mod_dir()
    if not col_path or not mod_dir:
        return None
    key = (col_path, os.path.getmtime(col_path), mod_dir)
    with _lock:
        if _layers["key"] != key:
            _layers.update(key=key, layers=_resolved_layers(col_path, mod_dir), files=None,
                           name=(_json(col_path) or {}).get("Name", ""))
        return dict(_layers)


class Layered:
    """The opened mod on top of the user's whole Penumbra collection: files, swaps and manipulations from every enabled
    mod, the first by priority winning, the way Penumbra's collection cache fills its dictionaries. The opened mod
    counts as the highest priority (an installed copy of it in the collection is left out)."""

    def __init__(self, primary, layers, name):
        self.mod, self.conflicts, self.collection = (primary.mod if primary else None), (primary.conflicts if primary else []), name
        self.files, self.swaps, self.owner = {}, {}, {}
        manips, self.layer_names = {}, []
        for label, res in ([("", primary)] if primary else []) + layers:
            self.layer_names.append(label)
            for gp, f in res.files.items():
                if gp not in self.files and gp not in self.swaps:
                    self.files[gp] = dict(f, **({"from": f"{label}: {f['from']}"} if label else {}))
                    self.owner[gp] = (label, res)
            for gp, sw in res.swaps.items():
                if gp not in self.files and gp not in self.swaps:
                    self.swaps[gp] = dict(sw, **({"from": f"{label}: {sw['from']}"} if label else {}))
                    self.owner[gp] = (label, res)
            for x in res.manips:
                key = pmp.manip_key(x["m"])
                if key not in manips:
                    manips[key] = dict(x, **({"from": f"{label}: {x['from']}"} if label else {}))
        self.manips = list(manips.values())

    def lookup(self, game_path):
        gp = pmp._lower(game_path)
        if gp in self.files:
            label, res = self.owner[gp]
            f = self.files[gp]
            local = res.mod.local(f["inner"]) if f["present"] else None
            return ("collection" if label else "mod"), local, f["from"]
        if gp in self.swaps:
            label, _ = self.owner[gp]
            return "swap", self.swaps[gp]["to"], self.swaps[gp]["from"]
        return None, None, None

    def manips_of(self, kind):
        return [(x["m"]["Manipulation"], x["from"]) for x in self.manips if x["m"].get("Type") == kind]


def _mod_name(res):
    return ((getattr(getattr(res, "mod", None), "meta", None) or {}).get("Name") or "").strip().lower()


def layered(primary, primary_path=None):
    """The opened mod (a pmp.Resolved, or None for vanilla) layered over the user's collection; None if there is none.
    An installed copy of the opened mod is left out, matched by folder or by mod name (a .pmp never shares a path
    with its installed folder)."""
    cur = _current()
    if cur is None:
        return None
    skip = os.path.normcase(os.path.abspath(primary_path)) if primary_path else None
    own = _mod_name(primary)
    return Layered(primary, [(name, res) for path, name, res in cur["layers"]
                             if path != skip and not (own and _mod_name(res) == own)], cur["name"])


def lookup(game_path, exclude=None):
    """(local file, mod name, option label) from the user's collection, or None. exclude: the opened mod (a
    pmp.Resolved or Layered); its own installed copy never fills its gaps, or a file the mod forgot to ship (Aerith
    1.7.0's face materials for faces 2-5) would look present."""
    cur = _current()
    if cur is None:
        return None
    with _lock:
        if _layers["files"] is None:
            files = {}
            for _, name, res in cur["layers"]:
                for gp, f in res.files.items():
                    if f["present"]:
                        files.setdefault(gp, []).append((res.mod, f["inner"], name, f["from"], _mod_name(res)))
            _layers["files"] = files
        own = _mod_name(exclude) if exclude is not None else ""
        hit = next((h for h in _layers["files"].get(game_path.lower(), []) if not own or h[4] != own), None)
    if hit is None:
        return None
    mod, inner, name, label, _ = hit
    local = mod.local(inner)
    return (local, name, label) if local else None
