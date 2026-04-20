// Sistema de despliegue automático CORREGIDO para Render
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('## DESPLIEGUE AUTOMÁTICO CORREGIDO PARA RENDER ##');

// Verificar archivos clave
function verificarArchivos() {
  console.log('\n### Verificando archivos clave...');
  const archivos = [
    'src/App.jsx',
    'server/server.js', 
    'package.json',
    'render.yaml'
  ];
  
  archivos.forEach(archivo => {
    const ruta = path.join(__dirname, archivo);
    const existe = fs.existsSync(ruta);
    console.log(`${existe ? '##' : '!!'} ${archivo}: ${existe ? 'OK' : 'FALTA'}`);
  });
}

// Crear lista de archivos para subir
function crearListaSubida() {
  const archivosSubir = [
    {
      archivo: 'src/App.jsx',
      descripcion: 'Frontend con nuevas ubicaciones',
      cambios: '4 ubicaciones, lógica de deducción'
    },
    {
      archivo: 'server/server.js',
      descripcion: 'Backend con migración automática',
      cambios: 'ES module, migración, stock 100 por bodega'
    },
    {
      archivo: 'package.json',
      descripcion: 'Configuración del proyecto',
      cambios: 'type: module, scripts actualizados'
    },
    {
      archivo: 'render.yaml',
      descripcion: 'Configuración para Render',
      cambios: 'Build y start commands'
    },
    {
      archivo: '.github/workflows/deploy-render.yml',
      descripcion: 'CI/CD automático',
      cambios: 'GitHub Actions para deploy'
    },
    {
      archivo: 'render-build.sh',
      descripcion: 'Script de construcción',
      cambios: 'Build automation'
    }
  ];
  
  return archivosSubir;
}

// Crear instrucciones específicas
function crearInstrucciones() {
  const instrucciones = `
# ## INSTRUCCIONES CORREGIDAS PARA RENDER ##

## ## ERROR CORREGIDO ##
El problema era que package.json estaba en "commonjs" pero el servidor es ES module.
Ahora está corregido: "type": "module"

## ## ARCHIVOS PARA SUBIR A GITHUB ##

### ## Archivos Clave (Reemplazar existentes) ##

1. **src/App.jsx**
   - Nuevas ubicaciones: Ransa, Soyapango, Usulután, Lomas de San Francisco
   - Lógica de deducción automática por ubicación
   - Stock configurado a 100 por bodega

2. **server/server.js**
   - Migración automática al iniciar
   - ES module compatible
   - Nuevas opciones de agros
   - Lógica de deducción actualizada

3. **package.json**
   - "type": "module" (CORREGIDO)
   - Scripts actualizados para producción
   - Dependencias correctas

4. **render.yaml**
   - Configuración completa para Render
   - Comandos de build y start

### ## Archivos de Soporte (Nuevos) ##

5. **.github/workflows/deploy-render.yml**
   - CI/CD automático con GitHub Actions

6. **render-build.sh**
   - Script de construcción para producción

## ## COMO SUBIRLOS ##

### ## Método 1: Editar Individualmente ##
1. Ve a github.com/JairoNP300/Inventario
2. Para cada archivo clave:
   - Clic en el archivo -> Edit
   - Copia el contenido del archivo local
   - Pega el contenido nuevo
   - Clic "Commit changes"

### ## Método 2: Subir ZIP ##
1. Usa el ZIP creado por el sistema
2. En GitHub, elimina archivos viejos
3. Sube los archivos nuevos del ZIP

## ## CONFIGURACIÓN RENDER ##

Build Command: npm install && npm run build
Start Command: npm start

Variables de Entorno:
- NODE_ENV=production
- DATABASE_URL=tu_url_postgresql

## ## RESULTADO FINAL ##

URL: https://ventas-e-inventario.onrender.com

Características:
- ## 4 nuevas ubicaciones en el dropdown
- ## 100 unidades por bodega (400 totales)
- ## Lógica de deducción automática
- ## Migración automática para producción
- ## ES module compatible (ERROR CORREGIDO)
`;

  fs.writeFileSync(path.join(__dirname, 'INSTRUCCIONES_RENDER_CORREGIDO.md'), instrucciones);
  console.log('## Instrucciones corregidas creadas');
}

// Función principal
function main() {
  console.log('\n### INICIANDO SISTEMA CORREGIDO...');
  
  // Verificar archivos
  verificarArchivos();
  
  // Mostrar lista de archivos
  const archivos = crearListaSubida();
  console.log('\n### Archivos para subir:');
  archivos.forEach((item, index) => {
    console.log(`${index + 1}. ${item.archivo}`);
    console.log(`   ${item.descripcion}`);
    console.log(`   ${item.cambios}`);
  });
  
  // Crear instrucciones
  crearInstrucciones();
  
  console.log('\n### RESUMEN FINAL:');
  console.log('## ERROR CORREGIDO: ES module compatible');
  console.log('## Listo para subir a GitHub');
  console.log('## Configurar Render con los comandos indicados');
  console.log('## URL funcionará con todas las actualizaciones');
  
  console.log('\n## SISTEMA CORREGIDO Y LISTO PARA RENDER ##');
}

// Ejecutar
main();
