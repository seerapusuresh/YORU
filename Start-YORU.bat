@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Please install Node.js from https://nodejs.org and reopen this file.& pause & exit /b 1)
curl.exe --silent --fail http://127.0.0.1:4180/api/health | findstr.exe /C:"0.2.0" >nul 2>nul
if not errorlevel 1 goto open_yoru
curl.exe --silent --fail http://127.0.0.1:4180/api/health | findstr.exe /C:"YORU" >nul 2>nul
if not errorlevel 1 goto old_server
start "YORU local server" /min cmd /c "node server.js"
for /l %%I in (1,1,15) do (
  curl.exe --silent --fail http://127.0.0.1:4180/api/health | findstr.exe /C:"0.2.0" >nul 2>nul
  if not errorlevel 1 goto open_yoru
  timeout /t 1 /nobreak >nul
)
echo YORU could not start. Check that Node.js is installed and port 4180 is free.
pause
exit /b 1
:old_server
echo An older YORU server is already running on port 4180.
echo Close its server window and run Start-YORU.bat again to use this updated version.
pause
exit /b 1
:open_yoru
start "" http://127.0.0.1:4180
