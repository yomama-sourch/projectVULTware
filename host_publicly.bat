@echo off
title VultShare Public Host (Cloudflare Tunnel)
color 0a
echo ========================================================
echo         VULTSHARE PUBLIC CLOUDFLARE HOSTING
echo ========================================================
echo.
echo Starting local web server in the background...
echo.

cd /d "%~dp0"

:: Start local node server in background if not running
start /b node server.js

echo Connecting to Cloudflare's global network...
echo Generating your free public HTTPS link...
echo.
echo ========================================================
echo  LOOK FOR THE LINK ENDING IN: trycloudflare.com
echo  Copy that link and share it with your friends!
echo ========================================================
echo.

call npx --yes cloudflared tunnel --url http://localhost:8080

pause
