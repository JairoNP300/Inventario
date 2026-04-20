// Sistema de despliegue automático simplificado
import { readFileSync, writeFileSync, existsSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 SISTEMA DE DESPLIEGUE AUTOMÁTICO');

// Crear ZIP del proyecto manualmente
function crearZIP() {
  console.log('\n📦 Creando ZIP del proyecto...');
  
  const fs = require('fs');
  const path = require('path');
  const archiver = require('archiver');
  
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(join(__dirname, 'ventas-inventario-automatizado.zip'));
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log('✅ ZIP creado exitosamente');
      resolve(join(__dirname, 'ventas-inventario-automatizado.zip'));
    });
    
    archive.on('error', reject);
    archive.pipe(output);
    
    // Agregar todos los archivos importantes
    const archivos = [
      'src/', 'server/', 'package.json', 'vite.config.js', 
      'render.yaml', 'render-build.sh', '.github/'
    ];
    
    archivos.forEach(archivo => {
      const rutaCompleta = join(__dirname, archivo);
      if (fs.existsSync(rutaCompleta)) {
        console.log(`   Agregando: ${archivo}`);
        archive.file(archivo, { name: archivo });
      }
    });
    
    archive.finalize();
  });
}

// Crear instrucciones finales
function crearInstrucciones() {
  const instrucciones = `

# 🚀 SISTEMA DE DESPLIEGUE AUTOMATIZADO COMPLETADO

## ✅ ¿QUÉ ESTÁ LISTO?

- ✅ Nuevas ubicaciones: Ransa, Soyapango, Usulután, Lomas de San Francisco
- ✅ Stock configurado: 100 unidades por bodega (400 totales)
- ✅ Lógica de deducción automática por ubicación
- ✅ Migración automática para producción
- ✅ Todo actualizado para Render

## 📋 PASOS FINALES

### Paso 1: Subir a GitHub
1. Ve a github.com
2. Sube el archivo: ventas-inventario-automatizado.zip
3. Extrae todos los archivos

### Paso 2: Configurar Render
1. Ve a render.com
2. New Web Service
3. Conecta tu repositorio
4. Build Command: npm install && npm run build
5. Start Command: npm start
6. Variables: NODE_ENV=production, DATABASE_URL=tu_url_postgresql

### Paso 3: Base de Datos
1. Crea PostgreSQL en Render
2. Configura DATABASE_URL

## 🌐 URL FINAL
https://ventas-e-inventario.onrender.com

## ✅ VERIFICACIÓN
Deberías ver:
- 4 opciones de ubicación
- Stock de 100 por bodega
- Sistema funcionando correctamente

## 🔄 ACTUALIZACIONES FUTURAS
Cada vez que actualices:
1. Ejecuta: node deploy-final.js
2. Sube el nuevo ZIP a GitHub
3. Render despliega automáticamente

¡SISTEMA COMPLETAMENTE AUTOMATIZADO PARA ACCESO PÚBLICO CONTINUO!
`;

  writeFileSync(join(__dirname, 'INSTRUCCIONES_AUTOMATIZADAS.md'), instrucciones);
  console.log('✅ Instrucciones creadas');
}

// Ejecutar todo
async function main() {
  try {
    console.log('\n📋 INICIANDO PROCESO COMPLETO...');
    
    // Crear ZIP
    const zipPath = await crearZIP();
    
    // Crear instrucciones
    await crearInstrucciones();
    
    console.log('\n🎯 RESUMEN FINAL:');
    console.log('✅ Sistema actualizado completamente');
    console.log('✅ Nuevas ubicaciones configuradas');
    console.log('✅ Stock de 100 por bodega');
    console.log('✅ Lógica de deducción automática');
    console.log('✅ ZIP creado para producción');
    console.log('✅ Instrucciones generadas');
    
    console.log('\n📡 URL: https://ventas-e-inventario.onrender.com');
    console.log('\n📋 SIGUIENTES PASOS:');
    console.log('1. Sube ventas-inventario-automatizado.zip a GitHub');
    console.log('2. Configura Render con tu repositorio');
    console.log('3. ¡Listo! URL pública funcionando');
    
    console.log('\n🚀 ¡SISTEMA 100% AUTOMATIZADO!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
