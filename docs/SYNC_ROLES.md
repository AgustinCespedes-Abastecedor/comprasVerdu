# Sincronizar roles entre entornos (Postgres)

El código (`nivelRol.js`, `.env`) define **reglas de Nivel** para login; las **descripciones y permisos** por rol viven en la tabla `Role` en Postgres. Un `git pull` en el servidor **no** actualiza esa tabla: hay que ejecutar seed o importar un snapshot.

## Opción A — Solo catálogo del repo (roles por defecto)

En el servidor de producción, con `DATABASE_URL` apuntando a la BD de prod:

```bash
cd backend
npm install
npm run db:seed
```

Esto hace `upsert` por `nombre` y actualiza `descripcion` y `permisos` según `prisma/rolesCatalog.js` (mismo criterio que `prisma/seed.js`).

## Opción B — Copiar todos los roles de localhost a producción

Incluye roles extra creados en gestión de roles en local.

1. **En tu máquina (localhost)**, con `.env` apuntando a la BD local:

   ```bash
   cd backend
   npm run db:export-roles > roles-export.json
   ```

2. Subí `roles-export.json` al servidor de forma segura (SCP, secreto en CI, etc.).

3. **En producción**, con `DATABASE_URL` de prod:

   ```bash
   cd backend
   npm install
   npm run db:import-roles -- /ruta/a/roles-export.json
   ```

El import **no borra** roles que no estén en el JSON; solo crea o actualiza por `nombre` único. Los `id` internos se mantienen en actualizaciones, así que los usuarios ya asignados siguen válidos.

## Nota sobre reglas de Nivel (10–20, login mínimo, etc.)

Eso se aplica con el **código desplegado** y variables `EXTERNAL_NIVEL_*` / `EXTERNAL_NIVEL_LOGIN_MIN` en el `.env` del backend en prod, no con el seed de roles.
