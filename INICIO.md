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

Este comando:

1. Levanta PostgreSQL (Docker)
2. Espera a que la base esté lista
3. Ejecuta Prisma generate, db:push y db:seed
4. Configura el firewall (puerto 4000)
5. Abre el backend en una ventana nueva (puerto 4000)
6. Inicia el frontend en la ventana actual (puerto 5173)

**Web:** http://localhost:5173  
**API:** http://localhost:4000

Usuarios de prueba (tras el seed):

- `comprador@comprasverdu.com` / `admin123`
- `a.cespedes@elabastecedor.com.ar` / `admin1234`

---

## Inicio manual (dos terminales)

### Terminal 1 – Backend

```powershell
# Opcional: levantar PostgreSQL si usás Docker
docker-compose up -d db

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
   - Con Docker: `docker-compose up -d db`
   - Comprobar: `netstat -an | findstr 5433`

2. **Base de datos sin tablas ni usuarios**
   ```powershell
   cd backend
   npm run db:push
   npm run db:seed
   ```

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
