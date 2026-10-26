"""Build her characterlegacy colour maps (_d) from the source PNGs, with Neon's colour lift.

usage: python -P -E colour_textures.py <project_dir>

  body  source/Don2_DonB_BaseColor.png -> donq_body_d.tex (full body) and donq_c1701_body_d.tex (Viera male outfit)
  hair  source/Don2_DonH_BaseColor.png -> donq_hair_d.tex

Up to 1.1.0 these were plain texconv BC7 conversions of the source PNGs (2048 px, full mips), wrapped by
tex_tools.py. Now they are resized to 2048 here, lifted, then go through the same texconv BC7 + tex_tools.py path.
The skin sets (skin.shpk face and hands, tinted by the character's skin colour) are skin_textures.py's and are not
lifted.
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = sys.argv[1]
SIZE = 2048
SRC = os.path.join(ROOT, 'source')
DDS = os.path.join(ROOT, 'work', 'dds')
TEXCONV = r'E:\Program Files\FFXIV TexTools\FFXIV_TexTools\converters\texconv.exe'
TEX = 'chara/equipment/e0359/texture'
TARGETS = {  # texset -> (source PNG, .tex files written, relative to the project)
    'body': ('Don2_DonB_BaseColor.png', [f'mod/{TEX}/donq_body_d.tex', f'mod_c1701/{TEX}/donq_c1701_body_d.tex']),
    'hair': ('Don2_DonH_BaseColor.png', [f'mod/{TEX}/donq_hair_d.tex']),
}
# Colour lift (1.2.0 / outfit 1.1.0, Neon's, the user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING.
# this like color intensity is what im looking for"). texset -> (luminance gamma, saturation).
# The hair is already a saturated yellow: at saturation 1.2 it went lemon in GS (work/lift/cmp_lift.png), so it gets the
# brightness lift only.
LIFT = {'body': (1.4, 1.2), 'hair': (1.4, 1.0)}
LUMA = np.array([0.2126, 0.7152, 0.0722])

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tex_tools import dds_to_tex  # noqa: E402


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


def build(texset, src, outs):
    im = Image.open(os.path.join(SRC, src)).convert('RGBA')
    if im.size != (SIZE, SIZE):
        im = im.resize((SIZE, SIZE), Image.LANCZOS)
    rgba = np.asarray(im).copy()
    if texset in LIFT:
        rgba[..., :3] = lift(rgba[..., :3], *LIFT[texset])     # alpha untouched
    name = os.path.basename(outs[0])[:-4]
    png = os.path.join(DDS, name + '.png')
    os.makedirs(DDS, exist_ok=True)
    Image.fromarray(rgba, 'RGBA').save(png)
    # -sepalpha: keep alpha out of the colour mip filtering
    subprocess.run([TEXCONV, '-nologo', '-y', '-f', 'BC7_UNORM', '-m', '0', '-sepalpha', '-o', DDS, png],
                   check=True, stdout=subprocess.DEVNULL)
    for out in outs:
        dds_to_tex(png[:-4] + '.dds', os.path.join(ROOT, *out.split('/')))


if __name__ == '__main__':
    for texset, (src, outs) in TARGETS.items():
        print(texset, LIFT.get(texset))
        build(texset, src, outs)
