# Aerith Gainsborough (FF7 Remake) → FFXIV

`Aerith Gainsborough (FF7R).pmp` (v1.8.0) is a Penumbra mod. It turns the **Spring Dress** set (e0141) into Aerith's outfit from FF7 Remake Intergrade. The outfit is fitted to the female Midlander skeleton and Bibo+ (Medium).

| Item | Shows |
|---|---|
| Spring Straw Hat | Aerith's chestnut hair, braid and pink ribbon. Hides your hairstyle. The **Head** option can keep your own hair instead. |
| Spring Dress | Pink A-line dress, red jacket, choker |
| Coronal Wristband | Her bracelets, with bare Bibo+ hands |
| Spring Skirt | Bare Bibo+ legs |
| Spring Dress Shoes | Her boots |

**Face** option (off by default): **Aerith's face** puts her own face, with her green eyes, lashes and mouth, on Midlander women. It is rigged to the face bones, so blinking, talking and expressions work, and it takes your skin colour. While it's on, it replaces faces 1 to 5 of **every** Midlander woman you see, not just yours, because Penumbra can't tie a face to one item. Other races keep their own faces.

## Use it
1. In Penumbra, use **Import Mod** (or drag the `.pmp` onto the mod list). Then enable it in your collection.
2. Put on all five Spring pieces. The quickest way is a Glamourer design. `Aerith - Glamourer import code.txt` has two codes; copy one, then use **Import design from clipboard** in Glamourer's Designs tab.
   - **Outfit only** equips the set, gives Aerith's green eyes and turns the mod on with your own face. It leaves your face, body and hair colour alone.
   - **With her face** also turns on the Face option and makes the character a Midlander woman, the only race her face is built for.
3. If anything doesn't change, run `/penumbra redraw`.

**Requires:** Bibo+ for the skin materials, which you already have. The PMP Viewer now takes them from your Penumbra collection, so the arms and legs show there too.

**Races:** Midlander uses its own model. Highlander, Elezen, Miqo'te, Roegadyn, Au Ra, Hrothgar and Viera women get the same model through their racial deformers. The viewer's All races check shows all of them served; Miqo'te ears and tail stay visible.

## Versions
- **1.8.0:** brighter colours, Neon 1.2.0's colour lift. The user, on seeing Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for". `tools/build_textures.py` (`LIFT`, `lift()`, `lift_diffuse()`) raises each legacy diffuse's luminance by a gamma (dark and mid tones most, hue kept), then multiplies saturation by 1.2 in linear light. The gamma is 1.4, except 1.2 on the hair and scalp cap: at 1.4 her chestnut lightened to a tan close to the golden blonde 1.1.0 moved away from (`work/lift/hair_backoff.png`: 1.7.1, 1.2, 1.4; `work/lift/rejected_hair_1.4_1.2/`). It touches the `_d` maps of the dress (A), the jacket, boots and ribbon (B), the hair (H), the scalp cap (S), and the Face option's eyes and mouth. Left alone: her face skin (`skin.shpk`, which takes your skin colour), the lash cards, your Bibo+ skin, and every `_n`, `_s` (grey specular colour) and `_id` map; texconv keeps `-sepalpha`. In GS (Midlander woman with her face, idle) the outfit is brighter and richer, most visibly the jacket (crimson to a clearer red, with its texture kept), the boots and the hair (a warmer, lighter brown); the whole figure's average brightness rises 3% by day and in dim light and saturation 0.27 to 0.30, since the dress is already near white and the Bibo+ skin is untouched (`work/lift/cmp_lift.png`: 1.7.1 and 1.8.0 by day, then in dim light). To tune it, change `LIFT`, then run `tools/build_textures.py` and `tools/build_mod.py` (its face step moves the face textures into the Face option; `build_mod.py package` alone would put them in the default files).
- **1.7.1:** fixes the face sometimes being invisible until you swapped faces. The game puts your character's face number into a face model's material path, in both the folder and the file name: on face 5 it asks for `face/f0005/material/mt_c0201f0005_aerith_fac.mtrl`. Only face 1's copies shipped, so on faces 2 to 5 Penumbra logged "Failed to asynchronously load resource" and the face drew nothing. The four face materials now ship for every face, 1 to 5.
- **1.7.0:** the real causes of the grey face with brown or salmon patches seen in game since 1.2.0. These were found by rendering the mod with the game's own shaders (the PMP Viewer's GS renderer) at several camera distances and comparing against the FF7R model:
  - **Broken face normal map mips (the main one):** the face normal map's alpha is the lipstick area, 0 everywhere. When building the smaller mip levels, texconv weighted the colour by that alpha, so every mip from 512 px down was all zero. At normal camera distance the game reads those mips, so the face lost your skin colour (it reads the normal map's blue as the skin-tone mask) and its normals. That gave a grey face, with skin-coloured patches only where the full-size level was used. The mips are now built with alpha kept separate (`-sepalpha`).
  - **Scalp cap over the face:** the painted-hair cap that hides bare scalp under the parting also took in her brows, eyelid lines, nostrils and lip line, because the fringe hangs over them. Those patches sat a millimetre off her face and fought it for depth. The cap now covers only the scalp above the hairline.
  - **Hair shadows:** the hair model no longer casts shadows (model flag `ShadowDisabled`), so the fringe doesn't dapple her face.
  - **Skin detail restored:** 1.5.0 had flattened her skin texture and 1.6.0 changed the face mask, both aimed at the wrong cause. Her FF7R blush, eye shading and skin detail are back; next to the original model in GS this matches best.
