# Injects the locally built Dalamud (staging + ClientStructs "7.57 hotfix1", i.e. goatcorp/Dalamud#3025)
# into the running game. Uses an isolated config and an empty plugin folder, so only the Pull Timer dev
# plugin loads and your normal Dalamud setup is never touched. Closing the game undoes everything.
$ErrorActionPreference = 'Stop'
$t = $PSScriptRoot

$game = Get-Process ffxiv_dx11 | Select-Object -First 1
Write-Host "Injecting into ffxiv_dx11 (PID $($game.Id))..."

Push-Location "$t\runtime"
try {
    $env:DOTNET_ROOT = "$env:APPDATA\XIVLauncher\runtime"
    & .\Dalamud.Injector.exe inject $game.Id `
        "--dalamud-working-directory=$t\runtime" `
        "--dalamud-configuration-path=$t\config\dalamudConfig.json" `
        "--dalamud-plugin-directory=$t\installedPlugins" `
        "--dalamud-asset-directory=$env:APPDATA\XIVLauncher\dalamudAssets\dev" `
        "--dalamud-client-language=english" `
        "--logpath=$t\logs"
    Write-Host "Injector exit code: $LASTEXITCODE (0 = injected). Logs: $t\logs"
}
finally {
    Pop-Location
}
