# Compras Verdu – Guía de inicio

## Resumen de puertos

| Servicio     | Puerto | Descripción                                        |
|--------------|--------|----------------------------------------------------|
| **Backend**  | 4000   | API REST (Express). Único servidor que escucha.    |
| **Frontend** | 5173   | Vite (dev). En navegador usa proxy `/api` → 4000.  |
| **PostgreSQL** | 5433 | Base de datos (Docker, mapeado desde 5432).        |

La APK en celular/emulador se conecta directo a `http://<IP-de-tu-PC>:4000/api`.  
No hay conflicto: solo el backend usa el puerto 4000.

---

## Inicio rápido (todo en uno)

Desde la raíz del proyecto:

```powershell
npm run start
```

Solo para preparar la base la primera vez (o tras borrar el volumen Docker), sin abrir el IDE completo:

```powershell
npm run setup:dev
```

Eso crea `backend/.env` si no existe, levanta Postgres (`docker-compose.db.yml`), ejecuta Prisma generate, `db push` y `db:seed`.

`npm run start` hace lo siguiente:

1. Levanta PostgreSQL (Docker)
2. Espera a que la base esté lista
3. Ejecuta Prisma generate, db:push y db:seed
4. Configura el firewall (puerto 4000)
5. Abre el backend en una ventana nueva (puerto 4000)
6. Inicia el frontend en la ventana actual (puerto 5173)

**Web:** http://localhost:5173  
**API:** http://localhost:4000

El **seed** solo crea **roles** en Postgres. Los usuarios y contraseñas son los de **ELABASTECEDOR** (`EXTERNAL_AUTH_LOGIN=true` y `EXTERNAL_DB_*` en `backend/.env`). El **Nivel** en `dbo.Usuarios` define el rol en la app (ver `backend/src/lib/nivelRol.js`).

---

## Inicio manual (dos terminales)

### Terminal 1 – Backend

```powershell
# Opcional: levantar PostgreSQL si usás Docker (expone 5433 en el host)
docker compose -f docker-compose.db.yml up -d

cd backend
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

### Terminal 2 – Frontend

```powershell
cd frontend
npm install
npm run dev
```

---

## Firewall (para APK / celular en red local)

Para que el celular o emulador acceda al backend en la PC:

1. Abrí PowerShell **como Administrador**
2. Ejecutá:
   ```powershell
   cd C:\ComprasVerdu
   .\scripts\firewall-backend.ps1
   ```

Esto crea una regla que permite conexiones entrantes en el puerto 4000.

---

## APK y `VITE_API_URL`

Al compilar la APK, el frontend usa `VITE_API_URL` de `frontend/.env` para conectar al backend.

1. Obtené tu IP local: `ipconfig` (por ejemplo, 192.168.12.123)
2. En `frontend/.env`:
   ```
   VITE_API_URL=http://192.168.12.123:4000/api
   ```
3. Compilá:
   ```powershell
   npm run apk
   ```

Para emulador Android: se usa `10.0.2.2` en lugar de la IP de la PC.

---

## Solución de problemas

### Error 500 al hacer login

Causas habituales:

1. **PostgreSQL no está corriendo**
   - Con Docker: `docker compose -f docker-compose.db.yml up -d` (o `npm run dev:db` desde la raíz)
   - Comprobar: `netstat -an | findstr 5433`

2. **Base de datos sin tablas ni usuarios**
   - Con stack Docker (`docker compose up` en la raíz): desde el repo, `npm run db:seed` (no depende de publicar Postgres al host).
   - Solo backend en la PC con `docker-compose.db.yml`: `cd backend`, `npm run db:push`, `npm run db:seed`.

3. **Prisma no generado**
   ```powershell
   cd backend
   npm run db:generate
   ```

### Puerto 4000 en uso

```powershell
# Ver qué proceso usa el puerto
netstat -ano | findstr :4000

# Usar otro puerto para el backend
$env:PORT=4001; npm run dev:backend
```

Y en `frontend/vite.config.js` cambiar el proxy a `http://localhost:4001`.

### Error EPERM al instalar en backend

Cerrá el backend, ejecutá `npm run db:generate` y volvé a iniciar.

---

## Orden recomendado de arranque

1. Docker Desktop (si usás PostgreSQL en Docker)
2. `npm run start` o inicio manual en dos terminales
3. Firewall (solo si usás APK o celular en la misma red)

---

## Despliegue con Docker (Linux / servidor)

En el servidor (Ubuntu/Linux) podés levantar todo con Docker y opcionalmente con arranque automático al reiniciar el SO.

### Levantar con Docker

Desde la raíz del proyecto:

```bash
cp .env.example .env
# Editar .env (JWT_SECRET, FRONTEND_URL, EXTERNAL_DB_* si aplica). Ver docs/ENV.md.
./levantar.sh
```

Acceso: **http://localhost:8081** (o la IP del servidor con puerto 8081). El backend no se expone en el host; se usa vía proxy `/api` del frontend.

### Acceso desde otras PCs (misma organización / misma red)

**No usan localhost.** En la PC de cada persona, "localhost" es su propia máquina. Para que cualquiera en tu organización acceda al sistema:

1. **Desde el servidor** (donde corre Docker): abrí **http://localhost:8081**.
2. **Desde cualquier otra PC** (misma red): abrí **http://IP_DEL_SERVIDOR:8081** (ej: `http://192.168.1.50:8081`). La IP es la del equipo donde levantaste Docker.

Opcional: en el `.env` del servidor podés poner `FRONTEND_URL=http://IP_DEL_SERVIDOR:8081` para que coincida con la URL que usa la gente (útil para CORS; además el backend ya acepta orígenes de red 192.168.x.x y 10.x.x.x).

Si no pueden conectarse, revisá que el **firewall del servidor** permita entradas en el puerto **8081** (en Linux: `sudo ufw allow 8081/tcp` y `sudo ufw reload` si usás ufw).

La primera vez que levantás con Docker, las migraciones se aplican solas. Si necesitás usuarios de prueba, ejecutá el seed una vez:  
`docker compose exec backend node prisma/seed.js`

### Arranque automático al reiniciar el SO

```bash
sudo ./deployment/instalar-servicio.sh
```

Ver `deployment/README.md` para más detalles. Si copiás el `.env` desde Ticketador, consultá **docs/ENV.md** para saber qué valores cambiar (puerto 8081, variables de Compras Verdu, etc.).
