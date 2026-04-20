@echo off
title Sistema de Ventas e Inventario - Lomas
echo.
echo ===================================================
echo   SISTEMA DE VENTAS E INVENTARIO - LOMAS
echo ===================================================
echo.
echo   URL EN LA NUBE:
echo   https://ventas-e-inventario.onrender.com
echo.
echo ===================================================
echo.

cd /d "%~dp0"

:: Instalar dependencias si no existen
if not exist "node_modules" (
    echo Instalando dependencias por primera vez...
    call npm install
    echo.
)

:: Despertar el servidor en Render por si estaba inactivo
echo Despertando servidor en la nube... espera un momento.
curl -s -o nul https://ventas-e-inventario.onrender.com > nul 2>&1
timeout /t 5 /nobreak >nul

:: Abrir directamente la URL publica en el navegador
echo Abriendo sistema en el navegador...
start https://ventas-e-inventario.onrender.com

:: Iniciar vigilante de cambios (auto-sube a GitHub y Render)
echo.
echo Iniciando sincronizacion automatica con la nube...
start "Auto-Deploy Ventas" cmd /k "cd /d %~dp0 && node scripts/watch-deploy.js"

echo.
echo ===================================================
echo   LISTO! El navegador se abrio con la URL en la nube.
echo   Cada cambio que hagas se subira solo a Render.
echo   No cierres la ventana de "Auto-Deploy Ventas".
echo ===================================================
echo.
pause
