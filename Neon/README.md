# Neon (Valorant) for FFXIV

Penumbra mod: `out/Neon (Valorant).pmp`. Preview: `out/preview.png`, rendered from the built mod files in an idle pose. Left to right: a Midlander woman, a Viera woman, a Midlander man, a Roegadyn man and a Lalafell.

Ported from Neon's character-select model as shown in the [Kingdom Archives model viewer](https://kingdomarchives.com/modelviewer/neon) (Valorant, mesh `CS_Sprinter_S0_Skelmesh`). It's a full-body costume: Neon replaces your whole character, head included.

## Install and wear
1. In Penumbra, use **Import Mod** and pick the `.pmp`, then enable it in your collection.
2. Put on the **Critical Hit B-1 Tour** set (all classes, level 1): Headset, Top, Halfgloves, Breeches and Longboots. The quickest way is the Glamourer design: copy the code from `out/Neon - Glamourer import code.txt`, then use **Import design from clipboard** in Glamourer's Designs tab. It sets the five gear slots, shows the hat and turns the mod on. The set is untradable, but Glamourer can put it on without you owning it.
3. If anything doesn't change, run `/penumbra redraw`.

| Item (Critical Hit B Tour set, e6222) | Becomes |
|---|---|
| Critical Hit B-1 Tour Headset | Her head and face, the blue hair with its two buns, and the eye overlay. It hides your hair and ears. |
| Critical Hit B-1 Tour Top | Collar, crop top, gold chest plates, backpack, bare upper arms |
| Critical Hit B-1 Tour Halfgloves | Forearm sleeves, wristbands, fingerless gloves and hands |
| Critical Hit B-1 Tour Breeches | Belt, waist sash, hip pouch, thighs |
| Critical Hit B-1 Tour Longboots | Lower legs and her sneakers |

The **Critical Hit B-2 Tour** set uses the same models (its materials live in a second folder, which the mod also fills), so it changes too.

**Races:** every race and gender.
- **Women** get her on the Midlander woman's frame. Highlander, Elezen, Miqo'te, Roegadyn, Au Ra, Hrothgar and Viera women are reshaped from it by the game's racial deformer (EQDP entries in the mod make sure of that).
- **Men** get the same Neon on the Midlander man's frame, reshaped the same way for the other male races.
- **Roegadyn men** have their own fit, and **Hrothgar men** use it: vanilla gear always ships Roegadyn models, and the deformer from the Midlander man doesn't reproduce the Roegadyn skeleton.
- **Lalafell** (men and women) get a little Neon with a big head (2.25× the body scale), sized so the Lalafell face stays inside it.

Option group:
- **Hide your own face** (off by default): blanks every player face model. Turn it on only if your face shows through hers, and only in a collection used by your character alone. If your face comes from a face mod, give Neon a higher priority than that mod, or the face mod's files win.

**Face mods with their own ears:** the headset hides the game's ears (`atr_mim`), but not ears a face mod puts on a custom attribute. Your **Abigail - Demon (Midlander)** face does that (`atrx_ears`, its "Ears/Horns – Options: Elf Ears"), and in GS her pointy ears stick out of Neon's hair. While wearing Neon, set that option to **None**, or turn on **Hide your own face** with Neon above Abigail in priority.

## Changes
**1.2.0** (2026-10-25). The user tried 1.1.0 in game, at night: "really good, i want brighter colors though".
- **Brighter colours.** `textures.py` lifts the body and hair colour maps (`LIFT`). Luminance is raised by a 1.4 gamma, which lifts dark and mid tones most and keeps the hue, then saturation goes up 20%. The navy suit and blue hair brighten the most, and skin and the gold plates move little. The eye overlay is unchanged. In GS the figure's average blue rises about 28% in daylight and 44% in dim neutral light (`work/gs/v120/cmp_brightness.png`: source, then 1.1.0 and 1.2.0 by day and in dim light). To tune it, change `LIFT` and run `python -P -E tools/make.py --from textures`.

