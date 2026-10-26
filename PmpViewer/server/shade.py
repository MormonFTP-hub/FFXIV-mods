"""Approximate FFXIV materials for the WebGL viewer: each .mtrl and its textures are baked into a colour map
(RGB + opacity), a tangent normal map and a roughness/metalness map, following the shader package's conventions.

Dawntrail character.shpk:  _id R = colour-table row pair (round(value / 17)), G = 255 the pair's first row,
                           0 its second (Penumbra's exporter and TexTools' converter agree);
                           _mask R specular, G roughness, B occlusion; _norm RG normal, B opacity;
                           optional _base (g_SamplerDiffuse) multiplies the table colour.
Legacy (pre-Dawntrail):    _n RG normal, B opacity, A = 16-row table position; _d diffuse, _s specular.
skin.shpk:                 _base x lerp(1, skin colour, _norm B); _base A opacity.
Sampler flags bits 0-1 / 2-3 are the U / V address modes (Penumbra SamplerFlags: 0 wrap, 1 mirror, 2 clamp, 3 border).
The bake stays in texture space; the viewer samples each baked map with its source sampler's modes.
hair.shpk:                 lerp(hair, highlight, _norm B) x _mask A; _norm A opacity.
iris.shpk:                 _base x lerp(1, eye colour, _mask B).
"""
import hashlib
import io
import json
import os

import numpy as np
from PIL import Image

import game

S_NORMAL, S_MASK, S_INDEX, S_DIFFUSE, S_SPECULAR = 0x0C5EC1F1, 0x8A4E82B6, 0x565F8FD8, 0x115306BE, 0x2B99E025
C_ALPHA_THRESHOLD = 0x29AC0223
F_HIDE_BACKFACES, F_TRANSPARENCY = 0x1, 0x10
BAKED = os.path.join(game.CACHE, "baked")
INVISIBLE = ("characterocclusion.shpk", "crystal.shpk")


def _role(sampler_id, path):
    r = {S_NORMAL: "normal", S_MASK: "mask", S_INDEX: "index", S_DIFFUSE: "diffuse", S_SPECULAR: "specular"}.get(sampler_id)
    if r:
        return r
    stem = os.path.splitext(os.path.basename(path))[0].lower()
    for suf, role in (("_norm", "normal"), ("_n", "normal"), ("_mask", "mask"), ("_m", "mask"), ("_id", "index"),
                      ("_base", "diffuse"), ("_d", "diffuse"), ("_diff", "diffuse"), ("_s", "specular"), ("_spec", "specular")):
        if stem.endswith(suf):
            return role
    return None


MODES = ("wrap", "mirror", "clamp", "border")


def address(mtrl):
    """[U, V] address mode per baked map, from the sampler its texels come from."""
    by_role = {}
    for s in mtrl["samplers"]:
        if 0 <= s["tex"] < len(mtrl["textures"]):
            r = _role(s["id"], mtrl["textures"][s["tex"]]["path"])
            if r and r not in by_role:
                by_role[r] = [s["flags"] & 3, s["flags"] >> 2 & 3]

    def first(*roles):
        return next((by_role[r] for r in roles if r in by_role), [0, 0])
    color, lit = first("diffuse", "index", "normal"), first("mask", "specular", "normal")
    return {"color": color, "emissive": color, "normal": first("normal"), "orm": lit, "spec": lit}


def _fit(img, h, w):
    if img.shape[0] == h and img.shape[1] == w:
        return img.astype(np.float32) / 255
    # channel by channel: PIL premultiplies RGBA by alpha when resizing, which blacks out maps (normals with a
    # lipstick or colour-table alpha) whose alpha is a data channel, not opacity
    chans = img[..., None] if img.ndim == 2 else img
    out = [np.asarray(Image.fromarray(np.ascontiguousarray(chans[..., c])).resize((w, h), Image.BILINEAR))
           for c in range(chans.shape[2])]
    return (np.dstack(out) if img.ndim == 3 else out[0]).astype(np.float32) / 255


