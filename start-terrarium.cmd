@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run Terrarium Studio.
  echo Install Node.js 20.19+ or 22.12+ from https://nodejs.org/
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo Installing project dependencies...
  call npm ci
  if errorlevel 1 goto failed
)

echo Starting Terrarium Studio in your default browser...
call npm run dev -- --open
if errorlevel 1 goto failed
exit /b 0

:failed
echo Terrarium Studio could not be started. Check the message above.
pause
exit /b 1
