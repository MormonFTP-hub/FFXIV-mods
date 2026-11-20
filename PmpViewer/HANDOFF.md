# PMP Viewer: handoff

State as of 2026-11-20 (work done 22-23 Oct). README.md explains what the viewer does and how it resolves mods; this note covers where things stand and what was learned along the way.

## The owner and the goal
- The owner ports models from other games into FFXIV Penumbra mods (one folder per port in `E:\FFXIV-mods`, packs in `<port>\out\*.pmp`).
- The viewer exists so they can test a mod without starting the game. Their bar is **1:1 with the game**: they compare its render with their own in-game screenshots and expect every difference explained and fixed.
- Requests are short ("why does this look different", plus a screenshot). Answer with measurements from the screenshot, not guesses.
- Don't change the ports themselves unless asked. They said "Not now" to fixing the metal rows.

## Running and building
- `PMP Viewer.exe` in this folder is what the owner uses. Rebuild with `python -P -E tools/build_exe.py`. If the exe is running, the build renames it to `PMP Viewer.old.exe`. The owner restarts the viewer themselves.
- From source: `python -P -E server/app.py`, or the `pmp-viewer` entry in `E:\FFXIV-mods\.claude\launch.json`. It moves to port 8766 if 8765 is taken.
- After changing the page, bump `?v=` in `viewer/index.html` (currently 20) so Edge doesn't keep the old `app.js`.
- Devtools hook: `window.pmpv` = { LIGHTS, applyLight, camera, controls, renderer, scene, st(), ao, composer }. Tune a preset live with `Object.assign(pmpv.LIGHTS.night, {...}); pmpv.applyLight()`.

## Comparing with an in-game shot
1. **Match the character first.** Paste their Glamourer design (Glamourer's design files live in `%APPDATA%\XIVLauncher\pluginConfigs\Glamourer\designs`; automation in `automation.json`). The race decides which fit of the mod is drawn: a Midlander man gets the male fit.
2. **Match the light.** Pick the preset (Night or Day), then set **Light from**, **height** and **sky light** to the shot. Read the sun's direction from what is lit in the shot. Lower sky light where cliffs or trees block the sky.
3. **Measure, don't eyeball.** Compare region means, hue, saturation and value with Python/PIL on the owner's screenshot and on a viewer screenshot. Compare like with like: the same texture lit vs shaded, or the same body part.

## Findings that changed the viewer (all shipped in the current exe)
- **Sampler address modes** (Black Cat): sampler flags bits 0-1 = U and 2-3 = V; 0 wrap, 1 mirror, 2 clamp, 3 border (Penumbra `SamplerFlags`). The ports' template material, vanilla e0800 top, uses Mirror, so UVs on odd tiles come out mirrored in game. The viewer now samples with each sampler's mode and warns per mesh.
- **Glamourer race**: designs leave Race unticked and let the Clan imply it. The viewer now derives the race from the clan. It also reads bust size: the bust slider scales `j_mune_l/r` by the clan's BustMin..Max from `human.cmp`.
- **Penumbra 1.7 mod layout**: installed mods in `E:\cum` keep everything in one `meta.json` (FileVersion 4: `DefaultData` + `Groups`). `pmp.Mod` reads both layouts.
- **Lighting** (Jotaro, Peni):
  - shadow maps from the sun or moon, plus GTAO ambient occlusion with an alpha-aware normal pass
  - Light from / height / sky light sliders
  - Night is a neutral light: a blue moon turned a white coat navy. Peni's yellow and orange cloth stay within about 5 RGB.
  - Day has game-like shade depth: by a cliff, a white coat's shaded side gets 0.11 of its sunlit side
  - The composer pre-compensates the background colour for the tone mapping and keeps 4x MSAA.
- Explained, nothing to fix:
  - Jotaro's dark face in game is shade (the cap brim and the sun behind him); his material and model are fine.
  - Black Cat's squashed chest in game is breast physics on `j_mune_*`. Vanilla Miqo'te women already have it, and the owner's [IVCS2] physics mod makes it bouncier.

## Findings in the ports (reported, not fixed)
- **Metal rows**: `_id` green 255 picks the pair's first row. Ports whose `textures.py` writes G = metal with row 1 = metal (Gekko, Neon, Viper, NursePool, SonicForces, Gregor) render dark in game. The owner confirmed it on Gekko. Fix: swap the rows or write G = 255 - metal.
- **Mirror flags**: Black Cat (every mesh), the old LadyLoki build (e6137 top), Sonic's head piece (85%) and one Lich King helmet mesh (7%) draw mirrored in game. Fix: clear the low 4 bits of the sampler flags, or move the UVs into 0..1.

## Open leads and limits
- Only the opened mod is applied. The owner's collection (`%APPDATA%\XIVLauncher\pluginConfigs\Penumbra\collections\<guid>.json`, mods in `E:\cum`) also changes the in-game look: Illusio Vitae custom skeletons and their `human.pbd`, a face mod, Bibo+, physics mods. Resolving the whole collection is the obvious next feature.
- The IVCS skeletons are Havok tagfile **v5** (`hk_2014.2.5-r1`, an SDK string after the version tag), which `server/havok_tagfile.py` can't read yet.
- Not simulated or not shown:
  - physics (`.phyb`)
  - dyes
  - weapons on the character
  - VFX
  - RSP/EVP/Atch/GMP manipulations, except height and bust
- Day isn't colour-graded yet: in game, shaded skin is greyer than in the viewer. Dusk is still a guess. Fit both the way Night was fitted when the owner sends shots.
- A port's face can poke through a head mesh. The viewer draws both, so check it from the Problems list and with the 3D view.
