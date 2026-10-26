# Viper (Valorant) for FFXIV

Penumbra mod: `out/Viper (Valorant).pmp`. Preview: `out/preview.png`, rendered from the built mod files in an idle pose. Left to right: Viper on a Midlander woman (gas mask), a Viera woman (mask off), an Au Ra woman (Viper's Pit hood), a Midlander man and a Lalafell.

Ported from the [Kingdom Archives model viewer](https://kingdomarchives.com/modelviewer/viper) (Valorant character-select model `CS_Pandemic_S0`). This is a full-body costume: Viper replaces your whole character, head included.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Scientist's** set (all classes, level 1): Monocle, Coat, Gloves, Breeches and Boots. The quickest way is the Glamourer design: copy the code from `out/Viper - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the five gear slots, shows the hat and turns the mod on. Glamourer can put the set on without you owning it.
   - Viper is a biochemist, so the Scientist's set it is.
3. If anything doesn't change, run `/penumbra redraw`.

| Item (Scientist's set, e9233) | Becomes |
|---|---|
| Scientist's Monocle | Her head, hair and mask. It hides your hair and ears. |
| Scientist's Coat | Suit torso, collar, the mask tubes, the backpack canister, upper arms |
| Scientist's Gloves | Forearms, gloves and the toxin gauntlet on her right arm |
| Scientist's Breeches | Hips, belt and the vial at her hip |
| Scientist's Boots | Thigh-high boots with the knee guards |

**Races:** every race and gender.
- **Women** wear the Midlander woman fit. Every other female race is reshaped from it by the game's racial deformer (EQDP entries in the mod make sure of that; the game has no women's Scientist's Gloves, so the mod ships its own).
- **Men** get her on the Midlander man's frame, reshaped the same way for the other male races.
- **Roegadyn men** have their own fit. Vanilla gear always ships Roegadyn models, and the deformer data from the Midlander man doesn't reproduce the Roegadyn skeleton. **Hrothgar men** use the Roegadyn fit; the game's deform from Roegadyn to Hrothgar is close to identity.
- **Lalafell** (men and women) get a little Viper with a big head.

Option groups:
- **Mask** (pick one): **Gas mask** (default, her usual look), **Mask off** (her bare face) or **Viper's Pit** (her ultimate's full hood with the yellow lenses; no hair). These are the viewer's own three head states.
- **Hide your own face** (off by default): blanks every player face model. Turn it on only if your face shows through her head, and only in a collection used by your character alone.

## Changes
**1.1.1** (2026-10-25). Metal fix, as Neon 1.1.0, so the brighter colours actually show.
- **Cause.** 1.0.x–1.1.0 wrote the `_id` green as the viewer's metalness, but G = 255 picks the first (plain) row of the colour-table pair and G = 0 the second. The flat `_id` (hair, eye overlay) was G = 0 too. So 64–100% of every material, skin and suit included, sat on a fully metal row, and GS drew her near-black.
- **`_id`.** `tools/textures.py` now writes `_id` as G = 255 − metal, with the ORM blue's faint values cut away first (`METAL_RAMP` 120–190, as Neon). The flat `_id` is G = 255.
- **Colour table.** `tools/materials.py`: the second row is a glossy non-metal (roughness 0.35, metalness 0) instead of metal, as in Neon. Only her real metal parts use it: gauntlet, canister, buckles, plates. A metal row turns them near-black in GS, because the game's metals only reflect the environment.
- **Decal key.** The template's crest/face-paint decal key (`0xD2777173`) is off (`0x4242B842`) on every material.
- **Check.** check_pmp: the seven metal-row warnings are gone, 0 problems. `validate_pmp` ALL OK.
- **GS.** 1.0.1 against 1.1.1, by day and in dim light: `work/lift/cmp_lift.png`, head close-ups in `work/lift/cmp_lift_head.png`. Her real colours now show: the mint-teal bodysuit panel, the dark indigo suit and the acid-green trim, all as in the source texture (`work/lift/body_df_before_after.png`: the body colour map before and after the lift). The skin is natural, and nothing blows out (0.1% of pixels at full).

**1.1.0** (2026-10-25). Brighter colours, with the lift from Neon 1.2.0. The user, on Neon: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/textures.py` lifts the body, props and hair colour maps (`LIFT`); the props' glow is still added afterwards. Luminance goes up by a 1.4 gamma with the hue kept, which lifts dark and mid tones most. Then saturation goes up 1.2×. The eye overlay (lash-line shadow and catchlight) is unchanged, as in Neon. Alpha, normal, mask and `_id` maps are unchanged.
- In GS, the figure is about 29% brighter by day and in dim neutral light, with about 65% more colour. The teal bodysuit, the green trim and the mask read more vividly, and nothing blows out. Before and after, by day and in dim light: `work/lift/cmp_lift_v110.png`, with head close-ups in `work/lift/cmp_lift_head_v110.png`. The pack before the change is `work/lift/before.pmp`, and the 1.1.0 pack is `work/lift/v110.pmp`.
- To tune it, change `LIFT`, then run `textures.py`, `pack.py`, `glamourer_design.py` and `validate_pmp.py`. The models don't need rebuilding.
- 1.1.0 left 64–100% of every material on a fully metallic row, which kept her dark in GS. 1.1.1 fixes that.
- `out/preview.png` is still the 1.0.1 render.

## Known limits
- **1.0.1: vertex colour set 0 is now white.** 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so the model would have rendered pitch black in game, as Mantis did on its first test. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla.
- **Not checked in game yet.** It was checked offline only:
  - every model, material and texture in the pack parses with Penumbra and Lumina
  - every material and texture a file names is shipped
  - Penumbra's own reader loads all the manipulations
  - the built models, read back and posed, deform correctly (`work/preview/mdl_*`)
- How much of each race's own face shows through her gas-mask head (`tools/poke.py`, bind pose, every face of each race):

  | Race | Men | Women |
  |---|---|---|
  | Midlander | 0–0.3% | 0–0.6% |
  | Highlander | 0.1–1.2% | 0–0.7% |
  | Elezen | 0.2–4.7% | 0.1–2.5% |
  | Miqo'te | 1.2–1.3% | 1.4% |
  | Roegadyn | 0.3–1% | 0–0.2% |
  | Au Ra | 8–17% (horns and jaw scales) | 10–15% (horns and jaw scales) |
  | Hrothgar | 1–3% | 5% |
  | Viera | 0–0.1% | 0.1% |
  | Lalafell | 0.7–1.2% | 0.7% |

  Apart from the Au Ra horns, most of it is the underside of the jaw or the back of the neck, which only shows from below or behind.

- Valorant heads are small next to FFXIV skulls, so her head is scaled up a little per frame (`PROFILES` in `tools/fit.py`, found with `tools/tune_head.py`) to cover the wearer's scalp.
- Her face is static: no blinking or lip movement. The hair has no physics.
- Materials are Dawntrail `character.shpk` with the viewer's colour, normal (green flipped: the maps are green-down, FFXIV's green-up) and ORM maps. The prop map's glow (hip vial, gauntlet lights) is baked into its colour; the body and hair emissive maps in the viewer are blank. The eye overlay (lash-line shadow and catchlight) is alpha-tested instead of blended.
- Everyone in this mod's collection who wears the Scientist's set looks like Viper.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy and Pillow, plus the portable Blender in `../Aerith/apps` for previews). Use `--from <step>` to start partway.
1. `fetch.py`: downloads the viewer's glb and PNG textures (the paths in the page's `MODEL_JSON`) to `source/`.
2. `export_src.py`: unpacks the glb into `work/src`: one merged mesh, skeleton, materials, textures, and the joint matrices of each viewer animation's first frame. glTF is already in FFXIV's axes.
3. `prep_refs.py`: pulls the FFXIV skeletons, the racial deformer file, faces and the Scientist's models from the game (Lumina, through `apps/xivtool`).
4. `fit.py`: retargets her onto each race in `PROFILES` through her own skeleton (torso height lattice, one affine per limb bone, hands scaled to the FFXIV knuckles, rigid boots, rigid head scaled and placed on the FFXIV eyes or skull centre). Weights follow her own, renamed onto FFXIV bones. Each vertex also gets a hide flag per mask state: the viewer's poses `Idle`, `Idle_Mask_Off` and `Idle_Ult` scale the pieces they don't show to zero.
5. `textures.py` and `materials.py`: Dawntrail `character.shpk` textures and materials, one per texture set (body, props, hair, eye). The body, props and hair colour maps get the 1.1.0 colour lift (`LIFT`).
6. `build.py`: splits her into the five gear models per race by skin weight, and builds the head three times (gas mask, mask off, hood). Converts with Penumbra's importer (`apps/xivtool import`), copies the vanilla model flags and radius, and makes the empty face stand-ins.
7. `pack.py`, `glamourer_design.py`, `validate_pmp.py`, `render_preview.py`: the `.pmp`, the Glamourer design, the parse checks and `out/preview.png`.

Checks: `look_src.py` (the unpacked source, bind pose), `look_pose.py <pose> [views] [head]` (the source in a viewer pose), `check_fit.py <race> [deform race ...]` (bind pose over the FFXIV body, face close-up, idle and run poses; `MASK=bare` or `MASK=hood` for the other heads), `poke.py <fit race> [races]` (face show-through), `tune_head.py <race> --head ...` (head scale search), `check_mdl.py <race>` (round trip from the built `.mdl` and `.tex` files). Renders go to `work/preview/`.

`tools/pbd.py` is Mina's racial-deformer reader with two parents fixed, verified against the game skeletons: the Hrothgar man derives from the Roegadyn man (c0901), and the Lalafell woman from the Lalafell man (c1101).

Viper and Valorant belong to Riot Games. Fan port, personal use only.
