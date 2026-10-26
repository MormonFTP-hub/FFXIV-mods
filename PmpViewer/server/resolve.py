"""Work out what the game would load for a character (or a monster / demihuman / weapon) with a mod enabled:
every model, material, texture and skeleton request, where Penumbra would serve it from, and what the EQP / EQDP /
IMC data hides or swaps on the way. The result is a load trace plus the meshes and materials for the viewer."""
import re
from concurrent.futures import ThreadPoolExecutor

import numpy as np

import collection
import customize as C
import game
import meta as M
import shade
import skeleton as S
import visibility as V

TYPE = {"f": "face", "h": "hair", "t": "tail", "z": "zear", "b": "body"}
SLOT_CAT = {3: "met", 4: "top", 5: "glv", 7: "dwn", 8: "sho", 9: "ear", 10: "nek", 11: "wrs", 12: "rir",
            15: "top", 16: "top", 18: "dwn", 19: "top", 20: "top", 21: "top"}
TAIL_RACES = ("c0701", "c0801", "c1301", "c1401", "c1501", "c1601")
EAR_RACES = ("c1701", "c1801")
# character.shpk's decal key: on (crest) for vanilla body gear, off on hands, legs and feet. In the face slot the game
# binds the character's face paint as the decal, so a face-slot material with it on gets the face paint painted over it
DECAL_KEY, DECAL_ON, DECAL_OFF = 0xD2777173, 0xF35F5131, 0x4242B842


