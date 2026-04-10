@echo off
setlocal
cd /d %~dp0
echo ==========================================
echo   DIAGNOSTICO DE ARRANQUE - INVENTARIO
echo ==========================================
echo.

:: 1. Verificar Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] No se detecto Node.js.
    pause
    exit /b
)

:: 2. Ejecutar directamente con Bypass
echo [INFO] Iniciando instalacion y servidores...
powershell -ExecutionPolicy Bypass -Command "npm install; npm run dev:all"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] El proceso se detuvo con codigo %errorlevel%
    pause
)
pause
