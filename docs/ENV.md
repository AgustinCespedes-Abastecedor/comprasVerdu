# Variables de entorno – Compras Verdu vs Ticketador

Si copiás el `.env` de **Ticketador** para usarlo en **Compras Verdu**, tenés que ajustar varios valores. Este documento indica qué cambiar.

---

## Dónde va el .env

- **Ticketador:** `.env` en la carpeta `ticket-system` (junto a `docker-compose.yml`).
- **Compras Verdu:** `.env` en la **raíz del proyecto** (junto a `docker-compose.yml`).

---

## Variables que comparten ambos proyectos

| Variable        | Ticketador (ejemplo)     | Compras Verdu (qué poner)        |
|----------------|--------------------------|-----------------------------------|
| `JWT_SECRET`   | clave segura             | **Mismo:** una clave segura distinta por proyecto (no reutilizar la de Ticketador en producción). |
| `FRONTEND_URL` | `http://192.168.1.100`   | **Cambiar:** URL donde se accede a Compras Verdu. Ejemplo: `http://192.168.1.100:8081` (Compras Verdu usa puerto **8081**, no 80). |

---

## Variables que solo usa Ticketador (no las pongas en Compras Verdu)

Podés **omitirlas** o dejarlas comentadas en el `.env` de Compras Verdu:

- `JWT_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`

Compras Verdu no usa correo ni refresh token con esas variables.

---

## Variables que solo usa Compras Verdu (agregar al .env)

En el `.env` de la **raíz** de Compras Verdu tenés que tener:

### Base de datos (PostgreSQL del contenedor)

| Variable            | Descripción                    | Ejemplo / valor típico        |
|--------------------|---------------------------------|-------------------------------|
| `POSTGRES_USER`    | Usuario de PostgreSQL           | `compras_verdu`               |
| `POSTGRES_PASSWORD`| Contraseña de PostgreSQL        | Una contraseña segura         |
| `POSTGRES_DB`      | Nombre de la base               | `compras_verdu`               |

En Docker no hace falta definir `DATABASE_URL` a mano: el `docker-compose.yml` la arma con estas variables (conexión al contenedor `db`).

### SQL Server externo (El Abastecedor)

Si Compras Verdu se conecta a un SQL Server externo (El Abastecedor):

| Variable                         | Descripción              | Ejemplo                    |
|----------------------------------|--------------------------|----------------------------|
| `EXTERNAL_DB_SERVER`             | IP/host del SQL Server   | `192.168.1.200`            |
| `EXTERNAL_DB_PORT`               | Puerto (por defecto 1433)| `1433`                     |
| `EXTERNAL_DB_DATABASE`           | Base de datos            | `ELABASTECEDOR`            |
| `EXTERNAL_DB_USER`               | Usuario                  | `shs`                       |
| `EXTERNAL_DB_PASSWORD`           | Contraseña               | Vacío (ELABASTECEDOR no usa password) |
| `EXTERNAL_ARTICULOS_DEPARTAMENTO_ID` | ID departamento verdulería (opcional) | `6` |

Si no usás integración con El Abastecedor, podés dejar vacíos o por defecto `EXTERNAL_DB_*`; el backend puede tener valores por defecto en código.

---

## Resumen: si partís del .env de Ticketador

1. **Copiá** el `.env` de Ticketador a la raíz de Compras Verdu (o copiá `.env.example` de Compras Verdu).
2. **Cambiá** `FRONTEND_URL` a la URL de Compras Verdu, **con puerto 8081**, por ejemplo:  
   `FRONTEND_URL=http://TU_IP:8081` o `http://localhost:8081`.
3. **Eliminá o ignorá** en Compras Verdu: `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, y todas las `MAIL_*`.
4. **Agregá** las variables de Compras Verdu:
   - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
   - Si aplica: `EXTERNAL_DB_SERVER`, `EXTERNAL_DB_PORT`, `EXTERNAL_DB_DATABASE`, `EXTERNAL_DB_USER`, `EXTERNAL_DB_PASSWORD`, y opcionalmente `EXTERNAL_ARTICULOS_DEPARTAMENTO_ID`.
5. **Usá un `JWT_SECRET` distinto** al de Ticketador en producción.

---

## Puertos en el mismo servidor

Para que no se pisen con Ticketador:

| Proyecto      | Puerto (host) | Uso                    |
|---------------|----------------|------------------------|
| Ticketador    | 80, 443        | Nginx / HTTPS          |
| Ticketador    | 8080           | Frontend (si se usa directo) |
| **Compras Verdu** | **8081**   | Frontend (Nginx SPA + proxy /api) |
| Compras Verdu | (interno 4000) | Backend solo dentro de Docker |

El backend de Compras Verdu no se expone en un puerto del host; se accede vía frontend en `http://host:8081` y el proxy `/api` lo envía al contenedor backend.
