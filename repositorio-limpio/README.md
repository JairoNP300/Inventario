# Sistema de Ventas e Inventario - Versión Render

## ## Despliegue Automático en Render ##

### ## Características ##

- **4 Ubicaciones**: Ransa, Soyapango, Usulután, Lomas de San Francisco
- **Stock**: 100 unidades por bodega (400 totales por producto)
- **Lógica**: Deducción automática por ubicación
- **Base de Datos**: PostgreSQL con migración automática

### ## Configuración para Render ##

#### Build Command:
```bash
npm install
```

#### Start Command:
```bash
node server.js
```

#### Variables de Entorno:
- `NODE_ENV=production`
- `DATABASE_URL=tu_url_postgresql`

### ## Archivos del Proyecto ##

- `package.json` - Dependencias mínimas
- `server.js` - Servidor ES module
- `index.html` - Interfaz principal
- `render.yaml` - Configuración Render

### ## Despliegue ##

1. Subir estos archivos a GitHub
2. Conectar repositorio a Render
3. Usar configuración de render.yaml
4. Deploy automático

### ## URL Final ##

`https://ventas-e-inventario.onrender.com`

### ## Verificación ##

- Sistema funcionando con 4 ubicaciones
- Stock configurado a 100 por bodega
- API endpoints funcionales
- Base de datos conectada

## ## Versión Optimizada para Render ##

Sin dependencias innecesarias.
Build simplificado.
Funcionamiento garantizado.
