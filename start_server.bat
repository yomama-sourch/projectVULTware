@echo off
title Vultware Server
color 0b
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b
)

node server.js
pause
