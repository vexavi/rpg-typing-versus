@echo off
cd /d "%~dp0docs"
start "RPG v69 Local Server" cmd /k py -m http.server 5500 --bind 127.0.0.1
timeout /t 2 /nobreak >nul
start "" "http://localhost:5500/adventure.html?perf=1"
echo Local browser preview launched. Keep internet and Firebase connected to sign in and play.
echo The other Command Prompt window hosts your local files. GitHub is unchanged.
pause