- **1.6.0:** set the face mask's red and blue channels to vanilla's constants, on the theory that red picks the skin material. That was wrong: the game's skin shader uses red as specular strength. The change is harmless, but it didn't fix the grey face (see 1.7.0).
- **1.5.0:** flattened her skin texture and normal detail, blaming them for brown smudges seen in game. That was the wrong cause (see 1.7.0), and 1.7.0 restores both.
- **1.4.0** (after the in-game look at 1.3.0, "really close"):
  - **Patchy light on the face:** FF7R's roughness map makes her T-zone much glossier than a vanilla face, which showed as bright patches on the forehead, nose and under the eyes. Her face's specular and roughness now sit near vanilla's even values and keep a quarter of FF7R's variation (glossier lips, rougher ears and hairline).
  - **Blotchy neck:** below the jaw her face mesh takes the FFXIV neck's shape, but FF7R's neck normals and colour don't fit it. That part of the face texture now has flat normals and the body's skin tone, so it runs smoothly into your neck.
  - **A little brighter:** hair 12% lighter, face 6% lighter.
- **1.3.0** (after the first in-game look at 1.2.0):
  - **Green sheen on the hair:** the game reads a legacy material's specular map as a specular *colour* (every vanilla one is grey). Earlier versions put gloss in its green channel, so highlights came out green: strong on the glossy hair, faint on the clothes. The specular map is now grey, and gloss moves to the colour table: each material blends a glossy row (shininess 32) and a matte one (3) per pixel through its own `_id` map, following FF7R's roughness. The eyes, mouth and lashes had the same green tint and are fixed too.
  - **Hazy face:** on skin, vertex colour red scales the normal map by the character's muscle tone (the game's skin shader does `normal.xy x (1 + red x (muscle - 1))`). It's 0 on every vanilla face, but her face had 1, so a muscular character's settings exaggerated her face's bumps. It's now 0.
- **1.2.0:**
  - **Face option:** Aerith's FF7R face for Midlander women (see above).
  - **Arms and knees:** the gloves and boots copied the Emperor's New set's EQP, which hides Bibo+'s elbow-to-forearm skin (`atr_ude`) and knee skin (`atr_hiz`). That left bare gaps between the jacket sleeves and the bracelets, and under the skirt at the knees. Her gloves and boots now hide no body skin.
  - **Glamourer:** a second design that also puts on her face.
