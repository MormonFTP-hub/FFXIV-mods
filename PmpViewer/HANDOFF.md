# PMP Viewer: handoff

State as of 2026-11-20 (after the first in-game captures). README.md explains what the viewer does and how it resolves mods. This note covers where things stand and what was learned along the way.

## The owner and the goal
- The owner ports models from other games into FFXIV Penumbra mods (one folder per port in `E:\FFXIV-mods`, packs in `<port>\out\*.pmp`).
- The viewer exists so they can test a mod without starting the game. Their bar is **1:1 with the game, with no doubt left**: every difference explained and fixed.
- Requests are short. Answer with measurements, not guesses.
- Work in the game-shader (GS) renderer; the WebGL preview is legacy.
- Don't change the ports themselves unless asked.

## Running and building
- `PMP Viewer.exe` in this folder is what the owner uses. Rebuild with `python -P -E tools/build_exe.py`. If the exe is running, the build renames it to `PMP Viewer.old.exe`. The owner restarts the viewer themselves.
- From source: `python -P -E server/app.py`, or the `pmp-viewer` entry in `E:\FFXIV-mods\.claude\launch.json`.
- After changing the page, bump `?v=` in `viewer/index.html` (currently 27).
- Renderer: `dotnet build -c Release -o ../../apps/xivrender` in `tools/xivrender`. Both C# projects point at `%APPDATA%\XIVLauncher\installedPlugins\Penumbra\1.7.2.1`; bump that path when Penumbra updates.
- `tools/xivrender/Gpu.cs` contains a raw NUL byte (a `'\0'` literal), so editors that refuse binary files won't open it.

## Ground truth from the game: PMP Capture
- `E:\FFXIV-mods\PmpCapture` is a read-only Dalamud dev plugin (registered in Dalamud's Dev Plugin Locations, auto-reload on). `/pmpcapture [label]` in GPose saves the scene to `work/ingame/<time>_<label>/`; writing a label to `work/ingame/request.txt` does the same from the PC (`python -P -E tools/ingame.py capture --label x` writes it, waits, and compares). A capture holds:
  - customize bytes, gear, glasses
  - every file Penumbra served, and each model's attribute and shape masks
  - the pose with physics, and the camera matrices
  - g_CustomizeParameter, material parameters and the dyed colour tables
  - EnvState and the sun's shadow camera
  - the game's G-buffers, light buffers, depth and final image
- `tools/ingame.py <folder|latest>` compares the viewer with it, layer by layer (see README).
- First real captures (2026-11-20, the owner's "Mister Wonderful" in Limsa Upper Decks): `work/ingame/20261120_173243_first` (outside GPose, HUD on), `..._173540_body` and `..._173550_face` (GPose). Results after the fixes below:
  - files 149 of 159 the same; the rest are the weapons (not drawn), `transparent.tex`, and slot 15's vanilla `c0201b0003_top.mdl` (a 376-vertex proxy body with the skin material; not drawn by the viewer, not visible in game)
  - masks 12 of 13 models the same (all but that proxy body)
  - geometry: face median 0.3 mm from the game's surface (75% within 1 mm), body 1.4 mm (80% within 5 mm). The thighs are 1-2 cm off where the YAB+ skirt is weighted to `ya_*_phys` bones that the Illusio Vitae skeleton lacks
  - albedo (G-buffer 2) within 2/255 on 82-88% of the character's pixels
- Capture conventions now known: the camera's view matrix is 3x4 (its 4th column is leftover memory; the renderer and ingame.py reset it to 0,0,0,1, which had zeroed every normal); projection is reversed-Z infinite with near 0.1; depth is D24S8; the pose is model space with the character transform (scale includes height) on top; G-buffers are intact at Dalamud's draw.

## Open questions and next steps (by impact)
- **Glass:** `characterglass.shpk` has no G pass and is shaded forward in the semi composite. In GS that pass comes out dark: glasses lenses tinted dark (game: clear), the hair mod's halo and the gloves' gems dark. Compare the forward pass's inputs with the game's (its CBs and the final-colour copy).
- **Emissive:** colour-table emissive is still not drawn (the halo glows white in game).
- **The light:** the redraw uses the Day preset. Fit sun colour and ambient from the captured light buffers + G-buffer normals (direction from the shadow camera); then the final image can be compared. Character Lighting is 0 in the owner's settings.
- **Bones missing from the skeleton:** identity in model space (ingame.py) vs parent joints: parent fit slightly better (legs within 5 mm 80% vs 78%) but neither is exact. Reading the vertex weights of `ya_*` would settle it.
- **OptionColor.w** is 1.0 in the game's g_CustomizeParameter; the viewer writes 0. Unknown meaning.
- **G-buffer 4 alpha** is 10/255 on every character pixel in game, 0 in the viewer (all four captures; RGB within 2/255 on 66-85%). Same shader, so it comes from an input the viewer doesn't set. G-buffers 0 and 1 differ without bias (normals mean 5-26/255, gbuffer1 red 7/255): fine-detail noise, cause not pinned (texture filtering is a candidate).
- **Post effects:** glare, AA, SSR, and GPose depth of field (on in the captures) aren't drawn.
- **Weapons** aren't drawn on the character (captures list them: w0337, w0387).

## Findings that changed the viewer
- **EQP borrowed bits (2026-11-20):** the bits a body supplies for head, hands and legs (and legs for feet) used to come out empty. Fixed in `resolve.character` + `visibility.Visibility(eqp_of, ...)`.
- **Face shapes, lipstick, feature colour, left eye, muscle (2026-11-20):** taken from the customize values (Glamourer designs and captures). Eyebrows 3 → `shp_brw_c` confirmed by capture; Glamourer's advanced colours are applied in game, as the viewer does.
- **Elbow rule (2026-11-20, capture):** `HandsHideElbow` hides `atr_ude` only with `HandsHideForearm` (like the knee/calf rule).
- **Glasses (2026-11-20):** drawn from the design's `Bonus.Glasses` (Glasses sheet → set | variant << 16) or the capture. Glass materials are kept out of the opaque passes (the game's opaque G-buffer shows what is behind the lens).
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
  - RSP/EVP/Atch/GMP, except height and bust
- "All races" doesn't layer the collection; only the main view does.
- The false "skin mask red off 165" warning is still in `shade.py`, waiting on the owner's OK to remove it.
