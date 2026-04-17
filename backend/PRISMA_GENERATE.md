# Cliente Prisma (generado)

El cliente se genera en **`node_modules/.prisma`** (comportamiento por defecto de Prisma).

## Comportamiento

- **`postinstall`** (`scripts/ensure-prisma.js`): ejecuta **`prisma generate`** tras `npm install` (si falla por EPERM en Windows, el install no se aborta y podés correr `npm run db:generate` con el backend cerrado).
- **`npm start`** (producción fuera de Docker): el script **`prestart`** ejecuta **`prisma migrate deploy`** y después arranca **`node src/index.js`**. En **Docker Compose** de producción, el `Dockerfile` del backend ejecuta el mismo `migrate deploy` antes de `node`.
- **`npm run dev`**: no ejecuta migraciones; en Docker de desarrollo el entrypoint corre `migrate deploy` antes de `npm run dev`.

## Si querés generar solo el cliente

Con el servidor **detenido**:

```powershell
cd backend
npx prisma generate
```