def _png(a, key, name):
    os.makedirs(BAKED, exist_ok=True)
    p = os.path.join(BAKED, f"{key}_{name}.png")
    if not os.path.exists(p):
        tmp = p[:-4] + f".{os.getpid()}.tmp.png"
        Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8)).save(tmp, compress_level=1)
        try:
            os.replace(tmp, p)
        except PermissionError:     # another thread wrote the same bake and it is being read (Windows): keep that one
            os.remove(tmp)
    return os.path.basename(p)


def bake(mtrl, textures, customize, max_size=1024):
    """mtrl: parsed material; textures: {texture slot index: local .tex path or None}.
    Returns the material description the viewer uses (texture names are files in work/cache/baked)."""
    shader = mtrl["shader"]
    flags = mtrl["flags"]
    consts = {c["id"]: c["values"] for c in mtrl["constants"]}
    alpha_threshold = (consts.get(C_ALPHA_THRESHOLD) or [0])[0]
    out = {"shader": shader, "doubleSided": not flags & F_HIDE_BACKFACES, "transparent": bool(flags & F_TRANSPARENCY),
           "alphaTest": alpha_threshold, "visible": shader not in INVISIBLE, "notes": [], "address": address(mtrl)}
    roles = {}
    for s in mtrl["samplers"]:
        if 0 <= s["tex"] < len(mtrl["textures"]):
            r = _role(s["id"], mtrl["textures"][s["tex"]]["path"])
            if r and r not in roles:
                roles[r] = s["tex"]
    for i, t in enumerate(mtrl["textures"]):      # textures no sampler points at (older materials)
        r = _role(None, t["path"])
        if r and r not in roles:
            roles[r] = i
    out["roles"] = {r: mtrl["textures"][i]["path"] for r, i in roles.items()}

    srcs = {r: textures.get(i) for r, i in roles.items()}
    missing = [r for r, p in srcs.items() if p is None]
    if missing:
        out["notes"].append("missing texture: " + ", ".join(missing))
    used = {"skin": ("skin",), "hair": ("hair", "highlight"), "iris": ("eye",)}.get(shader.replace(".shpk", ""), ())
    key_src = json.dumps([shader, flags, mtrl["rows"], {k: customize.get(k) for k in used}, max_size, mtrl["textures"],
                          {r: game.file_hash(p) for r, p in srcs.items() if p}], sort_keys=True)
    key = hashlib.sha1(("v6" + key_src).encode()).hexdigest()[:16]     # v6: skin mask red check
    meta = os.path.join(BAKED, key + ".json")
    with game.lock_for("bake:" + key):          # materials sharing a .mtrl bake once, not side by side
        res = game.read_json(meta)
        if res is None:
            res = _bake_maps(mtrl, srcs, customize, max_size, key, out)
            game.write_json(meta, res)
    out.update(res)
    return out