class Loader:
    """Resolves game paths through the mod (files, then swaps) and the game, recording a trace."""

    def __init__(self, resolved, customize, dry=False):
        self.dry = dry                  # trace only: no texture decoding or baking
        self.res = resolved
        self.meta = M.Meta(resolved)
        self.customize = customize
        self.trace, self.problems = [], []
        self.materials, self._mat_index, self.pending = [], {}, []
        self.redirects = {}             # game path -> local file, for the game-shader renderer (xivrender)

    def note(self, level, text, ref=None):
        self.problems.append({"level": level, "text": text, "ref": ref})

    def file(self, gp, kind, parent=None, data=True, **info):
        """Resolve one request. data=False only checks that the game has the file (returns its path)."""
        gp = gp.lower()
        src, val, label = self.res.lookup(gp) if self.res else (None, None, None)
        e = {"id": len(self.trace), "parent": parent, "kind": kind, "request": gp, **info}
        local = None
        if src == "mod":
            e.update(source="mod", file=self.res.files[gp]["inner"], option=label)
            local = val
            if local is None:
                e["status"] = "error"
                self.note("error", f"{gp}: the mod maps it to {e['file']}, which is not in the pack", e["id"])
        elif src == "collection":       # another enabled mod of the user's collection (collection mode)
            e.update(source="collection", file=self.res.files[gp]["inner"], option=label)
            local = val
            if local is None:
                e["status"] = "error"
                self.note("error", f"{gp}: {label} maps it to {e['file']}, which is not in that mod", e["id"])
        elif src == "swap":
            local = game.game_file(val)
            e.update(source="swap", file=val, option=label)
            if local is None:
                e["status"] = "error"
                self.note("error", f"{gp}: file swap to {val}, which the game doesn't have", e["id"])
        elif not data:
            local = gp if game.exists(gp)[0] else None
            e["source"] = "game" if local else "missing"
        else:
            local = game.game_file(gp)
            e["source"] = "game" if local else "missing"
        if local is None and e["source"] == "missing" and kind in ("material", "texture"):
            # In game Penumbra serves these from the user's other enabled mods, e.g. a port's skin pointing at
            # Bibo+'s mt_c0201b0001_bibo.mtrl. Models stay as they are, so slot resolution doesn't change.
            hit = collection.lookup(gp, exclude=self.res)
            if hit:
                local = hit[0] if data else gp
                e.update(source="collection", file=f"{hit[1]} ({hit[2]})")
        if local is None and data and e["source"] == "missing":
            e["status"] = "missing"
        if local and data and e["source"] in ("mod", "swap", "collection"):
            self.redirects[gp] = local
        self.trace.append(e)
        return local, e

    def render_redirects(self):
        """Everything the renderer must read from somewhere other than the game: the files this trace resolved,
        plus the mod's own shader packages (Penumbra serves a mod's .shpk like any other file)."""
        out = dict(self.redirects)
        if self.res:
            for gp in self.res.files:
                if gp.startswith("shader/") and gp not in out:
                    src, local, _ = self.res.lookup(gp)
                    if local:
                        out[gp] = local
        return out

    # ---------------------------------------------------------------- materials and textures
    def material(self, gp, parent):
        if gp in self._mat_index:
            self.trace[parent].setdefault("materials", []).append(self._mat_index[gp])
            return self._mat_index[gp]
        local, e = self.file(gp, "material", parent)
        if e["source"] == "collection":
            self.note("info", f"material {gp} isn't in this mod or the game; it comes from {e['file']} in your "
                              f"Penumbra collection, as in game. Without that mod the mesh won't draw.", e["id"])
        if local is None:
            if e["source"] == "missing":
                self.note("error", f"material {gp} is missing: the mesh using it won't draw in game", e["id"])
            mat = {"path": gp, "visible": False, "missing": True, "trace": e["id"]}
        else:
            try:
                mt = game.material(local)
            except Exception as ex:      # noqa: BLE001
                self.note("error", f"material {gp} doesn't parse: {ex}", e["id"])
                mt = None
            if mt is None:
                mat = {"path": gp, "visible": False, "missing": True, "trace": e["id"]}
            else:
                e["shader"] = mt["shader"]
                dk = next((k["val"] for k in mt.get("keys") or [] if k["cat"] == DECAL_KEY), None)
                if dk is not None:
                    e["decalKey"] = dk
                texs = {}
                for i, t in enumerate(mt["textures"]):
                    tp = t["path"]
                    if t.get("dx11"):
                        d, n = tp.rsplit("/", 1)
                        tp = f"{d}/--{n}"
                    tl, te = self.file(tp, "texture", e["id"], data=not self.dry)
                    if tl is None and te["source"] == "missing":
                        self.note("warn", f"texture {tp} (named by {gp}) is missing", te["id"])
                    texs[i] = tl
                mat = {"shader": mt["shader"], "visible": True, "notes": [], "path": gp, "trace": e["id"],
                       "address": shade.address(mt)}
                if not self.dry:
                    self.pending.append((len(self.materials), mt, texs))
        self._mat_index[gp] = len(self.materials)
        self.materials.append(mat)
        return self._mat_index[gp]

    def bake_all(self):
        """Decode and bake every material's textures, several at once."""
        def one(job):
            i, mt, texs = job
            return i, shade.bake(mt, texs, self.customize, self.customize.get("texSize", 1024))
        with ThreadPoolExecutor(6) as ex:
            for i, mat in ex.map(one, self.pending):
                mat.update(path=self.materials[i]["path"], trace=self.materials[i]["trace"])
                self.materials[i] = mat
                for n in mat.get("notes", []):
                    self.note("info", f"{mat['path']}: {n}", mat["trace"])
                share = mat.get("metalShare", 0)
                if share > 0.5 and mat.get("shader") == "character.shpk" and self.trace[mat["trace"]]["source"] != "game":
                    self.note("warn", f"{mat['path']}: {share:.0%} of it uses a fully metallic colour-table row. In game, metal "
                                      f"gets no diffuse light and looks dark apart from reflections. If that isn't meant, the "
                                      f"_id map's green is probably inverted (G=255 picks the pair's first row, G=0 the second).",
                              mat["trace"])
        self.pending = []

    # ---------------------------------------------------------------- models
    def model(self, gp, slot, wearer, parent=None, **info):
        local, e = self.file(gp, "model", parent, slot=slot, **info)
        if local is None:
            if e["source"] == "missing" and info.get("expect", True):
                self.note("error" if info.get("required") else "warn", f"{slot}: {gp} doesn't exist, nothing is drawn", e["id"])
            return None, e
        try:
            return game.model(local), e
        except Exception as ex:      # noqa: BLE001
            self.note("error", f"{gp} doesn't parse: {ex}", e["id"])
            return None, e


