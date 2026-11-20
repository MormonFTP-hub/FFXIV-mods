# PMP Viewer: handoff

State as of 2026-11-20. README.md explains what the viewer does and how it resolves mods. This note covers where things stand and what was learned along the way.

## The owner and the goal
- The owner ports models from other games into FFXIV Penumbra mods (one folder per port in `E:\FFXIV-mods`, packs in `<port>\out\*.pmp`).
- The viewer exists so they can test a mod without starting the game. Their bar is **1:1 with the game, with no doubt left**: every difference explained and fixed.
- Requests are short. Answer with measurements, not guesses.
- Work in the game-shader (GS) renderer; the WebGL preview is legacy.
- Don't change the ports themselves unless asked.

## Running and building
- `PMP Viewer.exe` in this folder is what the owner uses. Rebuild with `python -P -E tools/build_exe.py`. If the exe is running, the build renames it to `PMP Viewer.old.exe`. The owner restarts the viewer themselves.
- From source: `python -P -E server/app.py`, or the `pmp-viewer` entry in `E:\FFXIV-mods\.claude\launch.json`.
- After changing the page, bump `?v=` in `viewer/index.html` (currently 26).
- Renderer: `dotnet build -c Release -o ../../apps/xivrender` in `tools/xivrender`. Both C# projects point at `%APPDATA%\XIVLauncher\installedPlugins\Penumbra\1.7.2.1`; bump that path when Penumbra updates.
- `tools/xivrender/Gpu.cs` contains a raw NUL byte (a `'\0'` literal), so editors that refuse binary files won't open it.

## Ground truth from the game: PMP Capture
- `E:\FFXIV-mods\PmpCapture` is a read-only Dalamud dev plugin (registered in Dalamud's Dev Plugin Locations on 2026-11-20). `/pmpcapture` in GPose saves the scene to `work/ingame/<time>/`:
  - customize bytes, gear, glasses
  - every file Penumbra served, and each model's attribute and shape masks
  - the pose with physics, and the camera matrices
  - g_CustomizeParameter, material parameters and the dyed colour tables
  - EnvState and the sun's shadow camera
  - the game's G-buffers, light buffers, depth and final image
- `tools/ingame.py latest` compares the viewer with it, layer by layer (see README). Tested against a synthetic capture (viewer vs viewer: identical). No real capture has been compared yet.
- Not yet established from real data: the matrix conventions of the captured camera and pose (row/column order, reversed Z), the depth format, and whether the G-buffers are still intact when Dalamud draws. Fix `tools/ingame.py` against the first real capture.

## Open questions the first captures should answer
- **Face shape mapping:** is customize value v the v-th letter (`shp_brw_c` for eyebrows 3)? Compare the viewer's face shapes with the capture's face shape mask.
- **Customize colours:** lipstick colour and opacity, face paint opacity (palette alpha 0.18–0.49, vs the 1.0 the viewer uses), muscle tone scale, and whether Glamourer's saved "Parameters" without Apply flags are applied in game. "Mister Wonderful" has them (lip 83,24,24 at 25%, muscle 1.8, face paint black at 93%).
- **The light:** fit sun colour and ambient from the game's light buffers and G-buffer normals. The sun direction comes from the shadow camera. Character Lighting is 0 in the owner's settings.
- **Post effects the GS renderer doesn't draw:** glare (on), AA and screen-space reflections (max), and in GPose depth of field and vignette.

## Findings that changed the viewer
- **EQP borrowed bits (2026-11-20):** the bits a body supplies for head, hands and legs (and legs for feet) used to come out empty. Fixed in `resolve.character` + `visibility.Visibility(eqp_of, ...)`.
- **Face shapes, lipstick, feature colour, left eye, muscle (2026-11-20):** taken from the customize values (Glamourer designs and captures). The face shape mapping is still unconfirmed.
- **Sampler address modes** (Black Cat): flags bits 0-1 = U, 2-3 = V; 0 wrap, 1 mirror, 2 clamp, 3 border. The ports' e0800 template uses Mirror.
- **Glamourer race:** designs leave Race unticked; the race comes from the clan. The bust slider scales `j_mune_l/r`.
- **Penumbra 1.7 mod layout:** a single `meta.json` (FileVersion 4). Installed mods are in `D:\Penumbra` (moved from `E:\cum` on 2026-10-25).
- **Collection layering** ("my collection") and Havok tagfile v5 skeletons (Illusio Vitae) are both done.
- **Lighting:** the GS Day preset was fitted to 7.4 YouTube footage of a Miqo'te in Bygone Brass. Now that captures exist, it can be replaced by values fitted to the owner's own game.

## Findings in the ports (reported, not fixed)
- **Metal rows:** `_id` green 255 picks the pair's first row. Ports whose `textures.py` writes G = metal with row 1 = metal render dark in game: Gekko (confirmed), Neon, Viper, NursePool, SonicForces, Gregor.
- **Mirror flags:** Black Cat (fixed in 1.0.2), the old LadyLoki build, Sonic's head piece and one Lich King helmet mesh.

## Limits
- Not simulated or not shown:
  - physics (captures carry the game's physics pose, though)
  - VFX
  - weapons on the character
  - glasses (captures name the model, so the path can be added)
  - RSP/EVP/Atch/GMP, except height and bust
- "All races" doesn't layer the collection; only the main view does.
- The false "skin mask red off 165" warning is still in `shade.py`, waiting on the owner's OK to remove it.
