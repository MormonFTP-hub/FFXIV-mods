# Gekko (VALORANT) for FFXIV

Penumbra mod: `out/Gekko (Valorant).pmp`. Preview: `out/preview.png`, rendered from the built mod files in an idle pose. Left to right: a Midlander man, a Roegadyn man, a Viera man, a Midlander woman and a Lalafell. `out/compare_source_vs_gs.png` sets the source next to the game shaders (1.0.1 and 1.2.0); `out/compare_colour_lift.png` shows 1.2.0's colour lift.

Ported from Gekko's character-select model in the [Kingdom Archives model viewer](https://kingdomarchives.com/modelviewer/gekko) (VALORANT, mesh `CS_AggroBot_S0`). It's a full-body costume: Gekko replaces your whole character, head included.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Alternative** set (all classes, level 1): Cap, Shirt, Leather Bracelets, Trousers and Spiked Shoes. The quickest way is the Glamourer design: copy the code from `out/Gekko - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the five gear slots, shows the hat and turns the mod on. Glamourer can put the set on without you owning it.
3. If anything doesn't change, run `/penumbra redraw`.

| Item (Alternative set, e6229) | Becomes |
|---|---|
| Alternative Cap | His head: face, lime hair, ear piercings and the neck. It hides your hair and ears. |
| Alternative Shirt | Green cable-knit vest, black T-shirt, cross-body bag with the blue lens, tattooed upper arms, fish tattoos on his neck |
| Alternative Leather Bracelets | Tattooed forearms and the purple fingerless gloves |
| Alternative Trousers | Plaid trousers with the rolled cuffs and the thigh pouch |
| Alternative Spiked Shoes | Socks and sneakers |

**Races:** every race and gender.
- **Men** get him on the Midlander man's frame. Elezen, Miqo'te, Au Ra and Viera men are reshaped from it by the game's racial deformer (EQDP entries in the mod make sure of that).
- **Highlander men** have their own fit (1.2.0): their necks are far thicker than the other men's, and covering them from the shared fit either flared every man's nape or, left out, showed their whole nape.
- **Roegadyn men** have their own fit: the deformer data from the Midlander man doesn't reproduce the Roegadyn skeleton (its arm entries scale 2.7×). **Hrothgar men** use the Roegadyn fit; the game's deform from Roegadyn to Hrothgar is close to identity.
- **Women** wear a slightly narrower Gekko fitted to the Midlander woman, reshaped the same way for the other female races.
- **Lalafell** (men and women) get a little Gekko with a big head.

Option group:
- **Hide your own face** (off by default): blanks every player face model. Turn it on only if your face shows through his head, and only in a collection used by your character alone.

## Changes
- **1.2.0: brighter colours, slimmer nape.**
  - **Colours:** the colour maps (main atlas and the baked tattoo set) get Neon 1.2.0's lift, which you asked for on every mod. Luminance (sRGB-encoded) goes to the power 1/1.4 with the hue kept, then saturation ×1.2 in linear light (`textures.py` `LIFT`). Normal, mask and `_id` maps are unchanged. `out/compare_colour_lift.png` sets the source next to 1.1.x and 1.2.0 in GS, by day and in neutral light.
  - **Highlander men get their own fit** (EQDP own, head 1.05 with the eyes 18 mm forward, from `tune_head.py`): left out of the shared neck cover, 9,461 px of their own nape showed in GS.
  - **Nape:** in game (1.1.1) the back of his neck flared out. The neck cover pushed it out to the thickest nape of any race on the fit (Roegadyn women 26 mm, Au Ra women 23, Highlander men 32, against Midlanders' 17–19). It also spread each cell's need up and down the neck twice, with `np.roll` wrapping the skull row onto the collar row, so under his hair the back of his neck stood 10–14 mm past even a Roegadyn woman's. Now the need spreads only round the neck, and Roegadyn and Au Ra women are left out of the women's neck cover: they keep a strip at the nape, which the face hider covers. His nape now sits 4–5 mm outside a Midlander woman's own neck, against 10–20 mm in 1.1.1. It can't be slimmer without her neck showing behind his: his own nape is 56 mm from the neck's axis, hers 59–77.
  - **Neck skinning:** his neck skin and T-shirt collar are now weighted the way vanilla faces weight their necks: the neck bone low down, some upper back at the base, the head near the jaw (Asuka's `neck_weights`). His own nape was mostly head weight. Where the racial deformer lengthens the neck (Elezen), it rode up with the head at idle and uncovered the wearer's nape: 2,669 px on Elezen women in GS, now 64. A few neck triangles now fall to the Cap, which has two materials.
- **1.1.1: clean jaw line.** In game (1.1.0) a dark crease ran along the underside of his jaw, with his neck wider than the jaw. The neck cover had pushed every woman's neck out up to 3 cm at the sides: in its measurements the Miqo'te and Au Ra faces' cheeks, jaws and irises sat out at the sides of the neck, because the face's own expression bones (`j_f_*`) weren't carried through the racial deformer. They now follow the head, which takes the women's side push from 30 mm to about 1 mm. The push also fades out on his jaw and skull (by his own head weight), so the jaw no longer steps out past the neck, and Hrothgar are left out of the neck cover as they are of the skull cover. On the Mister Wonderful design (Midlander woman, face 5) GS shows a clean jaw and none of the wearer's own face from eight angles.
- **1.1.0: fixed from comparing the source with the PMP Viewer's game shaders (GS).**
  - **Near-black outdoors (seen in game on 1.0.x).** The `_id` texture's green picks the colour-table row the wrong way round from what 1.0.x assumed: 255 is the first row, 0 the second. Writing green = metalness put 96–100% of every material on the metal row, and in game metal gets no diffuse light. `_id` green is now 255 − metalness.
  - **The real metal (buckles, clips, strap fittings)** is now a glossy non-metal row: a fully metal row rendered them near-black in GS, while the source shows them bright silver. The colour is already in the texture.
  - **Fingers.** They bent where his own finger joints were, 1–2 cm off FFXIV's (6 cm for the Roegadyn man's thumb), so the game's idle curl crumpled them into a lump. Each finger is now rigid, rooted on the FFXIV knuckle and aimed along the FFXIV finger, and bends where the game's fingers bend (from the Mantis and Peni Parker ports).
  - **The wearer's own neck showed behind his ear and at the nape.** The game's face model carries the neck down to the collar, and his is slimmer. His neck is now pushed out until it clears the neck of every player face of the races that wear each fit (mostly at the back: about 2 cm on men and women, 4.6 cm on Roegadyn men; Peni Parker's `cover_neck`). Beard cards are left out, and a wrap-around bug in that code, which left a strip down the middle of the nape uncovered, is fixed.
  - **The wearer's skull showed between the spikes of his short hair** (the crown of a Midlander woman, Highlander and Roegadyn women): the face model carries the whole skull, and the head flags only hide the hair, scalp and ears. His head is now pushed out where needed, measured by rays from the skull centre on each race through the game's racial deformer: up to 9 mm on women, 2 mm on men. Hrothgar skulls are left out: covering them would swell his head for every woman and Roegadyn man.
  - **His head casts no shadow.** In GS the hair shadowed itself in thin lines (a small square on top of his head) and darkened his brows, which the source doesn't show. Aerith and Asuka do the same.
  - The `character.shpk` decal (crest) key is off on every material, as vanilla hands, legs and feet have it. With it on, the game can lay the character's face paint over a material (Sora 1.1.0).
- **1.0.1: vertex colour set 0 is now white.** 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so the model would have rendered pitch black in game, as Mantis did on its first test. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla.
## Known limits
- **1.2.0 is not checked in game yet.** 1.1.0 and 1.1.1 were: the colours were right, 1.1.1 fixed the jaw crease, and 1.2.0 fixes the flared nape. It was checked offline only:
  - every model, material and texture in the pack parses with Penumbra and Lumina
  - every material and texture a file names is shipped
  - Penumbra's own reader loads all 95 manipulations
  - the built models, read back and posed, deform correctly (`work/preview/mdl_*`)
  - in GS, posed with the game's idle, he matches the source render (`out/compare_source_vs_gs.png`)
- How much of the wearer's own face shows past his head and neck in GS (`tools/gs_showthrough.py`): head close-ups at 500×500 from five angles round the back (sides, back three-quarters, back), standing idle, face 1. The figure is the worst view's count of pixels where hiding the face changes the albedo.

  | Race | Men | Women |
  |---|---|---|
  | Midlander | 27 | 0 with a vanilla face; with your collection, only your face mod's demon ears (about 1,800) |
  | Highlander | 675 (own fit since 1.2.0) | not measured in 1.2.0 (0 in 1.1.1) |
  | Elezen | 291 | 64 |
  | Miqo'te | not measured in 1.2.0 (0 in 1.1.1) | 0 |
  | Roegadyn | 1,744 (slivers at the hairline and under the jaw) | 517 (left out of the neck cover) |
  | Au Ra | horns stick out at the sides of his head | 1,162 at the nape (left out of the neck cover), plus the horns |
  | Hrothgar | 12,273 (the nape under his hair: left out of both covers) | not measured, likely the same |
  | Viera | 29 | 0 |
  | Lalafell | 397 | not measured (it wears the Lalafell man's fit) |

  1.0.x showed the back of the skull of Roegadyn women (up to 20,415 px), Highlander women (3,612) and Midlander women (2,969 with a vanilla face), and a strip down the middle of every nape. The **Hide your own face** option clears what's left, at the cost of every player face in that collection.
- His face is static: no blinking or lip movement. The hair is short and has no physics.
- His creatures (Wingman, Dizzy, Thrash, Mosh) aren't included.
- Materials are Dawntrail `character.shpk` with the rip's colour, normal (green flipped: the rip's map reads green-down, FFXIV's is green-up) and ORM maps. The viewer's eyelid shadow card (alpha blended) and the 20% black glass over the bag's lens were dropped. His skin stays on `character.shpk`: in GS with the sun behind him it keeps its hue and saturation (27°, 0.47 against 28°, 0.49 lit), unlike the lighter skin of Sora and Jotaro, which went grey.
- His neck is thicker than the source's at the back (the neck cover) and shorter (FFXIV's neck), so the fish tattoos on it are a little squatter.
- The tattoos are a decal layer in the rip (a copy of the arms drawn with a second texture on a second UV set). His arms share one mirrored UV layout, so the arms and neck get their own texture baked on the second UV set, with the tattoos and the normal map carried over.
- Everyone in this mod's collection who wears the Alternative set looks like Gekko.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy and Pillow, plus the portable Blender in `../Aerith/apps` for previews). Use `--from <step>` to start partway.
1. `fetch.py`: downloads `gekko_cs.glb` and its PNG textures from Kingdom Archives (the page's `MODEL_JSON` names them) to `source/`.
2. `export_src.py`: unpacks the glb into `work/src`: one merged mesh with its primitive index, the skeleton and the viewer's material recipes. glTF is already in FFXIV's axes.
3. `prep_refs.py`: pulls the FFXIV skeletons, the racial deformer file, faces and the Alternative set's models from the game (Lumina, through `apps/xivtool`).
4. `fit.py`: retargets him onto each race in `PROFILES` through his own skeleton (Riot's bone names, mapped by `ALIAS`):
   - torso: a height lattice through his ankles, knees, hips, shoulders and neck, with `shoulder` setting how much of his shoulder breadth he keeps
   - limbs: one affine per bone, rotated onto the FFXIV bone and stretched to its length
   - palms: stretched so his middle knuckle meets theirs; fingers rigid from the FFXIV knuckles, weight split where the FFXIV fingers bend
   - neck: pushed out until it covers the neck of every player face that wears the fit, except the races in `NECK_SKIP` (`cover_neck`, `COVER_RACES`), and skinned like the vanilla necks (`neck_weights`)
   - skull: hair and the skin behind his ears pushed out until they cover the skull of every player face but the Hrothgar's, by rays from the skull centre in each race's own shape (`cover_skull`)
   - sneakers: rigid, scaled by `foot`, sole on the floor and toes turned forward
   - head: rigid, scaled and placed so the wearer's face stays inside it (`tune_head.py` grid-searches it)
   - weights: every joint goes to its nearest mapped ancestor; twist, "Ndl" and sleeve helpers go to their limb, the bag and its straps to the spine. Spine weight is spread by height and arm weight is shared with the twist helpers the way the vanilla body does it.
5. `textures.py` and `materials.py`: Dawntrail `character.shpk` textures and materials for two sets: the main atlas, and the arms and neck baked onto their second UV set with the tattoo decal. The colour maps get `LIFT` (brighter, more saturated).
6. `build.py`: splits him into the five gear models per race by skin weight, two materials at most, and converts them with Penumbra's importer (`apps/xivtool import`). It copies the vanilla model flags and radius, turns the head's shadow off, and makes the empty face stand-ins.
7. `pack.py`, `glamourer_design.py`, `validate_pmp.py`, `render_preview.py`: the `.pmp`, the Glamourer design, the parse checks and `out/preview.png`.

Checks: `look_src.py` (the unpacked source), `check_fit.py <race>` (bind pose over the FFXIV body, face close-up, idle and run poses), `poke.py <fit race> [races]` (face show-through, rays from the head centre: misses the nape), `gs_showthrough.py [races]` (face show-through in GS, from five angles round the head), `check_mdl.py <race>` (round trip from the built `.mdl` and `.tex` files, plus the races the game deforms it to). Renders go to `work/preview/`.

`tools/pbd.py` is NursePool's racial-deformer reader (Hrothgar men derive from the Roegadyn man, Lalafell women from the Lalafell man; verified against the game skeletons).

Gekko and VALORANT belong to Riot Games. Fan port, personal use only.
