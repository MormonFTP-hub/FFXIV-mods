# Peni Parker – Floral Frights (Marvel Rivals) for FFXIV

Penumbra mod: `out/Peni Parker - Floral Frights (Marvel Rivals).pmp`. Preview: `out/preview.png`, rendered from the built mod files in an idle pose. Left to right: Peni on a Midlander woman, a Viera woman, an Au Ra woman, a Midlander man, a Roegadyn man and a Lalafell.

Ported from the psylocke.gg 3D viewer's assets for the Floral Frights skin (https://psylocke.gg/heroes/peni-parker/model?skin=floral-frights), downloaded to `source/cdn`. Only Peni herself is included. The SP//dr mech, its launchers and the spider drone are left out. This is a full-body costume: Peni replaces your whole character, head included.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Night of Devilry** set (all classes, level 1): Horns, Shirt, Fingerless Gloves, Trousers and Boots. The quickest way is the Glamourer design: copy the code from `out/Peni Parker - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the five gear slots, shows the hat and turns the mod on. Glamourer can put the set on without you owning it.
3. If anything doesn't change, run `/penumbra redraw`.

| Item | Becomes |
|---|---|
| Night of Devilry Horns | Peni's head: sugar-skull face paint, eyes, braids, the flower crown and the monarch butterfly. It hides your hair and ears. |
| Night of Devilry Shirt | The yellow dress top, shoulder ruffles, choker, pearls, sleeves to the elbow, and the little spider on her back |
| Night of Devilry Fingerless Gloves | Sleeves from the elbow down, the teal cuffs, her hands |
| Night of Devilry Trousers | The orange wrap skirt and the bone-print stockings |
| Night of Devilry Boots | Her shoes and the ankle ruffles |

**Races:** every race and gender.
- **Women** wear the Midlander woman fit. Every other race is reshaped from it by the game's racial deformer (EQDP entries in the mod make sure of that).
- **Men** get Peni on the Midlander man's broader frame, reshaped the same way for the other male races.
- **Roegadyn men** have their own fit, and **Hrothgar men** wear it. The game's deformer from the Midlander man doesn't reproduce a Roegadyn skeleton (vanilla gear always ships Roegadyn models), so through it her head came out misplaced, with 42% of the wearer's face showing. Their necks are much thicker than hers, so on this fit her choker is up to 5 cm thicker.
- **Lalafell** (men and women) get a little Peni with a big head.

Option groups:
- **Spider pack**: with the spider on her back (default) or without.
- **Hide your own face** (off by default): blanks every player face model. You shouldn't need it (see the table below). Turn it on only if yours shows, and only in a collection used by your character alone.

