<#
Publish the Arknights calculator's website: build the standalone copy and upload it to Cloudflare.

  powershell -ExecutionPolicy Bypass -File ArknightsCalc/tools/publish.ps1

The website is a Cloudflare Worker serving build/site (tools/wrangler.jsonc):
https://arknights-calc.lack-age-im.workers.dev. It needs Node.js and one `npx wrangler login`. Wrangler runs from
PowerShell, not from Python: started from the Microsoft Store Python it can't see the saved sign-in. The claude.ai
copy (index.html with operators.json and enemies.json) is published separately.
#>
$Calc = Split-Path -Parent $PSScriptRoot
$Repo = Split-Path -Parent $Calc
$Site = Join-Path $Calc 'build\site'
$Url = 'https://arknights-calc.lack-age-im.workers.dev/'
$Wrangler = 'wrangler@4.156.0'    # pinned, same as the FFXIV sim's publish script

function Step($exe, [string[]]$argv) {
  Write-Host "> $exe $($argv -join ' ')"
  & $exe @argv
  if ($LASTEXITCODE) { Write-Host "failed ($LASTEXITCODE): ${exe}"; exit 1 }
}

Set-Location $Repo
Step python @("$Calc\tools\build_site.py")

# Wrangler's cache holds the account name; it must never sit in the uploaded folder.
Remove-Item -Recurse -Force "$Site\.wrangler" -ErrorAction SilentlyContinue
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  $node = 'C:\Program Files\nodejs'
  if (-not (Test-Path "$node\npx.cmd")) { Write-Host 'Node.js not found: winget install --id OpenJS.NodeJS.LTS'; exit 1 }
  $env:Path = "$node;$env:Path"
}
$env:CI = '1'
$env:WRANGLER_SEND_METRICS = 'false'
Step npx @('--yes', $Wrangler, 'deploy', '--config', 'ArknightsCalc/tools/wrangler.jsonc')

# The live files should be the ones just built.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
foreach ($name in 'index.html', 'operators.json', 'enemies.json', 'baseskills.json', 'workshop.json') {
  $want = (Get-Item "$Site\$name").Length
  $u = if ($name -eq 'index.html') { $Url } else { "$Url$name" }
  try {
    $got = (Invoke-WebRequest -Uri $u -UseBasicParsing -Headers @{ 'Cache-Control' = 'no-cache' } -TimeoutSec 60 -ErrorAction Stop).RawContentLength
  } catch { Write-Host "couldn't fetch $u : $($_.Exception.Message)"; exit 1 }
  if ($got -ne $want) { Write-Host "the live $name is $got bytes, the build is ${want}: check $u"; exit 1 }
  Write-Host "live: $u ($got bytes, matches the build)"
}
