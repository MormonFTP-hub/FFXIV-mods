# Mantis – Dreamy Dew (Marvel Rivals) for FFXIV

Penumbra mod: `out/Mantis - Dreamy Dew (Marvel Rivals).pmp`. Preview: `out/preview.png`, rendered from the built mod files in an idle pose. Left to right: Mantis on a Midlander woman, a Viera woman, an Au Ra woman, a Midlander man and a Lalafell.

Ported from the psylocke.gg 3D viewer (`https://psylocke.gg/heroes/mantis/model?skin=dreamy-dew`): model `SK_1020_1020308_Lobby` with the Dreamy Dew materials (`MI_1020309_*`). This is a full-body costume: Mantis replaces your whole character, head included.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on **The Warden's** set (all classes, level 1): Wreath, Dress, Vambraces, Tanga and Thighboots. The quickest way is the Glamourer design: copy the code from `out/Mantis - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the five gear slots, shows the hat and turns the mod on. Glamourer can put the set on without owning it.
3. If anything doesn't change, run `/penumbra redraw`.

| Item | Becomes |
|---|---|
| The Warden's Wreath | Mantis's head and antennae, her black bob with buns, the blue polka-dot bow and hair ties. It hides your hair and ears. |
| The Warden's Dress | Torso, white camisole, the blue hooded robe (to the elbows), the chest flower and shoulder stars |
| The Warden's Vambraces | Forearms and hands, the robe's bell sleeves with their yellow cuffs, the scrunchie |
| The Warden's Tanga | Hips and legs, yellow shorts, the robe's long tails and the wings |
| The Warden's Thighboots | Socks and the blue slippers |

**Races:** every race and gender.
- **Women** wear the Midlander woman fit. Every other race is reshaped from it by the game's racial deformer (EQDP entries in the mod make sure of that).
- **Men** get Mantis on the Midlander man's broader frame, reshaped the same way for the other male races.
- **Lalafell** (men and women) get a little Mantis with a big head.

Option group:
- **Hide your own face** (off by default): blanks every player face model. Turn it on only if yours shows (see below), and only in a collection used by your character alone.

## Changes
**1.2.0** (Oct 25). Brighter colours, with Neon 1.2.0's colour lift. The user, on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/textures.py` lifts the baked albedo of every set except the line art (`LIFT`, `lift()`, in `maps()`): head, eyes, hair, body, robe, wings, camisole, outfit and the fluffy trims. Luminance is raised by a 1.4 gamma, which lifts dark and mid tones most and keeps the hue, then saturation goes up 20% in linear light. The black line-art shell (brows, lashes, hair outlines), the normal and mask maps and every alpha are unchanged.
- In GS (Midlander woman, idle) the figure's average luminance rises about 11% by day and 13% in dim neutral light, and its saturation about 20%: a brighter sky-blue robe, a more vivid yellow, rosier skin, and the white camisole keeps its shading. Before and after, by day and in dim light: `work/lift/cmp_lift.png`. To tune it, change `LIFT` and rerun `textures.py`, `pack.py`, `glamourer_design.py` and `validate_pmp.py`.

