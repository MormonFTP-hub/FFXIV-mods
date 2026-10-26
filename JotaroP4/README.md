# Jotaro Kujo (Part 4) for FFXIV

Penumbra modpack: `out/Jotaro Kujo (Part 4).pmp`. Hyur Midlander male.

- The Emperor's New Robe / Gloves / Breeches / Boots (`e0279`) become Jotaro's coat, hands, trousers and shoes.
- Face 1 (`c0101f0001`) becomes his head, cap and eyes; hairstyle 1 (`c0101h0001`) becomes invisible.
- Option group **Coat colour**: White (default), Purple, Blue, Lavender (the Eyes of Heaven alt costumes).

**1.2.0: brighter colours (Neon's lift).** The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for". `tools/make_textures.py` (`LIFT`, `lift()`) now lifts the atlas colour map (all four coat-colour variants) and the iris: luminance gamma 1.4 (dark and mid tones most, hue kept), then saturation x1.2 in linear light. The skin set (`skin.shpk`, tinted by your skin colour) is still made from the unlifted atlas, and the lashes (alpha only), normal and mask maps are unchanged. In GS his average brightness rises about 14% by day and in dim light; the coat is whiter and the purple and gold richer, with nothing clipped to white. Before/after (1.1.0 and 1.2.0, day then dim): `work/lift/cmp_lift.png`.

**1.1.0: his face and hands use the game's own skin shader (`skin.shpk`).** On the gear shader (`character.shpk`) his skin went dull and dark whenever the sun wasn't on him, while vanilla skin (and the Aerith port's face, which is `skin.shpk`) keeps its warmth. Compare `out/compare_1.0.1_vs_1.1.0_head.png` / `_full.png` (GS, sun and shade).
- The head mesh's skin triangles (face, ears, neck: picked by the atlas colour under them) are material `fac_a`, cloned from the vanilla Midlander male face. The bare hands are `glv_b`, cloned from the vanilla body material. The cap and hair stay on the atlas material, now `etc_a`.
- The game multiplies `skin.shpk` colour by your character's skin colour, so the atlas's skin texels are rescaled to the vanilla face albedo; the painted lines and hatching keep their colour. A light or tan Midlander skin colour suits him.
- Skin meshes have vertex colour (0, 1, 1, 1), as vanilla faces and hands do.

**1.0.1: your face paint no longer covers Jotaro's face.** The materials were copied from a body template (`e0039`) with `character.shpk`'s decal (crest) key on. In the face slot the game binds the character's face paint as that decal, and face paints have full alpha, so with face paint on, his face, irises and lashes took the paint colour, as Sora 1.1.0's did. That is probably the "dark face" from the first in-game test. Every material now uses vanilla's no-decal value (`0x4242B842`).

## Rebuild

Run from this folder (`python -E -P` keeps the rip folder off the import path):

```bash
python -E -P tools/extract_bases.py      # vanilla skeleton, models, EQP and template materials -> work/game
python -E -P tools/fit_jotaro.py         # re-rig the rip onto the FFXIV skeleton -> work/fit.pkl
python -E -P tools/build_models.py       # split into slots, write glTF -> work/gltf
for s in top glv dwn sho fac hir; do apps/xivtool/xivtool.exe import work/gltf/$s.glb work/mdl/$s.mdl; done
python -E -P tools/make_textures.py      # .tex + .mtrl -> work/mod
python -E -P tools/package.py            # -> out/Jotaro Kujo (Part 4).pmp
```

Previews: `tools/preview_fit.py work/preview/fit` (bind pose) and, after
`xivtool mdlexport work/mdl/<slot>.mdl work/mdl/<slot>.json` for each slot, `tools/preview_pose.py work/preview/pose.png`.

`apps/xivtool` is a copy of the Aerith port's helper (Lumina + Penumbra's own glTF importer).
