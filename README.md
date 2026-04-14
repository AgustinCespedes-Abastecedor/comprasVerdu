# Compras Verdu

Sistema web para cargar y consultar compras a proveedores. Incluye login por usuario, roles **Comprador**, **Recepcionista** y **Visor**, y una planilla de compra tipo Excel con campos por color (amarillo = datos de BD, salmón = ingreso manual, verde = cálculos).

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

Esto crea la base **compras_verdu** en PostgreSQL 16. El servicio `db` solo escucha en la red interna de Compose (no se publica en el host).

Crear tablas y **roles** iniciales en Postgres (los usuarios vienen de **ELABASTECEDOR** si `EXTERNAL_AUTH_LOGIN=true`):

```bash
cd backend
npx prisma db push
```

Seed de roles (desde la **raíz del repo**, con el stack levantado; ejecuta el seed dentro del contenedor `backend`):

```bash
npm run db:seed
```

Para Postgres solo en el host (puerto **5433**, por defecto sin chocar con otro Postgres en 5432), usá `docker compose -f docker-compose.db.yml up -d` y `DATABASE_URL` como en `backend/.env.example`.

Para bajar el contenedor: `docker compose down`. Los datos se conservan en el volumen `compras_verdu_pgdata`.

### 1b. Entorno Docker local (pruebas antes de producción)

Levanta **PostgreSQL + API (modo desarrollo) + Vite con hot reload**; el código de `backend/` y `frontend/` está montado en volumen, así que los cambios se reflejan al guardar archivos.

```bash
docker compose -f docker-compose.dev.yml up --build
```

- **App:** http://localhost:5173  
- **API:** http://localhost:4000/api  
- **Postgres en el host (opcional):** puerto `5433` (usuario/contraseña por defecto como en el compose de desarrollo).

La primera vez, en otra terminal, podés cargar datos de prueba:

```bash
docker compose -f docker-compose.dev.yml exec backend npm run db:seed
```

Para integración con SQL Server en local, definí las variables `EXTERNAL_*` en el entorno antes de levantar el compose (o usá un archivo `--env-file` con solo esas variables; no reutilices `DATABASE_URL` de un `.env` pensado para el host si apunta a `localhost` del contenedor).

Para detener: `docker compose -f docker-compose.dev.yml down` (los datos de Postgres de desarrollo quedan en el volumen `compras_verdu_pgdata_dev`).

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

- **Administrador (soporte local):** `admin@comprasverdu.com` / `admin1234` (solo si `EXTERNAL_AUTH_LOGIN` no fuerza solo SQL Server)
- **Comprador:** `comprador@comprasverdu.com` / `admin123`
- **Recepcionista:** `recepcionista@comprasverdu.com` / `admin123`
- **Visor:** `visor@comprasverdu.com` / `admin123`

Iniciar el servidor:

```bash
npm run dev
```

### 3. Frontend (solo) o ambos servicios con un comando

Desde la **raíz del repo**, con dependencias ya instaladas en `backend/` y `frontend/`:

```bash
npm install
```

Si no tenés PostgreSQL local con la misma `DATABASE_URL` que en `backend/.env`, levantá solo la base en Docker:

```bash
npm run dev:db
```

La primera vez (o si la base está vacía), podés preparar todo de una vez:

```bash
npm run setup:dev
```

Luego:

```bash
npm run dev
```

Eso levanta **backend** (`http://localhost:4000`) y **frontend** (`http://localhost:5173`) a la vez. El frontend usa el proxy de Vite hacia el API en `/api`.

Si el puerto **5432** del host ya está ocupado, antes de `npm run dev:db` podés usar `POSTGRES_HOST_PORT=5433` y en `backend/.env` poner `DATABASE_URL` con puerto `5433`.

Para levantar solo uno:

```bash
npm run dev:backend
npm run dev:frontend
```

Si preferís entrar a cada carpeta:

```bash
cd frontend
npm install
npm run dev
```

El frontend corre en `http://localhost:5173` y usa el proxy a `http://localhost:4000` para las llamadas a `/api`.

## Documentación adicional

- **[Clave de usuarios ELAB (SQL Server)](docs/CLAVE_USUARIOS_ELAB.md):** cómo se almacena la contraseña en la columna `Clave` del ERP (cifrado legado por desplazamiento ASCII) y cómo la valida la app frente a otros formatos (texto plano, hash, `PWDCOMPARE`).
- **[Sincronizar roles en Postgres](docs/SYNC_ROLES.md):** seed e import/export de roles entre entornos cuando el código no actualiza solo la base.
- **[Manual de usuario](docs/MANUAL_USUARIO.md):** guía para el usuario final: login, panel, nueva compra, recepción, ver compras/recepciones, Info Final de Artículos, gestión de usuarios y historial de actividad.
- **[Recepción e inventario](docs/RECEPCION_Y_STOCK.md):** aclara que registrar una recepción en ComprasVerdu **no actualiza inventario** y que la conciliación con stock se hace por otro canal.
- **[Precios y ventas](docs/PRECIOS_Y_VENTAS.md):** deja explícito que ComprasVerdu es solo **registro interno** y que la carga de precios al sistema de ventas es **100 % manual u otro sistema**.
- [Roles y permisos](docs/ROLES.md) · [Capacitor (app móvil)](docs/CAPACITOR.md)

## Uso

1. **Login / Registro:** en el login podés registrarte eligiendo rol **Comprador**, **Recepcionista** o **Visor**.
2. **Comprador:** después del login tiene **Comprar** y **Ver Compras**.
   - En **Comprar** se muestra la planilla: fecha (por defecto hoy), selector de proveedor, tabla con productos. Los datos amarillos vienen de la BD; los salmones se completan a mano (bultos, precio por bulto, peso por bulto); los verdes se calculan (precio por kg, total por ítem). Al guardar se persiste la compra y se actualizan los totales del día.
3. **Recepcionista:** no puede crear compras. Su foco es **Recepción de compras**, además de **Ver Compras**, **Ver recepciones** e **Info Final de Artículos**.
4. **Visor:** solo puede entrar a **Ver Compras** para consultar compras guardadas (filtros por fecha y proveedor).

## CI/CD y despliegue

- **Pipeline:** En cada PR y push a `main`/`develop` se ejecuta **Lint, tests y build** (backend + frontend). Nada se deploya si falla. Ver [docs/CI-CD.md](docs/CI-CD.md) para Branch Protection, entornos **staging** y **production**, y deploy en Render desde GitHub Actions.

## Despliegue en Render

- **PostgreSQL:** crear un servicio PostgreSQL en Render y usar la `DATABASE_URL` interna que te da Render.
- **Backend:** crear un Web Service con el directorio `backend`, comando `npm install && npx prisma generate && npx prisma db push && npm start`. Definir variables de entorno: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` (URL del frontend en Render).
- **Frontend:** crear un sitio estático con el directorio `frontend`, build `npm run build`, carpeta public `dist`. Configurar la variable `VITE_API_URL` si el API está en otra URL (y usar esa variable en el cliente para las peticiones en producción).

Si en producción el frontend y el API están en el mismo dominio (reverse proxy), no hace falta cambiar la base de las peticiones.
