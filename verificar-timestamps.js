// Verificar timestamps de archivos modificados
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('## VERIFICANDO TIMESTAMPS DE ARCHIVOS ##');

// Función para obtener timestamp formateado
function getTimestamp(ruta) {
  try {
    const stats = fs.statSync(ruta);
    const fecha = new Date(stats.mtime);
    return fecha.toLocaleString('es-ES', { 
      hour12: false, 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return 'ERROR';
  }
}

// Archivos clave a verificar
const archivosClave = [
  'src/App.jsx',
  'server/server.js', 
  'package.json',
  'render.yaml',
  '.github/workflows/deploy-render.yml',
  'render-build.sh',
  'SOLUCION_RENDER.md',
  'debug-render.js',
  'deploy-render-fixed.js'
];

console.log('\n### ARCHIVOS CLAVE CON SUS TIMESTAMPS:');

archivosClave.forEach(archivo => {
  const ruta = path.join(__dirname, archivo);
  const timestamp = getTimestamp(ruta);
  const existe = fs.existsSync(ruta);
  
  console.log(`${existe ? '##' : '!!'} ${archivo}`);
  console.log(`   Modificado: ${timestamp}`);
  console.log(`   Existe: ${existe ? 'YES' : 'NO'}`);
  console.log('');
});

// Encontrar los más recientes
console.log('### ARCHIVOS MÁS RECIENTES:');

let archivosConTimestamp = [];

archivosClave.forEach(archivo => {
  const ruta = path.join(__dirname, archivo);
  if (fs.existsSync(ruta)) {
    const stats = fs.statSync(ruta);
    archivosConTimestamp.push({
      archivo,
      timestamp: stats.mtime,
      timestampStr: getTimestamp(ruta)
    });
  }
});

// Ordenar por timestamp (más reciente primero)
archivosConTimestamp.sort((a, b) => b.timestamp - a.timestamp);

console.log('\n## TOP 5 ARCHIVOS MÁS RECIENTES:');
archivosConTimestamp.slice(0, 5).forEach((item, index) => {
  console.log(`${index + 1}. ${item.archivo}`);
  console.log(`   ${item.timestampStr}`);
});

console.log('\n### ARCHIVOS MODIFICADOS DESDE LAS 11:08 AM:');

const onceOcho = new Date();
onceOcho.setHours(11, 8, 0, 0); // 11:08 AM hoy

const archivosRecientes = archivosConTimestamp.filter(item => 
  item.timestamp > onceOcho
);

if (archivosRecientes.length > 0) {
  console.log('\n## ARCHIVOS MODIFICADOS DESDE 11:08 AM:');
  archivosRecientes.forEach(item => {
    console.log(`## ${item.archivo}`);
    console.log(`   ${item.timestampStr}`);
  });
} else {
  console.log('\n!! No hay archivos modificados desde las 11:08 AM');
  console.log('!! Los archivos más recientes son anteriores a esa hora');
}

console.log('\n### RESUMEN:');
console.log(`## Total archivos verificados: ${archivosClave.length}`);
console.log(`## Archivos existentes: ${archivosConTimestamp.length}`);
console.log(`## Archivos modificados desde 11:08: ${archivosRecientes.length}`);

console.log('\n## VERIFICACIÓN COMPLETADA ##');