def _bake_maps(mtrl, srcs, customize, max_size, key, out):
    shader, flags = mtrl["shader"], mtrl["flags"]

    imgs = {r: game.texture(p) for r, p in srcs.items() if p}
    h, w = 4, 4
    for a in imgs.values():
        h, w = max(h, a.shape[0]), max(w, a.shape[1])
    if max(h, w) > max_size:
        s = max_size / max(h, w)
        h, w = max(1, int(h * s)), max(1, int(w * s))
    f = {r: _fit(a, h, w) for r, a in imgs.items()}
    ones = np.ones((h, w), np.float32)
    color = np.ones((h, w, 3), np.float32)
    alpha = ones.copy()
    rough = ones * 0.7
    metal = ones * 0.0
    emissive = None
    spec = None            # RGB specular colour (sRGB), A specular strength
    nrm = f.get("normal")
    rows = mtrl["rows"]
    kind = shader.replace(".shpk", "")

    if kind in ("character", "characterlegacy", "characterglass", "characterstockings", "charactertattoo",
                "characterreflection", "charactertransparency", "characterinc", "characterscroll", "bg", "bgprop"):
        # characterlegacy keeps the pre-Dawntrail meaning of its textures even with a Dawntrail-format table: the
        # third texture (_s) is a specular colour (every vanilla one is grey), gloss is the rows' shininess (half 3,
        # blended per pixel by the index map like the other row fields), and nothing is metal or occluded.
        legacy = kind == "characterlegacy" or mtrl.get("table") == "legacy"
        table_color = table_rough = table_metal = table_emis = table_spec = table_shine = table_sid = None
        if rows and mtrl.get("table") == "dawntrail" and "index" in f:
            idx = f["index"]
            pair = np.clip(np.round(idx[..., 0] * 255 / 17), 0, len(rows) // 2 - 1).astype(np.int64)
            blend = 1 - idx[..., 1][..., None]
            r0, r1 = 2 * pair, 2 * pair + 1

            def lerp(field):
                v = np.array([row.get(field, 0) for row in rows], np.float32)
                v = v if v.ndim == 2 else v[:, None]
                return v[r0] * (1 - blend) + v[r1] * blend
            table_color, table_emis, table_spec = lerp("diffuse"), lerp("emissive"), lerp("specular")
            table_rough, table_metal = lerp("roughness")[..., 0], lerp("metalness")[..., 0]
            table_shine = lerp("scalar3")[..., 0]
            sid = np.array([row.get("shader", 0) for row in rows])
            table_sid = np.where(blend[..., 0] < 0.5, sid[r0], sid[r1])
        elif rows and mtrl.get("table") == "legacy" and nrm is not None and imgs["normal"].shape[2] == 4:
            pos = nrm[..., 3] * 15
            lo = np.clip(np.floor(pos), 0, 15).astype(np.int64)
            hi = np.clip(lo + 1, 0, 15)
            t = (pos - lo)[..., None]

            def lerp(field):
                v = np.array([row[field] for row in rows], np.float32)
                v = v if v.ndim == 2 else v[:, None]
                return v[lo] * (1 - t) + v[hi] * t
            table_color, table_emis, table_spec = lerp("diffuse"), lerp("emissive"), lerp("specular")
            table_shine = lerp("shininess")[..., 0]
        elif rows and "index" not in f and mtrl.get("table") == "dawntrail":
            table_color = np.broadcast_to(np.array(rows[0]["diffuse"], np.float32), (h, w, 3))
            table_spec = np.broadcast_to(np.array(rows[0]["specular"], np.float32), (h, w, 3))
            out["notes"].append("no index texture: colour-table row 0 used")
        if "diffuse" in f:
            color = f["diffuse"][..., :3] ** 2.2       # sRGB texture
            if legacy or mtrl.get("table") != "dawntrail":
                alpha = f["diffuse"][..., 3]
        if table_color is not None:
            color = color * np.clip(table_color, 0, 4)
        if table_emis is not None and table_emis.max() > 0.01:
            emissive = np.clip(table_emis, 0, 1)
        spec_color = np.clip(table_spec, 0, 1) if table_spec is not None else np.ones((h, w, 3), np.float32)
        if "specular" in f:
            spec_color = spec_color * f["specular"][..., :3] ** 2.2
        spec_int = ones * 0.5
        if "mask" in f:
            m = f["mask"]
            spec_int = m[..., 0]
        if legacy:
            # _s RGB scales the rows' specular colour; a green-heavy _s gives green highlights in game (Aerith 1.2.0
            # wrote gloss into G). Shininess is a Blinn-Phong power (vanilla rows ~3 broad to 32 tight):
            # roughness = sqrt(2 / (power + 2)).
            if "mask" in f:
                spec_color = spec_color * f["mask"][..., :3]
                spec_int = ones
            shine = table_shine if table_shine is not None else ones * 20
            rough = np.sqrt(2 / (np.clip(shine, 0.5, None) + 2))
        else:
            if "mask" in f:
                rough = m[..., 1] * (table_rough if table_rough is not None else 1)
                # mask blue is occlusion on rows whose shader id is 0, 7, 10, 12 or >= 17 (Penumbra and TexTools both
                # multiply it into the colour)
                if table_sid is None:
                    color = color * m[..., 2:3]
                else:
                    ao = np.isin(table_sid, (0, 7, 10, 12)) | (table_sid >= 17)
                    color = color * np.where(ao[..., None], m[..., 2:3], 1)
            elif table_rough is not None:
                rough = table_rough
            if table_metal is not None:
                metal = table_metal
        spec = np.dstack([np.clip(spec_color, 0, 1) ** (1 / 2.2), np.clip(spec_int, 0, 1)])
        if nrm is not None:
            alpha = alpha * nrm[..., 2]
        if kind == "characterglass":
            out["transparent"] = True
            alpha = alpha * 0.35
        color = color ** (1 / 2.2)
    elif kind == "skin":
        skin = np.array(customize.get("skin", [0.93, 0.76, 0.65]), np.float32)
        base = f["diffuse"][..., :3] ** 2.2 if "diffuse" in f else ones[..., None] * 0.6
        tint = 1 + (skin ** 2.2 - 1) * (nrm[..., 2:3] if nrm is not None else 1)
        color = np.clip(base * tint, 0, 1) ** (1 / 2.2)
        if "mask" in f:
            rough = f["mask"][..., 1]
            spec = np.dstack([ones, ones, ones, f["mask"][..., 0]])
            # mask red selects the skin material in steps of 17 (vanilla faces and Bibo+ use 165 -> 10); other
            # values render grey in game (Aerith 1.2.0-1.5.0: grey face with pink patches where red reached 165)
            skin_px = (nrm[..., 2] > 0.5) if nrm is not None else ones > 0
            sel = np.round(f["mask"][..., 0] * 255 / 17)[skin_px]
            off = float((sel != 10).mean()) if sel.size else 0.0
            if off > 0.1:
                out["notes"].append(f"skin mask red is off the skin material (165) on {off:.0%} of skin texels; "
                                    f"in game those render grey")
        if "diffuse" in f:
            alpha = f["diffuse"][..., 3]
    elif kind == "hair":
        hair = np.array(customize.get("hair", [0.32, 0.2, 0.12]), np.float32) ** 2.2
        hl = np.array(customize.get("highlight", customize.get("hair", [0.32, 0.2, 0.12])), np.float32) ** 2.2
        mix = nrm[..., 2:3] if nrm is not None else 0
        color = hair + (hl - hair) * mix
        if "mask" in f:
            color = color * f["mask"][..., 3:4]
            rough = f["mask"][..., 1]
            spec = np.dstack([ones, ones, ones, f["mask"][..., 0]])
        color = np.clip(color * ones[..., None], 0, 1) ** (1 / 2.2)
        if nrm is not None:
            alpha = nrm[..., 3]
    elif kind == "iris":
        eye = np.array(customize.get("eye", [0.35, 0.5, 0.65]), np.float32)
        base = f["diffuse"][..., :3] if "diffuse" in f else ones[..., None]
        k = f["mask"][..., 2:3] if "mask" in f else 1
        color = np.clip(base * (1 + (eye - 1) * k), 0, 1)
        rough = ones * 0.15
    else:
        if out["visible"]:
            out["notes"].append(f"shader {shader} shown as plain grey")
        color = ones[..., None] * np.array([0.6, 0.6, 0.62], np.float32)
        if "diffuse" in f:
            color = f["diffuse"][..., :3]

    res = {"color": _png(np.dstack([np.clip(color, 0, 1), np.clip(alpha, 0, 1)]), key, "color"),
           "size": [w, h]}
    if nrm is not None:
        x, y = nrm[..., 0] * 2 - 1, nrm[..., 1] * 2 - 1
        z = np.sqrt(np.clip(1 - x * x - y * y, 0, 1))
        res["normal"] = _png(np.dstack([x * 0.5 + 0.5, y * 0.5 + 0.5, z * 0.5 + 0.5]), key, "normal")
    res["orm"] = _png(np.dstack([ones, np.clip(rough, 0.04, 1), np.clip(metal, 0, 1)]), key, "orm")
    if emissive is not None:
        res["emissive"] = _png(emissive, key, "emissive")
    if spec is not None:
        res["spec"] = _png(spec, key, "spec")
    res["alphaUsed"] = bool((alpha < 0.98).any())
    seen = alpha > 0.5
    res["metalShare"] = float((np.asarray(metal) * np.ones_like(alpha) > 0.5)[seen].mean()) if seen.any() else 0.0
    return res