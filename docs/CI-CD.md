# CI/CD y entornos (GitHub Actions)

El repositorio tiene pipelines para **no deployar nada que no pueda pasar a producción**: todo lo que se mergea a `main` debe pasar lint, tests y build.

## Workflows

### 1. Lint, tests y build (`ci.yml`)

- **Cuándo:** en cada `push` y en cada **pull request** a `main` o `develop`.
- **Qué hace:**
  - Backend: instala dependencias, `prisma generate`, **lint**, **tests**.
  - Frontend: instala dependencias, **lint**, **build**, **tests unitarios**.
- **Importante:** Este job debe ser un **status check** obligatorio para poder mergear a `main` (ver más abajo).

### 2. Deploy Staging (`deploy-staging.yml`)

- **Cuándo:** en cada `push` a `main` (después del merge).
- **Environment:** `staging` (configurable en GitHub → Settings → Environments).
- **Opcional:** Si en el repo configurás el secret `RENDER_DEPLOY_HOOK_STAGING` con la URL del Deploy Hook de Render del servicio de staging, el workflow dispara el deploy automáticamente.

### 3. Deploy Production (`deploy-production.yml`)

- **Cuándo:** manual (`workflow_dispatch`) o al publicar un **release**.
- **Environment:** `production` (podés exigir aprobación en GitHub).
- **Opcional:** Secret `RENDER_DEPLOY_HOOK_PRODUCTION` para disparar el deploy en Render desde el workflow.

## Configuración en GitHub

### Branch Protection (recomendado)

Para que **nada llegue a producción sin haber pasado los checks**:

1. Repo → **Settings** → **Branches** → **Add branch protection rule** (o editar la de `main`).
2. **Branch name pattern:** `main`.
3. Activar:
   - **Require a pull request before merging** (opcional pero recomendado).
   - **Require status checks to pass before merging**.
   - En "Status checks that are required", elegir: **CI** (o el nombre exacto del job: **Lint, tests y build** → el nombre del job es "CI" en el workflow).
   - **Require branches to be up to date before merging** (recomendado).
4. Guardar.

Así, ningún PR se puede mergear a `main` si el workflow de CI falla.

### Entornos Staging y Production

1. Repo → **Settings** → **Environments**.
2. Crear **staging** y **production**.
3. En **production** podés activar **Required reviewers** para que el deploy a producción exija aprobación.
4. En cada environment podés definir **secrets** (por ejemplo `RENDER_DEPLOY_HOOK_STAGING`, `RENDER_DEPLOY_HOOK_PRODUCTION`).

### Deploy Hooks en Render

- En cada servicio (staging/producción) en Render: **Settings** → **Deploy Hook** → copiar la URL.
- En GitHub: **Settings** → **Secrets and variables** → **Actions** (o en el environment correspondiente) → **New repository secret**:
  - `RENDER_DEPLOY_HOOK_STAGING`
  - `RENDER_DEPLOY_HOOK_PRODUCTION`

## Flujo resumido

1. Desarrollo en ramas → PR a `main`.
2. CI corre en el PR (lint, tests, build). Si falla, no se puede mergear.
3. Merge a `main` → CI vuelve a correr (por el push) → si pasa, se ejecuta **Deploy Staging**.
4. Producción: solo cuando alguien ejecuta el workflow manualmente o publica un release; opcionalmente con aprobación en el environment **production**.

## Comandos locales

Desde la raíz del repo:

- **Todo el CI (mismo orden que en GitHub):** `npm run ci`
- **Solo lint:** `npm run lint`
- **Solo tests:** `npm run test`

Por paquete:

- **Backend:** `npm run lint --prefix backend` y `npm run test --prefix backend`.
- **Frontend:** `npm run lint --prefix frontend`, `npm run test --prefix frontend`, `npm run build --prefix frontend`.
