# Rebuilds the Sora mod (2.0.0, every race) from the KH3 rip and the installed game.
#   powershell -ExecutionPolicy Bypass -File build.ps1
# Output: out\Sora_KH3.pmp (ready to import in Penumbra), the Glamourer design, game-shader previews in out\.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$game = "C:\Program Files (x86)\SquareEnix\FINAL FANTASY XIV - A Realm Reborn\game"
$tools = Join-Path $root "tools"
$work = Join-Path $root "work"
$mod = Join-Path $root "mod\Sora"
$out = Join-Path $root "out"
$races = "c0101,c0201,c0901,c1101"

function Step($name, [scriptblock]$block) {
    Write-Host "== $name"
    & $block
    if ($LASTEXITCODE -ne 0) { throw "$name failed (exit $LASTEXITCODE)" }
}

if (Test-Path $mod) { Remove-Item -Recurse -Force $mod }
Step "faces and eyes of every race" { python -P -E "$tools\prep_faces.py" $game }
Step "fit model ($races)" { & "$tools\run_blender.ps1" "$tools\convert_model.py" $game (Join-Path $root "source\p_ex001_0.dae") (Join-Path $work "gltf") $races }
Step "check glTF" { python -I "$tools\check_glb.py" (Get-ChildItem (Join-Path $work "gltf") -Recurse -Filter *.glb | Where-Object { $_.Directory.Name -like "c*" }).FullName }
Step "convert to .mdl (Penumbra importer)" { python -P -E "$tools\import_models.py" }
Step "textures and materials" { & "$tools\run_blender.ps1" "$tools\make_textures.py" $game (Join-Path $root "source") $mod }
Step "package" { python -P -E "$tools\package_mod.py" $work $mod $out }
Step "Glamourer design" { python -P -E "$tools\glamourer_design.py" }
