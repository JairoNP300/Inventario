# Instrucciones de Despliegue en Render

## Resumen de Cambios Aplicados

### 1. Ubicaciones Actualizadas
- **Nuevas opciones en "UBICACIÓN ORIGEN":**
  - Ransa (id: 1)
  - Soyapango (id: 2) 
  - Usulután (id: 3)
  - Lomas de San Francisco (id: 4)

### 2. Stock Configurado
- **100 unidades por producto en cada bodega**
- **Total: 400 unidades por producto**

### 3. Lógica de Deducción
- El sistema deduce stock de la bodega correcta según la ubicación seleccionada
- Conversión automática de unidades (Kg, Lbs, Cajas)

## Configuración para Render

### 1. Archivos Clave Creados/Modificados
- `render.yaml` - Configuración del servicio
- `server/migrate-db.js` - Script de migración
- `DEPLOYMENT.md` - Documentación técnica
- `.env.example` - Plantilla de variables de entorno

### 2. Variables de Entorno Requeridas
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://username:password@host:port/database
```

### 3. Comandos de Despliegue
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

## Pasos para Despliegue

### Paso 1: Subir a GitHub
1. Commit todos los cambios
2. Push al repositorio

### Paso 2: Configurar en Render
1. Conectar el repositorio a Render
2. Configurar las variables de entorno
3. Seleccionar "Web Service"
4. Usar los comandos de build y start

### Paso 3: Base de Datos
1. Crear base de datos PostgreSQL en Render
2. Configurar DATABASE_URL con las credenciales
3. La migración se ejecuta automáticamente al iniciar

## Verificación

Después del despliegue, verificar:

1. **URL:** `https://ventas-e-inventario.onrender.com`
2. **Ubicaciones:** Deben mostrar las 4 nuevas opciones
3. **Stock:** 100 unidades por bodega (400 totales)
4. **Deducción:** Funciona correctamente al hacer ventas

## Archivos para Subir

Asegúrate de incluir todos estos archivos en el repositorio:

- `src/` - Código fuente del frontend
- `server/` - Servidor backend con migración
- `package.json` - Dependencias y scripts
- `render.yaml` - Configuración de Render
- `dist/` - Archivos construidos
- `inventario_oficial.db` - Base de datos local (para desarrollo)

## Notas Importantes

- La migración se ejecuta automáticamente al iniciar el servidor
- Los cambios en las ubicaciones y stock se aplican en producción
- El sistema está configurado para PostgreSQL en producción
- El frontend ya incluye toda la lógica actualizada
