@echo off
cd /d "%~dp0"
call npm install
if errorlevel 1 (pause & exit /b 1)
call npm run dist:portable
if errorlevel 1 (pause & exit /b 1)
echo.
echo Portable app created in the release folder as Cue-Portable-*.exe.
echo This version does not install Cue or create Start menu shortcuts.
pause
