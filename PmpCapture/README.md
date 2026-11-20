# PMP Capture

A small Dalamud dev plugin that saves what the game is drawing at one moment, so the [PMP Viewer](../PmpViewer) can redraw the same moment and be checked against the game pixel by pixel.

It is read-only. It hooks nothing, changes nothing in the game, and only reads memory (through FFXIVClientStructs) and copies render targets when you run the command.

## Use it
1. It's registered as a dev plugin: `E:\FFXIV-mods\PmpCapture\PmpCapture\bin\Release\PmpCapture.dll` in Dalamud settings → Experimental → Dev Plugin Locations. If it isn't running, enable it under `/xlplugins` → Dev Tools.
2. Go into GPose (`/gpose`). That freezes the scene and hides the HUD and nameplates, so the game's final image shows only the scene. Put the camera where you want it.
3. Type `/pmpcapture` (or `/pmpcapture in 5` to wait 5 seconds first, `/pmpcapture <label>` to name it). A chat line says where it was saved.
4. On the PC: `python -P -E PmpViewer/tools/ingame.py latest` compares it with the viewer. The results go to `<capture>/compare/report.md` and the images next to it.

Outside GPose it captures your own character. Hide the HUD with Scroll Lock (use `in 5` to get the time), or the HUD and your nameplate end up in the final image.

`/pmpcapture dir <folder>` changes where captures go. The default is `E:\FFXIV-mods\PmpViewer\work\ingame`, which is never committed.

## What a capture holds (`capture.json` plus `*.bin.gz`)
- **Game:** territory, map, GPose, the graphics settings that change the picture (Character Lighting, gamma, AO, glare, AA, reflections, shadows, resolution scaling), and the render size.
- **Camera:** the render camera's view and projection matrices, FoV, near and far planes.
- **Environment:** time of day, weather, the whole EnvState as floats (most of its fields have no names yet), the colour filter, the sun's shadow camera (its direction is the sun's), and the env scene constant buffer.
- **Character:**
  - the customize bytes, gear (set, variant, both dyes), glasses and model ids
  - g_CustomizeParameter and the decal colour exactly as uploaded
  - per model: the file loaded, the enabled attribute and shape-key masks, each material's file, shader, textures, g_MaterialParameter, and the dyed colour table from the GPU
- **Skeleton:** the character transform, and for each partial skeleton its bones, parents, reference pose, local pose and synced model-space pose (physics included).
- **Penumbra:** every actual file it served to the character, with the game paths it answers (IPC `GetGameObjectResourcePaths`).
- **Render targets:** G-buffers 0–4, the semi-transparent G-buffers, shadow mask, light buffers (opaque and semi-transparent), depth, view position, velocity, tone-adjust source and the back buffer, as raw rows (gzip).

## Build
`dotnet build -c Release` in `PmpCapture/` (Dalamud.NET.Sdk 15, Penumbra.Api 5.19.2). Some RenderTargetManager and CharacterBase fields aren't public in this ClientStructs build, so they're read by offset. Check those offsets (`CaptureJob.cs`, `At(rtm, ...)`) after a game patch.
