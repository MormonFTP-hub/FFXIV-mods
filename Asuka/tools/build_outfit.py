"""The plugsuit alone (out/Asuka Plugsuit (Evangelion).pmp): the same fits and suit as the full-body mod, without her
head and hair, so the wearer's own head, face and hair show above the collar.

Per fitted race (work/fit/<race>.pkl), into work/build_outfit:
  top   plugsuit torso, the whole collar (its top edge, on the head piece in the full mod, comes down here) and upper arms
  glv   forearms, wrist cuffs and gloves
  dwn   hips, thighs and knees
  sho   shins and the red heeled boots
The head slot is left alone. Her chin, and the hair and face shards the bake gave the suit's texture set, are dropped.
The collar is shrink-wrapped onto the wearer's own neck (wrap_collar). In the full mod it sits round her neck, which the
fit puts ~4 cm in front of the FFXIV neck, and is pushed out to clear every race's; alone, it was an open tube with a dark
gap between the wearer's throat and its rim (user's in-game screenshot, 1.0.0). It keeps fit.neck_weights' skinning.

python -P -E tools/build_outfit.py
"""
import json
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build as b  # noqa: E402
import fit  # noqa: E402
import labels  # noqa: E402
import pbd  # noqa: E402
import rig  # noqa: E402

b.OUT = os.path.join(b.ROOT, "work", "build_outfit")
b.LETTERS_JSON = os.path.join(b.OUT, "letters.json")
SLOTS = ["top", "glv", "dwn", "sho"]
# Collar wrap, in metres along / out from the FFXIV neck axis (j_kubi -> j_kao) for the Midlander woman, scaled by
# each fit's neck length (as fit.cover_neck)
WRAP_MARGIN = 0.003             # the collar's distance outside the wearer's neck
WRAP_TOP = 0.05                 # the collar's top edge, just under the jaw (her collar reached up under her chin)
WRAP_FADE = (0.0, 0.015)        # the wrap fades in over this, up from where the collar meets her shoulders
WRAP_STEP = (0.003, 7.5)        # envelope cells: along the neck (m), round it (degrees)
# Races whose necks don't match the fit they'd wear through the racial deformer (tools/collar_check.py: 9-11 mm
# thicker, poking through the wrapped collar): their own models, that fit deformed onto their skeleton and the collar
# wrapped onto their own neck (EQDP own in pack_outfit.py)
EXTRA = {"c0801": "c0201", "c1401": "c0201", "c0301": "c0101"}


def deformed_fit(race, base):
    """The base race's fit carried into `race`'s bind space by the game's racial deformer (positions; normals from
    a short step along each), with that race's joints."""
    fp = pickle.load(open(os.path.join(b.ROOT, "work", "fit", f"{base}.pkl"), "rb"))
    mats = pbd.chain(pbd.read(), int(base[1:]), int(race[1:]))
    _, parents, _ = rig.load_skeleton(f"skeleton_{base}")
    parts = {}
    for name, p in fp["parts"].items():
        q = dict(p)
        q["pos"] = pbd.deform(p["pos"], p["bones"], p["weights"], mats, parents)
        n = pbd.deform(p["pos"] + p["nrm"] * 0.001, p["bones"], p["weights"], mats, parents) - q["pos"]
        q["nrm"] = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
        parts[name] = q
    sk = b.Skeleton(b.xd.extract(f"chara/human/{race}/skeleton/base/b0001/skl_{race}b0001.sklb")[0])
    return {"parts": parts, "joints": {n: sk.world[i][:3, 3].copy() for i, n in enumerate(sk.names)}}