## Known limits
- **In game:** 1.0.0 rendered her pitch black. 1.0.1 fixed that and was confirmed in game. Fixed in 1.0.1:
  - every vertex had black vertex colour set 0. `character.shpk` multiplies the surface by it; vanilla gear has it white. `tools/build.py` now writes white (`xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla).
  - the head and legs models had 5 materials, over Penumbra's `MdlMaterialMaximum` of 4. The outfit, camisole, flowers and wings now share a 2x2 "cloth" atlas, and the head and eyes a 2:1 "face" atlas (`tools/textures.py` → `MATERIALS`), so no model has more than 4.
- **1.0.2 and 1.0.3** (Oct 24, from comparing the source render with the PMP Viewer's game-shader render; not yet checked in game):
  - **Camisole was grey and streaky.** The GLB's ORM slots don't all match their materials. The image named Equip_04 ORM is laid out on the robe's UVs, so the camisole got the robe's occlusion and roughness scattered over it. The camisole now uses the outfit's ORM (its own UV layout), and the robe and wings use that robe-layout ORM; their own ORM slots hold glass gradient strips. `textures.py` → `layout_check()` prints how well each ORM's edges line up with its colour map.
  - **Fingers stuck out as dark claws** whenever the game bent them. Her finger joints don't match FFXIV's two-bone fingers (knuckles 2-3 cm off, middle joints 15 mm apart), so bent tips swung about the wrong points. Each finger now keeps its shape, its base on the FFXIV knuckle, and its weight splits between `j_*_a` and `j_*_b` by position along the finger, as on vanilla gloves.
- **1.1.0** (Oct 25, the Lady Loki port's 1.2.0 fixes after your in-game report that the faces came out ugly and the skin too dark; checked in GS daylight, `work/gs/compare.png`, not yet in game):
  - **No baked occlusion.** The head's occlusion map was baked into its `_mask`, and the game adds its own occlusion and real shadows on top, so the eye sockets and creases were darkened twice (dark rings round the eyes).
  - **Matte eyes.** The eye material was glossy (specular 200, roughness 40) and mirrored the sky. The source's eyes are fully rough: now 60 / 220. The iris is baked at its texture colour, without the source's iris brightness (that's 1 for Dreamy Dew anyway, so the colour is the same).
  - **Brighter skin.** The head and body skin textures are 1.3× brighter (linear). The source lights skin with toon bands that never drop far into shade; the game's daylight does, so at the source's colours she read dark. Loki uses 1.4; here that would push the brightest 1.6% of her skin to the top of the range, and 1.3 keeps 99.5% of it below.
  - Loki's face had grey-teal paint strokes that read as bruises in game. Mantis's face has none: the only texels that test picks out on her head texture are the antennae's cyan tips and grey edges and a few at the inner corners of her green eye shadow, all part of her design, so they're left alone.
  - In GS the hard-edged dark patches under her eyes, nose and lips are sun shadows of her lashes, nose and lips (they go away with `--noshadow`), not the textures.
- Checked offline:
  - every model, material and texture in the pack parses with Penumbra and Lumina
  - every material and texture a file names is shipped
  - Penumbra's own reader loads every manipulation
  - the built models, read back and posed, deform correctly (`work/preview/mdl_*`)
  - the PMP Viewer's game-shader render (idle and two game poses, `PmpViewer/work/captures/mantis103_*`) matches the source render
- Her face is static: no blinking, mouth movement or expressions. Her hair and antennae have no physics. The robe's tails and the wings ride the game's skirt bones, so they sway like vanilla skirts.
- How much of each race's own face shows through her head (`tools/poke.py`, bind pose, women):
  - under 1% for Midlander, about 1–5% for Roegadyn, at the top of the forehead
  - 7% for Hrothgar (muzzle top)
  - 11–13% for Au Ra, at the jaw and neck scales under her bob
- Colours are the viewer's own: the game's dye layer (region colours on the dye map) is baked into the textures (`tools/shade.py`, after Luna Snow's port). Her hair is the grey strand texture overlaid with its shadow-colour map, baked onto the hair's second UV set. The eyes are the viewer's procedural eye, baked flat (no moving highlight) and matte. The black line-art shell (brows, lashes and hair outlines) is cut out by its opacity mask.
- The robe and wings are see-through glass-like materials in Marvel Rivals; here they're solid. psylocke.gg lights that glass physically in a dim lobby, so the robe looks navy there next to the toon-lit cloth; its dye colours are a bright sky blue, and that's what the mod uses.
- Normal maps are the game's own. They're DirectX-style (green down); `tools/textures.py` → `curl_test()` shows it for all four. The green channel is flipped to FFXIV's green-up. If bumps still look lit from below in game, drop the `255 - ` in `build()`. Shine is set per surface there (`TEXSETS`); roughness comes from the game's ORM maps. Their occlusion isn't baked in (`AO_SCALE`): the game adds its own.
- The head flags are copied from the vanilla Moogle Head. With the set on, the body flags hide necklaces, earrings, bracelets, rings and tails, and breast physics is off.
- Everyone in this mod's collection who wears The Warden's set looks like Mantis.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy, Pillow and msgpack, plus the portable Blender in `../Aerith/apps` for previews). Use `--from <step>` to start partway. The psylocke.gg objects are downloaded once with `python -P -E tools/fetch.py $(cat source/roots_all.txt)` (the hashes the viewer page loaded) into `source/cdn`.
1. `extract_src.py`: unpacks the character GLB (meshopt buffers, KTX2 textures via `tools/native/xdec.dll`) into `work/src`: one mesh per material, the skeleton and every texture.
2. `shade.py`: bakes the viewer's material colour into plain albedo textures (`work/src/albedo`): the dye layer, the hair overlay, the line art and the eyes, and the skin gain (`SKIN_GAIN`).
3. `prep_refs.py`: pulls the c0101, c0201, c1101, c1401 and c1801 skeletons, the racial deformer file, the bare body, a face and The Warden's models from the game.
4. `fit.py`: retargets Mantis onto each race in `PROFILES` through her own Unreal skeleton:
   - torso: a height lattice through her ankles, knees, hips, shoulders and neck
   - limbs: one affine per bone, rotated onto the FFXIV bone and stretched to its length
   - hands and slippers: rigid (the palm stretched to the FFXIV knuckles); each finger keeps its shape, its base on the FFXIV knuckle
   - head: rigid, scaled and placed so the wearer's face stays inside it
   - physics chains (hood, cuffs, hair ties, flowers) move with the body bone they hang from
   - weights: hers, renamed onto FFXIV bones, with the arm shared with the twist helpers the way the vanilla body does it; fingers split between `j_*_a` and `j_*_b` by position along the FFXIV finger
   - robe tails, wings and the camisole hem: the FFXIV skirt chains, by angle and height
5. `textures.py` and `materials.py`: Dawntrail `character.shpk` textures and six materials (body, robe, cloth atlas, face atlas, hair, line art).
6. `build.py`: splits Mantis into the five gear models per race, moves each part's UVs into its atlas tile, converts them with Penumbra's importer (`apps/xivtool import`), copies the vanilla model flags and radius, and makes the empty face stand-ins.
7. `pack.py`, `glamourer_design.py`, `validate_pmp.py`, `render_preview.py`: the `.pmp`, the Glamourer design, the file and manipulation check, and `out/preview.png`.

Checks:
- `look_src.py` renders the source with the baked colours (`work/preview/src_sheet.png`).
- `check_fit.py <race> [other races]` renders the fit over the FFXIV body and face, and in idle and run poses.
- `poke.py <fit race> [races]` measures how much of each race's face shows through her head.
- `check_mdl.py <race>` renders the built `.mdl` and `.tex` files back, plus one colour per gear slot.

Tools are Mina's (`pbd.py` included), with the psylocke.gg fetch, GLB reader and decoder from the Luna Snow / Invisible Woman ports. `tools/xivtool/Program.cs` adds `mdlstreams` (per-mesh vertex element stats; the copy in `apps/xivtool` predates it, so build it with `dotnet build` to use it).

Mantis and Marvel Rivals belong to Marvel and NetEase. Fan port, personal use only: don't upload or share the `.pmp`.
