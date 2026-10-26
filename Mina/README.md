# Mina (Deadlock) for FFXIV

Penumbra mod: `out/Mina (Deadlock).pmp`. Preview: `out/preview.png`, rendered from the built mod files in an idle pose. Left to right: Mina on a Midlander woman, a Viera woman, an Au Ra woman, a Midlander man and a Lalafell.

Ported from `source/MinaRIG_v0.2_88MMgX2.blend` (model by Valve, Blender rig by Lellex). This is a full-body costume: Mina replaces your whole character, head included.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Alternative** set (all classes, level 1): Leather Ribbon, Ruffled Dress, False Nails, Bloomers and Boots. The quickest way is the Glamourer design: copy the code from `out/Mina - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the five gear slots, shows the hat and turns the mod on. No gil shop sells the set, but Glamourer can put it on without owning it.
3. If anything doesn't change, run `/penumbra redraw`.

| Item | Becomes |
|---|---|
| Alternative Leather Ribbon | Mina's head, eyes and bob. It hides your hair and ears. |
| Alternative Ruffled Dress | Jacket, sash and her red purse |
| Alternative False Nails | Cuffs and red gloves |
| Alternative Bloomers | Shorts, bare thighs and stockings, garter buckles, skirt and the bat-wing overskirt |
| Alternative Boots | Heeled thigh boots |

**Races:** every race and gender.
- **Women** wear the Midlander woman fit. Every other race is reshaped from it by the game's racial deformer (EQDP entries in the mod make sure of that).
- **Men** get Mina on the Midlander man's broader frame, reshaped the same way for the other male races.
- **Lalafell** (men and women) get a little Mina with a big head.

Option groups:
- **Purse**: with purse (default) or no purse.
- **Overskirt**: **Hangs clear of the hands** (default), or **Flared, as in Deadlock**. The game's standing poses hang your hands at your hips, where her wide bat-wing overskirt flares, and the flared shape hides them. The default lets the sides of both skirts hang closer to the body, as cloth would, while the front and back keep their flare. In the game's idle, about 31% of the left hand and 15% of the right are still covered, against 99% and 94% with the flare (`tools/hands.py`).
- **Head size**: **Deadlock size (hides your own face)** (default), or **FFXIV size**. Her head can only be smaller than your own FFXIV face if your face is hidden. Penumbra can't hide a face only while a hat is on, so Deadlock size blanks every player face in the collection, even when you aren't wearing the set. Use the mod in a collection just for your character, or pick FFXIV size. See the head notes below.
- **Hide your own face** (off by default): blanks every player face model. You shouldn't need it: Midlander, Viera and Lalafell faces stay inside her head, and Miqo'te and Au Ra faces show only slightly (see below). Turn it on only if yours shows, and only in a collection used by your character alone.

## Changes
**1.2.0** (2026-10-25): brighter colours, with Neon's lift. The user, on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/textures.py` → `lift()` brightens every `_base` colour map (`LIFT`: upper, lower, head, hair, eyes, bag, charm; all are character.shpk with the colour baked in, her face too). Luminance is raised by a 1.4 gamma, which lifts dark and mid tones most and keeps the hue, then saturation goes up 20% (1.2) in linear light. Masks, `_id`, the flat normal and the colour table are unchanged.
- In GS (Midlander woman, idle) the figure's average brightness rises about 50% by day and 60% in dim neutral light; the navy coat and red bob gain the most, and her skin stays pale. Before and after, by day and in dim light: `work/lift/cmp_lift.png` (the 1.1.0 pack is `work/lift/before.pmp`).
- To tune it, change `LIFT` and run `python -P -E tools/textures.py`, then `pack.py`, `glamourer_design.py` and `validate_pmp.py`.