def equipment_material_path(name, folder, material_id, wearer, body_id):
    n = name.lstrip("/")
    if n.startswith("chara/"):
        return n
    m = re.match(r"mt_c\d{4}b\d{4}_(.+\.mtrl)$", n)
    if m:   # skin: the game's ResolveSkinMtrlPath picks the wearer's (nearest skinned ancestor's) body material
        r = M.skin_race(wearer)
        return f"chara/human/{r}/obj/body/b{body_id:04d}/material/v0001/mt_{r}b{body_id:04d}_{m.group(1)}"
    return f"{folder}/material/v{material_id:04d}/{n}"


def human_material_path(name, wearer, face_id=None):
    """Face and ear materials have no variant folder; hair, tail and body use v0001. Hair materials follow
    Penumbra.GameData's MaterialHandling: styles 101-200 share the Midlander's (Miqo'te keep their own for 101-115),
    Hrothgar always use their own; Hrothgar tails all use t0001's materials. Face materials take the face id the
    model was loaded for (face_id), in folder and file name, whatever id the material name carries: the game asks
    a face-5 model's "/mt_c0201f0001_x.mtrl" as f0005/material/mt_c0201f0005_x.mtrl (seen in Penumbra's log for a
    face mod that shipped its materials under f0001 only, which was then invisible on faces 2-5)."""
    n = name.lstrip("/")
    if n.startswith("chara/"):
        return n
    m = re.match(r"mt_(c\d{4})([fhtzb])(\d{4})_(.+\.mtrl)$", n)
    if not m:
        return None
    race, t, i, rest = m.groups()
    if t == "h":
        hid = int(i)
        gender = M.GENDER_RACE.get(wearer, ("Male",))[0]
        mid = "c0201" if gender == "Female" else "c0101"
        if wearer in ("c1501", "c1601"):
            race = wearer
        elif 101 <= hid <= 115:
            race = wearer if wearer in ("c0701", "c0801") else mid
        elif 116 <= hid <= 200:
            race = mid
        else:
            race = wearer
    if t == "t" and race in ("c1501", "c1601"):
        i = "0001"
    if t == "f" and face_id:
        i = f"{int(face_id):04d}"
    ver = "" if t in ("f", "z") else "v0001/"
    return f"chara/human/{race}/obj/{TYPE[t]}/{t}{i}/material/{ver}mt_{race}{t}{i}_{rest}"


