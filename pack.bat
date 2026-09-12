@echo off
setlocal
cd /d "%~dp0"
node scripts\pack-one.js
if errorlevel 1 exit /b 1
echo.
pause
