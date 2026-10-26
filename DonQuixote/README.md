# Don Quixote (Limbus Company): FFXIV full body mod

`DonQuixote.pmp` is a Penumbra mod that turns a **Hyur Midlander female** into Don Quixote.

Model: "Don Quixote V2 - Limbus Company" by **Glayer3d**, CC BY 4.0
(https://sketchfab.com/3d-models/don-quixote-v2-limbus-company-e9e6918c3c2c446aa08b433115c46524).
Credit them if you share this.

## Using it

1. In Penumbra, click **Import Mod** and pick `DonQuixote.pmp`, then enable it in your collection.
2. Wear the full **Taoist's** set: Cap, Shirt, Gloves, Slops and Shoes. Glamourer can apply it without owning it.
   - The Shirt carries the whole model.
   - The other four pieces are blanked.
   - The Cap hides your hair.
3. If your own face shows through hers, enable **Hide your own face**. It blanks Midlander female faces 1-5 for
   everyone in that collection, so use it in a collection assigned only to your character.

## Outfit for Viera male: `DonQuixote_Outfit_VieraMale.pmp`

This is a separate mod with only her clothes (coat, shirt, tie, trousers, boots), refitted to the Viera male
skeleton. His own head, ears, hair and hands stay.

1. Import it and enable it like the full-body mod. The two mods can both be enabled at once.
2. On him, wear the Taoist's **Shirt, Slops and Shoes**.
   - The Shirt carries the whole outfit.
   - The Slops and Shoes are blanked.
   - Gloves and hat are up to you, but skip the Taoist's Cap if the full-body mod is also on, because it hides hair.
3. It only affects Viera males. Viera males normally borrow Midlander male models, so the mod adds EQDP entries
   that make the game load its own Viera male files for this set.
4. Glamourer automation applies your "Mister Wonderful" design (a Midlander woman) to Mormonftp Aihara on both
   worlds. Turn that off or apply the "Mormonftp Aihara" design (your Viera man) first, or you won't see the outfit.

## 1.3.0 / outfit 1.2.0 (Oct 25): running without clipping

You asked why her butt clipped through the coat when running (your screenshot: a dark patch across the back of the
coat). GS reproduced it with the game's own run animation; `work/compare_run_1.2.0_vs_1.3.0.png` shows before
and after.

- **Butt:** her rig had her trousers' butt 84% on the thighs, so it swung back through the coat each stride.
  Vanilla legs (`c0201e0000_dwn`) weight the butt to the hip bone (`j_kosi`) above the hip joint and blend to the
  thighs only below the buttock crease. Her butt now does the same.
- **Coat:** it is weighted by position, like the vanilla Taoist's robe:
  - front, side or back skirt chain by where a vertex sits around the hips, between the game's own `j_sk_*_a`
    joints;
  - `a`/`b`/`c` by height along the game's skirt joints.

  Her coat chains bent 5-11 cm away from the game's skirt joints, and the shell and red lining split their weight
  between panels differently. So the front flaps folded into the legs, and the lining showed through the shell.
- **Lining:** the red lining copies the weights of the nearest point on the outer shell, so the two layers move
  together.
- **One-sided clothes:** the clothes material is now one-sided, like vanilla gear. Two-sided, it drew the inside of
  the coat shell (mirrored "DON QUIXOTE" lettering) through small gaps in the lining when the tails flipped.
- Checked in GS: running from behind, the side and rear three-quarter, walking, and idle front and back; the Viera
  outfit running. `check_pmp.py` reports 0 errors on all races for both packs.

## 1.2.0 / outfit 1.1.0 (Oct 25): brighter colours (Neon's lift)

The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im
looking for".

- `scripts/colour_textures.py` (`LIFT`, `lift()`) now builds her `characterlegacy` colour maps from the source PNGs
  and lifts them: luminance gamma 1.4 (dark and mid tones most, hue kept), then saturation x1.2 in linear light.
  - Body atlas (`donq_body_d`, and `donq_c1701_body_d` in the Viera male outfit): gamma 1.4, saturation 1.2.
  - Hair (`donq_hair_d`): gamma 1.4, saturation 1.0. It's already a saturated yellow, and at 1.2 it went lemon in GS.
- Unchanged: her face, neck and hand skin (`skin.shpk`, tinted by your skin colour), and the normal, specular and
  `_id` maps. Models and materials are byte-identical to the previous packs.
- In GS her average brightness rises about 33% by day and in dim light (the outfit on a Viera man about 35%), with
  nothing clipped to white. Before/after (old and new, day then dim): `work/lift/cmp_lift.png` (full body) and
  `work/lift/cmp_lift_outfit.png` (Viera male outfit).

## 1.1.0 (Oct 24): skin and hands

Your 1.0.0 screenshot showed her face, neck and hands flat grey-white, a brown-grey band down the neck, and odd
hands. The PMP Viewer's game shaders (GS) reproduced all three.

- **Skin:** her face, neck and hand skin now use the game's own skin shader (`skin.shpk`, cloned from the vanilla
  Midlander female body material), so they shade like FFXIV skin and take your character's skin colour.
  - Her anime texture painted the neck in a dark shadow tone, which was the brown band. It's now lifted to her
    face's tone.
  - The skin is recoloured to the vanilla skin albedo, 10% lighter. Lash lines, eye whites, irises and the mouth
    keep their colours, untinted. In GS her cheeks measure RGB 174/121/99, against 176/126/105 on your own face.
  - Each UV island's colour is bled into the empty texels around it, and island edges get the full recolour.
    Otherwise the neck's mirrored centre seam showed as a thin pale line, which was in the texture only (GS
    normals and lighting were smooth there).
