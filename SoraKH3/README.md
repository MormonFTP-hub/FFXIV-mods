# Sora (Kingdom Hearts III) for FFXIV

Penumbra mod: `out/Sora_KH3.pmp` (2.0.0). Sora from a KH3 rip (`source/`), as a full-body costume for **every race and gender**: his head rides in the hat slot.

Previews from the PMP Viewer's game-shader renderer (GS), in the game's own idle:
- `out/preview_races.png`: Midlander man and woman, Roegadyn man, Lalafell, Miqo'te, Au Ra and Viera women, Hrothgar man
- `out/preview_heads.png`: head close-ups, front and side, on Au Ra, Hrothgar, Miqo'te and Viera
- older: `compare_source_vs_gs.png` (1.0.0 / source / 1.1.0), `compare_1.1.1_vs_1.2.0_*.png`, `gs_facepaint.png` (1.1.1)

## Install and wear
1. In Penumbra, delete the old Sora mod (1.x replaced the Hyuran set and Midlander male face 1 / hairstyle 1), then **Import Mod** and pick the `.pmp`, and enable it in a collection used only by your character.
2. Apply the Glamourer design: copy the code from `out/Sora - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It puts on the Air Cell set with the hood shown and turns the mod on. It changes nothing else about your character (race, face, hair and skin stay yours, hidden under Sora).
3. If anything doesn't change, run `/penumbra redraw`.

| Item (Air Cell set, `e0907`; all classes, level 1) | Becomes |
|---|---|
| Air Cell Hood | His head: face, blue eyes and spiky hair. It hides your hair and ears. |
| Air Cell Jacket | Jacket, shirt, hood, crown necklace, arms |
| Air Cell Armlets | His hands and fingerless gloves |
| Air Cell Halfslops | Belt, pockets, baggy shorts |
| Air Cell Shoes | His big shoes |

**Races:** every race and gender.
- Fitted to the Midlander man, the Midlander woman, the Roegadyn man and the Lalafell; every other race is reshaped from those by the game's racial deformer (EQDP entries in the mod; Hrothgar men from the Roegadyn fit, Lalafell women from the Lalafell's).
- Lalafell get a little Sora with a big head.
- Your own tail (Miqo'te, Au Ra, Hrothgar) and Viera ears are hidden while the set is on.

**Option:** **Hide your own face** (off by default) blanks every player face model. You shouldn't need it (see the limits); turn it on only if your face shows, and only in a collection used by your character alone.

## What 2.0.0 changed (user on 1.3.0 in game: "maybe sat clothes a little more? face and skin good hair too. i dont want it only on male hyur though want it on everything. head looks a little big to me")
- **Every race and gender.** 1.x replaced the Hyuran set and Midlander male face 1 / hairstyle 1, so it only worked on a Midlander man with that face and hair. 2.0.0 is built like the Mina and White Fox ports:
  - his head (face, eyes, hair) is the hat model of the Air Cell set; the hat's EQP (the vanilla Moogle Head's) hides your hair and ears, and your own face stays inside his head
  - the body is fitted to four base skeletons (`tools/convert_model.py` `PROFILES`, the same KH3 retarget per race)
  - tails are hidden by the jacket's EQP
- **His head is 10% smaller** (0.9× 1.3.0's size, against the body). It can't shrink further without your own face showing: at 0.85 the back of a Midlander man's skull shows from behind and above (1.5–2.5%). His head sits on your eyes, 7.5 mm in front (his flat anime face otherwise lets your brow and nose through). Measured with `tools/showthrough.py` (36 views round the head):
  - Midlander man (0.9): 0.25%
  - Midlander woman (0.9): 0.4–1.0%, the back of the skull from behind and above
  - Roegadyn man (1.035, 2 cm forward; at 0.9 their big jaw came through, 6–7%): 0.48%
  - Lalafell (1.85, 1.5 cm forward): 0.24%
- **Clothes are more saturated:** the colour lift's saturation goes from 1.2 to 1.35 (gamma 1.4 as before) on the jacket, trousers, shoes, metal bits and gloves.
- **His skin keeps its own colour on every race.** The tint your design's skin colour gave him in 1.2.0–1.3.0 (Midlander man swatch 1) is baked into his skin textures and the shader's skin tint is off, so face and skin look as you approved them whatever your character's skin colour.
- The PMP Viewer's checks: no problems, every race resolves all five pieces from the mod (own fit or reshaped), hair, tails and Viera ears hidden, and Penumbra loads all 95 manipulations (`tools/viewer_check.py`).

## What 1.3.0 changed (brighter colours, Neon's lift)
The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/make_textures.py` (`LIFT`, `lift()`) lifts the colour maps of gear sets A, B and C, the eye atlas's iris, eye-white and mouth cells, and the hair `_d`: luminance gamma 1.4 (dark and mid tones most, hue kept), then saturation x1.2 in linear light.
- The hair is backed off to gamma 1.2 and saturation 1.0: at 1.4 / 1.2 his chestnut turned ginger-orange in GS.
- Unchanged: the skin sets (`skin.shpk`, tinted by your skin colour; still made from the unlifted maps), the lash cell (alpha only), and every normal, mask, `_s` and `_id` map. Materials are byte-identical to 1.2.0, so the decal key stays off.
- In GS his average brightness rises about 21% by day and in dim light, with nothing clipped to white. Before/after (1.2.0 and 1.3.0, day then dim): `work/lift/cmp_lift.png`.

