"""Colours for the sculpt, from its region labels (labels.py) -> work/src/paint.npz and work/src/eyes.png.

paint.npz, per high-poly vertex:
  colour    display RGB 0..1: the region's colour, darkened in the sculpt's grooves so its carved lines read
  facemask  1 on the face skin and the eye recesses: where the projected eye/mouth picture applies
  protect   0..1, how much detail the decimator keeps (face and eyes most, hands next)
  texset    0 head (face, ears, eyes, earrings), 1 hair (hair, barrettes, clips), 2 body (the rest)
eyes.png: the eyes (iris, pupil, highlights, lash lines) and her small mouth, drawn in a front-on picture of the
face (EYE_BOX, game x/y) and projected straight onto the face when baking; alpha marks where it applies.
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import labels  # noqa: E402
import src  # noqa: E402

ROOT = src.ROOT
OUT = os.path.join(ROOT, "work", "src", "paint.npz")
EYES = os.path.join(ROOT, "work", "src", "eyes.png")
EYE_BOX = (-0.115, 1.615, 0.115, 1.785)        # x0, y0, x1, y1 of eyes.png (figure metres, front view)
EYE_PX = 5000                                  # pixels per figure metre
TEXSETS = ("head", "hair", "body")

COLOUR = {
    "skin": (0.99, 0.87, 0.79), "hair": (0.99, 0.86, 0.42), "barrette": (0.86, 0.12, 0.22),
    "clip": (0.93, 0.32, 0.48), "earring": (0.98, 0.78, 0.32), "choker": (0.84, 0.10, 0.18),
    "bodysuit": (0.96, 0.96, 0.97), "collar": (0.13, 0.26, 0.70), "bow": (0.88, 0.10, 0.18),
    "brooch": (0.98, 0.80, 0.32), "shoulder": (0.90, 0.93, 0.99), "glove": (0.97, 0.97, 0.97),
    "cuff": (0.86, 0.10, 0.18), "skirt": (0.14, 0.29, 0.78), "waistband": (0.96, 0.96, 0.97),
    "boot": (0.85, 0.10, 0.17), "crescent": (0.98, 0.80, 0.32),
    "stripe": (0.13, 0.26, 0.70),       # the collar's rolled edge: collar blue (white, it spread over the lapels)
    "eye": (0.97, 0.97, 0.98),
}
GROOVE = 0.0015         # groove depth (m) that gets the full darkening
GROOVE_DARK = 0.4


def texset_of(lab, pos):
    L = labels.LABEL
    t = np.full(len(lab), 2, np.int8)
    t[np.isin(lab, [L["hair"], L["barrette"], L["clip"]])] = 1
    head = np.isin(lab, [L["eye"], L["earring"]]) | ((lab == L["skin"]) & (pos[:, 1] > 1.6))
    t[head] = 0
    return t


def raster(tris, w, h):
    """Fill 2D triangles (pixel coordinates) into a (h, w) mask."""
    m = np.zeros((h, w), bool)
    for t in tris:
        x0, y0 = np.floor(t.min(0)).astype(int)
        x1, y1 = np.ceil(t.max(0)).astype(int)
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, w - 1), min(y1, h - 1)
        if x1 < x0 or y1 < y0:
            continue
        yy, xx = np.mgrid[y0:y1 + 1, x0:x1 + 1] + 0.5
        (ax, ay), (bx, by), (cx, cy) = t
        d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay)
        if abs(d) < 1e-12:
            continue
        w1 = ((xx - ax) * (cy - ay) - (cx - ax) * (yy - ay)) / d
        w2 = ((bx - ax) * (yy - ay) - (xx - ax) * (by - ay)) / d
        m[y0:y1 + 1, x0:x1 + 1] |= (w1 >= 0) & (w2 >= 0) & (w1 + w2 <= 1)
    return m


def dilate(m, n):
    for _ in range(n):
        p = np.pad(m, 1)
        m = p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    return m


def blur(a, r):
    """Box blur of radius r (twice, so roughly a tent)."""
    for _ in range(2):
        for ax in (0, 1):
            c = np.cumsum(np.pad(a, [(r + 1, r) if i == ax else (0, 0) for i in range(2)], mode="edge"), axis=ax)
            a = (np.take(c, range(2 * r + 1, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - 2 * r - 1),
                                                                               axis=ax)) / (2 * r + 1)
    return a


def ellipse(xx, yy, cx, cy, rx, ry):
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2


def draw_eyes(pos, faces, lab):
    x0, y0, x1, y1 = EYE_BOX
    w, h = int(round((x1 - x0) * EYE_PX)), int(round((y1 - y0) * EYE_PX))
    eye_f = faces[np.all(lab[faces] == labels.LABEL["eye"], 1)]
    eye_f = eye_f[np.cross(pos[eye_f[:, 1]] - pos[eye_f[:, 0]], pos[eye_f[:, 2]] - pos[eye_f[:, 0]])[:, 2] > 0]
    tri = np.stack([(pos[eye_f][..., 0] - x0) * EYE_PX, (y1 - pos[eye_f][..., 1]) * EYE_PX], -1)
    mask = raster(tri, w, h)
    mask = blur(dilate(mask, 2).astype(float), 7) > 0.5      # close pinholes, smooth the vertex-stepped edge
    img = np.zeros((h, w, 4))
    yy, xx = np.mgrid[0:h, 0:w] + 0.5
    for side in (-1, 1):
        m = mask & ((xx < w / 2) if side < 0 else (xx >= w / 2))
        ys, xs = np.nonzero(m)
        ex0, ex1, ey0, ey1 = xs.min(), xs.max(), ys.min(), ys.max()
        ew, eh = ex1 - ex0, ey1 - ey0
        print(f"  eye {side:+d}: {ew / EYE_PX * 1000:.1f} x {eh / EYE_PX * 1000:.1f} mm at "
              f"x {(ex0 + ex1) / 2 / EYE_PX + x0:+.4f} y {y1 - (ey0 + ey1) / 2 / EYE_PX:.4f}")
        # lash line: a band along the eye's (smoothed) top edge, thickest towards the outer corner, running on
        # past the corner as a tapering flick; a thin line under the lower edge
        cols = np.arange(w)
        has = m.any(0)
        top = np.where(has, np.argmax(m, 0), 0).astype(float)
        bot = np.where(has, h - 1 - np.argmax(m[::-1], 0), 0).astype(float)
        idx = np.nonzero(has)[0]
        top[~has] = np.interp(cols[~has], idx, top[idx])
        bot[~has] = np.interp(cols[~has], idx, bot[idx])
        k = np.ones(15) / 15
        top_s = np.convolve(np.pad(top, 7, mode="edge"), k, "valid")
        bot_s = np.convolve(np.pad(bot, 7, mode="edge"), k, "valid")
        outer = (cols - (ex0 + ex1) / 2) * side / (0.5 * ew)          # -1 inner corner .. +1 outer corner
        thick = 0.045 * eh + 0.10 * eh * np.clip((outer + 0.3) / 1.3, 0, 1)
        lift = np.zeros(w)
        past = np.clip(outer - 0.9, 0, None)                           # flick: rises and tapers past the corner
        corner = top_s[int(ex1 if side > 0 else ex0)]
        top_l = np.where(outer > 0.9, corner - past * 0.9 * eh, top_s)
        thick = np.where(outer > 0.9, thick * np.clip(1 - past / 0.45, 0, 1), thick)
        lash = (outer > -1.02) & (yy > top_l - thick) & (yy < top_l + 0.02 * eh) & \
            ((outer <= 0.9) | (yy < top_l + 0.02 * eh))
        lash &= (outer <= 0.9) | (thick > 0)
        lower = (np.abs(outer) < 0.75) & (yy > bot_s) & (yy < bot_s + 0.025 * eh)
        flick = np.zeros_like(lash)
        del lift
        # inside: white, a lid shadow at the top, the iris (dark blue above, light below), pupil, highlights
        cx = (ex0 + ex1) / 2 - side * 0.04 * ew
        cy = ey0 + 0.56 * eh
        rx, ry = 0.40 * ew, 0.52 * eh
        e = ellipse(xx, yy, cx, cy, rx, ry)
        t = np.clip((yy - (cy - ry)) / (2 * ry), 0, 1)[..., None]
        iris_c = (1 - t) * np.array([0.08, 0.16, 0.42]) + t * np.array([0.38, 0.66, 0.98])
        col = np.ones((h, w, 3)) * np.array([0.97, 0.97, 0.99])
        shade = np.clip(1 - (yy - ey0) / (0.3 * eh), 0, 1)[..., None]
        col = col * (1 - 0.25 * shade) + np.array([0.55, 0.62, 0.80]) * 0.25 * shade
        col = np.where((e < 1)[..., None], iris_c, col)
        col = np.where(((e < 1) & (e > 0.78))[..., None], np.array([0.06, 0.10, 0.30]), col)
        col = np.where((ellipse(xx, yy, cx, cy + 0.08 * ry, 0.42 * rx, 0.46 * ry) < 1)[..., None],
                       np.array([0.03, 0.05, 0.16]), col)
        col = np.where((ellipse(xx, yy, cx - 0.38 * rx, cy - 0.40 * ry, 0.30 * rx, 0.24 * ry) < 1)[..., None],
                       np.array([1.0, 1.0, 1.0]), col)
        col = np.where((ellipse(xx, yy, cx + 0.42 * rx, cy + 0.45 * ry, 0.13 * rx, 0.10 * ry) < 1)[..., None],
                       np.array([1.0, 1.0, 1.0]), col)
        line = lash | flick | lower
        col = np.where(line[..., None], np.array([0.12, 0.07, 0.07]), col)
        a = m | line
        img[a, :3] = col[a]
        img[a, 3] = 1
    # her mouth: a short, slightly curved line under the nose
    mx, my = (0.0 - x0) * EYE_PX, (y1 - 1.634) * EYE_PX
    u = (xx - mx) / (0.0075 * EYE_PX)
    mouth = (np.abs(u) < 1) & (np.abs(yy - (my + 0.0012 * EYE_PX * (1 - u ** 2))) < 0.0007 * EYE_PX)
    img[mouth] = (0.70, 0.30, 0.32, 1.0)
    Image.fromarray((img * 255).round().astype(np.uint8), "RGBA").save(EYES)
    print("wrote", EYES, img.shape[1], "x", img.shape[0])


def build():
    pos, faces, nrm = src.load()
    lab = np.load(labels.OUT)
    g = np.load(os.path.join(ROOT, "work", "src", "ground.npy"))
    names = {i: n for i, (n, _, _) in labels.REGIONS.items()}
    col = np.array([COLOUR[names[l]] for l in lab])
    col *= (1 - GROOVE_DARK * np.clip(g / GROOVE, 0, 1))[:, None]
    L = labels.LABEL
    face = np.isin(lab, [L["skin"], L["eye"]]) & (pos[:, 1] > 1.6) & (nrm[:, 2] > 0.2)
    protect = np.zeros(len(pos))
    protect[(pos[:, 1] > 1.6) & np.isin(lab, [L["skin"], L["eye"], L["earring"]])] = 0.8
    protect[np.isin(lab, [L["glove"]]) & (pos[:, 1] < 1.02)] = 0.5          # hands
    texset = texset_of(lab, pos)
    np.savez(OUT, colour=col, facemask=face.astype(float), protect=protect, texset=texset)
    for i, t in enumerate(TEXSETS):
        print(f"  texset {t}: {np.sum(texset[faces].max(1) == i)} triangles")
    draw_eyes(pos, faces, lab)


if __name__ == "__main__":
    build()
