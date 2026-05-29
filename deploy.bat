@echo off
chcp 65001 >nul
title Despliegue Automático - Inventario

echo ============================================
echo   Despliegue a GitHub + Render/Vercel
echo ============================================
echo.

:: Verificar si GITHUB_TOKEN está configurado
if "%GITHUB_TOKEN%"=="" (
    echo [ERROR] No se encontro GITHUB_TOKEN en las variables de entorno.
    echo.
    echo Para generar un token:
    echo   1. Abre https://github.com/settings/tokens en tu navegador
    echo   2. Generate new token ^> Generate new token (classic)
    echo   3. Marca el scope "repo"
    echo   4. Copia el token
    echo.
    echo Luego ejecuta:
    echo   set GITHUB_TOKEN=tu_token_aqui
    echo   %~nx0
    echo.
    pause
    exit /b 1
)

echo [1/3] Construyendo frontend...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Fallo el build. Revisa los errores arriba.
    pause
    exit /b 1
)
echo [OK] Build completado.
echo.

echo [2/3] Subiendo cambios a GitHub...
node deploy-github.mjs
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la subida a GitHub.
    pause
    exit /b 1
)
echo [OK] Cambios subidos a GitHub.
echo.

echo [3/3] Iniciando servidor local...
node server/server.js
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al iniciar servidor.
    pause
    exit /b 1
)
