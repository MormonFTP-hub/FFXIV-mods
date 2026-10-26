"""WoW textures -> Dawntrail character.shpk texture sets (base / norm / mask / id).

    _base  RGB albedo, A opacity                                    BC7
    _norm  RG tangent normal (green up), B opacity                  BC7
    _mask  R specular, G roughness factor, B occlusion              BC7
    _id    R colour-table row pair * 17, G = 255 the pair's first row, 0 its second  BC5

WoW paints its lighting into flat, unlit textures; FFXIV lights everything, so each
set gets a normal map built from the painted detail and a mask, and the WoW glow
maps become emissive through the colour table (id G picks the emissive odd row).
Colour lift (1.3.0): every _base RGB goes through Neon's lift (LIFT, lift()); the glow rows are untouched.
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from build_models import VOID_TILES  # noqa: E402
from wowsrc import ROOT  # noqa: E402

SRC = ROOT / "source/wow/creature/dragonhawk2voidmount"
XIVTOOL = ROOT / "apps/xivtool/xivtool.exe"
WORK = ROOT / "work/tex"
TEX_DIR = "chara/demihuman/d0001/obj/equipment/e0001/texture"
OUT = ROOT / "work/mod" / TEX_DIR

# colour-table row pairs (rows 2p and 2p+1)
PAIR = {"feather": 0, "gem": 1, "gold": 2, "steel": 3, "void": 4, "eye": 5, "trim": 6}
# Colour lift (1.3.0, Neon's, the user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color
# intensity is what im looking for"). texture set -> (luminance gamma, saturation), applied to each _base RGB (alpha is
# opacity and stays). The glow (the _id maps' emissive rows) is unchanged.
LIFT = {"feather": (1.4, 1.2), "armour": (1.4, 1.2), "void": (1.4, 1.2), "eye": (1.4, 1.2)}
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


def lifted(rgb, texset):
    """rgb (float 0..1, sRGB-encoded) with LIFT[texset] applied."""
    if texset not in LIFT:
        return rgb
    rgb8 = np.clip(rgb * 255 + 0.5, 0, 255).astype(np.uint8)
    return lift(rgb8, *LIFT[texset]).astype(np.float32) / 255


def load(name, size=None):
    im = Image.open(SRC / name).convert("RGBA")
    if size and im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255


def save(name, rgba, fmt):
    WORK.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    rgba = np.ascontiguousarray(np.clip(rgba * 255 + 0.5, 0, 255).astype(np.uint8))
    Image.fromarray(rgba).save(WORK / f"{name}.png")
    raw = WORK / f"{name}.raw"
    rgba.tofile(raw)
    dst = OUT / f"{name}.tex"
    r = subprocess.run([str(XIVTOOL), "rgba2tex", str(raw), str(rgba.shape[1]), str(rgba.shape[0]), str(dst), fmt],
                       capture_output=True, text=True)
    raw.unlink()
    if r.returncode != 0 or "wrote" not in r.stdout:
        raise RuntimeError(r.stdout + r.stderr)
    print("  ", name, rgba.shape[1], "x", rgba.shape[0], fmt)


def luma(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def blur(a, radius, wrap=False):
    """Separable Gaussian blur (sigma = radius px)."""
    r = max(1, int(radius * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / radius) ** 2)
    k /= k.sum()
    out = a.astype(np.float32)
    for axis in (0, 1):
        p = np.pad(out, [(r, r) if i == axis else (0, 0) for i in range(2)], mode="wrap" if wrap else "edge")
        out = sum(k[i] * np.take(p, np.arange(i, i + out.shape[axis]), axis=axis) for i in range(2 * r + 1))
    return out


def normal_from_height(h, strength, wrap=False):
    if wrap:
        gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / 2
        gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) / 2
    else:
        gy, gx = np.gradient(h)
    n = np.stack([-gx * strength, gy * strength, np.ones_like(h)], -1)   # green up: +y is up the image
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def rgba(*ch):
    return np.stack(ch, -1)


def hsv(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.select([mx == r, mx == g], [(g - b) / np.maximum(d, 1e-6) % 6, (b - r) / np.maximum(d, 1e-6) + 2],
                  (r - g) / np.maximum(d, 1e-6) + 4) * 60
    return h, s, mx


def id_map(pair, blend):
    """blend 0 = the pair's even (first) row, 1 = its odd row. Dawntrail reads _id G = 255 as the FIRST row
    (Penumbra's exporter: rowBlend = 1 - G/255), so G is written inverted."""
    return rgba(np.full_like(blend, pair * 17 / 255), 1 - blend, np.zeros_like(blend), np.ones_like(blend))


def push_pull(rgb, mask):
    """Fill pixels outside mask with the colour of the nearest covered area (mip pyramid push-pull), so
    the game's smaller mips don't bleed the source's black/blue padding into the island edges."""
    levels = [(rgb * mask[..., None], mask.astype(np.float32))]
    while min(levels[-1][1].shape) > 1:
        c, w = levels[-1]
        h2, w2 = c.shape[0] // 2, c.shape[1] // 2
        c = c[:h2 * 2, :w2 * 2].reshape(h2, 2, w2, 2, 3).sum((1, 3))
        w = w[:h2 * 2, :w2 * 2].reshape(h2, 2, w2, 2).sum((1, 3))
        levels.append((c, w))
    c, w = levels[-1]
    fill = c / np.maximum(w, 1e-6)[..., None]
    for c, w in reversed(levels[:-1]):
        up = np.repeat(np.repeat(fill, 2, 0), 2, 1)[:c.shape[0], :c.shape[1]]
        have = w > 0
        fill = np.where(have[..., None], c / np.maximum(w, 1e-6)[..., None], up)
    return np.where(mask[..., None], rgb, fill)


def uv_coverage(geosets, size, uv_kind):
    """Texels covered by the given WoW submeshes' triangles (UVs as build_models remaps them)."""
    from PIL import ImageDraw
    from build_models import uv_fix
    from inspect_src import Gltf
    g = Gltf()
    im = Image.new("L", size, 0)
    d = ImageDraw.Draw(im)
    for gi in geosets:
        p = g.j["meshes"][gi]["primitives"][0]
        tri = g.accessor(p["indices"]).reshape(-1, 3)
        uv = uv_fix(uv_kind, g.accessor(p["attributes"]["TEXCOORD_0"]).astype(float))
        for t in tri:
            d.polygon([(uv[k, 0] * size[0], uv[k, 1] * size[1]) for k in t], fill=255)
    return np.asarray(im) > 0


def feathers():
    print("feathers")
    body = load("dragonhawk2voidmount.png")
    glow = load("dragonhawk2voidmount_glow.png", body.shape[1::-1])
    rgb, alpha = body[..., :3], body[..., 3]
    # FFXIV's lighting darkens the deep navy a lot; lift the shadows a little
    rgb = lifted(push_pull(rgb ** 0.9, alpha > 0.5), "feather")
    save("dh_feather_base", rgba(rgb[..., 0], rgb[..., 1], rgb[..., 2], alpha), "bc7")
    l = luma(body[..., :3])
    h = blur(l, 1.2) * 0.7 + blur(l, 4) * 0.3
    n = normal_from_height(h, 6.0)
    save("dh_feather_norm", rgba(n[..., 0], n[..., 1], alpha, np.ones_like(l)), "bc7")
    edge = np.clip((l - blur(l, 3)) * 4 + 0.5, 0, 1)
    # WoW draws these unlit, so the painted navy edges stay deep; strong white specular turned them grey in GS
    save("dh_feather_mask", rgba(0.12 + 0.18 * edge, 0.85 - 0.15 * edge, 0.6 + 0.4 * np.clip(blur(l, 6) * 3, 0, 1),
                                 np.ones_like(l)), "bc7")
    g = np.clip(luma(glow[..., :3]) * 3.0, 0, 1)
    save("dh_feather_id", id_map(PAIR["feather"], g), "bc5")


def armour():
    print("armour")
    sad = load("dragonhawk2voidmount_saddle.png")
    half = sad.shape[0] // 2
    crop = sad[half:, :half]                                    # void (bottom-left) quadrant
    crop = np.asarray(Image.fromarray((crop * 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)).astype(np.float32) / 255
    rgb, cav = crop[..., :3], crop[..., 3]
    rgb = push_pull(rgb, uv_coverage([13], (1024, 1024), "b"))     # the atlas padding is bright blue
    l = luma(rgb)
    h = blur(l, 1.5) * 0.5 + blur(cav, 1.5) * 0.5
    n = normal_from_height(h, 8.0)
    save("dh_armour_norm", rgba(n[..., 0], n[..., 1], np.ones_like(l), np.ones_like(l)), "bc7")
    hue, sat, val = hsv(blur(rgb[..., 0], 1)[..., None] * [1, 0, 0] + blur(rgb[..., 1], 1)[..., None] * [0, 1, 0]
                        + blur(rgb[..., 2], 1)[..., None] * [0, 0, 1])
    # gems: saturated violet blobs (blurred so plate edges with a purple cast don't count)
    gem = blur(((sat > 0.55) & (hue > 250) & (hue < 310) & (val > 0.3)).astype(np.float32), 3) > 0.5
    gold = (sat > 0.18) & (hue > 25) & (hue < 75) & (val > 0.3) & ~gem
    trim = (val < 0.28) & ~gem & ~gold
    steel = ~gem & ~gold & ~trim                                # the blue-grey plates
    pair = np.select([gem, gold, steel], [PAIR["gem"], PAIR["gold"], PAIR["steel"]], PAIR["trim"])
    for k, m in (("gem", gem), ("gold", gold), ("steel", steel), ("trim", trim)):
        print(f"     {k}: {m.mean() * 100:.0f}%")
    glow = np.where(gem, np.clip((val - 0.2) * 1.6, 0, 1), 0)
    metal = gold | steel
    # the plates are painted mid grey; WoW's armour shading keeps them dark slate, FFXIV daylight made them
    # near white in GS, so darken just the steel
    rgb = np.where(blur(steel.astype(np.float32), 1.5)[..., None] > 0.5, rgb * 0.62, rgb)
    rgb = lifted(rgb, "armour")
    save("dh_armour_base", rgba(rgb[..., 0], rgb[..., 1], rgb[..., 2], np.ones_like(cav)), "bc7")
    save("dh_armour_mask", rgba(np.where(metal, 0.9, 0.4), np.where(metal, 0.6, 0.85), 0.35 + 0.65 * cav,
                                np.ones_like(l)), "bc7")
    save("dh_armour_id", rgba(pair * 17 / 255, 1 - glow, np.zeros_like(l), np.ones_like(l)), "bc5")   # G=255: first row


def void():
    print("void skin")
    neb = load("dragonhawk2voidmount_7228379.png", (512, 512))
    tile = np.tile(neb, (VOID_TILES[1], VOID_TILES[0], 1))
    rgb, wisp = tile[..., :3], tile[..., 3]
    # WoW draws these additively (colour x alpha on top of what's behind); alpha blending
    # with opacity from the same wisp mask gives the same see-through, glowing membranes
    opacity = np.clip(wisp * 0.85 + luma(rgb) * 0.35, 0.12, 0.92)
    base = lifted(rgb * 0.8, "void")
    save("dh_void_base", rgba(base[..., 0], base[..., 1], base[..., 2], opacity), "bc7")
    n = normal_from_height(blur(luma(rgb), 2, True) * 0.6 + blur(wisp, 3, True) * 0.4, 3.0, wrap=True)
    save("dh_void_norm", rgba(n[..., 0], n[..., 1], opacity, np.ones_like(wisp)), "bc7")
    save("dh_void_mask", rgba(np.full_like(wisp, 0.6), np.full_like(wisp, 0.45), np.ones_like(wisp), np.ones_like(wisp)), "bc7")
    save("dh_void_id", id_map(PAIR["void"], np.clip(wisp * 0.8 + luma(rgb) * 0.4, 0, 1)), "bc5")


def eyes():
    print("eyes")
    sw = load("dragonhawk2voidmount_6917795.png")
    one = np.ones(sw.shape[:2], np.float32)
    eye = lifted(sw[..., :3], "eye")
    save("dh_eye_base", rgba(eye[..., 0], eye[..., 1], eye[..., 2], one), "bc7")
    save("dh_eye_norm", rgba(one * 0.5, one * 0.5, one, one), "bc7")
    save("dh_eye_mask", rgba(one, one * 0.2, one, one), "bc7")
    save("dh_eye_id", id_map(PAIR["eye"], np.clip(luma(sw[..., :3]) * 1.5, 0, 1)), "bc5")


def main():
    feathers()
    armour()
    void()
    eyes()


if __name__ == "__main__":
    main()