## Changes
**1.0.3** (Oct 25). Brighter colours, with Neon 1.2.0's colour lift. The user, on Neon 1.2.0: "YES EVERY MOD SHOULD BE
THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/textures.py` lifts every colour map (`LIFT`, `lift()`, in `maps()`): head, body, dress, the gear atlas
  (sleeves and crown, stockings and shoes), the baked hair, and the detail atlas (hair strokes with their teal and pink
  streaks, lashes, eyes; the strokes are lifted so they keep matching the lifted hair). Luminance is raised by a 1.4
  gamma, which lifts dark and mid tones most and keeps the hue, then saturation goes up 20% in linear light. Normal
  and mask maps and every alpha are unchanged. In GS (Midlander woman, idle) the figure's average luminance rises about
  27% by day and 28% in dim neutral light, and its saturation about 18%; the white face paint keeps its shading. Before
  and after, by day and in dim light: `work/lift/cmp_lift.png`. To tune it, change `LIFT` and rerun `textures.py`,
  `pack.py`, `glamourer_design.py` and `validate_pmp.py`.

## Known limits
- **1.0.2** (Oct 24): fixes found by comparing the mod in the PMP Viewer's game-shader renderer (GS) with the source model, plus the Roegadyn-man fit above. Not checked in game yet. GS captures are in `PmpViewer/work/captures/f102_*`, and `work/preview/gs_compare_1.0.2.png` shows the source, 1.0.1 and 1.0.2 side by side.
  - **The wearer's own neck showed through her choker.** The game's face model carries the neck down to the collar, and hers is slimmer. In GS, pale bands of the wearer's skin showed between the choker's bands at the nape, on the side of the neck under the ear and at the front of the throat. Hiding the face model made them vanish. The fit now pushes her neck layers out radially (choker, neck skin, frill, pearls; up to 15 mm, 5 cm on the Roegadyn man) until they clear every player face of the races that wear that fit by 2.5 mm, below the jaw only (`tools/fit.py`, `cover_neck`). In GS on the Midlander woman, hiding the wearer's face now changes no pixels in full front, back and side views or in nape and side-neck close-ups, and 8 in a close-up of the throat.
  - **Fingers bent about the wrong points.** Her knuckles sat 3 cm from FFXIV's and her middle joints 3 cm from theirs, so when the game curled the fingers they stayed straight and stuck out. The same was found and fixed in the Mantis port. The palm now stretches to the FFXIV knuckles, each finger sits on its knuckle aimed along the FFXIV finger, and its weight splits between `j_*_a` and `j_*_b` by position along it.
  - Her head sits 5 mm further forward on the women's fit, which reduces the Elezen, Roegadyn and Hrothgar women's show-through.
- **1.0.1 writes vertex colour set 0 white.** 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so Peni would have rendered pitch black in game, as the Mantis port did in its first test. `tools/build.py` now writes white. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla (the Mantis port's `tools/xivtool` has it; the copy in `apps/xivtool` predates it).
- **No model has more than 4 materials** (Penumbra's `MdlMaterialMaximum`; the head had 6 in 1.0.0). The sleeves-and-crown and stockings-and-shoes sets now share a 2:1 "gear" atlas, and the hair strokes and lashes share a 2:1 "detail" atlas with the eyes (`tools/textures.py` → `MATERIALS`). `tools/build.py` moves each part's UVs into its tile. The head now has 4 materials, the body 3.
- **Not checked in game yet.** It was checked offline only:
  - every model, material and texture in the pack parses with Penumbra and Lumina
  - every material and texture a file names is shipped
  - Penumbra's own reader loads every manipulation
  - the built models, read back and posed, deform correctly (`work/preview/mdl_*`)
- Her face is static: no blinking, mouth movement or expressions. Her hair and braids have no physics. The skirt rides the game's skirt bones, so it sways like a vanilla skirt.
- How much of each race's own face shows past her (`tools/showthrough.py`): the share of the face model's silhouette visible from 36 directions round the head, bind pose, face 1 unless noted. Ears and Au Ra horns are left out, because the head piece's flags hide them in game. The lash and brow cards are left out too: they're cut out by alpha, and GS shows none of them. The old `poke.py` figures in 1.0.1 missed the neck, because its rays from the head centre ran on into her braids.

  | Race | Women | Men |
  |---|---|---|
  | Midlander | 0.00% (faces 1–5) | 0.03% |
  | Highlander | 0.00% | 0.9% (sides of the neck, from below) |
  | Elezen | 0.65%* | 1.1%* |
  | Miqo'te | 0.00% | 0.02% |
  | Roegadyn | 0.70%* | 0.01% |
  | Au Ra | 0.00% | 0.03% |
  | Hrothgar | 0.75%* (face 5) | 0.23% (back of the neck) |
  | Viera | 0.00% | 0.02% |
  | Lalafell | 0.05% | 0.05% |

  \* All of it in her eye openings, seen from the front. GS shows none of it, though it does draw the wearer's eyes (hide her head and they show). In GS at full-body distance, hiding the wearer's face changes 0 pixels on the Midlander woman, 0–21 on the Roegadyn and Hrothgar women, 1 on the Elezen woman's face, and at most 272 on the Highlander man (a sliver at the side of the neck).
- The head flags are copied from the vanilla Moogle Head. With the set on, the body flags hide necklaces, earrings, bracelets, rings and tails, and breast physics is off.
- Marvel Rivals uses its own toon shaders, which FFXIV can't run. Two of them were baked into plain textures (`tools/bake.py`):
  - the hair's colour, which the game takes from a shadow-colour map on a second UV set (near-black with teal streaks). The hair cards share one strand atlas in the first UV set (about 22 deep), so the FFXIV hair is mapped with the second set. The strand mask and opacity are carried over into it at 2048². The hair has no normal map.
  - the procedural eyes: iris disc, sclera and limbus ring from the shader's own maps
- Left out: the inside of the mouth (her mouth stays closed), the translucent eye-highlight domes, the fake eye shadow and the rim-light shell.
- The rip's normal maps are DirectX style (green down), checked by their cross-derivatives. They were flipped to FFXIV's green up. Shine is a constant per texture set, and roughness and occlusion come from the rip's ORM maps (`tools/textures.py`, `TEXSETS`).
- Everyone in this mod's collection who wears the Night of Devilry set looks like Peni.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy, Pillow and msgpack, plus the portable Blender in `../Aerith/apps` for previews). Use `--from <step>` to start partway.
0. `fetch.py <hash ...>` (not part of make): downloads the viewer's content-addressed CDN objects to `source/cdn`, following every hash a scene or GLB names. `source/roots.txt` lists the 142 objects the viewer page loaded. The scene `0f2cae…ygg` names the character GLB `8fa7f2…glb`.
1. `export_src.py`: reads Peni's mesh (`SK_1042_Girl_1042302_Lobby`) and skin from that GLB. Its buffers are meshopt-compressed and its textures are UASTC KTX2, so both go through `tools/native/xdec.dll`, the Basis Universal transcoder and meshoptimizer decoders built with Zig (`tools/native/build.ps1`; the Luna Snow port's sources in `../LunaSnow/apps/src`). The result is `work/src`: one npz per primitive, the skeleton, and every texture as PNG.
2. `prep_refs.py`: pulls the c0101, c0201, c0901, c1101, c1401 and c1801 skeletons, the racial deformer file, the bare body, a face and the Night of Devilry models from the game.
3. `fit.py`: retargets Peni onto each race in `PROFILES` through her own Unreal skeleton. Each source bone follows its nearest key ancestor (twist, volume and physics bones go with their limb; facial, hair and crown bones with the head).
   - torso: a height lattice through her ankles, knees, hips, shoulders and neck
   - limbs: one affine per bone, rotated onto the FFXIV bone and stretched to its length
   - hands: rigid across the palm, stretched along it to the FFXIV knuckles; each finger keeps its shape, its base on the FFXIV knuckle
   - shoes: rigid
   - head: rigid, scaled and placed so the wearer's face stays inside it
   - weights: hers, renamed onto FFXIV bones, with the arm shared with the twist helpers the way the vanilla body does it; fingers split between `j_*_a` and `j_*_b` by position along the FFXIV finger
   - dress: where it hangs from her pelvis and thighs, the FFXIV skirt chains by angle and height
   - neck: pushed out until it covers the neck of every player face that wears the fit (`cover_neck`, `COVER_RACES`)
4. `bake.py`, `textures.py` and `materials.py`: the hair and eye bakes, then Dawntrail `character.shpk` textures and six materials (head, hair, detail atlas, body, dress, gear atlas). Hair, hair strokes and lashes are alpha-tested.
5. `build.py`: splits Peni into the five gear models per fitted race (Midlander woman, Midlander man, Roegadyn man, Lalafell) by skin weight, plus a body without the spider. It moves each part's UVs into its atlas tile and converts them with Penumbra's importer (`apps/xivtool import`), copies the vanilla model flags and radius, and makes the empty face stand-ins.
6. `pack.py`, `glamourer_design.py`, `validate_pmp.py`, `render_preview.py`: the `.pmp`, the Glamourer design, the file and manipulation check, and `out/preview.png`.

Checks:
- `look_src.py [mesh ...]` renders the source meshes.
- `check_fit.py <race> [other races]` renders the fit over the FFXIV body and face, and in idle and run poses.
- `showthrough.py <fit race> [race[:face] ...]` measures how much of each race's face shows past her, from 36 directions, and saves the four worst views to `work/preview/show_*.png`.
- `blink_probe.py` drives her eyelids with the game's own blink (`face.pap`, decoded with the PMP Viewer's `server/anim.py`), a feasibility probe for an animated face. Not part of the build.
- `check_mdl.py <race>` renders the built `.mdl` and `.tex` files back, plus one colour per gear slot.

Peni Parker belongs to Marvel; the model and textures belong to NetEase (Marvel Rivals). Fan port, personal use only: don't upload or share the `.pmp`.
