@echo off
rem Builds Authenticator.exe (one file, needs the .NET 10 Desktop Runtime) next to this script.
setlocal
cd /d "%~dp0"
dotnet publish Authenticator\Authenticator.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:DebugType=none -o publish || exit /b 1
copy /y publish\Authenticator.exe Authenticator.exe >nul || exit /b 1
echo Built %~dp0Authenticator.exe
