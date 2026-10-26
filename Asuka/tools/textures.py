"""FFXIV textures (Dawntrail character.shpk layout) from the bake (work/bake/<texset>_{base,nrm,rough,ao}.png).

Per texture set (head: face, ears, eyes, A10 clips; hair; body: the plugsuit, gloves and boots):
  _base  RGB colour (the source colour texture, baked)                                              BC7
  _norm  RG tangent-space normal of the source surface and its own normal map (OpenGL green, as FFXIV's),
         B opacity (none)                                                                           BC7
  _mask  R specular, G roughness, B occlusion (baked from the source mesh)                          BC7
and one empty _id shared by all (no colour-table blending).
Tripo's roughness is about 0.1 everywhere (skin and hair as glossy as the suit), so only the suit keeps its
variation, around a glossy latex level; the skin is satin and the hair glossy (ROUGH). Matched in the game's shaders
(tools/gloss_ab.py) to the source render, where the suit, hair and face all have sharp highlights; 1.0.x had them
much more matte.
Colour lift (Langley 1.2.0 / Plugsuit 1.1.0, Neon 1.2.0's): every _base, after the skin toning, gets its luminance
raised by a gamma (dark and mid tones most), hue kept, then saturation scaled in linear light (LIFT).
"""
import os
import pickle
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bake  # noqa: E402
import xivdata as xd  # noqa: E402

ROOT = xd.ROOT
BAKE = os.path.join(ROOT, "work", "bake")
OUT = os.path.join(ROOT, "work", "build", "tex")
GAME_DIR = "chara/equipment/e6164/texture/asuka"
SPECULAR = {"head": 40, "hair": 160, "body": 190}
ROUGH = {"head": 175, "hair": 55, "body": None}        # None: from the bake, BODY_ROUGH around the source's median
# Her skin as FFXIV skin. In game (user's screenshot, 1.1.0) her face came out pale grey-white, like porcelain: the
# AI texture's anime skin is paler and greyer (G/R 0.82, B/R 0.72 in GS daylight) than a vanilla face lit the same
# (0.77 / 0.63, a little darker), and the game's grading greys both, so vanilla stays warm and hers went white. The
# 1.1.0 face gloss added a white sheen on top. Skin texels (by hue and saturation, not eyes, lips or the clips) are
# scaled per channel to vanilla's tone, and the face is matte again.
SKIN_GAIN = (0.90, 0.84, 0.765)
SKIN_HUE = (4, 45)              # degrees: her skin's hue range (the clips are red, below; the eyes blue)
SKIN_SAT = (0.06, 0.48)
BODY_ROUGH = (22, 1.2, 15, 120)                         # level, gain on (source - its median), min, max
NECK_SKIN = (0.88, 0.8)         # her neck skin's colour: this share of her cheeks' tone, blended in this much
NECK_SKIN_Y = (0.869, 0.878)    # source heights (figure metres) where the neck skin hands over to the jaw
FLAT = 64
# The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for"
# texset -> (luminance gamma, saturation). The suit backs off to 1.2 / 1.1: its red is already near-pure, and at 1.4 / 1.2
# its red channel clipped on half the suit in GS daylight (46% of the red pixels at 250+, against 11% in 1.1.0), which
# flattened the latex shading into a uniform neon red; 1.2 / 1.1 clips 32% and keeps the shading.
LIFT = {"head": (1.4, 1.2), "hair": (1.4, 1.2), "body": (1.2, 1.1)}
LUMA = np.array([0.2126, 0.7152, 0.0722])


def to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def lift(rgb, gamma, sat):
    """Brighter colours: luminance (sRGB-encoded) to the power 1/gamma with the hue kept, then saturation x sat."""
    lin = to_linear(rgb.astype(np.float64) / 255)
    y = lin @ LUMA
    lin *= (to_linear(to_srgb(y) ** (1 / gamma)) / np.maximum(y, 1e-6))[..., None]
    y = lin @ LUMA
    lin = np.maximum(y[..., None] + (lin - y[..., None]) * sat, 0)
    peak = np.maximum(lin.max(-1, keepdims=True), 1.0)         # a channel past white scales the pixel, keeping hue
    return (to_srgb(lin / peak) * 255 + 0.5).astype(np.uint8)


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


