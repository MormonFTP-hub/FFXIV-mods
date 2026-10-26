# Sonic the Hedgehog (Sonic Forces) for FFXIV

Penumbra mod: `out/Sonic the Hedgehog (Sonic Forces).pmp`. Preview: `out/preview.png`, rendered from the built mod files in an idle pose. Left to right: Sonic on a Viera man, Super Sonic on a Midlander man, Sonic on a Lalafell, Sonic on a Midlander woman.

Ported from the PC Sonic Forces rip by Random Talking Bush (`source/`). This is a full-body costume: Sonic replaces your whole character, head included.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Werewolf** set (all classes, level 1): Werewolf Head, Body, Arms, Bottoms and Feet. The quickest way is the Glamourer design: copy the code from `out/Sonic - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the five gear slots, shows the hat and turns the mod on.
3. If anything doesn't change, run `/penumbra redraw`.

| Item | Becomes |
|---|---|
| Werewolf Head | Sonic's head, eyes and muzzle. It hides your hair and ears. |
| Werewolf Body | Torso, upper arms, back spikes |
| Werewolf Arms | Forearms and gloves |
| Werewolf Bottoms | Hips, tail and legs |
| Werewolf Feet | Socks and shoes |

**Races:** every race and gender.
- **Lalafell** (men and women) get Sonic at his own size, about 1 m, with his own proportions.
- **Everyone else** gets a tall Sonic, about 2 m to the ear tips. His head, gloves and shoes stay cartoon-sized; his torso and limbs are stretched onto the body. Men wear the Midlander male fit and women the Midlander female fit; the other races are reshaped by the game's racial deformer (EQDP entries in the mod make sure of that).

Option groups:
- **Look**: Sonic (default) or Super Sonic, who glows faintly gold. Sonic's mouth sits on one side of his muzzle, as in the games; each look comes with the smirk on either side.
- **Hide your own face** (off by default): blanks every player face model. Your face doesn't show through his head on Midlanders, Viera, Lalafell or Midlander women (checked in `work/preview/fit_*_poke_sheet.png`). Turn it on only if yours does, for example as a Hrothgar or Roegadyn, and only in a collection used by your character alone.

## Changes
**1.1.1** (2026-10-25): **metal row fixed.** Up to 1.1.0 the `_id` green was the rip's metalness, but G = 255 picks the colour-table pair's first row and G = 0 the second (the metal one). So 98% of every body material, fur, skin, gloves and shoes included, drew as metal: in GS he came out dark, with only the gold buckles plain. `tools/textures.py` now writes G = 255 − metal, as Neon 1.1.0 does. Metal is `_prm` R with the faint 0.1–0.25 the rest of the rip carries cut away (`METAL_RAMP` 120–190). Now only the shoe buckles (2.3% of the body texture, `_prm` R = 255 in the source) use the metal row, and the eyes get a flat G = 255. The buckles stay metal, because the source marks them as metal. In GS they read as a slightly darker gold than a glossy non-metal row would give (`work/lift/buckle_rows.png`, `buckle_zoom.png`). To change that, set row 1 in `tools/materials.py` to roughness 0.35 and metalness 0. The materials are unchanged. GS before and after, 1.0.1 against 1.1.1, by day and in dim neutral light: `work/lift/cmp_lift.png` (Super Sonic: `work/lift/super_cmp.png`). Against 1.0.1 in GS he is now about 3.4 times as bright by day and in dim light. He has his real colours: bright blue, tan muzzle and arms, white gloves and socks, red shoes, all with their shading and nothing clipped to white. Super Sonic is bright gold instead of brown. check_pmp's five metal-row warnings are gone; only the eye's mirror-addressing note is left (see below).
- The eye material keeps its mirror addressing. Its UVs do run outside 0..1 (u −0.30 to 1.30, v −1.16 to −0.26 in the glTF; check_pmp says 85% sit on mirrored tiles), as the rip lays them out. In GS both irises and pupils draw in place, and the out-of-range parts land on the white of the eye (`work/lift/head_before.png`, `head_after.png`). Switching to wrap could pull the iris into the corners, so it's left alone.

**1.1.0** (2026-10-25): **brighter colours**, Neon 1.2.0's colour lift. The user, on seeing Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for". `tools/textures.py` (`LIFT`, `lift()`) raises each colour map's luminance by a 1.4 gamma (dark and mid tones most, hue kept), then multiplies saturation by 1.2 in linear light. It touches every `_base`: Sonic's and Super Sonic's body, and both eye sets. Normal, mask and `_id` maps were byte-identical to 1.0.1. In the game-shader renderer (GS, Midlander man, idle) his average brightness rises about 13% by day and in dim neutral light, and his blue about 18–20%, with nothing clipped to white (`work/lift/v110/cmp_lift.png`: 1.0.1 and 1.1.0 by day, then in dim light; `work/lift/v110/super_cmp.png` for Super Sonic). To tune it, change `LIFT` and run `python -P -E tools/make.py --from textures` (or just `textures`, then `pack`, `glamourer_design` and `validate_pmp`).
- In 1.1.0, GS still drew 98% of each body material on the metal row, so the lift showed less than it should. 1.1.1 fixes that.

## Known limits
- **1.0.1: vertex colour set 0 is now white.** 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so the model would have rendered pitch black in game, as Mantis did on its first test. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla.
- **Not checked in game yet.** It was checked offline only:
  - every model, material and texture in the pack parses with Penumbra and Lumina
  - every material and texture a file names is shipped
  - Penumbra's own reader loads all 95 EQP and EQDP entries
  - the built models, read back and posed, deform correctly
- His face is static: no blinking, mouth movement or expressions. The quills have no physics. The lowest back quills bend a little with the neck so they don't swing into his back.
- The head flags are copied from the vanilla Moogle Head, so necklaces, earrings, bracelets and rings are hidden, along with racial tails.
- On Lalafell the knee bends just above his socks, because the Lalafell shin is too short for his shoes.
- Everyone in this mod's collection who wears the Werewolf set looks like Sonic.
- If bumps look lit from below in game, flip the green channel back in `tools/textures.py`. The rip's normal map is DirectX style (green down), judged by which green sign makes its slopes integrate consistently (a vanilla FFXIV map passes the same test as green-up), so the pack ships it flipped.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy and Pillow, plus the portable Blender in `../Aerith/apps` for previews). Use `--from <step>` to start partway.
1. `prep_refs.py`: pulls the c0101, c0201, c1101 and c1701 skeletons, the racial deformer file and the Werewolf models from the game.
2. `fit.py`: reads the SMDs (`smd.py`) and fits Sonic onto each race in `PROFILES`, using his own rig:
   - torso: a height lattice through his ankles, knees, hips, shoulders and neck
   - limbs: one affine per bone, rotated onto the FFXIV bone, stretched to its length and thickened by `arm_thick` / `leg_thick`
   - head, hands, shoes, back spikes: rigid, scaled by their own factors
   - weights: Sonic's own, renamed onto FFXIV bones; his spine weight is spread over the FFXIV spine by height
3. `textures.py` and `materials.py`: Dawntrail `character.shpk` textures and materials. The buckles are metal through the colour table (`_id` G = 0 picks the pair's metal second row; everything else is G = 255).
4. `build.py`: splits Sonic into the five gear models per race (plus a head model per look and smirk side), converts them with Penumbra's importer (`apps/xivtool import`), and copies the vanilla model flags and radius. It also makes the empty face stand-ins.
5. `pack.py`, `glamourer_design.py`, `validate_pmp.py`, `render_preview.py`: the `.pmp`, the Glamourer design, the file and manipulation check, and `out/preview.png`.

Checks: `check_fit.py <race>` renders the fit over the FFXIV body and face, in a Viera shape for c0101, and in idle and run poses. `check_mdl.py <race>` renders the built `.mdl` and `.tex` files back, plus one colour per gear slot.

`tools/xivtool` is HeroChaosChao's helper with one change: `checkmanips` also prints EQP and EQDP entries.

Sonic the Hedgehog and Sonic Forces belong to Sega / Sonic Team. Rip by Random Talking Bush (The Models Resource); SMD importer by chrrox, Link, Kentilan and ItsEasyActually. Fan port, personal use only.
