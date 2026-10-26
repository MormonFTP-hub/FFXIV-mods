# Runs a Python script inside headless Blender and prints its output.
# usage: run_blender.ps1 <script.py> [args for the script]
# The Store build of Blender is sandboxed: it cannot see %TEMP% and its stdout
# isn't forwarded, so output goes through a log file under work\logs.
param(
    [Parameter(Mandatory = $true)][string]$Script,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$ScriptArgs
)
$blender = "$env:LOCALAPPDATA\Microsoft\WindowsApps\BlenderFoundation.Blender_ppwjx1n5r4v9t\blender-launcher.exe"
$logDir = Join-Path $PSScriptRoot "..\work\logs"
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path (Resolve-Path $logDir) ("{0}.log" -f [IO.Path]::GetFileNameWithoutExtension($Script))
Remove-Item $log -ErrorAction SilentlyContinue
$argList = (@((Resolve-Path $Script).Path) + $ScriptArgs | ForEach-Object { "r'" + ($_ -replace "'", "\'") + "'" }) -join ","
$expr = "import sys,runpy,traceback,os;f=open(r'$log','w',encoding='utf-8',buffering=1);sys.stdout=sys.stderr=f;sys.argv=[$argList]`ntry:`n runpy.run_path(sys.argv[0],run_name='__main__')`nexcept SystemExit:`n pass`nexcept BaseException:`n traceback.print_exc();f.flush();os._exit(1)`nf.flush()"
$exprFile = Join-Path (Resolve-Path $logDir) "_runner.py"
[IO.File]::WriteAllText($exprFile, $expr)
$p = Start-Process -FilePath $blender -ArgumentList @('-b', '--factory-startup', '--python', "`"$exprFile`"") -PassThru -Wait -WindowStyle Hidden
if (Test-Path $log) { Get-Content $log }
exit $p.ExitCode
