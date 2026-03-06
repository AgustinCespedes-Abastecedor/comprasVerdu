# Análisis de seguridad – Compras Verdu

Este documento resume el análisis de seguridad frente a ataques en red/Internet y las modificaciones recomendadas.

---

## Resumen ejecutivo

- **Backend (Express + Prisma):** Autenticación JWT, autorización por permisos, CORS configurado, body limit, consultas parametrizadas. **Riesgos principales:** JWT con valor por defecto en producción, ausencia de rate limiting y de cabeceras de seguridad (Helmet).
- **Frontend (React):** Sin `dangerouslySetInnerHTML`; token en `localStorage` (riesgo limitado si no hay XSS). Manual desde archivo estático; React Markdown no interpreta HTML crudo por defecto.
- **Base de datos:** Uso de Prisma y consultas parametrizadas; en logs y SQL Server los valores dinámicos van como parámetros, no concatenados. No se detectaron vectores clásicos de inyección SQL.

**Conclusión:** Hay que aplicar mejoras en configuración (JWT, Helmet, rate limiting) y en buenas prácticas (validación de entradas, endurecimiento de CORS y health). No se encontraron vulnerabilidades críticas de inyección o XSS en el código actual.

---

## 1. Lo que está bien implementado

| Área | Detalle |
|------|--------|
| **Autenticación** | JWT + bcrypt para contraseñas; verificación de usuario activo; token en header `Authorization: Bearer`. |
| **Autorización** | Middleware por ruta; permisos por rol (comprar, recepcion, ver-compras, logs, gestion-usuarios, etc.). |
| **CORS** | Lista de orígenes definida (FRONTEND_URL, localhost, Capacitor, rangos LAN). |
| **Body size** | `express.json({ limit: '1mb' })` limita el tamaño del body. |
| **SQL / Prisma** | Prisma ORM; en `logs` y `lib/logs.js` se usa `$queryRawUnsafe` / `$executeRawUnsafe` con **parámetros** ($1, $2…), no concatenación. |
| **SQL Server (mssql)** | Uso de `request.input()` para valores que pueden venir del usuario; nombres de tablas/columnas desde env, no desde input. |
| **Manejo de errores** | Errores devueltos en JSON; mensajes genéricos al cliente; códigos para soporte. |
| **Frontend** | Sin `dangerouslySetInnerHTML` ni `eval`; React escapa por defecto; manual desde `/manual-usuario.md` (contenido controlado). |

---

## 2. Riesgos y recomendaciones

### 2.1 Crítico / Alta prioridad

#### JWT_SECRET por defecto en producción — **IMPLEMENTADO**

- **`backend/src/lib/config.js`:** Función `getJwtSecret()` que en producción exige que `JWT_SECRET` exista y tenga al menos 32 caracteres; en desarrollo usa `'secret-dev'` si falta.
- El servidor llama a `getJwtSecret()` al arrancar y hace `process.exit(1)` si falla en producción.
- Auth y middleware usan `getJwtSecret()` en lugar de leer la variable directamente.
- En el `.env` debés tener un valor de al menos 32 caracteres (por ejemplo generado con `openssl rand -base64 32`).

---

#### Rate limiting — **IMPLEMENTADO**

- **Límite global:** 300 peticiones por 15 minutos por IP en `/api`.
- **Auth:** 10 peticiones por 15 minutos en `/api/auth/login` y `/api/auth/registro` (mitiga fuerza bruta).
- Se usa `express-rate-limit` con `standardHeaders: true` (cabecera `RateLimit-*` en respuestas).
- En producción se activa `trust proxy: 1` para que la IP sea la del cliente cuando hay proxy (Render, Nginx, etc.). Podés desactivarlo con `TRUST_PROXY=false`.

---

### 2.2 Media prioridad

#### Cabeceras de seguridad (Helmet) — **IMPLEMENTADO**

- Se usa `helmet()` con `contentSecurityPolicy: false` (evita romper recursos del frontend) y `crossOriginResourcePolicy: { policy: 'cross-origin' }` para que el cliente pueda cargar recursos.
- Añade entre otras: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, etc.

---

#### CORS: origen `null`

**Riesgo:** `if (!origin) return cb(null, true)` acepta peticiones sin cabecera `Origin` (p. ej. apps nativas, algunas herramientas). Cualquier cliente que no envíe `Origin` puede acceder si tiene credenciales (cookies/token).

