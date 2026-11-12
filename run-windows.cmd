@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Cue - Desktop Launcher

echo.
echo ===================================================
echo    CUE - Developer Tool Launcher

echo ===================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [Cue] Node.js is missing. Install Node.js LTS from https://nodejs.org/
  echo [Cue] This window will remain open so you can read the error.
  pause
  exit /b 1
)

rem Keep the Electron process attached so startup failures are visible.
rem The companion Node script saves the output to cue-launch.log.
node "%~dp0scripts\launch.cjs"
set "cue_exit=%errorlevel%"
if not "%cue_exit%"=="0" (
  echo.
  echo [Cue] Could not start. The error was saved to cue-launch.log.
  echo [Cue] Please send that log file if the issue continues.
  echo [Cue] Press any key to close this window.
  pause >nul
)
exit /b %cue_exit%
