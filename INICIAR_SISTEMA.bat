@echo off
setlocal
title Sistema de Inventario Empresarial Lomas
color 0b

:: Banner de inicio
echo ===================================================
echo     SISTEMA DE INVENTARIO Y COSTEO LOMAS
echo           --- MODO EMPRESARIAL ---
echo ===================================================
echo.

:: Detectar directorio
cd /d "%~dp0"

:: Verificar dependencias
if not exist "node_modules" (
    echo [1/4] Instalando componentes base...
    call npm install
) else (
    echo [1/4] Componentes verificados.
)

:: Preparar interfaz (Asegura que veas los ultimos cambios)
echo [2/4] Aplicando mejoras y optimizando interfaz...
call npm run build

:: Limpiar procesos previos
echo [3/4] Liberando puerto unico 3000...
set "TARGET_PORT=3000"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%TARGET_PORT% ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: Iniciar el sistema completo
echo [4/4] Iniciando Servidor Empresarial...
echo.
echo ---------------------------------------------------
echo  EL SISTEMA SE ABRIRA EN: http://localhost:3000
echo  PUERTO UNICO ACTIVADO - NO CIERRES ESTA VENTANA
echo ---------------------------------------------------
echo.

:: Lanzar backend (que sirve el frontend en el mismo puerto)
start "Servidor Lomas" /min cmd /k "npm run start"

:: Esperar un momento y abrir navegador
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo.
echo [!] Sistema ejecutandose exitosamente.
echo [!] Presiona cualquier tecla para finalizar y cerrar servidor.
echo.
pause >nul

:: Al cerrar el bat, cerrar procesos de node relacionados a este puerto
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
exit
