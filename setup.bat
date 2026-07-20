@echo off
REM HotDog Pet - dev environment bootstrap (double-click launcher)
REM Keep this file ASCII-only: .bat with CJK breaks under Big5 codepage.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "setup.ps1"
echo.
pause
