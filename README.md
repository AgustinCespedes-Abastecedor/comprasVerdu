# Compras Verdu

Sistema web para cargar y consultar compras a proveedores. Incluye login por usuario, roles **Comprador** y **Visor**, y una planilla de compra tipo Excel con campos por color (amarillo = datos de BD, salmón = ingreso manual, verde = cálculos).

## Stack

- **Frontend:** React (Vite), React Router
- **Backend:** Node.js, Express
- **ORM y DB:** Prisma, PostgreSQL

## Requisitos

- Node.js 18+
- Docker (opcional, para levantar PostgreSQL en contenedor)

## Configuración

### 1. Base de datos con Docker

Con Docker iniciado, en la raíz del proyecto:

```bash
docker compose up -d
```

Esto crea la base **compras_verdu** en PostgreSQL 16 (puerto **5433** en el host para no chocar con un PostgreSQL local en 5432). El `backend/.env` ya está configurado para conectarse a ese contenedor.

Crear tablas y datos iniciales:

```bash
cd backend
npx prisma db push
node prisma/seed.js
```

Para bajar el contenedor: `docker compose down`. Los datos se conservan en el volumen `compras_verdu_pgdata`.

### 2. Backend

Si no usaste Docker, copiá `backend/.env.example` a `backend/.env` y configurá `DATABASE_URL` con tu PostgreSQL.

Instalar dependencias (y crear tablas/seed solo si no lo hiciste en el paso 1):

```bash
cd backend
npm install
npx prisma generate
# Si no usaste Docker o no ejecutaste antes:
# npx prisma db push
# node prisma/seed.js
```

Usuarios de prueba creados por el seed:

- **Comprador:** `comprador@comprasverdu.com` / `admin123`
- **Visor:** `visor@comprasverdu.com` / `admin123`

Iniciar el servidor:

```bash
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend corre en `http://localhost:5173` y usa el proxy a `http://localhost:4000` para las llamadas a `/api`.

## Documentación adicional

- **[Manual de usuario](docs/MANUAL_USUARIO.md):** guía para el usuario final: login, panel, nueva compra, recepción, ver compras/recepciones, Info Final de Artículos, gestión de usuarios y historial de actividad.
- **[Recepción e inventario](docs/RECEPCION_Y_STOCK.md):** aclara que registrar una recepción en ComprasVerdu **no actualiza inventario** y que la conciliación con stock se hace por otro canal.
- **[Precios y ventas](docs/PRECIOS_Y_VENTAS.md):** deja explícito que ComprasVerdu es solo **registro interno** y que la carga de precios al sistema de ventas es **100 % manual u otro sistema**.
- [Roles y permisos](docs/ROLES.md) · [Capacitor (app móvil)](docs/CAPACITOR.md)

## Uso

1. **Login / Registro:** en el login podés registrarte eligiendo rol **Comprador** o **Visor**.
2. **Comprador:** después del login tiene **Comprar** y **Ver Compras**.
   - En **Comprar** se muestra la planilla: fecha (por defecto hoy), selector de proveedor, tabla con productos. Los datos amarillos vienen de la BD; los salmones se completan a mano (bultos, precio por bulto, peso por bulto); los verdes se calculan (precio por kg, total por ítem). Al guardar se persiste la compra y se actualizan los totales del día.
3. **Visor:** solo puede entrar a **Ver Compras** para consultar compras guardadas (filtros por fecha y proveedor).

## CI/CD y despliegue

- **Pipeline:** En cada PR y push a `main`/`develop` se ejecuta **Lint, tests y build** (backend + frontend). Nada se deploya si falla. Ver [docs/CI-CD.md](docs/CI-CD.md) para Branch Protection, entornos **staging** y **production**, y deploy en Render desde GitHub Actions.

## Despliegue en Render

- **PostgreSQL:** crear un servicio PostgreSQL en Render y usar la `DATABASE_URL` interna que te da Render.
- **Backend:** crear un Web Service con el directorio `backend`, comando `npm install && npx prisma generate && npx prisma db push && npm start`. Definir variables de entorno: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` (URL del frontend en Render).
- **Frontend:** crear un sitio estático con el directorio `frontend`, build `npm run build`, carpeta public `dist`. Configurar la variable `VITE_API_URL` si el API está en otra URL (y usar esa variable en el cliente para las peticiones en producción).

Si en producción el frontend y el API están en el mismo dominio (reverse proxy), no hace falta cambiar la base de las peticiones.
