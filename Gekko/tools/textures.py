"""Build the FFXIV textures (Dawntrail character.shpk layout) from the Kingdom Archives Gekko textures (work/src/tex).

Per texture set:  _base  RGB colour                                                                BC7
                  _norm  RG tangent normal, green up (the rip's nm.png is green-down: curl_test() reads it as
                         0.33 green-down against 1.0 green-up), B opacity (always 1)                 BC7
                  _mask  R specular, G roughness (the rip's ORM green), B occlusion (ORM red)         BC7
                  _id    R colour-table row pair (always 0), G picks within the pair: 255 = the first row
                         (plain), 0 = the second (metal), so G = 255 - the rip's ORM blue             BC5
                         (1.0.x wrote G = metal, which put 96-100% of every material on the metal row: near-black
                         in game and in GS)
Sets:
  main    df / nm / orm as they are (UV0): clothes, hair, face, hands, body skin
  tattoo  his bare arms and neck. Their UV0 is mirrored left/right, and the viewer draws a copy of them with
          decal_df on UV1 (alpha blended) for the tattoos, so this set is baked into UV1 space, which is unique:
          colour = df (UV0) under decal_df (UV1), normals turned from UV0's tangent frame into UV1's.
"""
import os
import pickle
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import raster  # noqa: E402
import srcdata as sd  # noqa: E402
import xivdata as xd  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "tex")
GAME_DIR = "chara/equipment/e6229/texture/gekko"
TATTOO_PRIMS = (8, 9)
# texset -> (size, specular 0-255)
TEXSETS = {"main": (2048, 70), "tattoo": (2048, 60)}
# texset -> (luminance gamma, saturation) for the _base colour (Neon 1.2.0's lift, which the user asked for on every
# mod: "this like color intensity is what im looking for"). Both sets are character.shpk, skin included.
LIFT = {"main": (1.4, 1.2), "tattoo": (1.4, 1.2)}
LUMA = np.array([0.2126, 0.7152, 0.0722])
FLAT = 64


def png(name, size=None, mode="RGB"):
    im = Image.open(os.path.join(sd.TEX, name + ".png")).convert(mode)
    if size and im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).copy()


def write(name, rgba, fmt):
    os.makedirs(OUT, exist_ok=True)
    raw = os.path.join(OUT, name + ".raw")
    np.ascontiguousarray(rgba, np.uint8).tofile(raw)
    dst = os.path.join(OUT, name + ".tex")
    out = subprocess.run(xd.XIVTOOL + ["rgba2tex", raw, str(rgba.shape[1]), str(rgba.shape[0]), dst, fmt],
                         capture_output=True, text=True)
    os.remove(raw)
    if out.returncode != 0 or "wrote" not in out.stdout:
        raise RuntimeError(out.stdout + out.stderr)
    print(" ", out.stdout.strip())
    return dst


def stack(*chans):
    shape = next(np.shape(c) for c in chans if np.ndim(c) == 2)
    return np.stack([np.broadcast_to(np.asarray(c, np.uint8), shape) for c in chans], -1)


def curl_test(name="nm"):
    """Median curl / gradient of the slope field read green-up and green-down: a real normal map comes from a height
    field, so the right reading is (nearly) curl-free."""
    a = png(name, 1024).astype(float) / 127.5 - 1
    nx, ny = a[..., 0], a[..., 1]
    nz = np.sqrt(np.clip(1 - nx ** 2 - ny ** 2, 1e-3, 1))
    res = {}
    for label, sign in (("green up", 1), ("green down", -1)):
        p, q = -nx / nz, -(sign * ny) / nz
        dp = -(p[2:, 1:-1] - p[:-2, 1:-1]) / 2
        dq = (q[1:-1, 2:] - q[1:-1, :-2]) / 2
        g = np.abs(dp) + np.abs(dq) + 1e-6
        m = g > 0.02
        res[label] = float(np.median(np.abs(dp - dq)[m] / g[m]))
    return res


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def lift(rgb, gamma, sat):
    """Brighter colours (Neon's lift): luminance (sRGB-encoded) to the power 1/gamma with the hue kept, then
    saturation x sat in linear light; a channel past white scales the pixel down, keeping the hue."""
    lin = srgb_to_lin(rgb.astype(np.float64) / 255)
    y = lin @ LUMA
    lin *= (srgb_to_lin(lin_to_srgb(y) ** (1 / gamma)) / np.maximum(y, 1e-6))[..., None]
    y = lin @ LUMA
    lin = np.maximum(y[..., None] + (lin - y[..., None]) * sat, 0)
    peak = np.maximum(lin.max(-1, keepdims=True), 1.0)
    return (lin_to_srgb(lin / peak) * 255 + 0.5).astype(np.uint8)


def frames(pos, uv, faces):
    """Per triangle orthonormal tangent frame (T, B, N) for v-up UVs; B follows the UV handedness."""
    p0, p1, p2 = (pos[faces[:, k]] for k in range(3))
    t0, t1, t2 = (uv[faces[:, k]] for k in range(3))
    e1, e2, d1, d2 = p1 - p0, p2 - p0, t1 - t0, t2 - t0
    r = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
    r = np.where(np.abs(r) > 1e-12, r, 1e-12)
    T = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) / r[:, None]
    Bv = (e2 * d1[:, 0:1] - e1 * d2[:, 0:1]) / r[:, None]
    N = np.cross(e1, e2)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
    T -= N * np.sum(T * N, 1, keepdims=True)
    T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-12)
    B = np.cross(N, T)
    B *= np.where(np.sum(B * Bv, 1, keepdims=True) < 0, -1.0, 1.0)
    return T, B, N


