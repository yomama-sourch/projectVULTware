@echo off
title Vultware Server (Python Fallback)
color 0b
echo ========================================================
echo             VULTWARE PYTHON LOCAL HOST
echo ========================================================
echo.

cd /d "%~dp0"

echo Opening http://localhost:8080/index.html in your browser...
start http://localhost:8080/index.html

python -m http.server 8080 --directory "%~dp0."

pause
