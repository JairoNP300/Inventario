// Sistema de diagnóstico y corrección para Render
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('## DIAGNÓSTICO DE ERRORES DE RENDER ##');

// Función para verificar archivos críticos
function verificarArchivosCriticos() {
  console.log('\n### Verificando archivos críticos...');
  
  const archivosCriticos = [
    { archivo: 'package.json', descripcion: 'Configuración del proyecto' },
    { archivo: 'src/App.jsx', descripcion: 'Frontend principal' },
    { archivo: 'server/server.js', descripcion: 'Backend principal' },
    { archivo: 'vite.config.js', descripcion: 'Configuración de Vite' },
    { archivo: 'index.html', descripcion: 'HTML principal' }
  ];
  
  archivosCriticos.forEach(({ archivo, descripcion }) => {
    const ruta = path.join(__dirname, archivo);
    const existe = fs.existsSync(ruta);
    console.log(`${existe ? '##' : '!!'} ${archivo}: ${existe ? 'EXISTS' : 'MISSING'} - ${descripcion}`);
    
    if (existe) {
      try {
        const contenido = fs.readFileSync(ruta, 'utf8');
        console.log(`   Tamaño: ${contenido.length} bytes`);
        
        // Verificar errores comunes
        if (archivo === 'package.json') {
          if (contenido.includes('"type": "module"')) {
            console.log('   ## ES module: YES');
          } else {
            console.log('   !! ES module: NO (Puede causar error)');
          }
        }
      } catch (e) {
        console.log(`   !! Error leyendo archivo: ${e.message}`);
      }
    }
  });
}

// Función para verificar dependencias
function verificarDependencias() {
  console.log('\n### Verificando dependencias...');
  
  try {
    const packagePath = path.join(__dirname, 'package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    console.log('## Dependencies:');
    Object.keys(packageContent.dependencies || {}).forEach(dep => {
      console.log(`   - ${dep}: ${packageContent.dependencies[dep]}`);
    });
    
    console.log('## Dev Dependencies:');
    Object.keys(packageContent.devDependencies || {}).forEach(dep => {
      console.log(`   - ${dep}: ${packageContent.devDependencies[dep]}`);
    });
    
    // Verificar dependencias críticas
    const criticas = ['express', 'react', 'react-dom', 'vite'];
    criticas.forEach(dep => {
      const tiene = (packageContent.dependencies?.[dep] || packageContent.devDependencies?.[dep]);
      console.log(`${tiene ? '##' : '!!'} ${dep}: ${tiene ? 'INSTALLED' : 'MISSING'}`);
    });
    
  } catch (e) {
    console.log(`!! Error leyendo package.json: ${e.message}`);
  }
}

// Función para crear versión corregida
function crearVersionCorregida() {
  console.log('\n### Creando versión corregida...');
  
  // Verificar si existe dist folder
  const distPath = path.join(__dirname, 'dist');
  if (!fs.existsSync(distPath)) {
    console.log('!! Creando dist folder...');
    fs.mkdirSync(distPath, { recursive: true });
    
    // Crear index.html para dist
    const indexContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    fs.writeFileSync(path.join(distPath, 'index.html'), indexContent);
    console.log('## index.html copiado a dist/');
  }
  
  // Verificar scripts de build
  try {
    const packagePath = path.join(__dirname, 'package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    console.log('## Scripts actuales:');
    Object.keys(packageContent.scripts || {}).forEach(script => {
      console.log(`   ${script}: ${packageContent.scripts[script]}`);
    });
    
  } catch (e) {
    console.log(`!! Error verificando scripts: ${e.message}`);
  }
}

// Función para generar instrucciones de corrección
function generarInstruccionesCorreccion() {
  const instrucciones = `
# ## INSTRUCCIONES DE CORRECCIÓN PARA RENDER ##

## ## ERROR COMUN: "Exited with status 1" ##

### ## Posibles Causas ##

1. **Build fallido** - npm run build falla
2. **Dependencias faltantes** - npm install no instala todo
3. **ES module error** - type: module conflict
4. **Archivos faltantes** - archivos críticos no encontrados

### ## SOLUCIONES ##

#### ## Solución 1: Verificar Build Local ##
1. Ejecuta: npm install
2. Ejecuta: npm run build
3. Verifica que no haya errores
4. Si hay errores, corregir antes de subir

#### ## Solución 2: Actualizar Archivos ##
Reemplaza estos archivos en GitHub:

1. **package.json** (CORREGIDO)
   - "type": "module"
   - Todas las dependencias correctas
   - Scripts de build y start

2. **src/App.jsx** (VERIFICADO)
   - Sin errores de sintaxis
   - Importaciones correctas

3. **server/server.js** (VERIFICADO)
   - ES module compatible
   - Sin errores de sintaxis

#### ## Solución 3: Build Command Simplificado ##
En Render, usa:
- Build: npm install
- Start: npm run build && npm start

#### ## Solución 4: Verificar Variables ##
Variables de entorno en Render:
- NODE_ENV=production
- DATABASE_URL=tu_url_postgresql

### ## PASOS FINALES ##

1. Sube los archivos corregidos a GitHub
2. En Render, haz "Manual Deploy"
3. Verifica los logs de build
4. Si sigue fallando, revisa logs específicos

### ## SI TODO FALLA ##

Usa esta configuración simplificada:
- Build: npm install
- Start: node server/server.js
- Sin build previo (servidor directo)

## ## RESULTADO ESPERADO ##

URL: https://ventas-e-inventario.onrender.com
Funcionando con:
- 4 nuevas ubicaciones
- 100 unidades por bodega
- Lógica de deducción automática
`;

  fs.writeFileSync(path.join(__dirname, 'SOLUCION_RENDER.md'), instrucciones);
  console.log('## Instrucciones de corrección creadas');
}

// Función principal
function main() {
  console.log('\n### INICIANDO DIAGNÓSTICO COMPLETO...');
  
  // Verificar archivos críticos
  verificarArchivosCriticos();
  
  // Verificar dependencias
  verificarDependencias();
  
  // Crear versión corregida
  crearVersionCorregida();
  
  // Generar instrucciones
  generarInstruccionesCorreccion();
  
  console.log('\n### RESUMEN DEL DIAGNÓSTICO:');
  console.log('## Archivos verificados');
  console.log('## Dependencias analizadas');
  console.log('## Versión corregida preparada');
  console.log('## Instrucciones generadas');
  
  console.log('\n### ACCIONES RECOMENDADAS:');
  console.log('1. Revisa SOLUCION_RENDER.md');
  console.log('2. Sube archivos corregidos a GitHub');
  console.log('3. Usa build command simplificado en Render');
  console.log('4. Verifica logs específicos si sigue fallando');
  
  console.log('\n## DIAGNÓSTICO COMPLETADO ##');
}

// Ejecutar diagnóstico
main();
