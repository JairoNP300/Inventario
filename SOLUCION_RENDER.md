
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
