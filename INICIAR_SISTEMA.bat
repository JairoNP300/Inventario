@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "PUBLIC_URL=https://ventas-e-inventario.onrender.com"

echo Iniciando sistema en modo URL publica (Render)...

if not exist "%ROOT%package.json" (
  echo [ERROR] No se encontro package.json en %ROOT%
  pause
  exit /b 1
)

cd /d "%ROOT%"
echo [INFO] Abriendo sistema publico: %PUBLIC_URL%
start "" "%PUBLIC_URL%"

echo [INFO] Activando aplicacion automatica de cambios a GitHub/Render...
echo [INFO] Esta ventana debe permanecer abierta para sincronizacion continua.
echo [INFO] Para detener sincronizacion: Ctrl+C
npm run cloud
