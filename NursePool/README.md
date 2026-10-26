# Nurse-Pool (Marvel Rivals) for FFXIV

Penumbra mod: `out/Nurse-Pool (Marvel Rivals).pmp`. Preview: `out/preview.png`, rendered from the built mod files in an idle pose. Left to right: a Midlander man, a Roegadyn man, an Au Ra man, a Midlander woman and a Lalafell. `out/gs_compare.png`: the original in the psylocke.gg viewer, then 1.0.1 and 1.1.0 in the PMP Viewer's game shaders (daylight, idle).

Ported from Deadpool's **Nurse-Pool** skin as shown in the [psylocke.gg model viewer](https://psylocke.gg/heroes/deadpool/model?skin=nurse-pool) (Marvel Rivals, lobby model `SK_1057_1057801_Lobby`). It's a full-body costume: Nurse-Pool replaces your whole character, head included.

## Changes
**1.3.0** (Oct 25, "could you make the colors brighter somehow"). Measured in GS on the Midlander man in the game's
idle, against 1.2.0: the figure is 10% brighter in sun and 12% in shade, with 5-6% more saturation
(`out/brightness_1.3.0.png`: 1.2.0 and 1.3.0, in sun and in shade).
- **Stronger colour lift** on the dress, gear atlas, legs, wig and loose strands: luminance gamma 1.6 and saturation
  1.3, up from 1.4 and 1.2 (`tools/textures.py` `LIFT`). The white dress keeps its shading; mid and dark tones gain most
  (golden wig, teal gloves and ruffles, fishnets).
- **Bare skin on the game's skin shader** (`skin.shpk`, cloning the vanilla male body's skin material) instead of the
  gear shader. On the gear shader, skin goes grey and dim whenever the sun isn't on it (Sora and Jotaro in game).
  Deadpool keeps his own skin colour: your character's skin colour doesn't tint it (`_norm` B = 0). Flat skin mask and
  vertex colour (0, 1, 1, 1) as the vanilla skin has it, and no colour lift on it. His skin is 1.4x brighter in linear
  light (`SKIN_GAIN`): 7-8% brighter than 1.2.0's, sun or shade; 1.5 began to flatten the shading on his shoulders.
- Tune it with `LIFT` and `SKIN_GAIN`, then rerun `textures.py`, `pack.py` and `validate_pmp.py`
  (`materials.py` and `build.py` too after changing which sets are skin).

**1.2.0** (Oct 25). Brighter colours, with Neon 1.2.0's colour lift. The user, on Neon 1.2.0: "YES EVERY MOD SHOULD BE
THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/textures.py` lifts every colour map (`LIFT`, `lift()`): the dress, gear atlas, legs, skin (after its 1.5x
  `SKIN_GAIN`), the baked wig and the loose strands. Luminance is raised by a 1.4 gamma, which lifts dark and mid tones
  most and keeps the hue, then saturation goes up 20% in linear light. Normal and mask maps and every alpha are
  unchanged. In GS (Midlander man, idle) the figure's average luminance rises about 18% by day and 19% in dim neutral
  light, and its saturation about 17%; the white dress keeps its shading. Before and after, by day and in dim light:
  `work/lift/cmp_lift.png`. To tune it, change `LIFT` and rerun `textures.py`, `pack.py`, `glamourer_design.py` and
  `validate_pmp.py`.

**1.1.0** (Oct 25, from comparing the original with the PMP Viewer's game-shader render, GS). Checked in GS with the
viewer's daylight fitted to in-game footage, posed with the game's idle (`tools/gs_render.py --env day --ao --pose idle`):
- **Near-black outfit.** 1.0.x wrote the rip's metalness into the `_id` texture's green, with a metal second row in the
  colour table. In Dawntrail, green 255 picks the pair's FIRST row, so almost every texel was full metal, which renders
  near-black in daylight (in GS, and as Gekko showed in game). Every row is plain now. The rip has no texel above 0.5 metal.
- **Mirrored tiles.** The template material samples its textures with Mirror addressing, and the gear atlas runs past
  u = 1 (872 of its triangles straddle a tile edge), so those parts could have shown flipped. The samplers wrap now, as in
  the original.
- **Darker than the source.** The rip's occlusion maps were baked into the `_mask`, on top of the game's own ambient
  occlusion and shadows. Only one small piece asks for them (`aoIntensity`), so none are baked now.
- **Skin 1.5x brighter** (linear). The source lights skin with toon bands that never drop far into shade, so at the
  source's colours his skin read dark in GS daylight. Measured as skin over white-dress brightness: 0.36 in the
  psylocke.gg viewer, 0.34 in GS now (1.4x gave 0.33; higher gains start to clip the pale highlights).
- **Wig colour** is now baked as the viewer's hair shader does it: an overlay of the grey strand texture onto the
  shadow-colour map (after the Mantis port). Against the red mask it matches the viewer within 2%.
- **Fingers.** His three-joint fingers don't line up with FFXIV's two-bone fingers (knuckles up to 2.6 cm off). Each
  finger now sits on the FFXIV knuckle and bends where the game bends it, as in the Mantis, Peni and Loki ports.
- **Knees.** His knee volume joints go onto the FFXIV knee bone (`j_asi_b`), as the vanilla body has it. The red frills
  at the top of the socks are now part of the Bloomers model, and the Pumps model has one material.
- **Neck.** Your own face model carries your neck down to the collar. A sliver of it showed at the nape from a low side
  view (0.45% of a Midlander man's face, `tools/showthrough.py`). The mask's neck is pushed out to cover it, by at most
  14 mm for men, 8 mm for women and 30 mm for Roegadyn men. In GS, face on vs face hidden now differ by 0 pixels from
  three angles round the head (idle pose, head height).
- Every material has `character.shpk`'s decal (crest) key off, as vanilla hands, legs and feet do.

**1.0.1:** vertex colour set 0 is white. 1.0.0 wrote it black, and `character.shpk` multiplies the surface by it, so
the model would have rendered pitch black in game (as Mantis did on its first test).

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Housemaid's** set (all classes, level 1): Brim, Apron Dress, Wristdresses, Bloomers and Pumps. The quickest way is the Glamourer design: copy the code from `out/Nurse-Pool - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the five gear slots, shows the hat and turns the mod on. Glamourer can put the set on without you owning it.
3. If anything doesn't change, run `/penumbra redraw`.

