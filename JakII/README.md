# Jak (Jak II) for FFXIV

Penumbra mod: `out/Jak (Jak II).pmp`. Previews: `out/preview.png` (the built game files, front and back), `out/preview_posed.png` (posed through their own skin weights).

Ported from the PS2 Jak II model (`source/JIIJak`). The OBJ ships without a skeleton, so it is rigged here to the Hyur Midlander male skeleton.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in a collection used only by your character.
2. Apply the Glamourer design: copy the code from `out/Jak - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets Hyur Midlander male, face 1 and hairstyle 1, puts on the Scion Rogue's set, empties the head slot and turns the mod on with both head options.
3. If anything doesn't change, run `/penumbra redraw`.

| Item (Scion Rogue's set, e6027, all classes, level 1) | Becomes |
|---|---|
| Head slot | Leave it empty so his head shows |
| Scion Rogue's Jacket | Blue shirt, scarf, chest straps, shoulder pauldron, gun holster on his back |
| Scion Rogue's Armguards | Fingerless gloves with the big cuffs, his fists |
| Scion Rogue's Gaskins | Belt, pouch, white trousers, knee pads |
| Scion Rogue's Boots | Strapped boots |

The **Jak's head** option group (both on by default) replaces Hyur Midlander male **face 1** (face, eyes, brows, goatee, long ears) and **hairstyle 1** (his hair and the goggles). Other male races except Lalafell wear the Midlander gear models through EQDP entries; the head only shows on a Midlander male with face 1 and hairstyle 1.

## Changes
**1.1.0** (2026-10-25): brighter colours, with Neon's lift. The user, on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/textures.py` → `lift()` brightens the `jak_base` atlas (`LIFT`, the one texture set: clothes, face, hair, eyes and goggles, all character.shpk with the colour baked in). Luminance is raised by a 1.4 gamma, which lifts dark and mid tones most and keeps the hue, then saturation goes up 20% (1.2) in linear light. The atlas layout and UVs are unchanged (checked against 1.0.2), and so are the mask, `_id`, normal and colour table.
- In GS (Midlander man, face 1 / hair 1, idle) the blue shirt, orange boots, green hair and red scarf come out clearly brighter, and the white trousers don't clip. The figure's average brightness rises about 17% by day and in dim neutral light, and its saturation about 20%. Before and after, by day and in dim light: `work/lift/cmp_lift.png` (the 1.0.2 pack is `work/lift/before.pmp`).
- To tune it, change `LIFT` and run `python -P -E tools/textures.py`, then `pack.py`, `glamourer_design.py` and `validate_pmp.py`. `textures.py` also rewrites the atlas UVs in `work/fit/fitted.pkl`; they come out the same, so the models don't need rebuilding.

## Known limits
- **1.0.2: your face paint no longer covers Jak's face.** The material was copied from a body template with `character.shpk`'s decal (crest) key on. In the face slot the game binds the character's face paint as that decal, and face paints have full alpha, so with face paint on, his face took the paint colour, as Sora 1.1.0's did. The material now uses vanilla's no-decal value (`0x4242B842`). The PMP Viewer flags this, and its game shaders show it with face paint set.
- **1.0.1: vertex colour set 0 is now white.** 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so every model, face and hair included, would have rendered pitch black in game, as Mantis did on its first test. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla.
- Not checked in game yet. The `.mdl` files are made by Penumbra's own importer and every file in the pack parses (`tools/validate_pmp.py`), and the built files render correctly in Blender (`tools/check_mdl.py`).
- Jak II has cartoon proportions: his legs are about half FFXIV's length relative to his torso. They're stretched onto the FFXIV hip, knee and ankle so animations bend at the right places, so he comes out taller and longer-legged than in the game. His head and boots are scaled down a little (`HEAD_SCALE`, `FOOT_SCALE` in `tools/rig.py`).
- The face is static: no blinking, expressions or lip movement. His fists stay closed. The hair has no physics, and its colour is baked in, so your hair colour setting doesn't change it.
- Dyes don't change anything.
- Face 1 / hairstyle 1 for Midlander men is also replaced by the Griffith, Sora, Jotaro and Cloud mods in this folder. If they're in the same collection, Penumbra's priority decides which head shows.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy and Pillow, plus the portable Blender in `../Aerith/apps` for previews). Use `--from <step>` to start partway.
1. `prep_refs.py`: pulls the c0101 skeleton, naked body, face 1, hairstyle 1 and the Scion Rogue's set from the game (Lumina, through `apps/xivtool`).
2. `fit.py`: poses the FFXIV naked body into Jak's T-pose (`rig.py`: each limb rotated and stretched onto his joints, measured with `analyze_src.py`), copies skin weights from the nearest body point, and smooths them over all clothing layers at once so straps and pauldron bend with the shirt. His head and hair use the head and neck. Everything is then un-posed into the FFXIV A-pose.
3. `textures.py`: packs the 26 small PS2 textures into one 2048 atlas (upscaled 2x). UVs that ran outside 0..1 (the PS2 repeated them) get as many repeats in their cell as they need. Writes Dawntrail `character.shpk` base / norm / mask / id textures.
4. `materials.py`: one `.mtrl` from the vanilla `e0800` material, with a white colour table and per-surface roughness and metalness (cloth, leather, metal, skin, hair, eyes, goggle lens).
5. `build.py`: splits the body into top / glv / dwn / sho by skin weight, writes glTF, and converts it with Penumbra's importer (`xivtool import`).
6. `pack.py`, `glamourer_design.py`, `validate_pmp.py`: the `.pmp`, the Glamourer design, and a check that every file parses and is shipped.

Checks: `check_tpose.py` (FFXIV body posed over the rip), `check_fit.py` (bind pose over the FFXIV body, stress pose; `head` for a close-up), `check_mdl.py` (round trip from the built `.mdl` and `.tex` files). Renders go to `work/preview/`.

Jak and Jak II belong to Naughty Dog / Sony Interactive Entertainment. Personal use only.