def character(resolved, spec, dry=False):
    """spec: race, clan, face, hair, tail, ear, body, height, gear {slot: [set, variant] | None}, and colours as
    palette indices (skinIndex, hairIndex, highlightIndex or None, eyeIndex) or as RGB in customize."""
    race = spec.get("race", "c0101")
    cust = dict(spec.get("customize") or {})
    female = M.GENDER_RACE[race][0] == "Female"
    clan = int(spec.get("clan") or 0)
    if clan not in C.clans(race):
        clan = C.clans(race)[0]
    for kind in ("skin", "hair", "highlight", "eye"):           # the game's own colours for these palette indices
        if spec.get(f"{kind}Index") is not None:
            cust[kind] = C.color(kind, clan, female, spec[f"{kind}Index"])
    if "hairIndex" in spec and spec.get("highlightIndex") is None:
        cust["highlight"] = cust.get("hair")                   # highlights off
    design = dict(spec.get("design") or {})                    # a Glamourer design's advanced colours win
    paint = int(spec.get("facePaint") or 0)
    paint_color = design.pop("decal", None) or (C.paint_color(spec.get("facePaintIndex") or 0).round(4).tolist() + [1.0])
    if spec.get("facePaintReversed"):                          # flipped: the shader reads u' = -u + 1
        cust["paintScale"], cust["paintOffset"] = [-1.0], [1.0]
    cust.update(design)
    L = Loader(resolved, cust, dry)
    gear = {s: spec.get("gear", {}).get(s) for s in M.EQUIP + M.ACCES}
    body_id = int(spec.get("body", 1))
    models = []

    # skeletons: base, then EST extras for face / hair / head / body
    sk = S.Skeleton()
    base_gp = f"chara/human/{race}/skeleton/base/b0001/skl_{race}b0001.sklb"

    def add_skeleton(gp, label, parent=None):
        local, e = L.file(gp, "skeleton", parent, slot=label)
        if local:
            try:
                sk.add(S.load_sklb(local), label)
            except Exception as ex:   # noqa: BLE001
                L.note("warn", f"{gp}: skeleton not readable here ({ex})", e["id"])
        return e

    add_skeleton(base_gp, "base")
    face = int(spec.get("face", 1))
    for cand in C.face_candidates(race, clan, face):
        gp = f"chara/human/{race}/obj/face/f{cand:04d}/model/{race}f{cand:04d}_fac.mdl"
        if (L.res and L.res.lookup(gp)[0]) or game.exists(gp)[0]:
            face = cand
            break
    ids = {"face": existing_part(L, race, "face", "f", "fac", face),
           "hair": existing_part(L, race, "hair", "h", "hir", int(spec.get("hair", 1)))}
    est = [("Face", ids["face"], "face", race), ("Hair", ids["hair"], "hair", race)]
    for s, est_slot in (("met", "Head"), ("top", "Body")):
        if gear.get(s):      # head / body skeletons follow the race of the model the game picks
            est.append((est_slot, int(gear[s][0]), s, L.meta.model_race(race, int(gear[s][0]), s)[0]))
    for est_slot, sid, label, est_race in est:
        v, src = L.meta.est_entry(est_slot, est_race, sid)
        if v:
            e = add_skeleton(M.est_skeleton(est_slot, est_race, v), label)
            e["est"] = {"slot": est_slot, "set": sid, "skeleton": v, "source": src}

    # EQP of what is worn decides which slots and parts show
    eqp = {}
    for s in M.EQUIP:
        g = gear.get(s)
        if g:
            eqp[s] = L.meta.eqp_entry(int(g[0]), s)
        else:
            eqp[s] = (None, "empty slot")
    atr_off = [m.get("Attribute") for m, _ in (resolved.manips_of("Atr") if resolved else []) if m.get("Entry") is False]
    vis = V.Visibility(eqp, race, gear, atr_off, spec.get("features", 0), spec.get("beard", False))

    def add_model(mdl, e, slot, model_race, imc=None, part_kind="equip"):
        mats = []
        folder = e["request"].rsplit("/model/", 1)[0]
        for name in mdl["materials"]:
            if part_kind == "equip":
                gp = equipment_material_path(name, folder, (imc or {}).get("MaterialId", 1), race, body_id)
            elif part_kind == "human":
                fm = re.search(r"/obj/face/f(\d{4})$", folder)
                gp = human_material_path(name, race, fm.group(1) if fm else None)
            else:
                gp = nonhuman_material_path(name, folder, (imc or {}).get("MaterialId", 1))
            mats.append(L.material(gp, e["id"]) if gp else -1)
            if gp is None:
                L.note("warn", f"{e['request']}: can't place material name {name}", e["id"])
        deform = None
        if model_race != race:
            deform = S.chain(model_race, race)
        models.append({"slot": slot, "trace": e["id"], "mdl": mdl, "materials": mats, "deform": deform,
                       "modelRace": model_race, "imc": imc, "hidden": vis.slot_hidden(slot),
                       "attrs": vis.attributes(slot, mdl, imc)})

    for s in M.EQUIP + M.ACCES:
        g = gear.get(s)
        acc = s in M.ACCES
        if not g:
            if acc or s == "met":
                continue
            g = [0, 1]            # smallclothes
        set_id, variant = int(g[0]), int(g[1])
        model_race, chain = L.meta.model_race(race, set_id, s)
        folder = f"chara/accessory/a{set_id:04d}" if acc else f"chara/equipment/e{set_id:04d}"
        gp = f"{folder}/model/{model_race}{'a' if acc else 'e'}{set_id:04d}_{s}.mdl"
        idx = (M.ACCES if acc else M.EQUIP).index(s)
        imc, imc_src, imc_path = L.meta.imc_entry("accessory" if acc else "equipment", set_id, 0, idx, variant, s)
        mdl, e = L.model(gp, s, race, eqdp=chain, set=set_id, variant=variant, required=True,
                         imc={"entry": imc, "source": imc_src, "file": imc_path},
                         eqp={"bits": eqp.get(s, (None,))[0], "source": eqp.get(s, (None, ""))[1]} if not acc else None)
        if imc is None and set_id:
            L.note("warn", f"{s}: e{set_id:04d} has no IMC entry for variant {variant}; the game falls back to variant 0's",
                   e["id"])
            imc, _, _ = L.meta.imc_entry("accessory" if acc else "equipment", set_id, 0, idx, 0, s)
        if model_race != race:
            e["deformer"] = f"{model_race} -> {race}"
        if mdl:
            add_model(mdl, e, s, model_race, imc or {"MaterialId": 1, "AttributeMask": 0x3FF})
            models[-1]["stains"] = [int(x or 0) for x in list(g[2:4])]

    # face, hair, tail, ears
    parts = [("face", "f", ids["face"], "fac", True)]
    parts.append(("hair", "h", ids["hair"], "hir", True))
    if race in TAIL_RACES:
        parts.append(("tail", "t", int(spec.get("tail", 1)), "til", True))
    if race in EAR_RACES:
        parts.append(("zear", "z", int(spec.get("ear", 1)), "zer", True))
    for kind, t, pid, suf, req in parts:
        pid = existing_part(L, race, kind, t, suf, pid)
        gp = f"chara/human/{race}/obj/{kind}/{t}{pid:04d}/model/{race}{t}{pid:04d}_{suf}.mdl"
        mdl, e = L.model(gp, kind, race, required=req)
        model_race = race
        if mdl is None and kind == "hair" and e["source"] == "missing":
            r = race
            while mdl is None and r in M.FALLBACK:
                r = M.FALLBACK[r]
                gp2 = f"chara/human/{r}/obj/hair/h{pid:04d}/model/{r}h{pid:04d}_hir.mdl"
                mdl, e2 = L.model(gp2, kind, race, parent=e["id"], expect=False)
                if mdl is not None:
                    e, model_race = e2, r
                    e["deformer"] = f"{r} -> {race}"
        if mdl:
            add_model(mdl, e, kind, model_race, part_kind="human")

    # shape keys switched on by what else is worn (vanilla: hair shp_hib under a hat; Penumbra: shpx_ connectors
    # shared by neighbouring pieces, and Shp manipulations)
    by_slot = {m["slot"]: m for m in models if not m["hidden"]}
    names = {s: {x["name"] for x in m["mdl"]["shapes"]} for s, m in by_slot.items()}
    shp_on = [mm for mm, _ in (resolved.manips_of("Shp") if resolved else []) if mm.get("Entry") is True]
    for m in models:
        own = names.get(m["slot"], set())
        on = []
        if m["slot"] == "hair" and "met" in by_slot and "shp_hib" in own:
            on.append("shp_hib")
        for prefix, a, b in (("shpx_wr_", "top", "glv"), ("shpx_wa_", "top", "dwn"), ("shpx_an_", "dwn", "sho")):
            if m["slot"] in (a, b):
                on += [n for n in own if n.startswith(prefix) and n in names.get(a, ()) and n in names.get(b, ())]
        for mm in shp_on:
            slot = M.SLOT_OF_NAME.get(mm.get("Slot"), (mm.get("Slot") or "").lower() or None)
            if mm.get("Shape") in own and (slot is None or slot in (m["slot"], "unknown")):
                on.append(mm["Shape"])
        m["shapesOn"] = sorted(set(on))
    for p in vis.problems:
        L.note(*p)
    # the character's face paint: the game binds it as the decal of whatever is drawn in the face slot (a face mod's
    # character.shpk material with the decal key on shows it too), read through the mod and collection like any file
    if paint:
        gp = C.FACE_PAINT.format(paint)
        for m in models:
            if m["slot"] == "face" and not m["hidden"]:
                local, e = L.file(gp, "texture", m["trace"], slot="face paint")
                if local is None:
                    L.note("warn", f"face paint {paint}: {gp} is missing", e["id"])
                else:
                    m["decal"], m["decalColor"] = gp, [float(x) for x in paint_color]
    rsp = [mm for mm, _ in (resolved.manips_of("Rsp") if resolved else [])]
    scale = C.height_scale(clan, female, spec.get("height", 50), rsp)
    bust = C.bust_scale(clan, female, spec.get("bust", 50), rsp)
    return finish(L, sk, models, race, {"eqp": vis.summary(), "subject": "character", "clan": clan, "scale": scale,
                                        "bust": bust,
                                        "faceId": ids["face"], "hairId": ids["hair"]})


