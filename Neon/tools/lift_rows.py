"""Neon's colour lift for materials whose colour lives in the COLOUR TABLE (no diffuse map), e.g. recoloured vanilla gear.

lift_pmp.py lifts colour textures only. A material with no g_SamplerDiffuse on character / characterlegacy takes its
surface colour from the colour-table rows' diffuse (linear), so those rows are lifted instead: linear -> sRGB, Neon's
lift (textures.lift: luminance gamma, hue kept, then saturation), back to linear. Specular, emissive, roughness, dyes,
textures and samplers are left exactly as they are (checked after writing). Materials that do have a diffuse map are
skipped, so nothing is lifted twice. Rows are written with the Limbus build's own xivtool (`mtrlrecolor`, keepDyes).

python -P -E lift_rows.py <in.pmp> <out.pmp> --xivtool <xivtool with mtrlrecolor> [--gamma 1.4 --sat 1.2] [--dry]
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

import numpy as np

sys.path.insert(0, r"E:\FFXIV-mods\Neon\tools")
from textures import lift, to_linear, to_srgb  # noqa: E402

READER = r"E:\FFXIV-mods\SailorMoon\apps\xivtool\xivtool.exe"
DIFFUSE = 0x115306BE
SHADERS = {"character.shpk", "characterlegacy.shpk"}


def mjson(exe, path, tmp):
    js = os.path.join(tmp, "m.json")
    subprocess.run([exe, "mtrljson", path, js], check=True, capture_output=True)
    return json.load(open(js))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--xivtool", required=True)
    ap.add_argument("--gamma", type=float, default=1.4)
    ap.add_argument("--sat", type=float, default=1.2)
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    tmp = tempfile.mkdtemp(prefix="lift_rows_")
    root = os.path.join(tmp, "pack")
    with zipfile.ZipFile(a.src) as z:
        names = z.namelist()
        z.extractall(root)
    mtrls = sorted({n for n in names if n.lower().endswith(".mtrl")})
    done = 0
    for n in mtrls:
        p = os.path.join(root, *n.replace("\\", "/").split("/"))
        m = mjson(READER, p, tmp)
        if m["shader"] not in SHADERS or not m.get("rows"):
            continue
        if any(s["id"] == DIFFUSE for s in m["samplers"]):
            print(f"  skip (has a diffuse map): {n}")
            continue
        rows = np.array([r["diffuse"] for r in m["rows"]], float)
        srgb = to_srgb(np.clip(rows, 0, 1)) * 255
        new = to_linear(lift(srgb, a.gamma, a.sat).astype(float) / 255)
        new = np.where(rows > 1, rows, new)            # leave any HDR (>1) channel as authored
        changed = [i for i in range(len(rows)) if not np.allclose(rows[i], new[i], atol=2e-4)]
        lum = lambda c: c @ np.array([0.2126, 0.7152, 0.0722])
        print(f"  {n} ({m['shader']}): {len(changed)} rows; mean row sRGB "
              f"{np.round(srgb[changed].mean(0)) if changed else '-'} -> "
              f"{np.round(to_srgb(new[changed]).mean(0) * 255) if changed else '-'}")
        if not changed or a.dry:
            done += bool(changed)
            continue
        spec = {"rows": {str(i): {"diffuse": new[i].tolist()} for i in changed}, "keepDyes": True}
        sp = os.path.join(tmp, "spec.json")
        json.dump(spec, open(sp, "w"))
        out = p + ".new"
        r = subprocess.run([a.xivtool, "mtrlrecolor", p, out, sp], capture_output=True, text=True)
        if r.returncode:
            raise SystemExit(r.stdout + r.stderr)
        after = mjson(READER, out, tmp)
        for k in ("shader", "textures", "samplers", "dyes"):
            assert after[k] == m[k], (n, k)
        for i, (r0, r1) in enumerate(zip(m["rows"], after["rows"])):
            for k in r0:
                if k != "diffuse":
                    assert r0[k] == r1[k], (n, i, k)
            if i in changed:
                assert np.allclose(r1["diffuse"], new[i], atol=2e-3, rtol=2e-3), (n, i, r1["diffuse"], new[i])
            else:
                assert r0["diffuse"] == r1["diffuse"], (n, i)
        os.replace(out, p)
        done += 1
    print(f"{'would lift' if a.dry else 'lifted'} the colour-table rows of {done} materials")
    if not a.dry:
        with zipfile.ZipFile(a.dst, "w", zipfile.ZIP_DEFLATED) as z:
            for n in names:
                p = os.path.join(root, *n.replace("\\", "/").split("/"))
                if os.path.isfile(p):
                    z.write(p, n)
        print("wrote", a.dst)
    shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