def bake_tattoo(size):
    """Colour, green-up normal and ORM of the arms and neck in UV1 space."""
    m = sd.mesh()
    faces = m["faces"][np.isin(m["prim"], TATTOO_PRIMS)]
    tri, bary = raster.rasterize(m["uv1"], faces, size, pad=3)
    hit = tri >= 0
    t = tri[hit]
    w = bary[hit]
    f = faces[t]
    uv0 = np.einsum("nk,nkc->nc", w, m["uv0"][f])
    uv1 = np.einsum("nk,nkc->nc", w, m["uv1"][f])
    df = png("df").astype(np.float32) / 255
    decal = png("decal_df", mode="RGBA").astype(np.float32) / 255
    nm = png("nm").astype(np.float32) / 127.5 - 1
    orm = png("orm").astype(np.float32)
    base = srgb_to_lin(raster.sample(df, uv0))
    d = raster.sample(decal, uv1)
    a = d[:, 3:4]
    col = lin_to_srgb(base * (1 - a) + srgb_to_lin(d[:, :3]) * a)
    print(f"  tattoo: {hit.mean() * 100:.0f}% of UV1 covered, decal over {np.mean(a > 0.05) * 100:.0f}% of it")

    # normals: green-down UV0 map -> green-up, then from UV0's tangent frame into UV1's (glTF v down -> v up)
    n0 = raster.sample(nm, uv0)
    n0[:, 1] *= -1
    vup = np.array([1.0, -1.0])
    T0, B0, N0 = frames(m["pos"], m["uv0"] * vup, faces)
    T1, B1, _ = frames(m["pos"], m["uv1"] * vup, faces)
    wv = n0[:, :1] * T0[t] + n0[:, 1:2] * B0[t] + n0[:, 2:3] * N0[t]
    n1 = np.stack([np.sum(wv * T1[t], 1), np.sum(wv * B1[t], 1), np.sum(wv * N0[t], 1)], 1)
    n1 /= np.maximum(np.linalg.norm(n1, axis=1, keepdims=True), 1e-9)

    out_col = np.zeros((size, size, 3), np.float32)
    out_n = np.tile(np.array([0.0, 0.0, 1.0], np.float32), (size, size, 1))
    out_orm = np.tile(np.array([255.0, 230.0, 0.0], np.float32), (size, size, 1))
    out_col[hit] = col
    out_n[hit] = n1
    out_orm[hit] = raster.sample(orm, uv0)
    # fill the empty texels with the mean skin colour so mip levels don't bleed black into the seams
    out_col[~hit] = col.mean(0)
    return (out_col * 255 + 0.5).astype(np.uint8), ((out_n + 1) * 127.5 + 0.5).clip(0, 255).astype(np.uint8), \
        out_orm.clip(0, 255).astype(np.uint8)


def build():
    print("normal map curl (lower = right reading):", curl_test())
    out = {}
    flat = np.full((FLAT, FLAT), 255, np.uint8)
    zero = np.zeros((FLAT, FLAT), np.uint8)
    out["flat_id"] = write("flat_id", stack(zero, flat, zero, flat), "bc5")      # G 255: the plain row
    for texset, (size, spec) in TEXSETS.items():
        print(texset)
        if texset == "tattoo":
            base, n, o = bake_tattoo(size)
            Image.fromarray(base).save(os.path.join(sd.TEX, "tattoo_base.png"))     # for the fit previews
            n = np.asarray(Image.fromarray(n).resize((1024, 1024), Image.LANCZOS))
            o = np.asarray(Image.fromarray(o).resize((1024, 1024), Image.LANCZOS))
        else:
            base = png("df", size)
            n = png("nm", 1024)
            n = np.dstack([n[..., 0], 255 - n[..., 1], n[..., 2]])                  # green-down -> green-up
            o = png("orm", 1024)
        if texset in LIFT:
            base = lift(base, *LIFT[texset])
        ones = np.full(base.shape[:2], 255, np.uint8)
        out[f"{texset}_base"] = write(f"{texset}_base", np.dstack([base, ones]), "bc7")
        ns = n.shape[0]
        out[f"{texset}_norm"] = write(f"{texset}_norm", stack(n[..., 0], n[..., 1], np.full((ns, ns), 255),
                                                              np.full((ns, ns), 255)), "bc7")
        ms = o.shape[0]
        out[f"{texset}_mask"] = write(f"{texset}_mask", stack(np.full((ms, ms), spec), o[..., 1], o[..., 0],
                                                              np.full((ms, ms), 255)), "bc7")
        metal = o[..., 2]
        if metal.max() > 40:
            out[f"{texset}_id"] = write(f"{texset}_id", stack(np.zeros((ms, ms)), 255 - metal, np.zeros((ms, ms)),
                                                              np.full((ms, ms), 255)), "bc5")
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


def has(texset, kind):
    return os.path.exists(os.path.join(OUT, f"{texset}_{kind}.tex"))


if __name__ == "__main__":
    build()
