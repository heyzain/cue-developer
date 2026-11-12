@echo off
cd /d "%~dp0"
call npm install
if errorlevel 1 (pause & exit /b 1)
call npm run dist:portable
if errorlevel 1 (pause & exit /b 1)
echo.
echo Portable Windows app created in the release folder.
pause
