@echo off
rem Starts the PF merc bot and restarts it if it crashes. Close this window to stop it.
title PF Merc Bot
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo First run: setting up the Python environment...
    py -3 -m venv .venv || python -m venv .venv
    ".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r requirements.txt
)
:loop
".venv\Scripts\python.exe" merc_bot.py
rem exit code 2 = missing/bad token: restarting won't help
if errorlevel 2 if not errorlevel 3 (
    pause
    exit /b 2
)
echo Bot stopped. Restarting in 15 seconds... (close this window to quit)
timeout /t 15 /nobreak >nul
goto loop
