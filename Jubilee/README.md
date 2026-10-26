# Jubilee – Vampy Jammies (Marvel Rivals) for FFXIV

Penumbra mod: `out/Jubilee - Vampy Jammies (Marvel Rivals).pmp`. Preview: `out/preview.png`, rendered from the built mod files in an idle pose. Left to right: Jubilee on a Midlander woman, a Viera woman, an Au Ra woman, a Midlander man and a Lalafell.

Ported from the psylocke.gg 3D viewer's copy of the game model (`https://psylocke.gg/heroes/jubilee/model?skin=vampy-jammies`; the CDN objects are in `source/cdn`). This is a full-body costume: Jubilee replaces your whole character, head included.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Pajama** set (all classes, level 1): Eye Mask, Shirt, Bottoms and Slippers. Plain, Cactuar and Chocobo pajamas all work. The quickest way is the Glamourer design: copy the code from `out/Jubilee - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the four gear slots, empties the hands slot, shows the hat and turns the mod on. Glamourer can put the set on without owning it.
3. If anything doesn't change, run `/penumbra redraw`.

| Item | Becomes |
|---|---|
| Pajama Eye Mask | Jubilee's head, amber slit eyes, black bob and the sleep-mask hat. It hides your hair and ears. |
| Pajama Shirt | Fluffy jacket, crop top, bare midriff, arms and her hands. Whatever is in your hands slot is hidden. |
| Pajama Bottoms | Pink shorts and bare thighs |
| Pajama Slippers | Knee-high leg warmers and the bunny slippers |

**Races:** every race and gender.
- **Women** wear the Midlander woman fit. Every other race is reshaped from it by the game's racial deformer (EQDP entries in the mod make sure of that).
- **Men** get Jubilee on the Midlander man's broader frame, reshaped the same way for the other male races.
- **Lalafell** (men and women) get a little Jubilee with a big head.

Option groups:
- **Sprinkles**: with sprinkles (default) or none. In the game her outfit has little candy sprinkles floating round it; here they ride the nearest bone.
- **Hide your own face** (off by default): blanks every player face model. Turn it on if your face or horns show (Au Ra, see below), and only in a collection used by your character alone.

