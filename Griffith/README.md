# Griffith (Reborn) → FFXIV

Port of Griffith (Reborn) from *BERSERK and the Band of the Hawk* (rip by SirDuckman) to a Penumbra mod.

**Mod:** `out/Griffith (Reborn).pmp`. In Penumbra, use **Import Mod** and enable it in your collection.

| Slot | Item (e0110, all classes, lv 1) | Becomes |
|---|---|---|
| Head | Hellhound / Grey Hound / Shadowhound Helm | Hawk helmet + the hair that flows out of it (hides your hair) |
| Body | … Armor | Breastplate, pauldrons, wings, cape (cape is on the skirt physics bones) |
| Hands | … Gauntlets | Gauntlets and gloves |
| Legs | … Cuisses | Belt, thigh plates |
| Feet | … Sabatons | Greaves and spurred sabatons |

The **Face & Hair** option group is on by default. It replaces Hyur Midlander male **face 1** and **hairstyle 1**, so set those in Glamourer, and assign the mod in a collection used only by your character. To show his face instead of the helmet, hide your headgear. Other male races, except Lalafell, use the Midlander models through EQDP entries.

## Changes
**1.1.0** (2026-10-25): brighter colours, with Neon's lift. The user, on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for".
- `tools/textures.py` → `lift()` / `lifted()` brightens the armour, cape, hair and face `_base` colour maps (`LIFT`; all four are character.shpk with the colour baked in). Luminance is raised by a 1.4 gamma, which lifts dark and mid tones most and keeps the hue, then saturation goes up 20% (1.2) in linear light. Alpha is unchanged (the hair's cut-out and the face's opacity), and so are the normal, mask and `_id` maps (the armour's surface kinds are still read from the unlifted rip) and the colour table, so the steel stays metal.
- In GS (Midlander man, idle) the cape comes out a clearly brighter blue and the gold trim and belt warmer, while the steel plates change little. The figure's average brightness rises about 22% by day and 21% in dim neutral light, and its saturation about 15%. Without the helm, his face is a little warmer (skin saturation 0.38 → 0.44, same hue) and the white hair stays white. Before and after, by day and in dim light: `work/lift/cmp_lift.png`; bare head: `work/lift/cmp_lift_head.png` (the 1.0.2 pack is `work/lift/before.pmp`).
- To tune it, change `LIFT` and run `python -P -E tools/textures.py`, then `pack.py` and `validate_pmp.py`.

## Known limits
- **1.0.2: your face paint no longer covers Griffith's face.** The materials were copied from a body template with `character.shpk`'s decal (crest) key on. In the face slot the game binds the character's face paint as that decal, and face paints have full alpha, so with face paint on, his face and eyes took the paint colour, as Sora 1.1.0's did. Every material now uses vanilla's no-decal value (`0x4242B842`). The PMP Viewer flags this, and its game shaders show it with face paint set.
- **1.0.1: vertex colour set 0 is now white.** 1.0.0 wrote it black. `character.shpk` multiplies the surface by it (vanilla gear has it white), so every model, face and hair included, would have rendered pitch black in game, as Mantis did on its first test. `xivtool mdlstreams <mdl>` prints each vertex set to compare with vanilla.
- The face is static: it doesn't blink or show expressions. It's skinned to the head and neck only.
- The hair colour is baked into the texture, so your hair colour setting doesn't change it. The long hair has no physics; it follows the head, neck and upper back.
- The build hasn't been checked in-game yet. If bumps look lit from below, flip the green channel in `textures.py` → `normal()`. Shine is set per surface in `materials.py` → `SURFACES`.

## Pipeline (`tools/`)
`python -P -E tools/make.py` reruns every step. Use `--from <step>` to start partway.
1. `prep_refs.py`: pulls the FFXIV c0101 skeleton, body, face and hair models from the game (Lumina, through `apps/xivtool`).
2. `fit.py`: poses the FFXIV naked body into Griffith's T-pose (`rig.py`), copies skin weights from the nearest body point, smooths them, and keeps small plates rigid. The cape, hair and head use their own rules. Everything is then moved into FFXIV's A-pose, and the head shifts 3 cm forward onto the FFXIV face position.
3. `textures.py`: builds Dawntrail `character.shpk` textures (base / norm / mask / id) as BC7/BC5.
4. `materials.py`: builds `.mtrl` files from the vanilla `e0800` material, with a white colour table and per-surface roughness and metalness.
5. `build.py`: splits the armour into top/glv/dwn/sho by skin weight, writes glTF, and converts it with Penumbra's own importer (`xivtool import`).
6. `pack.py`: writes the `.pmp`.

Checks: `check_tpose.py` (body overlay), `check_fit.py` (bind pose and stress pose), `check_mdl.py` (round-trip render from the built `.mdl` and `.tex` files). Renders go to `work/preview/`.
