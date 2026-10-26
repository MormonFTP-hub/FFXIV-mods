# Cloud Strife (FF7 Remake) for FFXIV

Penumbra mod: `out/Cloud Strife (FF7R) - Strife Set.pmp`. Preview: `out/preview.png`.

## Install and wear

1. In Penumbra, use **Import Mod** and pick the `.pmp`. Enable it **only in the collection your character uses**.
2. With Glamourer, make your character **Hyur Midlander male**.
3. Equip all four **Strife** pieces: Strife Vest, Strife Gloves, Strife Bags, Strife Boots. Glamourer can apply them even if you don't own them.
4. Leave the head slot empty.

Cloud is split across the four pieces (body in the Vest, head and hair in the Gloves, eyes and mouth in the Bags). If you leave one off, parts go missing.

### Options (group "Head")
- **Cloud's head** (default): his FF7R face and hair. Replaces every Midlander male face (43) and hairstyle (119) with an empty model while the mod is on. His face is static: no blinking, expressions or lip-sync.
- **My own face and hair**: outfit only, so your face keeps its animations.

### Things to know
- If another face or hair mod has higher priority in the same collection, your FFXIV face or hair can show through. Raise this mod's priority.
- Other male races that wear the Strife set in that collection may also show Cloud, since they share the Midlander model.
- There's no Buster Sword. The download didn't include it.

## Changes
**1.1.0** (2026-10-25): **brighter colours**, Neon 1.2.0's colour lift. The user, on seeing Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for". `tools/build_textures.py` (`LIFT`, `lift()`, in `bake()`) raises each `_d` map's luminance by a 1.4 gamma (dark and mid tones most, hue kept), then multiplies saturation by 1.2 in linear light. It touches every legacy diffuse: both body sets (`top_a`, `top_b`: his clothes and gear), the face (`glv_a`), hair (`glv_b`), eyes (`dwn_a`) and mouth (`dwn_b`). The `_d` alpha (opacity) goes in unchanged (BC7 re-encoding nudges a few texels: under 0.4% of the hair's move by more than 8/255), and the `_n` and `_s` maps and the materials are byte-identical to 1.0.0. In the PMP Viewer's game-shader renderer (GS, Midlander man, idle) he is about 37% brighter by day and 39% in dim neutral light, saturation 0.19 to 0.22, with nothing clipped to white; his hair is a richer gold and his skin stays natural (`work/lift/cmp_lift.png`: 1.0.0 and 1.1.0 by day, then in dim light; `work/lift/before.pmp` is 1.0.0). To tune it, change `LIFT` and rerun `build_textures.py` and `package.py`.

## Rebuild

From this folder (Python 3.11 with numpy and Pillow; `-P` keeps the source folder off the import path):

```bash
python -P tools/build_cloud.py      # DAE -> FFXIV-space meshes + TexTools .db per slot
python -P tools/wrap_models.py      # .db -> .mdl via TexTools, verified by unwrapping
python -P tools/build_textures.py   # baked _d/_n/_s textures + characterlegacy .mtrl
python -P tools/build_hiders.py     # empty face/hair/option models
python -P tools/package.py          # out/*.pmp
python -P tools/render.py out/preview.png
```

`tools/tt` is a private copy of TexTools whose `console_config.json` points at `tools/ttgame`. That folder links the real `sqpack` read-only, so TexTools' cache never writes into Program Files.

## Conversion notes
- The source DAE is Blender Z-up in decimeters. FFXIV is Y-up meters, +Z forward: `(x, z, -y) * 0.1`.
- Cloud's proportions already match c0101 closely. Only the arm and finger chains are refit to the FFXIV reference pose (rotate plus stretch along the bone, applied with linear blend skinning). Spine, neck, head and legs keep their shape. FF7R helper, face and hair joints are remapped onto FFXIV bones by `weight_rule()` in `build_cloud.py`.
- TexTools DB: UV V is bottom-up, with **one mesh per material** (sources become parts). Wrap with `/mats`, and material names must be the full `/mt_c0101e0263_<slot>_<x>.mtrl`.
- FF7R normal maps are green-down. FFXIV's are green-up, so G is flipped. Normal B and diffuse A both carry opacity (alpha test at 0.5).
- `BodyA_O`, `BodyB_O` and `Eye_O` belong to a second UV set that isn't in the export, so they're not used.
- Materials use `characterlegacy.shpk` in diffuse mode (key `0xB616DC5A = 0x600EF9DF`) with a neutral 32-row colour table. Hair is double-sided (flags `0x0C`).
