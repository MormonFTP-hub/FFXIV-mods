# Hero Chaos Chao (Sonic Adventure 2: Battle) as Mammet #001

Penumbra mod: `out/Hero Chaos Chao (Mammet #001).pmp`. Preview: `out/preview.png` (rendered from the built mod files: bind pose, walking, waving, and an untouched Grand Company mammet on the right).

The Hero Chaos Chao from the GameCube SA2B rip (`source/HeroChaos`), on the Mammet #001 minion's skeleton, so it uses the mammet's own walk, idle and play animations.

## Changes

**1.1.0** (2026-10-25): brighter colours (Neon's lift). The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for". `tools/build.py` (`LIFT`, `lift()`, in `build_textures`) lifts each diffuse band (body gradient, belly, spots, eyes): luminance gamma 1.4 (dark and mid tones most, hue kept), then saturation x1.2 in linear light. The specular, normal and `_id` maps, the model and the material are unchanged. The Chao is mostly near-white already, so the change is gentle: in GS its overall brightness stays about the same, and the pink tips, orange belly and blue eyes are about 12% more saturated, with nothing garish or clipped to white. Before/after (1.0.1 and 1.1.0, day then dim): `work/lift/cmp_lift.png`.

## Getting the minion

Mammet #001 is one of the three minions any player can buy at any time with no requirements (the others are Cherry Bomb and Wayward Hatchling). It's also the only one of the three with arms, legs and a head. It costs 2,400 gil from:

| NPC | Where |
|---|---|
| Maisenta | New Gridania (X 11.5, Y 11.3), by the aetheryte |
| Bango Zango | Limsa Lominsa Lower Decks (X 10.0, Y 11.4) |
| Roarich | Ul'dah - Steps of Nald (X 10.6, Y 9.6) |
| minion trader | Gold Saucer, Chocobo Square (X 7.8, Y 7.0) |

It's also on the market board. The shops and locations come from the game data (`xivtool itemshops`, `xivtool npcwhere`).

## Install

1. In Penumbra, use **Import Mod** and pick the `.pmp`.
2. Enable it in the collection your character uses. Minions follow their owner's collection, so your own individual collection is best.
3. Summon Mammet #001. If it still shows the mammet, dismiss and resummon it, or run `/penumbra redraw`.

**Grand Company mammets** (option group). Mammet #003L, #003G and #003U share Mammet #001's model.
- **Stay mammets** (default): only Mammet #001 becomes the Chao.
- **Become Chao too**: all four mammets become the Chao.

## How it works

- **One model, two bodies.** `m8001b0001.mdl` holds the vanilla mammet (LOD0) and the Chao. Each mammet variant's IMC attribute mask picks which one shows. The vanilla model already does this for the GC flag (`atr_bv_a`, off for variant 1):
  - mammet body and flag: `atr_bv_a` (bit 0)
  - Chao: `atr_bv_b` (bit 1)
  - The vanilla mask for Mammet #001 (`0x3FE`) already shows only the Chao, so #001 doesn't depend on any IMC edit.
  - The option group edits variants 2–4: `0x3FD` hides the Chao, `0x3FE` hides the mammet. These manipulations are written by Penumbra's own serializer (`xivtool imcmanip`).
- **Fit.** The Chao is scaled to the mammet's head height (0.617 m) and keeps its own pose. Shoulders, hips and neck land within a few centimetres of the mammet's joints.
- **Weights** (`tools/fit.py`) come from the Chao's own shape, because its limbs are far thicker than the mammet's sticks:
  - trunk by height: hips below the waist, spine, then head from the chin up
  - arms blend from upper arm to forearm along their length
  - feet split between thigh and shin around the mammet's knee height
  - eyes, eyelids and ear-wings follow the head
- **Materials.** One `characterlegacy.shpk` material (`mt_m8001b0001_c`) copied from the mammet's own. Its diffuse and specular maps are atlases with one full-width band per SA2 texture: body gradient, belly, spots, eyes. It ships for all four material sets (`v0001`–`v0004`), because the game loads every material a model names, even on hidden submeshes. The SA2 textures are 32×32 (eyes 16×16), upscaled to 256-pixel bands. Normal maps are flat.

## Known limits

- **At most 4 materials** (since 1.0.1). The four SA2 texture sets (body gradient, belly, spots, eyes) share one material's atlas, so the model names 3 materials with the mammet's own two (1.0.0 had 6). Penumbra's `MdlMaterialMaximum` is 4, and vanilla monsters never go over it.
- **Not tested in game yet.** Checked offline only:
  - every shipped file parses with Lumina/Penumbra
  - every material and texture resolves for all four variants
  - the IMC options load through Penumbra's own manipulation reader
  - the built model, read back and posed, shows the right body per variant (`tools/check_mdl.py`)
- The mammet's real animations weren't previewed, only test poses. No vanilla (spline-compressed) animation decoder was written. Things to look for in game:
  - The arms pivot on the mammet's shoulders, about 4 cm inside the Chao's own, so big arm swings may dip into the belly.
  - The back crest, which runs down to the floor, bends between head and spine on large head nods.
- The SA2 rip has no halo, so there isn't one.
- No Chao sounds. It makes the mammet's sounds.
- Single LOD (as with any Penumbra-imported model).

## Rebuild

Python 3.11 (numpy, Pillow), .NET 10 SDK, and the portable Blender in `../Aerith/apps` for previews. From this folder:

```bash
python -P tools/make.py
```

Steps: `build` (model, textures, materials into `work/build`), `pack` (the `.pmp`), `validate`, `make_preview`. Use `--from <step>` to start partway. To build `apps/xivtool` from `tools/xivtool` (Lumina plus Penumbra's file, glTF and meta code):

```bash
dotnet build tools/xivtool/xivtool.csproj -c Release -o apps/xivtool
```

Other scripts (run with `PYTHONPATH=tools python -P tools/<script>.py`):
- `check_fit.py [bind|weights|wave|walk|look]`: the fitted Chao over the mammet, or posed, or coloured by bone.
- `check_mdl.py [pose] [views] [variants]`: renders the built `.mdl` per variant.
- `look_src.py` and `look_minions.py`: what was used to compare the source with candidate minions.

Model and textures belong to Sonic Team / SEGA. Personal use only: don't upload or share the `.pmp`.
