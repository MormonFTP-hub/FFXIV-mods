# The Lich King (World of Warcraft) for FFXIV

Penumbra mod: `out/The Lich King (WoW).pmp`. Preview: `out/preview.png`. It's rendered from the built `.mdl` and `.tex` files, with the vanilla Deathbringer next to Frostmourne for scale.

Arthas as the Lich King, from the WoW model in `source/lichking/lichking.mb` (a rigged Maya 2018 scene), fitted to the Hyur Midlander male skeleton. The armour, sword and textures belong to Blizzard, so it's personal use only: don't upload or share the `.pmp`.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Archfiend** set (all classes, level 1). The quickest way is the Glamourer design: copy the code from `out/The Lich King - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It also puts the Deathbringer in your main hand, but only if you're on Dark Knight.
3. If anything doesn't change, run `/penumbra redraw`.

| Item | Becomes |
|---|---|
| Archfiend Helm | Crown helm, his shadowed face with glowing eyes, and the white hair under it. Hides your hair. |
| Archfiend Armor | Breastplate, skull pauldrons, collar, and the floor-length cape. The cape rides the skirt physics bones. |
| Archfiend Gauntlets | Clawed gauntlets with fur cuffs |
| Archfiend Breeches | Belt, front tabard (front skirt bones), skull tassets |
| Archfiend Sabatons | Greaves, shin fur, skull sabatons |
| Deathbringer (DRK, `w1501 b0037`) | Frostmourne. The **Frostmourne** option is on by default. |

**Races:** the models are built for Hyur Midlander male. Every other male race except Lalafell wears the same models through the game's racial deformer (EQDP entries in the mod make sure of that). Under the set, tails, Au Ra horns, Viera ears and hair are hidden (EQP entries).

## Changes
**1.1.0** (2026-10-25): brighter colours, with Neon's lift. The user, on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/textures.py` → `lift()`, called in `painted_set()`, brightens the `lk_a`, `lk_b` and Frostmourne (`fm`) `_base` colour maps (`LIFT`). Luminance is raised by a 1.4 gamma, which lifts dark and mid tones most and keeps the hue, then saturation goes up 20% (1.2) in linear light. Only `_base` changes: bumps, occlusion and the glow mask are still made from the unlifted paint, the alpha is unchanged (checked texel for texel against 1.0.1), and so is the colour table, so the armour stays metal. The eye mist (a glowing card whose opacity is its brightness) isn't lifted.
- In GS (Midlander man, idle) the cape, the olive leather, the fur and the steel come out clearly brighter, and nothing clips to white. The figure's average brightness rises about 37% by day and 35% in dim neutral light, and its saturation 24–35%. Before and after, by day and in dim light: `work/lift/cmp_lift.png` (the 1.0.1 pack is `work/lift/before.pmp`). GS can't draw weapons, so Frostmourne's map is compared as a texture: `work/lift/cmp_lift_frostmourne_tex.png`.
- To tune it, change `LIFT` and run `python -P -E tools/textures.py`, then `pack.py`, `glamourer_design.py` and `validate.py`.

## Known limits
- **1.0.1: vertex colour set 0 is now white.** 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so the model would have rendered pitch black in game, as Mantis did on its first test. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla.
- **Not checked in game yet.** Everything was checked offline: the rebuilt mesh matches every face count Maya stored along its edit history, and the pack validates (every model, material and texture parses and is shipped). The pose test and the round-trip renders are in `work/preview/`.
- The textures are WoW's 512 px originals, upscaled to 1024. Bumps come from the painted detail, and the ice-blue paint (eyes, helm gems, Frostmourne's runes) glows. If bumps look lit from below, flip the green channel in `tools/textures.py` → `normal_from_height()`. Shine and glow are in `tools/materials.py`.
- His face is static, and his helmet sits slightly larger than a bare FFXIV head so that Midlander male faces 1–7 stay inside it. The wearer's ear can show in the small gap behind the faceplate.
- The pauldrons ride `n_kataarmor` like vanilla shoulder armour, so they follow raised arms only as far as the game's own pauldrons do.
- Frostmourne's grip is lengthened 2.5× so both hands fit in Dark Knight animations. The Awoken and Ultima Deathbringer variants keep their vanilla visual effects.
- Everyone in this mod's collection who wears the Archfiend set as a non-Lalafell man looks like this. Use a collection just for your character if that matters.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy and Pillow, the portable Blender in `../Aerith/apps` for previews, and the .NET 10 SDK only to rebuild `apps/xivtool`). Use `--from <step>` to start partway.
1. `src.py`: reads the Maya binary scene (`mb.py`) and replays its polygon history at the bind pose (`mbmesh.py`): face collapses, deletes, welds, splits, chip-offs, shading-group reassignments and the final smoothing pass. It keeps the WoW skin weights and the 58-joint rig.
2. `prep_refs.py`: pulls the c0101 skeleton, body and faces, the Archfiend models and the Deathbringer from the game.
3. `fit.py`: retargets him through his own rig. Limbs, hands and fingers get one affine per bone onto the FFXIV bones. The torso gets a height lattice, narrowed until his shoulder and hip joints land on FFXIV's. The pauldrons and helmet stay rigid, and the helmet bulges out wherever a Midlander male face would show through. His weights are renamed to FFXIV bones. The spine is spread over `j_sebo_a/b/c`, the cape goes on the back and side skirt bones, the tabard on the front skirt bones, and the pauldrons on `n_kataarmor`.
4. `textures.py` and `materials.py`: Dawntrail `character.shpk` texture sets and materials. WoW keeps a reflection mask in the alpha of opaque surfaces, so alpha only means opacity on the cape, hair and fur.
5. `build.py`: splits him into the five gear models by skin weight, places Frostmourne in the Deathbringer's model space, and converts both with Penumbra's importer (`apps/xivtool import`).
6. `pack.py`, `glamourer_design.py`, `validate.py`: the `.pmp`, the Glamourer design, and a check that every file parses and is shipped.

Checks: `preview_src.py` renders the rebuilt source, `check_fit.py` renders the fit over the FFXIV body (`full`, `head`, `hands`, `feet`), `check_pose.py` renders a posed deformation test, and `check_mdl.py` renders the built files back.