| Item (Housemaid's set, e6016) | Becomes |
|---|---|
| Housemaid's Brim | His masked head with the eye patch, the blonde wig and the nurse cap. It hides your hair and ears. |
| Housemaid's Apron Dress | Dress bodice and collar, stethoscope, belt with vials and pouches, the heart plate on his back, bare upper arms |
| Housemaid's Wristdresses | Forearms and the big teal gloves |
| Housemaid's Bloomers | The skirt and its ruffles, thighs, knees, bandages, the syringe pack and the red frills at the top of the socks |
| Housemaid's Pumps | Fishnet socks and red platform heels |

The **Loyal Housemaid's** set uses the same models, so it changes too.

**Races:** every race and gender.
- **Men** get him on the Midlander man's frame. Highlander, Elezen, Miqo'te, Au Ra and Viera men are reshaped from it by the game's racial deformer (EQDP entries in the mod make sure of that).
- **Roegadyn men** have their own fit. Vanilla gear always ships Roegadyn models, and the deformer data from the Midlander man doesn't reproduce the Roegadyn skeleton: its arm entries scale 2.7× and put the shoulders 0.68 m off. **Hrothgar men** use the Roegadyn fit; the game's deform from Roegadyn to Hrothgar is close to identity.
- **Women** wear a slightly narrower version fitted to the Midlander woman, reshaped the same way for the other female races.
- **Lalafell** (men and women) get a little Nurse-Pool with a big head.

Option group:
- **Hide your own face** (off by default): blanks every player face model. Turn it on only if your face shows through his mask, and only in a collection used by your character alone.

## Known limits
- **Not checked in game yet.** It was checked offline only:
  - every model, material and texture in the pack parses with Penumbra and Lumina
  - every material and texture a file names is shipped
  - Penumbra's own reader loads all 95 manipulations
  - the built models, read back and posed, deform correctly (`work/preview/mdl_*`)
  - the pack renders like the original in the PMP Viewer's game shaders (GS), posed with the game's idle, on the Midlander man and woman, the Roegadyn man and the Lalafell
- How much of each race's own face shows through his head (`tools/poke.py`, 1.0.0's numbers, before the neck cover; bind pose, every face of each race):

  | Race | Men | Women |
  |---|---|---|
  | Midlander | 0.5–1.5% | 2–5% |
  | Highlander | 1–2% | 2–4% |
  | Elezen | 1–4% | 0.4–3.4% |
  | Miqo'te | 2–3% | 3.5–4% |
  | Roegadyn | 1.3–1.4% | 1–2% |
  | Au Ra | 7–15% (horns and jaw scales) | 10–14% (horns and jaw scales) |
  | Hrothgar | 1–4% | 5% |
  | Viera | 1–2% | 2–2.5% |
  | Lalafell | 2–4% | 2–4% |

  Apart from the Au Ra horns, most of it is the underside of the jaw, which only shows from below.