## Changes
**1.1.0** (Oct 25). Brighter colours, with Neon 1.2.0's colour lift. The user, on Neon 1.2.0: "YES EVERY MOD SHOULD BE
THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/textures.py` lifts every colour half before the atlases are put together (`LIFT`, `lift()`, in `build()`):
  skin, head, eyes, the pink and fluffy cloth, the baked hair, and the cards half (fringe strands in the hair's colour,
  brows, lashes and sprinkles, lifted so the fringe keeps matching the hair). Luminance is raised by a 1.4 gamma,
  which lifts dark and mid tones most and keeps the hue, then saturation goes up 20% in linear light. Normal and mask
  maps and every alpha are unchanged.
- In GS (Midlander woman, idle) the figure's average luminance rises about 11% by day and 13% in dim neutral light,
  and its saturation about 15%. The pink shorts and mask reach full red in sunlight, the white jacket and leg warmers
  keep their shading, and the skin is a little warmer. Before and after, by day and in dim light:
  `work/lift/cmp_lift.png`. To tune it, change `LIFT` and rerun `textures.py`, `pack.py`, `glamourer_design.py` and
  `validate_pmp.py`.

## Known limits
- **1.0.1: vertex colour set 0 is now white.** 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so the model would have rendered pitch black in game, as Mantis did on its first test. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla.
- **Not checked in game yet.** It was checked offline only:
  - every model, material and texture in the pack parses with Penumbra and Lumina
  - every material and texture a file names is shipped, for all three Pajama variants
  - Penumbra's own reader loads all 76 manipulations
  - the built models, read back and posed, deform correctly (`work/preview/mdl_*`)
- Her face is static: no blinking, mouth movement or expressions (the teeth and tongue aren't included). Her hair and jacket have no physics.
- How much of each race's own face shows through her head (`tools/poke.py`, women, bind pose):
  - under 1% for Midlander and Viera
  - up to 3% for Highlander, Elezen, Miqo'te and Roegadyn (bits of the scalp through gaps in her hair)
  - about 4% for Hrothgar, at the top of the head
  - 6–12% for Au Ra: their horns poke out through her hair. Turn on **Hide your own face** if that bothers you.
  - Men weren't measured.
- Her shins are longer than any FFXIV race's, so the leg warmers are shortened to fit between the FFXIV knee and ankle (to about 77% on women, 71% on men and 51% on Lalafell).
- The game's stylized hair shader lights her hair with a grey "lit" colour and a dark shadow-colour map. FFXIV has one colour, so the hair uses the shadow colours (black with pink and teal streaks), as she mostly looks in the viewer.
- The rip's eyes are drawn by a shader from separate iris and sclera maps; they are composited into one map (`tools/textures.py` → `eye_set`). No eye highlight movement.
- Not ported: the rim-light shell and the translucent fake eye shadow.
- With the set on, the body flags hide necklaces, earrings, bracelets, rings and tails, and breast physics is off. The head flags are copied from the vanilla Moogle Head.
- Everyone in this mod's collection who wears the Pajama set looks like Jubilee.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy, Pillow and msgpack; the portable Blender in `../Aerith/apps`; portable Node in `apps/`, with `meshoptimizer` 1.2.0 and three.js 0.170.0's Basis transcoder in `apps/npm`). Use `--from <step>` to start partway.
0. `fetch.py` (not part of make): downloads the CDN objects the viewer loaded (`work/roots.txt`, captured from the viewer page) and every object they name.
1. `extract_src.py`: the character glTF is meshopt-compressed and its textures are Basis UASTC KTX2. `decode_glb.mjs` and `decode_ktx2.mjs` undo that; the script dumps meshes, weights, the skeleton's bind pose and PNG textures to `work/src`.
2. `prep_refs.py`: pulls the c0101, c0201, c1101, c1401 and c1801 skeletons, the racial deformer file, the bare body, a face and the Pajama models from the game.
3. `fit.py`: retargets Jubilee onto each race in `PROFILES` through her own Unreal-style skeleton:
   - torso: a height lattice through her ankles, knees, hips, shoulders and neck
   - limbs: one affine per bone, rotated onto the FFXIV bone and stretched to its length
   - hands: rigid; slippers: rigid, turned to point along the FFXIV foot
   - head: rigid, scaled and placed so the wearer's face stays inside it
   - helper bones (twist, volume, cloth, hair, face, ornaments) follow their nearest core bone
   - weights: hers, renamed onto FFXIV bones, with the arm shared with the twist helpers the way the vanilla body does it
4. `textures.py` and `materials.py`: Dawntrail `character.shpk` textures and four materials (skin, face, cloth, hair). The rip's normal maps are DirectX-style and are flipped to FFXIV's green-up.
5. `build.py`: splits Jubilee into the four gear models per race, plus copies without the sprinkles. It converts them with Penumbra's importer (`apps/xivtool import`), copies the vanilla model flags and radius, and makes the empty face stand-ins.
6. `pack.py`, `glamourer_design.py`, `validate_pmp.py`, `render_preview.py`: the `.pmp`, the Glamourer design, the file and manipulation check, and `out/preview.png`.

Checks:
- `look_src.py` renders the decoded source.
- `check_fit.py <race> [other races]` renders the fit over the FFXIV body and face, and in idle and run poses.
- `poke.py <fit race> [races]` measures how much of each race's face shows through her head.
- `check_mdl.py <race>` renders the built `.mdl` and `.tex` files back, plus one colour per gear slot.

Tool changes from the Mina project:
- New: `fetch.py`, `extract_src.py`, `decode_glb.mjs`, `decode_ktx2.mjs`, `look_src.py` (psylocke.gg source); `fit.py`, `srcdata.py` and `textures.py` are rewritten for her Unreal-style skeleton and glTF maps.
- `check_mdl.py` and `render_preview.py` now apply the racial deformer before posing, on the wearer's own skeleton. Posing first on the Midlander skeleton twisted Au Ra hands in the preview (vanilla bare hands too); the mod files were never affected.
- `preview.py` / `blender/render_obj.py` can cut a mesh with an opacity map (`alpha_texture`), so alpha-tested hair, lashes and sprinkles render as in game.

Jubilee and Marvel Rivals belong to Marvel and NetEase. Fan port, personal use only: don't upload or share the `.pmp`.
