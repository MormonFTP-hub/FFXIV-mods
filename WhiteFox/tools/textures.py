"""Build the FFXIV textures (Dawntrail character.shpk layout) from the baked Pink Paws albedo (bake_src.py).

Per texture set (texsets.SETS), atlas pieces pasted into their rectangles (texsets.RECT):
  _base  RGB colour (dye baked in), A = 255                                                        BC7
  _mask  R specular, G roughness (per set), B = 255: no baked occlusion. The game adds its own (GTAO)
         and real shadows; the rip's ORM occlusion on top of them doubled the darkening (dark rings
         round the eyes on the Loki port in game; reproduced and fixed there in GS)                 BC7
  _norm  RG the rip's tangent normal (green flipped: the rip's maps are green-down, FFXIV's green-up;
         checked per map with curl_test), B = opacity where the set alpha-tests (hair strand tips, tail
         strands), A = 255                                                                          BC7
Pieces without a normal map get a flat normal; every set shares one empty _id (no glow).
Gear-shader sets get the colour lift (texsets.LIFT, Neon 1.2.0's lift()) on the way into _base.

Skin sets (texsets.SKIN_SHADER: her face and her body skin) are for skin.shpk instead, as vanilla skin is (on the
gear shader, ported skin goes grey and dim whenever the sun isn't on it; found on the Sora and Jotaro ports):
  _base  her skin texels rescaled so their mean is the vanilla Midlander woman's skin (VANILLA_SKIN); the game then
         multiplies them by the character's skin colour
  _norm  RG normal, B = how much the character's skin colour tints each texel (her skin texels, blurred; make-up,
         lips, nails, the forehead mark and the grey scalp stay as they are), A = 0 (no lipstick)
  _mask  the face: vanilla's flat face mask (FACE_MASK); the body keeps the template's shared skin mask
"""
import os
import pickle
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import srcdata as sd  # noqa: E402
import xivdata as xd  # noqa: E402
from texsets import CUTOUT, LIFT, SETS, SKIN_SHADER, members  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "tex")
GAME_DIR = "chara/equipment/e6173/texture/whitefox"
FLAT = 64
ALPHA_SETS = {"hair", "acc"}     # sets whose _norm carries opacity
AO_FLOOR = 0.35
AO_SCALE = 0.0                   # x the material's aoIntensity: 0 = the game's own occlusion only (see _mask above)
NORMAL_MAX = 1024                # normal / mask resolution cap per piece
VANILLA_SKIN = np.array([177, 145, 130]) / 255   # vanilla c0201 face f0001 / body skin texel mean (sRGB)
FACE_MASK = (151, 108, 160, 255)                 # vanilla face _mask means: specular, roughness, B


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


def img(path, w, h, mode="RGBA"):
    im = Image.open(path).convert(mode)
    if im.size != (w, h):
        im = im.resize((w, h), Image.LANCZOS)
    return np.asarray(im).copy()


def curl_test(name):
    """Median curl / gradient of the slope field read green-up and green-down: a real normal map comes from a
    height field, so the right reading is (nearly) curl-free."""
    a = img(os.path.join(sd.TEX, name + ".png"), 1024, 1024, "RGB").astype(float) / 127.5 - 1
    nx, ny = a[..., 0], a[..., 1]
    nz = np.sqrt(np.clip(1 - nx ** 2 - ny ** 2, 1e-3, 1))
    res = {}
    for label, sign in (("green up", 1), ("green down", -1)):
        p, q = -nx / nz, -(sign * ny) / nz
        dp = -(p[2:, 1:-1] - p[:-2, 1:-1]) / 2
        dq = (q[1:-1, 2:] - q[1:-1, :-2]) / 2
        g = np.abs(dp) + np.abs(dq) + 1e-6
        m = g > 0.02
        res[label] = float(np.median(np.abs(dp - dq)[m] / g[m])) if m.any() else 0.0
    return res


def piece(material, kind, w, h):
    """One source material's normal (RG, green flipped to FFXIV's green-up) or occlusion at w x h."""
    m = sd.scene()["materials"][material]
    if kind == "norm":
        if not m["normal"]:
            return np.full((h, w, 2), 128, np.uint8)
        n = img(os.path.join(sd.TEX, m["normal"] + ".png"), w, h, "RGB")
        c = curl_test(m["normal"])
        flip = c["green down"] < c["green up"]
        print(f"   {m['normal']}: curl up {c['green up']:.3f} down {c['green down']:.3f} -> "
              f"{'flip G' if flip else 'keep G'}")
        return np.dstack([n[..., 0], 255 - n[..., 1] if flip else n[..., 1]])
    k = float(m["inputs"].get("aoIntensity", 0) or 0) * AO_SCALE
    if not m["orm"] or k <= 0:
        return np.full((h, w), 255, np.uint8)
    ao = img(os.path.join(sd.TEX, m["orm"] + ".png"), w, h, "RGB")[..., 0].astype(float) / 255
    ao = 1 - k * (1 - ao)
    return (np.maximum(ao, AO_FLOOR) * 255 + 0.5).astype(np.uint8)


def compose(ts, kind, W, H):
    """A set's normal (H, W, 2) or occlusion (H, W) map, its pieces pasted into their rectangles."""
    out = np.full((H, W, 2), 128, np.uint8) if kind == "norm" else np.full((H, W), 255, np.uint8)
    for mat, (x, y, w, h) in members(ts):
        pw, ph = round(w * W), round(h * H)
        x0, y0 = round(x * W), round(y * H)
        out[y0:y0 + ph, x0:x0 + pw] = piece(mat, kind, pw, ph)
    return out


