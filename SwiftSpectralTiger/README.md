# Swift Spectral Tiger (World of Warcraft) as an FFXIV mount

Penumbra mod: `out/Swift Spectral Tiger.pmp` (1.1.0). Every chocobo mount (and optionally the FFXIV tiger mounts) becomes the Swift Spectral Tiger, on the FFXIV tiger's skeleton and animations. Preview: `out/preview.png`.

## Changes

**1.1.0** (2026-10-25): brighter colours (Neon's lift). The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/build.py` (`LIFT`, `lift()`, used in `build_textures`) lifts the body and saddle diffuse maps: luminance gamma 1.4 (dark and mid tones most, hue kept), then saturation x1.2 in linear light.
- The glow is unchanged: the eye glow texture (`sst_eye_d`) and the materials' emissive rows (the body's soft blue glow, the green eyes) are as in 1.0.0. So are the normal, specular and `_id` maps, the models, materials, skeleton and animations.
- In GS (three-quarter view) the tiger's brightness rises about 10% by day and in dim light and its saturation about 18%: bluer fur and brighter cyan armour, with nothing clipped to white. Before/after (1.0.0 and 1.1.0, day then dim): `work/lift/cmp_lift.png`.

## Rebuild

From this folder, with the tools folder on the import path:

```bash
python -P -E -c "import sys,runpy; sys.path.insert(0,'tools'); runpy.run_path('tools/build.py', run_name='__main__')"   # work/build
python -P -E -c "import sys,runpy; sys.path.insert(0,'tools'); runpy.run_path('tools/pack.py', run_name='__main__')"    # out/*.pmp
```

`build.py` rebuilds the models, textures, materials, skeleton and animations. For a texture-only change, `build.build_textures()` alone rewrites `work/build/tex` (the paths in `index.json` stay the same), then pack.

Model and textures: Blizzard Entertainment (World of Warcraft). Personal use only.