def existing_part(L, race, kind, t, suf, pid):
    """Customize ids that don't exist for this race (second-clan faces start at 101, Hrothgar women's hair at
    101, ...) are swapped for the nearest one that does, with a note."""
    def path(i):
        return f"chara/human/{race}/obj/{kind}/{t}{i:04d}/model/{race}{t}{i:04d}_{suf}.mdl"
    if L.res and L.res.lookup(path(pid))[0] or game.exists(path(pid))[0]:
        return pid
    probe = [pid + 100, pid + 200] + list(range(1, 12)) + list(range(101, 112)) + list(range(201, 212))
    have = [i for i, ok in zip(probe, game.exists(*[path(i) for i in probe])) if ok]
    if have:
        L.note("info", f"{race} has no {kind} {pid}; showing {kind} {have[0]} instead")
        return have[0]
    return pid


def nonhuman_material_path(name, folder, material_id):
    n = name.lstrip("/")
    if n.startswith("chara/"):
        return n
    return f"{folder}/material/v{material_id:04d}/{n}"


def creature(resolved, spec, dry=False):
    """spec: kind (monster | demihuman | weapon), id, body (or equip set), variant, slots for demihumans."""
    kind = spec["kind"]
    pid, sid, variant = int(spec["id"]), int(spec.get("body", 1)), int(spec.get("variant", 1))
    L = Loader(resolved, dict(spec.get("customize") or {}), dry)
    sk = S.Skeleton()
    letter = {"monster": "m", "demihuman": "d", "weapon": "w"}[kind]
    skel = f"chara/{kind}/{letter}{pid:04d}/skeleton/base/b0001/skl_{letter}{pid:04d}b0001.sklb"
    local, e = L.file(skel, "skeleton", slot="base")
    if local:
        try:
            sk.add(S.load_sklb(local), "base")
        except Exception as ex:   # noqa: BLE001
            L.note("warn", f"{skel}: skeleton not readable here ({ex}); shown in bind pose", e["id"])
    models = []
    if kind == "demihuman":
        targets = [(s, f"chara/demihuman/d{pid:04d}/obj/equipment/e{sid:04d}/model/d{pid:04d}e{sid:04d}_{s}.mdl", i)
                   for i, s in enumerate(M.EQUIP)]
    elif kind == "monster":
        targets = [("body", f"chara/monster/m{pid:04d}/obj/body/b{sid:04d}/model/m{pid:04d}b{sid:04d}.mdl", 0)]
    else:
        targets = [("weapon", f"chara/weapon/w{pid:04d}/obj/body/b{sid:04d}/model/w{pid:04d}b{sid:04d}.mdl", 0)]
    for slot, gp, part in targets:
        imc, imc_src, imc_path = L.meta.imc_entry(kind, pid, sid, part, variant, slot if kind == "demihuman" else None)
        mdl, e = L.model(gp, slot, None, required=kind != "demihuman", expect=kind != "demihuman",
                         imc={"entry": imc, "source": imc_src, "file": imc_path}, variant=variant)
        if not mdl:
            continue
        imc = imc or {"MaterialId": 1, "AttributeMask": 0x3FF}
        folder = gp.rsplit("/model/", 1)[0]
        mats = [L.material(nonhuman_material_path(n, folder, imc.get("MaterialId", 1)), e["id"]) for n in mdl["materials"]]
        prefix = {"met": "mv", "top": "tv", "glv": "gv", "dwn": "dv", "sho": "sv"}.get(slot, ("bv", "parts"))
        models.append({"slot": slot, "trace": e["id"], "mdl": mdl, "materials": mats, "deform": None,
                       "modelRace": None, "imc": imc, "hidden": None,
                       "attrs": V.variant_attributes(mdl, imc, prefix)})
    return finish(L, sk, models, None, {"subject": kind})