def neck_envelope(race, F, top):
    """The fit race's own necks (its player faces, ears and horns left out), as the largest distance from the neck
    axis per cell along and round it, up to `top`; empty cells take their row's neighbours, empty rows the next row
    up, then a light blur round the neck."""
    s = [fit.face_surface(race, f, race, None) for f in fit.COVER_FACES]
    t, th, r, _ = fit.neck_polar(np.vstack([x for x in s if x is not None]), F)
    TB = np.arange(0.0, top + 2 * WRAP_STEP[0], WRAP_STEP[0])
    AB = np.radians(np.arange(-180, 180.1, WRAP_STEP[1]))
    env = np.zeros((len(TB) - 1, len(AB) - 1))
    sel = (t >= TB[0]) & (t < TB[-1]) & (r < 0.09)
    np.maximum.at(env, (np.digitize(t[sel], TB) - 1, np.clip(np.digitize(th[sel], AB) - 1, 0, len(AB) - 2)), r[sel])
    for i in range(len(env) - 1, -1, -1):
        row = env[i]
        if (row > 0).any() and (row == 0).any():
            k = np.nonzero(row > 0)[0]
            row[row == 0] = np.interp(np.nonzero(row == 0)[0], k, row[k], period=len(row))
        elif not (row > 0).any() and i + 1 < len(env):
            env[i] = env[i + 1]
    env = np.maximum(env, (np.roll(env, 1, 1) + 2 * env + np.roll(env, -1, 1)) / 4)
    return (TB[:-1] + TB[1:]) / 2, (AB[:-1] + AB[1:]) / 2, env


def wrap_collar(p, F, race):
    """Shrink-wrap the collar (her neck-kind suit vertices) onto the wearer's own neck: squashed along the neck so its
    top edge is at WRAP_TOP, then each vertex WRAP_MARGIN outside the fit race's neck envelope in its own direction
    round the axis, faded in from the shoulders."""
    ks = float(np.linalg.norm(F["j_kao"] - F["j_kubi"])) / fit.NECK_REF
    top, fade = WRAP_TOP * ks, (WRAP_FADE[0] * ks, WRAP_FADE[1] * ks)
    src = p["src"]
    collar = (np.hypot(src[:, 0], src[:, 2] - labels.NECK_Z) < 0.045) & (src[:, 1] > fit.COLLAR_LO)
    pos = p["pos"][collar]
    t, th, r, rv = fit.neck_polar(pos, F)
    # squash: per angle, her collar's top down to `top` (it's higher at the front, under her chin)
    AB = np.radians(np.arange(-180, 180.1, WRAP_STEP[1]))
    j = np.clip(np.digitize(th, AB) - 1, 0, len(AB) - 2)
    t_top = np.full(len(AB) - 1, top)
    np.maximum.at(t_top, j, t)
    t_top = np.maximum(t_top, top)
    ac = (AB[:-1] + AB[1:]) / 2
    tt = np.interp(th, ac, t_top, period=2 * np.pi)
    t_new = np.where(t > fade[1], fade[1] + (t - fade[1]) * (top - fade[1]) / np.maximum(tt - fade[1], 1e-6), t)
    tc, acc, env = neck_envelope(race, F, top)
    fi = np.clip(np.interp(t_new, tc, np.arange(len(tc))), 0, len(tc) - 1)
    fj = np.interp(th, acc, np.arange(len(acc)), period=2 * np.pi)
    i0, j0 = np.floor(fi).astype(int), np.floor(fj).astype(int) % len(acc)
    i1, j1 = np.minimum(i0 + 1, len(tc) - 1), (j0 + 1) % len(acc)
    wi, wj = fi - i0, fj - np.floor(fj)
    e = (env[i0, j0] * (1 - wi) * (1 - wj) + env[i1, j0] * wi * (1 - wj) + env[i0, j1] * (1 - wi) * wj
         + env[i1, j1] * wi * wj)
    r_new = np.where(e > 0, e + WRAP_MARGIN, r)
    w = fit.smoothstep((t - fade[0]) / (fade[1] - fade[0]))
    a = F["j_kubi"]
    ax = (F["j_kao"] - a) / np.linalg.norm(F["j_kao"] - a)
    dirs = rv / np.maximum(r[:, None], 1e-6)
    wrapped = a + np.outer(t_new, ax) + dirs * r_new[:, None]
    p["pos"] = p["pos"].copy()
    p["pos"][collar] = pos * (1 - w[:, None]) + wrapped * w[:, None]
    moved = np.linalg.norm(p["pos"][collar] - pos, axis=1)
    print(f"  {race} collar: {int((w > 0).sum())} vertices wrapped onto the wearer's neck (moved up to "
          f"{moved.max() * 1000:.0f} mm, median {np.median(moved[w > 0]) * 1000:.0f} mm); top edge at {top * 1000:.0f} mm")


