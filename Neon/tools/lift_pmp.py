"""Neon's colour lift for a finished Penumbra pack, for mods whose own texture step can't simply be re-run.

The user (2026-10-25), on seeing Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is
what im looking for" / "i want you to go through every mod you've made and make this saturation change".

Every material in the pack is read with xivtool's mtrljson (Penumbra's own reader, Dawntrail and legacy layouts). The
texture on its colour sampler (g_SamplerDiffuse, 0x115306BE) is lifted with textures.lift (luminance gamma, hue kept,
then saturation), when the pack ships that texture and the shader is one whose colour map is the surface colour:
  lifted   character.shpk, characterlegacy.shpk, characterglass.shpk, characterstockings.shpk, bg-style creatures
  skipped  skin.shpk (the game tints it with the character's skin colour), hair.shpk and iris.shpk (customisation
           colours), charactertattoo.shpk and decals; normal / mask / id / specular maps are never touched
Alpha is kept as it was. BC1 maps stay BC1, uncompressed ones stay BGRA, everything else is written as BC7 (which keeps
alpha; the game reads it like the BC3 it may replace). A texture that some other material uses on a non-colour sampler
is left alone and reported.

python -P -E tools/lift_pmp.py <in.pmp> <out.pmp> [--gamma 1.4 --sat 1.2] [--version X.Y.Z] [--dry]
"""
import argparse
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import zipfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from textures import lift  # noqa: E402

XIVTOOL = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                       "SailorMoon", "apps", "xivtool", "xivtool.exe")      # has mtrljson, tex2png and rgba2tex
DIFFUSE = 0x115306BE
LIFTED_SHADERS = {"character.shpk", "characterlegacy.shpk", "characterglass.shpk", "characterstockings.shpk",
                  "characterscroll.shpk", "bg.shpk", "bgcolorchange.shpk"}
TEX_FORMATS = {0x3420: "bc1", 0x1450: "bgra", 0x1451: "bgra"}               # anything else is written as BC7


def run(*args):
    r = subprocess.run([XIVTOOL, *map(str, args)], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stdout + r.stderr)
    return r.stdout


def file_maps(root):
    """The pack's default Files map and each group option's, as {lower-case game path: local file}."""
    default, options = {}, []
    for name in os.listdir(root):
        if not name.endswith(".json") or name == "meta.json":
            continue
        d = json.load(open(os.path.join(root, name), encoding="utf-8-sig"))

        def local(m):
            return {gp.lower(): os.path.normcase(os.path.join(root, *f.replace("\\", "/").split("/")))
                    for gp, f in m.items()}
        if "Files" in d:
            default.update(local(d["Files"]))
        for o in d.get("Options", []) or []:
            if o.get("Files"):
                options.append(local(o["Files"]))
    return default, options


def decode(path, tmp):
    base = os.path.join(tmp, "dec")
    run("tex2png", path, base)
    w, h = map(int, open(base + ".size").read().split())
    a = np.fromfile(base + ".raw", np.uint8).reshape(h, w, 4).copy()
    os.remove(base + ".raw")
    os.remove(base + ".size")
    return a


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--gamma", type=float, default=1.4)
    ap.add_argument("--sat", type=float, default=1.2)
    ap.add_argument("--version")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    tmp = tempfile.mkdtemp(prefix="lift_pmp_")
    root = os.path.join(tmp, "pack")
    try:
        with zipfile.ZipFile(a.src) as z:
            names = z.namelist()
            z.extractall(root)
        # Each option is resolved on top of the default files, the way Penumbra layers them, so options that replace
        # the same material (outfit pickers) each get their own colour maps lifted. Maps are keyed by the file in the
        # pack, so a texture shipped once under several game paths is lifted once.
        default, options = file_maps(root)
        colour, other, skipped, parsed = {}, set(), {}, {}
        for opt in [{}] + options:
            def res(gp):
                return opt.get(gp, default.get(gp))
            for gp in set(opt) | set(default):
                local = res(gp)
                if not gp.endswith(".mtrl") or not local or not os.path.exists(local):
                    continue
                if local not in parsed:
                    js = os.path.join(tmp, "m.json")
                    run("mtrljson", local, js)
                    parsed[local] = json.load(open(js))
                m = parsed[local]
                for s in m["samplers"]:
                    if s["tex"] >= len(m["textures"]):
                        continue
                    tp = m["textures"][s["tex"]].lower()
                    f = res(tp)
                    if f is None or not os.path.exists(f):
                        continue                    # vanilla texture, not in the pack
                    if s["id"] == DIFFUSE and m["shader"] in LIFTED_SHADERS:
                        colour.setdefault(f, set()).add(gp)
                    elif s["id"] == DIFFUSE:
                        skipped.setdefault(m["shader"], set()).add(f)
                    else:
                        other.add(f)
        done = 0
        for f, mats in sorted(colour.items()):
            tp = os.path.relpath(f, os.path.normcase(root))
            if f in other:
                print(f"  LEFT ALONE, also used as a non-colour map: {tp}")
                continue
            fmt = TEX_FORMATS.get(struct.unpack_from("<I", open(f, "rb").read(8), 4)[0], "bc7")
            rgba = decode(f, tmp)
            before = rgba[..., :3].reshape(-1, 3).mean(0)
            rgba[..., :3] = lift(rgba[..., :3], a.gamma, a.sat)
            print(f"  {tp}: {rgba.shape[1]}x{rgba.shape[0]} {fmt}, mean sRGB {np.round(before)} -> "
                  f"{np.round(rgba[..., :3].reshape(-1, 3).mean(0))} ({len(mats)} materials)")
            if not a.dry:
                raw = os.path.join(tmp, "enc.raw")
                np.ascontiguousarray(rgba).tofile(raw)
                run("rgba2tex", raw, rgba.shape[1], rgba.shape[0], f, fmt)
                os.remove(raw)
            done += 1
        for shader, tps in skipped.items():
            print(f"  skipped {len(tps)} colour maps on {shader}")
        meta = os.path.join(root, "meta.json")
        if a.version and os.path.exists(meta) and not a.dry:
            d = json.load(open(meta, encoding="utf-8-sig"))
            d["Version"] = a.version
            json.dump(d, open(meta, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        if not a.dry:
            os.makedirs(os.path.dirname(os.path.abspath(a.dst)), exist_ok=True)
            with zipfile.ZipFile(a.dst, "w", zipfile.ZIP_DEFLATED) as z:
                for n in names:
                    p = os.path.join(root, *n.replace("\\", "/").split("/"))
                    if os.path.isfile(p):
                        z.write(p, n)
        print(f"{'would lift' if a.dry else 'lifted'} {done} colour maps -> {a.dst}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