- The mask is static: no blinking or lip movement. The wig has no physics; its lower strands follow the neck and upper back so they don't cut through the shoulders when he turns his head. The skirt rides the game's skirt bones, so it sways like vanilla skirts.
- His katanas and Desert Eagles aren't included.
- Materials are Dawntrail `character.shpk` with the rip's colour (lifted brighter), normal (green flipped: the rip's maps are green-down, FFXIV's green-up) and roughness maps, plain white colour-table rows and no baked occlusion. His bare skin is on `skin.shpk` with his own colour (your skin colour setting doesn't change it). The rip's toon shading, rim light and outline shell aren't reproduced, and the near-invisible glass on the belt vials was dropped.
- The wig's colour is the viewer's overlay of its grey strand texture (first UV set) onto its shadow-colour map (second UV set), baked into the second set's layout. The loose strand cards are alpha-tested.
- In the game's idle his big hands hang into the edge of the wide skirt, as with wide vanilla skirts.
- Everyone in this mod's collection who wears the Housemaid's set looks like Nurse-Pool.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy, Pillow and msgpack, plus the portable Blender in `../Aerith/apps` for previews). Use `--from <step>` to start partway.
1. `fetch.py`: downloads the viewer's content-addressed objects listed in `source/roots.txt` (taken from the page's network requests) to `source/cdn`, following every hash the scene files name.
2. `export_src.py`: unpacks the character glb (meshopt-compressed buffers and KTX2/UASTC textures, decoded by `tools/native/xdec.dll`, built from basis_universal and meshoptimizer by `tools/native/build.ps1`) into `work/src`: meshes, skeleton, materials and PNG textures. glTF is already in FFXIV's axes.
3. `prep_refs.py`: pulls the FFXIV skeletons, the racial deformer file, faces and the Housemaid's models from the game (Lumina, through `apps/xivtool`).
4. `fit.py`: retargets him onto each race in `PROFILES` through his own UE-style skeleton:
   - torso: a height lattice through his ankles, knees, hips, shoulders and neck, with `shoulder` setting how much of his shoulder breadth he keeps
   - limbs: one affine per bone, rotated onto the FFXIV bone and stretched to its length
   - hands: scaled so his middle knuckle meets theirs; each finger rigid on its FFXIV knuckle, aimed along the FFXIV finger
   - heels: rigid, scaled by `foot`, sole on the floor and toes turned forward
   - head: rigid, scaled and placed so the wearer's face stays inside it
   - neck: the mask's neck pushed out radially, at most `neck_cap`, until it covers the neck of every player face that wears the fit (`cover_neck`, from the PeniParker port)
   - weights: every joint goes to its nearest mapped ancestor (knee volume joints to the FFXIV knee). Spine weight is spread by height, arm weight is shared with the twist helpers the way the vanilla body does it, finger weight is split between j_*_a and j_*_b by position along the FFXIV finger, skirt joints go to the FFXIV skirt chains by angle and height, and the wig rides the head and neck.
5. `textures.py` and `materials.py`: Dawntrail `character.shpk` textures and materials, one per texture set (dress, gear atlas, legs, skin, wig, loose strands). The wig is rasterised into its second UV set (`raster.py`, from the Mantis port). The materials' samplers are switched to wrap and the decal key off in the written file (`mtrl.py`).
6. `build.py`: splits him into the five gear models per race by skin weight, at most three materials each, and converts them with Penumbra's importer (`apps/xivtool import`). It copies the vanilla model flags and radius, and makes the empty face stand-ins.
7. `pack.py`, `glamourer_design.py`, `validate_pmp.py`, `render_preview.py`: the `.pmp`, the Glamourer design, the parse checks and `out/preview.png`.

Checks:
- `look_src.py` renders the unpacked source.
- `check_fit.py <race> [deform race ...]` renders the bind pose over the FFXIV body, the slots, a face close-up, and idle and run poses.
- `showthrough.py <fit race> [race[:face] ...]` renders the fit and the wearer's face from 36 directions and counts the face's visible pixels (`poke.py`'s rays from the head centre miss the neck).
- `check_mdl.py <race>` renders the built `.mdl` and `.tex` files back.
- `gs_render.py <out.png> --race <race>` renders the built pack with the PMP Viewer's game-shader renderer. `--pose idle` skins it with the game's own animation, `--env day --ao` uses the viewer's daylight fitted to in-game footage, `--look <bone>,dx,dy,dz,dist` aims the camera at a posed bone, and `--swap <game path>=<file>` swaps one file without repacking. `../PmpViewer/tools/gs_render.py` also draws the wearer's own face and body; with `--set "Hide your own face=Hide every player face"` it gives the face-off render to diff against.

Renders go to `work/preview/` and `work/gs/`.

`tools/pbd.py` is Mina's racial-deformer reader with two parents fixed, verified against the game skeletons: the Hrothgar man derives from the Roegadyn man (c0901), and the Lalafell woman from the Lalafell man (c1101).

Deadpool and Marvel Rivals belong to Marvel and NetEase Games. Fan port, personal use only.