**1.1.0** (2026-10-25), from comparing the source model with the PMP Viewer's game-shader renderer (GS). Comparison sheets are in `work/gs/`: `cmp_before_after.png` (source, 1.0.1, 1.1.0), `cmp_front_back.png`, `cmp_side.png`, and `cmp_hands_final.png` (vanilla, 1.0.1 and 1.1.0 hands at idle).
- **Metal.** 1.0.x wrote the `_id` green as the viewer's metalness, but G = 255 picks the first (plain) row of the colour-table pair and G = 0 the second. 86–100% of every material, including her skin, hair and suit, read as metal, and GS drew her near-black with matte gold plates. `_id` is now G = 255 − metal. The flat `_id` that the hair and eye overlay use now picks the plain row. The second row is a glossy non-metal (roughness 0.35), because a metal row turns the plates near-black in GS while the source shows them pale gold. Now only her gold plates, buckles and piercings (14% of the atlas) use it.
- **Decal key off.** The `e0800` material template has character.shpk's crest/face-paint decal key on (`0xD2777173` = `0xF35F5131`). It's now `0x4242B842`, as Sora 1.1.1 needed.
- **Fingers.** Her three-joint fingers sat up to 2 cm (5.6 cm for the Roegadyn thumb) off FFXIV's two-bone fingers, and the game's idle curl folded them back into her palm. Each finger is now a rigid segment based on the FFXIV knuckle, with its weight split where the FFXIV finger bends, as in the Gekko and Mantis ports.
- **Back of the head.** Her eyes sit on the FFXIV eyes, but her skull is shallower front to back, so the back of the wearer's own head showed through her hair between the buns. GS showed it from behind, in both bind and idle pose. `fit.py cover_skull` now pushes the back and sides of her head and hair out until they clear every player face of the races that wear each fit, with a 5 mm margin: up to 16 mm on the women's fit, 12 mm on the men's, 10 mm on the Roegadyn fit, nothing on the Lalafell. Her face stays as it was. Hrothgar women's cheek fur would need 37 mm, so it's left out. In GS, the pixels that change when the wearer's face is hidden, seen from six angles at idle, went from 8,854 to 2 on the Midlander woman and from 6,198 to 0 on the Midlander man.
- `poke.py` now measures every player face (f0001–f0008, f0101–f0108; it used to skip Hrothgar women's f0005–f0008 and include NPC faces) and leaves out what the headset hides (ears, and Au Ra horns and scales, which GS confirms don't show).

**1.0.1:** vertex colour set 0 is now white. 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so the model would have rendered pitch black in game, as Mantis did on its first test. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla.

## Known limits
- **Not checked in game yet.** It was checked offline only:
  - every model, material and texture in the pack parses with Penumbra and Lumina
  - every material and texture a file names is shipped, in both material folders
  - Penumbra's own reader loads all 95 manipulations
  - the built models, read back and posed, deform correctly (`work/preview/mdl_*`)
  - in GS, 1.1.0 matches the source render from the front, back, side and three-quarter, and the PMP Viewer reports no errors or warnings for any race
- How much of each race's own face shows through her head (`tools/poke.py`, 1.1.0, bind pose, every player face of each race, leaving out the ears and horns the headset hides):

  | Race | Men | Women |
  |---|---|---|
  | Midlander | 0% | 0.1% |
  | Highlander | 0.2% | 0.1% |
  | Elezen | 0% | 0% |
  | Miqo'te | 0% | 0% |
  | Roegadyn | 0.5% | 0.1–0.3% |
  | Au Ra | 0.3–0.9% | 0.1% |
  | Hrothgar | 1.2–2.0% | 0.2–2.4% (cheek fur) |
  | Viera | 0% | 0% |
  | Lalafell | 0.7% | 0.7% |

  Most of what's left is the throat under her jaw, which only shows from below, and the Hrothgar cheek fur and muzzle.
- The face is static: no blinking or lip movement. The hair has no physics; it rides the head and hands over to the neck below the jaw.
- Women's breast physics are off (she has no breast bones), so the bust slider doesn't change her.
- Materials are Dawntrail `character.shpk` with the viewer's colour, normal (green flipped: the viewer's maps are green-down, FFXIV's green-up, checked with a curl test) and ORM maps. The ORM blue (metalness, with the fabrics' faint 0.27 cut away) picks a glossy non-metal row for the gold plates, buckles and piercings. The emissive maps are blank and weren't used.
- Everyone in this mod's collection who wears the Critical Hit B Tour set looks like Neon.

