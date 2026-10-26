# Asuka Langley (Evangelion) for FFXIV

Penumbra mod: `out/Asuka Langley (Evangelion).pmp` (1.2.0). The plugsuit alone, with your own head: `out/Asuka Plugsuit (Evangelion).pmp` (1.2.0, `tools/build_outfit.py` and `tools/pack_outfit.py`; see [Plugsuit only](#plugsuit-only-your-own-head)). Previews (1.1.0 colours):
- `out/preview.png`: rendered from the built mod files in an idle pose. Left to right: Asuka on a Midlander woman, a Viera woman, an Au Ra woman, a Midlander man, a Roegadyn man and a Lalafell.
- `out/preview_gs.png`: the Midlander woman in the PMP Viewer's game shaders (the game's own shaders), daylight, game idle pose.

Ported from "Asuka Langley (Evangelion) T-Pose 3D Model" by **Alina Ricci**, CC BY 4.0 (https://sketchfab.com/3d-models/asuka-langley-evangelion-t-pose-3d-model-062cd48300004ad4b07174337276daec), in `source/`. It's an AI-generated mesh (SupaVoxel / Tripo, from one picture) of her red plugsuit, with colour, normal and roughness textures but no rig. This is a full-body costume: Asuka replaces your whole character, head included. Credit Alina Ricci if you share it.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Magitek** set (all classes, level 1): Magitek Ear Guards, Jacket, Fingerstalls, Bottoms and Shoes. The quickest way is the Glamourer design: copy the code from `out/Asuka - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the five gear slots, shows the hat and turns the mod on. The set is untradable and no gil shop sells it, but Glamourer can put it on without owning it.
3. If anything doesn't change, run `/penumbra redraw`.

| Item (Magitek set, e6164) | Becomes |
|---|---|
| Magitek Ear Guards | Her head, eyes, long hair and the red A10 clips. It hides your hair and ears. |
| Magitek Jacket | Plugsuit torso, the collar, upper arms |
| Magitek Fingerstalls | Forearms, wrist cuffs and gloves |
| Magitek Bottoms | Hips, thighs and knees |
| Magitek Shoes | Shins and the red heeled boots |

**Races:** every race and gender.
- Fitted to the Midlander woman, the Midlander man, the Roegadyn man and the Lalafell. Every other race is reshaped from those by the game's racial deformer (EQDP entries in the mod make sure of that); Hrothgar men use the Roegadyn fit.
- Lalafell get a small Asuka with a big head (2.1x), sized to cover the Lalafell head.

Option group:
- **Hide your own face** (off by default): blanks every player face model. Turn it on only if yours shows (a sliver can on long-necked races), and only in a collection used by your character alone.

## Plugsuit only (your own head)
`out/Asuka Plugsuit (Evangelion).pmp` is the suit on its own: your head, face and hair stay, and the head slot is left alone, so wear any hat or none.
1. Import it in Penumbra. It uses the same Magitek items as the full-body mod, so enable only one of the two in a collection.
2. Put on the Magitek **Jacket, Fingerstalls, Bottoms and Shoes**. The design in `out/Asuka Plugsuit - Glamourer import code.txt` sets those four, leaves your head slot and hat alone, turns this mod on and the full-body one off.

It's built from the same fits (`tools/build_outfit.py`). Her head and hair are gone, along with her chin and the hair and face shards the bake gave the suit's texture (in the full mod they sit inside her hair). The collar is **shrink-wrapped onto your own neck** (`wrap_collar`): 3 mm outside the fit race's own necks (all its player faces), its top edge lowered to just under the jaw, faded back to the original where it meets the shoulders.

**1.2.0 (Oct 25), after the user's in-game screenshot of 1.1.0: "fix the neck".** There was a black band between their chin and the collar's navy rim. In the full mod the collar sits round Asuka's neck, which the fit puts ~4 cm in front of the FFXIV neck, pushed out to clear every race's neck, and her neck skin closes it off. Alone, it was an open tube 2-5 cm in front of the wearer's throat (`tools/collar_check.py`), and the band was its dark inside.

`collar_check.py` measures the wrapped collar against each race's neck through the deformer. Most land 1-3 mm outside. Miqo'te women, Au Ra women and Highlander men have necks 9-11 mm thicker than the deformed fit, so their necks poked through the collar. They now get their own models (`build_outfit.EXTRA`): the base fit carried onto their skeleton by the game's racial deformer, then wrapped onto their own necks, with EQDP set to own. Checked in GS (game idle, front, from above, three-quarter and side) on Midlander and Miqo'te women and Midlander and Roegadyn men: the collar hugs the neck up to just under the jaw, with no gap. The Roegadyn man's neck stands about 1.5 mm proud of the collar on part of its rim.

## Changes in 1.2.0 (Plugsuit 1.1.0)
**Brighter colours**, Neon 1.2.0's colour lift. The user, on seeing Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for". `tools/textures.py` (`LIFT`, `lift()`, applied after the skin toning) raises each colour map's luminance by a gamma (dark and mid tones most, hue kept), then multiplies saturation in linear light:
- head (face, eyes, A10 clips) and hair: gamma 1.4, saturation 1.2
- the plugsuit (body set, both packs): backed off to gamma 1.2, saturation 1.1. Its red is already near-pure, and at 1.4 / 1.2 the red channel clipped on half the suit in GS daylight, flattening the latex shading into a uniform neon red (`work/lift/rejected_1.4_1.2/`, `work/lift/suit_backoff_zoom.png`: 1.1.0, 1.2 / 1.1, 1.4 / 1.2).

Normal maps, `_id` and the head and hair masks are unchanged. GS before and after, Midlander woman, idle, by day and in dim neutral light: `work/lift/cmp_lift.png` (full body) and `work/lift/cmp_lift_plugsuit.png`. In GS the full-body figure's average red rises 17% by day and 21% in dim light (luminance +6% and +8%, saturation 0.68 to 0.76), with the latex highlights and shading kept and her face still natural skin.
- The rebuild also ships a change `textures.py` already had but no pack carried yet: the few pieces of her face that the bake gave the suit's texture set (0.4% of it, round her chin) are now skin-toned and as matte as her face (`face_on_body_weight`), so the body `_mask` changes there too. The Plugsuit pack drops those triangles, so it looks the same there.

To tune the lift, change `LIFT` and run `python -P -E tools/make.py --from textures` (or `textures`, `pack`, `pack_outfit`, `glamourer_design` and `validate_pmp` on their own).

## Changes in 1.1.0
Compared with the source render in the PMP Viewer's game shaders (GS), which run the game's own shaders on the built pack:
- **Your own neck showed through.** The wearer's face model carries the neck down to the collar. Her anime neck is slimmer than FFXIV's, and her head sits about 4 cm further forward on it. The result was a pale flat patch behind her jaw, under the ear, on both sides. Her neck skin and collar are now pushed out to clear every face that wears each fit (`fit.cover_neck`, from the Peni Parker port), except at the front of the throat, which her chin covers. They're also skinned the way the vanilla necks are (j_kubi low, j_kao high), so they stretch with longer-necked races instead of riding up with the head.
- **The fringe shadowed her eyes.** Her chunky bangs threw a hard sun-shadow band across her eyes and forehead. The head piece now casts no sun shadow (model flag ShadowDisabled), as in the Mina and Aerith ports.
- **Too matte.** The source is glossy everywhere. The suit now has sharp latex highlights and the hair a sheen, and the skin is satin instead of matte. The levels were matched in GS (`tools/gloss_ab.py`).
- **The thumb crumpled in the game's idle pose.** It sat 18 mm and 31° off FFXIV's thumb. Every finger and the thumb now root on the FFXIV knuckle, aim along the FFXIV finger, and bend where the game's fingers bend, as in the Mantis and Peni Parker ports. The thumb opens from the hand with a web.
- **Her neck skin's painted shadow** is lightened toward her cheek tone, because the wider neck brought it into view as a dark band.

## How it was made
The Tripo mesh is one watertight, 969k-triangle surface: hair, face and suit fused, in a T-pose.
- **Regions** (`tools/labels.py`): hair by the texture's colour (orange-brown against the red suit), smoothed over the mesh; the head above the collar's top edge, which is measured from its navy band at every angle round the neck; the A10 clips above that.
- **Joints** (`tools/joints.py`): arms sliced across x and legs across y; a line through each segment's slice centres, joints at measured heights. Her fingers' lanes and the thumb's edge are measured from slices across the hand.
- **Game mesh and textures** (`tools/bake.py`, `tools/blender/bake.py`): decimated to 109k triangles (head 9k, hair 36k, suit 64k), smart-UV-unwrapped, and baked from the full mesh: colour, roughness, occlusion and a tangent-space normal map (the source surface with its own normal map on top). Head 1024, hair and suit 2048, at or above the source's texel density.
- **Rig** (`tools/fit.py`): every vertex is weighted to her own segments by region and distance along the limb, then retargeted as in the NursePool port:
  - one uniform scale from her legs and torso (her arms are ~40% shorter than FFXIV's, so they're stretched to the FFXIV joints rather than shrinking her legs)
  - torso: a height lattice; limbs rotated and stretched onto the FFXIV bones, which brings her arms down from the T-pose to the bind pose's 45 degrees
  - hands: turned so her knuckles line up with the FFXIV knuckles and scaled to them. Each finger and the thumb is then its own rigid piece, rooted on the FFXIV knuckle and aimed along the FFXIV finger. Its weight splits between the finger's two bones at the FFXIV middle joint. Where her fingers are fused, the lanes blend into each other, and the thumb's seam with the index becomes a web.
  - heels: rigid, sole on the floor under the FFXIV ankle
  - head: rigid, her eyes just in front of the FFXIV eyes (`PROFILES`, from `tools/tune_head.py`); the collar is placed by a smooth blend from the torso to the head, so it tilts forward like the FFXIV neck without tearing
  - neck cover: her neck skin and collar pushed out around the FFXIV neck axis until they clear the necks of every face that wears that fit, by up to 3 cm (`cover_neck`), then skinned as the vanilla necks (`neck_weights`)
  - hair: the head down to the shoulders, the upper back (`j_sebo_c`) below
- **Models** (`tools/build.py`): split into the five slots by skin weight, converted with Penumbra's own glTF importer, with the vanilla models' flags. The head piece casts no sun shadow.

## Known limits
- **1.0.1: vertex colour set 0 is now white.** 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so the model would have rendered pitch black in game, as Mantis did on its first test. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla.
- **Not checked in game yet.** It was checked offline only:
  - every model, material and texture in the pack parses with Penumbra and Lumina, and everything a file names is shipped (`tools/validate_pmp.py`: ALL OK)
  - Penumbra's own reader loads all 95 EQP and EQDP entries
  - the built models, read back and posed, deform correctly (`work/preview/mdl_*`)
  - in the game's shaders (PMP Viewer, game idle and /cpose stances): the neck covered with the wearer's face on and off, no fringe shadow, natural fingers (`work/gs`)
- How much of the wearer's own face shows past her (`tools/showthrough.py`, share of the face's silhouette over 36 views, bind pose; ears and Au Ra horns are hidden by the head piece's EQP):
  - 0.07-0.23% for Midlander, Highlander, Elezen men, Miqo'te, Au Ra, Viera and Lalafell: thin slivers under the jaw, seen from above
  - 1.8% for Elezen women and 1.7% for Roegadyn women: their long throats, under her chin, seen from below. In the game's shaders the Elezen side view is clean.
  - 1.5% for Roegadyn men and 0.5% for Hrothgar men: small slivers behind the ear, next to her hair
  - Use the face hider if yours shows.
- Her neck is now as wide as her jaw, as FFXIV necks are, so it covers the wearer's own. The source's anime neck is slimmer.
- Her face is static: no blinking, mouth movement or expressions.
- Her hair has no physics. Below the shoulders it follows the upper back, so it doesn't swing with every turn of the head, and arms swung back pass through it.
- Her arms are stretched about 40% along their length to reach the FFXIV elbows and wrists, so they're slimmer than in the source.
- Her fingers are fused together near the knuckles in the source mesh. The webbing stretches a little when they curl, and her thumb opens from the index finger on a stretched web.
- The Roegadyn man and the Lalafell have very different proportions from hers: the Roegadyn fit has a long torso and shorter legs, the Lalafell one short legs and a big head.
- Everyone in this mod's collection who wears the Magitek set looks like Asuka.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy and Pillow, plus the portable Blender in `../Aerith/apps`). Use `--from <step>` to start partway. Steps:
1. `src`, `labels`, `joints`: the GLB in game axes (Tripo writes its UVs v-up: sample image rows at 1 - v), its regions and her joints
2. `bake`: game mesh, UVs and baked textures (Blender, about 1.5 minutes)
3. `prep_refs`: the FFXIV skeletons, racial deformer and vanilla models
4. `fit`: per race in `PROFILES`
5. `textures`, `materials`, `build`: the game files
6. `pack`, `glamourer_design`, `validate_pmp`, `render_preview`: the `.pmp`, the Glamourer designs, the file and manipulation check, and `out/preview.png`
7. `build_outfit`, `pack_outfit`, `validate_outfit`: the plugsuit-only mod (last, because `build_outfit` points the build module at `work/build_outfit`)

Checks:
- `look_src.py [views] [cx,cy,cz,size] [grid]`, `labels.py render`, `joints.py render`, `check_bake.py`: the source, its regions and joints, and the baked game mesh (`work/look`)
- `check_fit.py <race> [other races]`: the fit over the FFXIV body and face, and in idle and run poses (`work/preview`)
- `tune_head.py <race> [heads] [eye_dz] [eye_dy]`: grid search of the head placement
- `showthrough.py <fit race> [race[:face] ...]`: how much of the wearer's own face shows past her, from 36 views (flat-colour renders; `work/preview/show_*.png`). `poke_area.py` (rays from the head centre) misses the neck behind her jaw, because its rays run on into her hair.
- `collar_check.py [race ...]`: the plugsuit's wrapped collar against each race's own neck (share of neck points poking out, mean and extreme gap)
- `check_mdl.py <race>`: the built `.mdl` and `.tex` files read back, plus one colour per gear slot
- `gs_render.py <out.png> [--cam head|full] [--env default|neutral] [--swap <game path>=<file>]`: the built pack in the game's shaders at bind pose (the PMP Viewer's xivrender). `gloss_ab.py` uses it to compare `_mask` gloss levels without repacking. For game poses and the face on/off show-through test, use the PMP Viewer page (restart its server after each rebuild, because it caches files by game path).

Tools: SailorMoon's unrigged-sculpt pipeline (labels, joints, bake, fit) with NursePool's build, pack and `pbd.py` (the fixed race parents), plus Peni Parker's neck cover and show-through test.

Asuka Langley and Evangelion belong to khara / Studio Gainax. The model is Alina Ricci's, CC BY 4.0. Fan port, not affiliated with either.
