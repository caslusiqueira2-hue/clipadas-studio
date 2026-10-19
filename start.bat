@echo off
title Clipadas Studio
echo ==========================================
echo    Iniciando Clipadas Studio...
echo ==========================================
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
npm run dev
