# Sailor Moon (3D-print figure) for FFXIV

Penumbra mod: `out/Sailor Moon (figure).pmp`. Preview: `out/preview.png`, rendered from the built mod files in an idle pose. Left to right: Sailor Moon on a Midlander woman, a Viera woman, an Au Ra woman, a Midlander man, a Roegadyn man and a Lalafell.

Ported from `source/sailor_moon.stl`, a 3D-print sculpt of Sailor Moon standing in her sailor uniform. The file's header carries no author, so the sculptor isn't credited here. This is a full-body costume: Sailor Moon replaces your whole character, head included.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on **Neo Queen's Tiara**, **Educand's Sailor Top**, **Educand's Sailor Skirt** and **Educand's Loafers**. The quickest way is the Glamourer design: copy the code from `out/Sailor Moon - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the four gear slots, shows the hat and turns the mod on.
   - All four are level 1, all classes, any race and gender (`xivtool iteminfo`). They're untradable and no gil shop sells them (`xivtool itemshops`), but Glamourer can put them on without owning them.
   - The tiara is a nod to Neo-Queen Serenity; the Educand's set is the game's own sailor school uniform.
3. If anything doesn't change, run `/penumbra redraw`.

| Item | Becomes |
|---|---|
| Neo Queen's Tiara | Her head, eyes, odango buns, barrettes and both pigtails. It hides your hair and ears. |
| Educand's Sailor Top | Leotard top, sailor collar, front and back bows, choker, puff sleeves, arms and gloves. It hides whatever you wear on your hands: her gloves are part of the top. |
| Educand's Sailor Skirt | Skirt (on the game's skirt physics bones), the back bow's long tails, the leotard under the skirt, her legs |
| Educand's Loafers | Red knee boots with the gold crescents |

**Races:** every race and gender.
- **Women** wear the Midlander woman fit. Every other race is reshaped from it by the game's racial deformer (EQDP entries in the mod make sure of that).
- **Men** get the same costume on the Midlander man's frame, reshaped the same way for the other male races.
- **Roegadyn men** have their own fit, as in the NursePool port: vanilla gear always ships Roegadyn models, and the game's deformer from the Midlander man scales their arms and hands 2.7×. **Hrothgar men** use the Roegadyn fit; the game's reshaping from Roegadyn to Hrothgar is close to identity.
- **Lalafell** (men and women) get a small Sailor Moon with a bigger head, sized to cover the Lalafell head.

Option group:
- **Hide your own face** (off by default): blanks every player face model. You shouldn't need it (see below). Turn it on only if yours shows, and only in a collection used by your character alone.

## How it was made
The STL is one solid print with no colours, UVs or rig, so everything except the shape was made for this port.
- **Paint** (`tools/labels.py`, `tools/paint.py`): 19 regions (hair, skin, collar, bows, gloves, boots, earrings and so on), grown from seed points picked on the renders. Each region spreads until it meets another along the sculpt's carved grooves (a marker watershed over groove depth). A few rules tidy what the grooves can't settle: the leotard under the skirt, the choker band, and where her forearms touch the skirt. The colours are the anime's. The grooves are darkened so the sculpted lines read.
- **Eyes and mouth** (`tools/paint.py`): the sculpt has only eye recesses. Blue irises with highlights, lash lines and a small mouth are drawn in a front-on picture of the face, fitted to each recess, and projected onto the face when baking.
- **Game mesh and textures** (`tools/bake.py`, `tools/blender/bake.py`): the 712k-triangle sculpt is decimated to 115k triangles (head 9k, hair 48k, body 58k) and smart-UV-unwrapped. From the full sculpt, Blender bakes colour, ambient occlusion and a tangent-space normal map that keeps the hair strands and pleats.
- **Rig** (`tools/joints.py`, `tools/fit.py`): her joints are measured from the painted limbs, and every vertex is weighted to her own segments by region and distance along the limb. The fit then works as in the Mina port:
  - torso: a height lattice
  - limbs: rotated and stretched onto the FFXIV bones
  - hands and boots: rigid
  - head: scaled so the wearer's face stays inside it
  - weights: renamed onto FFXIV bones, with the spine spread by height and the arms shared with the twist helpers
  - skirt and the bow's tails: the FFXIV skirt chains
  - hair: the head down to the shoulders, the upper back (`j_sebo_c`) below
- **Models** (`tools/build.py`): converted with Penumbra's own glTF importer, with the vanilla models' flags.

## Changes
**1.2.0** (2026-10-25): **brighter colours**, Neon 1.2.0's colour lift. The user, on seeing Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for". `tools/textures.py` (`LIFT`, `lift()`) lifts the painted colour maps after the bake: luminance raised by a gamma (dark and mid tones most, hue kept), then saturation multiplied in linear light. The paint (`paint.py`) and the bake are unchanged.
- head (face, ears, eyes): gamma 1.4, saturation 1.2, as Neon
- hair: backed off to 1.2 / 1.1; body (uniform, gloves, boots, legs): 1.15 / 1.1. The paint is already bright, flat anime colour, and at 1.4 / 1.2 GS daylight showed the boots and bow as flat neon red with no shading, the skirt washed toward cyan and the hair toward lemon (`work/lift/rejected_1.4_1.2/`, `work/lift/backoff_candidates.png` and `backoff_zoom.png`: 1.1.0, the chosen values, a milder pair, 1.4 / 1.2).

Normal and mask maps are unchanged. GS before and after, Midlander woman, idle, by day and in dim neutral light: `work/lift/cmp_lift.png`. In GS the colours are richer (average saturation 0.54 to 0.60 by day and in dim light: deeper gold hair, bluer skirt, redder boots and bow) with the shading kept; average brightness barely moves (+0.2% by day, +0.7% dim), because her paint is already light and the lift mostly raises dark and mid tones. To tune it, change `LIFT` and run `python -P -E tools/make.py --from textures` (or `textures`, `pack`, `glamourer_design` and `validate_pmp` on their own).

**1.1.0**: compared with the source sculpt in the PMP Viewer's game-shader renderer (GS, `PmpViewer/tools/gs_render.py`, idle pose). Fixed:
- **Wearer's neck showed through.** GS with and without the "Hide your own face" option differed by 600–1,200 pixels per view, at the nape and under the ears. The wearer's own face model carries the neck down to the collar, and her anime neck is far slimmer. Now:
  - her neck skin, choker and collar are pushed out to clear every player face that wears each fit (`fit.py cover_neck`, from the Asuka port, capped at 2 cm instead of 3 so the bare nape stays slim)
  - that neck skin is weighted as vanilla faces weight theirs (`neck_weights`)
  - the leak is now 0–94 pixels per view on the Midlander woman
- **Paint leaks:**
  - the collar colour had flooded both puff sleeves and the side of her chest
  - skirt blue had run down the back of her left thigh, and boot red up the back of her right calf
  - the back bow's tails had spilt onto the pleats
  - the choker's edge left a jagged red fringe at the nape

  Each is now a rule in `labels.py`, checked on the sculpt. The collar's rolled edge is collar blue rather than white, which had spread over the lapels.
- **Face shading:** her bangs threw a hard shadow across her face. The head model now casts no sun shadow (flags1 ShadowDisabled, as vanilla hair).
- **Dark hair crevices:** baked occlusion goes into the mask at half strength (`textures.py AO_STRENGTH`), because the game adds its own ambient occlusion and shadows on top.
- **Decal key:** every material has the decal key off (`0xD2777173 = 0x4242B842`). The e0800 template had it on, which lets the game stamp the slot's decal over the material: the character's face paint on the head, which turned the Sora port's face dark in game.

**1.0.1**: vertex colour set 0 is now white. 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so the model would have rendered pitch black in game, as Mantis did on its first test. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla.

## Known limits
- **Not checked in game yet.** It was checked offline only:
  - every model, material and texture in the pack parses with Penumbra and Lumina
  - every material and texture a file names is shipped
  - Penumbra's own reader loads all 76 EQP and EQDP entries
  - the PMP Viewer's checks find no problems for any race (`PmpViewer/tools/check_pmp.py`)
  - all four fits render in GS in the game's idle pose: Midlander woman and man, Roegadyn man, Lalafell
- How much of the wearer's own face shows through her head:
  - Midlander woman, measured in GS: 0–94 pixels per 700×700 head view (was up to 1,200)
  - `tools/poke.py` ray check from 1.0 (bind pose; its rays miss the nape that GS showed, so read these as lower bounds): Lalafell and Roegadyn/Hrothgar men 0.1–0.2%, Au Ra 3–9% (women) and 6–13% (men) at the horns and scales
- On men and Roegadyn men her head sits low on the collar, so the choker is hidden under her chin.
- Her face is static: no blinking, mouth movement or expressions.
- Her hair has no physics. The pigtails follow the upper back, so they don't swing with every turn of the head, and they bend a little at the shoulders when the head turns far. Arms swinging back pass through them.
- Her hands are rigid (open, as sculpted), so her fingers don't close round weapons. Her boots are rigid too, high heels included.
- In the print, her left forearm is fused to the skirt and her fingertips touch a pigtail. The fit cuts those joins (`tools/fit.py`: `cut_web`, `cut_stretched`), drops the loose scraps and closes the small holes. One jagged seam is left along the inside of the left forearm, against her hip. The materials are double-sided, so it shows as white glove, not a hole.
- The colours are picked by region from the anime, not from a painted figure. Small patches at region edges may be off.
- The head flags are copied from the vanilla Moogle Head, so earrings, necklaces and racial ears are hidden. The top hides bracelets, rings and tails.
- Everyone in this mod's collection who wears these items looks like Sailor Moon.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy and Pillow, plus the portable Blender in `../Aerith/apps`). Use `--from <step>` to start partway. Steps:
1. `src`, `labels`, `paint`, `joints`: the sculpt in game axes, its paint regions, colours and eye picture, and her joints
2. `bake`: game mesh, UVs and baked textures (Blender, about 3 minutes)
3. `prep_refs`: the FFXIV skeletons (Midlander, Roegadyn and Lalafell bodies, and the races the checks reshape to), racial deformer and vanilla models
4. `fit`: per race in `PROFILES`
5. `textures`, `materials`, `build`: the game files
6. `pack`, `glamourer_design`, `validate_pmp`, `render_preview`: the `.pmp`, the Glamourer design, the file and manipulation check, and `out/preview.png`

Checks:
- `labels.py render` and `check_bake.py`: the paint regions and the baked game mesh (`work/look`)
- `check_fit.py <race> [other races]`: the fit over the FFXIV body and face, and in idle and run poses (`work/preview`)
- `poke.py <fit race> [races]`: how much of each race's face shows through her head
- `check_mdl.py <race>`: the built `.mdl` and `.tex` files read back, plus one colour per gear slot

Tool changes from the Mina project:
- `tools/xivtool` adds `iteminfo`: equip level, gender and race restriction, class category and tradability.
- `tools/pbd.py` is NursePool's: the Lalafell woman derives from the Lalafell man (identical skeletons) and the Hrothgar man from the Roegadyn man, not from the Midlander woman or man.

Sailor Moon belongs to Naoko Takeuchi, Kodansha and Toei Animation. The figure sculpt belongs to its sculptor. Fan port, personal use only: don't upload or share the `.pmp`.