- **Hands:** each finger and the thumb is now a rigid piece rooted on FFXIV's knuckle and aimed along FFXIV's
  finger, scaled with the palm instead of stretched. Finger weights are split by position along the game's finger.
  In 1.0.0 the fingers bent away from the game's joints and crumpled in the idle pose.
- **Arms:** sleeve weights are shared with the game's shoulder, elbow and wrist twist helpers, like vanilla gear.
- `xivtool mdlcolors` confirms vertex colour (0, 1, 1, 1) on the skin meshes and white on the gear meshes.

## Limits

- Her face is rigid: no blinking, lip sync or emote expressions, because the FFXIV face rig isn't used.
- Her hair is fixed to the head with no physics. The coat uses FFXIV's skirt bones, so it moves with her legs.
- Her arms were stretched slightly so the joints match FFXIV's skeleton.
- Women of every race except Lalafell borrow Midlander female models for this set. Any woman wearing the Taoist's
  set looks like her on your screen, deformed to her race (`check_pmp.py` "All races").
- Anyone who sees your mods through a sync plugin sees her too.
- In GS your own face shows through hers, because the viewer doesn't apply the Cap's hide-hair-and-scalp rule to
  the face. In game it is hidden (your 1.0.0 screenshot shows only her face).

## Rebuilding

All of this runs offline, and the game folder is only read, never written.

| Step | What it does |
| --- | --- |
| `tools/xivtool` | A .NET 10 console app. It reads game files through Lumina and uses Penumbra 1.7.2.1's own glTF importer and material writer (it references the installed plugin DLLs). |
| `scripts/hkx_skeleton.py` | Turns the c0201 skeleton (sklb, then TexTools' `NotAssetCc.exe`, then XML) into `work/c0201_skeleton.json`. |
| `scripts/convert.py` | Blender: scales the model to FFXIV size, refits her arms and hands onto the game joints, renames the bone weights (fingers, coat and butt geometrically, lining from the shell), and exports `work/don_nohat.glb`. Pass `--hat` to keep her hat. |
| `scripts/make_empty.py` | Builds the one-triangle placeholder used to blank gear slots and faces. |
| `xivtool import` / `xivtool mtrl` / `xivtool mtrlskin` | Builds the `.mdl` and `.mtrl` files (gear materials from vanilla `e0001` top_a, skin from vanilla `mt_c0201b0001_a`). Pass `one-sided` to `mtrl` for the clothes (`top_a`); `xivtool mtrlflags` sets it on an existing material. `scripts/tex_tools.py` builds the `.tex` files from texconv BC7 DDS. |
| `scripts/colour_textures.py` | Builds her `characterlegacy` colour maps (body atlas for both packs, hair) from the source PNGs at 2048 px, with Neon's colour lift (`LIFT`, `lift()`), through texconv BC7 `-sepalpha` and `tex_tools.py`. |
| `scripts/skin_textures.py` | Builds the skin `_base` / `_norm` sets for the face and hands from the UV tags `convert.py` writes (`work/don_nohat_uvcats.json`). It uses texconv `-sepalpha`. |
| `PmpViewer/tools/gs_render.py`, `check_pmp.py` | GS renders (e.g. `--design` your Glamourer file, `--pose idle`, `--cam head`) and the viewer's checks, run on the finished `.pmp`. |
| `scripts/package.py` | Writes the Penumbra JSON files and zips the mod. Use `fullbody` for `mod/` and `DonQuixote.pmp`, or `outfit_c1701` for `mod_c1701/` and `DonQuixote_Outfit_VieraMale.pmp`. |

For the Viera male outfit:

- Run `convert.py ... work/c1701_skeleton.json work --outfit --name don_outfit_c1701`. Outfit mode drops her
  head, hair, hat and hands, matches her torso height to his, refits legs and arms onto his joints, and lowers her
  boot soles onto the floor.
- `xivtool obj <game path> <out.obj> 1701 101` exports a Midlander male model the way it looks on a Viera male, by
  applying the game's racial deformer.
- `scripts/ref_scene.py` puts those references next to the outfit for preview renders.
