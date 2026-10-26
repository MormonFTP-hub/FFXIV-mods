@echo off
rem Starts the PMP viewer and opens it in your browser. Close this window to stop it.
cd /d "%~dp0"
set PY=%LOCALAPPDATA%\Microsoft\WindowsApps\python3.11.exe
if not exist "%PY%" set PY=python
start "" http://127.0.0.1:8765/
"%PY%" -P -E server\app.py --port 8765
pause
