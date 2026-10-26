"""Build the FFXIV textures (Dawntrail character.shpk layout) from the Unseen Weaver textures (work/src/tex).

Per texture set:  _base  RGB colour (then Neon's colour lift, LIFT), A = opacity                BC7
                  _norm  RG normal, B = opacity. The rip's maps are DirectX-style (green down): read that
                         way their slopes are closer to curl-free on 4 of the 5 sets, so G is flipped to
                         FFXIV's green-up                                                      BC7
                  _mask  R specular (per set), G roughness (glTF ORM green), B occlusion (ORM red)  BC7
                  _id    R colour-table row pair * 17, G blend between the pair's rows: 255 picks the
                         first (plain) row, 0 the second, which glows (Penumbra: rowBlend = 1 - G/255).
                         Pairs: 0 plain, 1 metal (the gold: the rip's cube-map reflection mask), 2 a
                         second glow colour. Glow, from the rip's own shader terms:
                           thorns  the "flow" glow, time-averaged: flowNoiseColor x flowNoiseIntensity x
                                   flowMaskIntensity x mean(flowTex) x the flow mask tiled by flowMaskUVTile
                                   (the viewer scrolls a band across it; the game can't animate it)
                           trim    the emissive map (hat brim and capelet edges); the collar gem in pair 2  BC5
Baked sets:
  hair    her hair's colour lives in its shadow-colour map on the second UV set (the strand UVs are shared
          between cards), so the hair is re-mapped onto that UV set: colour from the shadow map, opacity from
          the strand mask carried over through each triangle
  eyes    the eye shader's iris and sclera composited into one map in the eyeball's UV space
A model may use at most 4 materials (Penumbra's MdlMaterialMaximum, the most vanilla gear uses), so some texture
sets are packed into one material's atlas (MATERIALS): the trim and the thorns, the two glowing sets, into a 2:1
"trim_thorns" atlas, the eyes and the lashes, both flat-normal sets with a constant mask, into a 2:1 "eyes_lashes"
atlas. build.py moves each part's UVs into its tile; each tile's _id red is moved on to its own colour-table row
pairs (ROW_PAIRS per tile), so materials.py can give each tile its own glow.
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

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "tex")
GAME_DIR = "chara/equipment/e6098/texture/unseen_weaver"
P = "MI_1050508_"
# texset -> (source set, base size, specular 0-255, alpha-tested, emissive map or None)
TEXSETS = {
    "head": ("Head", 2048, 70, True, None),
    "body": ("Body_02", 2048, 80, True, None),
    "dress": ("Equip_02", 2048, 110, True, None),
    "trim": ("Equip_03", 2048, 120, True, "Equip_03"),
    "thorns": ("Equip_01", 2048, 90, True, "Equip_01"),
    "lashes": ("Hair_01", 1024, 40, True, None),
}
# material -> its texture sets as rows of tiles (top row first); the skin (head, body) keeps a material of its own
MATERIALS = {
    "head": [["head"]],
    "body": [["body"]],
    "dress": [["dress"]],
    "trim_thorns": [["trim", "thorns"]],
    "hair": [["hair"]],
    "eyes_lashes": [["eyes", "lashes"]],
}
ROW_PAIRS = 3                 # colour-table row pairs per atlas tile: plain, metal, second glow colour
GLOW_B = 2                    # the pair whose second row glows in the set's second glow colour
GOLD = {"dress": "Equip_02", "trim": "Equip_03"}     # sets whose cube-map reflection mask marks gold (-> metal)
GEM = "Equip_04"              # the collar gem: drawn from the trim's texture, glows in the trim's pair 2
# lit_look(): the viewer's glowing parts as colour, tuned in the game-shader renderer (tools/gs_render.py)
PETAL, PETAL_MIX = (185, 232, 255), 0.9      # rose petals: pale icy cyan
CRACKLE = (0, 40, 70)                        # added along the flow's veins on the thorns
GEM_COLOUR = (175, 232, 255)
GOLD_LIFT = 2.2
HAIR_TINT = (0.92, 1.04, 1.28)               # the shadow-colour map is greyer and redder than the viewer's hair
# Colour lift (1.2.0, Neon 1.2.0's): the user on Neon 1.2.0, "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like
# color intensity is what im looking for". texset -> (luminance gamma, saturation), applied to the finished colour
# (after lit_look and the hair and eye bakes). The lashes set (brow, lash and wisp cards) stays as it was.
LIFT = {t: (1.4, 1.2) for t in ("head", "body", "dress", "trim", "thorns", "hair", "eyes")}
LUMA = np.array([0.2126, 0.7152, 0.0722])
# a tile's stand-in for a map its set doesn't have (the shared flat one's colour)
FILL = {"norm": (128, 128, 255, 255), "id": (0, 255, 0, 255)}
CUTOFF = 0.3333               # the rip's alpha-mask cutoff; the game's is 0.5
METAL = 0.5                   # ORM blue above this -> the metal row pair
FLAT = 64
HAIR_SIZE = 2048
EYE_SIZE = 512
IRIS_R = 0.143                # iris radius in eye UV (the eye material's irisUvRadius)


def png(name, size=None, mode="RGBA"):
    im = Image.open(os.path.join(sd.TEX, P + name + ".png")).convert(mode)
    if size and im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).copy()


def to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def lift(rgb, gamma, sat):
    """Brighter colours (Neon's): luminance (sRGB-encoded) to the power 1/gamma with the hue kept, then saturation x sat
    in linear light; a channel past white scales the whole pixel down, keeping the hue."""
    lin = to_linear(rgb.astype(np.float64) / 255)
    y = lin @ LUMA
    lin *= (to_linear(to_srgb(y) ** (1 / gamma)) / np.maximum(y, 1e-6))[..., None]
    y = lin @ LUMA
    lin = np.maximum(y[..., None] + (lin - y[..., None]) * sat, 0)
    peak = np.maximum(lin.max(-1, keepdims=True), 1.0)
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


def stack(*chans):
    shape = next(np.shape(c) for c in chans if np.ndim(c) == 2)
    return np.stack([np.broadcast_to(np.asarray(c, np.uint8), shape) for c in chans], -1)


def cut(alpha):
    return np.where(alpha.astype(float) / 255 >= CUTOFF, 255, 0).astype(np.uint8)


def dilate(img, filled, iters=12):
    """Grow filled texels into empty ones, so mips and filtering at island edges keep the right colour."""
    img, filled = img.copy(), filled.copy()
    for _ in range(iters):
        if filled.all():
            break
        acc = np.zeros(img.shape, float)
        cnt = np.zeros(filled.shape, float)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            f = np.roll(filled, (dy, dx), (0, 1))
            acc += np.roll(img, (dy, dx), (0, 1)) * f[..., None]
            cnt += f
        grow = ~filled & (cnt > 0)
        img[grow] = (acc[grow] / cnt[grow, None]).astype(img.dtype)
        filled |= grow
    return img


def sample(img, uv):
    """Bilinear lookup of img (H, W, C) at glTF UVs (N, 2), wrapping."""
    h, w = img.shape[:2]
    x = (uv[:, 0] % 1.0) * w - 0.5
    y = (uv[:, 1] % 1.0) * h - 0.5
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = (x - x0)[:, None], (y - y0)[:, None]
    x0 %= w
    y0 %= h
    x1, y1 = (x0 + 1) % w, (y0 + 1) % h
    im = img.astype(float)
    return (im[y0, x0] * (1 - fx) * (1 - fy) + im[y0, x1] * fx * (1 - fy) + im[y1, x0] * (1 - fx) * fy +
            im[y1, x1] * fx * fy)


def raster(size, uv, faces, attr):
    """Paint each triangle (glTF UVs `uv`) into a size x size map, interpolating the per-vertex `attr` (N, K).
    Returns (attr map (size, size, K), filled mask)."""
    out = np.zeros((size, size, attr.shape[1]))
    filled = np.zeros((size, size), bool)
    px = uv * size - 0.5
    for f in faces:
        a, b, c = px[f]
        lo = np.clip(np.floor(np.minimum(np.minimum(a, b), c)).astype(int), 0, size - 1)
        hi = np.clip(np.ceil(np.maximum(np.maximum(a, b), c)).astype(int), 0, size - 1)
        xs, ys = np.meshgrid(np.arange(lo[0], hi[0] + 1), np.arange(lo[1], hi[1] + 1))
        p = np.stack([xs.ravel(), ys.ravel()], 1).astype(float)
        v0, v1 = b - a, c - a
        den = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(den) < 1e-12:
            continue
        d = p - a
        s = (d[:, 0] * v1[1] - v1[0] * d[:, 1]) / den
        t = (v0[0] * d[:, 1] - d[:, 0] * v0[1]) / den
        inside = (s >= -0.01) & (t >= -0.01) & (s + t <= 1.01)
        if not inside.any():
            continue
        s, t = s[inside], t[inside]
        q = p[inside].astype(int)
        A = attr[f]
        out[q[:, 1], q[:, 0]] = (1 - s - t)[:, None] * A[0] + s[:, None] * A[1] + t[:, None] * A[2]
        filled[q[:, 1], q[:, 0]] = True
    return out, filled


def flow_glow(size):
    """The thorns' flow glow (0..1), time-averaged: the flow mask's green tiled by flowMaskUVTile; the scrolling
    flowTex band and its warp average out to a constant, which materials.py folds into the glow colour."""
    inp = sd.scene()["materials"][P + "Equip_01"]["extras"]["inputs"]
    tile = inp["flowMaskUVTile"]
    mask = png("Equip_01_bodyFlowMask", None, "RGBA")[..., 1:2]
    v, u = np.mgrid[0:size, 0:size]
    uv = np.stack([(u.ravel() + 0.5) / size * tile[0], (v.ravel() + 0.5) / size * tile[1]], 1)
    g = sample(mask, uv)[:, 0].reshape(size, size) / 255
    return np.clip(g ** inp["flowMaskPower"], 0, 1)


def gem_mask(size):
    m = sd.mesh(next(n for n in sd.prim_names() if n.endswith(GEM)))
    _, filled = raster(size, m["uv0"], m["faces"], np.zeros((len(m["pos"]), 1)))
    return filled


def petals(base):
    """Rose-petal weight (0..1) of the thorns' colour map: the petals are cyan to violet, the stems brown."""
    b = base[..., :3].astype(float)
    return np.clip((b[..., 2] - b[..., 0] - 10) / 60, 0, 1)


def crackle(size):
    """The flow mask's bright veins only: the lightning-like streaks the flow draws over the thorns."""
    return np.clip((flow_glow(size) - 0.75) / 0.2, 0, 1)


def resize_to(a, size):
    return a if a.shape[0] == size else np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize(
        (size, size), Image.BILINEAR)).astype(float) / 255


