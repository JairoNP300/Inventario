# INSTRUCCIONES SIN GIT - RENDER DEPLOYMENT

## OPCIÓN 1: Instalar Git (Más fácil)

Ejecuta en terminal:
```bash
winget install --id Git.Git -e --source winget
```
Reinicia terminal y listo.

## OPCIÓN 2: Subir Manualmente (Sin Git)

### Paso 1: Crear ZIP del proyecto
1. Ve a la carpeta: `c:\Users\Zetin\Downloads\Ventas-e-inventario-main\Ventas-e-inventario-main`
2. Selecciona todos los archivos (Ctrl+A)
3. Clic derecho -> Enviar a -> Carpeta comprimida (zip)
4. Nombra el archivo: `ventas-inventario-actualizado.zip`

### Paso 2: Subir a GitHub
1. Ve a github.com y crea un nuevo repositorio
2. Nombre: `ventas-e-inventario-render`
3. Clic en "uploading an existing file"
4. Arrastra o selecciona tu archivo ZIP
5. Clic en "Commit changes"

### Paso 3: Configurar Render
1. Ve a render.com
2. New Web Service
3. Conecta tu nuevo repositorio
4. Configura:

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

### Paso 4: Base de Datos
1. En Render, crea PostgreSQL Database
2. Copia la URL de conexión
3. Pégala en DATABASE_URL

### Paso 5: Deploy
1. Clic en "Create Web Service"
2. Espera a que termine el deploy
3. Visita: https://ventas-e-inventario.onrender.com

## ¿QUÉ INCLUYE EL PROYECTO?

- Nuevas ubicaciones (Ransa, Soyapango, Usulután, Lomas)
- Stock de 100 por bodega
- Lógica de deducción automática
- Migración automática para producción
- Todo configurado para Render

## VERIFICACIÓN

Deberías ver en tu link:
- 4 opciones de ubicación en el dropdown
- Stock mostrando 100 por cada bodega
- Sistema funcionando correctamente

## LISTO

Con cualquiera de las dos opciones, tu link funcionará con todos los cambios aplicados.
