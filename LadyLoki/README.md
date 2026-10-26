# Lady Loki – Seaside Siren (Marvel Rivals → FFXIV)

Penumbra mod: `out/Lady Loki - Seaside Siren (Marvel Rivals).pmp`
Preview: `out/preview.png`

## What it replaces
| Slot | Item | Contents |
|---|---|---|
| Head | Summer Sunset Bandana | Option: horned tiara + eye mask + hoop earrings, **or** tiara + Loki's silver bun hair (hides your hair), or off |
| Body | Summer Sunset Beach Cover-up | Swimsuit, sheer arm wraps, necklace, sash (on Bibo+ Nude-Medium body) |
| Hands | Summer Sunset Wrist Torques | Bracelets (Bibo+ hands) |
| Legs | Summer Sunset Bottoms | Sarong skirt (FFXIV skirt bones → physics), thigh snake band, belt (Bibo+ SFW-Medium legs) |
| Feet | Summer Sunset Sandals | Shell anklets + starfish (Bibo+ bare feet) |
| Weapon | Omega Rod / Ultimate Omega Rod (w1001 b0071) | Loki's scepter as a BLM/THM two-handed staff (option, on by default) |

Feminine c0201-based races only (Midlander, Miqo'te, Au Ra, Elezen, Viera). Requires **Bibo+** (skin + underwear material core files).
The head slot includes EQDP overrides so Au Ra/Elezen use this head model instead of their race-specific vanilla bandana.

## Second pack (same outfit, different items)
`out_midlander/Seaside Siren - Isle Vacationer's + Ebony Staff.pmp` — identical outfit, headpiece/hair options and scepter,
but on the **Isle Vacationer's** set (Visor / Shirt / Wrist Torques / Shorts / Sandals) and the **Ebony Staff** (Grandeur shares the model),
so it can be enabled at the same time as the Lady Loki pack. Built by `tools/build_variant.py` from the same fitted meshes.

## Changes
**1.1.1** (2026-10-25), both packs. Metal off, so the brighter colours actually show.
- **Cause.** `make_materials.py` copied the template's colour-table row 0 into all 32 rows, and that row is 0.8 metal. So every outfit and staff material was metal whatever the `_id` picked, and in GS the outfit got no diffuse light: near-black green with reflections.
- **Fix.** Metalness is now 0 in every row (`row[18] = 0.0`). Nothing else in the materials changed (checked byte for byte).
- **Lady Loki pack.** Rebuilt with `make_materials.build()` for each material, then `make_pmp.py`. `make_materials.py`'s own `__main__` also empties the material folder, which removes the Bibo+ underwear material that `build_models.py` copies in.
- **Isle Vacationer's pack.** Still the 1.0.0 structure, so `build_variant.build_materials()` would point `top_b` at the trim atlas it doesn't ship. Instead, `python -P -E tools/lift_built_tex.py metal` zeroes the metalness in its built materials (the Bibo+ underwear excluded), then the pack is repacked with `make_pmp.main(build_variant.CFG)`.
- **Check.** check_pmp: the metal-row warnings are gone (3 in the Lady Loki pack, 5 in the Isle Vacationer's). What's left was already there: the Bibo+/face info lines and the two mirrored-UV warnings.
- **GS.** Against the packs before 1.1.0: `work/lift/cmp_lift.png` and `work/lift/cmp_lift_midlander.png`, head close-ups in `work/lift/cmp_lift_head*.png`. The outfit's pixels are about 2.5× brighter with 3.6× the colour. The emerald swimsuit and skirt, the pale-green arm wraps, the gold tiara and horns and the peacock earrings all read now. The skin (Bibo+) is unchanged, and nothing goes white. The 1.1.0 packs and images are kept as `work/lift/v110*.pmp` and `*_v110.png`.

**1.1.0** (2026-10-25), both packs. Brighter colours, with the lift from Neon 1.2.0. The user, on Neon: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for".
- The colour maps of the swimsuit, skirt, gold/trim sets (gold, acc6, acc7), hair and scepter are lifted (`LIFT` in `tools/make_textures.py`). Luminance goes up by a 1.4 gamma with the hue kept, which lifts dark and mid tones most. Then saturation goes up 1.2×. Alpha, normal and mask maps are unchanged. The body skin is your Bibo+ skin, so it isn't touched.
- `tools/texfile.py` now passes `-sepalpha` to texconv, so the mips filter alpha (the hair's strand mask) on its own.
- The Lady Loki pack (`out`) was rebuilt with `make_textures.py`, then `make_pmp.py`.
- The Isle Vacationer's pack (`out_midlander`) was still the 1.0.0 build, from before the trim atlas: 7 materials, the legs model has 6. A full `build_variant.py` would rebuild its models as well. So only its built colour textures were lifted, by `tools/lift_built_tex.py` (decode, same `LIFT`, re-encode BC7 through texconv `-sepalpha`), then it was repacked with `make_pmp.main(build_variant.CFG)`. That reproduces the 1.0.0 pack exactly apart from those textures and the version.
- In GS, the outfit's pixels are about 22% brighter by day and 24% in dim neutral light, with about 70% more colour. The greens are richer and the gold tiara and horns brighter. The skin is unchanged. Before and after, by day and in dim light: `work/lift/cmp_lift_v110.png` (Lady Loki pack) and `work/lift/cmp_lift_midlander_v110.png` (Isle Vacationer's pack), with head close-ups in `work/lift/cmp_lift_head*_v110.png`. The packs before the change are `work/lift/before.pmp` and `work/lift/before_midlander.pmp`.
- 1.1.0 left every outfit material on a fully metallic colour-table row; 1.1.1 fixes that. Not changed: the Cover-up's and Wrist Torques' meshes sit on a mirrored UV tile.

## Install
Penumbra → Mods → Import Mods → pick the .pmp → enable in your collection → redraw.
Wear the Summer Sunset pieces and the (Ultimate) Omega Rod, or use Penumbra's Item Swap tab to move it onto other items.

## Known limits
- Since 1.0.1 the gold (Equip_02/05), Equip_06 and Equip_07 trim texture sets share one 2x2 atlas material (`top_b`; `top_c`/`top_d` are gone), so no model has more than 4 materials (Penumbra's `MdlMaterialMaximum`; the legs had 6).
- Default Seaside Siren colors only (the Sunlit Sovereign / Sapphire Sorceress skins are in-engine region recolors).
- The toe chain/toe ring were dropped (Bibo+ toes are shaped too differently for them to sit right).
- Loki's face/eyes are not included; materials use character.shpk "compatibility" (diffuse) mode.

## Rebuild
`tools/` holds the pipeline (Python 3.11 + numpy/Pillow, private TexTools ConsoleTools copy in `tools/tt`):
`preview_src.py` → `preview_retarget.py` → `build_outfit.py` → `build_head.py` → `make_textures.py` → `make_materials.py` → `build_models.py` → `make_pmp.py`.
`tools/tt.py` links the game's sqpack into `tools/ttgame` on demand; `tt.drop_game_link()` removes that junction.
`make_textures.py` gives every colour map the 1.1.0 colour lift (`LIFT`), and `texfile.py` encodes with texconv `-sepalpha`. `make_materials.py` turns the colour table's metalness off (1.1.1). The second pack is rebuilt by `build_variant.py`, which copies the Lady Loki pack's (already lifted) textures and builds its materials with `make_materials.build`. For 1.1.0 and 1.1.1 it was not rebuilt; `tools/lift_built_tex.py lift` / `metal` patched its built files instead (see Changes).