def lit_look(texset, base):
    """Bake the psylocke.gg viewer's lit look into the colour map where it comes from effects the game has no
    equivalent for, matched in the game-shader renderer against the viewer (white capelet as the light reference):
      thorns  the rose petals glow pale icy cyan (PETAL), the thorns carry faint cyan streaks (CRACKLE)
      trim    the collar gem glows pale cyan (GEM_COLOUR)
      gold    the rip adds a gold-tinted cube-map reflection on its cube-map mask: GOLD_LIFT brighter"""
    rgb = base[..., :3].astype(float)
    size = rgb.shape[0]
    if texset == "thorns":
        w = petals(base)[..., None] * PETAL_MIX
        rgb = rgb + (np.array(PETAL) - rgb) * w
        rgb = rgb + np.array(CRACKLE) * resize_to(crackle(1024), size)[..., None]
    if texset == "trim":
        g = resize_to(gem_mask(1024).astype(float), size)[..., None] * 0.85
        rgb = rgb + (np.array(GEM_COLOUR) - rgb) * g
    if texset in GOLD:
        m = png(f"{GOLD[texset]}_cubeMapMask", size, "L").astype(float)[..., None] / 255
        rgb = rgb * (1 + (GOLD_LIFT - 1) * m)
    return np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), base[..., 3]])


