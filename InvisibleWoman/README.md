# Invisible Woman â€“ Unseen Weaver (Marvel Rivals) for FFXIV

Penumbra mod: `out/Invisible Woman - Unseen Weaver (Marvel Rivals).pmp`. Preview: `out/preview.png`, rendered from the built mod files in an idle pose. Left to right: a Midlander woman, a Viera woman, an Au Ra woman, a Midlander man and a Lalafell.

Ported from the psylocke.gg model viewer's Unseen Weaver skin (https://psylocke.gg/heroes/invisible-woman/model?skin=unseen-weaver), downloaded to `source/cdn` (`source/roots.txt` lists the CDN objects the viewer loads). This is a full-body costume: she replaces your whole character, head included.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Valentione Rose Ribboned** set (all classes, level 1): Ribboned Hat, Dress, Ribboned Gloves, Tights and Heels. Any of its three colours (Rose, Forget-me-not, Acacia) works. The quickest way is the Glamourer design: copy the code from `out/Invisible Woman - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the five gear slots, shows the hat and turns the mod on.
3. If anything doesn't change, run `/penumbra redraw`.

| Item | Becomes |
|---|---|
| Valentione Rose Ribboned Hat | Her head, eyes, purple hair, witch hat with its rose and thorns, earrings. It hides your hair and ears. |
| Valentione Rose Dress | Bodice, chest, capelet, collar gem, the big shoulder rose and its thorn vine |
| Valentione Rose Ribboned Gloves | Long dark gloves with claws, thorn bracelets |
| Valentione Rose Tights | Skirt and petticoat, tights to the knee, belt |
| Valentione Rose Heels | Tights below the knee, the thorn vines round her shins, heeled boots |

**Races:** every race and gender.
- **Women** wear the Midlander woman fit. Every other race is reshaped from it by the game's racial deformer (EQDP entries in the mod make sure of that).
- **Men** get her on the Midlander man's broader frame, reshaped the same way for the other male races.
- **Lalafell** (men and women) get a little Sue with a big head.

Option group:
- **Hide your own face** (off by default): blanks every player face model. Turn it on only if yours shows (see below), and only in a collection used by your character alone.

## 1.2.0: brighter colours
Oct 25, with Neon 1.2.0's colour lift. The user, on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/textures.py` lifts the finished colour maps (`LIFT`, `lift()`, applied in `maps()` after `lit_look()` and the hair and eye bakes): head, body, dress, trim, thorns, hair and eyes. Luminance is raised by a 1.4 gamma, which lifts dark and mid tones most and keeps the hue, then saturation goes up 20% in linear light. The `lashes` tile (brow, lash and wisp cards) is unchanged, as are the normal, mask and `_id` maps (the glow placement still reads the unlifted petals) and every alpha.
- In GS (Midlander woman, idle) the figure's average luminance rises about 25% by day and 26% in dim neutral light, and its saturation about 20%. The hair is a brighter violet and the gold warmer; the skin stays pale and the white capelet keeps its shading. Before and after, by day and in dim light: `work/lift/cmp_lift.png`. To tune it, change `LIFT` and rerun `textures.py`, `pack.py`, `glamourer_design.py` and `validate_pmp.py`.

