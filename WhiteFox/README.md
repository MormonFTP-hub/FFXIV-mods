# White Fox – Pink Paws (Marvel Rivals) for FFXIV

Penumbra mod: `out/White Fox - Pink Paws (Marvel Rivals).pmp`. Preview: `out/preview.png`, rendered from the built mod files in an idle pose. Left to right: White Fox on a Midlander woman, a Viera woman, an Au Ra woman, a Midlander man, a Roegadyn man and a Lalafell.

Ported from the psylocke.gg 3D viewer (https://psylocke.gg/heroes/white-fox/model?skin=pink-paws), model `SK_10600_1060501_Lobby`. This is a full-body costume: White Fox replaces your whole character, head included.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Island Resort** set (all classes, level 1): Island Resort Straw Hat, Shirt, Round Wristwatch, Slacks and Loop Sandals. The quickest way is the Glamourer design: copy the code from `out/White Fox - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the five gear slots, shows the hat and turns the mod on. Glamourer can put the set on without you owning it.
3. If anything doesn't change, run `/penumbra redraw`.

| Item (Island Resort set, e6173) | Becomes |
|---|---|
| Island Resort Straw Hat | Her head, long hair, fox ears, the big blue bow, the flowered straw hat and the pink sunglasses on it. It hides your hair and ears. |
| Island Resort Shirt | Swimsuit, the sheer pink jacket, her necklaces |
| Island Resort Round Wristwatch | Forearms and hands, the jacket's cuffs, bracelets and wrist flowers |
| Island Resort Slacks | Hips and thighs, the flowered thigh garter with its pouch, the leg ribbons and her three fox tails |
| Island Resort Loop Sandals | Shins, ankle ribbons and bows, heeled sandals |

**Races:** every race and gender.
- **Women** wear the Midlander woman fit. Every other race is reshaped from it by the game's racial deformer (EQDP entries in the mod make sure of that).
- **Men** get White Fox on the Midlander man's broader frame, reshaped the same way for the other male races. Roegadyn men have their own fit, because the game's deformer from the Midlander man doesn't reproduce their arms; Hrothgar men are reshaped from it.
- **Lalafell** (men and women) get a little White Fox with a big head.
- Your own tail (Miqo'te, Au Ra, Hrothgar) is hidden while the set is on; she brings three of her own.

Option group:
- **Hide your own face** (off by default): blanks every player face model. Turn it on only if your face shows (see below), and only in a collection used by your character alone.

## Versions
**1.2.1** (Oct 25, from your next in-game screenshot: "something is off feel like the head is huge"). Measured, her head and hat were her original size, but the FFXIV body under them is smaller than hers: the Midlander woman is 0.92× her height (shorter legs) and 0.88× her shoulder width. So relative to the body her head was ~10% and her hat ~14% bigger than in the original.
- **Narrower head:** 0.95× her width on the women's fit (height and depth stay at 1.0). Shrinking it more, or shrinking the height or depth at all, lets your own head show through: at 0.92–0.93, 3–10% showed from behind and above (the top and back of your skull, through the hat's crown and between her hair strands) or from the side (your temple). At 0.95, 0–0.2% shows on Midlander, Miqo'te, Elezen and Viera women, 0.8% on Au Ra and 1.5% on Roegadyn women (`showthrough.py`, 36 views).
- **Smaller hat brim:** the brim is pulled in to 0.8× its width beyond the crown (`fit.py brim_in`), on every fit. That's about the original's hat-to-height proportion. The crown, its flowers and sunglasses, and her head and hair under it are untouched.
- Hiding your own face isn't the answer to a smaller head: your one Penumbra collection is both "Yourself" and "Default", so the face hider would blank every other player's face too.

**1.2.0** (Oct 25, from your in-game screenshot of 1.1.0: "why head big also colors should be brighter"). It rendered correctly in game, out of the sun:
- **Smaller head.** 1.1.0 scaled her head (and hat) to 1.08× her own size on the women's fit, so the wearer's face could never poke through. A search over head scale and eye placement (`tools/tune_head.py`, from the Loki port) found her own size, 1.0, covers it as well with the eyes 5 mm further forward and 6 mm lower: 0.3–0.4% of the face showed on Midlander faces 1–5, against 0.4–1.1% at 1.08. The men's and Lalafell fits are unchanged. The trade-off, measured from 36 views (`showthrough.py`): a sliver of the back of your own head can show under the hat brim, between her hair strands, seen from behind and above. That's 0–0.11% on Midlander, Miqo'te, Elezen and Viera women (0–0.3% at 1.08), but 0.7% on Au Ra and 1% on Roegadyn women. For those, turn on **Hide your own face**.
- **Skin on the game's skin shader.** Her face and body skin were on the gear shader, which looks fine in full sun but goes grey and dim whenever the sun isn't on it (found on the Sora and Jotaro ports; your screenshot was out of the sun). They're on `skin.shpk` now, cloned from the vanilla Midlander woman's body skin, like vanilla skin:
  - her skin texels are rescaled to vanilla's skin colour, and the game multiplies them by your character's skin colour, so her skin now matches yours
  - make-up, lips, nails, the forehead mark and the grey scalp keep their own colour (`_norm` B tint mask)
  - vertex colour (0, 1, 1, 1) on the skin, as on vanilla faces and hands
- **Brighter colours** on the swimsuit, jacket, hair, tails, hat, flowers and jewellery: Neon 1.2.0's colour lift, which you asked for on every mod in the Neon session ("this like color intensity is what im looking for"). Luminance gets a 1.4 gamma with the hue kept, then saturation goes up 20% (`texsets.py LIFT`). The eyes are left as they are.

**1.1.0** (Oct 25, from comparing the original with the PMP Viewer's game-shader render, GS; `tools/gs_render.py --env day --sun 20,50 --ao --pose idle`, renders in `work/gs`, `b_*` before and `c_*` after):
- **Face too dark, glowing eyes.** Her face and skin came out olive-brown next to the original, and the irises glowed amber:
  - the source's occlusion map was baked into the masks, and the game adds its own occlusion and shadows on top (dark eye sockets and jaw)
  - the eyes were glossy (specular 200, roughness 40) and mirrored the sky, and the iris carried the source's 1.6× "iris brightness", meant for its own eye shader
  - the source lights skin with toon bands that never drop far into shade; at the same colours she reads dark in the game's daylight

  Now there's no baked occlusion, the eyes are matte (60 / 220) with the iris at its texture colour, and the face and body skin textures are 1.4× brighter (linear). These are the Lady Loki 1.2.0 fixes, applied here by that session; the grey-teal face-stroke fix from the same batch doesn't apply (White Fox's face has none; the only grey is her scalp under the hair).
- **Eyes half-lidded,** as in the original: the source darkens the top of the eyeballs with a "fake eye shadow" card under the upper lids. It's baked into the eye texture now (`bake_src.py eye_shadow`, from the Loki port).
- **Fingers bend at FFXIV's knuckles.** Her finger joints don't line up with FFXIV's two-bone fingers, which kink mid-finger in the game's idle pose (found on the Mantis and Loki ports). Each finger now sits on the FFXIV knuckle and bends where the game bends it. The palm is also scaled across the knuckles, not only along the palm: Roegadyn hands are 1.7× her palm's length but 2.2× its width, so the pinky had to jump 30 mm onto its knuckle. FFXIV's two thumb bones span her three: the game bends the thumb at her last knuckle, so her thumb keeps its base on her palm and turns to put that knuckle on the FFXIV joint. (Pinned onto FFXIV's first thumb joint instead, it moved out 18 mm on the women's fit and 56 mm on the Roegadyn's, which stretched the skin between thumb and wrist into a web.)
- **Neck covers yours.** Your own face model carries your neck down to the collar; her neck is now pushed out just enough to cover it (`fit.py cover_neck`, from the PeniParker and Loki ports): at most 8 mm on the women's fit, 14 mm on the Midlander men's and 30 mm on the Roegadyn men's, whose necks are much thicker. `tools/showthrough.py` (36 views, from the Loki port) finds 0–0.02% of the face showing on the women's fit for Midlander, Miqo'te, Au Ra, Viera and Elezen faces; on a Roegadyn woman, 0.3%, all of it the wearer's own eye in her eye opening, which GS shows isn't drawn. On the men's fits: 0.01–0.07% for Midlander, Elezen and Viera men, 0.34% for Roegadyn men (under the jaw, from below), and 2.1% for Hrothgar men, from behind: their own mane shows between her hair strands at the nape. Covering it would take far more than 30 mm on the fit they share with Roegadyn men, so it's left to the **Hide your own face** option.
- **Decal key off** on every material, as on vanilla hands, legs and feet. The body template had character.shpk's crest decal on; the Sora port found that the game then lays a bound decal (there, the character's face paint) over the whole surface.
- Checked in GS and left as they are:
  - **The hat brim's shadow** falls across her eyes in sunlight. It's the game's real sun shadow, as any wide-brimmed hat gets.
  - **The jacket stays opaque.** A see-through version (the game's semi-transparent pass, flag 0x10 with the source's opacity) barely shows in GS, because the source's opacity averages 80%, and semi-transparent layers can sort wrongly against hair in game. The hair that the original seems to show through it hangs behind her shoulders; the Blender preview drew it in front.

**1.0.1:** vertex colour set 0 is now white. 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so the model would have rendered pitch black in game, as Mantis did on its first test. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla.

## Known limits
- **Not checked in game yet.** It was checked offline only:
  - every model, material and texture in the pack parses with Penumbra and Lumina
  - every material and texture a file names is shipped
  - Penumbra's own reader loads all 95 manipulations
  - the built models, read back and posed, deform correctly (`work/preview/mdl_*`)
- How much of each race's own face shows through her head, measured on 1.0.0 (`tools/poke.py`: rays from the head centre, bind pose, every face model; it misses the neck, see 1.1.0 for `showthrough.py`):

  | Race | Men | Women |
  |---|---|---|
  | Midlander | 0.4% | 0.4–1% |
  | Highlander | 0.4–1.3% | 0.4–4.4% |
  | Elezen | 0.6–4.6% | 0.5–3.4% |
  | Miqo'te | 1.2–1.3% | 1.8% |
  | Roegadyn | 0.3–1.9% | 0.4–2.8% |
  | Au Ra | 9–17.5% (horns) | 7–13% (horns) |
  | Hrothgar | 1–5% | 6.4% |
  | Viera | 0.4–0.5% | 0.3% |
  | Lalafell | 0.8–1.6% | 0.8% |

  Apart from the Au Ra horns, which stick out of her hair at the sides under the hat brim, it's mostly the underside of the jaw, which only shows from below.

- Her face is static: no blinking, mouth movement or expressions. Her hair, tails, bow and ribbons have no physics. The tails are posed as in the first frame of her idle animation (they hang and fan out behind her; in the bind pose they stick straight out) and ride the hips rigidly. The long hair and the bow hand over from the head to the upper back below the jaw, so they follow the torso instead of swinging through it.
- The tails are the rip's strand meshes only. In the game the tails also carry an animated, glowing swirl effect (unlit flipbook shells); FFXIV gear can't do that, so it's left out.
- The jacket is opaque. In the source it's a translucent "glass" material; here it's the same pale pink with its darker pink trim, but you can't see the swimsuit through the sleeves.
- The sunglasses' lenses are an opaque pink patch in the eye texture (in the source they're tinted glass).
- Each model keeps to 4 materials, the most vanilla gear uses. So the upper-body and leg skin share one 2:1 texture, and the hat / ears / jewellery, the flowers, the bow / ribbons and the tail strands share one 2048 atlas.
- Colours: Pink Paws is a dye pass the game runs in its shader over the base summer outfit's textures (skin 1060301). `tools/bake_src.py` reproduces psylocke.gg's version of that pass and bakes it into the textures. The hair is psylocke.gg's overlay of a flat grey on the strand colour map, baked onto the strand UVs together with the strand-tip cut-outs.
- Materials: her face and body skin are on `skin.shpk` (see 1.2.0), so they take the wearer's skin colour. Everything else is Dawntrail `character.shpk` with the baked colour (brightened by the colour lift), the rip's normal maps (green flipped: the rip's maps are green-down, FFXIV's green-up; `textures.py` checks every map with a curl test) and no baked occlusion (the game's own does that job, see 1.1.0). Shine and roughness are per texture set (`tools/texsets.py` → `SETS`). The rip's toon shading, rim light and outline shells aren't reproduced.
- The translucent hair wisps, teeth and tongue are left out. The eye-shadow card is baked into the eyes (see 1.1.0).
- Everyone in this mod's collection who wears the Island Resort set looks like White Fox.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy, Pillow and msgpack, plus the portable Blender in `../Aerith/apps`). Use `--from <step>` to start partway. The download isn't part of it: `python -P -E tools/fetch.py $(cat work/hashes.txt)` (the objects the viewer loaded) saves the content-addressed CDN objects to `source/cdn` and follows every hash the scene and glb files name.
1. `extract_src.py`: decodes the host glb (meshopt buffers, KTX2/UASTC textures) with `tools/native/xdec.dll` (built in the LunaSnow project, `tools/native/build.ps1`), through `xdec.py` / `glb.py`. It writes the primitives, joints, materials and textures to `work/src`.
2. `bake_src.py`: the Pink Paws dye pass, the hair overlay and strand cut-outs, the tail strands with their cut-outs, the eyeball texture (iris map inside the iris circle, tinted sclera, the eye-shadow card baked in), skin 1.4× brighter, then one albedo per FFXIV texture set, atlases included.
3. `prep_refs.py`: pulls the c0101, c0201, c0901, c1101, c1401 and c1801 skeletons, the racial deformer file, the bare body, a face and the Island Resort models from the game.
4. `fit.py`: retargets White Fox onto each race in `PROFILES` through her own skeleton:
   - every source joint is resolved through its parent chain: twist and fix joints follow their limb; face, hair, ear, hat and bow joints follow the head; the necklace chain follows the spine; bracelets their forearm
   - torso: a height lattice through her ankles, knees, hips, shoulders and neck
   - limbs: one affine per bone, rotated onto the FFXIV bone and stretched to its length
   - hands: stretched to the FFXIV palm's length and knuckle span; each finger rigid, its base on the FFXIV knuckle and aimed along the FFXIV finger; the thumb kept on her palm and turned so its last knuckle sits on the FFXIV thumb joint
   - heeled sandals: rigid
   - head: rigid, scaled (`PROFILES`, searched with `tune_head.py`) and placed so her eyes sit on the wearer's eyes
   - tails: posed by `tail_pose.py` (the idle animation's first frame, pelvis held still), then moved rigidly with the hips
   - weights: hers, renamed onto FFXIV bones, with the arm shared with the twist helpers the way the vanilla body does it; fingers split between the two FFXIV finger bones by position; hair and bow: head, then the upper back below the jaw; tails: the waist
   - neck: pushed out to cover the neck of every player face that wears the fit (`cover_neck`)
5. `textures.py` and `materials.py`: `skin.shpk` skin (cloned from the vanilla body skin material) and Dawntrail `character.shpk` textures and materials, with the colour lift on the gear-shader sets.
6. `build.py [races]`: splits White Fox into the five gear models per race (each texture set only into slots that keep the model at 4 materials or fewer). It converts them with Penumbra's importer (`apps/xivtool import`), copies the vanilla model flags and radius, and makes the empty face stand-ins. Already-built stand-ins and other races' models are kept, so one race can be rebuilt on its own.
7. `pack.py`, `glamourer_design.py`, `validate_pmp.py`, `render_preview.py`: the `.pmp`, the Glamourer design, the file and manipulation check, and `out/preview.png`.

Checks:
- `look_src.py [parts]` renders the unpacked source with the baked colours, whole and part by part; `look_tails.py` the same with the tails posed.
- `check_fit.py <race> [other races]` renders the fit over the FFXIV body and face, and in idle and run poses.
- `poke.py <fit race> [races]` measures how much of each race's face shows through her head (rays from the head centre; misses the neck).
- `showthrough.py <fit race> [race[:face] ...]` measures it from 36 views round the head, the way a camera sees it (from the Loki port).
- `gs_render.py <out.png> [--race r] [--cam head|full] [--env day --sun az,el] [--ao] [--pose idle] [--look bone,dx,dy,dz,dist] [--swap path=file]` renders the built pack with the PMP Viewer's game shaders (from the Loki port).
- `check_mdl.py <race>` renders the built `.mdl` and `.tex` files back, plus one colour per gear slot.

Tool changes from the Black Cat project (its tools were the starting point):
- `tools/tail_pose.py` and `look_tails.py` are new.
- 1.1.0, from the Loki port (which grew out of these tools): the finger split and neck cover in `fit.py`, the eye-shadow bake, the skin and iris gains, no baked occlusion, matte eyes, the decal key off in `materials.py`, `showthrough.py` with `blender/visibility.py`, and `gs_render.py`. New here: the palm's width scaling and the thumb mapping in `fit.py`.
- `tools/texsets.py` describes atlases as rectangles per source material, so the skin can use a 2:1 atlas; `bake_src.py` and `textures.py` paste each piece into its rectangle.
- `tools/textures.py` uses the rip's normal maps again (Black Cat had flat normals).
- `tools/extract_src.py` skips the glass material's cube map (it has no image index).
- `tools/build.py` no longer moves whole islands of more than 2500 triangles to one slot, so the skin, swimsuit and jacket always split by weight.
- `tools/pbd.py` is NursePool's corrected copy: Hrothgar men deform from the Roegadyn man and Lalafell women from the Lalafell man.

White Fox and Marvel Rivals belong to Marvel and NetEase. Fan port, personal use only: don't upload or share the `.pmp`.