def id_map(texset, orm, size, base=None):
    """_id of a set (None when it has neither metal nor glow): R pair * 17, G = 255 - glow."""
    metal = orm[..., 2].astype(float) / 255 > METAL
    if texset in GOLD:
        metal |= png(f"{GOLD[texset]}_cubeMapMask", size, "L").astype(float) / 255 > 0.5
    glow = np.zeros((size, size))
    pair = np.where(metal, 1, 0)
    src, *_, emissive = TEXSETS[texset]
    if texset == "thorns":          # the petals glow, the thorns only along the flow's veins
        p = np.asarray(Image.fromarray(petals(base).astype(np.float32)).resize((size, size), Image.BILINEAR))
        glow = np.maximum(np.clip(p, 0, 1) * 0.9, crackle(size) * 0.6)
    elif emissive:
        glow = png(f"{emissive}_gltf_emissive", size, "RGB").max(-1).astype(float) / 255
    if texset == "trim":
        gem = gem_mask(size)
        pair[gem] = GLOW_B
        glow[gem] = 1.0
    if not metal.any() and glow.max() < 0.08:
        return None
    out = np.zeros((size, size, 4), np.uint8)
    out[..., 0] = pair * 17
    out[..., 1] = np.round(255 * (1 - glow)).astype(np.uint8)
    out[..., 3] = 255
    return out


