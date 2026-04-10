# GUÍA COMPLETA - CONFIGURACIÓN PARA RENDER

## RESUMEN: Todo está listo, solo sigue estos pasos

### PASO 1: Subir a GitHub (Manual)

Copia y pega estos comandos en tu terminal local:

```bash
# Navegar a la carpeta del proyecto
cd "c:\Users\Zetin\Downloads\Ventas-e-inventario-main\Ventas-e-inventario-main"

# Inicializar git si no está hecho
git init
git add .

# Hacer commit con todos los cambios
git commit -m "Actualización completa: Nuevas ubicaciones, stock 100 por bodega, y migración automática para Render"

# Conectar a tu repositorio GitHub (reemplaza TU_USUARIO y TU_REPO)
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git branch -M main
git push -u origin main
```

### PASO 2: Configurar Render

1. **Ve a render.com** y logueate
2. **Crea New Web Service**
3. **Conecta tu repositorio GitHub**
4. **Configura así:**

**Build Command:**
```
npm install && npm run build
```

**Start Command:**
```
npm start
```

**Variables de Entorno:**
```
NODE_ENV=production
DATABASE_URL=tu_url_postgresql_aqui
```

### PASO 3: Base de Datos

1. **En Render, crea PostgreSQL Database**
2. **Copia la URL de conexión**
3. **Pégala en DATABASE_URL**

### PASO 4: Verificación

Una vez desplegado, visita:
`https://ventas-e-inventario.onrender.com`

Deberías ver:
- 4 opciones de ubicación (Ransa, Soyapango, Usulután, Lomas de San Francisco)
- Stock de 100 por bodega
- Sistema funcionando correctamente

## ¿QUÉ HICÉ POR TI?

### Archivos Modificados/Creados:
- `server/server.js` - Con migración automática
- `src/App.jsx` - Nuevas ubicaciones y lógica
- `render.yaml` - Configuración para Render
- `RENDER_DEPLOYMENT.md` - Documentación técnica

### Cambios Aplicados:
1. **Ubicaciones actualizadas** en el dropdown de facturación
2. **Stock configurado** a 100 por bodega (400 totales)
3. **Lógica de deducción** funciona por ubicación
4. **Migración automática** para producción

### Base de Datos:
- **agros:** Ransa(1), Soyapango(2), Usulután(3), Lomas(4)
- **inventory:** 100 unidades por bodega para todos los productos

## SI ALGO FALLA:

**Error 500:** Revisa variables de entorno en Render
**No carga:** Espera a que termine el deploy
**Ubicaciones incorrectas:** Verifica que la migración se ejecutó

## LISTO PARA USAR:

El sistema está completamente configurado y listo para producción en Render.

Solo necesitas:
1. Subir a GitHub con los comandos de arriba
2. Configurar Render con la información proporcionada
3. ¡Listo! Tu link funcionará con todos los cambios