def address_mismatch(uv, n, addr):
    """Where the game's non-wrap texture addressing samples a different texel than wrapping would: the share of
    vertices on such tiles and the tile ranges, or None. Vertices on a tile edge count as inside the tile next door."""
    if not n:
        return None             # an empty mesh (no vertices) samples nothing
    uv = np.asarray(uv, np.float32).reshape(n, -1)[:, :2]
    lo, hi = np.floor(uv + 1e-3), np.floor(uv - 1e-3)
    inside = lo == hi
    off = np.zeros(n, bool)
    for ax in (0, 1):
        if addr[ax] == 1:
            off |= inside[:, ax] & (lo[:, ax] % 2 != 0)
        elif addr[ax] >= 2:
            off |= inside[:, ax] & (lo[:, ax] != 0)
    if not off.any():
        return None
    t = np.floor(uv)
    return {"share": float(off.mean()), "u": [int(t[:, 0].min()), int(t[:, 0].max())],
            "v": [int(t[:, 1].min()), int(t[:, 1].max())]}


def finish(L, sk, models, race, extra):
    """Pack meshes into one binary blob; bones map to the merged skeleton."""
    L.bake_all()
    index = {n: i for i, n in enumerate(sk.names)}
    blob = bytearray()

    def put(a):
        a = np.ascontiguousarray(a)
        while len(blob) % 4:
            blob.append(0)
        off = len(blob)
        blob.extend(a.tobytes())
        return [off, int(a.size)]

    out_models = []
    unknown = {}
    decal_noted = set()
    for m in models:
        mdl = m["mdl"]
        bones = mdl["bones"]
        gidx = np.array([index.get(b, -1) for b in bones] + [-1], np.int32)
        missing = [b for b in bones if b not in index]
        deform = None
        if m["deform"] is not None:
            deform = []
            for b in bones:
                d = S.deform_matrix(m["deform"], b, sk.parent)
                deform.append((d if d is not None else np.eye(4)).T.reshape(-1).tolist())
        meshes = []
        used_missing = set()
        for k, me in enumerate(mdl["meshes"]):
            bi = me["bi"].astype(np.int64)
            bi = np.where(bi == 0xFFFF, len(bones), bi)
            bi = np.minimum(bi, len(bones))
            w = me["bw"]
            for b in np.unique(bi[w > 0]):
                if b < len(bones) and gidx[b] < 0:
                    used_missing.add(bones[b])
            shapes = []
            for s in mdl["shapes"]:
                for p in s["parts"]:
                    if p["mesh"] == k and p["count"]:
                        vals = p["values"].astype(np.int64)
                        if vals[:, 0].max() >= me["indexCount"]:   # stored relative to the whole LOD's index buffer
                            vals = vals - np.array([me["startIndex"], 0])
                        shapes.append({"name": s["name"], "values": put(vals.astype(np.uint32))})
            meshes.append({"material": m["materials"][mdl["materials"].index(me["material"])] if me["material"] in mdl["materials"] else -1,
                           "materialName": me["material"], "vertexCount": me["vertexCount"],
                           "pos": put(me["pos"]), "nrm": put(me["nrm"]), "uv": put(me["uv"]),
                           "col": put(me["col"]), "bi": put(bi.astype(np.uint16)), "bw": put(me["bw"]),
                           "idx": put(me["idx"]), "hasUv1": me["hasUv1"], "badBoneRefs": me["badBoneRefs"],
                           "submeshes": [{"start": s["start"], "count": s["count"], "attrs": s["attrs"]} for s in me["submeshes"]],
                           "colorMeans": me.get("colorMeans") or {},
                           "shapes": shapes})
            mi = meshes[-1]["material"]
            shader = (L.materials[mi].get("shader") or "") if mi >= 0 else ""
            if m["slot"] == "face" and mi >= 0 and mi not in decal_noted and L.trace[L.materials[mi]["trace"]]["source"] != "game" \
                    and shader in ("character.shpk", "characterlegacy.shpk") \
                    and L.trace[L.materials[mi]["trace"]].get("decalKey", DECAL_OFF) != DECAL_OFF:
                decal_noted.add(mi)
                dk = L.trace[L.materials[mi]["trace"]]["decalKey"]
                L.note("warn", f"{L.materials[mi]['path']}: {shader}'s decal key (0x{DECAL_KEY:08X}) is on "
                                f"(0x{dk:08X}, as body gear has it for Free Company "
                                f"crests). In the face slot the game binds the character's face paint as that decal, so any "
                                f"face paint is painted over this material in game (Sora 1.1.0's face and eyes went dark "
                                f"grey-brown). Set it to 0x{DECAL_OFF:08X} (no decal) unless that is wanted.",
                       L.materials[mi]["trace"])
            c0 = (me.get("colorMeans") or {}).get("0")
            if shader in ("character.shpk", "characterlegacy.shpk") and L.trace[m["trace"]]["source"] != "game"                     and c0 and max(c0[:3]) < 0.25:
                L.note("error", f"{L.trace[m['trace']]['request']} mesh {k} ({me['material']}): vertex colour set 0 is "
                                f"near black ({', '.join(f'{x:.2f}' for x in c0)}); Dawntrail {shader} multiplies the "
                                f"surface by it, so it renders black in game", m["trace"])
            addr = (L.materials[mi].get("address") or {}).get("color") if mi >= 0 else None
            if addr and any(addr) and L.trace[m["trace"]]["source"] != "game":
                bad = address_mismatch(me["uv"], me["vertexCount"], addr)
                if bad:
                    how = "/".join(shade.MODES[x] for x in addr)
                    L.note("warn", f"{L.trace[m['trace']]['request']} mesh {k} ({me['material']}): the material samples "
                                    f"with {how} addressing (U/V, from its sampler flags), and {bad['share']:.0%} of the "
                                    f"mesh's UVs sit on tiles where that isn't wrapping (u {bad['u'][0]}..{bad['u'][1]}, "
                                    f"v {bad['v'][0]}..{bad['v'][1]}). The game "
                                    f"{'mirrors' if 1 in addr else 'clamps'} the texture there, so it lands in the wrong "
                                    f"place. Fix: clear the low 4 bits of the sampler flags (wrap), or move the UVs "
                                    f"into 0..1.", m["trace"])
            if me["badBoneRefs"]:
                L.note("error", f"{L.trace[m['trace']]['request']} mesh {k}: {me['badBoneRefs']} weights point outside the bone table",
                       m["trace"])
        if used_missing:
            unknown[m["trace"]] = sorted(used_missing)
            L.note("error", f"{L.trace[m['trace']]['request']}: weighted to bones the loaded skeletons don't have: "
                            f"{', '.join(sorted(used_missing)[:12])}{' ...' if len(used_missing) > 12 else ''}", m["trace"])
        out_models.append({"slot": m["slot"], "trace": m["trace"], "request": L.trace[m["trace"]]["request"],
                           "source": L.trace[m["trace"]]["source"], "modelRace": m["modelRace"],
                           "bones": [int(x) for x in gidx[:-1]], "boneNames": bones, "deform": deform,
                           "hidden": m["hidden"], "attrs": m["attrs"], "meshes": meshes,
                           "attributes": mdl["attributes"], "shapeNames": [s["name"] for s in mdl["shapes"]],
                           "radius": mdl["radius"], "flags": [mdl["flags1"], mdl["flags2"]], "unknownBones": sorted(used_missing),
                           "shapesOn": m.get("shapesOn", [])})
    render = {"redirects": L.render_redirects(), "models": [
        {"slot": m["slot"], "mdl": L.trace[m["trace"]]["request"], "stains": m.get("stains") or [],
         "materials": [L.materials[i]["path"] if i >= 0 and not L.materials[i].get("missing") else None for i in m["materials"]],
         **({"decal": m["decal"], "decalColor": m["decalColor"]} if m.get("decal") else {})}
        for m in models],
        "customize": {k: v for k, v in L.customize.items() if k in ("skin", "hair", "highlight", "eye", "eyeLeft", "lip", "option",
                                                                     "muscle", "leftW", "rightW", "paintScale", "paintOffset")}}
    scene = {"race": race, "skeleton": sk.to_json(), "models": out_models, "materials": L.materials,
             "trace": L.trace, "problems": L.problems, "render": render, **extra}
    return scene, bytes(blob)
