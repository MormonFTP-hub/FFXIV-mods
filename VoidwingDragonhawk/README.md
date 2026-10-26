# Voidwing Dragonhawk (WoW: Midnight) as the Company Chocobo

Penumbra mod: `out/Voidwing Dragonhawk (Company Chocobo).pmp`. Preview: `out/preview.png` (idle, run, flying, glide; rendered from the built mod files with a stand-in rider).

The Voidwing Dragonhawk mount from the World of Warcraft: Midnight Epic Edition, with its own WoW animations, on the chocobo model. Personal use only: the model and textures belong to Blizzard, so don't upload or share the .pmp.

## Changes

**1.3.0** (2026-10-25): brighter colours (Neon's lift). The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/build_textures.py` (`LIFT`, `lift()`) lifts every colour map: feathers, armour, void membranes and eyes (`dh_*_base`). Luminance gamma 1.4 (dark and mid tones most, hue kept), then saturation x1.2 in linear light. The lift is applied after the existing feather shadow lift and steel darkening.
- Unchanged: the alpha (feather cut-outs, void opacity), the glow (the `_id` maps' emissive rows), and the normal and mask maps. Models, materials, skeleton and animations are byte-identical to 1.2.0.
- In GS (three-quarter, idle) its brightness rises about 23% by day and in dim light and its saturation about 16%: bluer feathers, more vivid violet membranes, brighter gold trim. The steel plates stay slate, and nothing clips to white. Before/after (1.2.0 and 1.3.0, day then dim): `work/lift/cmp_lift.png`.

## Install

1. In Penumbra, **Import Mod** and pick the `.pmp`.
2. Enable it in the collection your character uses (your own individual collection is best: mounts and companions follow their owner's collection).
3. Summon the Company Chocobo. If it still shows a chocobo, redraw yourself (`/penumbra redraw self`) or dismount and remount.

## What changes

- Anything that uses the chocobo model (demihuman `d0001`) becomes the dragonhawk. That covers the Company, Legacy, Black, Draught and Amber Draught chocobo mounts, and your chocobo companion.
- Ground: it hovers like it does in WoW (idle, walk, strafe, back up, run, jump). Flying: idle, forward, turns, strafes, glide, take-off and climb. Underwater: swim set.
- Barding (head, body, legs) and the default saddle, reins and leg wraps are hidden, so nothing floats around it. The chocobo colour you fed it has no effect.
- The rider sits on its back, where WoW seats them (the M2 "MountMain" attachment).

## Known limits

- **Not confirmed in game yet.** Version 1.0.0 stored the animations uncompressed: `mount.pap` was 28.8 MB, about 10× any working resident pack, and the mount was invisible when ridden. Version 1.1.0 spline-compresses them like vanilla, so `mount.pap` is 2.7 MB. Everything was checked offline: the Havok writer rewrites vanilla skeletons and animations byte for byte, the spline decoder reads every vanilla chocobo animation with exact bone lengths, the animations decode back to the WoW poses within about 1 cm at the tail tip (median under 1 mm), and every model, material and texture redirect resolves. Things only the game can show: rider pose and clipping, and how the glow and transparency look under FFXIV lighting.
- **Conflicts with Swift Spectral Tiger:** that mod replaces the same chocobo skeleton, model and animation files, so enable only one of the two at a time.
- No sounds. The chocobo's footstep and flap sounds were removed, and WoW's aren't included.
- WoW's moving effects aren't included: the animated starfield scroll and the iridescent energy sheets. The void membranes are static, see-through and glowing instead.
- The chocobo companion's battle actions (and any other chocobo animation not in `mount.pap`, `demihuman.pap` or `idle.pap`) keep the dragonhawk in its rest pose while they play.
- It's big (about 7.8 m wingspan, seat about 3 m up). It hovers that high in WoW too, because its tail hangs about 3 m below the seat. To change it, see `SCALE` in `tools/wowsrc.py` and `SEAT_HEIGHT` in `tools/build_anims.py`.

## How it works

- **Skeleton:** the 86 chocobo bones stay unchanged (same names and order), followed by the dragonhawk's 225 weighted WoW bones (`dh_*`). Every vanilla chocobo animation still binds correctly. The new animations drive the `dh_*` bones and `n_mount` / `n_mount_second` (the rider seats).
- **Animations:** 50 slots across `mount.pap`, `demihuman.pap` and `idle.pap`. Each WoW clip is sampled at 30 fps and written as a spline-compressed Havok animation (`hkaSplineCompressedAnimation`, the same class vanilla uses), via our own encoder in `tools/havok_spline.py` and tagfile writer. The encoder uses linear splines that keep only the keyframes needed for 0.04° per bone, with 16-bit positions and 48-bit rotations. `tools/check_spline.py` proves the decoder on vanilla data. Each slot gets a minimal timeline (TMB) that only plays the animation. Every clip is levelled so the seat averages 3.0 m: WoW floats the body at different heights per clip (standing 3.4 m, flying 0.9 m), which would make the model jump at every take-off and landing.
- **Model:** feathers (alpha-cut), armour, void membranes (alpha-blended), and eyes, on Dawntrail `character.shpk` materials based on vanilla gear material `e0800`, with no dye table. Normal maps are generated from the painted detail. WoW's glow maps become emissive colour-table rows, which the id map blends in. `_id` G = 255 picks a pair's first row, so the glow is written inverted.
- **Matched to the source in GS (1.2.0):** `tools/compare_gs.py <tag> --local [--env day]` renders the original WoW model the way WoW draws it, next to the built pack in the PMP Viewer's game-shader renderer, from the same four cameras. In the WoW render the feathers are unlit with their glow added, the armour is lit, and the void and eyes are additive (`tools/blender/render_source_cam.py`). The fixes it led to:
  - Every material is single-sided, as in WoW's M2 material flags. Double-sided, the backs of the feather cards rendered black.
  - The feather texture's colour is pushed past the cut-outs, so smaller mips don't fringe black.
  - Feather specular is low.
  - The armour is part metal (gold 0.6, steel 0.45), and the steel plates are darkened to WoW's slate.
  - Under the viewer's Day light, fitted to in-game footage, feather colour matches WoW within about 15 RGB.
  - GS doesn't draw colour-table glow, so the glowing feather edges, eyes and gems only show in game.

## Rebuild

Python 3.11 (numpy, Pillow), .NET 10 SDK, and the portable Blender in `../Aerith/apps` for previews. From this folder:

```bash
python -P tools/make.py                      # skeleton, animations + check, models, textures, materials, .pmp
python -P tools/validate.py                  # redirects, materials, textures, animation bindings
python -P tools/preview.py built cbnm_id0:0,cbnm_fmt_02f_lp0:10 persp,side
```

`source/wow` is the wow.export output (glTF with animations, OBJ metadata and the raw M2) of `creature/dragonhawk2voidmount/dragonhawk2voidmount.m2` (file ID 6375144) from the local WoW install. `apps/xivtool` is built from `tools/xivtool` (Lumina plus Penumbra's own file and glTF code).
