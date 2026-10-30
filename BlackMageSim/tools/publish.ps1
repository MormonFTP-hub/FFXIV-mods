<#
Publish the sim after an update: rebuild it, upload build/site to the website, push the repo to GitHub.

  powershell -ExecutionPolicy Bypass -File BlackMageSim/tools/publish.ps1             # build + website + GitHub
  powershell -ExecutionPolicy Bypass -File BlackMageSim/tools/publish.ps1 -NoBuild    # upload build/site as it is
  powershell -ExecutionPolicy Bypass -File BlackMageSim/tools/publish.ps1 -NoGitHub   # leave the push to the backup

The website is a Cloudflare Worker serving build/site (tools/wrangler.jsonc):
https://striking-dummy.lack-age-im.workers.dev. It needs Node.js and one `npx wrangler login`. Wrangler runs from
PowerShell, not from Python: started from the Microsoft Store Python it can't see the saved sign-in. The GitHub step
is the automatic backup's own run (tools/autobackup_hook.py --run: commit and push, one run at a time). The claude.ai
copy (build/artifact.html) is published separately.
#>
param([switch]$NoBuild, [switch]$NoGitHub)

$Sim = Split-Path -Parent $PSScriptRoot
$Repo = Split-Path -Parent $Sim
$Site = Join-Path $Sim 'build\site'
$Url = 'https://striking-dummy.lack-age-im.workers.dev/'
$Wrangler = 'wrangler@4.156.0'    # pinned: a newer Wrangler may handle the deploy differently

function Step($exe, [string[]]$argv) {
  Write-Host "> $exe $($argv -join ' ')"
  & $exe @argv
  if ($LASTEXITCODE) { Write-Host "failed ($LASTEXITCODE): ${exe}"; exit 1 }
}

Set-Location $Repo
if (-not $NoBuild) {
  Step python @("$Sim\tools\build_versions.py")
  Step python @("$Sim\tools\build_single.py")
}
if (-not (Test-Path "$Site\index.html")) { Write-Host "${Site} has no index.html: run without -NoBuild"; exit 1 }

# Wrangler's cache holds the account name; it must never sit in the uploaded folder.
Remove-Item -Recurse -Force "$Site\.wrangler" -ErrorAction SilentlyContinue
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  $node = 'C:\Program Files\nodejs'
  if (-not (Test-Path "$node\npx.cmd")) { Write-Host 'Node.js not found: winget install --id OpenJS.NodeJS.LTS'; exit 1 }
  $env:Path = "$node;$env:Path"
}
$env:CI = '1'
$env:WRANGLER_SEND_METRICS = 'false'
Step npx @('--yes', $Wrangler, 'deploy', '--config', 'BlackMageSim/tools/wrangler.jsonc')

# The live page should be the one just built.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$want = (Get-Item "$Site\index.html").Length
try {
  $got = (Invoke-WebRequest -Uri $Url -UseBasicParsing -Headers @{ 'Cache-Control' = 'no-cache' } -TimeoutSec 60 -ErrorAction Stop).RawContentLength
} catch { Write-Host "couldn't fetch $Url : $($_.Exception.Message)"; exit 1 }
if ($got -ne $want) { Write-Host "the live page is $got bytes, build/site/index.html is ${want}: check $Url"; exit 1 }
Write-Host "live: $Url ($got bytes, matches the build)"

if (-not $NoGitHub) {
  Step python @("$Repo\tools\autobackup_hook.py", '--run')
  $status = "$Repo\.git\autobackup.json"
  if (-not (Test-Path $status)) { Write-Host 'GitHub: no backup status (another backup may be running; it will push these changes)'; exit 1 }
  $s = Get-Content $status -Raw | ConvertFrom-Json
  if (-not $s.ok) { Write-Host "GitHub backup failed: $($s.message) (log: .git/autobackup.log)"; exit 1 }
  Write-Host "GitHub: $($s.message) ($($s.time))"
}
