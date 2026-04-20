#!/bin/bash

# Script de despliegue automático para Render
echo "🚀 Iniciando despliegue automático..."

# Variables de entorno
export NODE_ENV=production
export PORT=3000

# Construir proyecto
echo "📦 Construyendo proyecto..."
npm install
npm run build

# Verificar construcción
if [ -d "dist" ]; then
    echo "✅ Construcción exitosa"
else
    echo "❌ Error en construcción"
    exit 1
fi

# Iniciar servidor
echo "🌐 Iniciando servidor para producción..."
npm start

echo "🎯 Sistema listo para producción"
echo "📡 URL: https://ventas-e-inventario.onrender.com"
echo "📍 Ubicaciones: Ransa, Soyapango, Usulután, Lomas de San Francisco"
echo "📦 Stock: 100 unidades por bodega"