def png(name, mode="RGB", size=None):
    im = Image.open(os.path.join(BAKE, name + ".png")).convert(mode)
    if size and im.size != (size, size):
        im = im.resize((size, size), Image.BILINEAR)
    return np.asarray(im).copy()


def stack(*chans):
    shape = next(np.shape(c) for c in chans if np.ndim(c) == 2)
    return np.stack([np.broadcast_to(np.asarray(c, np.uint8), shape) for c in chans], -1)


def neck_skin_weight(size):
    """Per head texel: how much it is her neck skin (between collar and jaw, near the neck's axis), from the baked
    head mesh rasterised in UV space, grown a few texels for the mips. The fit pushes that skin out to cover the
    wearer's own neck (fit.cover_neck), which turned the AI texture's painted shadow under her chin into a dark band."""
    import labels
    d = np.load(os.path.join(BAKE, "low_head.npz"))
    p = d["pos"]
    r = np.hypot(p[:, 0], p[:, 2] - labels.NECK_Z)
    w = (1 - np.clip((p[:, 1] - NECK_SKIN_Y[0]) / (NECK_SKIN_Y[1] - NECK_SKIN_Y[0]), 0, 1)) * \
        np.clip((0.036 - r) / 0.006, 0, 1)
    return uv_raster(d, w, size)


def face_on_body_weight(size):
    """Per body texel: 1 where the bake gave the suit's texture set a few small pieces of her face (above the collar's
    top edge, near the neck's axis). They draw with the suit's material, so on her matte face they were glossy specks,
    in the face's untoned colour."""
    import labels
    d = np.load(os.path.join(BAKE, "low_body.npz"))
    p = d["pos"]
    w = ((np.hypot(p[:, 0], p[:, 2] - labels.NECK_Z) < 0.07) & (p[:, 1] > labels.collar_top_at(p))).astype(float)
    return uv_raster(d, w, size)


