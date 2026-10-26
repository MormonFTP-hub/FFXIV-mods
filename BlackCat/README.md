# Black Cat – Pink Purr (Marvel Rivals) for FFXIV

Penumbra mod: `out/Black Cat - Pink Purr (Marvel Rivals).pmp`. Preview: `out/preview.png`, rendered from the built mod files in an idle pose. Left to right: Black Cat on a Midlander woman, a Viera woman, an Au Ra woman, a Midlander man, a Roegadyn man and a Lalafell.

Ported from the psylocke.gg 3D viewer (https://psylocke.gg/heroes/black-cat/model?skin=pink-purr), model `SK_1061_1061500_Lobby`. This is a full-body costume: Black Cat replaces your whole character, head included.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Street** set (all classes, level 1): Street Cap, Street Top, Street Handwear, Street Cargo Trousers and Street High-top Shoes. The quickest way is the Glamourer design: copy the code from `out/Black Cat - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the five gear slots, shows the hat and turns the mod on. No gil shop sells the set, but Glamourer can put it on without owning it.
3. If anything doesn't change, run `/penumbra redraw`.

| Item | Becomes |
|---|---|
| Street Cap | Her head, eyes, long hair, racing cap with the "B" badge, and the cat-ear goggles. It hides your hair and ears. |
| Street Top | Suit top, neckline, checkered scarf, collar with the flag pendant, tie and the back drape |
| Street Handwear | Sleeves and her clawed pink gloves |
| Street Cargo Trousers | Trousers with their checkered overlay and straps, utility belt, braided "B" belt, garter and its ribbons |
| Street High-top Shoes | White wedge boots and the trousers below the knee |

**Races:** every race and gender.
- **Women** wear the Midlander woman fit. Every other race is reshaped from it by the game's racial deformer (EQDP entries in the mod make sure of that).
- **Men** get Black Cat on the Midlander man's broader frame, reshaped the same way for the other male races. Roegadyn men have their own fit, because the game's deformer from the Midlander man doesn't reproduce their arms; Hrothgar men are reshaped from it.
- **Lalafell** (men and women) get a little Black Cat with a big head.

Option group:
- **Hide your own face** (off by default): blanks every player face model. Turn it on only if your face shows (see below), and only in a collection used by your character alone.

## Changes
**1.1.0** (2026-10-25). Brighter colours, with the lift from Neon 1.2.0. The user, on Neon: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/textures.py` lifts every colour map (`LIFT`: skin, head, suit, legs, legs2, eyes, hair and the accessory atlas). Luminance goes up by a 1.4 gamma with the hue kept, which lifts dark and mid tones most. Then saturation goes up 1.2×. Alpha, normal and mask maps are unchanged.
- In GS, the figure's average brightness rises about 16% by day and 19% in dim neutral light, and its colourfulness 40–45%. The pink reads as hot pink. In direct sun its red channel reaches full, but the shading still shows (`work/lift/legs_day.png`) and nothing goes white. The skin is a little lighter and warmer. Before and after, by day and in dim light: `work/lift/cmp_lift.png`, with head close-ups in `work/lift/cmp_lift_head.png`. The pack before the change is `work/lift/before.pmp`.
- To tune it, change `LIFT`, then run `textures.py`, `pack.py`, `glamourer_design.py` and `validate_pmp.py`. The models don't need rebuilding.
- `out/preview.png` is still the 1.0.2 render.

## Known limits
- **1.0.2: textures no longer mirrored, face no longer dark.** In game, 1.0.1 showed the suit with silver gloves, a black chest panel, scrambled trouser checks and pink boots.
  - Cause: the rip spreads its textures over UDIM-style UV tiles (suit u 1..2 / v −1..0, trousers u 3..4 / v −1..0, overlay u 2..3 / v −1..0, face u 3..4). The material template's samplers (vanilla e0800) use Mirror addressing, so every odd tile showed its texture flipped. The face was mirrored too, with her cheek mark on the wrong side.
  - Fix: `texsets.untile()` moves every triangle into the 0..1 tile. No triangle crosses a tile edge; the atlas mapping picks the tile per triangle too, so a corner sitting exactly on an edge stays put.
  - Also: `_mask` blue no longer carries the rip's ORM occlusion. Every Pink Purr material has `aoIntensity` 0, so the game never applies it, and with it the face came out a shade too dark (face ORM mean 0.72).
  - Checked against the source in the PMP Viewer's game-shader renderer (`work/gs/`: `cmp_new.png` source vs 1.0.1 vs 1.0.2, `face_side.png`, `cmp_miqo.png` as a Miqo'te woman). The viewer reports no problems, and All races resolves every race as intended.
- **1.0.1: vertex colour set 0 is now white.** 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so the model would have rendered pitch black in game, as Mantis did on its first test. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla.
- **1.0.2 not checked in game yet.** Offline checks:
  - every model, material and texture in the pack parses with Penumbra and Lumina
  - every material and texture a file names is shipped
  - Penumbra's own reader loads all 95 manipulations
  - the built models, read back and posed, deform correctly (`work/preview/mdl_*`)
  - the game-shader renders match the source render apart from lighting (the hair reads a little paler under the game's sun)
- Her face is static: no blinking, mouth movement or expressions. Her hair, the back drape, tie and ribbons have no physics. The long hair hands over from the head to the upper back below the jaw, so it follows the torso instead of swinging through it.
- How much of each woman's own face shows through her head (`tools/poke.py`, bind pose, every face model):
  - 0–1.2% for Midlander, Highlander, Miqo'te, Roegadyn and Viera
  - 0.2–3.5% for Elezen, at the crown above her cap
  - 4.5% for Hrothgar (their one face model), at the top of the head
  - 9–14% for Au Ra: their horns stick out of her hair at the sides
  - men weren't measured
- The head flags are copied from the vanilla Moogle Head. With the set on, the body flags hide necklaces, earrings, bracelets, rings and tails, and breast physics is off.
- Her long legs are fitted to FFXIV leg proportions: the shins are shortened (about 0.76× on women, 0.56× on Roegadyn men, 0.49× on Lalafell) so the wedge boots stand on the floor at full size.
- Whole pieces go to one slot: the gloves model holds her whole sleeves from the shoulder, and the trousers model holds the full checkered overlay down to the boots. With other gear on some slots, those pieces vanish with them.
- Each model keeps to 4 materials, the most vanilla gear uses (Penumbra has a `MdlMaterialMaximum` for it). So the four accessory textures share one 2048 atlas, and the goggle lenses are an opaque pink patch in the eye texture (in the source they're tinted glass).
- Colours: Pink Purr is a dye pass the game runs in its shader over the default (teal) textures. `tools/bake_src.py` reproduces psylocke.gg's version of that pass and bakes it into the textures. The hair is psylocke.gg's overlay of a flat grey on the strand colour map, baked onto the strand UVs together with the strand-tip cut-outs.
- The rip's normal maps aren't used (flat normals); shine and roughness are per texture set (`tools/texsets.py` → `SETS`); no occlusion, as in the source (`aoIntensity` 0). The tie and ribbons are opaque; only the back drape keeps its fade.
- The translucent hair wisps, the eye-shadow card, the rim-light shells, teeth and tongue are left out.
- Everyone in this mod's collection who wears the Street set looks like Black Cat.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy, Pillow and msgpack, plus the portable Blender in `../Aerith/apps`). Use `--from <step>` to start partway. The download isn't part of it: `python -P -E tools/fetch.py <hashes>` (the 137 objects the viewer loaded are listed in `work/hashes.txt`) saves the content-addressed CDN objects to `source/cdn` and follows every hash the scene and glb files name.
1. `extract_src.py`: decodes the host glb (meshopt buffers, KTX2/UASTC textures) with `tools/native/xdec.dll`, through `xdec.py` / `glb.py`. That DLL was built in the LunaSnow project from the official meshoptimizer and basis_universal sources (`tools/native/build.ps1`, sources in `../LunaSnow/apps/src`). It writes the primitives, joints, materials and textures to `work/src`.
2. `bake_src.py`: the Pink Purr dye pass, the hair overlay and strand cut-outs, the eyeball texture (iris map inside the iris circle, tinted sclera), then one albedo per FFXIV texture set, including the accessory atlas.
3. `prep_refs.py`: pulls the c0101, c0201, c0901, c1101, c1401 and c1801 skeletons, the racial deformer file, the bare body, a face and the Street models from the game.
4. `fit.py`: retargets Black Cat onto each race in `PROFILES` through her own skeleton:
   - every source joint is resolved through its parent chain: twist and fix joints follow their limb; face, hair and goggle joints follow the head; belt, necklace, scarf, tie and ribbon chains follow the spine
   - torso: a height lattice through her ankles, knees, hips, shoulders and neck
   - limbs: one affine per bone, rotated onto the FFXIV bone and stretched to its length
   - hands and wedge boots: rigid
   - head: rigid, scaled and placed so her eyes sit on the wearer's eyes
   - weights: hers, renamed onto FFXIV bones, with the arm shared with the twist helpers the way the vanilla body does it, and the knee fix joints on the FFXIV knee
   - hair: head, then the upper back below the jaw
5. `textures.py` and `materials.py`: Dawntrail `character.shpk` textures and materials. Every colour map gets the 1.1.0 colour lift (`LIFT`).
6. `build.py [races]`: splits Black Cat into the five gear models per race (each texture set only into slots that keep the model at 4 materials or fewer). It converts them with Penumbra's importer (`apps/xivtool import`), copies the vanilla model flags and radius, and makes the empty face stand-ins. Already-built stand-ins and other races' models are kept, so one race can be rebuilt on its own.
7. `pack.py`, `glamourer_design.py`, `validate_pmp.py`, `render_preview.py`: the `.pmp`, the Glamourer design, the file and manipulation check, and `out/preview.png`.

Checks:
- `look_src.py [parts]` renders the unpacked source with the baked colours, whole and part by part.
- `check_fit.py <race> [other races]` renders the fit over the FFXIV body and face, and in idle and run poses.
- `poke.py <fit race> [races]` measures how much of each race's face shows through her head.
- `check_mdl.py <race>` renders the built `.mdl` and `.tex` files back, plus one colour per gear slot. Its Blender renders wrap the UVs, so they can't show sampler-mode problems; use the PMP Viewer's game shaders for that.
- `compare_gs.py <out.png> <images>` lays the source render and PMP Viewer game-shader captures side by side, each cropped to the figure.

Tool changes from the Mina project:
- `tools/fit.py`, `srcdata.py`, `bake_src.py`, `texsets.py`, `extract_src.py` and `look_src.py` are new for the psylocke.gg source; the Blender exporter is gone.
- `tools/fetch.py` (from LunaSnow) now scans a glb's whole JSON chunk for texture hashes. The host model's is about 0.5 MB, and the old 200 KB cut-off missed a third of the textures.
- `tools/pbd.py` is NursePool's corrected copy: Hrothgar men deform from the Roegadyn man and Lalafell women from the Lalafell man.

Black Cat and Marvel Rivals belong to Marvel and NetEase. Fan port, personal use only: don't upload or share the `.pmp`.
