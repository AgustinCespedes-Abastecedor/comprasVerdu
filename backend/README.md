# Backend – Compras Verdú

API en Node.js (Express) con Prisma y PostgreSQL.

## Requisitos

- Node.js 18+
- PostgreSQL (variable `DATABASE_URL` en `.env`)

## Uso

```bash
# Instalar dependencias (genera el cliente Prisma automáticamente)
npm install

# Desarrollo (recarga al cambiar archivos)
npm run dev

# Producción
npm start
```

## Si el backend no arranca

1. **Error de Prisma / base de datos**  
   Asegurate de tener `.env` con `DATABASE_URL` y que PostgreSQL esté levantado.

2. **En Windows: "EPERM" o "operation not permitted" al instalar**  
   Puede pasar si un proceso (antivirus, otra terminal) tiene bloqueado el motor de Prisma.  
   - Cerrá cualquier instancia del backend.  
   - Ejecutá: `npm run db:generate`.  
   - Volvé a ejecutar: `npm run dev`.

3. **Puerto 4000 en uso**  
   Usá otro puerto: `$env:PORT=4001; npm run dev` (PowerShell) o `set PORT=4001 && npm run dev` (CMD).

## Scripts

| Script          | Descripción                          |
|-----------------|--------------------------------------|
| `npm run dev`   | Servidor con recarga automática      |
| `npm start`     | Servidor para producción             |
| `npm run db:generate` | Regenerar cliente Prisma (tras cambiar el schema) |
| `npm run db:push`    | Aplicar schema a la base             |
| `npm run db:migrate` | Crear/aplicar migraciones            |
| `npm run db:seed`    | Ejecutar seed                        |

## Stock desde ELABASTECEDOR (SQL Server)

El stock de cada artículo se obtiene de la tabla **Stock** en la base externa. Si en la planilla ves ceros o datos que no cambian:

1. Revisá el `.env`: `EXTERNAL_DB_SERVER`, `EXTERNAL_DB_DATABASE`, `EXTERNAL_STOCK_TABLE`, `EXTERNAL_STOCK_SUCURSAL`, `EXTERNAL_STOCK_CODIGO`, `EXTERNAL_STOCK_STOCK`.
2. Ejecutá el diagnóstico (desde la carpeta `backend`):
   ```bash
   node scripts/diagnostic-stock-elabastecedor.js
   ```
   Opcional: pasá un código de artículo para filtrar, ej. `node scripts/diagnostic-stock-elabastecedor.js 3065`.
   El script muestra tablas/columnas de Stock y filas de ejemplo para verificar nombres y formato de datos.