## 1.1.0: matched to the original in the game-shader renderer
Compared against the psylocke.gg viewer (Studio backdrop, idle pose; its lights switched off to isolate the glow) in the PMP Viewer's game-shader renderer (GS). `out/GS comparison.png` shows the original, GS before and GS after (neutral and the game-fitted Day light).
- **Glow was on the wrong pixels.** Dawntrail `_id` green 255 picks a row pair's first (plain) row and 0 its second (glowing) one; 1.0.x wrote the glow amount straight into green, so in game the trim and thorns would have glowed everywhere except where they should. `_id` green is now 255 âˆ’ glow.
- **Glow placement and colour from the rip's own shader** (read from the viewer's code): the thorns' cyan "flow" glow (`flowNoiseColor` Ã— intensities Ã— the time-averaged band, on the flow mask's veins) plus the rose petals, the hat brim's purple emissive map on the trim, and the collar gem's pale cyan glow (a third row pair per tile, `textures.py` â†’ `ROW_PAIRS`, `GLOW_B`).
- **Gold** (the rip's cube-map reflection mask) is 2.2Ã— brighter and on a half-metal row pair; it was dull olive.
- **Hair** is bluer: the shadow-colour map came out lavender-grey where the original is indigo-violet (`HAIR_TINT`).
- **Rose petals and the gem** are baked pale icy cyan, and the thorns carry faint cyan streaks along the flow's veins (`textures.py` â†’ `lit_look()`). The original's roses glow brighter than any lit colour can reach, so they stay a little greyer than the original under light.
- Measured against the white capelet (the light reference between the two viewers), hair and gold land within about 10â€“15% of the original; the chest skin already matched.
- **GS doesn't draw `character.shpk` colour-table glow at all** (not even on vanilla glowing gear such as e0847 with every row set to red emissive), so the glow itself is placed from the shader code and checked as a mask (`work/gs/glowmap_*.png`), not seen lit. Check it in game.

## Known limits
- **1.0.1 writes vertex colour set 0 white.** 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so she would have rendered pitch black in game, as Mantis did on its first test. `tools/build.py` â†’ `convert()` now writes white; `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla (the copy in `apps/xivtool` predates `mdlstreams`; build `../Mantis/tools/xivtool` with `dotnet build` to use it).
- **No model has more than 4 materials** (Penumbra's `MdlMaterialMaximum`; the hat had 6 in 1.0.0). The trim and the thorns, the two glowing sets, now share a 2:1 `trim_thorns` atlas, and the eyes and the brow and lash strands a 2:1 `eyes_lashes` atlas (`tools/textures.py` â†’ `MATERIALS`). Each tile keeps its own glow colour through its own colour-table rows. The hat now has 4 materials (head, hair, `eyes_lashes`, `trim_thorns`), every other piece 3 or fewer.
- **Not checked in game yet.** It was checked offline only:
  - every model, material and texture in the pack parses with Penumbra and Lumina
  - every material and texture a file names is shipped, for all three colour variants' material sets
  - Penumbra's own reader loads every manipulation
  - the built models, read back and posed, deform correctly (`work/preview/mdl_c0201_*`, `out/preview.png`)
- Her face is static: no blinking, mouth movement or expressions (her teeth and tongue are left out). Her hair has no physics. The skirt rides the game's skirt bones, so it sways like vanilla skirts. The capelet takes its weights from her shoulders and upper arms, so it lifts with the arms.
- How much of each race's own face shows through her head (`tools/poke.py`, bind pose): 0.2â€“1.5% for most Midlander, Highlander, Elezen, Miqo'te, Roegadyn and Viera women's faces (a sliver of neck under her jaw), 2â€“3% for Highlander and Elezen faces 201/202 and for Hrothgar women, and 7â€“12% for Au Ra, whose horns stick out beside her hair. Men and Lalafell were tuned to under 0.5% (`tools/tune_head.py`).
- The head flags are copied from the vanilla Moogle Head. With the set on, the body flags hide necklaces, earrings, bracelets, rings and tails, and breast physics is off.
- The particle glows (the wisps on her shoulder and the sparkles on her earrings and collar gem) are game VFX and aren't included. The viewer animates the thorns' flow glow (a band sweeping across them); the game can't, so it is a static average (`tools/materials.py` â†’ `GLOW`, one scale `GAME_GLOW` for every set).
- The materials come from the vanilla e0800 template, which uses `character.shpk`'s texture-colour mode (key `0xB616DC5A = 0x600EF9DF`, which reads a `_base` map); vanilla glowing Dawntrail gear uses the default colour-table mode. Whether the game draws colour-table glow in the texture-colour mode isn't known yet.
- The rip's normal maps are DirectX-style (green down; their slopes are closer to curl-free read that way), so the green channel is flipped for the game. If bumps look lit from below in game, undo the flip in `tools/textures.py` â†’ `standard()`.
- Her hair's colour comes from a shadow-colour map on its second UV set, so the hair is re-mapped onto that set and its strand mask baked over (`tools/textures.py` â†’ `hair()`). The eye shader's iris and sclera are baked into one map (`eyes()`).
- Everyone in this mod's collection who wears the Valentione Rose Ribboned set looks like her.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy, Pillow and msgpack, plus the portable Blender in `../Aerith/apps` for previews). Use `--from <step>` to start partway.
1. `fetch.py`: downloads every CDN object in `source/roots.txt`, following the hashes the scene files name, to `source/cdn`.
2. `export_src.py`: reads the skin's glTF (meshopt-compressed, KTX2 textures, through `tools/native/xdec.dll`) and dumps every primitive, the bind-pose skeleton and the textures to `work/src`.
3. `prep_refs.py`: pulls the c0101, c0201, c1101, c1401 and c1801 skeletons, the racial deformer file, the bare body, a face and the Valentione Rose Ribboned models from the game.
4. `fit.py`: retargets her onto each race in `PROFILES` through her own Unreal-style skeleton:
   - torso: a height lattice through her ankles, knees, hips, shoulders and neck
   - limbs: one affine per bone, rotated onto the FFXIV bone and stretched to its length (twist, volume and cloth bones follow their limb)
   - hands and heeled boots: rigid
   - head: rigid, scaled and placed so the wearer's face stays inside it (`tune_head.py` picks the numbers)
   - weights: hers, renamed onto FFXIV bones by bone ancestry, with the arm shared with the twist helpers the way the vanilla body does it
   - skirt: the FFXIV skirt chains, by angle and height; capelet: copied from the nearest point of her body
5. `textures.py` and `materials.py`: Dawntrail `character.shpk` textures and six materials (head, body, dress, hair, and the `trim_thorns` and `eyes_lashes` atlases); `lit_look()` bakes the original's glowing parts into the colour maps. `mtrl.py` can add constants the template lacks.
6. `build.py`: splits her into the five gear models per race by skin weight, moves each part's UVs into its atlas tile, converts them with Penumbra's importer (`apps/xivtool import`), copies the vanilla model flags and radius, and makes the empty face stand-ins.
7. `pack.py`, `glamourer_design.py`, `validate_pmp.py`, `render_preview.py`: the `.pmp`, the Glamourer design, the file and manipulation check, and `out/preview.png`.

Checks:
- `preview_src.py` renders the source at bind pose; `analyze_src.py [--tree]` lists what each primitive is weighted to.
- `check_fit.py <race> [other races]` renders the fit over the FFXIV body and face, and in idle and run poses.
- `poke.py <fit race> [races]` measures how much of each race's face shows through her head.
- `check_mdl.py <race>` renders the built `.mdl` and `.tex` files back, plus one colour per gear slot.
- `gs_render.py <out.png> [--cam head|full] [--env neutral|dark|default] [--swap <game path>=<file>]` renders the pack with the PMP Viewer's game-shader renderer from the command line; `--swap` tries a material or texture without repacking. (`xivdata.texture()` caches decoded local `.tex` files by path without checking dates: clear `work/cache/*.tex_*` after rebuilding textures, before `check_mdl.py` or `render_preview.py`.)

Tools start from the Mina project's; `export_src.py`, `fit.py`, `tune_head.py`, `textures.py` and the psylocke.gg readers (`fetch.py`, `glb.py`, `xdec.py`, `look_scene.py`) are new or rewritten for this model.

Invisible Woman belongs to Marvel; the model is from Marvel Rivals (NetEase). Fan port, personal use only: don't upload or share the `.pmp`.