- **1.1.0** (checked in the PMP Viewer against the FF7R model):
  - **Hair colour:** FF7R's hair texture is a pale grey-tan that the game's hair shader tints, so 1.0 came out golden blonde. Hair is now tinted to Aerith's chestnut brown.
  - **Scalp:** FF7R paints hair onto the scalp under the strands. That painted scalp is now cut from her head texture and wrapped just above your skull (not your ears), so no bare skin shows between the strands.
  - **Skirt:** fitted over Bibo+, the skirt clung to the hips and bottom. It now falls straight from the fullest point, as FF7R's A-line skirt does, keeping its own folds. The skirt's inner lining now moves with the outer skirt, where its edge had poked out as a step round the hips.
  - **Gloss:** added FF7R's roughness to the specular map's green. That turned out to be wrong; the game reads that map as a colour (see 1.3.0).
- **1.0.1:** fixes vertex colour set 0 on the legs model's skin (Spring Skirt), which 1.0.0 wrote black. `character.shpk` multiplies the surface by it, so the bare legs would have rendered pitch black in game, as the Mantis port did. The Bibo+ legs model carries a second, all-black colour set, and the reference export read that one. It now reads set 0 only, so the skin keeps Bibo+'s own set 0, and Aerith's own meshes are white. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla.
- **1.0.0:** first release.

1.2.0 was the first version seen in game: the face option worked, but the face looked flat and hazy and the hair had a green sheen, which 1.3.0 fixes. 1.3.0 was seen in game: the hair was right and the face "really close", with patchy light on the face and a little dark overall, which 1.4.0 fixes. 1.4.0 looked worse in daylight: brown smudges on the face, which 1.5.0 fixes. 1.6.0 still showed the grey face in game; 1.7.0 fixes its real causes. 1.7.0 looked right in game, but on faces other than face 1 the face was invisible until a face swap, which 1.7.1 fixes. 1.7.1 and 1.8.0 haven't been checked in game yet.

## Known limits
- Big leg movements, like high kicks or some sitting poses, can push a knee through the long skirt. Most long FFXIV dresses do the same.
- The braid follows your head, neck and upper back. It has no hair physics.
- Her face is built for Midlander women only. It replaces faces 1 to 5 for everyone while it's on.
- Her face has no lipstick, face paint or facial-feature options (moles, scars and so on), and the face sliders for eye shape, nose and jaw don't change it.

## Rebuild
```bash
python -P -E tools/prep_refs.py
apps/blender-4.5.14-windows-x64/blender.exe -b --factory-startup -P tools/blender/import_aerith.py
apps/blender-4.5.14-windows-x64/blender.exe -b --factory-startup -P tools/blender/fit_aerith.py
apps/blender-4.5.14-windows-x64/blender.exe -b --factory-startup -P tools/blender/export_slots.py
apps/blender-4.5.14-windows-x64/blender.exe -b --factory-startup -P tools/blender/build_face.py -- c0201
python -P -E tools/build_textures.py   # after build_face: the face textures read its neck from work/export
python -P -E tools/build_mod.py
python -P -E tools/validate_pmp.py "out/Aerith Gainsborough (FF7R).pmp"
python -P -E tools/glamourer_design.py
```
The fit's knobs are at the top of `tools/blender/fit_aerith.py` (head pad, skirt band) and in its `drape()` and `scalp_cap()`. Hair and scalp colours are `HAIR_MEAN` and `SCALP_MEAN` in `tools/build_textures.py`; specular strength is `spec` in its `build()`, and the glossy/matte shininess pair is `SHININESS` in `tools/build_mod.py`. The face's feature alignment is `NUDGE` in `tools/blender/build_face.py`, and its skin is `build_face_skin()` in `tools/build_textures.py` (`SKIN_EVEN` and `NORMAL_DETAIL` set how much of FF7R's skin shading and bumpiness stays; both 1). To add a race, put its face IDs in `FACE_IDS` (`tools/prep_refs.py`) and `FACE_RACES` (`tools/build_mod.py`), then run `build_face.py -- <race>`.

Personal use only. The original assets belong to Square Enix.