## What 1.2.0 changed (Sora "kinda looks funky" next to Aerith)
Compared in GS against vanilla characters and the Aerith port, which looks right in game. The difference is the shaders:
- **Aerith's face is on the game's own skin shader (`skin.shpk`) and her clothes and hair on `characterlegacy.shpk`. Sora's face, arms, legs and hair were all on the gear shader (`character.shpk`).**
- In sunlight they look alike. With the sun behind him (shade), vanilla skin keeps its warmth, but Sora's gear-shader skin went grey-tan and dim. His hair read as matte clay with bright white streaks.

1.2.0:
- **His skin is `skin.shpk`**: the face (cloned from the vanilla Midlander male face material) and his neck, arms and legs (cloned from the vanilla body material, as their own material `_s` on each gear piece). The game multiplies `skin.shpk` colour by your character's skin colour, so his skin texels are rescaled to the vanilla face albedo. His features keep their own colour, and the design sets a light peach. The skin meshes have vertex colour (0, 1, 1, 1), as vanilla faces and hands do.
- **His hair is `characterlegacy.shpk`**, Aerith's recipe: a grey specular map and colour-table rows with shininess 32 and 3, blended by `_id`. It's warm chestnut, with no white streaks, sun or shade.
- **The design sets skin swatch 1 and no face paint.** Your skin colour now tints Sora; change it in Glamourer if you want him tanned.
- Tested and dropped: hair on the game's own `hair.shpk` washed his chestnut out to grey-taupe whatever hair colour was set; clothes on the legacy shader looked the same as on `character.shpk`.

## What 1.1.1 changed (dark face in game)
In game, 1.1.0's face, eyes and hair came out dark grey-brown (Oct 24 screenshot: face about RGB 40/34/30).

The cause was reproduced in GS (`out/gs_facepaint.png` is the fix):
- Your Glamourer design ("Mister Wonderful") keeps **face paint 3 in black at 93%** under the Sora design.
- In the face slot, the game binds the character's face paint as the model's decal.
- Sora's materials were cloned from a vanilla *body* material, whose `character.shpk` decal key (`0xD2777173`) is on (`0xF35F5131`, for Free Company crests).
- Face paints are single-channel BC4 masks, so their alpha reads 1 everywhere, and `character.shpk` laid the paint colour over the whole face and eyes.

1.1.1 sets the key to vanilla's no-decal value (`0x4242B842`, the value hands, legs and feet use) on every material. Face paint, skin, hair and eye colour from your character no longer change Sora. The hair was darker mostly from the scene's light; its material now also ignores any decal.

`gs_render.py --decal <face paint .tex> --decal-color r,g,b,a --skin/--hair/--eye r,g,b` renders with a character's own face paint and colours.

