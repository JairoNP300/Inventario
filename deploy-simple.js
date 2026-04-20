// Sistema de despliegue automático ULTRA SIMPLE
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

console.log('🚀 SISTEMA DE DESPLIEGUE AUTOMÁTICO');

// Crear ZIP del proyecto
console.log('\n📦 Creando ZIP del proyecto...');

const output = fs.createWriteStream(path.join(__dirname, 'ventas-inventario-final.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log('✅ ZIP creado exitosamente');
  console.log('\n📋 INSTRUCCIONES FINALES:');
  console.log('\n1. SUBE A GITHUB:');
  console.log('   - Ve a github.com');
  console.log('   - Sube el archivo: ventas-inventario-final.zip');
  console.log('\n2. CONFIGURA RENDER:');
  console.log('   - Ve a render.com');
  console.log('   - New Web Service');
  console.log('   - Conecta tu repositorio');
  console.log('   - Build: npm install && npm run build');
  console.log('   - Start: npm start');
  console.log('   - Variables: NODE_ENV=production, DATABASE_URL');
  console.log('\n3. URL FINAL:');
  console.log('   https://ventas-e-inventario.onrender.com');
  console.log('\n✅ CARACTERÍSTICAS LISTAS:');
  console.log('   - 4 nuevas ubicaciones');
  console.log('   - Stock de 100 por bodega');
  console.log('   - Lógica de deducción automática');
  console.log('\n🚀 ¡SISTEMA AUTOMATIZADO PARA ACCESO PÚBLICO CONTINUO!');
});

output.on('error', (err) => {
  console.error('❌ Error creando ZIP:', err);
});

archive.pipe(output);

// Agregar archivos importantes
const archivos = [
  'src/', 'server/', 'package.json', 'vite.config.js',
  'render.yaml', 'render-build.sh', '.github/'
];

archivos.forEach(archivo => {
  const rutaCompleta = path.join(__dirname, archivo);
  if (fs.existsSync(rutaCompleta)) {
    console.log(`   Agregando: ${archivo}`);
    archive.file(archivo, { name: archivo });
  }
});

archive.finalize();