## Known limits
- **1.1.0: matched against the game's own shaders and Deadlock.** The PMP Viewer's game-shader renderer was compared with Valve's in-game model on the Deadlock wiki (its 3D viewer), not with the .blend's toon render: the .blend's material adds a strong white rim light that Deadlock doesn't have.
  - Her eyes no longer glow. Valve gives the eyes, charm and umbrella self-illumination maps with an emissive strength of 0. 1.0.x also picked the glow row everywhere except the glow map, so the whole eyeball glowed red (Dawntrail `_id` green 255 picks a pair's first row, 0 its second).
  - Her head casts no sun shadow (model flags1 bit 0, as Aerith's hair). The chunky fringe threw hard shadow bands across her eyes.
  - Materials are more matte, like Valve's fully rough ones.
  - The new **Overskirt** option (above).
  - The new **Head size** option, for a smaller head; the user chose Deadlock size as the default. At FFXIV size her head is 19% bigger relative to her body than in Deadlock:
    - FFXIV bodies have shorter legs, so a head scaled with the body comes out about 10% bigger against her height.
    - The head is enlarged 8% (women) to 15% (men) so your own face stays inside it.

    It can't shrink without exposing a face:
    - At 1.00 a vanilla Midlander or Viera face still stays inside (at 0.94 Midlander cheeks show).
    - Face mods are bigger. The user's Abigail - Demon face gives Midlander face 1 elf ears (`atrx_ears`, `shpx_elf`), and at 1.00 an ear tip and its jaw showed in GS. 1.08 covers it.

    **Deadlock size** has her Deadlock head-to-height ratio (head 0.91 for women, 0.90 for men, 1.7 for Lalafell) and the bob slimmed to 80% of its thickness above her scalp (`slim_hair()`), with her own pointed ears tucked in (`tuck_ears()`). It blanks every player face, because Penumbra can't hide a face only while a hat is on: its attribute and shape manipulations are keyed to the face model itself, not to what's worn in another slot.
  - Not matched: in game her cheeks have three small dark beauty marks under each eye. The .blend's copy of Valve's head texture predates them.
- **1.0.1: vertex colour set 0 is now white.** 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so the model would have rendered pitch black in game, as Mantis did on its first test. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla.
- **Not checked in game yet.** It was checked offline only:
  - every model, material and texture in the pack parses with Penumbra and Lumina
  - every material and texture a file names is shipped
  - Penumbra's own reader loads all 95 manipulations
  - the built models, read back and posed, deform correctly (`work/preview/mdl_*`)
- Her face is static: no blinking, mouth movement or expressions. Her hair has no physics. The skirt and the bat-wing overskirt ride the game's skirt bones, so they sway like vanilla skirts.
- How much of each race's own face shows through her head (`tools/poke.py`, bind pose):
  - 0% for Midlander, Viera and Lalafell
  - about 1% for Miqo'te, at the top of the head where their ears sit
  - 3–7% for Au Ra, at the horns and jaw scales
  - Hrothgar wasn't measured
- The head flags are copied from the vanilla Moogle Head. With the set on, the body flags hide necklaces, earrings, bracelets, rings and tails, and breast physics is off.
- With the flared overskirt, hands hanging at the hips sink into it, as they do with wide vanilla skirts. See the **Overskirt** option.
- Her umbrella and gun aren't included. The vanilla parasol fashion accessories and Machinist pistols don't share one model layout, so they couldn't be placed without checking in game.
- The rip has no normal or shine maps. Normals are flat, and shine and roughness are set per surface in `tools/textures.py` (`TEXSETS`). Nothing glows (`tools/materials.py` → `GLOW` is empty).
- Everyone in this mod's collection who wears the Alternative set looks like Mina.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy and Pillow, plus the portable Blender in `../Aerith/apps`). Use `--from <step>` to start partway.
1. `export_src` (`blender/export_src.py`): opens the .blend with script auto-run off, so its rig UI script never runs. It puts every armature at rest and dumps the meshes, weights, both rigs, the packed textures and source renders to `work/src` and `work/preview`.
2. `prep_refs.py`: pulls the c0101, c0201, c1101, c1401 and c1801 skeletons, the racial deformer file, the bare body, a face and the Alternative models from the game.
3. `fit.py`: retargets Mina onto each race in `PROFILES` through her own Rigify rig:
   - torso: a height lattice through her ankles, knees, hips, shoulders and neck
   - limbs: one affine per bone, rotated onto the FFXIV bone and stretched to its length
   - hands and heeled boots: rigid
   - head: rigid, scaled and placed so the wearer's face stays inside it; for the Deadlock-size option, a second, smaller head with the bob slimmed toward her scalp
   - weights: hers, renamed onto FFXIV bones, with the arm shared with the twist helpers the way the vanilla body does it
   - skirts: the FFXIV skirt chains, by angle and height
   - purse: copied from the nearest jacket point
   - the Overskirt option's draped skirts (`drape()`): in the arm sector each point swings toward vertical about the waist, keeping its distance, and stays 1 cm outside the layer beneath. The swing is a smooth field over angle and distance from the waist, so a lined panel's two sides move together.
4. `textures.py` and `materials.py`: Dawntrail `character.shpk` textures and materials.
5. `build.py`: splits Mina into the five gear models per race, plus a jacket without the purse and legs with the draped skirts. It converts them with Penumbra's importer (`apps/xivtool import`), copies the vanilla model flags and radius, turns off the head's shadow, and makes the empty face stand-ins.
6. `pack.py`, `glamourer_design.py`, `validate_pmp.py`, `render_preview.py`: the `.pmp`, the Glamourer design, the file and manipulation check, and `out/preview.png`.

Checks:
- `check_fit.py <race> [other races]` renders the fit over the FFXIV body and face, and in idle and run poses.
- `poke.py <fit race> [races]` measures how much of each race's face shows through her head.
- `check_mdl.py <race>` renders the built `.mdl` and `.tex` files back, plus one colour per gear slot.
- `analyze_src.py` lists what each source mesh is weighted to.
- `hands.py <race>` poses the fit with the game's own idle and /cpose animations (`game_pose.py`, using the PMP Viewer's .pap decoder) and measures how much of each hand is inside either overskirt.

Tool changes from the Sonic project:
- `tools/xivtool` adds an `ornaments` command, which lists fashion accessories and their model ids, and `mdlflagbits`, which sets or clears model flags1 bits.
- `tools/pbd.py` now takes every playable race's deform parent from the race itself (women from the Midlander woman, men from the Midlander man). This was checked against the real skeletons. The link table it read before gave wrong parents for Highlander, Elezen, Miqo'te and Roegadyn women.

Mina and Deadlock belong to Valve. Blender rig by Lellex. Fan port, personal use only: don't upload or share the `.pmp`.
