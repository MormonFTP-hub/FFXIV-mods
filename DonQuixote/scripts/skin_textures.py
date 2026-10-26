"""Build the skin.shpk texture sets for her face (DonF) and hand skin (DonS).

usage: python -P -E skin_textures.py <project_dir> [--analyze]

skin.shpk (vanilla bodies/faces, see the Aerith port): _base = skin albedo, multiplied in game by the character's
skin colour where _norm B is 1; _norm RG = normal (0.5, 0.5 flat), B = skin-tint amount, A = lipstick area (0 here).
The mask is the game's own chara/common/texture/skin_mask.tex, as on vanilla bodies.

Her texture is anime-painted: very pale skin and a neck painted in a dark shadow tone. Under the game's lighting
that read flat grey with a brown band down the neck (in game and in GS). So:
  * skin texels are recoloured to the vanilla skin albedo (SKIN_BASE), keeping her painted shading and blush as
    ratios, and the neck's shadow tone is brought up to the face's tone first;
  * features (lash lines, eye whites, irises, brows, mouth) keep their colours and get no skin tint (B = 0).
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = sys.argv[1]
ANALYZE = '--analyze' in sys.argv
SIZE = 2048
SRC = os.path.join(ROOT, 'source')
WORK = os.path.join(ROOT, 'work')
TEXCONV = r'E:\Program Files\FFXIV TexTools\FFXIV_TexTools\converters\texconv.exe'
OUT_TEX = os.path.join(ROOT, 'mod', 'chara', 'equipment', 'e0359', 'texture')
SKIN_BASE = np.array([181, 148, 131], np.float32) / 255  # vanilla body/face skin albedo (Bibo+ and vanilla faces agree)
NECK_LIFT = 1.0       # 1 = the neck's painted shadow tone is fully brought up to the face skin tone
SKIN_GAIN = 1.1       # 1.1.0's first GS pass: her cheeks came out ~10% darker than the character's own face

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tex_tools import dds_to_tex  # noqa: E402


def load(name):
    im = Image.open(os.path.join(SRC, name)).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS)
    return np.asarray(im, np.float32) / 255


def raster(tris, cats):
    """Category image (0 = unused) from UV triangles [u0 v0 u1 v1 u2 v2 cat] (v up, so rows flip)."""
    im = Image.new('L', (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(im)
    for t in tris:
        if t[6] in cats:
            pts = [((t[i] % 1) * SIZE, (1 - t[i + 1] % 1) * SIZE) for i in (0, 2, 4)]
            draw.polygon(pts, fill=int(t[6]))
    return np.asarray(im)


def hsv(img):
    mx, mn = img.max(2), img.min(2)
    sat = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)
    return mx, sat


def blur(a, r):
    return np.asarray(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)),
                      np.float32) / 255


def box_blur(a, r, passes=3):
    """Float blur (repeated box filter ~ Gaussian) via cumulative sums; edges clamp."""
    out = a.astype(np.float32)
    for _ in range(passes):
        for axis in (0, 1):
            pad = [(0, 0), (0, 0)]
            pad[axis] = (r + 1, r)
            c = np.cumsum(np.pad(out, pad, mode='edge'), axis=axis)
            hi = np.take(c, np.arange(2 * r + 1, c.shape[axis]), axis=axis)
            lo = np.take(c, np.arange(0, c.shape[axis] - 2 * r - 1), axis=axis)
            out = (hi - lo) / (2 * r + 1)
    return out


def bleed(img, valid, fallback, radii=(2, 6, 16, 48)):
    """Fill texels outside the UV islands from nearby island texels (normalised blur), widening per pass."""
    out = img.copy()
    have = valid.astype(np.float32)
    for r in radii:
        num = np.dstack([box_blur(out[..., c] * have, r) for c in range(3)])
        den = box_blur(have, r)
        fill = (have == 0) & (den > 1e-3)
        out[fill] = num[fill] / den[fill][:, None]
        have = np.maximum(have, fill.astype(np.float32))
    out[have == 0] = fallback
    return out


def write(name, rgba):
    png = os.path.join(WORK, 'dds', name + '.png')
    Image.fromarray(np.clip(rgba * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA').save(png)
    # -sepalpha: alpha is data here, without it texconv weights colour by alpha when it builds the mips
    subprocess.run([TEXCONV, '-nologo', '-y', '-f', 'BC7_UNORM', '-m', '0', '-sepalpha', '-o', os.path.join(WORK, 'dds'), png],
                   check=True, stdout=subprocess.DEVNULL)
    dds_to_tex(png[:-4] + '.dds', os.path.join(OUT_TEX, name + '.tex'))


def skin_set(name, col, cat, skin):
    """Recolour skin texels to SKIN_BASE (keeping their variation) and write _base / _norm."""
    # soften only the edges between skin and features: texels outside the UV islands count as skin here, or every
    # island edge came out half recoloured and half tinted, a brighter rim (the line down the neck's mirrored seam)
    m = blur((skin | (cat == 0)).astype(np.float32), 2)[..., None]
    mean = col[skin].mean(0)
    base = np.clip(col * (SKIN_BASE * SKIN_GAIN / mean), 0, 1)
    out = col * (1 - m) + base * m
    # texels no triangle uses: bleed each island's own colour outward (seams sample them, and so do the lower mips),
    # then the skin base for whatever is still empty
    out = bleed(out, cat > 0, SKIN_BASE * SKIN_GAIN)
    tint = np.where(cat == 0, 1.0, m[..., 0])
    n = np.dstack([np.full((SIZE, SIZE), 0.5), np.full((SIZE, SIZE), 0.5), tint, np.zeros((SIZE, SIZE))])
    write(f'donq_{name}_base', np.dstack([out, np.ones((SIZE, SIZE))]))
    write(f'donq_{name}_norm', n)
    print(f'{name}: skin texels {int(skin.sum())}, source skin mean {np.round(mean * 255)} -> {np.round(SKIN_BASE * SKIN_GAIN * 255)}')
    return out


uvcats = json.load(open(os.path.join(WORK, 'don_nohat_uvcats.json')))

# ---- face
face = load('Don2_DonF_BaseColor.png')
fcat = raster(uvcats['DonF'], (1, 2, 3))
val, sat = hsv(face)
lum = face @ np.array([0.3, 0.59, 0.11], np.float32)
used = (fcat == 1) | (fcat == 2)
# pale face skin: bright, slightly warm; the neck's painted tone: mid-bright orange-brown
pale = used & (lum > 0.72) & (sat > 0.04) & (sat < 0.25) & (face[..., 0] >= face[..., 2])
brown = used & (val > 0.45) & (val < 0.85) & (sat > 0.3) & (sat < 0.65) & (face[..., 0] > face[..., 1]) & (face[..., 1] > face[..., 2])
if ANALYZE:
    for label, msk in (('used', used), ('pale', pale), ('brown', brown), ('eyes', fcat == 3)):
        px = face[msk]
        print(label, int(msk.sum()), 'mean', np.round(px.mean(0) * 255) if len(px) else None)
    q = (np.clip(face[used], 0, 0.999) * 8).astype(int)
    keys, counts = np.unique(q[:, 0] * 64 + q[:, 1] * 8 + q[:, 2], return_counts=True)
    for k, c in sorted(zip(keys, counts), key=lambda kc: -kc[1])[:16]:
        print('  colour bin', (k // 64 * 32 + 16, k // 8 % 8 * 32 + 16, k % 8 * 32 + 16), c)
    vis = np.zeros((SIZE, SIZE, 3), np.float32)
    vis[pale] = (0.2, 0.9, 0.2)
    vis[brown] = (0.9, 0.5, 0.1)
    vis[(fcat == 3)] = (0.2, 0.4, 1.0)
    Image.fromarray((np.clip(face * 0.4 + vis * 0.6, 0, 1) * 255).astype(np.uint8)).resize((768, 768)).save(os.path.join(WORK, 'gs', 'face_classes.png'))
    sys.exit(0)

# Skin is everything on the face and neck except the features: eye whites/teeth (near-white, unsaturated) and lash
# lines/brows/mouth (dark). Classifying skin by colour instead left island edges and pale highlights untinted, which
# showed in GS as pale seams down the neck and across the forehead.
white = (lum > 0.85) & (sat < 0.045)
dark = lum < 0.35
# features only count well inside a UV island: the source paints island borders light/dark, and those texels
# along the neck's centre seam stayed untinted, a thin pale line down the neck in GS
interior = np.asarray(Image.fromarray((used * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(9))) > 0
border = used & ~interior
skin = used & ~((white | dark) & interior)
# bring the neck's shadow tone up to the face's skin tone, then recolour all skin to the vanilla albedo
pale_mean, brown_mean = face[pale].mean(0), face[brown].mean(0)
# The painted shadow areas are flat colour, so they (and the blended texels at their edge, 4 px around) become
# the face tone outright. A multiplicative lift overshot those edge texels (the blue channel x2.3) into bluish
# white lines down the neck and across the forehead in GS.
region = np.asarray(Image.fromarray((brown * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0
# Inside the painted-shadow areas a near-white texel is a painted highlight (a thin line down the neck's centre,
# found in GS: albedo only, normals and lighting smooth), not an eye white: it becomes skin too.
region &= used & ~dark
skin |= region
face = np.where(region[..., None], face * (1 - NECK_LIFT) + pale_mean * NECK_LIFT, face)
face = np.where((border & (white | dark))[..., None], pale_mean, face)
print(f'face: neck tone {np.round(brown_mean * 255)} lifted toward face tone {np.round(pale_mean * 255)}')
skin_set('face', face, fcat, skin)

# ---- hand skin
body = load('Don2_DonB_BaseColor.png')
hcat = raster(uvcats['DonS'], (4,))
# every hand-skin triangle was picked for its skin colour, so all its texels are skin (a colour test left the
# lighter painted texels untinted: pale blotches on the backs of the hands in GS)
skin_set('hand', body, hcat, hcat == 4)
