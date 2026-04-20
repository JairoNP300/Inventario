@echo off
setlocal
title Sistema de Inventario Lomas - MODO LOCAL
color 0b

:: Banner de inicio
echo ===================================================
echo     SISTEMA DE INVENTARIO Y COSTEO LOMAS
echo           --- MODO LOCAL ACTIVADO ---
echo ===================================================
echo.

:: Detectar directorio
cd /d "%~dp0"

:: Verificar dependencias
if not exist "node_modules" (
    echo [1/3] Instalando dependencias necesarias...
    call npm install
) else (
    echo [1/3] Dependencias verificadas.
)

:: Limpiar procesos previos
echo [2/3] Preparando puertos 3000 y 5173...
set "TARGET_PORT_BACK=3000"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%TARGET_PORT_BACK% ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: Iniciar el sistema completo
echo [3/3] Iniciando Servidor y Aplicacion...
echo.
echo ---------------------------------------------------
echo  EL NAVEGADOR SE ABRIRA AUTOMATICAMENTE EN BREVE
echo  NO CIERRES ESTA VENTANA MIENTRAS USES EL SISTEMA
echo ---------------------------------------------------
echo.

:: Lanzar concurrently para backend y frontend
start "Servidor Backend" /min cmd /k "npm run start"
start "Aplicacion Frontend" /min cmd /k "npm run dev"

:: Esperar un momento y abrir navegador
timeout /t 8 /nobreak >nul
start http://localhost:5173

echo.
echo [!] Sistema ejecutandose en http://localhost:5173
echo [!] Presiona cualquier tecla para finalizar.
echo.
pause >nul

:: Al cerrar el bat, intentar matar los procesos de node
taskkill /f /im node.exe >nul 2>&1
exit
