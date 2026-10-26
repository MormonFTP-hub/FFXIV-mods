# Luna Snow – Coalsack Nebula (Marvel Rivals) for FFXIV

Penumbra mod: `out/Luna Snow - Coalsack Nebula (Marvel Rivals).pmp`. Preview: `out/preview.png`, rendered from the built mod files in an idle pose. Left to right: Luna on a Midlander woman, a Viera woman, an Au Ra woman, a Midlander man and a Lalafell.

Ported from the [psylocke.gg model viewer](https://psylocke.gg/heroes/luna-snow/model?skin=coalsack-nebula)'s Coalsack Nebula skin (`source/cdn`). This is a full-body costume: Luna replaces your whole character, head included.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Cosmic Explorer's** set (all classes, level 1): Cap, Jacket, Halfgloves, Slops and Boots. The quickest way is the Glamourer design: copy the code from `out/Luna Snow - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the five gear slots, shows the hat and turns the mod on. Glamourer can put the set on without owning it.
3. If anything doesn't change, run `/penumbra redraw`.

| Item | Becomes |
|---|---|
| Cosmic Explorer's Cap | Luna's head, eyes, violet hair and ribbon, the crescent moon and her star earrings. It hides your hair and ears. |
| Cosmic Explorer's Jacket | Bodysuit and sleeves to the elbow, glass top, collar and gem, belt with the black-hole orb |
| Cosmic Explorer's Halfgloves | Forearms, the galaxy sleeve and her gloves |
| Cosmic Explorer's Slops | Skirt, glass overskirt and its starry train, legs to the knee |
| Cosmic Explorer's Boots | Thigh-high stocking and boots |

**Races:** every race and gender.
- **Women** wear the Midlander woman fit. Every other race is reshaped from it by the game's racial deformer (EQDP entries in the mod make sure of that).
- **Men** get Luna on the Midlander man's broader frame, reshaped the same way for the other male races.
- **Lalafell** (men and women) get a little Luna with a big head.

Option group:
- **Hide your own face** (off by default): blanks every player face model. You shouldn't need it. Turn it on only if yours shows, and only in a collection used by your character alone.

## Changes
**1.1.0** (2026-10-25). Brighter colours, with the lift from Neon 1.2.0. The user, on Neon: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/textures.py` lifts every colour map (`LIFT`: the outfit atlas's gear, skirt and glass tiles, plus the suit-and-skin, stars, orb, head, eyes and hair sets). Luminance goes up by a 1.4 gamma with the hue kept, which lifts dark and mid tones most. Then saturation goes up 1.2×. Alpha, normal and mask maps are unchanged.
- In GS, the figure's average brightness rises about 12% by day and 27% in dim neutral light, and its colourfulness 30–50%. The black suit reads as dark violet, the hair is a brighter magenta, and the skin is a little lighter but still natural. Before and after, by day and in dim light: `work/lift/cmp_lift.png`, with head close-ups in `work/lift/cmp_lift_head.png`. The pack before the change is `work/lift/before.pmp`.
- To tune it, change `LIFT` and run `python -P -E tools/make.py --from textures`. Skip the `build` step if the models haven't changed: run `textures.py`, `pack.py`, `glamourer_design.py` and `validate_pmp.py` on their own.
- `out/preview.png` is still the 1.0.1 render.

## Known limits
- **1.0.1 writes vertex colour set 0 white.** 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so Luna would have rendered pitch black in game, as the Mantis port did on its first test. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla (the Mantis port's `tools/xivtool` has it; the copy in `apps/xivtool` predates it).
- **No model has more than 4 materials** (Penumbra's `MdlMaterialMaximum`; 1.0.0's Jacket had 5, 6 on Lalafell, and its Slops 5). The gear, skirt and glass sets now share a 2x2 "outfit" atlas, the fourth tile empty (`tools/textures.py` → `MATERIALS`). The bodysuit and skin, the stars and the orb keep their own materials, so the stars and the orb still glow.
- **Not checked in game yet.** It was checked offline only:
  - every model, material and texture in the pack parses with Penumbra and Lumina (`validate_pmp.py`: ALL OK)
  - every material and texture a file names is shipped
  - Penumbra's own reader loads all 95 manipulations
  - the built models, read back and posed, deform correctly (`work/preview/mdl_*`)
- The viewer draws her with Marvel Rivals' stylised shaders. Here they're baked into plain colour textures:
  - costume colours: the viewer's dye-region logic, ported exactly (`tools/shade.py`)
  - violet galaxy hair: the rip's grey strands tinted violet to magenta, colours picked from the viewer (`textures.py` → `HAIR_GRADIENT`)
  - galaxy sleeve and leg, collar gem, black-hole orb: flat colours, no moving stars. The train's stars and the orb glow a little.
  - eyes: iris and sclera composed from the eye shader's own maps and parameters
- The glass top and overskirt are opaque. In the viewer they're about 60% see-through; Dawntrail's character shader only does cut-outs.
- Her face is static: no blinking, expressions or lip movement. Teeth, tongue and the fake eye-shadow layer are left out.
- Her hair has no physics. It follows the head down to the chin and the upper back below that. The skirt, overskirt and train ride the game's skirt bones, so they sway like vanilla skirts.
- How much of each race's own face shows through her head (`tools/poke.py`, bind pose):
  - under 1.5% for Midlander, Highlander, Elezen, Miqo'te and Viera (all faces measured)
  - Au Ra: 7–12%, which is their horns sticking out of her hair
  - Roegadyn and Hrothgar weren't measured
- The head flags are copied from the vanilla Moogle Head. With the set on, the body flags hide necklaces, earrings, bracelets, rings and tails, and breast physics is off.
- With arms hanging straight down, the hands sink into the wide skirt, as they do with wide vanilla skirts.
- Her weapon isn't included.
- Everyone in this mod's collection who wears the Cosmic Explorer's set looks like Luna Snow.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy, Pillow and msgpack, plus the portable Blender in `../Aerith/apps`). Use `--from <step>` to start partway.
0. Once: `tools/fetch.py <scene hashes>` downloads the viewer's assets into `source/cdn`, and `tools/native/build.ps1` builds `tools/native/xdec.dll` (basis_universal KTX2 transcoder and meshoptimizer decoder, from the clones in `apps/src`, compiled with the `ziglang` pip package).
1. `extract_src.py`: decodes the character GLB (meshopt) and its KTX2 textures into `work/src`. The GLB already uses FFXIV axes.
2. `shade.py`: bakes the viewer's dye colours into `work/src/albedo`.
3. `prep_refs.py`: pulls the c0101, c0201, c1101, c1401 and c1801 skeletons, the racial deformer file, the bare body, a face and the Cosmic Explorer's models from the game.
4. `fit.py`: retargets Luna onto each race in `PROFILES` through her own UE skeleton (every bone maps through its first known ancestor):
   - torso: a height lattice through her ankles, knees, hips, shoulders and neck
   - limbs: one affine per bone, rotated onto the FFXIV bone and stretched to its length
   - hands and heeled boots: rigid
   - head: rigid, scaled and placed so the wearer's face stays inside it
   - weights: hers, renamed onto FFXIV bones, with the arm shared with the twist helpers the way the vanilla body does it
   - skirts: the FFXIV skirt chains, by angle and height
5. `textures.py` and `materials.py`: Dawntrail `character.shpk` textures (source normal maps flipped to green-up) and materials. Materials that share a source atlas are composited per UV island. The gear, skirt and glass sets are tiled into one `outfit` atlas. Every colour map gets the 1.1.0 colour lift (`LIFT`).
6. `build.py`: splits Luna into the five gear models per race by skin weight and moves each part's UVs into its atlas tile. It converts them with Penumbra's importer (`apps/xivtool import`), copies the vanilla model flags and radius, and makes the empty face stand-ins.
7. `pack.py`, `glamourer_design.py`, `validate_pmp.py`, `render_preview.py`: the `.pmp`, the Glamourer design, the file and manipulation check, and `out/preview.png`.

Checks:
- `look_src.py [--flat]` renders the source with its baked colours, or one colour per material.
- `check_fit.py <race>` renders the fit over the FFXIV body and face, and in idle and run poses.
- `poke.py <fit race> [races]` measures how much of each race's face shows through her head.
- `check_mdl.py <race>` renders the built `.mdl` and `.tex` files back, plus one colour per gear slot.

Luna Snow and Marvel Rivals belong to NetEase Games and Marvel. Fan port, personal use only: don't upload or share the `.pmp`.
