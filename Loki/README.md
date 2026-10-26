# Lady Loki – Seaside Siren (Marvel Rivals) for FFXIV

Penumbra mod: `out/Lady Loki - Seaside Siren (Marvel Rivals).pmp`. Preview: `out/preview.png`, rendered from the built mod files in an idle pose. Left to right: Loki on a Midlander woman, a Viera woman, an Au Ra woman, a Midlander man, a Roegadyn man and a Lalafell.

Ported from the psylocke.gg 3D viewer (https://psylocke.gg/heroes/loki/model?skin=seaside-siren), model `SK_1016_1016504_Lobby`. This is a full-body costume: Loki replaces your whole character, head included.

The `LadyLoki` project next door is the same skin as an outfit only (Bibo+ body, feminine races, your own face) on the Summer Sunset set, made from a game rip. The two packs use different gear and can both be on.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Summer's Flame** set (all classes, level 1): Summer's Flame Hat, Top, Wrist Torque, Pareo and Sandals. The quickest way is the Glamourer design: copy the code from `out/Lady Loki - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the five gear slots, shows the hat and turns the mod on. Glamourer can put the set on without you owning it.
3. If anything doesn't change, run `/penumbra redraw`.

| Item (Summer's Flame set, e0666) | Becomes |
|---|---|
| Summer's Flame Hat | Her head, long black hair with its bun, and the headpiece you pick (see Options). It hides your hair and ears. |
| Summer's Flame Top | Swimsuit, the sheer arm wraps, the gold back ornament, and the earrings and necklace of the jewellery set you pick |
| Summer's Flame Wrist Torque | Forearms and hands, the arm wraps' cuffs, bracelets |
| Summer's Flame Pareo | Hips and thighs, the sea-green skirt, the gold sash and the snake round her right thigh |
| Summer's Flame Sandals | Bare feet with the anklets |

**Races:** every race and gender.
- **Women** wear the Midlander woman fit. Every other race is reshaped from it by the game's racial deformer (EQDP entries in the mod make sure of that).
- **Men** get Loki on the Midlander man's broader frame, reshaped the same way for the other male races. Roegadyn men have their own fit, because the game's deformer from the Midlander man doesn't reproduce their arms; Hrothgar men are reshaped from it.
- **Lalafell** (men and women) get a little Loki with a big head.
- Your own tail (Miqo'te, Au Ra, Hrothgar) is hidden while the set is on.

## Options
In Marvel Rivals the skin has a **Customize** menu with three headpieces and three jewellery sets, and Loki wears one of each. The mod has the same choice (defaults are the game's defaults):
- **Headpiece:** Horned crown (default), Horned sunglasses (smaller horns, pink lenses), Crocodile hair clip, or None.
- **Jewellery:** Gold (default: drop earrings, armbands, anklets with shells), Shells (curled earrings, shell necklace, bangles), Starfish (green hoops and bracelets, starfish anklets), or None.
- **Hide your own face** (off by default): blanks every player face model. Turn it on only if your face shows (see below), and only in a collection used by your character alone.

Both part groups work the way vanilla gear switches parts per variant: every headpiece and jewellery set is its own submesh with an IMC attribute (`atr_mv_a`/`b`/`c` on the hat; `atr_tv`/`gv`/`dv`/`sv_*` on the other pieces), and each option sets the attribute mask of the Summer's Flame items (variant 1). The two groups never set the same piece's mask, so any combination works.

## Changes
**1.4.0** (Oct 25, "doesnt the head still kinda look weird to you?"):
- **Her face is awake.** The source's face rig was in its bind pose, and in that pose her upper eyelids are shut
  down over the eyes and her mouth is flat. Over the eyeballs that read as a heavy, sleepy, sullen stare
  (`work/preview/expr_compare.png`, left). The psylocke.gg viewer plays her lobby idle, whose face bones open her
  eyes and give her the smirk. `tools/expression.py` now poses her face, brows, eyes, mouth and the eye-shadow card
  from that idle's first key, before the fit, so the eyes are open as in the original. The mouth takes half of the
  smirk: the full one stretched the painted smile lines into pale smudges. `work/gs/v140_compare.png`: the
  original, 1.3.0 and 1.4.0 in GS.
- **Black hair again.** 1.3.0's colour lift brightened her near-black hair to a grey teal. The hair now keeps the
  20% saturation boost but not the brightening.

**1.3.0** (Oct 25, from your in-game shot of 1.2.0 in dim light: "why's she still look ugly. also the head i big"):
- **Skin on the game's skin shader.** Her face and body skin were on `character.shpk`, the gear shader. That looks
  fine in sun but turns grey and flat out of it, which is what your dusk shot shows (the Sora and Jotaro ports found
  the same). Face and body skin now use `skin.shpk`, cloned from the vanilla Midlander face and body materials:
  - she keeps her own tan: the character's skin colour doesn't tint her (`_norm` B = 0)
  - no lipstick (`_norm` A = 0)
  - a flat vanilla-like `_mask`
  - vertex colour (0,1,1,1), as vanilla faces and hands have it

  On this shader the skin textures are 1.15× brighter, not 1.4×: at 1.4 her face washed out in daylight. In GS
  night light her face and limbs now stay warm instead of going grey-brown (`work/gs/v130_compare.png`: 1.2.0 and
  1.3.0, day and night).
- **Smaller head.** 1.1.0 had scaled her head up so it would hide the wearer's own face completely, and it read big.
  It is now about 9% smaller: women 1.19 → 1.08, men 1.15 → 1.04. Roegadyn and Hrothgar men keep 1.29, because a
  smaller head let 10% of a Hrothgar man's fur show; Lalafell are unchanged, their own faces are too big.
- **Back of the head.** With the smaller head, the back of the wearer's own skull showed through the gaps in her
  hair from behind (7% of the face on a Midlander woman). `fit.py cover_skull` (from the Neon port) now pushes the
  back and sides of her head and hair out until they clear every player face of the races that wear each fit, by up
  to 2 cm, with the crown riding along. It's down to about 1%, mostly a patch below the ear where her earrings hang.
  "Hide your own face" still blanks the rest.
- **Brighter colours** (your request for every mod, from Neon 1.2.0): `textures.py` lifts the hair, swimsuit,
  skirt and gold/gem colour maps (`LIFT`). Luminance gets a 1.4 gamma with the hue kept, then saturation goes up 20%.
  Her skin (on skin.shpk) and the eyes are left as they are.

**1.2.0** (Oct 24, from your in-game screenshot of 1.1.0: "the faces keep coming out ugly", skin too dark). Reproduced
in GS with the viewer's daylight fitted to in-game footage (`tools/gs_render.py --env day --ao --pose idle`), which
matched the shot, then fixed one cause at a time:
- **Dark rings round the eyes** came from the source's occlusion map baked into the head's `_mask`. The game adds its
  own ambient occlusion and real shadows on top, so the eye sockets were darkened twice. No baked occlusion now. The
  crown's sun shadow on the brow is real and stays.
- **Glowing cyan irises:** the eye material was glossy (specular 200, roughness 40) and mirrored the sky, and the iris
  carried the source's 1.6× "iris brightness", meant for its own eye shader. The source's eyes are fully rough: now
  matte (60 / 220), iris at its texture colour.
- **Bruise-like patches and a cyan streak:** the face texture has small grey-teal paint strokes under the inner eyes,
  on the nose bridge and the chin, which the source's toon light washes out. They're blended 75% into the
  surrounding skin (`bake_src.py calm_strokes`, 0.2% of the texels).
- **Skin brighter:** the face, body, arm and leg skin textures are 1.4× brighter (linear). The source lights skin
  with toon bands that never drop far into shade; the game's daylight does, so at the source's colours she read dark.
  At 1.4 her sunlit cheek in GS daylight matches the original's.

**1.1.0** (Oct 24, from comparing the original with the PMP Viewer's game-shader render, GS):
- **Customize parts.** 1.0.0 showed all three headpieces and all three jewellery sets at once (the source model holds every variant; the viewer shows one of each). Now they're options, defaulting to the original's look: the horned crown, not the sunglasses, which had covered her eyes in 1.0.0.
- **Fingers.** Her fingers kinked mid-finger in the game's idle pose: her finger joints don't line up with FFXIV's two-bone fingers. Each finger now sits on the FFXIV knuckle and bends where the game bends it (as in the Mantis and Peni ports).
- **Eyes.** The source darkens the top of the eyeballs with a "fake eye shadow" card under the upper lids. It's baked into the eye texture now, so she looks half-lidded as in the original, not wide-eyed.
- **Neck.** Your own face model carries your neck down to the collar, and it showed as a sliver at the side of her neck, under the ear (0.8% of the face on a Midlander woman, seen from the side; `tools/poke.py` had missed it). Her neck is now pushed out just enough to cover it: at most 8 mm on the women's fit, so it keeps its slim line, and up to 14 mm and 30 mm on the Midlander and Roegadyn men's fits, whose own necks are much thicker.
- **Occlusion.** The source only applies its occlusion maps where a material asks for it (the head), so the body no longer gets them. That's about 10% brighter on the skin and outfit.
- The sunglasses' lenses are back (opaque pink; in the game they're tinted glass).
- Every material has `character.shpk`'s decal (crest) key off, as vanilla hands, legs and feet do. The body template had it on; the Sora port found that the game then lays a bound decal (there, the character's face paint) over the whole surface.
- Checked in GS and found to be the scene's light, not the mod: the overall darkness compared with the source render. The skin keeps the same shading ratio to the arm wraps as their textures have.



## Known limits
- **Not checked in game yet.** It was checked offline only:
  - every model, material and texture in the pack parses with Penumbra and Lumina
  - every material and texture a file names is shipped
  - Penumbra's own reader loads every manipulation
  - the built models, read back and posed, deform correctly (`work/preview/mdl_*`)
  - the PMP Viewer (`../PmpViewer`) resolves the set for all 18 races and genders with no problems: every slot comes from the mod, your hair, tail and Viera ears are hidden, and the vertex colours are white
- How much of each race's own face model (neck included) shows past her (`tools/showthrough.py`, 36 views round the head, face 1, without headpiece or jewellery, the worst case), 1.4.0 (the same as 1.3.0 within 0.05%):

  | Race | Men | Women |
  |---|---|---|
  | Midlander | 1.14% | 1.19% |
  | Miqo'te | – | 0.32% |
  | Roegadyn | 1.66% | 2.61% |
  | Au Ra | 0.37% | 1.30% |
  | Hrothgar | 3.08% (cheek fur) | – |
  | Viera | 1.66% | 0.20% |
  | Lalafell | 0.10% | 0.10% |

  Mostly a patch below the ear behind the jaw, where her earrings hang, seen from the side. Head sizes were searched per fitted race with `tools/tune_head.py`, then made about 9% smaller for 1.3.0, with the back of the head covered by `cover_skull`.

- Her face is static, in the open-eyed half smirk of her lobby idle (see 1.4.0): no blinking, mouth movement or other expressions. Her hair has no physics. The skirt rides the game's skirt bones, so it sways like a vanilla skirt.
- In the game's idle pose her hands rest at the skirt's ruffled hem, so the fingertips dip into it from some angles (same skirt as the original).
- The scepter isn't included (the full-body Rivals ports leave weapons out). The `LadyLoki` pack has it on the Omega Rod.
- The sunglasses' lenses are opaque pink. In Marvel Rivals they're tinted glass and her eyes show faintly through.
- The translucent hair wisps, teeth and tongue are left out. The fake eye-shadow card is baked into the eyes.
- Each model keeps to 4 materials, the most vanilla gear uses. So the upper-body and leg skin share one 2:1 texture, and the three gold / gem textures share one 2048 atlas (its fourth quadrant is the lens colour).
- Colours: Seaside Siren has its own textures (no dye pass to bake). The hair is psylocke.gg's overlay of the grey strand texture on the shadow-colour map, baked onto the strand UVs together with the strand-tip cut-outs. The eyes are the viewer's procedural eye, baked flat (no moving highlight).
- Materials: her face and body skin are on `skin.shpk` (see 1.3.0). Everything else is Dawntrail `character.shpk` with the baked colour and the rip's normal maps (green flipped: the rip's maps are green-down, FFXIV's green-up; `textures.py` checks every map with a curl test). No baked occlusion: the game's own does that job (see 1.2.0). Shine and roughness are per texture set (`tools/texsets.py` → `SETS`). The rip's toon shading, rim light and cube-map reflections aren't reproduced.
- Everyone in this mod's collection who wears the Summer's Flame set looks like Lady Loki.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy, Pillow and msgpack, plus the portable Blender in `../Aerith/apps`). Use `--from <step>` to start partway. The download isn't part of it: `python -P -E tools/fetch.py $(cat work/hashes.txt)` (the objects the viewer loaded) saves the content-addressed CDN objects to `source/cdn` and follows every hash the scene and glb files name.
1. `extract_src.py`: decodes the host glb (meshopt buffers, KTX2/UASTC textures) with `tools/native/xdec.dll` (built in the LunaSnow project), through `xdec.py` / `glb.py`. It writes the primitives, joints, materials and textures to `work/src`.
2. `bake_src.py`: the hair overlay and strand cut-outs, the eyeball texture (iris map inside the iris circle, tinted sclera, the fake eye shadow projected onto it from the front), then one albedo per FFXIV texture set, atlases included.
3. `prep_refs.py`: pulls the c0101, c0201, c0901, c1101, c1401 and c1801 skeletons, the racial deformer file, the bare body, a face and the Summer's Flame models from the game.
4. `fit.py`: retargets Loki onto each race in `PROFILES` through her own skeleton:
   - every source joint is resolved through its parent chain: twist and volume joints follow their limb; face, hair, crown and earring joints the head; bracelets their forearm; anklets and shells their shin or foot
   - torso: a height lattice through her ankles, knees, hips, shoulders and neck
   - limbs: one affine per bone, rotated onto the FFXIV bone and stretched to its length
   - hands: rigid, stretched along the palm to the FFXIV knuckles; each finger rigid on its FFXIV knuckle, aimed along the FFXIV finger
   - feet: rigid
   - neck: pushed out radially (at most 8 mm) until her head mesh and skin cover the neck of every player face that wears the fit (`cover_neck`, from the PeniParker port)
   - head: rigid, scaled and placed so her eyes sit on the wearer's eyes; the face comes in her lobby idle's expression (`expression.py`, through `srcdata.prim`)
   - weights: hers, renamed onto FFXIV bones, with the arm shared with the twist helpers the way the vanilla body does it; the fingers split between j_*_a and j_*_b by position along the FFXIV finger; the skirt chains go onto the FFXIV skirt bones by angle and height (after the Mantis port); hair: head, then the upper back below the jaw; headpieces and eyes: rigid on the head
   - every headpiece and jewellery set keeps its variant (`VARIANT`) for build.py's attributes
5. `textures.py` and `materials.py`: Dawntrail `character.shpk` textures and materials.
6. `build.py [races]`: splits Loki into the five gear models per race (each texture set only into slots that keep the model at 4 materials or fewer; the jewellery never on the hat), each part variant its own submesh with its IMC attribute. It converts them with Penumbra's importer (`apps/xivtool import`), copies the vanilla model flags and radius, and makes the empty face stand-ins. Already-built stand-ins and other races' models are kept, so one race can be rebuilt on its own.
7. `pack.py`, `glamourer_design.py`, `validate_pmp.py`, `render_preview.py`: the `.pmp`, the Glamourer design, the file and manipulation check, and `out/preview.png`.

Checks:
- `look_src.py [parts]` renders the unpacked source with the baked colours, whole and part by part.
- `check_fit.py <race> [other races]` renders the fit over the FFXIV body and face, and in idle and run poses.
- `poke.py <fit race> [races]` measures how much of each race's face shows through her head; `tune_head.py <race> [faces]` grid-searches a race's head scale and eye offsets with the head meshes only (after the InvisibleWoman port).
- `check_mdl.py <race>` renders the built `.mdl` and `.tex` files back, plus one colour per gear slot.
- `gs_render.py <out.png>` renders the built pack with the PMP Viewer's game-shader renderer (after the InvisibleWoman port): `--pose idle` skins it with the game's own animation, `--look <bone>,dx,dy,dz,dist` aims the camera at a posed bone, `--parts <head>,<jewellery>` picks the variants, `--output gbuffer2` shows the albedo, `--env day --sun az,el --ao` uses the viewer's daylight fitted to in-game footage (it reproduced the in-game face of 1.1.0).
- `showthrough.py <fit race> [race:face ...]` measures how much of the wearer's face model shows past her from 36 views, neck included (from the PeniParker port; poke.py misses the neck).

Tool changes from the White Fox project (its tools were the starting point):
- `tools/texsets.py`: Loki's texture sets (skin 2:1 atlas, three gold / gem textures in one 2048 atlas, the lens patch in its fourth quadrant).
- `tools/fit.py`: Loki's parts, the skirt-chain weights from the Mantis port, eyeballs picked by UV (the eye primitive also holds the teeth), and UV tiles shifted back into 0..1 before atlasing (the head, suit and upper body sit whole tiles off). The tail posing is gone (`tail_pose.py`, `look_tails.py`).
- `tools/bake_src.py`: no dye pass runs (none of Loki's materials use it); the fake eye shadow is baked into the eyes (`eye_shadow`, the viewer's own fakeEyeShadow formula).
- `tools/textures.py`: no baked occlusion (`AO_SCALE = 0`; 1.1.0 kept the head's, which double-darkened her eyes); skin.shpk layouts for the skin sets; Neon's colour lift (`LIFT`).
- `tools/materials.py`: the skin sets clone the vanilla skin.shpk face and body materials (`texsets.SKIN_SETS`).
- `tools/build.py`: vertex colour (0,1,1,1) on the skin meshes.
- `tools/bake_src.py`: skin gain (`SKIN_GAIN`), iris without the source's boost (`IRIS_GAIN`), grey-teal strokes calmed (`CALM_STROKES`).
- `tools/texsets.py`: matte eyes (60 / 220; the source's are fully rough).
- `tools/pack.py`: the Headpiece and Jewellery groups (IMC attribute masks).
- `tools/gs_render.py` (with `--pose`, `--look`, `--parts`) and `tools/showthrough.py` are new here.
- `tools/tune_head.py` is new (after InvisibleWoman's).
- `tools/build.py` writes white vertex colours (set 0 multiplies the surface in `character.shpk`; black renders pitch black in game).

Loki and Marvel Rivals belong to Marvel and NetEase. Fan port, personal use only: don't upload or share the `.pmp`.