## Rebuild
`python -P -E tools/make.py` reruns every step (Python 3.11 with numpy and Pillow, plus the portable Blender in `../Aerith/apps` for previews). Use `--from <step>` to start partway. The source files in `source/` came straight from the viewer's network requests (`uploads/models/agents/neon/neon_cs.glb`, its `textures/*.png` and `agents/eye_df.png`).
1. `export_src.py`: unpacks the glb (plain buffers) into `work/src`: mesh, skeleton, materials, and copies the PNG textures. The glb is already in FFXIV's axes (metres, Y up, facing +Z, +X = her left), bind pose = rest pose.
2. `prep_refs.py`: pulls the FFXIV skeletons, the racial deformer file, faces and the Critical Hit B Tour models from the game (Lumina, through `apps/xivtool`).
3. `fit.py`: retargets her onto each race in `PROFILES` through her own skeleton (Valorant names: `Pelvis`, `Spine1-4`, `L_Shoulder`, `L_Hip`, ...):
   - torso: a height lattice through her ankles, knees, hips, shoulders and neck, with `shoulder` setting how much of her shoulder breadth she keeps
   - limbs: one affine per bone, rotated onto the FFXIV bone and stretched to its length
   - hands: scaled so her middle knuckle meets theirs
   - fingers: rigid, each based on the FFXIV knuckle and aimed along the FFXIV finger
   - sneakers: rigid, scaled by `foot`, sole on the floor and toes turned forward
   - head: rigid, scaled and placed so the wearer's face stays inside it, then `cover_skull` pushes the back and sides of her head and hair out over every wearer's skull (faces read through the racial deformer, their own `j_f_*` bones riding `j_kao`)
   - weights: every joint goes to its nearest mapped ancestor (twist and sleeve joints to their limb; shirt flaps, chest plates, backpack, belt and pouch to the spine). Spine weight is spread by height, arm weight is shared with the twist helpers the way the vanilla body does it, and the hair rides the head and neck.
4. `textures.py` and `materials.py`: Dawntrail `character.shpk` textures and materials, one per texture set (body atlas, hair, eye overlay). The eye overlay is alpha-tested through the normal map's blue channel.
5. `build.py`: splits her into the five gear models per race by skin weight (the head piece gets three materials, the rest one) and converts them with Penumbra's importer (`apps/xivtool import`). It copies the vanilla model flags and radius, and makes the empty face stand-ins.
6. `pack.py`, `glamourer_design.py`, `validate_pmp.py`, `render_preview.py`: the `.pmp`, the Glamourer design, the parse checks and `out/preview.png`.

Checks: `check_fit.py <race> [deform race ...]` (bind pose over the FFXIV body, slots, face close-up, idle and run poses), `poke.py <fit race> [races]` (face show-through), `check_mdl.py <race>` (round trip from the built `.mdl` and `.tex` files). Renders go to `work/preview/`.

GS checks (the game's own shaders, through `../PmpViewer`):
- `python -P -E ../PmpViewer/tools/check_pmp.py "out/Neon (Valorant).pmp"` lists the viewer's problems for every race.
- `../PmpViewer/tools/gs_render.py "out/Neon (Valorant).pmp" <png> --race c0201 --pose idle --cam front|back|head|hand_l|hand_r` renders a posed view. Add `--set "Hide your own face=Hide every player face"` and diff the two renders to see where the wearer's face shows through.
- Source renders for comparison: `work/gs/jobs/*.json` through `../PmpViewer/work/gallery/tools/render_source.py`.
- Don't A/B models with `gs_render --swap`: it sends bone matrices in the packed model's bone order, so a rebuilt model with a different bone table renders as spikes. Repack instead.

The tools started as a copy of NursePool's, including its `tools/pbd.py` with the two verified deformer parents (Hrothgar man from Roegadyn man c0901, Lalafell woman from Lalafell man c1101).

Neon and Valorant belong to Riot Games. Fan port, personal use only.
