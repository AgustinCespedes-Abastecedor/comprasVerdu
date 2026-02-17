# Cliente Prisma (generado)

El cliente de Prisma se genera en **`generated/client`** (fuera de `node_modules`) para evitar el error **EPERM** en Windows al reemplazar el `.dll` del motor.

## Comportamiento

- **`npm run dev`** y **`npm start`** ejecutan `prisma generate` **antes** de arrancar el servidor.
- Así el cliente se regenera siempre que inicias la app y ningún proceso tiene el archivo bloqueado.
- No hace falta ejecutar `npx prisma generate` a mano salvo que quieras generarlo sin levantar el servidor.

## Si querés generar solo el cliente

Con el servidor **detenido**:

```powershell
cd backend
npx prisma generate
```

Si el servidor está corriendo, no pasa nada: la próxima vez que lo inicies con `npm run dev` o `npm start` se volverá a generar.