def opacity(ts, rgba):
    """Alpha-test mask of a set: the albedo alpha, kept only in the cut-out pieces (whole set for the hair)."""
    a = rgba[..., 3]
    if ts == "hair":
        return a
    H, W = a.shape
    keep = np.zeros((H, W), bool)
    for mat, (x, y, w, h) in members(ts):
        if mat in CUTOUT:
            keep[round(y * H):round((y + h) * H), round(x * W):round((x + w) * W)] = True
    return np.where(keep, a, 255).astype(np.uint8)


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


LUMA = np.array([0.2126, 0.7152, 0.0722])


def lift(rgb, gamma, sat):
    """Brighter colours (Neon's lift): luminance (sRGB-encoded) to the power 1/gamma with the hue kept, then
    saturation x sat in linear light; a channel past white scales the whole pixel down, keeping the hue."""
    lin = srgb_to_lin(rgb.astype(np.float64) / 255)
    y = lin @ LUMA
    lin *= (srgb_to_lin(lin_to_srgb(y) ** (1 / gamma)) / np.maximum(y, 1e-6))[..., None]
    y = lin @ LUMA
    lin = np.maximum(y[..., None] + (lin - y[..., None]) * sat, 0)
    peak = np.maximum(lin.max(-1, keepdims=True), 1.0)
    return (lin_to_srgb(lin / peak) * 255 + 0.5).astype(np.uint8)


def brighten(ts, rgb):
    """The set's colour lift (texsets.LIFT), if any."""
    if ts not in LIFT:
        return rgb
    out = lift(rgb, *LIFT[ts])
    print(f"  lift {LIFT[ts]}: mean sRGB {np.round(rgb.reshape(-1, 3).mean(0))} -> {np.round(out.reshape(-1, 3).mean(0))}")
    return out


def skin_texels(rgb):
    """Skin-coloured texels (warm, mid saturation, not dark): what the character's skin colour should tint (Sora)."""
    rgb = rgb.astype(np.float64) / 255
    mx, mn = rgb.max(2), rgb.min(2)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    return (rgb[..., 0] > rgb[..., 1]) & (rgb[..., 1] > rgb[..., 2]) & (mx > 110 / 255) & (sat > 0.2) & (sat < 0.65)


def box_blur(a, passes=2):
    for _ in range(passes):
        p = np.pad(a, 1, mode="edge")
        a = sum(p[1 + dy:p.shape[0] - 1 + dy, 1 + dx:p.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9
    return a


def skin_set(ts, rgba, out):
    """_base, _norm (and the face's _mask) for skin.shpk."""
    H, W = rgba.shape[:2]
    rgb = rgba[..., :3]
    sk = skin_texels(rgb)
    mean = rgb[sk].mean(0) / 255
    ratio = VANILLA_SKIN / mean
    print(f"  skin.shpk: {sk.mean() * 100:.0f}% skin texels, mean {np.round(mean * 255)} -> x{np.round(ratio, 3)}")
    base = np.clip(rgb.astype(np.float64) * ratio, 0, 255).astype(np.uint8)
    out[f"{ts}_base"] = write(f"{ts}_base", np.dstack([base, np.full((H, W), 255, np.uint8)]), "bc7")
    n = compose(ts, "norm", W, H)
    tint = (box_blur(sk.astype(np.float64)) * 255 + 0.5).astype(np.uint8)
    out[f"{ts}_norm"] = write(f"{ts}_norm", stack(n[..., 0], n[..., 1], tint, np.zeros((H, W), np.uint8)), "bc7")
    if ts == "head":
        out[f"{ts}_mask"] = write(f"{ts}_mask", stack(*[np.full((FLAT, FLAT), v) for v in FACE_MASK]), "bc7")


def build():
    out = {}
    flat = np.full((FLAT, FLAT), 255, np.uint8)
    zero = np.zeros((FLAT, FLAT), np.uint8)
    out["flat_id"] = write("flat_id", stack(zero, zero, zero, flat), "bc5")
    for ts, (W, H, spec, rough) in SETS.items():
        print(ts)
        rgba = img(os.path.join(sd.ALBEDO, f"set_{ts}.png"), W, H)
        if ts in SKIN_SHADER:
            skin_set(ts, rgba, out)
            continue
        out[f"{ts}_base"] = write(f"{ts}_base", np.dstack([brighten(ts, rgba[..., :3]), np.full((H, W), 255, np.uint8)]), "bc7")
        k = max(1, max(W, H) // (2 * NORMAL_MAX)) if ts not in ALPHA_SETS else 1
        mw, mh = W // k, H // k
        out[f"{ts}_mask"] = write(f"{ts}_mask", stack(np.full((mh, mw), spec), np.full((mh, mw), rough),
                                                      compose(ts, "ao", mw, mh), np.full((mh, mw), 255)), "bc7")
        n = compose(ts, "norm", mw, mh)
        a = opacity(ts, rgba) if ts in ALPHA_SETS else np.full((mh, mw), 255, np.uint8)
        out[f"{ts}_norm"] = write(f"{ts}_norm", stack(n[..., 0], n[..., 1], a, np.full((mh, mw), 255)), "bc7")
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


if __name__ == "__main__":
    build()