## What 1.1.0 changed (from comparing the source with GS)
- **1.0.0 shipped the vanilla models as placeholders** and needed six manual glTF imports in game. Without them you got the Hyuran tunic, face and hair wearing Sora's textures. 1.1.0 ships the real `.mdl` files, built offline with Penumbra's own importer (`apps/xivtool import`).
- **The face is down to 2 materials** (it named 5; Penumbra allows 4). Iris, eye whites, lashes and mouth now share a 2×2 atlas (`tools/atlas.py`).
- **The buttons, zipper, buckle, chain and crown are no longer metal.** A metal colour-table row rendered them near-black in GS. They now use a glossier, non-metal row, and read silver and pale gold as in the source.
- **The hair casts no sun shadow** (model flag ShadowDisabled). The fringe had striped his eyes and face.
- **Torso weights are spread over the pelvis and spine by height.** KH3 hangs the jacket front and hem on its own chain and the belt on the pelvis. At the game's idle pose, the jacket lining poked through the lapels and the belt strap slid over the jacket's hem.
- **Fingers start on FFXIV's knuckles** (they were 1–2 cm off) and reach its middle joints, so they curl cleanly at idle.
- **Hair is 10% darker and slightly less saturated**, to match the source in GS (median RGB 119/88/60 vs 117/85/58).
- **`_id` green is 255**, so it picks the colour-table pair's first row.

## Known limits
- 2.0.0 is not checked in game yet.
- Show-through was measured on the four fitted races' own faces only. The reshaped races (Miqo'te, Au Ra, Viera, Elezen, Highlander, Hrothgar) look clean in GS close-ups, but weren't measured; Au Ra horns or a Hrothgar mane might poke out at some angles. Use **Hide your own face** if they do.
- The face is static: no blinking, expressions or lip movement. The hair has no physics, and its colour is baked in.
- His body is stretched onto each FFXIV skeleton (he's Hyur-sized on a Midlander, Roegadyn-sized on a Roegadyn).
- Dyes don't change anything.
- Everyone in this mod's collection who wears the Air Cell set looks like Sora.

## Rebuild
```
powershell -ExecutionPolicy Bypass -File build.ps1
```
This needs the game installed, Blender 5.2 (the Store build, run through `tools/run_blender.ps1`) and, for `showthrough.py`, the portable Blender 4.5 in `../Aerith/apps`.
1. `prep_faces.py`: every race's vanilla player faces (the parts the hat hides left out) and the fitted races' eye positions.
2. `convert_model.py`: reads the `.dae` and, per race in `PROFILES`, fits it to that skeleton, places and scales the head on the wearer's eyes, maps weights, splits the body into top / glv / dwn / sho by weight, puts the head in met, and exports glTF.
3. `import_models.py`: Penumbra's importer to `.mdl`, then vanilla flags and radius, the head's ShadowDisabled flag, the vertex colour and material checks, and White Fox's 211 face stand-ins.
4. `make_textures.py`: the PNGs to `.tex` (BC1/BC3), the `character.shpk` clothes and eye materials (cloned from vanilla `e0039`, all rows white, decal key off), the `skin.shpk` face and body-skin materials (vanilla c0101 face and body), and the `characterlegacy.shpk` hair (vanilla `e0001`). One file per material, mapped to every fitted race's name.
5. `package_mod.py`, `glamourer_design.py`: the `.pmp` (EQDP / EQP manipulations, the face-hider option) and the Glamourer design.

Checks:
- `showthrough.py <race> [faces] [--scale k --dy m --dz m]`: how much of the wearer's face shows past his head and jacket from 36 views; the options move the built head to search `PROFILES` without refitting.
- `viewer_check.py`: the PMP Viewer's own checks and "All races" table, from the command line.
- `../PmpViewer/tools/gs_render.py <pmp> <out.png> --race <race> --pose idle --cam front|head`: GS renders on any race, through the racial deformer.
- `gs_render.py` (Sora's own, 1.x): `--pose`, `--swap`, `--decal`.

Kingdom Hearts and Sora belong to Square Enix / Disney. Personal use only.