def standard(texset, src, size, spec, alpha_test, emissive):
    """{kind: RGBA map} of a plain texture set: base, norm, mask, and id where it has metal or glow."""
    base = png(f"{src}_gltf_baseColor", size)
    if texset == "lashes":          # the translucent strands (brows, lashes, wisps): the hair's strand mask
        a = cut(png("Hair_01_opacityMask", size, "L"))
    else:
        a = cut(base[..., 3]) if alpha_test else np.full(base.shape[:2], 255, np.uint8)
    print(f"{texset}: base {size}, {np.mean(a == 0) * 100:.1f}% cut out")
    src_base = base
    base = lit_look(texset, base)
    out = {"base": np.dstack([base[..., :3], a])}
    if texset == "lashes":
        out["norm"] = stack(np.full(a.shape, 128), np.full(a.shape, 128), a, np.full(a.shape, 255))
        out["mask"] = stack(np.full((FLAT, FLAT), spec), np.full((FLAT, FLAT), 200), np.full((FLAT, FLAT), 255),
                            np.full((FLAT, FLAT), 255))
        return out
    ns = 1024
    n = png(f"{src}_gltf_normal", ns)
    a_small = np.asarray(Image.fromarray(a).resize((ns, ns), Image.NEAREST))
    out["norm"] = stack(n[..., 0], 255 - n[..., 1], a_small, np.full(a_small.shape, 255))
    orm = png(f"{src}_gltf_orm", ns)
    out["mask"] = stack(np.full(a_small.shape, spec), orm[..., 1], orm[..., 0], np.full(a_small.shape, 255))
    idm = id_map(texset, orm, ns, src_base)
    if idm is not None:                 # otherwise the shared flat _id does the same
        print(f"    metal {np.mean(idm[..., 0] == 17) * 100:.1f}%, glowing {np.mean(idm[..., 1] < 235) * 100:.1f}%")
        out["id"] = idm
    return out


def hair():
    """Hair_01 on its second UV set: shadow-colour map for colour, the strand mask carried over from UV set 0."""
    m = sd.mesh(next(n for n in sd.prim_names() if n.endswith("Hair_01")))
    print("hair: baking strand opacity onto UV set 1")
    uv0_map, filled = raster(HAIR_SIZE, m["uv1"], m["faces"], m["uv0"])
    opac = png("Hair_01_opacityMask", None, "L")
    grey = png("Hair_01_gltf_baseColor", None, "L")
    uv0 = uv0_map[filled]
    a = np.zeros((HAIR_SIZE, HAIR_SIZE), np.uint8)
    a[filled] = cut(sample(opac[..., None], uv0)[:, 0])
    shade = np.ones((HAIR_SIZE, HAIR_SIZE))
    shade[filled] = 0.85 + 0.3 * sample(grey[..., None], uv0)[:, 0] / 255      # strand-level light variation
    col = png("Hair_01_shadowColorMap", HAIR_SIZE, "RGB").astype(float)
    col = np.clip(col * shade[..., None] * 1.1 * np.array(HAIR_TINT), 0, 255).astype(np.uint8)
    col = dilate(col, a > 0)
    print(f"    {filled.mean() * 100:.1f}% of the map covered, {np.mean(a > 0) * 100:.1f}% opaque")
    return {"base": np.dstack([col, a]),
            "norm": stack(np.full(a.shape, 128), np.full(a.shape, 128), a, np.full(a.shape, 255)),
            "mask": stack(np.full((FLAT, FLAT), 110), np.full((FLAT, FLAT), 120), np.full((FLAT, FLAT), 255),
                          np.full((FLAT, FLAT), 255))}


