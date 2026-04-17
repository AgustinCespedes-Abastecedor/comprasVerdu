# CI/CD (GitHub Actions)

El repositorio tiene un pipeline de **calidad** en GitHub: todo lo que se mergea a `main` debe pasar lint, tests y build. El **despliegue en el servidor** lo hacés vos con **Docker Compose** (no hay workflows de deploy externos en este repo).

## Workflow: Lint, tests y build (`ci.yml`)

- **Cuándo:** en cada `push` y en cada **pull request** a `main` o `develop`.
- **Qué hace:**
  - Backend: instala dependencias, `prisma generate`, **lint**, **tests**.
  - Frontend: instala dependencias, **lint**, **build**, **tests unitarios**.
- **Importante:** Este job debe ser un **status check** obligatorio para poder mergear a `main` (ver más abajo).

## Producción: migraciones y arranque del backend

En la imagen Docker de producción (`backend/Dockerfile`), el contenedor ejecuta **`prisma migrate deploy`** antes de **`node src/index.js`**, así cada **`docker compose up -d --build`** aplica migraciones pendientes. El cliente Prisma se genera en el build (`prisma generate`). Evitá `prisma db push` en bases que ya siguen la carpeta `prisma/migrations/`.

## Configuración en GitHub

### Branch Protection (recomendado)

Para que **nada llegue a producción sin haber pasado los checks**:

1. Repo → **Settings** → **Branches** → **Add branch protection rule** (o editar la de `main`).
2. **Branch name pattern:** `main`.
3. Activar:
   - **Require a pull request before merging** (opcional pero recomendado).
   - **Require status checks to pass before merging**.
   - En "Status checks that are required", elegir el job de **CI** del workflow `ci.yml`.
   - **Require branches to be up to date before merging** (recomendado).
4. Guardar.

Así, ningún PR se puede mergear a `main` si el workflow de CI falla.

## Flujo resumido

1. Desarrollo en ramas → PR a `main`.
2. CI corre en el PR (lint, tests, build). Si falla, no se mergea (si Branch Protection lo exige).
3. Tras mergear, en el servidor: **`docker compose up -d --build`** (desde la raíz del repo; opcionalmente `./scripts/docker-compose-env.sh up -d --build` si usás `env` / `.env` en la raíz para variables de Compose).

## Comandos locales

Desde la raíz del repo:

- **Todo el CI (mismo orden que en GitHub):** `npm run ci`
- **Solo lint:** `npm run lint`
- **Solo tests:** `npm run test`

Por paquete:

- **Backend:** `npm run lint --prefix backend` y `npm run test --prefix backend`.
- **Frontend:** `npm run lint --prefix frontend`, `npm run test --prefix frontend`, `npm run build --prefix frontend`.
