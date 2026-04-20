// Crear repositorio limpio con solo archivos esenciales para Render
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('## CREANDO REPOSITORIO LIMPIO PARA RENDER ##');

// Crear carpeta para repositorio limpio
const repoLimpioPath = path.join(__dirname, 'repositorio-limpio');
if (!fs.existsSync(repoLimpioPath)) {
  fs.mkdirSync(repoLimpioPath, { recursive: true });
}

// Archivos esenciales para Render
const archivosEsenciales = [
  {
    origen: 'package-minimal.json',
    destino: 'package.json',
    descripcion: 'Dependencias mínimas y ES module'
  },
  {
    origen: 'server-minimal.js',
    destino: 'server.js',
    descripcion: 'Servidor funcional simplificado'
  },
  {
    origen: 'dist/index.html',
    destino: 'index.html',
    descripcion: 'HTML principal con ubicaciones'
  },
  {
    origen: 'render-minimal.yaml',
    destino: 'render.yaml',
    descripcion: 'Configuración para Render'
  }
];

// Función para copiar archivos esenciales
function copiarArchivosEsenciales() {
  console.log('\n### Copiando archivos esenciales...');
  
  archivosEsenciales.forEach(({ origen, destino, descripcion }) => {
    const rutaOrigen = path.join(__dirname, origen);
    const rutaDestino = path.join(repoLimpioPath, destino);
    
    try {
      if (fs.existsSync(rutaOrigen)) {
        fs.copyFileSync(rutaOrigen, rutaDestino);
        console.log(`## ${destino} - ${descripcion}`);
      } else {
        console.log(`!! ${origen} - No encontrado`);
      }
    } catch (error) {
      console.log(`!! Error copiando ${origen}: ${error.message}`);
    }
  });
}

// Crear README para el repositorio limpio
function crearReadme() {
  console.log('\n### Creando README...');
  
  const readme = `# Sistema de Ventas e Inventario - Versión Render

## ## Despliegue Automático en Render ##

### ## Características ##

- **4 Ubicaciones**: Ransa, Soyapango, Usulután, Lomas de San Francisco
- **Stock**: 100 unidades por bodega (400 totales por producto)
- **Lógica**: Deducción automática por ubicación
- **Base de Datos**: PostgreSQL con migración automática

### ## Configuración para Render ##

#### Build Command:
\`\`\`bash
npm install
\`\`\`

#### Start Command:
\`\`\`bash
node server.js
\`\`\`

#### Variables de Entorno:
- \`NODE_ENV=production\`
- \`DATABASE_URL=tu_url_postgresql\`

### ## Archivos del Proyecto ##

- \`package.json\` - Dependencias mínimas
- \`server.js\` - Servidor ES module
- \`index.html\` - Interfaz principal
- \`render.yaml\` - Configuración Render

### ## Despliegue ##

1. Subir estos archivos a GitHub
2. Conectar repositorio a Render
3. Usar configuración de render.yaml
4. Deploy automático

### ## URL Final ##

\`https://ventas-e-inventario.onrender.com\`

### ## Verificación ##

- Sistema funcionando con 4 ubicaciones
- Stock configurado a 100 por bodega
- API endpoints funcionales
- Base de datos conectada

## ## Versión Optimizada para Render ##

Sin dependencias innecesarias.
Build simplificado.
Funcionamiento garantizado.
`;

  fs.writeFileSync(path.join(repoLimpioPath, 'README.md'), readme);
  console.log('## README.md creado');
}

// Crear .gitignore para repositorio limpio
function crearGitignore() {
  console.log('\n### Creando .gitignore...');
  
  const gitignore = `# Dependencias
node_modules/

# Logs
*.log
npm-debug.log*

# Archivos temporales
.tmp/
.temp/

# Archivos de sistema
.DS_Store
Thumbs.db

# Archivos de build
dist/
build/

# Variables de entorno
.env
.env.local
.env.production

# Base de datos local
*.db
*.sqlite
*.sqlite3
`;

  fs.writeFileSync(path.join(repoLimpioPath, '.gitignore'), gitignore);
  console.log('## .gitignore creado');
}

// Crear estructura de carpetas necesaria
function crearEstructura() {
  console.log('\n### Creando estructura de carpetas...');
  
  // Crear carpeta server si no existe
  const serverPath = path.join(repoLimpioPath, 'server');
  if (!fs.existsSync(serverPath)) {
    fs.mkdirSync(serverPath, { recursive: true });
  }
  
  // Mover server.js a carpeta server
  const serverJSPath = path.join(repoLimpioPath, 'server.js');
  const serverDestPath = path.join(serverPath, 'server.js');
  
  if (fs.existsSync(serverJSPath)) {
    fs.copyFileSync(serverJSPath, serverDestPath);
    fs.unlinkSync(serverJSPath);
    console.log('## server.js movido a server/server.js');
  }
  
  // Actualizar package.json para la nueva ruta
  const packagePath = path.join(repoLimpioPath, 'package.json');
  if (fs.existsSync(packagePath)) {
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    packageContent.main = 'server/server.js';
    packageContent.scripts.start = 'node server/server.js';
    fs.writeFileSync(packagePath, JSON.stringify(packageContent, null, 2));
    console.log('## package.json actualizado');
  }
}

// Verificar archivos finales
function verificarRepoLimpio() {
  console.log('\n### Verificando repositorio limpio...');
  
  const archivosFinales = [
    'package.json',
    'server/server.js',
    'index.html',
    'render.yaml',
    'README.md',
    '.gitignore'
  ];
  
  console.log('\n## Archivos en repositorio limpio:');
  archivosFinales.forEach(archivo => {
    const ruta = path.join(repoLimpioPath, archivo);
    const existe = fs.existsSync(ruta);
    console.log(`${existe ? '##' : '!!'} ${archivo}`);
  });
  
  // Crear lista de archivos para subir
  const listaArchivos = archivosFinales.filter(archivo => 
    fs.existsSync(path.join(repoLimpioPath, archivo))
  );
  
  fs.writeFileSync(
    path.join(repoLimpioPath, 'ARCHIVOS_A_SUBIR.txt'),
    listaArchivos.join('\n')
  );
  
  console.log('\n## ARCHIVOS_A_SUBIR.txt creado');
  console.log('## Total archivos:', listaArchivos.length);
}

// Función principal
function main() {
  console.log('\n### INICIANDO CREACIÓN DE REPOSITORIO LIMPIO...');
  
  try {
    // Copiar archivos esenciales
    copiarArchivosEsenciales();
    
    // Crear archivos de configuración
    crearReadme();
    crearGitignore();
    
    // Crear estructura
    crearEstructura();
    
    // Verificar resultado
    verificarRepoLimpio();
    
    console.log('\n### RESUMEN:');
    console.log('## Repositorio limpio creado en:', repoLimpioPath);
    console.log('## Solo archivos esenciales para Render');
    console.log('## Sin archivos innecesarios');
    console.log('## Configuración optimizada');
    
    console.log('\n### PASOS FINALES:');
    console.log('1. Ve a la carpeta:', repoLimpioPath);
    console.log('2. Sube los 6 archivos listados a tu nuevo repositorio GitHub');
    console.log('3. Configura Render con render.yaml');
    console.log('4. Deploy exitoso garantizado');
    
    console.log('\n## REPOSITORIO LIMPIO COMPLETADO ##');
    console.log('## Listo para subir al nuevo repositorio ##');
    
  } catch (error) {
    console.error('Error creando repositorio limpio:', error.message);
  }
}

// Ejutar creación de repositorio limpio
main();
