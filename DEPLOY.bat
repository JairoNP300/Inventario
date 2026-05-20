@echo off
echo 🚀 Iniciando deploy automático a Render...
powershell -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
pause
