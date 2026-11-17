@echo off
cd /d "%~dp0"
py tools\build_assets.py --optimize
if errorlevel 1 (
  echo If Pillow is missing, install it with: py -m pip install Pillow
)
pause