def above_collar(src):
    """Her chin and face: source vertices above the collar's top edge, near the neck's axis."""
    r = np.hypot(src[:, 0], src[:, 2] - labels.NECK_Z)
    return (r < 0.07) & (src[:, 1] > labels.collar_top_at(src))


def source_label(vid):
    """Region label (labels.py) of each game-mesh vertex's nearest source vertex."""
    near = np.load(os.path.join(b.ROOT, "work", "bake", "low_near.npy"))
    return np.load(labels.OUT)[near[vid]]


def split_race(race):
    if race in EXTRA:
        fit_ = deformed_fit(race, EXTRA[race])
    else:
        fit_ = pickle.load(open(os.path.join(b.ROOT, "work", "fit", f"{race}.pkl"), "rb"))
    by_slot = {s: {} for s in SLOTS}
    for name, p in fit_["parts"].items():
        if p["slot"] == "met":          # her head and hair
            continue
        # her chin, and hair or face shards the bake gave the suit's texture set (inside her hair in the full mod,
        # they float by the shoulders without it)
        notsuit = source_label(p["vid"]) != labels.LABEL["suit"]
        drop = (above_collar(p["src"]) | notsuit)[p["faces"]].sum(1) >= 2
        # and every loose island: the suit is one piece; the 2-56 triangle bits are dark hair strands the colour test
        # read as suit, which hung in her hair behind the shoulders
        ids, inv = np.unique(p["vid"], return_inverse=True)
        uf = inv[p["faces"]]
        comp = b.components(uf, len(ids))[uf[:, 0]]
        drop |= comp != np.bincount(comp[~drop]).argmax()
        p = b.sub(p, ~drop)
        wrap_collar(p, fit_["joints"], race)
        tri = b.split(p)
        tri[tri == b.SLOTS.index("met")] = b.SLOTS.index("top")
        print(f"  {race} {name}: dropped {int(drop.sum())} chin, hair and face triangles")
        for si, slot in enumerate(b.SLOTS):
            if slot in SLOTS and (tri == si).any():
                by_slot[slot].setdefault(p["texset"], []).append(b.sub(p, tri == si))
                print(f"  {race} {name} -> {slot}: {(tri == si).sum()} tris")
    return by_slot


def build(races=b.RACES + tuple(EXTRA)):
    os.makedirs(os.path.join(b.OUT, "gltf"), exist_ok=True)
    os.makedirs(os.path.join(b.OUT, "mdl"), exist_ok=True)
    split_all = {race: split_race(race) for race in races}
    b.LETTERS.clear()
    for slot in SLOTS:
        used = {t for bs in split_all.values() for t in bs[slot]}
        b.LETTERS[slot] = [t for t in b.TEXSET_ORDER if t in used]
    json.dump(b.LETTERS, open(b.LETTERS_JSON, "w"), indent=1)
    print("materials per slot:", b.LETTERS)
    result = {}
    for race in races:
        skel = b.Skeleton(b.xd.extract(f"chara/human/{race}/skeleton/base/b0001/skl_{race}b0001.sklb")[0])
        for slot in SLOTS:
            mats = {b.mtrl(race, slot, t): split_all[race][slot][t] for t in b.LETTERS[slot]
                    if t in split_all[race][slot]}
            name = f"{race}_{slot}"
            game = b.xd.gear_model_path(b.SET, slot, race)
            result[name] = (b.convert(name, skel, mats, game), game)
    with open(os.path.join(b.OUT, "mdl", "index.pkl"), "wb") as f:
        pickle.dump(result, f)
    return result


if __name__ == "__main__":
    build(tuple(sys.argv[1:]) or b.RACES + tuple(EXTRA))
