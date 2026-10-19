@echo off
title Clipadas Studio - Modo Celular & Nuvem
echo ============================================================
echo    Iniciando Clipadas Studio (Modo Celular / Nuvem)...
echo ============================================================
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
node server/tunnel.js
pause