def eyes(s=EYE_SIZE):
    """The eye shader in one s x s map: sclera (tinted), iris (colour x iris AO) inside IRIS_R, a dark limbus ring,
    and the highlight spot."""
    print(f"eyes: base {s}")
    v, u = np.mgrid[0:s, 0:s]
    uv = np.stack([(u.ravel() + 0.5) / s, (v.ravel() + 0.5) / s], 1)
    r = np.linalg.norm(uv - 0.5, axis=1)
    sclera = sample(png("Eyes_01_scleraBaseColorMap", None, "RGB"), uv) * 0.85
    iuv = (uv - 0.5) / (2 * IRIS_R) + 0.5
    iris = sample(png("Eyes_01_irisBaseColorMap", None, "RGB"), iuv) * \
        (sample(png("Eyes_01_irisAoMap", None, "L")[..., None], iuv) / 255) * 1.3
    t = np.clip((r - IRIS_R * 0.92) / (IRIS_R * 0.16), 0, 1)[:, None]          # soft iris edge
    limbus = 1 - 0.55 * np.exp(-((r - IRIS_R) / (IRIS_R * 0.12)) ** 2)[:, None]
    col = (iris * (1 - t) + sclera * t) * limbus
    hl = sample(png("Eyes_01_highlightMaskMap", None, "L")[..., None], uv) / 255
    col = col * (1 - hl) + 255 * hl
    col = np.clip(col, 0, 255).astype(np.uint8).reshape(s, s, 3)
    return {"base": np.dstack([col, np.full((s, s), 255, np.uint8)]),
            "mask": stack(np.full((FLAT, FLAT), 220), np.full((FLAT, FLAT), 40), np.full((FLAT, FLAT), 255),
                          np.full((FLAT, FLAT), 255))}


def base_size(texset):
    return {"hair": HAIR_SIZE, "eyes": EYE_SIZE}.get(texset) or TEXSETS[texset][1]


def maps(texset, size):
    """{kind: RGBA map} of one texture set, its base map size x size (the hair is always baked at HAIR_SIZE), with
    the colour lift (LIFT) on its base RGB; alpha untouched."""
    if texset == "hair":
        m = hair()
    elif texset == "eyes":
        m = eyes(size)
    else:
        src, _, spec, alpha_test, emissive = TEXSETS[texset]
        m = standard(texset, src, size, spec, alpha_test, emissive)
    if texset in LIFT:
        m["base"] = np.dstack([lift(m["base"][..., :3], *LIFT[texset]), m["base"][..., 3]])
    return m


def tile_of(texset):
    """(material, column, row, columns, rows) of a texture set."""
    for mat, grid in MATERIALS.items():
        for r, row in enumerate(grid):
            if texset in row:
                return mat, row.index(texset), r, len(row), len(grid)
    raise KeyError(texset)


def atlas(tiles, kind):
    """One map of a material: its sets' maps laid out as its tiles (rows top first), each scaled to the largest
    one's size; None when none of its sets has that map. The k-th tile's _id red moves on by ROW_PAIRS row pairs
    per tile (17 per pair), onto that tile's own colour-table rows."""
    if all(kind not in m for row in tiles for m in row):
        return None
    size = max(m[kind].shape[0] for row in tiles for m in row if kind in m)
    out = []
    for r, row in enumerate(tiles):
        line = []
        for c, m in enumerate(row):
            a = m.get(kind)
            if a is None:
                a = np.tile(np.array(FILL[kind], np.uint8), (size, size, 1))
            elif a.shape[0] != size:
                a = np.asarray(Image.fromarray(a).resize((size, size), Image.NEAREST if kind == "id" else Image.LANCZOS))
            if kind == "id":
                a = a.copy()
                a[..., 0] += 17 * ROW_PAIRS * (r * len(row) + c)
            line.append(a)
        out.append(np.hstack(line))
    return np.vstack(out)


def build():
    out = {}
    flat = np.full((FLAT, FLAT), 255, np.uint8)
    out["flat_norm"] = write("flat_norm", stack(np.full((FLAT, FLAT), 128), np.full((FLAT, FLAT), 128), flat, flat), "bc7")
    zero = np.zeros((FLAT, FLAT), np.uint8)
    out["flat_id"] = write("flat_id", stack(zero, flat, zero, flat), "bc5")      # pair 0, its plain row
    for mat, grid in MATERIALS.items():
        size = max(base_size(t) for row in grid for t in row)
        tiles = [[maps(t, size) for t in row] for row in grid]
        if len(grid) > 1 or len(grid[0]) > 1:
            print(f"{mat}: atlas {grid}, {size} per tile")
        for kind, fmt in (("base", "bc7"), ("norm", "bc7"), ("mask", "bc7"), ("id", "bc5")):
            img = atlas(tiles, kind)
            if img is not None:
                out[f"{mat}_{kind}"] = write(f"{mat}_{kind}", img, fmt)
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


def tex_of(mat, kind):
    """Game path of a material's map, falling back to the shared flat ones."""
    have = pickle.load(open(os.path.join(OUT, "index.pkl"), "rb"))
    key = f"{mat}_{kind}" if f"{mat}_{kind}" in have else f"flat_{kind}"
    return f"{GAME_DIR}_{key}.tex"


if __name__ == "__main__":
    build()