def uv_raster(d, w, size):
    """Per-vertex weights w of a baked mesh part (low_<texset>.npz) rasterised into its UV space (max where triangles
    overlap), grown 4 texels for the mips."""
    uv = np.c_[d["uv"][:, 0], 1 - d["uv"][:, 1]] * size
    out = np.zeros((size, size))
    for tri in d["faces"][w[d["faces"]].max(1) > 0]:
        a, b, c = uv[tri]
        lo = np.clip(np.floor(np.minimum.reduce([a, b, c])).astype(int), 0, size - 1)
        hi = np.clip(np.ceil(np.maximum.reduce([a, b, c])).astype(int), 0, size - 1)
        ys, xs = np.mgrid[lo[1]:hi[1] + 1, lo[0]:hi[0] + 1] + 0.5
        v0, v1 = b - a, c - a
        den = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(den) < 1e-12:
            continue
        dx, dy = xs - a[0], ys - a[1]
        l1 = (dx * v1[1] - v1[0] * dy) / den
        l2 = (v0[0] * dy - dx * v0[1]) / den
        inside = (l1 >= -0.01) & (l2 >= -0.01) & (l1 + l2 <= 1.01)
        val = (1 - l1 - l2) * w[tri[0]] + l1 * w[tri[1]] + l2 * w[tri[2]]
        yy, xx = ys[inside].astype(int), xs[inside].astype(int)
        out[yy, xx] = np.maximum(out[yy, xx], val[inside])
    from PIL import ImageFilter
    grown = Image.fromarray((out * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
    return np.asarray(grown, float) / 255


def skin_tone(base):
    """Her skin texels scaled per channel by SKIN_GAIN, softly by how skin-like (hue, saturation, value) each is."""
    f = base.astype(float) / 255
    mx, mn = f.max(2), f.min(2)
    d = np.maximum(mx - mn, 1e-6)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = (mx - mn) / np.maximum(mx, 1e-6)

    def band(v, lo, hi, soft):
        return np.clip((v - lo + soft) / soft, 0, 1) * np.clip((hi + soft - v) / soft, 0, 1)
    w = band(h, *SKIN_HUE, 4) * band(s, *SKIN_SAT, 0.05) * np.clip((mx - 0.3) / 0.1, 0, 1)
    out = f * (1 - w[..., None]) + f * np.array(SKIN_GAIN) * w[..., None]
    return np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8), float((w > 0.5).mean())


def build():
    out = {}
    zero = np.zeros((FLAT, FLAT), np.uint8)
    out["flat_id"] = write("flat_id", stack(zero, zero, zero, np.full((FLAT, FLAT), 255)), "bc5")
    for texset in bake.TEXSETS:
        print(texset)
        base = png(f"{texset}_base")
        if texset == "head":
            # her neck skin toward her cheeks' tone (NECK_SKIN of it), keeping its detail as a gain
            nw = neck_skin_weight(base.shape[0])[..., None] * NECK_SKIN[1]
            f = base.astype(float)
            lum = f @ [0.3, 0.59, 0.11]
            cheek = np.median(f[(lum > 170) & (f[..., 0] > f[..., 2] + 30)], 0) * NECK_SKIN[0]
            local = np.maximum(f @ [0.3, 0.59, 0.11], 1)[..., None]
            target = cheek * np.clip(local / max(np.median(lum[nw[..., 0] > 0.5]), 1), 0.8, 1.2)
            base = np.clip(f * (1 - nw) + target * nw, 0, 255).astype(np.uint8)
            print(f"  neck skin: {np.mean(nw > 0.05) * 100:.1f}% of the head texture toward {np.round(cheek)}")
            base, share = skin_tone(base)
            print(f"  skin tone: {share * 100:.1f}% of the head texture scaled to vanilla skin by {SKIN_GAIN}")
        face = None
        if texset == "body":
            face = face_on_body_weight(base.shape[0]) > 0.5
            toned, _ = skin_tone(base)
            base = np.where(face[..., None], toned, base)
            print(f"  face pieces on the suit's texture: {face.mean() * 100:.2f}% toned and matte")
        if texset in LIFT:
            base = lift(base, *LIFT[texset])
            print(f"  colour lift {LIFT[texset]}")
        full = np.full(base.shape[:2], 255, np.uint8)
        out[f"{texset}_base"] = write(f"{texset}_base", np.dstack([base, full]), "bc7")
        n = png(f"{texset}_nrm")
        nf = np.full(n.shape[:2], 255, np.uint8)
        out[f"{texset}_norm"] = write(f"{texset}_norm", stack(n[..., 0], n[..., 1], nf, nf), "bc7")
        ao = png(f"{texset}_ao", "L")
        sz = ao.shape
        if ROUGH[texset] is None:
            r = png(f"{texset}_rough", "L", sz[0]).astype(float)
            level, gain, lo, hi = BODY_ROUGH
            med = np.median(r[r > 5])
            rough = np.clip(level + gain * (r - med), lo, hi)
        else:
            rough = np.full(sz, ROUGH[texset])
        spec = np.full(sz, SPECULAR[texset])
        if face is not None:            # the face pieces as matte as the face
            small = np.asarray(Image.fromarray(face.astype(np.uint8) * 255).resize(sz[::-1], Image.NEAREST)) > 0
            spec = np.where(small, SPECULAR["head"], spec)
            rough = np.where(small, ROUGH["head"], rough)
        out[f"{texset}_mask"] = write(f"{texset}_mask", stack(spec, rough, ao, np.full(sz, 255)), "bc7")
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


if __name__ == "__main__":
    build()