**Recomendación:**

- Mantener la lógica actual si necesitáis soportar Capacitor/app nativa.
- En producción, restringir aún más: por ejemplo, en producción no aceptar `origin === null` salvo que sea estrictamente necesario para la app móvil, y documentar el motivo.

---

#### Endpoints de health

**Situación:** `/api/health` y `/api/health/db` son públicos (sin auth). Es habitual para monitoreo; `/api/health/db` puede revelar si la base responde.

**Recomendación:**

- Dejar `/api/health` público si lo usan balanceadores o monitoreo.
- Para `/api/health/db`, una opción es protegerla (por ejemplo, con una API key en cabecera o en query solo para el sistema de monitoreo) o exponerla solo en una red interna. Si se deja pública, asumir que un atacante puede saber si la DB está viva.

---

#### Validación de entradas — **IMPLEMENTADO**

- **`backend/src/lib/validation.js`:** Constantes `LIMITS` (EMAIL_MAX 255, PASSWORD_MIN 8, PASSWORD_MAX 128, NOMBRE_MAX 200) y funciones `validateEmail`, `validatePassword`, `validateNombre`.
- **Auth (login y registro):** Se valida email (formato y longitud), contraseña (8–128 caracteres) y nombre (longitud). Mensajes en `MSG.AUTH_*`.
- **Usuarios (crear y PATCH):** Misma validación para email, contraseña y nombre. Mensajes en `MSG.USERS_*`.

---

### 2.3 Baja prioridad / refuerzo

#### Token en localStorage (frontend)

**Riesgo:** Si en el futuro hubiera XSS (p. ej. por una dependencia o contenido no sanitizado), el token podría ser robado.

**Mitigación actual:** Sin `dangerouslySetInnerHTML`; manual desde estático; React escapa. Riesgo bajo con el código actual.

**Refuerzo:** Mantener el manual y cualquier contenido dinámico desde fuentes confiables; revisar dependencias (npm audit) y usar Content-Security-Policy cuando sea posible.

---

#### Contraseñas

**Recomendación:** Además de bcrypt, aplicar política mínima: longitud mínima (8) y máxima (128), y opcionalmente complejidad (mayúsculas, números, símbolos) según requisitos del negocio.

---

#### Registro público

**Situación:** `/api/auth/registro` permite crear usuarios; el rol se limita a Visor/Comprador (no Admin). Si el sistema es solo interno, el registro abierto puede no ser deseado.

**Recomendación:** Valorar desactivar registro en producción (variable de entorno) o proteger el registro con un token/código de invitación.

---

## 3. Checklist de implementación sugerida

1. **JWT_SECRET:** Exigir en producción; sin valor por defecto en prod.
2. **Rate limiting:** Global + estricto en `/api/auth/login`.
3. **Helmet:** Activar con configuración que no rompa la app (CSP opcional en una segunda fase).
4. **Validación:** Longitud y formato de email, contraseña y nombres en auth y usuarios.
5. **CORS:** Revisar si en producción se debe restringir `origin === null`.
6. **Health:** Decidir si `/api/health/db` debe ser privado o con API key.
7. **Registro:** Decidir si se desactiva o se restringe en producción.
8. **Auditoría:** Ejecutar `npm audit` en backend y frontend y corregir vulnerabilidades conocidas.

---

## 4. Resumen de archivos relevantes

| Archivo | Uso |
|---------|-----|
| `backend/src/index.js` | CORS, body limit, rutas, health. |
| `backend/src/middleware/auth.js` | JWT y permisos. |
| `backend/src/routes/auth.js` | Login, registro, /me; JWT_SECRET. |
| `backend/src/routes/logs.js` | Raw SQL con parámetros. |
| `backend/src/lib/logs.js` | Insert con parámetros. |
| `backend/src/lib/sqlserver.js` | Consultas con `request.input()`. |
| `frontend/src/context/AuthContext.jsx` | Token y usuario en localStorage. |
| `frontend/src/pages/ManualUsuario.jsx` | Markdown desde estático. |

Si querés, el siguiente paso puede ser implementar en el repo los puntos 1 (JWT), 2 (rate limit) y 3 (Helmet) con parches concretos en los archivos indicados.
