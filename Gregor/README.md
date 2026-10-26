# Gregor (AEDD, Limbus Company) for FFXIV

Penumbra mod: `out/Gregor AEDD (Limbus Company).pmp`. Previews: `out/preview.png` (as a Viera male), `out/preview_idle.png`, `out/preview_arm_options.png`.

Ported from the VRChat avatar "AEDD Gregor" (`source/`, commissioned by L7_Spectra on X). It's the outfit only: your character keeps their own head, face, hair, ears and skin.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Wake Doctor's** set (all classes, level 1). The quickest way is the Glamourer design: copy the code from `out/Gregor - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It only sets the five gear slots and turns the mod on.
3. If anything doesn't change, run `/penumbra redraw`.

| Item | Becomes |
|---|---|
| Wake Doctor's Mask | Gregor's tinted glasses and the blue halo. Your hair and ears stay visible. |
| Wake Doctor's White Coat | Blue coat with the shoulder bolts, shirt, vest, tie and ID badge. The coat tails sway on the skirt physics bones. |
| Wake Doctor's Rubber Gloves | The centipede arm (AEDD) and your own left hand |
| Wake Doctor's Bottoms | Trousers and belt |
| Wake Doctor's Shoes | Right shoe, and the armoured left leg with its crystal spikes |

Option groups:
- **Arms**: right centipede (default, as on the avatar), both centipedes, left centipede only, or no centipede.
- **Head piece**: glasses and halo, glasses only, or halo only.
- **Centipede glow**: glowing red eyes (default), or eyes plus the cyan veins from the avatar's emission toggle.

**Races:** the models are built for Hyur Midlander male. Viera men, and every other male race except Lalafell, wear the same models through the game's racial deformer (EQDP entries in the mod make sure of that). The glasses are placed for the Viera male face.

## Changes
**1.1.1** (2026-10-25): the coat and suit now render as cloth, not metal, so 1.1.0's brighter colours show on them.
- `_id` green was inverted. Dawntrail picks a pair's first row at green 255 and its second at green 0, but `tools/textures.py` → `id_tex()` wrote green = the source's metallic map. So everything the avatar marks as non-metal (the coat, shirt, vest, tie and trousers) sat on the metal row, which gets no diffuse light and rendered near-black. `id_tex()` now writes green = 255 - blend, as Neon 1.1.0 does. The PMP Viewer's `check_pmp.py` warned that 96–99% of the suit and coat materials used a metal row; it now reports 0 problems.
- The second row stays metal (`tools/materials.py` unchanged): the source's metallic maps mark only real metal, so now only the glasses frame and buckles (fully metal) and the coat's bolts and the leg armour's plates (about 30–60% metal, as on the avatar) are metal.
- The same inversion had put 90% of the centipede on its vein row, which glows cyan with **Glowing eyes and veins**. Now only the veins (10%) use that row, as on the avatar. The default **Glowing eyes** option looks the same as before, because there both rows are plain.
- In GS (Midlander man, idle) the coat is now a visible blue, the shirt white, the tie red, the vest and trousers grey, and the leg armour and halo a bright blue. The bolts are dark grey to black, as on the avatar. The figure is about 2.6 times as bright as 1.0.1 by day and 2.5 times in dim neutral light. Before (1.0.1) and after (1.1.1), by day and in dim light: `work/lift/cmp_lift.png`. The 1.1.0 pack is kept as `work/lift/v110.pmp`.

**1.1.0** (2026-10-25): brighter colours, with Neon's lift. The user, on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/textures.py` → `lift()` / `lifted()` brightens the suit, aedd and centipede `_base` colour maps (`LIFT`). Luminance is raised by a 1.4 gamma, which lifts dark and mid tones most and keeps the hue, then saturation goes up 20% (1.2) in linear light. The alpha (cut-out opacity) is unchanged, and so are the normal, mask and `_id` maps, the colour tables and the glasses lens (it has no colour map).
- In GS (Midlander man, idle) the centipede, the leg armour and the halo come out a clearly brighter blue, the coat bluer and the tie redder; the figure's average blue rises about 46% by day and 48% in dim neutral light. The 1.0.1 pack is `work/lift/before.pmp`; `work/lift/cmp_lift.png` now compares it with 1.1.1.
- Not changed in 1.1.0 (fixed in 1.1.1), and it limited how much the coat and trousers brightened: the PMP Viewer's `check_pmp.py` reports that 96–99% of the suit and aedd materials use their pair's metal row (before and after). `_id` green is the metallic map, but Dawntrail picks the pair's second (metal) row at green 0, so the cloth renders as metal, which gets no diffuse light. Inverting `_id` green (as Neon 1.1.0 did) is a separate fix.
- To tune it, change `LIFT` and run `python -P -E tools/textures.py`, then `pack.py`, `glamourer_design.py` and `validate_pmp.py`.

## Known limits
- **1.0.1: vertex colour set 0 is now white.** 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so the outfit would have rendered pitch black in game, as Mantis did on its first test. The skin keeps the vanilla body's own colours. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla.
- The centipede rides your upper arm and forearm. On the avatar, constraints aim it at your hand. Here it's scaled to 75% of the avatar's size, so its tip just reaches the floor when your arm hangs straight down. Change `CENTI_FLOOR` in `tools/fit.py` to make it bigger (it will then sink into the floor in idle poses).
- The claw doesn't open (the avatar's "Tongs" shape key isn't used), and the AEDD face mask isn't included.
- Everyone in this mod's collection who wears the Wake Doctor's set as a non-Lalafell man looks like this. Use a collection just for your character if that matters.
- Not checked in game yet. If bumps look lit from below, flip the green channel in `tools/textures.py` → `normal()`. Shine and glow live in `tools/materials.py`.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy and Pillow, plus the portable Blender in `../Aerith/apps`). Use `--from <step>` to start partway.
1. `blender/export_src.py`: dumps the FBX meshes, UVs, weights, shape keys and both rigs to `work/src`.
2. `prep_refs.py`: pulls the c0101 and c1701 skeletons, the naked body, the Viera face and the deformer file from the game.
3. `fit.py`: retargets the outfit through Gregor's rig onto the FFXIV skeleton. Weights are copied from the FFXIV naked body, and the coat's from the vanilla Wake Doctor's coat. It also adds the body's own skin for your hand, neck and (optionally) right arm.
4. `textures.py` and `materials.py`: Dawntrail `character.shpk` textures and materials; the lenses use the vanilla sunglasses' glass shader.
5. `build.py`: splits the pieces into the five gear models and their option variants, and converts them with Penumbra's importer (`apps/xivtool import`).
6. `pack.py`, `glamourer_design.py`, `validate_pmp.py`: the `.pmp`, the Glamourer design, and a check that every file parses and is shipped.

Checks: `check_fit.py` renders the fit over the FFXIV body, as a Viera, and posed. `check_mdl.py` renders the built `.mdl` and `.tex` files back as a Viera, plus every arm option.

The original readme asks for credit to the model's creator and says the model isn't for resale. Gregor and Limbus Company belong to Project Moon. Personal use only.
