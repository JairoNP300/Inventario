# Despliegue en Render - Sistema de Ventas e Inventario

## Cambios Aplicados

### 1. Actualización de Ubicaciones
- **Nuevas opciones en "UBICACIÓN ORIGEN":**
  - Ransa (id: 1)
  - Soyapango (id: 2) 
  - Usulután (id: 3)
  - Lomas de San Francisco (id: 4)

### 2. Lógica de Deducción de Stock
- El sistema ahora deduce stock de la bodega correcta según la ubicación seleccionada
- Ransa: bodega_1
- Soyapango: bodega_2
- Usulután: bodega_3
- Lomas de San Francisco: bodega_4

### 3. Configuración de Stock
- **100 unidades por producto en cada bodega**
- **Total: 400 unidades por producto**

## Configuración para Render

### Variables de Entorno
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://username:password@host:port/database
```

### Comandos de Despliegue
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

### Archivos Clave
- `server/server.js` - Servidor principal con lógica actualizada
- `server/init-db.js` - Inicialización de base de datos
- `render.yaml` - Configuración de Render
- `.env.example` - Plantilla de variables de entorno

## Estructura de Base de Datos

### Tabla Agros (Actualizada)
```sql
INSERT INTO agros (id, name) VALUES 
(1, 'Ransa'),
(2, 'Soyapango'),
(3, 'Usulután'),
(4, 'Lomas de San Francisco');
```

### Tabla Inventory
```sql
UPDATE inventory SET 
bodega_1 = 100, 
bodega_2 = 100, 
bodega_3 = 100, 
bodega_4 = 100,
initial_stock = 400,
current_stock = 400,
sold_stock = 0;
```

## Pasos para Despliegue

1. **Subir código a GitHub**
2. **Conectar repositorio a Render**
3. **Configurar variables de entorno**
4. **Desplegar aplicación**

## Verificación
- Acceder a: `https://ventas-e-inventario.onrender.com`
- Verificar que las opciones de ubicación sean las correctas
- Confirmar que el stock se muestre como 100 por bodega
